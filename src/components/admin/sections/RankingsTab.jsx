import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import PositionedImageUploadField from "@/components/admin/shared/PositionedImageUploadField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { RANKINGS_ACCENTS, rankingsPresentation } from "@/lib/rankingsPresentation";
import { Activity, AlertCircle, CheckCircle2, RefreshCw, Save, Shield, Trash2, Trophy, Users } from "lucide-react";

function formatNumber(value) {
  if (value == null || value === "—") return "—";
  return Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export default function RankingsTab() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");
  const [presentationRecord, setPresentationRecord] = useState(null);
  const [presentation, setPresentation] = useState(() => rankingsPresentation());
  const [presentationLoading, setPresentationLoading] = useState(true);
  const [presentationError, setPresentationError] = useState("");
  const [presentationSaveError, setPresentationSaveError] = useState("");
  const [presentationSaving, setPresentationSaving] = useState(false);
  const [presentationSaved, setPresentationSaved] = useState(false);

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await stageClient.http.get("/rankings/summary");
      setSummary(data);
      setLoadError("");
      setMessage("");
    } catch (err) {
      setLoadError(err?.message || t("admin.rankings.loadFailed"));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  async function rebuildRankings() {
    setRebuilding(true);
    setMessage("");
    try {
      const data = await stageClient.http.post("/rankings/rebuild", { reason: "Admin rebuilt official rankings" });
      setSummary(data);
      setMessage(t("admin.rankings.rebuildSuccess"));
    } catch (err) {
      setMessage(err?.message || t("admin.rankings.rebuildFailed"));
    } finally {
      setRebuilding(false);
    }
  }

  useEffect(() => {
    loadSummary();
    let active = true;
    stageClient.entities.RankingsPageConfig.filter({ key: "main" }, "-updated_date", 1)
      .then((rows) => {
        if (!active) return;
        setPresentationRecord(rows?.[0] || null);
        setPresentation(rankingsPresentation(rows?.[0] || {}));
      })
      .catch((err) => {
        if (active) setPresentationError(err?.message || "Could not load the Rankings page presentation.");
      })
      .finally(() => { if (active) setPresentationLoading(false); });
    return () => { active = false; };
  }, []);

  function changePresentation(key, value) {
    setPresentation((current) => ({ ...current, [key]: value }));
    setPresentationSaved(false);
  }

  async function savePresentation() {
    setPresentationSaving(true);
    setPresentationSaveError("");
    setPresentationSaved(false);
    try {
      const payload = {
        ...rankingsPresentation(presentation),
        key: "main",
        reason: "Admin updated Rankings page background and accent",
      };
      const result = presentationRecord?.id
        ? await stageClient.entities.RankingsPageConfig.update(presentationRecord.id, payload)
        : await stageClient.entities.RankingsPageConfig.create(payload);
      setPresentationRecord(result);
      setPresentation(rankingsPresentation(result));
      setPresentationSaved(true);
    } catch (err) {
      setPresentationSaveError(err?.message || "Could not save the Rankings page presentation.");
    } finally {
      setPresentationSaving(false);
    }
  }

  const clubs = summary?.clubs || [];
  const players = summary?.players || [];
  const meta = summary?.meta || {};
  const rankedClubTotal = meta.club_count ?? null;
  const rankedPlayerTotal = meta.ranked_player_count ?? null;
  const sources = Object.entries(meta.source_counts || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
  const isSuccessMessage = message === t("admin.rankings.rebuildSuccess");

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              {t("admin.rankings.engineTitle")}
            </h3>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {t("admin.rankings.engineDesc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadSummary} disabled={loading || rebuilding} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t("admin.rankings.refreshPreview")}
            </Button>
            <Button type="button" size="sm" onClick={rebuildRankings} disabled={rebuilding} className="gap-2 bg-primary text-primary-foreground">
              <Activity className={cn("h-4 w-4", rebuilding && "animate-pulse")} />
              {rebuilding ? t("admin.rankings.rebuilding") : t("admin.rankings.rebuildSave")}
            </Button>
          </div>
        </div>

        {message ? (
          <div className={cn(
            "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
            isSuccessMessage
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          )}>
            {isSuccessMessage ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-none border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Rankings page presentation</h3>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Optional display settings for the public Rankings page. Saving a background or accent does not rebuild or reset rankings.
        </p>
        {presentationLoading ? <p className="mt-4 text-sm" role="status">Loading presentation…</p> : null}
        {presentationError ? <p className="mt-4 text-sm text-destructive" role="alert">{presentationError}</p> : null}
        {!presentationLoading && !presentationError ? (
          <fieldset disabled={presentationSaving} className="mt-4 min-w-0 space-y-4">
            <PositionedImageUploadField
              label="Rankings header background"
              value={presentation.background_url}
              onChange={(value) => changePresentation("background_url", value)}
              position={presentation.background_position}
              onPositionChange={(value) => changePresentation("background_position", value)}
              zoom={presentation.background_zoom}
              onZoomChange={(value) => changePresentation("background_zoom", value)}
              preview="hero"
              title="RANKINGS"
              subtitle="One image, fading behind the header. Leave empty for no image."
            />
            <p className="text-xs text-muted-foreground">One optional image. It fades behind the header and is not a slideshow. Remove it to leave the page without a background.</p>
            {presentation.background_url ? (
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => changePresentation("background_url", "")}>
                <Trash2 className="h-4 w-4" />
                Remove background
              </Button>
            ) : <p className="text-xs text-muted-foreground">No background is saved. The page stays plain until you upload one.</p>}
            <label className="block text-sm">
              Accent colour
              <span className="mt-1 block text-xs text-muted-foreground">Colors the square after RANKINGS and small highlights. It does not change ranking points.</span>
              <select className="mt-2 block h-10 w-full max-w-sm border border-border bg-background px-3" value={presentation.accent} onChange={(event) => changePresentation("accent", event.target.value)}>
                {Object.keys(RANKINGS_ACCENTS).map((key) => <option key={key} value={key}>{key[0].toUpperCase() + key.slice(1)}</option>)}
              </select>
            </label>
            <Button type="button" size="sm" className="gap-2" onClick={savePresentation} disabled={presentationSaving}>
              <Save className="h-4 w-4" />
              {presentationSaving ? "Saving…" : "Save presentation"}
            </Button>
            {presentationSaveError ? <p className="text-sm text-destructive" role="alert">{presentationSaveError}</p> : null}
            {presentationSaved ? <p className="text-sm text-emerald-300" role="status">Saved. Reload Rankings to see the background and accent.</p> : null}
          </fieldset>
        ) : null}
      </section>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <span>{loadError} The preview was not replaced with an empty board.</span>
          <Button type="button" variant="outline" size="sm" onClick={loadSummary}>Retry</Button>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label={t("admin.rankings.officialFixtures")} value={meta.official_fixtures_count || 0} icon={Trophy} />
        <Stat label={t("admin.rankings.playerStatRows")} value={meta.player_stat_rows_count || 0} icon={Activity} />
        <Stat label={t("admin.rankings.rankedClubs")} value={rankedClubTotal ?? "—"} icon={Shield} />
        <Stat label={t("admin.rankings.rankedPlayers")} value={rankedPlayerTotal ?? "—"} icon={Users} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">{t("admin.rankings.sources")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {sources || t("admin.rankings.noFixturesYet")}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <PreviewTable
          title={`${t("admin.rankings.topClubs")} · preview ${meta.displayed_clubs ?? clubs.length} of ${rankedClubTotal ?? "—"}`}
          rows={clubs.slice(0, 10)}
          empty={loadError ? "Preview unavailable." : t("admin.rankings.noClubRankings")}
          renderRow={(club) => (
            <RankingRow
              key={club.id}
              rank={club.global_rank}
              name={club.name}
              meta={`${club.region || t("admin.rankings.global")} · ${club.matches_ranked || 0} GP · ${club.wins || 0}W ${club.draws || 0}D ${club.losses || 0}L`}
              points={club.ranking_points}
            />
          )}
        />
        <PreviewTable
          title={`${t("admin.rankings.topPlayers")} · preview ${meta.displayed_players ?? players.length} of ${rankedPlayerTotal ?? "—"}`}
          rows={players.slice(0, 10)}
          empty={loadError ? "Preview unavailable." : t("admin.rankings.noPlayerRankings")}
          renderRow={(player) => (
            <RankingRow
              key={player.id}
              rank={player.global_rank}
              name={player.gamertag}
              meta={`${player.position || "?"} · ${player.ranking_matches || 0} GP · ${player.ranking_goals || 0}G ${player.ranking_assists || 0}A · ${formatNumber(player.ranking_avg_rating)} AVG`}
              points={player.ranking_points}
            />
          )}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">{t("admin.rankings.positionLeaders")}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(summary?.positions || []).map((group) => {
            const leader = group.players?.[0];
            return (
              <div key={group.group} className="rounded-lg border border-border bg-background/35 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{group.group}</p>
                {leader ? (
                  <div className="mt-2">
                    <p className="font-heading text-lg font-black uppercase text-foreground">{leader.gamertag}</p>
                    <p className="text-xs text-muted-foreground">{leader.position} · {formatNumber(leader.ranking_points)} pts</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t("admin.rankings.noRankedPlayer")}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <div className="font-heading text-2xl font-black text-foreground">{formatNumber(value)}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function PreviewTable({ title, rows, renderRow, empty }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-foreground">{title}</h3>
      <div className="space-y-2">
        {rows.length ? rows.map(renderRow) : <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}

function RankingRow({ rank, name, meta, points }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/30 px-3 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-sm font-black text-primary">{rank}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="font-heading text-lg font-black text-primary">{formatNumber(points)}</div>
    </div>
  );
}
