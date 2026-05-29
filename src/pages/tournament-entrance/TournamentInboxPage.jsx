import InboxPage from "@/pages/Inbox";
import { useAuth } from "@/lib/AuthContext";

export default function TournamentInboxPage() {
  const { user } = useAuth();
  const tournamentId = user?.limited_tournament_id || null;

  return <InboxPage tournamentId={tournamentId} />;
}
