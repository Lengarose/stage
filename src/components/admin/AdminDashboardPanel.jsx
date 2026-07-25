import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { getAdminSectionLabel } from "@/lib/adminI18n";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Flag,
  Gavel,
  Shield,
  ShieldAlert,
  Trophy,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stageClient } from "@/api/stageClient";
import DashboardGamerStatCard from "@/components/dashboard/DashboardGamerStatCard";
import { AdminGamerSection } from "@/components/admin/AdminGamerUI";
import { AppGuideVisual, UsageChart } from "@/components/admin/sections/AnalyticsTab";

const CHART_LINE_KEYS = ["users", "players", "clubs", "tournaments", "matches", "contracts"];

const QUICK_ACTIONS = [
  { path: "/admin/disputes", section: "disputes", icon: AlertTriangle, accent: "rose" },
  { path: "/admin/forfeits", section: "forfeits", icon: Flag, accent: "gold" },
  { path: "/admin/players", section: "players", icon: UsersRound, accent: "cyan" },
  { path: "/admin/clubs", section: "clubs", icon: Shield, accent: "green" },
  { path: "/admin/tournaments", section: "tournaments", icon: Trophy, accent: "gold" },
  { path: "/admin/leagues", section: "leagues", icon: Gavel, accent: "violet" },
  { path: "/admin/transfers", section: "transfers", icon: ArrowLeftRight, accent: "cyan" },
  { path: "/admin/analytics", section: "analytics", icon: BarChart3, accent: "violet" },
];

export default function AdminDashboardPanel({
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
  const { t } = useTranslation();
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

  if (loading) return null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardGamerStatCard
          label={t("admin.sections.clubs")}
          value={clubs.length}
          sub={t("admin.dashboard.clubsOnPlatform", { count: totals.clubs || clubs.length })}
          accent="violet"
          icon={Shield}
        />
        <DashboardGamerStatCard
          label={t("admin.dashboard.expiredFixtures")}
          value={expiredFixtures.length}
          sub={expiredFixtures.length ? t("admin.dashboard.schedulingBacklog") : t("admin.dashboard.scheduleHealthy")}
          accent="rose"
          icon={Activity}
        />
        <DashboardGamerStatCard
          label={t("admin.dashboard.pendingRegistrations")}
          value={pendingRegs}
          sub={t("admin.dashboard.seasonApplications")}
          accent="gold"
          icon={UsersRound}
        />
        <DashboardGamerStatCard
          label={t("admin.dashboard.matchesPlayed")}
          value={totals.completed_matches ?? "—"}
          sub={totals.active_users_30d ? t("admin.dashboard.activeUsers30d", { count: totals.active_users_30d }) : t("admin.dashboard.platformActivity")}
          accent="cyan"
          icon={BarChart3}
        />
      </div>

      <AdminGamerSection title={t("admin.dashboard.operations")} subtitle={t("admin.dashboard.operationsSubtitle")} icon={ShieldAlert}>
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
                <p className="font-heading font-black uppercase text-sm text-white">{getAdminSectionLabel(t, action.section)}</p>
                {count != null ? <p className="text-[10px] text-white/40 mt-1">{t("admin.dashboard.totalCount", { count })}</p> : null}
              </Link>
            );
          })}
        </div>
      </AdminGamerSection>

      <AdminGamerSection
        title={t("admin.dashboard.platformActivity")}
        subtitle={t("admin.dashboard.platformActivitySubtitle", { days })}
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
              {t("admin.dashboard.days", { count: d })}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onRefresh?.();
              loadAnalytics();
            }}
            disabled={analyticsLoading}
            className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70"
          >
            {t("admin.dashboard.reloadChart")}
          </button>
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
          <p className="text-sm text-white/40 py-8 text-center">{t("admin.dashboard.analyticsUnavailable")}</p>
        )}

        {analytics ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {CHART_LINE_KEYS.map((key) => (
              <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t(`admin.dashboard.chartLines.${key}`)}</p>
                <p className="font-heading font-black text-lg text-white mt-1">
                  {totals[key === "matches" ? "completed_matches" : key === "contracts" ? "contracts" : key] ?? "—"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </AdminGamerSection>

      {analytics ? (
        <AdminGamerSection title={t("admin.dashboard.tournamentHealth")} subtitle={t("admin.dashboard.tournamentHealthSubtitle")} icon={Trophy}>
          <div className="grid grid-cols-3 gap-3">
            <DashboardGamerStatCard label={t("admin.dashboard.healthy")} value={healthCounts.healthy} accent="green" icon={Trophy} />
            <DashboardGamerStatCard label={t("admin.dashboard.atRisk")} value={healthCounts.at_risk} accent="gold" icon={AlertTriangle} />
            <DashboardGamerStatCard label={t("admin.dashboard.stalled")} value={healthCounts.stalled} accent="rose" icon={Flag} />
          </div>
        </AdminGamerSection>
      ) : null}

      <AdminGamerSection
        title={t("admin.dashboard.howStageWorks")}
        subtitle={t("admin.dashboard.howStageWorksSubtitle")}
        icon={BookOpen}
      >
        <div className="rounded-xl border border-white/10 bg-[#060912]/40 p-4 sm:p-5 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50 [&_.border-border]:border-white/10 [&_.bg-card]:bg-white/[0.03] [&_.bg-card\\/40]:bg-white/[0.03] [&_.bg-card\\/50]:bg-white/[0.04] [&_.bg-card\\/70]:bg-white/[0.05] [&_.bg-background]:bg-transparent [&_.bg-background\\/40]:bg-white/[0.02] [&_.bg-background\\/50]:bg-white/[0.03] [&_.bg-background\\/60]:bg-white/[0.04] [&_.border-primary\\/20]:border-cyan-400/20 [&_.from-primary\\/10]:from-cyan-500/10 [&_.text-primary]:text-cyan-400 [&_.bg-primary\\/15]:bg-cyan-500/15 [&_.bg-primary\\/20]:bg-cyan-500/20 [&_.hover\\:text-primary]:hover:text-cyan-300 [&_.hover\\:border-primary\\/40]:hover:border-cyan-400/40">
          <AppGuideVisual />
        </div>
      </AdminGamerSection>

      <div className="flex flex-wrap gap-2 pb-2">
        <Link
          to="/admin/analytics"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" /> {t("admin.dashboard.deepAnalyticsLink")}
        </Link>
      </div>
    </>
  );
}
