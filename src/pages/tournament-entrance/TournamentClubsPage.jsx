import ClubsRegistered from "@/pages/ClubsRegistered";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentClubsPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <ClubsRegistered overrideTournamentId={tournamentId} />;
}
