import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forceSchedule, flagForAdminReview, declareForfeit } from "@/lib/scheduleEngine";
import { combineDateTime, toMysqlDateTime } from "@/lib/momentDate";
import { swalConfirm } from "@/lib/swal";

export default function ExpiredFixtureRow({ fixture, onResolved, busy, setBusy }) {
  const [forceDate, setForceDate] = useState("");
  const [forceTime, setForceTime] = useState("");
  const [showForce, setShowForce] = useState(false);
  const id = fixture.id;

  async function handleForce() {
    if (!forceDate || !forceTime) return;
    setBusy(id);
    try {
      const date = toMysqlDateTime(combineDateTime(forceDate, forceTime));
      await forceSchedule({ fixture, fixtureType: fixture._fixtureType, date, adminNote: "Admin override after deadline." });
      onResolved();
    } finally { setBusy(null); }
  }

  async function handleForfeit(side) {
    if (!(await swalConfirm(`Declare ${side === "home" ? fixture.home_club_name : fixture.away_club_name} as forfeiting?`))) return;
    setBusy(id);
    try {
      const forfeitingClubId = side === "home" ? fixture.home_club_id : fixture.away_club_id;
      await declareForfeit({ fixture, fixtureType: fixture._fixtureType, forfeitingClubId });
      onResolved();
    } finally { setBusy(null); }
  }

  async function handleFlag() {
    setBusy(id);
    try {
      await flagForAdminReview(fixture, fixture._fixtureType);
      onResolved();
    } finally { setBusy(null); }
  }

  const isBusy = busy === id;
  const context = fixture._fixtureType === "regional_league"
    ? `${fixture.league_name} · Matchday ${fixture.matchday}`
    : `${fixture.competition_name}`;

  return (
    <div className="border border-destructive/20 rounded p-3 space-y-2 bg-destructive/5">
      <div>
        <p className="text-xs font-bold text-foreground">{fixture.home_club_name} vs {fixture.away_club_name}</p>
        <p className="text-[10px] text-muted-foreground">{context}</p>
      </div>
      {!showForce ? (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setShowForce(true)} disabled={isBusy}
            className="h-6 text-[10px] bg-primary text-primary-foreground px-2">Force Schedule</Button>
          <Button size="sm" variant="outline" onClick={() => handleForfeit("home")} disabled={isBusy}
            className="h-6 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10 px-2">
            {fixture.home_club_name} forfeit</Button>
          <Button size="sm" variant="outline" onClick={() => handleForfeit("away")} disabled={isBusy}
            className="h-6 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10 px-2">
            {fixture.away_club_name} forfeit</Button>
          <Button size="sm" variant="outline" onClick={handleFlag} disabled={isBusy}
            className="h-6 text-[10px] border-border text-muted-foreground px-2">Flag review</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={forceDate} onChange={e => setForceDate(e.target.value)}
            className="h-6 text-[10px] bg-secondary border-border w-32 px-2" />
          <Input type="time" value={forceTime} onChange={e => setForceTime(e.target.value)}
            className="h-6 text-[10px] bg-secondary border-border w-24 px-2" />
          <Button size="sm" onClick={handleForce} disabled={isBusy || !forceDate || !forceTime}
            className="h-6 text-[10px] bg-primary text-primary-foreground px-2">
            {isBusy ? "Saving…" : "Confirm"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForce(false)} disabled={isBusy}
            className="h-6 text-[10px] px-2">Cancel</Button>
        </div>
      )}
    </div>
  );
}
