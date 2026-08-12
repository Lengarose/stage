// @ts-nocheck — admin UI uses project shadcn primitives without full prop inference.
import { useCallback, useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Coins, Loader2, Search, Shield, User } from "lucide-react";
import MatchArchiveDetail from "@/components/admin/sections/MatchArchiveDetail";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const PAGE_SIZE = 50;

const STATUSES = ["", "scheduled", "live", "completed", "disputed", "forfeit", "cancelled"];
const PARTICIPANTS = ["", "club", "player"];

function formatScore(match) {
  if (match.home_score == null && match.away_score == null) return "—";
  return `${match.home_score ?? 0} – ${match.away_score ?? 0}`;
}

function sideName(match, side) {
  return match[`${side}_club_name`] || match[`${side}_player_name`] || "—";
}

/** A match carries player ids for 1v1 and club ids for club games. */
function isPlayerVsPlayer(match) {
  return Boolean(match.home_player_id || match.away_player_id) && !match.home_club_id && !match.away_club_id;
}

export default function MatchArchiveTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [participants, setParticipants] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [matches, setMatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMatchId, setOpenMatchId] = useState(null);

  const load = useCallback(async (nextOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await stageClient.http.get("/match-archive", {
        search: search.trim() || undefined,
        status: status || undefined,
        participants: participants || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setMatches(Array.isArray(res?.matches) ? res.matches : []);
      setTotal(Number(res?.total || 0));
      setOffset(nextOffset);
    } catch (err) {
      setError(err?.message || t("admin.matchArchive.loadFailed"));
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, participants, from, to, t]);

  useEffect(() => { void load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-5">
      <div className="rounded border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Archive className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-heading text-xl uppercase text-foreground">{t("admin.matchArchive.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("admin.matchArchive.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded p-4 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("admin.matchArchive.search")}
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void load(0); }}
              placeholder={t("admin.matchArchive.searchPlaceholder")}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("admin.matchArchive.status")}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 rounded-md bg-secondary border border-border px-3 text-sm text-foreground"
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>{s || t("admin.matchArchive.any")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              {t("admin.matchArchive.participants")}
            </label>
            <select
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              className="w-full h-10 rounded-md bg-secondary border border-border px-3 text-sm text-foreground"
            >
              {PARTICIPANTS.map((p) => (
                <option key={p || "all"} value={p}>
                  {p ? t(`admin.matchArchive.participants_${p}`) : t("admin.matchArchive.any")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                {t("admin.matchArchive.from")}
              </label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                {t("admin.matchArchive.to")}
              </label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void load(0)} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t("admin.matchArchive.apply")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("admin.matchArchive.resultCount", { count: total })}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-card border border-border rounded divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{t("admin.matchArchive.empty")}</p>
        ) : (
          matches.map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => setOpenMatchId(match.id)}
              className="w-full p-3 flex items-center gap-3 flex-wrap text-left hover:bg-secondary/40 transition-colors"
            >
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider shrink-0",
                isPlayerVsPlayer(match)
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-primary/10 border-primary/30 text-primary"
              )}>
                {isPlayerVsPlayer(match)
                  ? <><User className="w-3 h-3" /> {t("admin.matchArchive.participants_player")}</>
                  : <><Shield className="w-3 h-3" /> {t("admin.matchArchive.participants_club")}</>}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {sideName(match, "home")} <span className="text-muted-foreground">vs</span> {sideName(match, "away")}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[match.type, match.competition_context, match.scheduled_date].filter(Boolean).join(" · ")}
                </p>
              </div>

              <span className="font-heading text-base text-foreground shrink-0">{formatScore(match)}</span>

              {Number(match.wager_stc || 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning shrink-0">
                  <Coins className="w-3 h-3" /> {Number(match.wager_stc).toLocaleString()}
                </span>
              )}

              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground uppercase tracking-wider shrink-0">
                {match.status || "—"}
              </span>
            </button>
          ))
        )}
      </div>

      <MatchArchiveDetail matchId={openMatchId} onClose={() => setOpenMatchId(null)} />

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={!hasPrev || loading} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>
            {t("admin.matchArchive.prev")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <Button type="button" variant="outline" disabled={!hasNext || loading} onClick={() => void load(offset + PAGE_SIZE)}>
            {t("admin.matchArchive.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
