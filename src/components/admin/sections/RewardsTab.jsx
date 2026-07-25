import RewardConfigPanel from "@/components/rewards/RewardConfigPanel";
import { cn } from "@/lib/utils";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";
import { Coins } from "lucide-react";

export default function RewardsTab({
  competitions,
  regionalLeagues,
  rewardSource,
  setRewardSource,
}) {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
        <Coins className="w-5 h-5 text-warning" /> {t("admin.rewards.seasonRewards")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("admin.rewards.description")}
      </p>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t("admin.rewards.selectSource")}</p>
        <div className="space-y-1.5">
          {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map(t => {
            const comp = competitions.find(c => c.slug === t.slug);
            if (!comp) return null;
            const active = rewardSource?.id === comp.id;
            return (
              <button key={t.slug} onClick={() => setRewardSource({ id: comp.id, type: "competition", name: comp.name, slug: comp.slug, tier: comp.tier, trophy_image_url: comp.trophy_image_url || "" })}
                className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )} style={{ borderLeftColor: active ? undefined : t.color, borderLeftWidth: 2 }}>
                {comp.name}
                <span className="block text-[10px] font-normal mt-0.5 opacity-60">{t("admin.rewards.competitionMeta", { platform: comp.platform })}</span>
              </button>
            );
          })}
          {regionalLeagues.filter(l => l.status !== "archived").slice(0, 12).map(league => {
            const active = rewardSource?.id === league.id;
            return (
              <button key={league.id} onClick={() => setRewardSource({ id: league.id, type: "regional_league", name: league.name, division: league.division || 1, max_clubs: league.max_clubs || 16, trophy_image_url: league.trophy_image_url || "" })}
                className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}>
                {league.name}
                <span className="block text-[10px] font-normal mt-0.5 opacity-60">
                  {t("admin.rewards.leagueMeta", { division: league.division || 1, season: league.season_number })}
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
            source={rewardSource}
            maxPositions={rewardSource.type === "regional_league" ? (rewardSource.max_clubs || 16) : 36}
            trophyImageUrl={rewardSource.trophy_image_url}
            onTrophyUrlChange={async (url) => {
              setRewardSource(s => s ? { ...s, trophy_image_url: url } : s);
              const entity = rewardSource.type === "competition"
                ? stageClient.entities.Competition
                : stageClient.entities.RegionalLeague;
              await entity?.update(rewardSource.id, { trophy_image_url: url }).catch(() => {});
            }}
          />
        </div>
      )}
    </div>
  );
}
