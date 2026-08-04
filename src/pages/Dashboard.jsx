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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { loadPlayerDashboard, getMatchOpponent } from "@/lib/dashboardData";
import DashboardActivityChart from "@/components/dashboard/DashboardActivityChart";
import DashboardFormStrip from "@/components/dashboard/DashboardFormStrip";
import DashboardFutChart from "@/components/dashboard/DashboardFutChart";
import DashboardQuickGlance from "@/components/dashboard/DashboardQuickGlance";
import EafcClubLinkPanel from "@/components/dashboard/EafcClubLinkPanel";
import FutMatchLogPanel from "@/components/dashboard/FutMatchLogPanel";
import DashboardWidgetGrid from "@/components/dashboard/DashboardWidgetGrid";
import ObjectivesWidget from "@/components/objectives/ObjectivesWidget";
import DashboardGamerStatCard, { DashboardRankRing } from "@/components/dashboard/DashboardGamerStatCard";
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";

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
    return { text: "LIVE", cls: "text-primary bg-primary/10 border-primary/30" };
  }
  return { text: s.replace(/_/g, " ").toUpperCase(), cls: "text-muted-foreground bg-secondary border-border" };
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { user, player, club, playerRank, clubRank, nextMatch, upcomingMatches, activeTournaments, leagueStandings, activity, tenure, futMatches, eafcSummary, glance, form, futActivity } =
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
          <header className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-[#0d1528]/80 to-amber-500/10 p-5 sm:p-6">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 85% 20%, rgba(255,184,0,0.25), transparent 40%), radial-gradient(circle at 10% 80%, rgba(0,229,255,0.2), transparent 35%)" }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <DashboardRankRing rank={playerRank.rank} winRate={winRate} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-400 mb-1">Command Center</p>
                  <h1 className="font-heading font-black uppercase text-white text-3xl sm:text-4xl leading-none truncate">
                    {player?.gamertag || user?.email?.split("@")[0] || t("commonPages.dashboardGuest")}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-white/50">
                    {player?.position ? <span>{player.position}</span> : null}
                    {player?.platform ? <span>· {player.platform}</span> : null}
                    {player?.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-cyan-300">
                        <BadgeCheck className="w-3.5 h-3.5" /> {t("commonPages.dashboardVerified")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/rankings">
                  <Button type="button" variant="outline" size="sm" className="gap-2 font-heading uppercase text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03]">
                    <BarChart3 className="w-3.5 h-3.5" /> {t("commonPages.dashboardViewRankings")}
                  </Button>
                </Link>
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
                <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                  <h2 className="font-heading font-black uppercase text-xl text-foreground">{t("commonPages.dashboardRecentForm")}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <DashboardFormStrip
                      label={t("commonPages.dashboardFutForm")}
                      mode="outcome"
                      items={form?.fut}
                      emptyLabel={t("commonPages.dashboardFutFormEmpty")}
                    />
                  </div>
                </section>
              ),
              next_match: (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <section className="lg:col-span-2 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary mb-1">
                            {t("commonPages.dashboardNextMatch")}
                          </p>
                          <h2 className="font-heading font-black uppercase text-2xl text-foreground leading-tight">
                            {nextMatch ? opponentInfo.opponent : t("commonPages.dashboardNoNextMatch")}
                          </h2>
                          {nextMatch ? (
                            <p className="text-sm text-muted-foreground mt-2">
                              {formatWhen(nextMatch.scheduled_date)}
                              {nextMatch.competition ? ` · ${nextMatch.competition}` : ""}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-2">{t("commonPages.dashboardNoNextMatchHint")}</p>
                          )}
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                          <Zap className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      {nextMatch ? (
                        <div className="rounded-xl border border-border bg-background/60 px-4 py-3 mb-4">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className={cn("font-bold truncate", opponentInfo.isHome && "text-primary")}>{opponentInfo.home}</span>
                            <span className="text-[10px] font-black uppercase text-muted-foreground shrink-0">vs</span>
                            <span className={cn("font-bold truncate text-right", !opponentInfo.isHome && "text-primary")}>{opponentInfo.away}</span>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Link to="/game-day">
                          <Button type="button" className="font-heading uppercase gap-2">
                            <Zap className="w-4 h-4" /> {t("commonPages.dashboardOpenGameDay")}
                          </Button>
                        </Link>
                        <Link to="/schedule">
                          <Button type="button" variant="outline" className="font-heading uppercase gap-2">
                            <Calendar className="w-4 h-4" /> {t("commonPages.dashboardSeeSchedule")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                        {t("commonPages.dashboardMyClub")}
                      </p>
                      {clubRank.rank ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary">#{clubRank.rank}</span>
                      ) : null}
                    </div>
                    {club ? (
                      <>
                        <Link to={`/clubs/${club.id}`} className="flex items-center gap-3 group mb-4">
                          <div className="w-12 h-12 rounded-xl border border-border bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                            {club.logo_url ? (
                              <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Shield className="w-5 h-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-heading font-black uppercase text-lg text-foreground truncate group-hover:text-primary transition-colors">
                              {club.name}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {club.tag ? `[${club.tag}] · ` : ""}{club.region || t("competitionFlow.global")}
                            </p>
                          </div>
                        </Link>
                        {clubRank.row ? (
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatNumber(clubRank.row.ranking_points, 1)} {t("competitionFlow.points")} ·{" "}
                            {clubRank.row.wins || 0}W {clubRank.row.draws || 0}D {clubRank.row.losses || 0}L
                          </p>
                        ) : null}
                        {tenure?.daysAtClub != null ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatDays(tenure.daysAtClub)} {t("commonPages.dashboardAtClub")}</span>
                          </div>
                        ) : null}
                        {tenure?.contractProgress ? (
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span>{t("commonPages.dashboardContractGames")}</span>
                              <span>{tenure.contractProgress.gamesPlayed}/{tenure.contractProgress.maxGames}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${tenure.contractProgress.gamesPercent}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{t("commonPages.dashboardNoClub")}</p>
                        <Link to="/clubs">
                          <Button type="button" variant="outline" size="sm" className="font-heading uppercase w-full">
                            {t("commonPages.dashboardFindClub")}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </section>
                </div>
              ),
              ...(upcomingMatches?.length > 1
                ? {
                    upcoming: (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="font-heading font-black uppercase text-xl text-foreground">{t("commonPages.dashboardUpcoming")}</h2>
                          <Link to="/schedule" className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {t("commonPages.dashboardSeeSchedule")}
                          </Link>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {upcomingMatches.slice(1, 5).map((m, i) => {
                            const opp = getMatchOpponent(m, player, club);
                            return (
                              <Link key={m.id || i} to="/game-day" className="block">
                                <div className="rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 transition-colors">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                                    {m.status === "live" ? "LIVE" : formatWhen(m.scheduled_date)}
                                  </p>
                                  <p className="text-sm font-bold text-foreground truncate">
                                    {opp.home} <span className="text-muted-foreground font-normal">vs</span> {opp.away}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </section>
                    ),
                  }
                : {}),
              activity_objectives: (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <section className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h2 className="font-heading font-black uppercase text-xl text-foreground">
                          {t("commonPages.dashboardActivity")}
                        </h2>
                      </div>
                      {club?.id ? (
                        <Link to="/stats" className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {t("commonPages.dashboardClubStats")}
                        </Link>
                      ) : null}
                    </div>
                    <DashboardActivityChart
                      timeline={activity?.timeline}
                      weekly={activity?.weekly}
                      ratingLabel={t("commonPages.dashboardRatingTrend")}
                      matchesLabel={t("commonPages.dashboardWeeklyMatches")}
                      emptyLabel={t("commonPages.dashboardActivityEmpty")}
                    />
                  </section>
                  <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-5 h-5 text-primary" />
                      <h2 className="font-heading font-black uppercase text-xl text-foreground">
                        {t("commonPages.dashboardObjectives")}
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("commonPages.dashboardObjectivesDesc")}</p>
                    <ObjectivesWidget playerId={player.id} />
                  </section>
                </div>
              ),
              tournaments_league: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-heading font-black uppercase text-xl text-foreground">{t("commonPages.dashboardActiveTournaments")}</h2>
                      <Link to="/tournaments" className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {t("commonPages.homeViewAll")}
                      </Link>
                    </div>
                    {!activeTournaments?.length ? (
                      <p className="text-sm text-muted-foreground">{t("commonPages.dashboardNoCompetitions")}</p>
                    ) : (
                      <div className="space-y-2">
                        {activeTournaments.slice(0, 5).map((tr) => {
                          const badge = tournamentStatusLabel(tr.status);
                          return (
                            <Link key={tr.id} to={`/tournaments/${tr.id}`} className="block">
                              <div className="rounded-xl border border-border px-4 py-3 hover:border-primary/30 transition-colors flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-foreground truncate">{tr.name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                    {String(tr.type || "tournament").replace(/_/g, " ")}
                                  </p>
                                  {tr.progress?.label ? (
                                    <p className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider mt-1",
                                      tr.progress.eliminated ? "text-destructive" : "text-primary"
                                    )}>
                                      {tr.progress.label}
                                      {tr.progress.detail ? ` · ${tr.progress.detail}` : ""}
                                    </p>
                                  ) : null}
                                </div>
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0", badge.cls)}>
                                  {badge.text}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </section>
                  <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-heading font-black uppercase text-xl text-foreground">{t("commonPages.dashboardLeagueStandings")}</h2>
                      <Link to="/competitions" className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {t("commonPages.homeViewAll")}
                      </Link>
                    </div>
                    {!leagueStandings?.length ? (
                      <p className="text-sm text-muted-foreground">{t("commonPages.dashboardNoLeague")}</p>
                    ) : (
                      <div className="space-y-2">
                        {leagueStandings.slice(0, 5).map((row) => (
                          <Link
                            key={row.id || `${row.season_id}-${row.club_id}`}
                            to="/competitions"
                            className="block"
                          >
                            <div className="rounded-xl border border-border px-4 py-3 hover:border-primary/30 transition-colors flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-foreground truncate">{row.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {row.points ?? 0} pts · {row.played ?? 0} {t("commonPages.dashboardPlayed")}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-heading font-black text-2xl text-primary leading-none">
                                  {row.position ? `#${row.position}` : "—"}
                                </p>
                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
                                  {t("commonPages.dashboardPosition")}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              ),
              fut_eafc: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <h2 className="font-heading font-black uppercase text-xl text-foreground">{t("commonPages.dashboardFutActivity")}</h2>
                    <DashboardFutChart
                      weekly={futActivity?.weekly}
                      winsLabel={t("commonPages.dashboardFutWins")}
                      lossesLabel={t("commonPages.dashboardFutLosses")}
                      emptyLabel={t("commonPages.dashboardFutChartEmpty")}
                    />
                  </section>
                  <EafcClubLinkPanel player={player} eafcSummary={eafcSummary} compact />
                </div>
              ),
              fut_log: (
                <FutMatchLogPanel playerId={player.id} initialMatches={futMatches || []} compact />
              ),
            }}
          />
        ) : null}

        <section className="rounded-2xl border border-dashed border-border p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("commonPages.dashboardWelcomeHint")}</p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            {t("commonPages.dashboardGoWelcome")} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
      </div>
    </GamerProfileShell>
  );
}
