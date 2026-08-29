import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { asObject, asObjectArray } from "@/lib/safeData";
import PageNotFound from "@/lib/PageNotFound";

/**
 * Legacy /presidents/:id bookmarks resolve to the public player profile.
 * This is not a President product page.
 */
export default function PresidentLegacyRedirect() {
  const { id } = useParams();
  const [playerId, setPlayerId] = useState(undefined);

  useEffect(() => {
    let cancelled = false;

    async function resolvePlayerId() {
      if (!id) {
        setPlayerId(null);
        return;
      }

      const asPlayer = asObject(await stageClient.entities.Player.get(id).catch(() => null));
      if (asPlayer?.id) {
        if (!cancelled) setPlayerId(asPlayer.id);
        return;
      }

      const president = asObject(await stageClient.entities.President.get(id).catch(() => null));
      if (president?.club_id) {
        const club = asObject(await stageClient.entities.Club.get(president.club_id).catch(() => null));
        if (club?.president_player_id) {
          if (!cancelled) setPlayerId(club.president_player_id);
          return;
        }
      }
      if (president?.user_id) {
        const mappedPlayers = await stageClient.entities.Player
          .filter({ user_id: president.user_id }, null, 1)
          .catch(() => []);
        const mappedPlayer = asObject(asObjectArray(mappedPlayers)[0]);
        if (mappedPlayer?.id) {
          if (!cancelled) setPlayerId(mappedPlayer.id);
          return;
        }
      }

      if (!cancelled) setPlayerId(null);
    }

    resolvePlayerId();
    return () => { cancelled = true; };
  }, [id]);

  if (playerId === undefined) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!playerId) return <PageNotFound />;
  return <Navigate to={`/players/${playerId}`} replace />;
}
