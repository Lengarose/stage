import RewardConfigPanel from "@/components/rewards/RewardConfigPanel";
import DivisionTwoRewardReview from '@/components/rewards/DivisionTwoRewardReview';
import {useState} from 'react';
import { cn } from "@/lib/utils";
import { OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS } from "@/lib/qualificationConfig";
import { getRegionalLeagueMaxClubs } from "@/lib/regionalLeagueRules";
import { useTranslation } from "@/hooks/useTranslation";
import { Coins } from "lucide-react";
import { regionalRewardSources } from '@/lib/regionalRewardSources';
import RegionalEditionReview from '@/components/rewards/RegionalEditionReview';

export default function RewardsTab({
  competitions,
  regionalLeagues,
  rewardSource,
  setRewardSource,
  onReload,
  sourceError,
}) {
  const { t } = useTranslation();
  const [configurationRefresh,setConfigurationRefresh]=useState(0);

  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
        <Coins className="w-5 h-5 text-warning" /> {t("admin.rewards.seasonRewards")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("admin.rewards.description")}
      </p>
      <p className="border-l-2 border-primary pl-3 text-sm">Shared regional schedules: Division 1 starts at 54,000,000 STC (757,000,000 total); Division 2 starts at 33,000,000 STC (337,000,000 total). Both decrease by 1,700,000 per position, for up to 20 clubs. GOST is configured separately.</p>
      <DivisionTwoRewardReview onApplied={()=>setConfigurationRefresh(v=>v+1)}/>
      {sourceError && <p role="alert" className="text-destructive">{sourceError}</p>}
      <RegionalEditionReview onApplied={async result => { if (rewardSource?.id === result.source_id) setRewardSource(null); await onReload?.(); }} />

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t("admin.rewards.selectSource")}</p>
        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">GOST</p>
            {[{slug:"supreme",color:"#FFD700"},{slug:"elite",color:"#00E5BD"},{slug:"challenger",color:"#A78BFA"}].map((tier) => {
              const comp = competitions.find(c => c.slug === tier.slug);
              if (!comp) return null;
              const active = rewardSource?.id === comp.id;
              return (
                <button key={tier.slug} onClick={() => setRewardSource({ id: comp.id, type: "competition", name: comp.name, slug: comp.slug, tier: comp.tier, trophy_image_url: comp.trophy_image_url || "" })}
                  className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )} style={{ borderLeftColor: active ? undefined : tier.color, borderLeftWidth: 2 }}>
                  {comp.name}
                  <span className="block text-[10px] font-normal mt-0.5 opacity-60">{t("admin.rewards.competitionMeta", { platform: comp.platform })}</span>
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Regional Leagues</p>
            {regionalRewardSources(regionalLeagues).map(league => {
              const active = rewardSource?.id === league.id;
              return (
                <button type="button" key={league.id} onClick={() => setRewardSource({ id: league.id, type: "regional_league", name: league.name, division: league.division || 1, max_clubs: getRegionalLeagueMaxClubs(league), trophy_image_url: league.trophy_image_url || "" })}
                  className={cn("w-full text-left p-3 rounded border text-xs font-bold transition-all",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}>
                  {league.name}{league.status==='archived'?' · Archived':''}
                  <span className="block text-[11px] font-normal mt-0.5">
                    {t("admin.rewards.leagueMeta", { division: league.division || 1, season: league.season_number })}
                    {' · '}{league.region_slug || league.region || 'Region unspecified'}{' · '}{league.platform || 'Platform unspecified'}{' · '}{league.status || 'Status unspecified'}
                  </span>
                  <span className="block break-all text-[10px] font-normal">ID: {league.id}</span>
                  {league.stored_name && league.stored_name !== league.name && <span className="block text-[10px]">Stored name: {league.stored_name}</span>}
                  {league.identity_conflict && <span className="block text-warning text-[10px]">Unresolved edition identity conflict — review before changing rewards</span>}
                  {league.identity_unverified && <span className="block text-warning text-[10px]">Incomplete edition identity — inspect raw records</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reward config panel for selected source */}
      {rewardSource && (
        <div className="bg-card border border-border rounded p-5 space-y-4">
          <p className="text-sm font-bold text-foreground">{rewardSource.name}</p>
          <RewardConfigPanel
            key={`${rewardSource.type}:${rewardSource.id}:${rewardSource.division??''}:${configurationRefresh}`}
            sourceId={rewardSource.id}
            sourceType={rewardSource.type}
            sourceName={rewardSource.name}
            source={rewardSource}
            maxPositions={rewardSource.type === "regional_league" ? getRegionalLeagueMaxClubs(rewardSource) : OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS}
            trophyImageUrl={rewardSource.trophy_image_url}
          />
        </div>
      )}
    </div>
  );
}
