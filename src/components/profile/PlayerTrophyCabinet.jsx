import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import TrophyCabinetSystem from "@/components/trophy/TrophyCabinetSystem";

// Player trophies from solo tournament wins
export default function PlayerTrophyCabinet({ player, currentUserEmail }) {
  const [wonTournaments, setWonTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const all = await stageClient.entities.Tournament.filter({ status: "completed" }, "-updated_date", 200);
      setWonTournaments(all.filter(t => t.winner_player_id === player.id));
      setLoading(false);
    }
    load();
  }, [player.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = currentUserEmail && currentUserEmail === player.email;

  return (
    <TrophyCabinetSystem
      ownerId={player.id}
      ownerType="player"
      canEdit={canEdit}
      wonTournaments={wonTournaments}
    />
  );
}

// Club trophy cabinet
export function ClubTrophyCabinetDisplay({ clubId, currentUserEmail, club, canEditOverride }) {
  const [wonTournaments, setWonTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const won = await stageClient.entities.Tournament.filter({ winner_club_id: clubId, status: "completed" });
      setWonTournaments(won);
      setLoading(false);
    }
    load();
  }, [clubId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = canEditOverride !== undefined
    ? canEditOverride
    : (currentUserEmail && club && currentUserEmail === club.owner_email);

  return (
    <TrophyCabinetSystem
      ownerId={clubId}
      ownerType="club"
      canEdit={canEdit}
      wonTournaments={wonTournaments}
    />
  );
}