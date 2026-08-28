import { useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { resolveGameDayMatchEvent } from "@/lib/gameDayRealtime";

export function useGameDayMatchRealtime({
  matchId,
  reloadMatch,
  onMatch,
}) {
  const onMatchRef = useRef(onMatch);
  const reloadRef = useRef(reloadMatch);
  onMatchRef.current = onMatch;
  reloadRef.current = reloadMatch;

  useEffect(() => {
    if (!matchId) return undefined;
    let cancelled = false;

    const refreshMatch = async (event) => {
      const resolved = resolveGameDayMatchEvent(event, matchId);
      if (resolved?.type === "delete") {
        onMatchRef.current?.({ deleted: true, id: matchId });
        return;
      }
      // The Match socket channel is global: events for other people's matches
      // arrive here too. Without this guard every one of them triggered a full
      // refetch of the currently open match.
      if (!resolved) return;
      const fresh = await reloadRef.current?.(matchId).catch(() => resolved?.match || null);
      if (cancelled || !fresh) return;
      onMatchRef.current?.(fresh);
    };

    const unsubMatch = stageClient.entities.Match.subscribe((event) => {
      refreshMatch(event);
    }, { id: matchId });

    // Phase 2 — the dressing room is out of the Game Day flow, so no room
    // subscription is needed here any more.

    return () => {
      cancelled = true;
      unsubMatch?.();
    };
  }, [matchId]);
}
