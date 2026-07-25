import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Flag,
  RefreshCw,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DashboardGamerStatCard from "@/components/dashboard/DashboardGamerStatCard";
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";

export const ADMIN_SECTION_LABELS = {
  disputes: "Disputes",
  forfeits: "Forfeits",
  players: "Players",
  clubs: "Clubs",
  rankings: "Rankings",
  leagues: "Leagues",
  tournaments: "Tournaments",
  "international-tournaments": "International",
  news: "News",
  "press-conferences": "Press Conferences",
  lifestyles: "Lifestyles",
  transfers: "Transfers",
  recruitment: "Recruitment",
  trophies: "Trophies",
  rewards: "Rewards",
  landing: "Landing Page",
  home: "Home Page",
  analytics: "Analytics",
  store: "Store",
};

export function AdminPulseRing({ openIssues, healthPct, size = 88 }) {
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

export function AdminGamerSection({ title, subtitle, icon: Icon, children, className }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-[#0d1528]/60 to-white/[0.02] p-5 sm:p-6 space-y-4",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-red-400/80" />
            </div>
          ) : null}
          <div>
            {title ? <h2 className="font-heading font-black uppercase text-xl text-white">{title}</h2> : null}
            {subtitle ? <p className="text-sm text-white/45 mt-1">{subtitle}</p> : null}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminGamerStatsRow({ disputes, forfeits, players, tournaments, identityClaims = [] }) {
  const activeTournaments = tournaments.filter(
    (t) => !["archived", "cancelled"].includes(String(t.status || "").toLowerCase())
  );

  return (
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
        label="Tournaments"
        value={activeTournaments.length}
        accent="green"
        icon={Trophy}
      />
    </div>
  );
}

export default function AdminGamerLayout({
  sectionKey = null,
  adminProfile,
  disputes = [],
  forfeits = [],
  players = [],
  clubs = [],
  tournaments = [],
  identityClaims = [],
  loading = false,
  onRefresh,
  children,
}) {
  const sectionTitle = sectionKey ? ADMIN_SECTION_LABELS[sectionKey] || sectionKey : "Admin";
  const openIssues = disputes.length + forfeits.length;
  const backTo = sectionKey ? "/admin" : "/";

  return (
    <GamerProfileShell>
      <div className="admin-gamer-theme px-4 py-6 lg:px-8 lg:py-8">
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
                <AdminPulseRing openIssues={openIssues} healthPct={100 - Math.min(openIssues * 8, 80)} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-red-400 mb-1">Control Center</p>
                  <h1 className="font-heading font-black uppercase text-white text-3xl sm:text-4xl leading-none truncate">
                    {sectionTitle}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-white/50">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="truncate">{adminProfile?.email || "Administrator"}</span>
                    <span className="hidden sm:inline">· STAGE Control Panel</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={backTo}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 font-heading uppercase text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {sectionKey ? "Dashboard" : "Back"}
                  </Button>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 font-heading uppercase text-xs bg-gradient-to-r from-red-500/80 to-amber-500/80 hover:from-red-400 hover:to-amber-400 text-black font-black"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </header>

          <AdminGamerStatsRow
            disputes={disputes}
            forfeits={forfeits}
            players={players}
            tournaments={tournaments}
            identityClaims={identityClaims}
          />

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="admin-gamer-content space-y-6">{children}</div>
          )}
        </div>
      </div>
    </GamerProfileShell>
  );
}
