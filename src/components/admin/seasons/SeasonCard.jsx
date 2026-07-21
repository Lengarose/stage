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
      if (action === "generate_fixtures") {
        const { generateLeaguePhaseFixtures } = await import("@/lib/competitionUtils");
        const standings = await stageClient.entities.CompetitionStanding.filter({ season_id: s.id }, null, 50).catch(() => []);
        const expectedClubs = Number(s.max_clubs || s.target_clubs || s.max_clubs_per_season || s.num_clubs || 36);
        if (!standings.length) { await swalAlert("No clubs qualified yet. Confirm qualification entries first."); return; }
        if (expectedClubs > 0 && standings.length < expectedClubs) {
          await swalAlert(`Competition is not full yet. Confirm qualification entries first (${standings.length}/${expectedClubs} clubs).`);
          return;
        }
        await generateLeaguePhaseFixtures(s, standings);
        await swalAlert(`League phase fixtures generated! ${standings.length} clubs, 8 matchdays.`);

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
              {busy ? "..." : "Start Competition"}
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
