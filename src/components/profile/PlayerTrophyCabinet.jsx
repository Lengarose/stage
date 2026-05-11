import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import TrophyCabinetSystem from "@/components/trophy/TrophyCabinetSystem";

// Player trophies from solo tournament wins
export default function PlayerTrophyCabinet({ player, currentUserEmail }) {
  const [wonTournaments, setWonTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [won, clubCompWins, clubLeagueWins] = await Promise.all([
          stageClient.entities.Tournament.filter({ winner_player_id: player.id }).catch(() => []),
          player.club_id
            ? stageClient.entities.CompetitionSeason.filter({ winner_club_id: player.club_id }).catch(() => [])
            : [],
          player.club_id
            ? stageClient.entities.RegionalLeague.filter({ winner_club_id: player.club_id }).catch(() => [])
            : [],
        ]);
        setWonTournaments([...(won || []), ...(clubCompWins || []), ...(clubLeagueWins || [])]);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [player.id, player.club_id]);

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
      try {
        // Fetch wins from all three sources — each has winner_club_id + trophy_item_id
        const [tournaments, compSeasons, leagues] = await Promise.all([
          stageClient.entities.Tournament.filter({ winner_club_id: clubId }).catch(() => []),
          stageClient.entities.CompetitionSeason.filter({ winner_club_id: clubId }).catch(() => []),
          stageClient.entities.RegionalLeague.filter({ winner_club_id: clubId }).catch(() => []),
        ]);
        setWonTournaments([...(tournaments || []), ...(compSeasons || []), ...(leagues || [])]);
      } catch {
      } finally {
        setLoading(false);
      }
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