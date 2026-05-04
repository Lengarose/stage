import { base44 } from "@/api/base44Client";

/**
 * Awards a TrophyPlacement to the winning club when a tournament completes.
 * Creates a new placement or increments win_count if the club already has that trophy.
 */
export async function awardTournamentTrophy(tournament, winnerClubId) {
  if (!tournament?.trophy_item_id || !winnerClubId) return;
  try {
    const items = await base44.entities.TrophyItem.filter({ id: tournament.trophy_item_id }, null, 1);
    const item = items[0];
    if (!item) return;

    const existing = await base44.entities.TrophyPlacement.filter(
      { owner_id: winnerClubId, trophy_item_id: tournament.trophy_item_id },
      null, 1
    );

    if (existing.length > 0) {
      const p = existing[0];
      await base44.entities.TrophyPlacement.update(p.id, {
        win_count: (p.win_count || 1) + 1,
        won_tournament_ids: [...(p.won_tournament_ids || []), tournament.id],
      });
    } else {
      await base44.entities.TrophyPlacement.create({
        owner_id: winnerClubId,
        owner_type: "club",
        trophy_item_id: tournament.trophy_item_id,
        trophy_image_url: item.image_url,
        trophy_name: item.name,
        x_percent: 50,
        y_percent: 50,
        scale: 1,
        win_count: 1,
        won_tournament_ids: [tournament.id],
      });
    }
  } catch (err) {
    console.error("[awardTrophy]", err);
  }
}
