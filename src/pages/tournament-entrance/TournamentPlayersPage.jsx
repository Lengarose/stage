import Players from "@/pages/Players";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentPlayersPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <Players tournamentId={tournamentId} />;
}
