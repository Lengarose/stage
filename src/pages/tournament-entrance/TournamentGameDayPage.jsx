import GameDay from "@/pages/GameDay";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentGameDayPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <GameDay tournamentId={tournamentId} />;
}
