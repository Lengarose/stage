import { useState } from "react";
import {useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {initialGameDayFeeds,gameDayActionCount,gameDayFeedLabel} from '@/lib/adminGameDayFeeds';
import ActionFeedStatus from '@/components/admin/shared/ActionFeedStatus';
import DisputesTab from "@/components/admin/sections/DisputesTab";
import ForfeitsTab from "@/components/admin/sections/ForfeitsTab";
import ExpiredFixtureRow from "@/components/admin/disputes/ExpiredFixtureRow";
import GameDayBannerEditor from "@/components/admin/gameday/GameDayBannerEditor";
import { AdminGamerSection } from "@/components/admin/AdminGamerUI";
import { Button } from "@/components/ui/button";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { AlertTriangle, CalendarClock, Flag, Gavel, Image, ListChecks, Settings2, Trash2 } from "lucide-react";

const VIEWS = [
  { id: "needsAction", label: "Needs Action", icon: ListChecks },
  { id: "disputes", label: "Disputes", icon: Gavel },
  { id: "forfeits", label: "Forfeits", icon: Flag },
  { id: "scheduling", label: "Scheduling", icon: CalendarClock },
  { id: "stuck", label: "Stuck", icon: AlertTriangle },
  { id: "banner", label: "Banner", icon: Image },
];

function ActionCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div
      className={cn(
        "border bg-black/20 py-3 px-6",
        tone === "danger" && "border-rose-400/25 shadow-[inset_0_0_28px_rgba(244,63,94,0.08)]",
        tone === "warning" && "border-amber-400/25 shadow-[inset_0_0_28px_rgba(245,158,11,0.08)]",
        tone === "info" && "border-cyan-400/25 shadow-[inset_0_0_28px_rgba(34,211,238,0.08)]",
        tone === "neutral" && "border-white/10"
      )}
      style={{ clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">{label}</p>
          <p className="mt-2 font-heading text-3xl font-black uppercase text-white">{value}</p>
          <p className="mt-1 text-xs text-white/45">{sub}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-white/45" />
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
  gameDayFeeds = initialGameDayFeeds(),
  onRefreshFeeds,
  setResolveDialog,
  setSelectedWinner,
  resolveForfeit,
  loadAll,
  schedulingAdminBusy,
  setSchedulingAdminBusy,
}) {
  const [voidingMatch, setVoidingMatch] = useState(null);
  const navigate=useNavigate(),[params,setParams]=useSearchParams();
  const location=useLocation();
  const focusedMatch=params.get('match');
  const requestedView=params.get('view');
  const routeView=location.pathname.replace(/\/$/,'').split('/').at(-1);
  const activeView=focusedMatch?'disputes':VIEWS.some(tab=>tab.id===requestedView)?requestedView:['disputes','forfeits'].includes(routeView)?routeView:'needsAction';
  function setView(value){
    const next=new URLSearchParams(params);next.delete('match');next.set('view',value);setParams(next);
  }
  const reviewSummary=gameDayFeeds.reviews.status==='ready'?gameDayFeeds.reviews:null;
  const forfeits=gameDayFeeds.forfeits.items;
  const staleGameDayMatches=gameDayFeeds.stuck.items;
  const expiredFixtures=gameDayFeeds.scheduling.items;
  const actionCount=gameDayActionCount(gameDayFeeds);
  const queue = [
    ...(reviewSummary?.items || []).map(match => ({
      id: `dispute-${match.id}`,
      type: "Dispute",
      tone: "danger",
      title: `${match.home_club_name || match.home_player_name || "Home"} vs ${match.away_club_name || match.away_player_name || "Away"}`,
      detail: "Result needs Admin review.",
      onOpen: () => navigate(`/admin/disputes?match=${encodeURIComponent(match.id)}`),
    })),
    ...forfeits.map(match => ({
      id: `forfeit-${match.id}`,
      type: "Forfeit",
      tone: "warning",
      title: `${match.home_club_name || "Home"} vs ${match.away_club_name || "Away"}`,
      detail: "Forfeit claim waiting for approve or reject.",
      onOpen: () => setView("forfeits"),
    })),
    ...staleGameDayMatches.map(match => ({
      id: `stuck-${match.id}`,
      type: "Stuck",
      tone: "danger",
      title: `${match.home_club_name || match.home_player_name || "Home"} vs ${match.away_club_name || match.away_player_name || "Away"}`,
      detail: `Still open after result flow: ${match.result_state || match.status || "unknown state"}.`,
      onOpen: () => setView("stuck"),
    })),
    ...expiredFixtures.map(fixture => ({
      id: `expired-${fixture._fixtureType}-${fixture.id}`,
      type: "Scheduling",
      tone: "info",
      title: `${fixture.home_club_name || "Home"} vs ${fixture.away_club_name || "Away"}`,
      detail: fixture._fixtureType === "regional_league"
        ? `${fixture.league_name || "Regional League"} · Matchday ${fixture.matchday || "-"}`
        : fixture.competition_name || "GOST / Tournament fixture",
      onOpen: () => setView("scheduling"),
    })),
  ];

  async function voidStuckMatch(match) {
    if (!match?.id) return;
    const title = `${match.home_club_name || match.home_player_name || "Home"} vs ${match.away_club_name || match.away_player_name || "Away"}`;
    const ok = await swalConfirm(
      `Remove this match from GameDay and club fixtures?\n\n${title}\n\nThis will hide it for users and keep an admin audit log.`,
      { title: "Void stuck match?", confirmText: "Void Match" }
    );
    if (!ok) return;
    setVoidingMatch(match.id);
    try {
      await stageClient.http.post(`/matches/${encodeURIComponent(match.id)}/admin-void`, {
        reason: "Admin removed stale GameDay match from GameDay control",
      });
      await loadAll?.();
    } catch (err) {
      await swalAlert(`Could not void this match: ${err?.data?.error || err?.message || "Unknown error"}`);
    } finally {
      setVoidingMatch(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <ActionCard label="Needs Action" value={actionCount ?? 'Unknown'} sub="Category totals; a match may have multiple actions" icon={ListChecks} tone={actionCount ? "danger" : "neutral"} />
        <ActionCard label="Disputes" value={gameDayFeedLabel(gameDayFeeds.reviews)} sub="Pending result reviews" icon={Gavel} tone="danger" />
        <ActionCard label="Forfeits" value={gameDayFeedLabel(gameDayFeeds.forfeits)} sub="Pending claims" icon={Flag} tone="warning" />
        <ActionCard label="Scheduling" value={gameDayFeedLabel(gameDayFeeds.scheduling)} sub="Expired official fixtures" icon={CalendarClock} tone="info" />
        <ActionCard label="Stuck" value={gameDayFeedLabel(gameDayFeeds.stuck)} sub="Old open matches" icon={AlertTriangle} tone="danger" />
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
                activeView === tab.id
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

      {activeView === "needsAction" && (
        <AdminGamerSection
          title="GameDay Command Queue"
          subtitle="A stored review preview alongside the existing forfeit, scheduling and stuck-match feeds."
          icon={Settings2}
        >
          <div className="mb-4 space-y-2 text-sm">
            <button type="button" className="min-h-11 font-semibold" onClick={onRefreshFeeds}>Refresh action feeds →</button>
            {Object.entries(gameDayFeeds).map(([key,feed])=><ActionFeedStatus key={key} feed={feed} label={key==='reviews'?'Pending result reviews':key==='stuck'?'Stuck matches':key==='scheduling'?'Expired fixtures':'Forfeit claims'} onRetry={onRefreshFeeds}/>)}
            {reviewSummary && <p>{reviewSummary.total} pending reviews · showing {reviewSummary.items.length}. Open Disputes for the complete paginated list. Updated: {new Date(reviewSummary.as_of).toLocaleString()}.</p>}
            {gameDayFeeds.forfeits.status==='ready' && <p>{gameDayFeeds.forfeits.total} pending forfeit claims · showing {forfeits.length}. Open Forfeits for the complete paginated list.</p>}
            {actionCount===null && <p>Some action feeds are not verified. Available items below are a partial overview.</p>}
          </div>
          {queue.length === 0 && actionCount===0 ? (
            <EmptyGameDayState icon={ListChecks} title="No items in this snapshot" text="The review query returned no pending cases and the other loaded feeds contain no action items. Refresh to check for changes." />
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

      {activeView === "disputes" && (
        <AdminGamerSection title="Result Disputes" subtitle="Review both submissions, proofs and final admin score decisions." icon={Gavel}>
          <DisputesTab disputes={disputes} setResolveDialog={setResolveDialog} setSelectedWinner={setSelectedWinner} showEconomyPanels={false} />
        </AdminGamerSection>
      )}

      {activeView === "forfeits" && (
        <AdminGamerSection title="Forfeit Claims" subtitle="Approve valid claims or reject stale requests from resolved matches." icon={Flag}>
          <ForfeitsTab feed={gameDayFeeds.forfeits} resolveForfeit={resolveForfeit} />
        </AdminGamerSection>
      )}

      {activeView === "scheduling" && (
        <AdminGamerSection title="Scheduling Control" subtitle="Force-schedule, declare forfeits or flag expired official fixtures for review." icon={CalendarClock}>
          {gameDayFeeds.scheduling.status!=='ready'?<ActionFeedStatus feed={gameDayFeeds.scheduling} label="Expired fixtures" onRetry={onRefreshFeeds}/>:expiredFixtures.length === 0 ? (
            <EmptyGameDayState icon={CalendarClock} title="Schedule Healthy" text="No expired official fixtures are waiting for admin intervention." />
          ) : (
            <div className="space-y-2">
              {expiredFixtures.map(fixture => (
                <ExpiredFixtureRow
                  key={`${fixture._fixtureType}:${fixture.id}`}
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

      {activeView === "stuck" && (
        <AdminGamerSection title="Stuck GameDay Matches" subtitle="Void matches that stayed open after the result or scheduling flow should have ended." icon={AlertTriangle}>
          {gameDayFeeds.stuck.status!=='ready'?<ActionFeedStatus feed={gameDayFeeds.stuck} label="Stuck matches" onRetry={onRefreshFeeds}/>:staleGameDayMatches.length === 0 ? (
            <EmptyGameDayState icon={AlertTriangle} title="No Stuck Matches" text="No old live, scheduled or confirmation-waiting matches need cleanup right now." />
          ) : (
            <div className="space-y-2">
              {staleGameDayMatches.map(match => (
                <div key={match.id} className="flex flex-col gap-3 border border-rose-400/20 bg-rose-950/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-black uppercase text-white">
                      {match.home_club_name || match.home_player_name || "Home"} vs {match.away_club_name || match.away_player_name || "Away"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
                      <span>Status: {match.status || "-"}</span>
                      <span>Result: {match.result_state || "-"}</span>
                      <span>Updated: {match.updated_date ? new Date(match.updated_date).toLocaleString() : "-"}</span>
                      {match.source_fixture_type && <span>Source: {match.source_fixture_type}</span>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => voidStuckMatch(match)}
                    disabled={voidingMatch === match.id}
                    className="shrink-0 border-rose-400/35 text-rose-200 hover:bg-rose-500/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {voidingMatch === match.id ? "Voiding..." : "Void Match"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AdminGamerSection>
      )}

      {activeView === "banner" && (
        <AdminGamerSection title="GameDay Banner" subtitle="This controls the hero banner shown to players on the GameDay page." icon={Image}>
          <GameDayBannerEditor />
        </AdminGamerSection>
      )}
    </div>
  );
}
