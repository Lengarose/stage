import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, isToday } from "@/lib/momentDate";
import { Trash2, Check, X, Calendar, Shield, AlertTriangle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveInboxActionType, inboxGameDayHref, isMatchCancelRequest } from "@/lib/inboxActionTypes";
import InboxContractOffer from "@/components/inbox/InboxContractOffer";
import InboxLoanProposal from "@/components/inbox/InboxLoanProposal";
import InboxLoanRecalled from "@/components/inbox/InboxLoanRecalled";
import InboxLoanEarlyEnd from "@/components/inbox/InboxLoanEarlyEnd";
import InboxLoanPurchaseOffer from "@/components/inbox/InboxLoanPurchaseOffer";
import InboxLoanTerminatedEarly from "@/components/inbox/InboxLoanTerminatedEarly";
import InboxTrialRequest from "@/components/inbox/InboxTrialRequest";
import InboxScheduleProposal from "@/components/inbox/InboxScheduleProposal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";

const STATUS_COLORS = {
  accepted:              "text-emerald-300 bg-emerald-500/15 border-emerald-400/25",
  confirmed:             "text-emerald-300 bg-emerald-500/15 border-emerald-400/25",
  declined:              "text-rose-300 bg-rose-500/15 border-rose-400/25",
  date_change_requested: "text-amber-300 bg-amber-500/15 border-amber-400/25",
  pending:               "text-white/50 bg-white/[0.06] border-white/10",
};

const STATUS_LABEL_KEYS = {
  accepted: "accepted",
  confirmed: "confirmed",
  declined: "declined",
  date_change_requested: "dateChangeRequested",
  pending: "pending",
};

function bubbleTime(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "HH:mm");
}

function dayLabel(dateValue, t) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return t("matchFlow.today", "Today");
  return format(d, "d MMM yyyy");
}

export default function InboxMessageDetail({
  message,
  onDeleted,
  onStatusChanged,
  onBack,
  myClub,
  myEmail,
  myGamertag,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [actionError, setActionError] = useState("");

  if (!message || typeof message !== "object") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-white/45">
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
      await stageClient.functions.invoke("respondInboxMessage", {
        message_id: message.id,
        action,
        new_date: rescheduleDate || null,
        new_time: rescheduleTime || null,
      });
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
  const isCancelRequest = isMatchCancelRequest(message);
  const senderName = message.is_system
    ? t("matchFlow.stageSystem")
    : (message.sender_gamertag || t("matchFlow.unknown"));

  const showGenericActions = hasAction
    && (
      effectiveActionType === "open_match"
      || (
        message.message_type !== "contract_offer"
        && message.message_type !== "loan_proposal"
        && message.message_type !== "loan_purchase"
        && message.message_type !== "loan_recalled"
        && message.message_type !== "loan_early_end"
        && message.message_type !== "loan_terminated_early"
        && message.message_type !== "trial_request"
        && message.message_type !== "league_schedule"
      )
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b1220]">
      {/* Chat header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#101826] px-3 py-2.5 lg:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1.5 text-cyan-300 transition hover:bg-white/[0.06] lg:hidden"
            aria-label={t("matchFlow.backToInbox")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {message.is_system ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-teal-700/40 text-base ring-1 ring-cyan-400/20">
            ⚡
          </div>
        ) : message.sender_avatar_url ? (
          <img
            src={message.sender_avatar_url}
            alt={senderName}
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1c2433] text-sm font-bold text-white/80 ring-1 ring-white/10">
            {senderName[0].toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{senderName}</p>
          {message.sender_club_name ? (
            <p className="flex items-center gap-1 truncate text-[11px] text-white/40">
              <Shield className="h-3 w-3 shrink-0" />
              {message.sender_club_name}
            </p>
          ) : (
            <p className="truncate text-[11px] text-white/40">{message.subject}</p>
          )}
        </div>

        {hasAction ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="rounded-full p-2 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-300"
                title={t("matchFlow.deleteMessage")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
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
            type="button"
            onClick={handleDelete}
            className="rounded-full p-2 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-300"
            title={t("matchFlow.deleteMessage")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Message thread */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,229,255,0.4) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,9,18,0.15) 0%, rgba(11,18,32,0.55) 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-3 px-3 py-4 lg:px-8">
          <div className="flex justify-center">
            <span className="rounded-md bg-black/35 px-3 py-1 text-[11px] font-medium text-white/55 shadow-sm backdrop-blur-sm">
              {dayLabel(message.created_date, t)}
            </span>
          </div>

          {actionError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
              <p className="text-xs font-semibold text-rose-200">{actionError}</p>
            </div>
          )}

          {/* Incoming bubble — one record = one bubble */}
          <div className="flex max-w-[min(100%,34rem)] flex-col items-start">
            <div className="relative rounded-2xl rounded-tl-md bg-[#182233] px-3.5 py-2.5 shadow-lg ring-1 ring-white/[0.06]">
              <p className="mb-1.5 text-[13px] font-semibold text-cyan-300/90">{message.subject}</p>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">{message.body}</p>

              {isActioned && (
                <span className={cn(
                  "mt-2 inline-block rounded border px-2 py-0.5 text-[10px] font-medium",
                  STATUS_COLORS[status] || STATUS_COLORS.pending
                )}>
                  {STATUS_LABEL_KEYS[status] ? t(`matchFlow.${STATUS_LABEL_KEYS[status]}`) : status.replace(/_/g, " ")}
                </span>
              )}

              <div className="mt-1.5 flex items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-white/35">
                  {bubbleTime(message.created_date)}
                </span>
              </div>
            </div>
          </div>

          {hasAction && (
            <div className="flex max-w-[min(100%,34rem)] items-start">
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("matchFlow.responseRequiredNotice")}
              </div>
            </div>
          )}

          {message.related_entity_type === "match" && (
            <div className="max-w-[min(100%,34rem)] rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/50">
              ⚽ {t("matchFlow.linkedMatchNotice", { schedule: t("matchFlow.scheduleTitle") })}
            </div>
          )}

          <div className="max-w-[min(100%,34rem)] space-y-3">
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
            {message.message_type === "loan_proposal" && (effectiveActionType === "loan_parent_response" || effectiveActionType === "loan_player_response") && (
              <InboxLoanProposal
                message={message}
                onActioned={(action) => {
                  if (action === "accept") onStatusChanged?.(message.id, "accepted");
                  if (action === "reject") onStatusChanged?.(message.id, "declined");
                }}
              />
            )}
            {message.message_type === "loan_purchase" && effectiveActionType === "loan_purchase_response" && (
              <InboxLoanPurchaseOffer
                message={message}
                onActioned={(action) => {
                  if (action === "accept") onStatusChanged?.(message.id, "accepted");
                  if (action === "reject") onStatusChanged?.(message.id, "declined");
                }}
              />
            )}
            {message.message_type === "loan_recalled" && (
              <InboxLoanRecalled message={message} />
            )}
            {message.message_type === "loan_early_end" && effectiveActionType === "loan_early_end_response" && (
              <InboxLoanEarlyEnd
                message={message}
                onActioned={(action) => {
                  if (action === "accept") onStatusChanged?.(message.id, "accepted");
                  if (action === "reject") onStatusChanged?.(message.id, "declined");
                }}
              />
            )}
            {message.message_type === "loan_terminated_early" && (
              <InboxLoanTerminatedEarly message={message} />
            )}

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
        </div>
      </div>

      {/* Bottom action bar (composer-like) */}
      {showGenericActions && (
        <div className="shrink-0 border-t border-white/[0.07] bg-[#101826] px-3 py-3 lg:px-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("matchFlow.yourResponseRequired")}
          </p>
          <div className="flex flex-wrap gap-2">
            {effectiveActionType === "open_match" && (
              <Button size="sm" onClick={() => {
                window.location.assign(inboxGameDayHref(message));
              }}>
                {t("nav.gameDay")}
              </Button>
            )}
            {(effectiveActionType === "accept_decline" || effectiveActionType === "accept_decline_date")
              && message.message_type !== "match_result"
              && message.message_type !== "match_dispute" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAction("accepted")}
                  disabled={!!loading}
                  className="gap-1.5 bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  {loading === "accepted"
                    ? t("matchFlow.confirming")
                    : isCancelRequest
                      ? t("matchFlow.confirmCancel", "Confirm cancel")
                      : t("matchFlow.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("declined")}
                  disabled={!!loading}
                  className="gap-1.5 border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                >
                  <X className="h-3.5 w-3.5" />
                  {loading === "declined"
                    ? t("matchFlow.declining")
                    : isCancelRequest
                      ? t("matchFlow.keepMatch", "Keep match")
                      : t("matchFlow.decline")}
                </Button>
              </>
            )}
            {effectiveActionType === "confirm" && (
              <Button
                size="sm"
                onClick={() => handleAction("confirmed")}
                disabled={!!loading}
                className="gap-1.5 bg-emerald-500 text-white hover:bg-emerald-400"
              >
                <Check className="h-3.5 w-3.5" />
                {loading === "confirmed" ? t("matchFlow.confirming") : t("matchFlow.confirm")}
              </Button>
            )}
            {effectiveActionType === "accept_decline_date" && (
              <>
                {showDatePicker ? (
                  <div className="flex w-full flex-col gap-2">
                    <p className="text-xs font-semibold text-amber-300">{t("matchFlow.proposeDateTime")}</p>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={rescheduleDate}
                        onChange={e => setRescheduleDate(e.target.value)}
                        className="h-8 border-white/10 bg-[#182233] text-xs text-white"
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <Input
                        type="time"
                        value={rescheduleTime}
                        onChange={e => setRescheduleTime(e.target.value)}
                        className="h-8 w-28 border-white/10 bg-[#182233] text-xs text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction("date_change_requested")}
                        disabled={!!loading || !rescheduleDate || !rescheduleTime}
                        className="gap-1.5 border-amber-400/40 text-amber-300 hover:bg-amber-500/10"
                        variant="outline"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {loading === "date_change_requested" ? t("matchFlow.sending") : t("matchFlow.sendProposal")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)} className="text-white/45">
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
                    className="gap-1.5 border-amber-400/40 text-amber-300 hover:bg-amber-500/10"
                  >
                    <Calendar className="h-3.5 w-3.5" />
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
