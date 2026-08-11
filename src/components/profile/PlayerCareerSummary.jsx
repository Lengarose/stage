import { Swords, Trophy } from "lucide-react";
import { GamerSectionCard, GamerStatTile } from "@/components/profile/gamer/GamerProfileUI";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const OUTCOME_STYLE = {
  W: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  L: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  D: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

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

function scoreFor(row) {
  if (row?.score) return row.score;
  if (row?.goals_for != null || row?.goals_against != null) return `${number(row.goals_for)}-${number(row.goals_against)}`;
  if (row?.home_score != null || row?.away_score != null) return `${number(row.home_score)}-${number(row.away_score)}`;
  return "-";
}

function HistoryRows({ history, playerCareer = false, t }) {
  const rows = Array.isArray(history) ? history.slice(0, 5) : [];
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{text(t, "ppCareerRecentMatches")}</p>
      <div className="space-y-2">
        {rows.map((row, index) => {
          const outcome = String(row?.result || "").toUpperCase();
          const opponent = row?.opponent_name || row?.opponent || row?.opponent_club_name || text(t, "ppCareerOpponent");
          const source = row?.source_label || row?.competition_name || row?.competition || text(t, "ppCareerMatch");
          const detail = playerCareer
            ? `vs ${opponent}`
            : [row?.goals != null ? `${number(row.goals)} goals` : null, row?.assists != null ? `${number(row.assists)} assists` : null, row?.rating != null ? `${formatRating(row.rating)} rating` : null].filter(Boolean).join(" · ");
          return (
            <div key={row?.match_id || row?.id || `${source}-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              {OUTCOME_STYLE[outcome] ? (
                <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-black", OUTCOME_STYLE[outcome])}>{outcome}</span>
              ) : <Swords className="h-3.5 w-3.5 shrink-0 text-cyan-400" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{detail || source}</p>
                <p className="truncate text-[10px] text-white/40">{source}{formatDate(row) ? ` · ${formatDate(row)}` : ""}</p>
              </div>
              <span className="shrink-0 text-sm font-black text-white">{scoreFor(row)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CareerSection({ title, stats, history, playerCareer = false, t }) {
  return (
    <GamerSectionCard title={title}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map((stat) => <GamerStatTile key={stat.label} {...stat} />)}
      </div>
      <HistoryRows history={history} playerCareer={playerCareer} t={t} />
    </GamerSectionCard>
  );
}

export default function PlayerCareerSummary({ career, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return <GamerSectionCard><div className="py-10 text-center text-sm text-white/40">{text(t, "ppCareerLoading")}</div></GamerSectionCard>;
  }

  const club = career?.club_career || {};
  const player = career?.player_career || {};

  return (
    <div className="space-y-4">
      <CareerSection
        title={text(t, "ppCareerClubTitle")}
        history={club.history}
        t={t}
        stats={[
          { label: text(t, "ppCareerGames"), value: number(club.games) },
          { label: text(t, "ppCareerGoals"), value: number(club.goals), accent: "gold" },
          { label: text(t, "ppCareerAssists"), value: number(club.assists), accent: "sky" },
          { label: text(t, "ppCareerAvgRating"), value: formatRating(club.avg_rating), accent: "violet" },
          { label: text(t, "ppCareerWins"), value: number(club.wins), accent: "green" },
          { label: text(t, "ppCareerDraws"), value: number(club.draws), accent: "gold" },
          { label: text(t, "ppCareerLosses"), value: number(club.losses), accent: "rose" },
          { label: text(t, "ppCareerMotm"), value: number(club.motm), accent: "gold" },
          { label: text(t, "ppCareerTrophiesWon"), value: number(club.trophies_won), accent: "gold" },
          { label: text(t, "ppCareerRankingPoints"), value: number(club.ranking_points), accent: "violet" },
        ]}
      />
      <CareerSection
        title={text(t, "ppCareerPlayerTitle")}
        history={player.history}
        playerCareer
        t={t}
        stats={[
          { label: text(t, "ppCareerGames"), value: number(player.games) },
          { label: text(t, "ppCareerGoalsFor"), value: number(player.goals_for), accent: "gold" },
          { label: text(t, "ppCareerGoalsAgainst"), value: number(player.goals_against), accent: "rose" },
          { label: text(t, "ppCareerWins"), value: number(player.wins), accent: "green" },
          { label: text(t, "ppCareerDraws"), value: number(player.draws), accent: "gold" },
          { label: text(t, "ppCareerLosses"), value: number(player.losses), accent: "rose" },
          { label: text(t, "ppCareerTrophiesWon"), value: number(player.trophies_won), accent: "gold" },
        ]}
      />
      {!career ? (
        <div className="flex items-center justify-center gap-2 py-1 text-xs text-white/35"><Trophy className="h-3.5 w-3.5" />{text(t, "ppCareerUnavailable")}</div>
      ) : null}
    </div>
  );
}
