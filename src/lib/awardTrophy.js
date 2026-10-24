import { stageClient } from "@/api/stageClient";

// Compatibility reader only. Competition completion awards entitlements on the server.
export async function awardTournamentTrophy(tournament, winnerClubId) {
  if (!tournament?.id || !winnerClubId) return null;
  return stageClient.http.get(`/trophy-placements/entitlements?owner_id=${encodeURIComponent(winnerClubId)}&owner_type=club`);
}
