import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { loadPlayerDashboard, getMatchOpponent } from "@/lib/dashboardData";
import DashboardActivityChart from "@/components/dashboard/DashboardActivityChart";
import DashboardFormStrip from "@/components/dashboard/DashboardFormStrip";
import DashboardQuickGlance from "@/components/dashboard/DashboardQuickGlance";
import DashboardWidgetGrid from "@/components/dashboard/DashboardWidgetGrid";
import ObjectivesWidget from "@/components/objectives/ObjectivesWidget";
import DashboardGamerStatCard, { DashboardRankRing } from "@/components/dashboard/DashboardGamerStatCard";
import { GamerHeroAction, GamerMetaPill, GamerProfileShell, GamerSectionCard } from "@/components/profile/gamer/GamerProfileUI";

const ROW_CLIP = { clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" };

function DashboardRow({ children, className }) {
  return (
    <div
      className={cn(
        "border border-cyan-300/20 bg-gradient-to-r from-[#070b14]/95 via-black/85 to-[#070b14]/90 px-4 py-3 transition-all backdrop-blur-md hover:border-cyan-200/35 hover:bg-black/90",
        className,
      )}
      style={ROW_CLIP}
    >
      {children}
    </div>
  );
}

function formatWhen(dateStr) {
  if (!dateStr) return "TBD";
  const dt = new Date(dateStr);
  return (
    dt.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) +
    " · " +
    dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatNumber(value, digits = 0) {
  return Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(Number(value) || 0);
}

function formatDays(days) {
  if (days == null) return "—";
  if (days < 1) return "<1d";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years}y`;
}

function tournamentStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (["open", "registration"].includes(s)) return { text: "OPEN", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (["league_phase", "in_progress", "group_stage", "knockout", "playoffs"].includes(s)) {
    return { text: "LIVE", cls: "text-cyan-300 bg-cyan-400/10 border-cyan-400/30" };
  }
  return { text: s.replace(/_/g, " ").toUpperCase(), cls: "text-white/45 bg-white/[0.04] border-white/10" };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GamerProfileShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      </GamerProfileShell>
    );
  }

  const { user, player, club, playerRank, clubRank, nextMatch, upcomingMatches, activeTournaments, leagueStandings, activity, tenure, glance, form } =
    data || {};

  const rankedPlayer = playerRank.row;
  const wins = rankedPlayer?.ranking_wins ?? player?.wins_count ?? player?.wins ?? 0;
  const draws = rankedPlayer?.ranking_draws ?? player?.draws_count ?? player?.draws ?? 0;
  const losses = rankedPlayer?.ranking_losses ?? player?.losses_count ?? player?.losses ?? 0;
  const matchesPlayed = rankedPlayer?.ranking_matches ?? player?.matches_played ?? 0;
  const rankingPoints = rankedPlayer?.ranking_points ?? player?.ranking_points ?? 0;
  const winRate = rankedPlayer?.ranking_win_rate ?? (matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0);
  const goals = rankedPlayer?.ranking_goals ?? player?.goals ?? 0;
  const avgRating = rankedPlayer?.ranking_avg_rating ?? player?.avg_rating ?? 0;

  const opponentInfo = getMatchOpponent(nextMatch, player, club);

  return (
    <GamerProfileShell>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header
            className="relative overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-[#0d1528]/80 to-amber-500/10 p-5 sm:p-6"
            style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 85% 20%, rgba(255,184,0,0.25), transparent 40%), radial-gradient(circle at 10% 80%, rgba(0,229,255,0.2), transparent 35%)" }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <DashboardRankRing rank={playerRank.rank} winRate={winRate} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-400 mb-1">Command Center</p>
                  <h1 className="font-heading font-black uppercase text-white text-3xl sm:text-4xl leading-none truncate">
                    {player?.gamertag || user?.email?.split("@")[0] || t("commonPages.dashboardGuest")}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {player?.position ? <GamerMetaPill>{player.position}</GamerMetaPill> : null}
                    {player?.platform ? <GamerMetaPill>{player.platform}</GamerMetaPill> : null}
                    {player?.is_verified ? (
                      <GamerMetaPill className="text-cyan-300 border-cyan-400/30">
                        <BadgeCheck className="w-3.5 h-3.5" /> {t("commonPages.dashboardVerified")}
                      </GamerMetaPill>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <GamerHeroAction as={Link} to="/rankings">
                  <BarChart3 className="w-3.5 h-3.5" /> {t("commonPages.dashboardViewRankings")}
                </GamerHeroAction>
              </div>
            </div>
          </header>

        {player?.id ? (
          <DashboardWidgetGrid
            widgets={{
              glance: <DashboardQuickGlance glance={glance} />,
              stats: (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardGlobalRank")}
                      value={playerRank.rank ? `#${playerRank.rank}` : "—"}
                      sub={rankingPoints ? `${formatNumber(rankingPoints, 1)} ${t("competitionFlow.points")}` : null}
                      accent="gold"
                      icon={Trophy}
                    />
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardRecord")}
                      value={`${wins}W ${draws}D ${losses}L`}
                      sub={`${formatNumber(winRate, 1)}% ${t("commonPages.dashboardWinRate")}`}
                      accent="green"
                      icon={Target}
                    />
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardMatchesThisMonth")}
                      value={formatNumber(activity?.matchesThisMonth ?? 0)}
                      sub={`${formatNumber(activity?.matchesThisWeek ?? 0)} ${t("commonPages.dashboardThisWeek")}`}
                      accent="cyan"
                      icon={Calendar}
                    />
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardMemberSince")}
                      value={formatDays(tenure?.daysOnPlatform)}
                      sub={tenure?.daysAtClub != null ? `${formatDays(tenure.daysAtClub)} ${t("commonPages.dashboardAtClub")}` : t("commonPages.dashboardRankedOnly")}
                      accent="violet"
                      icon={Clock}
                    />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardMatchesPlayed")}
                      value={formatNumber(matchesPlayed)}
                      sub={`${formatNumber(goals)} ${t("commonPages.dashboardGoals")}`}
                      accent="cyan"
                      icon={BarChart3}
                    />
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardAvgRating")}
                      value={formatNumber(avgRating, 1)}
                      sub={activity?.totalRecorded ? `${activity.totalRecorded} ${t("commonPages.dashboardTrackedMatches")}` : t("commonPages.dashboardRankedOnly")}
                      accent="gold"
                      icon={TrendingUp}
                    />
                    {tenure?.contractLabel ? (
                      <DashboardGamerStatCard
                        label={t("commonPages.dashboardContract")}
                        value={tenure.contractLabel}
                        sub={
                          tenure.contractProgress
                            ? `${tenure.contractProgress.gamesLeft} ${t("commonPages.dashboardGamesLeft")} · ${tenure.contractProgress.daysLeft}d`
                            : null
                        }
                        accent="green"
                        icon={Shield}
                      />
                    ) : (
                      <DashboardGamerStatCard
                        label={t("commonPages.dashboardContract")}
                        value="—"
                        sub={t("commonPages.dashboardNoContract")}
                        accent="rose"
                        icon={Shield}
                      />
                    )}
                    <DashboardGamerStatCard
                      label={t("commonPages.dashboardActivityLevel")}
                      value={
                        (activity?.matchesThisMonth ?? 0) >= 8
                          ? t("commonPages.dashboardActivityHigh")
                          : (activity?.matchesThisMonth ?? 0) >= 3
                            ? t("commonPages.dashboardActivityMedium")
                            : t("commonPages.dashboardActivityLow")
                      }
                      sub={`${formatNumber(activity?.matchesThisMonth ?? 0)} ${t("commonPages.dashboardLast30Days")}`}
                      accent="violet"
                      icon={Zap}
                    />
                  </div>
                </>
              ),
              form: (
                <GamerSectionCard title={t("commonPages.dashboardRecentForm")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DashboardFormStrip
                      label={t("commonPages.dashboardStageForm")}
                      mode="outcome"
                      items={form?.stage}
                      emptyLabel={t("commonPages.dashboardStageFormEmpty")}
                    />
                    <DashboardFormStrip
                      label={t("commonPages.dashboardRatingForm")}
                      mode="rating"
                      items={form?.rating}
                      emptyLabel={t("commonPages.dashboardRatingFormEmpty")}
                    />
                  </div>
                </GamerSectionCard>
              ),
              next_match: (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <GamerSectionCard
                    className="lg:col-span-2 border-cyan-300/30 bg-gradient-to-br from-cyan-950/55 via-[#070b14]/90 to-black/92"
                    title={t("commonPages.dashboardNextMatch")}
                    action={(
                      <div className="w-10 h-10 border border-cyan-300/25 bg-cyan-300/10 flex items-center justify-center shrink-0" style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}>
                        <Zap className="w-5 h-5 text-cyan-300" />
                      </div>
                    )}
                  >
                    <h2 className="font-heading font-black uppercase text-2xl text-white leading-tight mb-2">
                      {nextMatch ? opponentInfo.opponent : t("commonPages.dashboardNoNextMatch")}
                    </h2>
                    {nextMatch ? (
                      <p className="text-sm text-white/50 mb-4">
                        {formatWhen(nextMatch.scheduled_date)}
                        {nextMatch.competition ? ` · ${nextMatch.competition}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-white/50 mb-4">{t("commonPages.dashboardNoNextMatchHint")}</p>
                    )}
                    {nextMatch ? (
                      <DashboardRow className="mb-4">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className={cn("font-bold truncate", opponentInfo.isHome && "text-cyan-300")}>{opponentInfo.home}</span>
                          <span className="text-[10px] font-black uppercase text-white/35 shrink-0">vs</span>
                          <span className={cn("font-bold truncate text-right", !opponentInfo.isHome && "text-cyan-300")}>{opponentInfo.away}</span>
                        </div>
                      </DashboardRow>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <GamerHeroAction as={Link} to="/game-day">
                        <Zap className="w-4 h-4" /> {t("commonPages.dashboardOpenGameDay")}
                      </GamerHeroAction>
                      <GamerHeroAction as={Link} to="/schedule">
                        <Calendar className="w-4 h-4" /> {t("commonPages.dashboardSeeSchedule")}
                      </GamerHeroAction>
                    </div>
                  </GamerSectionCard>
                  <GamerSectionCard title={t("commonPages.dashboardMyClub")}>
                    <div className="flex items-center justify-between gap-3 mb-4 -mt-1">
                      {clubRank.rank ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">#{clubRank.rank}</span>
                      ) : null}
                    </div>
                    {club ? (
                      <>
                        <Link to={`/clubs/${club.id}`} className="flex items-center gap-3 group mb-4">
                          <div className="w-12 h-12 border border-cyan-300/20 bg-black/30 overflow-hidden flex items-center justify-center shrink-0" style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}>
                            {club.logo_url ? (
                              <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Shield className="w-5 h-5 text-white/30" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-heading font-black uppercase text-lg text-white truncate group-hover:text-cyan-300 transition-colors">
                              {club.name}
                            </h3>
                            <p className="text-xs text-white/45 truncate">
                              {club.tag ? `[${club.tag}] · ` : ""}{club.region || t("competitionFlow.global")}
                            </p>
                          </div>
                        </Link>
                        {clubRank.row ? (
                          <p className="text-xs text-white/45 mb-3">
                            {formatNumber(clubRank.row.ranking_points, 1)} {t("competitionFlow.points")} ·{" "}
                            {clubRank.row.wins || 0}W {clubRank.row.draws || 0}D {clubRank.row.losses || 0}L
                          </p>
                        ) : null}
                        {tenure?.daysAtClub != null ? (
                          <div className="flex items-center gap-2 text-xs text-white/45">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatDays(tenure.daysAtClub)} {t("commonPages.dashboardAtClub")}</span>
                          </div>
                        ) : null}
                        {tenure?.contractProgress ? (
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/40">
                              <span>{t("commonPages.dashboardContractGames")}</span>
                              <span>{tenure.contractProgress.gamesPlayed}/{tenure.contractProgress.maxGames}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 transition-all" style={{ width: `${tenure.contractProgress.gamesPercent}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-white/45">{t("commonPages.dashboardNoClub")}</p>
                    )}
                  </GamerSectionCard>
                </div>
              ),
              ...(upcomingMatches?.length > 1
                ? {
                    upcoming: (
                      <GamerSectionCard
                        title={t("commonPages.dashboardUpcoming")}
                        action={(
                          <Link to="/schedule" className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-cyan-200 transition-colors">
                            {t("commonPages.dashboardSeeSchedule")}
                          </Link>
                        )}
                      >
                        <div className="grid gap-2 sm:grid-cols-2 -mt-1">
                          {upcomingMatches.slice(1, 5).map((m, i) => {
                            const opp = getMatchOpponent(m, player, club);
                            return (
                              <Link key={m.id || i} to="/game-day" className="block">
                                <DashboardRow>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-1">
                                    {m.status === "live" ? "LIVE" : formatWhen(m.scheduled_date)}
                                  </p>
                                  <p className="text-sm font-bold text-white truncate">
                                    {opp.home} <span className="text-white/40 font-normal">vs</span> {opp.away}
                                  </p>
                                </DashboardRow>
                              </Link>
                            );
                          })}
                        </div>
                      </GamerSectionCard>
                    ),
                  }
                : {}),
              activity_objectives: (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <GamerSectionCard
                    className="lg:col-span-2"
                    title={t("commonPages.dashboardActivity")}
                    action={club?.id ? (
                      <Link to="/stats" className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-cyan-200 transition-colors">
                        {t("commonPages.dashboardClubStats")}
                      </Link>
                    ) : null}
                  >
                    <DashboardActivityChart
                      timeline={activity?.timeline}
                      weekly={activity?.weekly}
                      ratingLabel={t("commonPages.dashboardRatingTrend")}
                      matchesLabel={t("commonPages.dashboardWeeklyMatches")}
                      emptyLabel={t("commonPages.dashboardActivityEmpty")}
                    />
                  </GamerSectionCard>
                  <GamerSectionCard title={t("commonPages.dashboardObjectives")}>
                    <p className="text-xs text-white/45 mb-3 -mt-1">{t("commonPages.dashboardObjectivesDesc")}</p>
                    <ObjectivesWidget playerId={player.id} />
                  </GamerSectionCard>
                </div>
              ),
              tournaments_league: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GamerSectionCard
                    title={t("commonPages.dashboardActiveTournaments")}
                    action={(
                      <Link to="/tournaments" className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-cyan-200 transition-colors">
                        {t("commonPages.homeViewAll")}
                      </Link>
                    )}
                  >
                    {!activeTournaments?.length ? (
                      <p className="text-sm text-white/45 -mt-1">{t("commonPages.dashboardNoCompetitions")}</p>
                    ) : (
                      <div className="space-y-2 -mt-1">
                        {activeTournaments.slice(0, 5).map((tr) => {
                          const badge = tournamentStatusLabel(tr.status);
                          return (
                            <Link key={tr.id} to={`/tournaments/${tr.id}`} className="block">
                              <DashboardRow className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-white truncate">{tr.name}</p>
                                  <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                                    {String(tr.type || "tournament").replace(/_/g, " ")}
                                  </p>
                                  {tr.progress?.label ? (
                                    <p className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider mt-1",
                                      tr.progress.eliminated ? "text-rose-400" : "text-cyan-300",
                                    )}>
                                      {tr.progress.label}
                                      {tr.progress.detail ? ` · ${tr.progress.detail}` : ""}
                                    </p>
                                  ) : null}
                                </div>
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 border shrink-0", badge.cls)}>
                                  {badge.text}
                                </span>
                              </DashboardRow>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </GamerSectionCard>
                  <GamerSectionCard
                    title={t("commonPages.dashboardLeagueStandings")}
                    action={(
                      <Link to="/competitions" className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-cyan-200 transition-colors">
                        {t("commonPages.homeViewAll")}
                      </Link>
                    )}
                  >
                    {!leagueStandings?.length ? (
                      <p className="text-sm text-white/45 -mt-1">{t("commonPages.dashboardNoLeague")}</p>
                    ) : (
                      <div className="space-y-2 -mt-1">
                        {leagueStandings.slice(0, 5).map((row) => (
                          <Link
                            key={row.id || `${row.season_id}-${row.club_id}`}
                            to="/competitions"
                            className="block"
                          >
                            <DashboardRow className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-white truncate">{row.label}</p>
                                <p className="text-[10px] text-white/40 mt-0.5">
                                  {row.points ?? 0} pts · {row.played ?? 0} {t("commonPages.dashboardPlayed")}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-heading font-black text-2xl text-cyan-300 leading-none">
                                  {row.position ? `#${row.position}` : "—"}
                                </p>
                                <p className="text-[9px] uppercase tracking-wider text-white/40 mt-1">
                                  {t("commonPages.dashboardPosition")}
                                </p>
                              </div>
                            </DashboardRow>
                          </Link>
                        ))}
                      </div>
                    )}
                  </GamerSectionCard>
                </div>
              ),
            }}
          />
        ) : null}

        <section
          className="border border-dashed border-cyan-300/25 bg-gradient-to-r from-[#070b14]/92 via-black/88 to-[#070b14]/90 p-5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
          style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-white/40" />
            <p className="text-sm text-white/45">{t("commonPages.dashboardWelcomeHint")}</p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:text-cyan-200 transition-colors">
            {t("commonPages.dashboardGoWelcome")} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
      </div>
    </GamerProfileShell>
  );
}
