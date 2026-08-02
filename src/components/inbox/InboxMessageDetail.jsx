import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "@/lib/momentDate";
import { Trash2, Check, X, Calendar, Shield, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveInboxActionType } from "@/lib/inboxActionTypes";
import InboxContractOffer from "@/components/inbox/InboxContractOffer";
import InboxTrialRequest from "@/components/inbox/InboxTrialRequest";
import InboxScheduleProposal from "@/components/inbox/InboxScheduleProposal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";

const STATUS_COLORS = {
  accepted:              "text-success bg-success/10 border-success/20",
  confirmed:             "text-success bg-success/10 border-success/20",
  declined:              "text-destructive bg-destructive/10 border-destructive/20",
  date_change_requested: "text-warning bg-warning/10 border-warning/20",
  pending:               "text-muted-foreground bg-muted border-border",
};

const STATUS_LABEL_KEYS = {
  accepted: "accepted",
  confirmed: "confirmed",
  declined: "declined",
  date_change_requested: "dateChangeRequested",
  pending: "pending",
};

export default function InboxMessageDetail({ message, onDeleted, onStatusChanged, myClub, myEmail, myGamertag }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [actionError, setActionError] = useState("");

  if (!message || typeof message !== "object") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {t("matchFlow.messageUnavailable", "Message unavailable.")}
      </div>
    );
  }

  async function handleAction(action) {
    if (action === "date_change_requested" && !showDatePicker) {
      setShowDatePicker(true);
      return;
    }
    setLoading(action);
    setActionError("");
    try {
      if (message.message_type === "match_invite") {
        await stageClient.functions.invoke("respondInboxMessage", {
          message_id: message.id,
          action,
          new_date: rescheduleDate || null,
          new_time: rescheduleTime || null,
        });
      } else {
        await stageClient.entities.InboxMessage.update(message.id, { status: action, is_read: true });
      }

      onStatusChanged(message.id, action);
    } catch (err) {
      console.error("[InboxMessageDetail] action failed:", err);
      setActionError(err?.response?.data?.error || err?.message || t("matchFlow.actionFailed"));
    }
    setLoading(null);
    setShowDatePicker(false);
  }

  async function handleDelete() {
    await stageClient.entities.InboxMessage.delete(message.id);
    onDeleted(message.id);
  }

  const status = message.status || "pending";
  const effectiveActionType = getEffectiveInboxActionType(message);
  const hasAction = effectiveActionType !== "none" && status === "pending";
  const isActioned = effectiveActionType !== "none" && status !== "pending";

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
                {message.is_system ? t("matchFlow.stageSystem") : (message.sender_gamertag || t("matchFlow.unknown"))}
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
                  title={t("matchFlow.deleteMessage")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    {t("matchFlow.deleteWithoutResponding")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("matchFlow.deleteWarning")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("matchFlow.keepMessage")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("matchFlow.deleteAnyway")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title={t("matchFlow.deleteMessage")}
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
            STATUS_COLORS[status] || STATUS_COLORS.pending
          )}>
            {STATUS_LABEL_KEYS[status] ? t(`matchFlow.${STATUS_LABEL_KEYS[status]}`) : status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Needs action banner */}
      {hasAction && (
        <div className="mx-5 mt-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-warning/10 border border-warning/30">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs font-semibold text-warning">{t("matchFlow.responseRequiredNotice")}</p>
        </div>
      )}
      {actionError && (
        <div className="mx-5 mt-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs font-semibold text-destructive">{actionError}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{message.body}</p>

        {/* Related entity info — only show clean human-readable labels, never raw IDs */}
        {message.related_entity_type === "match" && (
          <div className="mt-4 p-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground flex items-center gap-1.5">
            <span>⚽</span>
            <span>
              {t("matchFlow.linkedMatchNotice", { schedule: t("matchFlow.scheduleTitle") })}
            </span>
          </div>
        )}

        {/* Trial request — club president response UI */}
        {message.message_type === "trial_request" && effectiveActionType === "trial_response" && (
          <InboxTrialRequest
            message={message}
            onActioned={(action) => {
              if (action === "offer" || action === "decline") {
                onStatusChanged?.(message.id, action === "offer" ? "accepted" : "declined");
              }
            }}
          />
        )}

        {/* Contract offer — inline negotiation UI */}
        {message.message_type === "contract_offer" && effectiveActionType === "contract_negotiation" && (
          <InboxContractOffer
            message={message}
            onActioned={(action) => {
              if (action === "accept" || action === "reject") {
                onStatusChanged?.(message.id, action === "accept" ? "accepted" : "declined");
              }
            }}
          />
        )}

        {/* League / competition scheduling proposal */}
        {message.message_type === "league_schedule" && (
          <InboxScheduleProposal
            message={message}
            myClub={myClub}
            myEmail={myEmail}
            myGamertag={myGamertag}
            onActioned={(status) => onStatusChanged?.(message.id, status)}
          />
        )}
      </div>

      {/* Action buttons — only for non-contract, non-trial, non-schedule messages */}
      {hasAction && message.message_type !== "contract_offer" && message.message_type !== "trial_request" && message.message_type !== "league_schedule" && (
        <div className="p-4 border-t border-warning/20 bg-warning/5">
          <p className="text-xs text-warning mb-3 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t("matchFlow.yourResponseRequired")}
          </p>
          <div className="flex flex-wrap gap-2">
            {(effectiveActionType === "accept_decline" || effectiveActionType === "accept_decline_date") && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAction("accepted")}
                  disabled={!!loading}
                  className="bg-success text-white hover:bg-success/90 gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {loading === "accepted" ? t("matchFlow.accepting") : t("matchFlow.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("declined")}
                  disabled={!!loading}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  {loading === "declined" ? t("matchFlow.declining") : t("matchFlow.decline")}
                </Button>
              </>
            )}
            {effectiveActionType === "confirm" && (
              <Button
                size="sm"
                onClick={() => handleAction("confirmed")}
                disabled={!!loading}
                className="bg-success text-white hover:bg-success/90 gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {loading === "confirmed" ? t("matchFlow.confirming") : t("matchFlow.confirm")}
              </Button>
            )}
            {effectiveActionType === "accept_decline_date" && (
              <>
                {showDatePicker ? (
                  <div className="flex flex-col gap-2 w-full">
                    <p className="text-xs text-warning font-semibold">{t("matchFlow.proposeDateTime")}</p>
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
                        {loading === "date_change_requested" ? t("matchFlow.sending") : t("matchFlow.sendProposal")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)} className="text-muted-foreground">
                        {t("matchFlow.cancel")}
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
                    {t("matchFlow.requestDifferentDate")}
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
