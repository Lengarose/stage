import { useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { resolveGameDayMatchEvent, sameRecordId } from "@/lib/gameDayRealtime";

export function useGameDayMatchRealtime({
  matchId,
  reloadMatch,
  onMatch,
  onDressing,
}) {
  const onMatchRef = useRef(onMatch);
  const onDressingRef = useRef(onDressing);
  const reloadRef = useRef(reloadMatch);
  onMatchRef.current = onMatch;
  onDressingRef.current = onDressing;
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
      const fresh = await reloadRef.current?.(matchId).catch(() => resolved?.match || null);
      if (cancelled || !fresh) return;
      onMatchRef.current?.(fresh);
    };

    const unsubMatch = stageClient.entities.Match.subscribe((event) => {
      refreshMatch(event);
    }, { id: matchId });

    const unsubRoom = stageClient.entities.DressingRoom.subscribe((event) => {
      const data = event?.data;
      if (event?.type !== "delete" && !sameRecordId(data?.match_id, matchId)) return;
      onDressingRef.current?.(data || event);
      refreshMatch({ type: "update", data: { id: matchId, status: "scheduled" } });
    }, { match_id: matchId });

    return () => {
      cancelled = true;
      unsubMatch?.();
      unsubRoom?.();
    };
  }, [matchId]);
}
