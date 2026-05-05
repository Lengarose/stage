import { useState, useEffect, useCallback } from 'react';
import { stageClient } from '@/api/stageClient';
import { useSocket } from './SocketContext';

/**
 * Fetches an entity list via the API, then subscribes to a socket channel
 * for live updates. Merges inserts/updates/deletes automatically.
 *
 * @param {string}   entityName  - e.g. "Post", "Match", "ChatMessage"
 * @param {object}   filters     - passed to entity.filter()
 * @param {string}   orderBy     - e.g. "-created_date" (optional)
 * @param {string}   channel     - socket channel to subscribe to (optional)
 *
 * @returns {{ data, setData, refresh, isLoading }}
 *
 * Example:
 *   const { data: posts, isLoading } = useRealtimeData(
 *     'Post',
 *     { club_id: clubId },
 *     '-created_date',
 *     makeChannel(clubId, CHANNELS.POST)
 *   );
 */
export function useRealtimeData(entityName, filters = {}, orderBy = null, channel = null) {
  const [data, setData]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { joinRoom, leaveRoom, subscribe } = useSocket() || {};

  // Stable filter key for dependency array
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await stageClient.entities[entityName].filter(filters, orderBy);
      setData(result);
    } catch (err) {
      console.error(`[useRealtimeData] ${entityName} load error`, err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName, filtersKey, orderBy]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!channel || !joinRoom || !subscribe) return;

    joinRoom(channel);

    const unsub = subscribe(channel, (update) => {
      if (update.deleted) {
        setData(prev => prev.filter(item => item.id !== update.id));
      } else {
        setData(prev => {
          const idx = prev.findIndex(i => i.id === update.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...prev[idx], ...update };
            return next;
          }
          // New record — prepend (most recent first)
          return [update, ...prev];
        });
      }
    });

    return () => { unsub(); leaveRoom(channel); };
  }, [channel, joinRoom, leaveRoom, subscribe]);

  return { data, setData, refresh: load, isLoading };
}
