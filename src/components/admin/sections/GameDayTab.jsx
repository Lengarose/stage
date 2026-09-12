import { useMemo, useState } from "react";
import DisputesTab from "@/components/admin/sections/DisputesTab";
import ForfeitsTab from "@/components/admin/sections/ForfeitsTab";
import ExpiredFixtureRow from "@/components/admin/disputes/ExpiredFixtureRow";
import GameDayBannerEditor from "@/components/admin/gameday/GameDayBannerEditor";
import { AdminGamerSection } from "@/components/admin/AdminGamerUI";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarClock, Flag, Gavel, Image, ListChecks, Settings2 } from "lucide-react";

const VIEWS = [
  { id: "needsAction", label: "Needs Action", icon: ListChecks },
  { id: "disputes", label: "Disputes", icon: Gavel },
  { id: "forfeits", label: "Forfeits", icon: Flag },
  { id: "scheduling", label: "Scheduling", icon: CalendarClock },
  { id: "banner", label: "Banner", icon: Image },
];

function ActionCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div
      className={cn(
        "border bg-black/20 p-4",
        tone === "danger" && "border-rose-400/25 shadow-[inset_0_0_28px_rgba(244,63,94,0.08)]",
        tone === "warning" && "border-amber-400/25 shadow-[inset_0_0_28px_rgba(245,158,11,0.08)]",
        tone === "info" && "border-cyan-400/25 shadow-[inset_0_0_28px_rgba(34,211,238,0.08)]",
        tone === "neutral" && "border-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">{label}</p>
          <p className="mt-2 font-heading text-3xl font-black uppercase text-white">{value}</p>
          <p className="mt-1 text-xs text-white/45">{sub}</p>
        </div>
        <Icon className="h-5 w-5 text-white/45" />
      </div>
    </div>
  );
}

function EmptyGameDayState({ icon: Icon, title, text }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-white/25" />
      <p className="mt-3 font-heading text-sm font-black uppercase tracking-[0.18em] text-white/65">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-white/40">{text}</p>
    </div>
  );
}

export default function GameDayTab({
  disputes = [],
  forfeits = [],
  expiredFixtures = [],
  setResolveDialog,
  setSelectedWinner,
  resolveForfeit,
  loadAll,
  schedulingAdminBusy,
  setSchedulingAdminBusy,
}) {
  const [view, setView] = useState("needsAction");

  const actionCount = disputes.length + forfeits.length + expiredFixtures.length;
  const queue = useMemo(() => [
    ...disputes.map(match => ({
      id: `dispute-${match.id}`,
      type: "Dispute",
      tone: "danger",
      title: `${match.home_club_name || match.home_player_name || "Home"} vs ${match.away_club_name || match.away_player_name || "Away"}`,
      detail: "Result conflict needs admin resolution.",
      onOpen: () => setView("disputes"),
    })),
    ...forfeits.map(match => ({
      id: `forfeit-${match.id}`,
      type: "Forfeit",
      tone: "warning",
      title: `${match.home_club_name || "Home"} vs ${match.away_club_name || "Away"}`,
      detail: "Forfeit claim waiting for approve or reject.",
      onOpen: () => setView("forfeits"),
    })),
    ...expiredFixtures.map(fixture => ({
      id: `expired-${fixture.id}`,
      type: "Scheduling",
      tone: "info",
      title: `${fixture.home_club_name || "Home"} vs ${fixture.away_club_name || "Away"}`,
      detail: fixture._fixtureType === "regional_league"
        ? `${fixture.league_name || "Regional League"} · Matchday ${fixture.matchday || "-"}`
        : fixture.competition_name || "GOST / Tournament fixture",
      onOpen: () => setView("scheduling"),
    })),
  ], [disputes, expiredFixtures, forfeits]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <ActionCard label="Needs Action" value={actionCount} sub="Open GameDay admin items" icon={ListChecks} tone={actionCount ? "danger" : "neutral"} />
        <ActionCard label="Disputes" value={disputes.length} sub="Result conflicts" icon={Gavel} tone="danger" />
        <ActionCard label="Forfeits" value={forfeits.length} sub="Pending claims" icon={Flag} tone="warning" />
        <ActionCard label="Scheduling" value={expiredFixtures.length} sub="Expired official fixtures" icon={CalendarClock} tone="info" />
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors",
                view === tab.id
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-200"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/75"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {view === "needsAction" && (
        <AdminGamerSection
          title="GameDay Command Queue"
          subtitle="Everything that blocks match completion now lives in one place."
          icon={Settings2}
        >
          {queue.length === 0 ? (
            <EmptyGameDayState icon={ListChecks} title="All Clear" text="No disputes, forfeits or expired fixtures need admin action right now." />
          ) : (
            <div className="space-y-2">
              {queue.map(item => (
                <div key={item.id} className="flex flex-col gap-3 border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]",
                          item.tone === "danger" && "border-rose-400/35 bg-rose-400/10 text-rose-300",
                          item.tone === "warning" && "border-amber-400/35 bg-amber-400/10 text-amber-300",
                          item.tone === "info" && "border-cyan-400/35 bg-cyan-400/10 text-cyan-300"
                        )}
                      >
                        {item.type}
                      </span>
                      <p className="truncate font-bold text-white">{item.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-white/40">{item.detail}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={item.onOpen} className="shrink-0 border-white/15 text-white/70 hover:bg-white/10">
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AdminGamerSection>
      )}

      {view === "disputes" && (
        <AdminGamerSection title="Result Disputes" subtitle="Review both submissions, proofs and final admin score decisions." icon={Gavel}>
          <DisputesTab disputes={disputes} setResolveDialog={setResolveDialog} setSelectedWinner={setSelectedWinner} showEconomyPanels={false} />
        </AdminGamerSection>
      )}

      {view === "forfeits" && (
        <AdminGamerSection title="Forfeit Claims" subtitle="Approve valid claims or reject stale requests from resolved matches." icon={Flag}>
          <ForfeitsTab forfeits={forfeits} resolveForfeit={resolveForfeit} />
        </AdminGamerSection>
      )}

      {view === "scheduling" && (
        <AdminGamerSection title="Scheduling Control" subtitle="Force-schedule, declare forfeits or flag expired official fixtures for review." icon={CalendarClock}>
          {expiredFixtures.length === 0 ? (
            <EmptyGameDayState icon={CalendarClock} title="Schedule Healthy" text="No expired official fixtures are waiting for admin intervention." />
          ) : (
            <div className="space-y-2">
              {expiredFixtures.map(fixture => (
                <ExpiredFixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  onResolved={loadAll}
                  busy={schedulingAdminBusy}
                  setBusy={setSchedulingAdminBusy}
                />
              ))}
            </div>
          )}
        </AdminGamerSection>
      )}

      {view === "banner" && (
        <AdminGamerSection title="GameDay Banner" subtitle="This controls the hero banner shown to players on the Game Day page." icon={Image}>
          <GameDayBannerEditor />
        </AdminGamerSection>
      )}
    </div>
  );
}
