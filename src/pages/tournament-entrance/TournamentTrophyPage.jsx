import PlayerTrophyCabinet from "@/components/profile/PlayerTrophyCabinet";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TournamentTrophyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const playerId = localStorage.getItem("stage_player_id");
    if (!playerId) return;
    stageClient.entities.Player.get(playerId).then(setPlayer).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <h1 className="text-xl font-bold mb-4">Trophy Cabinet</h1>
      {player ? (
        <PlayerTrophyCabinet
          playerId={player.id}
          currentUserEmail={user?.email}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Loading...</p>
      )}
    </div>
  );
}
