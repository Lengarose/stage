import { stageClient } from "@/api/stageClient";
import { getDefaultRewardRowsForSource } from "@/lib/prizeDefaults";

// ─── Badge / label helpers ────────────────────────────────────────────────────

export function defaultBadgeType(position) {
  if (position === 1) return "winner";
  if (position === 2) return "finalist";
  if (position <= 4)  return "semi_finalist";
  if (position <= 8)  return "top_4";
  return "participant";
}

export function defaultPositionLabel(position) {
  const labels = { 1: "Winner", 2: "Runner-Up", 3: "3rd Place", 4: "4th Place" };
  return labels[position] || `${position}th Place`;
}

export const BADGE_STYLE = {
  winner:        { bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/30",  label: "Winner"      },
  finalist:      { bg: "bg-zinc-400/10",    text: "text-zinc-300",    border: "border-zinc-400/30",    label: "Runner-Up"   },
  semi_finalist: { bg: "bg-amber-700/10",   text: "text-amber-500",   border: "border-amber-600/30",   label: "Semi-Final"  },
  top_4:         { bg: "bg-primary/10",     text: "text-primary",     border: "border-primary/30",     label: "Top 4"       },
  participant:   { bg: "bg-secondary",      text: "text-muted-foreground", border: "border-border",   label: "Participant" },
};

// Rewards are established and paid by the server, never by cabinet/achievement writes.
export async function distributeSeasonRewards({sourceId,sourceType,seasonId}) {
  const kind=sourceType==='regional_league'?'regional_league':'competition_season';
  const id=kind==='regional_league'?sourceId:seasonId;
  const result=await stageClient.http.post(`/competition-views/${kind}/${encodeURIComponent(id)}/reconcile`,{apply:true,reason:'Admin requested established season prize settlement'});
  if(!['paid','zero_prize'].includes(result.state))throw new Error(`Settlement is ${result.state}: ${(result.blocking_reasons||[]).join('; ')}`);
  return result;
}
export async function getRewardConfiguration(sourceId,sourceType) {
  return stageClient.http.get(`/reward-configs/source/${sourceType}/${encodeURIComponent(sourceId)}`);
}
export async function getRewardConfigs(sourceId,sourceType='regional_league') {
  return (await getRewardConfiguration(sourceId,sourceType)).rows;
}
export async function saveRewardConfigs(sourceId,sourceType,sourceName,rows,options={}) {
  return stageClient.http.post(`/reward-configs/source/${sourceType}/${encodeURIComponent(sourceId)}/replace`,{...options,rows});
}
export async function ensureDefaultRewardConfigs(sourceId,sourceType,sourceName,source={},maxPositions=36) {
  const config=await getRewardConfiguration(sourceId,sourceType);
  if(config.version || config.rows.length || sourceType!=='regional_league')return config.rows;
  const rows=getDefaultRewardRowsForSource(sourceType,config.source,maxPositions);
  return (await saveRewardConfigs(sourceId,sourceType,sourceName,rows,{version:config.version,revision:config.revision,participant_count:maxPositions,reason:'Initialize the agreed shared regional schedule for a new edition'})).rows;
}
