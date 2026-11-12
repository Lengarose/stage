import { useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
const cache = new Map();
export function loadCardProgression(playerId) {
  if (!playerId) return Promise.resolve(null);
  const old = cache.get(playerId);
  if (old && Date.now() - old.at < 30000) return old.promise;
  const promise = stageClient.http.get(`/card-progressions/${encodeURIComponent(playerId)}`).catch(error => { cache.delete(playerId); throw error; });
  cache.set(playerId, { at: Date.now(), promise });
  return promise;
}
export function useCardProgression(playerId) {
  const [state, setState] = useState({ card: null, error: null });
  useEffect(() => {
    let active = true;
    setState({card:null,error:null});
    const refresh = () => { if (!playerId) return; loadCardProgression(playerId).then(card => { if (active) setState({card,error:null}); }).catch(error => { if (active) setState({card:null,error:error.message}); }); };
    refresh(); const timer = window.setInterval(refresh,30000);
    return () => {active=false;window.clearInterval(timer);};
  }, [playerId]);
  return state;
}
