import ClubDetail from "@/pages/ClubDetail";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { resolveMyPlayerAndClub } from "@/api/stageClient";
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
    resolveMyPlayerAndClub()
      .then(({ player, club }) => {
        const resolvedClubId = club?.id || player?.club_id;
        if (resolvedClubId) setClubId(resolvedClubId);
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
