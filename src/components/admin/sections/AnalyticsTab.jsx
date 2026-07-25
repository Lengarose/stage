import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { stageClient } from "@/api/stageClient";
import AdminStat from "@/components/admin/shared/AdminStat";
import { AdminGamerSection } from "@/components/admin/AdminGamerUI";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2, ChevronRight,
  Clock, Flag, RefreshCw, Shield, Trophy, Users, UserPlus, Swords, Coins,
  Calendar, ArrowRight, Sparkles,
} from "lucide-react";

const CHART_LINE_META = [
  { key: "users", color: "#38bdf8", labelKey: "admin.analytics.chartUsers" },
  { key: "players", color: "#a78bfa", labelKey: "admin.analytics.chartPlayers" },
  { key: "clubs", color: "#34d399", labelKey: "admin.analytics.chartClubs" },
  { key: "tournaments", color: "#fbbf24", labelKey: "admin.analytics.chartTournaments" },
  { key: "matches", color: "#f87171", labelKey: "admin.analytics.chartMatches" },
  { key: "contracts", color: "#fb923c", labelKey: "admin.analytics.chartContracts" },
];

const HEALTH_KEYS = {
  healthy: { labelKey: "admin.analytics.healthy", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  at_risk: { labelKey: "admin.analytics.atRisk", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  stalled: { labelKey: "admin.analytics.stalled", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  completed: { labelKey: "admin.analytics.completed", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { labelKey: "admin.analytics.cancelled", cls: "bg-muted/50 text-muted-foreground border-border" },
};

const GUIDE_STEP_DEFS = [
  { step: 1, icon: UserPlus, titleKey: "admin.analytics.guideStep1Title", bodyKey: "admin.analytics.guideStep1Body", paths: ["/login", "/profile"] },
  { step: 2, icon: Shield, titleKey: "admin.analytics.guideStep2Title", bodyKey: "admin.analytics.guideStep2Body", paths: ["/clubs", "/profile"] },
  { step: 3, icon: Trophy, titleKey: "admin.analytics.guideStep3Title", bodyKey: "admin.analytics.guideStep3Body", paths: ["/tournaments", "/competitions", "/leagues"] },
  { step: 4, icon: Calendar, titleKey: "admin.analytics.guideStep4Title", bodyKey: "admin.analytics.guideStep4Body", paths: ["/schedule", "/inbox"] },
  { step: 5, icon: Coins, titleKey: "admin.analytics.guideStep5Title", bodyKey: "admin.analytics.guideStep5Body", paths: ["/transfer-market", "/store"] },
  { step: 6, icon: BarChart3, titleKey: "admin.analytics.guideStep6Title", bodyKey: "admin.analytics.guideStep6Body", paths: ["/rankings", "/profile"] },
];

function formatDayLabel(day) {
  if (!day) return "";
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function UsageChart({ data, hiddenKeys, onToggle, chartLines }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tickFormatter={formatDayLabel} stroke="#888" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#888" fontSize={11} />
          <Tooltip
            labelFormatter={(v) => formatDayLabel(v)}
            contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {chartLines.filter((line) => !hiddenKeys.has(line.key)).map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {chartLines.map((line) => {
          const off = hiddenKeys.has(line.key);
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => onToggle(line.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-opacity",
                off ? "opacity-40 border-border text-muted-foreground" : "border-transparent text-foreground"
              )}
              style={off ? undefined : { background: `${line.color}22`, color: line.color }}
            >
              {line.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TournamentRow({ tournament }) {
  const { t } = useTranslation();
  const healthMeta = HEALTH_KEYS[tournament.health] || HEALTH_KEYS.healthy;
  const health = { label: t(healthMeta.labelKey), cls: healthMeta.cls };
  const creator = tournament.creator_gamertag || tournament.creator_email || tournament.organizer_email || "—";

  return (
    <details className="group rounded-xl border border-border bg-card/40 open:bg-card/70">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{tournament.name}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", health.cls)}>
              {health.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
              {tournament.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.analytics.createdBy", { date: formatDateTime(tournament.created_date), creator })}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-semibold text-foreground">
            {t("admin.analytics.registered", { registered: tournament.registered, max: tournament.max_teams })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("admin.analytics.progress", { pct: tournament.progress_pct })}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>

      <div className="border-t border-border/60 px-4 py-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label={t("admin.analytics.format")} value={`${tournament.type || "—"} · ${tournament.participant_type || "club"}`} />
          <MiniStat label={t("admin.analytics.platformRegion")} value={`${tournament.platform || "—"} · ${tournament.region || "—"}`} />
          <MiniStat label={t("admin.analytics.fillRate")} value={`${tournament.fill_pct}% (${tournament.registered}/${tournament.max_teams})`} />
          <MiniStat label={t("admin.analytics.round")} value={tournament.total_rounds ? `${tournament.current_round}/${tournament.total_rounds}` : `${tournament.current_round || 0}`} />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <MiniStat label={t("admin.analytics.totalMatches")} value={tournament.match_stats?.total ?? 0} icon={Swords} />
          <MiniStat label={t("admin.analytics.completedMatches")} value={tournament.match_stats?.completed ?? 0} icon={CheckCircle2} />
          <MiniStat label={t("admin.analytics.pendingMatches")} value={tournament.match_stats?.pending ?? 0} icon={Clock} />
          <MiniStat label={t("admin.analytics.disputes")} value={tournament.match_stats?.disputed ?? 0} icon={Flag} />
        </div>

        {tournament.issues?.length > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("admin.analytics.attentionPoints")}
            </p>
            <ul className="list-disc pl-5 text-xs text-amber-100/90 space-y-0.5">
              {tournament.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to={`/tournaments/${tournament.id}`}>{t("admin.analytics.viewTournament")}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
            <Link to="/admin/tournaments">{t("admin.analytics.adminPanel")}</Link>
          </Button>
        </div>
      </div>
    </details>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
        {value}
      </p>
    </div>
  );
}

export function AppGuideVisual() {
  const { t } = useTranslation();
  const guideSteps = useMemo(
    () => GUIDE_STEP_DEFS.map((item) => ({ ...item, title: t(item.titleKey), body: t(item.bodyKey) })),
    [t]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wide text-foreground">{t("admin.analytics.visualGuideTitle")}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {t("admin.analytics.visualGuideSubtitle")}
            </p>
          </div>
        </div>
      </section>

      <div className="relative">
        <div className="absolute left-6 top-8 bottom-8 hidden w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent md:block" />
        <div className="space-y-6">
          {guideSteps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative md:pl-16">
                <div className="absolute left-3 top-5 hidden h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background text-[10px] font-black text-primary md:flex">
                  {item.step}
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary md:hidden">
                          {t("admin.analytics.stepLabel", { n: item.step })}
                        </p>
                        <h4 className="text-base font-bold text-foreground">{item.title}</h4>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                      {item.paths.map((path) => (
                        <Link
                          key={path}
                          to={path}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                        >
                          {path} <ArrowRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                  {index < guideSteps.length - 1 && (
                    <div className="mt-4 flex justify-center md:hidden">
                      <ChevronRight className="h-5 w-5 rotate-90 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <GuideCard
          icon={Sparkles}
          title={t("admin.analytics.valueLoopTitle")}
          body={t("admin.analytics.valueLoopBody")}
        />
        <GuideCard
          icon={AlertTriangle}
          title={t("admin.analytics.adminSignalsTitle")}
          body={t("admin.analytics.adminSignalsBody")}
        />
        <GuideCard
          icon={Activity}
          title={t("admin.analytics.platformHealthTitle")}
          body={t("admin.analytics.platformHealthBody")}
        />
      </section>
    </div>
  );
}

function GuideCard({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export default function AnalyticsTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [panel, setPanel] = useState("stats");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
  const [tournamentFilter, setTournamentFilter] = useState("all");

  const periodOptions = useMemo(
    () => [7, 30, 90].map((value) => ({ value, label: t("admin.dashboard.days", { count: value }) })),
    [t]
  );

  const chartLines = useMemo(
    () => CHART_LINE_META.map((line) => ({ ...line, label: t(line.labelKey) })),
    [t]
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await stageClient.http.get(`/admin-analytics?days=${days}`);
      setData(res);
    } catch (err) {
      setError(err?.message || t("admin.analytics.loadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  const chartData = data?.usage?.series?.combined || [];
  const totals = data?.overview?.totals || {};
  const tournaments = data?.tournaments || [];

  const filteredTournaments = useMemo(() => {
    if (tournamentFilter === "all") return tournaments;
    if (tournamentFilter === "issues") {
      return tournaments.filter((row) => ["at_risk", "stalled"].includes(row.health));
    }
    return tournaments.filter((row) => row.health === tournamentFilter || row.status === tournamentFilter);
  }, [tournaments, tournamentFilter]);

  const healthCounts = useMemo(() => ({
    healthy: tournaments.filter((row) => row.health === "healthy").length,
    at_risk: tournaments.filter((row) => row.health === "at_risk").length,
    stalled: tournaments.filter((row) => row.health === "stalled").length,
    completed: tournaments.filter((row) => row.health === "completed").length,
  }), [tournaments]);

  function toggleLine(key) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const tournamentFilters = useMemo(() => [
    { id: "all", label: t("admin.analytics.all") },
    { id: "issues", label: t("admin.analytics.issues") },
    { id: "in_progress", label: t("admin.analytics.filterLive") },
    { id: "registration", label: t("admin.analytics.filterRegistration") },
    { id: "completed", label: t("admin.analytics.completed") },
  ], [t]);

  return (
    <div className="space-y-6">
      <AdminGamerSection
        title={t("admin.analytics.title")}
        subtitle={t("admin.analytics.subtitle")}
        icon={BarChart3}
      >
        <div className="flex flex-wrap items-center gap-2">
          {periodOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={days === opt.value ? "default" : "outline"}
              className="h-8 text-xs border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-white/15 text-white hover:bg-white/10" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t("admin.analytics.reload")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "stats", label: t("admin.analytics.stats"), icon: Activity },
            { id: "tournaments", label: t("admin.analytics.tournaments"), icon: Trophy },
            { id: "guide", label: t("admin.analytics.guide"), icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanel(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  panel === tab.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </AdminGamerSection>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : null}

      {panel === "stats" && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AdminStat icon={Users} label={t("admin.analytics.accounts")} value={totals.users} color="text-sky-400" accent="border-l-sky-400/50" />
            <AdminStat icon={Users} label={t("admin.analytics.players")} value={totals.players} color="text-violet-400" accent="border-l-violet-400/50" />
            <AdminStat icon={Shield} label={t("admin.analytics.clubs")} value={totals.clubs} color="text-emerald-400" accent="border-l-emerald-400/50" />
            <AdminStat icon={Trophy} label={t("admin.analytics.activeTournaments")} value={totals.tournaments} color="text-amber-400" accent="border-l-amber-400/50" />
            <AdminStat icon={Swords} label={t("admin.analytics.matchesPlayed")} value={totals.completed_matches} color="text-rose-400" accent="border-l-rose-400/50" />
            <AdminStat icon={Activity} label={t("admin.analytics.active30d")} value={totals.active_users_30d} color="text-primary" accent="border-l-primary/50" />
          </section>

          <AdminGamerSection title={t("admin.analytics.dailyActivity")} subtitle={t("admin.analytics.dailyActivitySubtitle", { days })}>
            <UsageChart data={chartData} hiddenKeys={hiddenKeys} onToggle={toggleLine} chartLines={chartLines} />
          </AdminGamerSection>

          {(data.overview?.tournament_status_counts || []).length > 0 && (
            <AdminGamerSection title={t("admin.analytics.tournamentsByStatus")}>
              <div className="flex flex-wrap gap-2">
                {data.overview.tournament_status_counts.map((row) => (
                  <span key={row.status} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold">
                    <span className="text-white/45">{row.status}</span>
                    <span className="ml-2 text-white">{row.count}</span>
                  </span>
                ))}
              </div>
            </AdminGamerSection>
          )}
        </>
      ) : null}

      {panel === "tournaments" && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <MiniStat label={t("admin.analytics.healthy")} value={healthCounts.healthy} icon={CheckCircle2} />
            <MiniStat label={t("admin.analytics.atRisk")} value={healthCounts.at_risk} icon={AlertTriangle} />
            <MiniStat label={t("admin.analytics.stalled")} value={healthCounts.stalled} icon={Flag} />
            <MiniStat label={t("admin.analytics.completed")} value={healthCounts.completed} icon={Trophy} />
          </section>

          <AdminGamerSection title={t("admin.analytics.tournamentTracking")} subtitle={t("admin.analytics.tournamentTrackingSubtitle")}>
            <div className="flex flex-wrap gap-2 mb-4">
              {tournamentFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTournamentFilter(f.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    tournamentFilter === f.id
                      ? "border-red-400/40 bg-red-500/15 text-red-300"
                      : "border-white/10 text-white/40 hover:text-white/70"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredTournaments.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">{t("admin.analytics.noTournamentsFilter")}</p>
              ) : (
                filteredTournaments.map((row) => <TournamentRow key={row.id} tournament={row} />)
              )}
            </div>
          </AdminGamerSection>
        </>
      ) : null}

      {panel === "guide" ? (
        <AdminGamerSection title={t("admin.analytics.guide")} subtitle={t("admin.analytics.visualGuideSubtitle")}>
          <AppGuideVisual />
        </AdminGamerSection>
      ) : null}
    </div>
  );
}
