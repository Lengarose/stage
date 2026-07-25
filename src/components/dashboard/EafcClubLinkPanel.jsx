import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Search, Shield, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { stageClient } from "@/api/stageClient";
import { searchClub } from "@/lib/eafcClient";

export default function EafcClubLinkPanel({ player, eafcSummary, compact = false, readOnly = false, onPlayerUpdate }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const linked = Boolean(player?.eafc_club_id);
  const clubName = player?.eafc_club_name || eafcSummary?.clubName || t("commonPages.dashboardEafcClub");

  if (readOnly && !linked) return null;

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const clubs = await searchClub(query.trim(), player?.platform);
      setResults(Array.isArray(clubs) ? clubs : []);
      if (!clubs?.length) setError(t("commonPages.dashboardEafcNoResults"));
    } catch (e) {
      setError(e.message || t("commonPages.dashboardEafcSearchError"));
    }
    setSearching(false);
  }

  async function linkClub(club) {
    if (!player?.id) return;
    const id = String(club.clubId || club.id || "");
    const name = club.name || club.clubName || "";
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      await stageClient.entities.Player.update(player.id, {
        eafc_club_id: id,
        eafc_club_name: name,
      });
      onPlayerUpdate?.({ ...player, eafc_club_id: id, eafc_club_name: name });
      setResults([]);
      setQuery("");
    } catch (e) {
      setError(e.message || t("commonPages.dashboardEafcLinkError"));
    }
    setSaving(false);
  }

  async function unlinkClub() {
    if (!player?.id) return;
    setSaving(true);
    setError("");
    try {
      await stageClient.entities.Player.update(player.id, {
        eafc_club_id: null,
        eafc_club_name: null,
      });
      onPlayerUpdate?.({ ...player, eafc_club_id: null, eafc_club_name: null });
    } catch (e) {
      setError(e.message || t("commonPages.dashboardEafcLinkError"));
    }
    setSaving(false);
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card", compact ? "p-4 space-y-3" : "p-5 sm:p-6 space-y-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-heading font-black uppercase text-lg text-foreground leading-tight">
              {t("commonPages.dashboardEafcTitle")}
            </h2>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5">{t("commonPages.dashboardEafcDesc")}</p>
            )}
          </div>
        </div>
        {linked ? (
          <Link
            to={`/eafc?clubId=${player.eafc_club_id}&platform=${encodeURIComponent(player?.platform || "PlayStation")}&name=${encodeURIComponent(clubName)}`}
            className="text-[10px] font-bold uppercase tracking-widest text-primary shrink-0 inline-flex items-center gap-1"
          >
            {t("commonPages.dashboardEafcView")} <ExternalLink className="w-3 h-3" />
          </Link>
        ) : null}
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="font-heading font-black uppercase text-foreground truncate">{clubName}</p>
            {eafcSummary && !eafcSummary.error ? (
              <p className="text-xs text-muted-foreground mt-1">
                {eafcSummary.wins ?? 0}W {eafcSummary.draws ?? 0}D {eafcSummary.losses ?? 0}L
                {eafcSummary.members ? ` · ${eafcSummary.members} ${t("commonPages.dashboardEafcMembers")}` : ""}
              </p>
            ) : eafcSummary?.error ? (
              <p className="text-xs text-muted-foreground mt-1">{t("commonPages.dashboardEafcStatsUnavailable")}</p>
            ) : null}
            {eafcSummary?.memberStats ? (
              <p className="text-xs text-primary mt-2">
                {t("commonPages.dashboardEafcYou")}: {eafcSummary.memberStats.gamesPlayed} {t("commonPages.dashboardEafcGames")} · {eafcSummary.memberStats.goals}G {eafcSummary.memberStats.assists}A
                {eafcSummary.memberStats.rating ? ` · ${Number(eafcSummary.memberStats.rating).toFixed(1)} ${t("commonPages.dashboardAvgRating")}` : ""}
              </p>
            ) : null}
          </div>
          {!compact && !readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={unlinkClub}
              disabled={saving}
              className="gap-2 font-heading uppercase text-xs"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              {t("commonPages.dashboardEafcUnlink")}
            </Button>
          ) : null}
        </div>
      ) : !readOnly ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder={t("commonPages.dashboardEafcSearchPlaceholder")}
              className="text-sm"
            />
            <Button type="button" size="icon" variant="outline" onClick={doSearch} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {results.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {results.slice(0, compact ? 4 : 8).map((club) => {
                const id = club.clubId || club.id;
                const name = club.name || club.clubName || "Club";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => linkClub(club)}
                    disabled={saving}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-sm font-bold text-foreground truncate">{name}</p>
                    {club.currentDivision != null ? (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {t("commonPages.divisionShort", { division: club.currentDivision })}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
