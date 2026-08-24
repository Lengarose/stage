import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { format } from "@/lib/momentDate";
import { Check, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { acceptProposal, declineProposal } from "@/lib/scheduleEngine";

// Handles message_type="league_schedule" / action_type="schedule_accept_propose"
// Props:
//   message    – the InboxMessage record
//   myClub     – current user's club
//   myEmail    – current user's email
//   myGamertag – display name fallback
//   onActioned – (newStatus: string) => void

function parseMessageMetadata(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

export default function InboxScheduleProposal({ message, myClub, myEmail, myGamertag, onActioned }) {
  void myGamertag;
  const safeMessage = message && typeof message === "object" ? message : {};
  const meta     = parseMessageMetadata(safeMessage.metadata);
  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);
  const [error,   setError]   = useState("");

  // Reload the linked fixture whenever the user opens a different message.
  // Without this, the parent (InboxMessageDetail) reuses the same
  // InboxScheduleProposal component instance across selections and the
  // fixture card stays stale from the first opened message — leading to
  // "the body says Team A vs B, but the fixture card shows Team C vs D".
  // Also reset per-message UI state so errors do not bleed between messages.
  useEffect(() => {
    loadFixture();
    setError("");
    setBusy(null);
  // meta is derived from message.metadata; keying on message.id is the
  // most reliable signal that the user switched messages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeMessage.id, meta.fixture_id, meta.fixture_type]);

  async function loadFixture() {
    setLoading(true);
    setFixture(null);          // clear stale fixture immediately
    try {
      if (!meta.fixture_id) { setFixture(null); return; }
      const ent = meta.fixture_type === "regional_league"
        ? stageClient.entities.RegionalLeagueFixture
        : stageClient.entities.CompetitionFixture;
      const rows = await ent.filter({ id: meta.fixture_id }, null, 1).catch(() => []);
      setFixture(rows[0] || null);
    } finally { setLoading(false); }
  }

  async function handleAccept() {
    if (!fixture) return;
    setBusy("accept");
    setError("");
    try {
      const role = myClub?.id === fixture.home_club_id ? "home" : "away";
      await acceptProposal({ fixture, fixtureType: meta.fixture_type, role, myClub, myEmail });
      if (safeMessage.id) await stageClient.entities.InboxMessage.update(safeMessage.id, { status: "confirmed", is_read: true });
      onActioned("confirmed");
    } catch (err) {
      setError(err?.message || "Failed to confirm match. Please try again.");
    } finally { setBusy(null); }
  }

  async function handleDecline() {
    if (!fixture) return;
    setBusy("decline");
    setError("");
    try {
      const role = myClub?.id === fixture.home_club_id ? "home" : "away";
      await declineProposal({ fixture, fixtureType: meta.fixture_type, role, myClub, myEmail });
      if (safeMessage.id) await stageClient.entities.InboxMessage.update(safeMessage.id, { status: "declined", is_read: true });
      onActioned("declined");
    } catch (err) {
      setError(err?.message || "Failed to decline proposal. Please try again.");
    } finally { setBusy(null); }
  }

  const isAlreadyActioned = safeMessage.status !== "pending";

  if (loading) {
    return <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!fixture) {
    return <p className="text-xs text-muted-foreground mt-3">Could not load fixture details.</p>;
  }

  const proposedDate = meta.proposed_date ? new Date(meta.proposed_date) : null;
  const deadline     = fixture.window_end  ? new Date(fixture.window_end)  : null;

  return (
    <div className="mt-4 space-y-3">
      {/* Context card */}
      <div className="bg-secondary/60 border border-border rounded-lg p-3 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{meta.match_context || "League Match"}</p>
        <p className="text-sm font-semibold text-foreground">{fixture.home_club_name} vs {fixture.away_club_name}</p>
        {deadline && (
          <p className="text-[11px] text-muted-foreground">
            Scheduling deadline: {format(deadline, "EEE d MMM yyyy, HH:mm")}
          </p>
        )}
      </div>

      {/* Proposed date */}
      {proposedDate && (
        <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Proposed match time</p>
            <p className="text-sm font-bold text-foreground">{format(proposedDate, "EEEE d MMMM yyyy 'at' HH:mm")}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      {/* Actions */}
      {!isAlreadyActioned ? (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={handleAccept} disabled={!!busy}
            className="bg-success text-white hover:bg-success/90 gap-1.5 h-8 text-xs">
            <Check className="w-3.5 h-3.5" />
            {busy === "accept" ? "Confirming…" : "Accept This Time"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline} disabled={!!busy}
            className={cn("gap-1.5 h-8 text-xs", "border-warning/40 text-warning hover:bg-warning/10")}>
            <X className="w-3.5 h-3.5" />
            {busy === "decline" ? "Declining…" : "Decline"}
          </Button>
        </div>
      ) : (
        <div className={cn("text-xs px-3 py-2 rounded border font-medium",
          safeMessage.status === "confirmed" ? "text-success bg-success/10 border-success/20"
          : safeMessage.status === "declined" ? "text-warning bg-warning/10 border-warning/20"
          : "text-muted-foreground bg-secondary border-border"
        )}>
          {safeMessage.status === "confirmed" ? "✅ You accepted this time — match confirmed."
          : safeMessage.status === "declined" ? "Proposal declined. The home club can send a new time."
          : `Responded: ${String(safeMessage.status || "pending").replace(/_/g, " ")}`}
        </div>
      )}
    </div>
  );
}
