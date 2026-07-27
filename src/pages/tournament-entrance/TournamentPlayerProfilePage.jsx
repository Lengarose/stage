import { useLocation } from "react-router-dom";
import Profile from "@/pages/Profile";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Tournament-scoped "My Profile" — same design as /profile (Profile.jsx).
 * - /tournaments/profile-player → owner profile view
 * - /tournaments/profile-player/edit → edit player form
 */
export default function TournamentPlayerProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const playerId = localStorage.getItem("stage_player_id");
  const isEdit = location.pathname.endsWith("/edit");

  if (!playerId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        {t("commonPages.teLoadingProfile")}
      </div>
    );
  }

  return (
    <Profile
      tournamentMode
      tournamentId={user?.limited_tournament_id || null}
      initialView={isEdit ? "edit_player" : "profile"}
    />
  );
}
