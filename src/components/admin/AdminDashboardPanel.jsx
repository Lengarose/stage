import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Flag,
  Gavel,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stageClient } from "@/api/stageClient";
import DashboardGamerStatCard from "@/components/dashboard/DashboardGamerStatCard";
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";
import { AppGuideVisual, UsageChart } from "@/components/admin/sections/AnalyticsTab";

const CHART_LINES = [
  { key: "users", label: "Accounts" },
  { key: "players", label: "Players" },
  { key: "clubs", label: "Clubs" },
  { key: "tournaments", label: "Tournaments" },
  { key: "matches", label: "Matches" },
  { key: "contracts", label: "Contracts" },
];

const QUICK_ACTIONS = [
  { path: "/admin/disputes", label: "Disputes", icon: AlertTriangle, accent: "rose" },
  { path: "/admin/forfeits", label: "Forfeits", icon: Flag, accent: "gold" },
  { path: "/admin/players", label: "Players", icon: UsersRound, accent: "cyan" },
  { path: "/admin/clubs", label: "Clubs", icon: Shield, accent: "green" },
  { path: "/admin/tournaments", label: "Tournaments", icon: Trophy, accent: "gold" },
  { path: "/admin/leagues", label: "Leagues", icon: Gavel, accent: "violet" },
  { path: "/admin/transfers", label: "Transfers", icon: ArrowLeftRight, accent: "cyan" },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3, accent: "violet" },
];

function AdminPulseRing({ openIssues, healthPct, size = 88 }) {
  const pct = Math.min(100, Math.max(0, Number(healthPct) || 0));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#adminPulseGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="adminPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-black text-white leading-none">{openIssues}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-white/40 mt-0.5">Open</span>
      </div>
    </div>
  );
}

function GamerSection({ title, subtitle, icon: Icon, children, className }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-[#0d1528]/60 to-white/[0.02] p-5 sm:p-6 space-y-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-red-400/80" />
          </div>
        ) : null}
        <div>
          <h2 className="font-heading font-black uppercase text-xl text-white">{title}</h2>
          {subtitle ? <p className="text-sm text-white/45 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboardPanel({
  adminProfile,
  disputes,
  forfeits,
  players,
  clubs,
  tournaments,
  identityClaims,
  expiredFixtures,
  regApplications,
  loading,
  onRefresh,
}) {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [hiddenKeys, setHiddenKeys] = useState(new Set());

  const activeTournaments = useMemo(
    () => tournaments.filter((t) => !["archived", "cancelled"].includes(String(t.status || "").toLowerCase())),
    [tournaments]
  );

  const pendingRegs = useMemo(
    () => (regApplications || []).filter((r) => r.status === "pending").length,
    [regApplications]
  );

  const openIssues = disputes.length + forfeits.length;
  const totals = analytics?.overview?.totals || {};
  const chartData = analytics?.usage?.series?.combined || [];
  const healthCounts = useMemo(() => {
    const rows = analytics?.tournaments || [];
    return {
      healthy: rows.filter((t) => t.health === "healthy").length,
      at_risk: rows.filter((t) => t.health === "at_risk").length,
      stalled: rows.filter((t) => t.health === "stalled").length,
    };
  }, [analytics]);

  const healthPct = useMemo(() => {
    const total = healthCounts.healthy + healthCounts.at_risk + healthCounts.stalled;
    if (!total) return 100;
    return Math.round((healthCounts.healthy / total) * 100);
  }, [healthCounts]);

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await stageClient.http.get(`/admin-analytics?days=${days}`);
      setAnalytics(res);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  function toggleLine(key) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const actionCounts = {
    "/admin/disputes": disputes.length,
    "/admin/forfeits": forfeits.length,
    "/admin/players": players.length,
    "/admin/clubs": clubs.length,
    "/admin/tournaments": activeTournaments.length,
  };

  return (
    <GamerProfileShell>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="relative overflow-hidden rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-500/10 via-[#0d1528]/80 to-amber-500/10 p-5 sm:p-6">
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 85% 20%, rgba(248,113,113,0.25), transparent 40%), radial-gradient(circle at 10% 80%, rgba(251,191,36,0.18), transparent 35%)",
              }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <AdminPulseRing openIssues={openIssues} healthPct={healthPct} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-red-400 mb-1">Control Center</p>
                  <h1 className="font-heading font-black uppercase text-white text-3xl sm:text-4xl leading-none truncate">
                    Admin
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-white/50">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span className="truncate">{adminProfile?.email || "Administrator"}</span>
                    <span>· STAGE Control Panel</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 font-heading uppercase text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </Button>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 font-heading uppercase text-xs bg-gradient-to-r from-red-500/80 to-amber-500/80 hover:from-red-400 hover:to-amber-400 text-black font-black"
                  onClick={() => {
                    onRefresh?.();
                    loadAnalytics();
                  }}
                  disabled={loading || analyticsLoading}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", (loading || analyticsLoading) && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashboardGamerStatCard
                  label="Disputes"
                  value={disputes.length}
                  sub={disputes.length ? "Needs resolution" : "All clear"}
                  accent="rose"
                  icon={AlertTriangle}
                />
                <DashboardGamerStatCard
                  label="Forfeits"
                  value={forfeits.length}
                  sub={forfeits.length ? "Pending review" : "None pending"}
                  accent="gold"
                  icon={Flag}
                />
                <DashboardGamerStatCard
                  label="Players"
                  value={players.length}
                  sub={identityClaims.length ? `${identityClaims.length} identity claims` : "Registered profiles"}
                  accent="cyan"
                  icon={Users}
                />
                <DashboardGamerStatCard
                  label="Active Tournaments"
                  value={activeTournaments.length}
                  sub={healthCounts.at_risk ? `${healthCounts.at_risk} at risk` : "Live & open"}
                  accent="green"
                  icon={Trophy}
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashboardGamerStatCard
                  label="Clubs"
                  value={clubs.length}
                  sub={`${totals.clubs || clubs.length} on platform`}
                  accent="violet"
                  icon={Shield}
                />
                <DashboardGamerStatCard
                  label="Expired Fixtures"
                  value={expiredFixtures.length}
                  sub={expiredFixtures.length ? "Scheduling backlog" : "Schedule healthy"}
                  accent="rose"
                  icon={Activity}
                />
                <DashboardGamerStatCard
                  label="Pending Registrations"
                  value={pendingRegs}
                  sub="Season applications"
                  accent="gold"
                  icon={UsersRound}
                />
                <DashboardGamerStatCard
                  label="Matches Played"
                  value={totals.completed_matches ?? "—"}
                  sub={totals.active_users_30d ? `${totals.active_users_30d} active users (30d)` : "Platform activity"}
                  accent="cyan"
                  icon={BarChart3}
                />
              </div>

              <GamerSection
                title="Operations"
                subtitle="Jump into the tools you use every day."
                icon={ShieldAlert}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    const count = actionCounts[action.path];
                    return (
                      <Link
                        key={action.path}
                        to={action.path}
                        className={cn(
                          "group relative rounded-xl border bg-gradient-to-br p-4 min-h-[88px] transition-transform hover:scale-[1.02] active:scale-[0.98]",
                          action.accent === "rose" && "from-rose-400/15 to-red-500/5 border-rose-400/25",
                          action.accent === "gold" && "from-amber-400/15 to-yellow-500/5 border-amber-400/25",
                          action.accent === "cyan" && "from-cyan-400/15 to-teal-500/5 border-cyan-400/25",
                          action.accent === "green" && "from-emerald-400/15 to-green-500/5 border-emerald-400/25",
                          action.accent === "violet" && "from-violet-400/15 to-purple-500/5 border-violet-400/25"
                        )}
                      >
                        <Icon className="w-4 h-4 text-white/50 mb-2 group-hover:text-white/80 transition-colors" />
                        <p className="font-heading font-black uppercase text-sm text-white">{action.label}</p>
                        {count != null ? (
                          <p className="text-[10px] text-white/40 mt-1">{count} total</p>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </GamerSection>

              <GamerSection
                title="Platform Activity"
                subtitle={`Daily sign-ups, creations and completed matches over ${days} days.`}
                icon={BarChart3}
              >
                <div className="flex flex-wrap gap-2">
                  {[7, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                        days === d
                          ? "border-red-400/40 bg-red-500/15 text-red-300"
                          : "border-white/10 text-white/40 hover:text-white/70"
                      )}
                    >
                      {d} days
                    </button>
                  ))}
                </div>

                {analyticsLoading && !analytics ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <UsageChart data={chartData} hiddenKeys={hiddenKeys} onToggle={toggleLine} />
                  </div>
                ) : (
                  <p className="text-sm text-white/40 py-8 text-center">Analytics unavailable — deploy the admin-analytics endpoint.</p>
                )}

                {analytics ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                    {CHART_LINES.map((line) => (
                      <div key={line.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{line.label}</p>
                        <p className="font-heading font-black text-lg text-white mt-1">
                          {totals[line.key === "matches" ? "completed_matches" : line.key === "contracts" ? "contracts" : line.key] ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </GamerSection>

              {analytics ? (
                <GamerSection
                  title="Tournament Health"
                  subtitle="Quick read on competition status across the platform."
                  icon={Trophy}
                >
                  <div className="grid grid-cols-3 gap-3">
                    <DashboardGamerStatCard label="Healthy" value={healthCounts.healthy} accent="green" icon={Trophy} />
                    <DashboardGamerStatCard label="At Risk" value={healthCounts.at_risk} accent="gold" icon={AlertTriangle} />
                    <DashboardGamerStatCard label="Stalled" value={healthCounts.stalled} accent="rose" icon={Flag} />
                  </div>
                </GamerSection>
              ) : null}

              <GamerSection
                title="How STAGE Works"
                subtitle="Visual guide to the user journey — from sign-up to rankings."
                icon={BookOpen}
              >
                <div className="rounded-xl border border-white/10 bg-[#060912]/40 p-4 sm:p-5 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50 [&_.border-border]:border-white/10 [&_.bg-card]:bg-white/[0.03] [&_.bg-card\\/40]:bg-white/[0.03] [&_.bg-card\\/50]:bg-white/[0.04] [&_.bg-card\\/70]:bg-white/[0.05] [&_.bg-background]:bg-transparent [&_.bg-background\\/40]:bg-white/[0.02] [&_.bg-background\\/50]:bg-white/[0.03] [&_.bg-background\\/60]:bg-white/[0.04] [&_.border-primary\\/20]:border-cyan-400/20 [&_.from-primary\\/10]:from-cyan-500/10 [&_.text-primary]:text-cyan-400 [&_.bg-primary\\/15]:bg-cyan-500/15 [&_.bg-primary\\/20]:bg-cyan-500/20 [&_.hover\\:text-primary]:hover:text-cyan-300 [&_.hover\\:border-primary\\/40]:hover:border-cyan-400/40">
                  <AppGuideVisual />
                </div>
              </GamerSection>

              <div className="flex flex-wrap gap-2 pb-2">
                <Link
                  to="/admin/analytics"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Deep analytics & tournament tracking
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </GamerProfileShell>
  );
}
