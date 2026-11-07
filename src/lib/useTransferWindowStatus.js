import { useCallback, useEffect, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { CHANNELS, offSocketListeners, setSocketListeners } from "@/lib/SocketContext";
import { isTransferWindowOpen } from "@/lib/transferWindow";

export function useTransferWindowStatus() {
  const [currentWindow, setCurrentWindow] = useState(null);
  const [officialRecruitment, setOfficialRecruitment] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!await stageClient.auth.isAuthenticated()) {
        setCurrentWindow(null);setOfficialRecruitment(false);
        return;
      }
      const res = await stageClient.functions.invoke("transferWindowActions", { action: "get_current" });
      setCurrentWindow(res?.data?.window || null);
      setOfficialRecruitment(res?.data?.official_recruitment === true);
    } catch (err) {
      console.warn("[transfer-window] status load failed:", err?.message || err);
      setCurrentWindow(null);setOfficialRecruitment(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    stageClient.auth.isAuthenticated()
      .then((isAuthenticated) => (
        isAuthenticated
          ? stageClient.functions.invoke("transferWindowActions", { action: "get_current" })
          : { data: { window: null } }
      ))
      .then((res) => {
        if (alive) {setCurrentWindow(res?.data?.window || null);setOfficialRecruitment(res?.data?.official_recruitment === true);}
      })
      .catch((err) => {
        console.warn("[transfer-window] status load failed:", err?.message || err);
        if (alive) setCurrentWindow(null);setOfficialRecruitment(false);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onTransferWindowUpdate = () => refresh();

    setSocketListeners(CHANNELS.TRANSFER_WINDOW, onTransferWindowUpdate);
    return () => offSocketListeners(CHANNELS.TRANSFER_WINDOW, onTransferWindowUpdate);
  }, [refresh]);

  const windowOpen = isTransferWindowOpen(currentWindow);

  return {
    currentWindow,
    loading,
    refresh,
    windowOpen,
    officialRecruitment,
    offersAvailable: windowOpen || officialRecruitment,
  };
}
