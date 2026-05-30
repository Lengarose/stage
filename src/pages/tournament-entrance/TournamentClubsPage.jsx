import Clubs from "@/pages/Clubs";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentClubsPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <Clubs tournamentId={tournamentId} />;
}
