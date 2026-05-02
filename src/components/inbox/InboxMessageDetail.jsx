import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Trash2, Check, X, Calendar, Shield, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import InboxContractOffer from "@/components/inbox/InboxContractOffer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const STATUS_COLORS = {
  accepted:              "text-success bg-success/10 border-success/20",
  confirmed:             "text-success bg-success/10 border-success/20",
  declined:              "text-destructive bg-destructive/10 border-destructive/20",
  date_change_requested: "text-warning bg-warning/10 border-warning/20",
  pending:               "text-muted-foreground bg-muted border-border",
};

export default function InboxMessageDetail({ message, onDeleted, onStatusChanged }) {
  const [loading, setLoading] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  async function handleAction(action) {
    if (action === "date_change_requested" && !showDatePicker) {
      setShowDatePicker(true);
      return;
    }
    setLoading(action);
    await base44.functions.invoke("respondInboxMessage", {
      message_id: message.id,
      action,
      new_date: rescheduleDate || undefined,
      new_time: rescheduleTime || undefined,
    });
    onStatusChanged(message.id, action);
    setLoading(null);
    setShowDatePicker(false);
  }

  async function handleDelete() {
    await base44.entities.InboxMessage.delete(message.id);
    onDeleted(message.id);
  }

  const hasAction = message.action_type && message.action_type !== "none" && message.status === "pending";
  const isActioned = message.action_type && message.action_type !== "none" && message.status !== "pending";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Sender avatar */}
            {message.is_system ? (
              <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0">
                ⚡
              </div>
            ) : message.sender_avatar_url ? (
              <img
                src={message.sender_avatar_url}
                alt={message.sender_gamertag}
                className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-secondary border border-border flex items-center justify-center text-base font-bold text-foreground shrink-0">
                {(message.sender_gamertag || "?")[0].toUpperCase()}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-foreground">
                {message.is_system ? "STAGE System" : (message.sender_gamertag || "Unknown")}
              </p>
              {message.sender_club_name && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{message.sender_club_name}</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {format(new Date(message.created_date), "d MMM yyyy • HH:mm")}
              </p>
            </div>
          </div>

          {/* Delete — with confirmation warning if action pending */}
          {hasAction ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Delete message"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Delete without responding?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This message requires your response. If you delete it now, the sender will not receive any answer and the action will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep message</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete anyway
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Delete message"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Subject */}
        <h2 className="mt-4 text-lg font-bold text-foreground leading-snug">{message.subject}</h2>

        {/* Status badge if actioned */}
        {isActioned && (
          <span className={cn(
            "inline-block mt-2 text-xs px-2 py-0.5 rounded border font-medium",
            STATUS_COLORS[message.status] || STATUS_COLORS.pending
          )}>
            {message.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Needs action banner */}
      {hasAction && (
        <div className="mx-5 mt-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-warning/10 border border-warning/30">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs font-semibold text-warning">This message requires your response. See options below.</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{message.body}</p>

        {/* Related entity info — only show clean human-readable labels, never raw IDs */}
        {message.related_entity_type === "match" && (
          <div className="mt-4 p-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground flex items-center gap-1.5">
            <span>⚽</span>
            <span>This message is linked to a scheduled match. Check your <span className="text-foreground font-medium">Schedule</span> for details.</span>
          </div>
        )}

        {/* Contract offer — inline negotiation UI */}
        {message.message_type === "contract_offer" && message.action_type === "contract_negotiation" && (
          <InboxContractOffer
            message={message}
            onActioned={(action) => {
              if (action === "accept" || action === "reject") {
                onStatusChanged?.(message.id, action === "accept" ? "accepted" : "declined");
              }
            }}
          />
        )}
      </div>

      {/* Action buttons — only for non-contract messages */}
      {hasAction && message.message_type !== "contract_offer" && (
        <div className="p-4 border-t border-warning/20 bg-warning/5">
          <p className="text-xs text-warning mb-3 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Your response required
          </p>
          <div className="flex flex-wrap gap-2">
            {(message.action_type === "accept_decline" || message.action_type === "accept_decline_date") && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAction("accepted")}
                  disabled={!!loading}
                  className="bg-success text-white hover:bg-success/90 gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {loading === "accepted" ? "Accepting…" : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("declined")}
                  disabled={!!loading}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  {loading === "declined" ? "Declining…" : "Decline"}
                </Button>
              </>
            )}
            {message.action_type === "confirm" && (
              <Button
                size="sm"
                onClick={() => handleAction("confirmed")}
                disabled={!!loading}
                className="bg-success text-white hover:bg-success/90 gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {loading === "confirmed" ? "Confirming…" : "Confirm"}
              </Button>
            )}
            {message.action_type === "accept_decline_date" && (
              <>
                {showDatePicker ? (
                  <div className="flex flex-col gap-2 w-full">
                    <p className="text-xs text-warning font-semibold">Propose new date/time:</p>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={rescheduleDate}
                        onChange={e => setRescheduleDate(e.target.value)}
                        className="bg-secondary border-border text-xs h-8"
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <Input
                        type="time"
                        value={rescheduleTime}
                        onChange={e => setRescheduleTime(e.target.value)}
                        className="bg-secondary border-border text-xs h-8 w-28"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction("date_change_requested")}
                        disabled={!!loading || !rescheduleDate || !rescheduleTime}
                        className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10"
                        variant="outline"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {loading === "date_change_requested" ? "Sending…" : "Send Proposal"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)} className="text-muted-foreground">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("date_change_requested")}
                    disabled={!!loading}
                    className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Request different date
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}