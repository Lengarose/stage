import RewardConfigPanel from "@/components/rewards/RewardConfigPanel";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Coins } from "lucide-react";

export default function RewardsTab({
  competitions,
  regionalLeagues,
  rewardSource,
  setRewardSource,
}) {
  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
        <Coins className="w-5 h-5 text-warning" /> Season Rewards
      </h3>
      <p className="text-xs text-muted-foreground">
        Configure STC prize distribution and trophy images per competition or league.
        Rewards are distributed automatically when a season is archived.
      </p>

      {/* Source selector */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Select Competition or League</p>
        <div className="space-y-1.5">
          {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(t => {
            const comp = competitions.find(c => c.slug === t.slug);
            if (!comp) return null;
            const active = rewardSource?.id === comp.id;
            return (
              <button key={t.slug} onClick={() => setRewardSource({ id: comp.id, type: "competition", name: comp.name, trophy_image_url: comp.trophy_image_url || "" })}
                className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )} style={{ borderLeftColor: active ? undefined : t.color, borderLeftWidth: 2 }}>
                {comp.name}
                <span className="block text-[10px] font-normal mt-0.5 opacity-60">Competition · {comp.platform}</span>
              </button>
            );
          })}
          {regionalLeagues.filter(l => l.status !== "archived").slice(0, 12).map(league => {
            const active = rewardSource?.id === league.id;
            return (
              <button key={league.id} onClick={() => setRewardSource({ id: league.id, type: "regional_league", name: league.name, trophy_image_url: league.trophy_image_url || "" })}
                className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}>
                {league.name}
                <span className="block text-[10px] font-normal mt-0.5 opacity-60">
                  Regional League · Div {league.division || 1} · S{league.season_number}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reward config panel for selected source */}
      {rewardSource && (
        <div className="bg-card border border-border rounded p-5 space-y-4">
          <p className="text-sm font-bold text-foreground">{rewardSource.name}</p>
          <RewardConfigPanel
            key={rewardSource.id}
            sourceId={rewardSource.id}
            sourceType={rewardSource.type}
            sourceName={rewardSource.name}
            trophyImageUrl={rewardSource.trophy_image_url}
            onTrophyUrlChange={async (url) => {
              setRewardSource(s => s ? { ...s, trophy_image_url: url } : s);
              const entity = rewardSource.type === "competition"
                ? base44.entities.Competition
                : base44.entities.RegionalLeague;
              await entity?.update(rewardSource.id, { trophy_image_url: url }).catch(() => {});
            }}
          />
        </div>
      )}
    </div>
  );
}
