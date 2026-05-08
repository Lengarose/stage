import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "@/lib/momentDate";
import { Check, RefreshCw, CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { proposeTime, acceptProposal } from "@/lib/scheduleEngine";

// Handles message_type="league_schedule" / action_type="schedule_accept_propose"
// Props:
//   message    – the InboxMessage record
//   myClub     – current user's club
//   myEmail    – current user's email
//   myGamertag – display name fallback
//   onActioned – (newStatus: string) => void

export default function InboxScheduleProposal({ message, myClub, myEmail, myGamertag, onActioned }) {
  const meta     = message.metadata || {};
  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);
  const [error,   setError]   = useState("");
  const [counter, setCounter] = useState(false);
  const [cDate,   setCDate]   = useState("");
  const [cTime,   setCTime]   = useState("");

  useEffect(() => { loadFixture(); }, []); // initial load only

  async function loadFixture() {
    setLoading(true);
    try {
      const ent = meta.fixture_type === "regional_league"
        ? base44.entities.RegionalLeagueFixture
        : base44.entities.CompetitionFixture;
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
      await base44.entities.InboxMessage.update(message.id, { status: "confirmed", is_read: true });
      onActioned("confirmed");
    } catch (err) {
      setError(err?.message || "Failed to confirm match. Please try again.");
    } finally { setBusy(null); }
  }

  async function handleCounter() {
    if (!fixture || !cDate || !cTime) return;
    setBusy("counter");
    setError("");
    try {
      const iso  = new Date(`${cDate}T${cTime}:00`).toISOString();
      const role = myClub?.id === fixture.home_club_id ? "home" : "away";
      await proposeTime({ fixture, fixtureType: meta.fixture_type, role, proposedDate: iso, myClub, myEmail, myGamertag });
      await base44.entities.InboxMessage.update(message.id, { status: "date_change_requested", is_read: true });
      setCounter(false);
      setCDate(""); setCTime("");
      onActioned("date_change_requested");
    } catch (err) {
      setError(err?.message || "Failed to send counter-proposal. Please try again.");
    } finally { setBusy(null); }
  }

  const isAlreadyActioned = message.status !== "pending";

  if (loading) {
    return <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!fixture) {
    return <p className="text-xs text-muted-foreground mt-3">Could not load fixture details.</p>;
  }

  const proposedDate = meta.proposed_date ? new Date(meta.proposed_date) : null;
  const deadline     = fixture.window_end  ? new Date(fixture.window_end)  : null;
  const minDate      = new Date().toISOString().split("T")[0];
  const maxDate      = deadline ? deadline.toISOString().split("T")[0] : undefined;

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
        counter ? (
          <div className="space-y-2">
            <p className="text-[11px] text-warning font-semibold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Propose a different time
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                  min={minDate} max={maxDate}
                  className="pl-8 bg-secondary border-border text-xs h-8" />
              </div>
              <div className="relative w-28">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input type="time" value={cTime} onChange={e => setCTime(e.target.value)}
                  className="pl-8 bg-secondary border-border text-xs h-8" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCounter} disabled={!!busy || !cDate || !cTime}
                className="bg-warning text-black hover:bg-warning/90 h-7 text-xs gap-1">
                {busy === "counter" ? <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {busy === "counter" ? "Sending…" : "Send Counter-Proposal"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCounter(false)} disabled={!!busy}
                className="h-7 text-xs text-muted-foreground">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handleAccept} disabled={!!busy}
              className="bg-success text-white hover:bg-success/90 gap-1.5 h-8 text-xs">
              <Check className="w-3.5 h-3.5" />
              {busy === "accept" ? "Confirming…" : "Accept This Time"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCounter(true)} disabled={!!busy}
              className={cn("gap-1.5 h-8 text-xs", "border-warning/40 text-warning hover:bg-warning/10")}>
              <RefreshCw className="w-3.5 h-3.5" />
              Propose Different Time
            </Button>
          </div>
        )
      ) : (
        <div className={cn("text-xs px-3 py-2 rounded border font-medium",
          message.status === "confirmed" ? "text-success bg-success/10 border-success/20"
          : message.status === "date_change_requested" ? "text-warning bg-warning/10 border-warning/20"
          : "text-muted-foreground bg-secondary border-border"
        )}>
          {message.status === "confirmed" ? "✅ You accepted this time — match confirmed."
          : message.status === "date_change_requested" ? "📅 Counter-proposal sent. Waiting for opponent's response."
          : `Responded: ${message.status.replace(/_/g, " ")}`}
        </div>
      )}
    </div>
  );
}
