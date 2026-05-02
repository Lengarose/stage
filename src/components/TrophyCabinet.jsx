// Legacy wrapper — forwards to ClubTrophyCabinetDisplay
import { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";

export default function TrophyCabinet({ clubId, currentUserEmail, club }) {
  return <ClubTrophyCabinetDisplay clubId={clubId} currentUserEmail={currentUserEmail} club={club} />;
}