import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Image as ImageIcon,
  Loader2,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  Upload,
} from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { asObject, asObjectArray } from "@/lib/safeData";
import { playerAvatarInitials, resolvePlayerAvatarUrl } from "@/lib/playerAvatar";
import { useTranslation } from "@/hooks/useTranslation";

const LABEL_FALLBACKS = {
  ppCareerRecentMatches: "Recent matches",
  ppCareerOpponent: "Opponent",
  ppCareerMatch: "Match",
  ppCareerClubTitle: "My Club Career",
  ppCareerPlayerTitle: "My Player Career",
  ppCareerGames: "Games",
  ppCareerGoals: "Goals",
  ppCareerAssists: "Assists",
  ppCareerAvgRating: "Avg Rating",
  ppCareerWins: "Wins",
  ppCareerDraws: "Draws",
  ppCareerLosses: "Losses",
  ppCareerMotm: "MOTM",
  ppCareerTrophiesWon: "Trophies Won",
  ppCareerRankingPoints: "Ranking Points",
  ppCareerGoalsFor: "Goals For",
  ppCareerGoalsAgainst: "Goals Against",
  ppCareerUnavailable: "Career data unavailable",
  ppCareerLoading: "Loading career...",
};

const TILE_LABELS = {
  upcoming: "Upcoming",
  club: "My Club Career",
  player: "My Player Career",
  transfers: "Transfer History",
};

function text(t, key, params) {
  const path = `commonPages.${key}`;
  const translated = t(path, params);
  return translated === path ? LABEL_FALLBACKS[key] || key : translated;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRating(value) {
  const rating = number(value);
  return rating > 0 ? rating.toFixed(2).replace(/0$/, "").replace(/\.$/, "") : "-";
}

function formatDate(row) {
  const date = row?.played_at || row?.scheduled_date || row?.updated_date || row?.created_date;
  if (!date || Number.isNaN(new Date(date).getTime())) return "";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatDateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "TBD";
  return new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function scoreFor(row) {
  if (row?.score) {
    const parts = String(row.score).match(/(\d+)\D+(\d+)/);
    return parts ? `${number(parts[1])} - ${number(parts[2])}` : String(row.score).replace(/\s*-\s*/g, " - ");
  }
  if (row?.goals_for != null || row?.goals_against != null) return `${number(row.goals_for)} - ${number(row.goals_against)}`;
  if (row?.home_score != null || row?.away_score != null) return `${number(row.home_score)} - ${number(row.away_score)}`;
  return "-";
}

function scoreParts(row) {
  const formatted = scoreFor(row);
  const parts = String(formatted).match(/(\d+)\s*-\s*(\d+)/);
  return parts ? [String(number(parts[1])), String(number(parts[2]))] : null;
}

function parseTileBackgrounds(value) {
  if (!value) return {};
  if (typeof value === "object") return !Array.isArray(value) ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getTileBackground(player, tileKey) {
  return asObject(parseTileBackgrounds(player?.career_tile_backgrounds)[tileKey]);
}

function backgroundStyle(config) {
  const url = config?.url || "";
  if (!url) return null;
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: config.position || "50% 50%",
    backgroundSize: `${Number(config.zoom) || 120}%`,
  };
}

function CareerBackgroundArt({ player }) {
  const avatarUrl = resolvePlayerAvatarUrl(player);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-red-500/24 blur-3xl" />
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,0.20),transparent_24%),radial-gradient(circle_at_45%_70%,rgba(255,255,255,0.14),transparent_28%)] opacity-45 blur-2xl" />
      {avatarUrl ? (
        <div
          className="absolute -left-8 -bottom-16 h-[310px] w-[300px] bg-no-repeat opacity-[0.2] grayscale sm:h-[390px] sm:w-[390px]"
          style={{
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: `${Number(player?.avatar_zoom) || 150}%`,
            backgroundPosition: player?.avatar_position || "50% 20%",
            WebkitMaskImage: "linear-gradient(90deg, black 0%, black 34%, rgba(0,0,0,0.7) 52%, transparent 82%)",
            maskImage: "linear-gradient(90deg, black 0%, black 34%, rgba(0,0,0,0.7) 52%, transparent 82%)",
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-red-950/50 via-[#26060b]/78 to-black/82" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(circle_at_20%_100%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_48%_100%,rgba(255,255,255,0.12),transparent_30%)] opacity-60 blur-xl" />
    </div>
  );
}

function MatchScore({ row }) {
  const parts = scoreParts(row);
  return (
    <span className="flex shrink-0 items-center justify-center gap-2 text-center font-heading text-sm font-black uppercase tracking-[0.12em] text-[#f5c542]">
      {parts ? (
        <>
          <span>{parts[0]}</span>
          <span className="text-[10px] tracking-[0.18em] text-[#f5c542]/85">vs</span>
          <span>{parts[1]}</span>
        </>
      ) : (
        <span className="text-[10px] tracking-[0.18em]">vs</span>
      )}
    </span>
  );
}

function PlayerMini({ player, align = "left" }) {
  const avatarUrl = resolvePlayerAvatarUrl(player);
  const content = (
    <span className={cn("group flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/25 bg-black/40"
        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={player?.gamertag || "Player"} className="h-full w-full object-cover" style={{ objectPosition: player?.avatar_position || "50% 50%" }} />
        ) : (
          <span className="font-heading text-xs font-black text-[#f5c542]">{playerAvatarInitials(player)}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black uppercase text-white group-hover:text-cyan-200">{player?.gamertag || "Player"}</span>
        <span className="block text-[10px] uppercase tracking-[0.16em] text-white/35">{[player?.position, player?.secondary_position].filter(Boolean).join(" / ") || "Career"}</span>
      </span>
    </span>
  );
  return player?.id ? <Link to={`/players/${player.id}`} className="min-w-0">{content}</Link> : content;
}

function ClubMini({ id, name, tag, logoUrl, align = "left" }) {
  const hasSubtitle = Boolean(tag);
  const content = (
    <span className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-[#f5c542]/30 bg-black/40"
        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={name || "Club"} className="h-full w-full object-cover" />
        ) : (
          <span className="font-heading text-[10px] font-black text-[#f5c542]">{String(tag || name || "?").slice(0, 2).toUpperCase()}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black uppercase text-white">{name || "Club"}</span>
        {hasSubtitle ? (
          <span className="block text-[10px] uppercase tracking-[0.16em] text-white/35">[{tag}]</span>
        ) : null}
      </span>
    </span>
  );
  return id ? <Link to={`/clubs/${id}`} className="min-w-0 hover:text-cyan-200">{content}</Link> : content;
}

function TileMenu({ tileKey, title, canCustomize, canUseBackgrounds, onChangeBackground }) {
  if (!canCustomize) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border border-cyan-300/20 bg-black/35 text-cyan-100/65 transition hover:border-cyan-200/50 hover:text-cyan-50"
          style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
          aria-label={`${title || TILE_LABELS[tileKey]} actions`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-white/10 bg-[#071018] text-white">
        <DropdownMenuItem className="cursor-pointer text-xs font-semibold" onSelect={() => onChangeBackground(tileKey)}>
          {canUseBackgrounds ? <ImageIcon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          Change background
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CareerTile({ tileKey, title, eyebrow, player, canCustomize, canUseBackgrounds, onChangeBackground, children, className }) {
  const bg = backgroundStyle(getTileBackground(player, tileKey));
  return (
    <section
      className={cn("relative min-w-0 overflow-hidden border border-cyan-300/20 bg-[#06111d] shadow-[0_20px_60px_rgba(0,0,0,0.26)]", className)}
      style={{ clipPath: "polygon(2.5% 0, 100% 0, 97.5% 100%, 0 100%)" }}
    >
      {bg ? <div aria-hidden className="absolute inset-0 bg-no-repeat opacity-40" style={bg} /> : null}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan-400/12 via-black/78 to-blue-950/78" />
      <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-cyan-200/45" />
      <div className="relative z-[1] flex items-center justify-between gap-3 border-b border-cyan-300/15 py-3 pl-8 pr-5 sm:pl-10 lg:pl-14 lg:pr-8">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/50">{eyebrow}</p> : null}
          <h3 className="truncate font-heading text-sm font-black uppercase tracking-[0.16em] text-white">{title}</h3>
        </div>
        <TileMenu tileKey={tileKey} title={title} canCustomize={canCustomize} canUseBackgrounds={canUseBackgrounds} onChangeBackground={onChangeBackground} />
      </div>
      <div className="relative z-[1] py-4 pl-6 pr-4 sm:pl-8 lg:pl-10 lg:pr-8">{children}</div>
    </section>
  );
}

function StatGrid({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 border border-white/10 bg-black/18 px-3 py-2">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{stat.label}</p>
          <p className="mt-1 font-heading text-lg font-black leading-none text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function UpcomingTile({ matches, player, club, canCustomize, canUseBackgrounds, onChangeBackground, t }) {
  const rows = asObjectArray(matches);
  return (
    <CareerTile tileKey="upcoming" title={text(t, "homeUpcoming") || "Upcoming"} eyebrow="Next fixtures" player={player} canCustomize={canCustomize} canUseBackgrounds={canUseBackgrounds} onChangeBackground={onChangeBackground}>
      {rows.length ? (
        <div className="max-h-[306px] space-y-2 overflow-y-auto pr-1">
          {rows.map((match) => {
            const isHome = match.home_club_id === club?.id;
            const opponent = {
              id: isHome ? match.away_club_id : match.home_club_id,
              name: isHome ? match.away_club_name : match.home_club_name,
              tag: isHome ? match.away_club_tag : match.home_club_tag,
              logoUrl: isHome ? match.away_club_logo_url : match.home_club_logo_url,
            };
            return (
              <div key={match.id} className="grid gap-3 border border-white/10 bg-white/[0.025] px-3 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <ClubMini id={club?.id} name={club?.name} tag={club?.tag} logoUrl={club?.logo_url} />
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f5c542] sm:justify-center">
                  <Swords className="h-3.5 w-3.5" />
                  <span>{isHome ? "Home" : "Away"}</span>
                </div>
                <div className="sm:justify-self-end">
                  <ClubMini {...opponent} align="right" />
                </div>
                <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-white/45">
                  <span>{match.competition_name || match.tournament_name || text(t, "ppCareerMatch")}</span>
                  <span>{formatDateTime(match.scheduled_date)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4 text-sm text-white/40">
          <CalendarClock className="h-4 w-4 text-cyan-300/60" /> No upcoming fixtures.
        </div>
      )}
    </CareerTile>
  );
}

function HistoryRows({ history, playerCareer = false, t, player, club }) {
  const rows = Array.isArray(history) ? history : [];
  if (rows.length === 0) return <p className="py-4 text-sm text-white/38">No recent matches yet.</p>;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{text(t, "ppCareerRecentMatches")}</p>
      <div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">
        {rows.map((row, index) => {
        const outcome = String(row?.result || "").toUpperCase();
        const fallbackOpponent = text(t, "ppCareerOpponent");
        const opponent = playerCareer
          ? row?.opponent_name || row?.opponent || fallbackOpponent
          : row?.opponent_club_name || row?.opponent_name || row?.opponent || fallbackOpponent;
        const source = row?.source_label || row?.competition_name || row?.competition || text(t, "ppCareerMatch");
        const detail = playerCareer
          ? ""
          : [row?.goals != null ? `${number(row.goals)} goals` : null, row?.assists != null ? `${number(row.assists)} assists` : null, row?.rating != null ? `${formatRating(row.rating)} rating` : null].filter(Boolean).join(" · ");
        const opponentPlayer = {
          id: row?.opponent_id || row?.opponent_player_id,
          gamertag: opponent,
          position: row?.opponent_position,
          secondary_position: row?.opponent_secondary_position,
          avatar_url: row?.opponent_avatar_url,
          avatar_position: row?.opponent_avatar_position,
          avatar_zoom: row?.opponent_avatar_zoom,
        };
        const opponentClub = {
          id: row?.opponent_club_id,
          name: row?.opponent_club_name || row?.opponent || row?.opponent_name || "Club",
          tag: row?.opponent_club_tag,
          logoUrl: row?.opponent_club_logo_url,
        };
        return (
          <div key={row?.match_id || row?.id || `${source}-${index}`} className="grid gap-3 border border-white/10 bg-white/[0.025] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 gap-3">
              <span className={cn("flex h-8 w-10 shrink-0 items-center justify-center border font-heading text-xs font-black", outcome === "W" ? "border-[#f5c542]/45 text-[#f5c542]" : "border-white/12 text-white/45")}>
                {outcome || <Swords className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                  {playerCareer ? (
                    <>
                      <PlayerMini player={player} />
                      <MatchScore row={row} />
                      <PlayerMini player={opponentPlayer} align="right" />
                    </>
                  ) : (
                    <>
                      <ClubMini id={club?.id || row?.club_id} name={club?.name || row?.club_name} tag={club?.tag} logoUrl={club?.logo_url} />
                      <MatchScore row={row} />
                      <ClubMini {...opponentClub} align="right" />
                    </>
                  )}
                </div>
                {detail ? <p className="truncate text-xs font-semibold text-white">{detail}</p> : null}
                <p className="truncate text-[10px] text-white/40">{source}{formatDate(row) ? ` · ${formatDate(row)}` : ""}</p>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function CareerStatsTile({ tileKey, title, stats, history, playerCareer = false, player, club, canCustomize, canUseBackgrounds, onChangeBackground, t }) {
  return (
    <CareerTile tileKey={tileKey} title={title} eyebrow="Career record" player={player} canCustomize={canCustomize} canUseBackgrounds={canUseBackgrounds} onChangeBackground={onChangeBackground}>
      <StatGrid stats={stats} />
      <HistoryRows history={history} playerCareer={playerCareer} t={t} player={player} club={club} />
    </CareerTile>
  );
}

function BackgroundSlider({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
        <span>{label}</span><span>{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#f5c542]"
      />
    </label>
  );
}

export function CareerTileBackgroundDialog({ player, tileKey, open, onOpenChange, canUseBackgrounds, onPlayerChanged }) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(120);
  const [error, setError] = useState("");
  const title = TILE_LABELS[tileKey] || "Career";
  const activeConfig = getTileBackground(player, tileKey);

  useEffect(() => {
    if (!open || !canUseBackgrounds) return;
    let cancelled = false;
    setLoading(true);
    stageClient.entities.PlayerCardBackground
      .filter({}, "sort_order", 100)
      .then((rows) => { if (!cancelled) setBackgrounds(asObjectArray(rows)); })
      .catch(() => { if (!cancelled) setBackgrounds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, canUseBackgrounds]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setX(50);
    setY(50);
    setZoom(120);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save(payload, busyKey) {
    if (!player?.id || !tileKey) return;
    setSaving(busyKey);
    setError("");
    try {
      const updated = await stageClient.http.patch(`/players/${encodeURIComponent(player.id)}/career-tile-background`, {
        ...payload,
        tile_key: tileKey,
      });
      onPlayerChanged?.(updated);
      setFile(null);
      setPreview("");
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not update career tile background.");
    } finally {
      setSaving(null);
    }
  }

  async function uploadCustom() {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setSaving("custom");
    setError("");
    try {
      const uploaded = await stageClient.integrations.Core.UploadFile({ file });
      await save({
        type: "custom",
        image_url: uploaded.file_url,
        position: `${x}% ${y}%`,
        zoom,
      }, "custom");
    } catch (err) {
      setError(err?.message || "Could not upload career tile background.");
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-lg overflow-y-auto border-white/10 bg-[#071018] p-4 text-white sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xs font-black uppercase tracking-[0.18em] text-[#f5c542]">
            <ImageIcon className="h-3.5 w-3.5" /> {title} background
          </DialogTitle>
        </DialogHeader>
        {!canUseBackgrounds ? (
          <div className="rounded-lg border border-[#f5c542]/25 bg-[#f5c542]/10 p-4">
            <div className="mb-3 flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#f5c542]" />
              <div>
                <p className="font-heading text-base font-black uppercase text-white">STAGE Plus feature</p>
                <p className="mt-1 text-sm text-white/60">
                  Custom Career tab backgrounds, personal uploads, and exclusive official designs are included with STAGE Plus.
                </p>
              </div>
            </div>
            <Link to="/store">
              <Button type="button" className="gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]">
                <Sparkles className="h-4 w-4" /> View STAGE Plus
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {error ? <div className="rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
              <div>
                <p className="font-heading text-xs font-black uppercase text-white">{title}</p>
                <p className="text-xs text-white/45">This background applies only to this Career tile.</p>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={Boolean(saving)} onClick={() => save({ type: "default" }, "default")} className="h-8 gap-1.5 border-white/15 bg-black/20 text-xs text-white hover:bg-white/10">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Official Stage+ designs</p>
              {loading ? (
                <div className="flex items-center justify-center rounded-lg border border-white/10 py-8"><Loader2 className="h-5 w-5 animate-spin text-[#f5c542]" /></div>
              ) : backgrounds.length ? (
                <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {backgrounds.map((bg) => {
                    const selected = activeConfig?.type === "official" && activeConfig?.background_id === bg.id;
                    return (
                      <button key={bg.id} type="button" disabled={Boolean(saving)} onClick={() => save({ type: "official", background_id: bg.id }, bg.id)} className={cn("overflow-hidden rounded-md border bg-black/30 text-left transition hover:border-[#f5c542]/50", selected ? "border-[#f5c542]/70" : "border-white/10")}>
                        <div className="aspect-[16/9] bg-black"><img src={bg.image_url} alt={bg.name} className="h-full w-full object-cover" /></div>
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <span className="truncate text-[11px] font-bold text-white">{bg.name}</span>
                          {saving === bg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f5c542]" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-white/40">No official backgrounds are available yet.</div>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Upload your own</p>
              {preview ? (
                <div className="mb-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div className="relative h-[116px] overflow-hidden border border-cyan-300/35 bg-black" style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}>
                    <div aria-hidden className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: `url(${preview})`, backgroundPosition: `${x}% ${y}%`, backgroundSize: `${zoom}%` }} />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan-400/12 via-black/58 to-blue-950/80" />
                    <div className="relative z-[1] flex h-full flex-col justify-between p-3">
                      <p className="font-heading text-sm font-black uppercase text-white">{title}</p>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/50">{player?.gamertag || "Stage+"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <BackgroundSlider label="Zoom" value={zoom} min={100} max={260} onChange={setZoom} />
                    <BackgroundSlider label="Horizontal" value={x} min={0} max={100} onChange={setX} />
                    <BackgroundSlider label="Vertical" value={y} min={0} max={100} onChange={setY} />
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#f5c542]/35 bg-[#f5c542]/10 px-3 py-2 text-xs font-bold text-[#f5c542]">
                  <Upload className="h-4 w-4" />
                  <span className="truncate">{file ? file.name : "Choose image"}</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                </label>
                <Button type="button" size="sm" disabled={!file || Boolean(saving)} onClick={uploadCustom} className="h-10 gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]">
                  {saving === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PlayerCareerSummary({
  career,
  loading,
  player,
  club,
  upcomingMatches = [],
  canCustomize = false,
  canUseCareerTileBackgrounds = false,
  onPlayerChanged,
}) {
  const { t } = useTranslation();
  const [activeTile, setActiveTile] = useState(null);

  const clubCareer = career?.club_career || {};
  const playerCareer = career?.player_career || {};

  if (loading) {
    return (
      <div className="relative overflow-hidden border border-cyan-300/20 bg-[#06111d] p-10 text-center text-sm text-white/40" style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}>
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[#f5c542]" />
        {text(t, "ppCareerLoading")}
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden border border-red-300/25 bg-[#17050a] shadow-[0_26px_80px_rgba(0,0,0,0.35)]" style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}>
        <CareerBackgroundArt player={player} />
        <div className="relative z-[1] min-h-[220px] p-5 sm:min-h-[250px] sm:p-7">
          <div className="min-w-0 space-y-3 sm:max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-100/60">Career Mode</p>
            <h2 className="font-heading text-3xl font-black uppercase leading-none text-white sm:text-5xl">
              {player?.gamertag || "Player"} <span className="text-red-300">Career</span>
            </h2>
            <p className="max-w-xl text-sm text-white/52">StageLeagues career record, fixtures, form, and transfer path in one competitive profile.</p>
          </div>
        </div>
      </div>

      {!career ? (
        <div className="flex items-center justify-center gap-2 py-1 text-xs text-white/35"><Trophy className="h-3.5 w-3.5" />{text(t, "ppCareerUnavailable")}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <UpcomingTile matches={upcomingMatches} player={player} club={club} canCustomize={canCustomize} canUseBackgrounds={canUseCareerTileBackgrounds} onChangeBackground={setActiveTile} t={t} />
        <CareerStatsTile
          tileKey="club"
          title={text(t, "ppCareerClubTitle")}
          history={clubCareer.history}
          t={t}
          player={player}
          club={club}
          canCustomize={canCustomize}
          canUseBackgrounds={canUseCareerTileBackgrounds}
          onChangeBackground={setActiveTile}
          stats={[
            { label: text(t, "ppCareerGames"), value: number(clubCareer.games) },
            { label: text(t, "ppCareerGoals"), value: number(clubCareer.goals) },
            { label: text(t, "ppCareerAssists"), value: number(clubCareer.assists) },
            { label: text(t, "ppCareerAvgRating"), value: formatRating(clubCareer.avg_rating) },
            { label: text(t, "ppCareerWins"), value: number(clubCareer.wins) },
            { label: text(t, "ppCareerDraws"), value: number(clubCareer.draws) },
            { label: text(t, "ppCareerLosses"), value: number(clubCareer.losses) },
            { label: text(t, "ppCareerMotm"), value: number(clubCareer.motm) },
            { label: text(t, "ppCareerTrophiesWon"), value: number(clubCareer.trophies_won) },
            { label: text(t, "ppCareerRankingPoints"), value: number(clubCareer.ranking_points) },
          ]}
        />
        <CareerStatsTile
          tileKey="player"
          title={text(t, "ppCareerPlayerTitle")}
          history={playerCareer.history}
          playerCareer
          t={t}
          player={player}
          canCustomize={canCustomize}
          canUseBackgrounds={canUseCareerTileBackgrounds}
          onChangeBackground={setActiveTile}
          stats={[
            { label: text(t, "ppCareerGames"), value: number(playerCareer.games) },
            { label: text(t, "ppCareerGoalsFor"), value: number(playerCareer.goals_for) },
            { label: text(t, "ppCareerGoalsAgainst"), value: number(playerCareer.goals_against) },
            { label: text(t, "ppCareerWins"), value: number(playerCareer.wins) },
            { label: text(t, "ppCareerDraws"), value: number(playerCareer.draws) },
            { label: text(t, "ppCareerLosses"), value: number(playerCareer.losses) },
            { label: text(t, "ppCareerTrophiesWon"), value: number(playerCareer.trophies_won) },
          ]}
        />
      </div>

      <CareerTileBackgroundDialog
        player={player}
        tileKey={activeTile}
        open={Boolean(activeTile)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setActiveTile(null);
        }}
        canUseBackgrounds={canUseCareerTileBackgrounds}
        onPlayerChanged={onPlayerChanged}
      />
    </>
  );
}
