import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEASON_STATUS_LABEL } from "../shared/adminConstants";

export default function SeasonCard({ season: s, onRefresh }) {
  const [busy, setBusy] = useState(false);

  async function advance(action) {
    setBusy(true);
    try {
      const { generateLeaguePhaseFixtures, generatePlayoffRound, generateKnockoutR16, generateNextKnockoutRound } = await import("@/lib/competitionUtils");

      if (action === "generate_fixtures") {
        const standings = await base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        if (!standings.length) { alert("No clubs registered yet. Confirm qualification entries first."); return; }
        await generateLeaguePhaseFixtures(s, standings);
        alert(`League phase fixtures generated! ${standings.length} clubs, 8 matchdays.`);

      } else if (action === "playoff_round") {
        const standings = await base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        await generatePlayoffRound(s, standings);
        alert("Playoff round generated! Positions 9-24 play off. Positions 25-36 eliminated.");

      } else if (action === "knockout_r16") {
        const [standings, fixtures] = await Promise.all([
          base44.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []),
          base44.entities.CompetitionFixture.filter({ season_id: s.id, phase: "playoff_round" }, null, 30).catch(() => []),
        ]);
        await generateKnockoutR16(s, standings, fixtures);
        alert("Round of 16 generated!");

      } else if (["knockout_qf", "knockout_sf", "knockout_final"].includes(action)) {
        const prevPhase = { knockout_qf: "knockout_r16", knockout_sf: "knockout_qf", knockout_final: "knockout_sf" }[action];
        const fixtures = await base44.entities.CompetitionFixture.filter({ season_id: s.id, phase: prevPhase }, null, 30).catch(() => []);
        await generateNextKnockoutRound(s, fixtures, prevPhase);
        alert(`${SEASON_STATUS_LABEL[action]} fixtures generated!`);

      } else if (action === "complete") {
        await base44.entities.CompetitionSeason.update(s.id, { status: "completed" });
        alert("Season marked as completed.");

      } else if (action === "open_registration") {
        await base44.entities.CompetitionSeason.update(s.id, { status: "registration" });
        alert("Registration is now open.");

      } else if (action === "archive") {
        const { archiveCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await base44.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        await archiveCompetitionSeason(s, comps[0] || null);
        alert(`Season ${s.season_number} archived. Standings and winner locked.`);

      } else if (action === "create_next") {
        const { createNextCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await base44.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        const next = await createNextCompetitionSeason(s, comps[0] || null);
        alert(`Season ${next.season_number} created as Draft. Open Registration when ready.`);
      }

      await onRefresh();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const statusColor = {
    draft: "text-muted-foreground border-muted-foreground/30 bg-muted/20",
    registration: "text-primary border-primary/30 bg-primary/5",
    league_phase: "text-success border-success/30 bg-success/5",
    completed: "text-warning border-warning/30 bg-warning/5",
    archived: "text-muted-foreground border-border bg-transparent",
  }[s.status] || "text-warning border-warning/30 bg-warning/5";

  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{s.competition_name} — {s.season_label || `Season ${s.season_number}`}</p>
          <p className="text-[10px] text-muted-foreground">{s.num_clubs || 0} clubs · {s.platform} · {s.region}</p>
        </div>
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusColor)}>
          {SEASON_STATUS_LABEL[s.status] || s.status}
        </span>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {s.status === "draft" && (
            <Button size="sm" disabled={busy} onClick={() => advance("open_registration")}
              className="h-7 text-[10px] rounded bg-primary text-primary-foreground gap-1">
              {busy ? "..." : "Open Registration"}
            </Button>
          )}
          {s.status === "registration" && !s.fixtures_generated && (
            <Button size="sm" disabled={busy} onClick={() => advance("generate_fixtures")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30 gap-1">
              {busy ? "..." : "Generate Fixtures"}
            </Button>
          )}
          {s.status === "league_phase" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("playoff_round")}
              className="h-7 text-[10px] rounded border-warning/40 text-warning hover:bg-warning/10">
              {busy ? "..." : "→ Playoff Round"}
            </Button>
          )}
          {s.status === "playoff_round" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_r16")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Round of 16"}
            </Button>
          )}
          {s.status === "knockout_r16" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_qf")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Quarter-Finals"}
            </Button>
          )}
          {s.status === "knockout_qf" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_sf")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Semi-Finals"}
            </Button>
          )}
          {s.status === "knockout_sf" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("knockout_final")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "→ Final"}
            </Button>
          )}
          {s.status === "knockout_final" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("complete")}
              className="h-7 text-[10px] rounded border-border">
              {busy ? "..." : "Complete Season"}
            </Button>
          )}
          {s.status === "completed" && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("archive")}
                className="h-7 text-[10px] rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground">
                {busy ? "..." : "Archive Season"}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
                className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
                {busy ? "..." : "Create Next Season"}
              </Button>
            </>
          )}
          {s.status === "archived" && (
            <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
              {busy ? "..." : "Create Next Season"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
