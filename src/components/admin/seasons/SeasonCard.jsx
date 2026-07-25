import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { getSeasonStatusLabel } from "@/lib/adminI18n";
import { swalAlert } from "@/lib/swal";

export default function SeasonCard({ season: s, onRefresh }) {
  const { t } = useTranslation();
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
        if (!standings.length) { await swalAlert(t("admin.seasons.noClubsQualified")); return; }
        if (expectedClubs > 0 && standings.length < expectedClubs) {
          await swalAlert(t("admin.seasons.notFullYet", { current: standings.length, expected: expectedClubs }));
          return;
        }
        await generateLeaguePhaseFixtures(s, standings);
        await swalAlert(t("admin.seasons.fixturesGenerated", { count: standings.length }));

      } else if (action === "archive") {
        const { archiveCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await stageClient.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        await archiveCompetitionSeason(s, comps[0] || null);
        await swalAlert(t("admin.seasons.seasonArchived", { number: s.season_number }));

      } else if (action === "create_next") {
        const { createNextCompetitionSeason } = await import("@/lib/seasonLifecycle");
        const comps = await stageClient.entities.Competition.filter({ id: s.competition_id }, null, 1).catch(() => []);
        const next = await createNextCompetitionSeason(s, comps[0] || null);
        await swalAlert(t("admin.seasons.nextSeasonCreated", { number: next.season_number }));
      }

      await onRefresh();
    } catch (err) {
      await swalAlert(t("admin.alerts.errorWithMessage", { message: err.message }));
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
          <p className="text-sm font-bold text-foreground">{s.competition_name} — {s.season_label || t("admin.seasons.seasonNumber", { number: s.season_number })}</p>
          <p className="text-[10px] text-muted-foreground">{t("admin.seasons.qualifiedClubs", { current: registeredCount, target: targetClubs })} · {s.platform} · {s.region}</p>
        </div>
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0", statusColor)}>
          {getSeasonStatusLabel(t, s.status)}
        </span>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {["draft", "qualification", "registration"].includes(s.status) && !s.fixtures_generated && !isFilled && (
            <span className="h-7 inline-flex items-center rounded border border-border px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.seasons.awaitingQualifiers", { current: registeredCount, target: targetClubs })}
            </span>
          )}
          {canGenerateLeaguePhase && (
            <Button size="sm" disabled={busy} onClick={() => advance("generate_fixtures")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30 gap-1">
              {busy ? "..." : t("admin.seasons.startCompetition")}
            </Button>
          )}
          {s.status === "completed" && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => advance("archive")}
                className="h-7 text-[10px] rounded border-muted-foreground/30 text-muted-foreground hover:text-foreground">
                {busy ? "..." : t("admin.seasons.archiveSeason")}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
                className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
                {busy ? "..." : t("admin.seasons.createNextSeason")}
              </Button>
            </>
          )}
          {s.status === "archived" && (
            <Button size="sm" disabled={busy} onClick={() => advance("create_next")}
              className="h-7 text-[10px] rounded bg-success/20 text-success border-0 hover:bg-success/30">
              {busy ? "..." : t("admin.seasons.createNextSeason")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
