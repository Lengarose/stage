import { Navigate, useLocation } from "react-router-dom";
import Profile from "@/pages/Profile";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveMyPlayerAndClub } from "@/api/stageClient";
import { useEffect, useState } from "react";

/**
 * Tournament-scoped "My Profile" — same design as /profile (Profile.jsx).
 * - /tournaments/profile-player → player profile view
 * - /tournaments/profile-player/edit → edit player form
 */
export default function TournamentPlayerProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [identity, setIdentity] = useState({ loading: true, player: null, club: null });
  const isEdit = location.pathname.endsWith("/edit");

  useEffect(() => {
    let cancelled = false;
    resolveMyPlayerAndClub()
      .then(({ player, club, presidentClub }) => {
        if (!cancelled) setIdentity({ loading: false, player: player || null, club: presidentClub || club || null });
      })
      .catch(() => {
        if (!cancelled) setIdentity({ loading: false, player: null, club: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (identity.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        {t("commonPages.teLoadingProfile")}
      </div>
    );
  }

  if (!identity.player && identity.club) {
    return <Navigate to="/tournaments/profile-club" replace />;
  }

  if (!identity.player) {
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
