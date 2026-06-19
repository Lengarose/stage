import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { hasStagePlus } from "@/lib/subscriptionUtils";

function hasActivePlan(user) {
  const roleId = Number(user?.role_id ?? 1);
  if (roleId === 0 || roleId === 2 || user?.role === "admin") return true;
  return hasStagePlus(user?.subscription);
}

function isAllowedTournamentLimitedPath(pathname, tournamentId) {
  if (!pathname) return false;
  if (pathname.startsWith("/tournaments/entrance/")) return true;
  if (pathname === "/tournaments/game-day") return true;
  if (pathname === "/tournaments/schedule") return true;
  if (pathname === "/tournaments/inbox") return true;
  if (pathname === "/tournaments/profile-player") return true;
  if (pathname === "/tournaments/profile-player/edit") return true;
  if (pathname === "/tournaments/players") return true;
  if (pathname === "/tournaments/clubs") return true;
  if (pathname === "/tournaments/trophy") return true;
  if (pathname === "/tournaments/profile-club") return true;
  if (pathname === "/tournaments/settings") return true;
  if (tournamentId && pathname === `/tournaments/${tournamentId}`) return true;
  return false;
}

export default function TournamentEntranceRouteGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  const limitedTarget = useMemo(() => {
    if (!user) return null;
    if (hasActivePlan(user)) return null;
    const mode = String(user.access_mode || "standard").toLowerCase();
    if (mode !== "tournament_limited") return null;
    return user.limited_tournament_id || null;
  }, [user]);

  if (!limitedTarget) return children;

  if (!isAllowedTournamentLimitedPath(location.pathname, limitedTarget)) {
    return <Navigate to={`/tournaments/${limitedTarget}`} replace />;
  }

  return children;
}
