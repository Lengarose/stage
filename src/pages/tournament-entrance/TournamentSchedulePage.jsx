import Schedule from "@/pages/Schedule";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentSchedulePage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <Schedule tournamentId={tournamentId} />;
}
