import { useState, useEffect } from "react";
import { format, isPast, differenceInHours, combineDateTimeToMysql } from "@/lib/momentDate";
import { CalendarDays, Clock, Check, RefreshCw, AlertTriangle, Timer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  proposeTime,
  acceptProposal,
  checkAndExpire,
} from "@/lib/scheduleEngine";
import { useTranslation } from "@/hooks/useTranslation";

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_CLS = {
  open:          "text-muted-foreground border-border bg-secondary/40",
  home_proposed: "text-primary border-primary/30 bg-primary/5",
  away_proposed: "text-warning border-warning/30 bg-warning/5",
  confirmed:     "text-success border-success/30 bg-success/5",
  expired:       "text-destructive border-destructive/30 bg-destructive/5",
  admin_review:  "text-warning border-warning/30 bg-warning/5",
};

// ─── Props ────────────────────────────────────────────────────────────────────
// fixture:     RegionalLeagueFixture or CompetitionFixture object
// fixtureType: "regional_league" | "competition"
// myClub:      current user's club (null = spectator)
// myEmail:     current user's email
// myGamertag:  current user's gamertag (fallback display name)
// onUpdate:    () => void — called after any write so parent can refresh

export default function FixtureSchedulerPanel({ fixture, fixtureType, myClub, myEmail, myGamertag, onUpdate }) {
  const { t } = useTranslation();
  const role = myClub?.id === fixture.home_club_id ? "home"
             : myClub?.id === fixture.away_club_id ? "away"
             : null;

  const sched = fixture.scheduling_status || "open";
  const [proposing, setProposing] = useState(false);
  const [propDate,  setPropDate]  = useState("");
  const [propTime,  setPropTime]  = useState("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  // Auto-expire on mount if the window has passed
  useEffect(() => {
    if (sched !== "open" && sched !== "home_proposed" && sched !== "away_proposed") return;
    if (!fixture.window_end) return;
    if (isPast(new Date(fixture.window_end))) {
      checkAndExpire(fixture, fixtureType).then(expired => { if (expired) onUpdate(); }).catch(() => {});
    }
  }, []); // run only on mount to expire stale windows

  async function handlePropose() {
    if (!propDate || !propTime) return;
    setBusy(true);
    setError("");
    try {
      const proposedDate = combineDateTimeToMysql(propDate, propTime);
      await proposeTime({ fixture, fixtureType, role, proposedDate, myClub, myEmail, myGamertag });
      setProposing(false);
      setPropDate(""); setPropTime("");
      onUpdate();
    } catch (err) {
      setError(err?.message || t("fspProposalFailed"));
    } finally { setBusy(false); }
  }

  async function handleAccept() {
    setBusy(true);
    setError("");
    try {
      await acceptProposal({ fixture, fixtureType, role, myClub, myEmail });
      onUpdate();
    } catch (err) {
      setError(err?.message || t("fspConfirmFailed"));
    } finally { setBusy(false); }
  }

  const STATUS_LABELS = {
    open: t("fspAwaitingSchedule"),
    home_proposed: t("fspTimeProposed"),
    away_proposed: t("fspCounterProposal"),
    confirmed: t("fspConfirmed"),
    expired: t("fspWindowExpired"),
    admin_review: t("fspAdminReview"),
  };
  const statusLabel = STATUS_LABELS[sched] || STATUS_LABELS.open;
  const statusCls = STATUS_CLS[sched] || STATUS_CLS.open;
  const deadline    = fixture.window_end ? new Date(fixture.window_end) : null;
  const deadlinePast = deadline && isPast(deadline);
  const hoursLeft   = deadline && !deadlinePast ? differenceInHours(deadline, new Date()) : 0;

  // Which proposed date does the current user need to respond to?
  const pendingProposal = sched === "home_proposed" && role === "away"
    ? fixture.home_proposed_date
    : sched === "away_proposed" && role === "home"
    ? fixture.away_proposed_date
    : null;

  const myPendingProposal = sched === "home_proposed" && role === "home"
    ? fixture.home_proposed_date
    : sched === "away_proposed" && role === "away"
    ? fixture.away_proposed_date
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 text-sm">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("fspMatchScheduling")}
          </span>
        </div>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", statusCls)}>
          {statusLabel}
        </span>
      </div>

      {/* Deadline */}
      {deadline && sched !== "confirmed" && sched !== "expired" && sched !== "admin_review" && (
        <div className={cn("flex items-center gap-1.5 text-[11px]", deadlinePast ? "text-destructive" : hoursLeft < 24 ? "text-warning" : "text-muted-foreground")}>
          <Timer className="w-3.5 h-3.5 shrink-0" />
          {deadlinePast
            ? t("fspDeadlinePassed")
            : hoursLeft < 24
            ? t("fspDeadlineIn", { hours: hoursLeft })
            : t("fspDeadline", { date: format(deadline, "EEE d MMM, HH:mm") })}
        </div>
      )}

      {/* ── Confirmed ── */}
      {sched === "confirmed" && fixture.confirmed_date && (
        <div className="flex items-center gap-2 text-success text-sm font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          {format(new Date(fixture.confirmed_date), "EEEE d MMMM yyyy 'at' HH:mm")}
        </div>
      )}

      {/* ── Expired ── */}
      {sched === "expired" && (
        <p className="text-xs text-destructive/80">
          {t("fspExpiredNote")}
        </p>
      )}

      {/* ── Admin review ── */}
      {sched === "admin_review" && (
        <p className="text-xs text-warning/80">
          {t("fspAdminReviewNote")}
        </p>
      )}

      {/* ── Opponent's proposal waiting for MY response ── */}
      {pendingProposal && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">{t("fspOpponentProposes")}</p>
              <p className="text-sm font-semibold text-foreground">
                {format(new Date(pendingProposal), "EEEE d MMMM yyyy 'at' HH:mm")}
              </p>
            </div>
          </div>
          {!proposing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAccept} disabled={busy}
                className="bg-success text-white hover:bg-success/90 gap-1.5 h-7 text-xs">
                <Check className="w-3.5 h-3.5" />
                {busy ? t("fspConfirming") : t("accept")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setProposing(true)} disabled={busy}
                className="gap-1.5 h-7 text-xs border-warning/40 text-warning hover:bg-warning/10">
                <RefreshCw className="w-3.5 h-3.5" />
                {t("fspProposeDifferent")}
              </Button>
            </div>
          ) : <ProposalForm t={t} propDate={propDate} propTime={propTime} deadline={deadline}
              onDateChange={setPropDate} onTimeChange={setPropTime}
              onSubmit={handlePropose} onCancel={() => setProposing(false)} busy={busy} />}
        </div>
      )}

      {/* ── My proposal is out, waiting for their response ── */}
      {myPendingProposal && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {t("fspYourProposal")}: <span className="text-foreground font-medium ml-1">
            {format(new Date(myPendingProposal), "EEE d MMM 'at' HH:mm")}
          </span>
          <span className="ml-1">— {t("fspWaitingResponse")}</span>
        </div>
      )}

      {/* ── Open window, home team's turn ── */}
      {sched === "open" && role === "home" && (
        proposing
          ? <ProposalForm t={t} propDate={propDate} propTime={propTime} deadline={deadline}
              onDateChange={setPropDate} onTimeChange={setPropTime}
              onSubmit={handlePropose} onCancel={() => setProposing(false)} busy={busy} />
          : <Button size="sm" onClick={() => setProposing(true)}
              className="gap-1.5 h-7 text-xs bg-primary text-primary-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              {t("fspProposeTime")}
            </Button>
      )}

      {/* ── Open window, away team waiting ── */}
      {sched === "open" && role === "away" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {t("fspWaitingHome")}
        </p>
      )}

      {/* ── Spectator / no role ── */}
      {!role && sched === "open" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {t("fspNotScheduled")}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      {/* Proposal counter */}
      {(fixture.proposal_count || 0) > 0 && sched !== "confirmed" && (
        <p className="text-[10px] text-muted-foreground/50">
          {t("fspProposalsExchanged", { count: fixture.proposal_count })}
        </p>
      )}
    </div>
  );
}

function ProposalForm({ t, propDate, propTime, deadline, onDateChange, onTimeChange, onSubmit, onCancel, busy }) {
  const minDate = new Date().toISOString().split("T")[0];
  const deadlineIso = deadline instanceof Date
    ? (Number.isNaN(deadline.getTime()) ? null : deadline.toISOString())
    : (typeof deadline === "string" ? deadline : null);
  const maxDate = deadlineIso ? deadlineIso.split("T")[0] : undefined;
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-warning font-semibold uppercase tracking-wider flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> {t("fspProposeTime")}
        {deadline && <span className="normal-case font-normal ml-1 text-muted-foreground">
          ({t("fspMustBeBefore", { date: format(new Date(deadline), "d MMM") })})
        </span>}
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input type="date" value={propDate} onChange={e => onDateChange(e.target.value)}
            min={minDate} max={maxDate}
            className="pl-8 bg-secondary border-border text-xs h-8" />
        </div>
        <div className="relative w-28">
          <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input type="time" value={propTime} onChange={e => onTimeChange(e.target.value)}
            className="pl-8 bg-secondary border-border text-xs h-8" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={busy || !propDate || !propTime}
          className="bg-primary text-primary-foreground h-7 text-xs gap-1">
          {busy ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : null}
          {busy ? t("fspSending") : t("fspSendProposal")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}
          className="h-7 text-xs text-muted-foreground">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
