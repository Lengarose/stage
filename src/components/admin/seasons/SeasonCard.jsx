import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEASON_STATUS_LABEL } from "../shared/adminConstants";
import { swalAlert } from "@/lib/swal";

export default function SeasonCard({ season: s, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const targetClubs = Number(s.max_clubs || s.target_clubs || s.max_clubs_per_season || 36);
  const registeredIds = Array.isArray(s.registered_club_ids) ? s.registered_club_ids : [];
  const registeredCount = Array.isArray(s.registered_club_ids)
    ? registeredIds.length
    : Math.min(Number(s.num_clubs) || 0, targetClubs);
  const isFilled = targetClubs > 0 && registeredCount >= targetClubs;
  const canGenerateLeaguePhase = ["draft", "qualification", "registration"].includes(s.status) && !s.fixtures_generated && isFilled;

  async function advance(action) {
    setBusy(true);
    try {
      const { generateLeaguePhaseFixtures, generatePlayoffRound, generateKnockoutR16, generateNextKnockoutRound } = await import("@/lib/competitionUtils");

      if (action === "generate_fixtures") {
        const standings = await stageClient.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        const expectedClubs = Number(s.max_clubs || s.target_clubs || s.max_clubs_per_season || s.num_clubs || 36);
        if (!standings.length) { await swalAlert("No clubs qualified yet. Confirm qualification entries first."); return; }
        if (expectedClubs > 0 && standings.length < expectedClubs) {
          await swalAlert(`Competition is not full yet. Confirm qualification entries first (${standings.length}/${expectedClubs} clubs).`);
          return;
        }
        await generateLeaguePhaseFixtures(s, standings);
        await swalAlert(`League phase fixtures generated! ${standings.length} clubs, 8 matchdays.`);

      } else if (action === "playoff_round") {
        const standings = await stageClient.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        await generatePlayoffRound(s, standings);
        await swalAlert("Playoff round generated! Positions 9-24 play off. Positions 25-36 eliminated.");

      } else if (action === "knockout_r16") {
        const [standings, fixtures] = await Promise.all([
          stageClient.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []),
          stageClient.entities.CompetitionFixture.filter({ season_id: s.id, phase: "playoff_round" }, null, 30).catch(() => []),
        ]);
        await generateKnockoutR16(s, standings, fixtures);
        await swalAlert("Round of 16 generated!");

      } else if (["knockout_qf", "knockout_sf", "knockout_final"].includes(action)) {
        const prevPhase = { knockout_qf: "knockout_r16", knockout_sf: "knockout_qf", knockout_final: "knockout_sf" }[action];
        const fixtures = await stageClient.entities.CompetitionFixture.filter({ season_id: s.id, phase: prevPhase }, null, 30).catch(() => []);
        await generateNextKnockoutRound(s, fixtures, prevPhase);
        await swalAlert(`${SEASON_STATUS_LABEL[action]} fixtures generated!`);

      } else if (action === "complete") {
        await stageClient.entities.CompetitionSeason.update(s.id, { status: "completed" });
        // Trigger cross-competition qualification (e.g. Elite winner → Supreme)
        try {
          const { processCompetitionSeasonEnd } = await import("@/lib/competitionUtils");
          const [standings, competitions] = await Promise.all([
            stageClient.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []),
            stageClient.entities.Competition.filter({}, null, 10).catch(() => []),
          ]);
          const result = await processCompetitionSeasonEnd(s, standings, competitions);
          if (result?.qualified > 0) {
            await swalAlert(`Season marked as completed.\n\n${result.qualified} cross-competition qualification entr${result.qualified === 1 ? "y" : "ies"} created (check Qualification Entries).`);
          } else {
            await swalAlert("Season marked as completed.");
          }
        } catch {
          await swalAlert("Season marked as completed.");
        }

      } else if (action === "archive") {
        const { archiveCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await stageClient.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        await archiveCompetitionSeason(s, comps[0] || null);
        await swalAlert(`Season ${s.season_number} archived. Standings and winner locked.`);

      } else if (action === "create_next") {
        const { createNextCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await stageClient.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        const next = await createNextCompetitionSeason(s, comps[0] || null);
        await swalAlert(`Season ${next.season_number} created as Draft. Confirm qualified clubs, then generate fixtures once it is full.`);
      }

      await onRefresh();
    } catch (err) {
      await swalAlert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const statusColor = {
    draft: "text-muted-foreground border-muted-foreground/30 bg-muted/20",
    qualification: "text-primary border-primary/30 bg-primary/5",
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
          <p className="text-[10px] text-muted-foreground">{registeredCount}/{targetClubs} qualified clubs · {s.platform} · {s.region}</p>
        </div>
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusColor)}>
          {SEASON_STATUS_LABEL[s.status] || s.status}
        </span>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {["draft", "qualification", "registration"].includes(s.status) && !s.fixtures_generated && !isFilled && (
            <span className="h-7 inline-flex items-center rounded border border-border px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Awaiting qualifiers {registeredCount}/{targetClubs}
            </span>
          )}
          {canGenerateLeaguePhase && (
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
