import ClubDetail from "@/pages/ClubDetail";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Tournament-scoped "My Club" — same design as /clubs/:id (ClubDetail.jsx).
 */
export default function TournamentClubProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;
  const [clubId, setClubId] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const playerId = localStorage.getItem("stage_player_id");
    if (!playerId) {
      setLoadFailed(true);
      return;
    }
    stageClient.entities.Player.get(playerId)
      .then((p) => {
        if (p?.club_id) setClubId(p.club_id);
        else setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  if (!clubId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">
        {loadFailed ? t("commonPages.profNotClub") : t("commonPages.teLoadingClub")}
      </div>
    );
  }

  return <ClubDetail overrideClubId={clubId} tournamentId={tournamentId} />;
}
