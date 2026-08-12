import {
  GamerAttributeBar,
  GamerSectionCard,
  GamerStatTile,
  gamerStatScore,
} from "./GamerProfileUI";

export default function GamerProfileStatsPanel({ player, stats, t }) {
  const source = stats?.playerFields || player;
  const matches = Number(source?.matches_played || 0);
  const goals = Number(source?.goals || 0);
  const assists = Number(source?.assists || 0);
  const avgRating = Number(source?.avg_match_rating || 6);
  const wins = Number(source?.wins_count || 0);
  const cleanSheets = Number(source?.clean_sheets || 0);
  const motm = Number(source?.man_of_the_match || 0);
  const winRate = matches ? Math.round((wins / matches) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GamerStatTile label={t("commonPages.matches")} value={matches} accent="sky" />
        <GamerStatTile label={t("commonPages.goals")} value={goals} accent="green" />
        <GamerStatTile label={t("commonPages.assists")} value={assists} accent="violet" />
        <GamerStatTile label={t("commonPages.profAvgRating")} value={avgRating.toFixed(1)} accent="gold" sub={`${winRate}% WR`} />
        <GamerStatTile label={t("commonPages.profWins")} value={wins} accent="green" />
        <GamerStatTile label={t("commonPages.profLosses")} value={source?.losses_count || 0} accent="rose" />
        <GamerStatTile label={t("commonPages.profMotm")} value={motm} accent="gold" />
        <GamerStatTile label={t("commonPages.profCleanSheets")} value={cleanSheets} accent="cyan" />
      </div>

      <GamerSectionCard title={t("commonPages.gamerAttributes")}>
        <div className="grid sm:grid-cols-2 gap-4">
          <GamerAttributeBar label="MAT" value={gamerStatScore(matches, 120)} max={99} accent="sky" />
          <GamerAttributeBar label="GOL" value={gamerStatScore(goals, 80)} max={99} accent="green" />
          <GamerAttributeBar label="ASS" value={gamerStatScore(assists, 60)} max={99} accent="violet" />
          <GamerAttributeBar label="RAT" value={gamerStatScore(avgRating, 10)} max={99} accent="gold" />
          <GamerAttributeBar label="WIN" value={winRate} max={99} accent="green" />
          <GamerAttributeBar label="CLN" value={gamerStatScore(cleanSheets, 40)} max={99} accent="cyan" />
        </div>
      </GamerSectionCard>
    </div>
  );
}
