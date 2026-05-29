import { useLocation } from "react-router-dom";
import PlayerProfile from "@/pages/PlayerProfile";
import { useAuth } from "@/lib/AuthContext";

/**
 * Tournament-scoped player profile wrapper.
 * - /tournaments/profile-player → view own profile
 * - /tournaments/profile-player/edit → view own profile in edit mode
 * Redirects to the normal PlayerProfile page with the current user's player ID.
 */
export default function TournamentPlayerProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  const playerId = localStorage.getItem("stage_player_id");
  const isEdit = location.pathname.endsWith("/edit");

  if (!playerId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  return <PlayerProfile overridePlayerId={playerId} tournamentId={user?.limited_tournament_id || null} editMode={isEdit} />;
}
