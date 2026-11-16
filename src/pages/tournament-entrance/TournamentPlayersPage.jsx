import Directory from "@/pages/Directory";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentPlayersPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <Directory tournamentId={tournamentId} initialKind="players" />;
}
