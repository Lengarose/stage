import ClubDetail from "@/pages/ClubDetail";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";

export default function TournamentClubProfilePage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;
  const [clubId, setClubId] = useState(null);

  useEffect(() => {
    const playerId = localStorage.getItem("stage_player_id");
    if (!playerId) return;
    stageClient.entities.Player.get(playerId).then((p) => {
      if (p?.club_id) setClubId(p.club_id);
    }).catch(() => {});
  }, []);

  if (!clubId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">
        Loading club...
      </div>
    );
  }

  return <ClubDetail overrideClubId={clubId} tournamentId={tournamentId} />;
}
