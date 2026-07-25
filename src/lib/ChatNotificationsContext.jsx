import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { stageClient } from "@/api/stageClient";
import { useAuth } from "@/lib/AuthContext";
import { playChatNotificationSound, primeAudioOnUserGesture } from "@/lib/chatNotificationSound";

// ChatNotificationsProvider
//
// Centralized place that owns:
//   • Per-channel unread counts (synced from the server `chat_reads` table)
//   • The set of channels currently visible on screen ("open" channels)
//   • Per-channel + global mute state (persisted to localStorage)
//   • Realtime subscriptions to each registered channel — fires the sound
//     and increments the count when a new message arrives in a channel the
//     user is NOT currently viewing (and didn't send themselves).
//
// Channels are registered by chat components when they mount (so we don't
// have to enumerate every match the user could possibly be in up front).
// A registered channel automatically marks itself as "open" while visible
// in the DOM, so the badge + sound only fire for channels in the background.

const ChatNotificationsContext = createContext(null);

const GLOBAL_MUTE_KEY = "stage_chat_muted_global_v1";
const CHANNEL_MUTE_KEY = "stage_chat_muted_channels_v1";

function readLocalBool(key, fallback = false) {
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "1" || v === "true";
  } catch { return fallback; }
}
function writeLocalBool(key, value) {
  try { window.localStorage.setItem(key, value ? "1" : "0"); } catch { /* private mode */ }
}
function readLocalChannelMutes() {
  try {
    const raw = window.localStorage.getItem(CHANNEL_MUTE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function writeLocalChannelMutes(set) {
  try { window.localStorage.setItem(CHANNEL_MUTE_KEY, JSON.stringify(Array.from(set))); }
  catch { /* private mode */ }
}

export function ChatNotificationsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userEmail = (user?.email || "").toLowerCase();

  const [unreadCounts, setUnreadCounts] = useState({});       // { [channelId]: number }
  const [openChannels, setOpenChannels] = useState(new Set()); // channels currently on screen
  const [globalMuted, setGlobalMutedState] = useState(() => readLocalBool(GLOBAL_MUTE_KEY, false));
  const [channelMutes, setChannelMutesState] = useState(() => readLocalChannelMutes());

  // refs so the socket callback always sees the latest state without
  // re-subscribing on every render.
  const openChannelsRef = useRef(openChannels);
  const globalMutedRef  = useRef(globalMuted);
  const channelMutesRef = useRef(channelMutes);
  const userEmailRef    = useRef(userEmail);
  useEffect(() => { openChannelsRef.current = openChannels; }, [openChannels]);
  useEffect(() => { globalMutedRef.current  = globalMuted; }, [globalMuted]);
  useEffect(() => { channelMutesRef.current = channelMutes; }, [channelMutes]);
  useEffect(() => { userEmailRef.current    = userEmail; }, [userEmail]);

  // Track the set of channels the provider has discovered, plus per-channel
  // socket unsubscribers.
  const registeredChannelsRef = useRef(new Set());
  const unsubByChannelRef = useRef(new Map());

  // Prime Web Audio on the first user gesture so iOS will allow playback.
  useEffect(() => { primeAudioOnUserGesture(); }, []);

  // Initial load of unread counts for this user.
  useEffect(() => {
    if (!isAuthenticated || !userEmail) {
      setUnreadCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await stageClient.chatReads.getUnreadCounts();
        if (cancelled) return;
        setUnreadCounts(res?.counts || {});
      } catch {
        // Network/route failures shouldn't crash the chat surface.
        if (!cancelled) setUnreadCounts({});
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, userEmail]);

  // Subscribes to a single chat channel and wires the new-message handler.
  const subscribeChannel = useCallback((channelId) => {
    if (!channelId || unsubByChannelRef.current.has(channelId)) return;
    const unsub = stageClient.entities.ChatMessage.subscribe((event) => {
      // Only react to fresh inserts; ignore updates/deletes for unread counting.
      if (event?.type === "delete") return;
      const payload = event?.data;
      if (!payload || payload.match_id !== channelId) return;

      const senderEmail = String(payload.sender_email || "").toLowerCase();
      // Don't notify on our own messages.
      if (senderEmail && userEmailRef.current && senderEmail === userEmailRef.current) return;

      const isOpen     = openChannelsRef.current.has(channelId);
      const isMuted    = globalMutedRef.current || channelMutesRef.current.has(channelId);

      // Always increment server-tracked count display IF the channel is not
      // currently in view. Sound only if not muted AND not open.
      if (!isOpen) {
        setUnreadCounts((prev) => ({ ...prev, [channelId]: (prev[channelId] || 0) + 1 }));
        if (!isMuted) playChatNotificationSound();
      }
    }, { match_id: channelId });
    unsubByChannelRef.current.set(channelId, unsub);
  }, []);

  const unsubscribeChannel = useCallback((channelId) => {
    const unsub = unsubByChannelRef.current.get(channelId);
    if (unsub) {
      try { unsub(); } catch { /* ignore */ }
      unsubByChannelRef.current.delete(channelId);
    }
  }, []);

  // Public API — a chat surface calls registerChannel when it mounts so the
  // provider knows about it (subscribes + ensures we have a count for it).
  const registerChannel = useCallback((channelId) => {
    if (!channelId) return;
    if (registeredChannelsRef.current.has(channelId)) return;
    registeredChannelsRef.current.add(channelId);
    subscribeChannel(channelId);
  }, [subscribeChannel]);

  // Mark a channel as "currently visible". While set, incoming messages do
  // NOT increment the badge AND we silently mark-read on the server.
  const setChannelOpen = useCallback((channelId, isOpen) => {
    if (!channelId) return;
    setOpenChannels((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(channelId);
      else next.delete(channelId);
      return next;
    });
    if (isOpen) {
      // Optimistically clear the local badge for this channel.
      setUnreadCounts((prev) => {
        if (!prev[channelId]) return prev;
        const next = { ...prev };
        delete next[channelId];
        return next;
      });
      // Persist read marker server-side.
      stageClient.chatReads.markRead(channelId).catch(() => { /* non-fatal */ });
    }
  }, []);

  // Manual mark-read (for cases where we want to clear the badge without
  // marking the channel as actively-open). Returns a promise so callers can
  // await if they want to.
  const markChannelRead = useCallback(async (channelId) => {
    if (!channelId) return;
    setUnreadCounts((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    try { await stageClient.chatReads.markRead(channelId); } catch { /* non-fatal */ }
  }, []);

  // Mark every channel with unread messages as read (used when the user
  // opens the Game Day page — the badge should clear immediately).
  const unreadCountsRef = useRef(unreadCounts);
  useEffect(() => { unreadCountsRef.current = unreadCounts; }, [unreadCounts]);
  const markAllRead = useCallback(async () => {
    const ids = Object.keys(unreadCountsRef.current || {});
    if (!ids.length) return;
    setUnreadCounts({});
    await Promise.all(ids.map((id) => stageClient.chatReads.markRead(id).catch(() => { /* non-fatal */ })));
  }, []);

  const setGlobalMuted = useCallback((value) => {
    const v = Boolean(value);
    setGlobalMutedState(v);
    writeLocalBool(GLOBAL_MUTE_KEY, v);
  }, []);

  const toggleGlobalMuted = useCallback(() => {
    setGlobalMutedState((cur) => {
      const next = !cur;
      writeLocalBool(GLOBAL_MUTE_KEY, next);
      return next;
    });
  }, []);

  const setChannelMuted = useCallback((channelId, value) => {
    if (!channelId) return;
    setChannelMutesState((cur) => {
      const next = new Set(cur);
      if (value) next.add(channelId);
      else next.delete(channelId);
      writeLocalChannelMutes(next);
      return next;
    });
  }, []);

  const toggleChannelMuted = useCallback((channelId) => {
    if (!channelId) return;
    setChannelMutesState((cur) => {
      const next = new Set(cur);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      writeLocalChannelMutes(next);
      return next;
    });
  }, []);

  // Tear down all subscriptions when the user logs out / provider unmounts.
  useEffect(() => {
    if (isAuthenticated) return;
    for (const [, unsub] of unsubByChannelRef.current) {
      try { unsub?.(); } catch { /* ignore */ }
    }
    unsubByChannelRef.current.clear();
    registeredChannelsRef.current.clear();
    setUnreadCounts({});
    setOpenChannels(new Set());
  }, [isAuthenticated]);
  useEffect(() => () => {
    for (const [, unsub] of unsubByChannelRef.current) {
      try { unsub?.(); } catch { /* ignore */ }
    }
    unsubByChannelRef.current.clear();
    registeredChannelsRef.current.clear();
  }, []);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((s, n) => s + (Number(n) || 0), 0),
    [unreadCounts]
  );

  const value = useMemo(() => ({
    unreadCounts,
    totalUnread,
    openChannels,
    globalMuted,
    channelMutes,
    registerChannel,
    setChannelOpen,
    markChannelRead,
    markAllRead,
    setGlobalMuted,
    toggleGlobalMuted,
    setChannelMuted,
    toggleChannelMuted,
    isChannelMuted: (channelId) => channelMutes.has(channelId) || globalMuted,
    getUnreadCount: (channelId) => unreadCounts[channelId] || 0,
  }), [
    unreadCounts, totalUnread, openChannels, globalMuted, channelMutes,
    registerChannel, setChannelOpen, markChannelRead, markAllRead, setGlobalMuted,
    toggleGlobalMuted, setChannelMuted, toggleChannelMuted,
  ]);

  return (
    <ChatNotificationsContext.Provider value={value}>
      {children}
    </ChatNotificationsContext.Provider>
  );
}

// Hook for any consumer. Safe to call without the provider (returns a no-op
// shape) so unit tests and lazy pages don't crash if the tree isn't wrapped.
export function useChatNotifications() {
  const ctx = useContext(ChatNotificationsContext);
  if (ctx) return ctx;
  return {
    unreadCounts: {},
    totalUnread: 0,
    openChannels: new Set(),
    globalMuted: false,
    channelMutes: new Set(),
    registerChannel: () => {},
    setChannelOpen: () => {},
    markChannelRead: async () => {},
    markAllRead: async () => {},
    setGlobalMuted: () => {},
    toggleGlobalMuted: () => {},
    setChannelMuted: () => {},
    toggleChannelMuted: () => {},
    isChannelMuted: () => false,
    getUnreadCount: () => 0,
  };
}

// Convenience hook for a chat surface — registers the channel, marks it
// "open" while mounted, and exposes per-channel mute helpers.
export function useChatChannel(channelId) {
  const ctx = useChatNotifications();
  useEffect(() => {
    if (!channelId) return;
    ctx.registerChannel(channelId);
    ctx.setChannelOpen(channelId, true);
    return () => ctx.setChannelOpen(channelId, false);
  // We intentionally only re-run when the channelId changes — ctx methods
  // are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return {
    unreadCount: ctx.getUnreadCount(channelId),
    isMuted: ctx.isChannelMuted(channelId),
    toggleMuted: () => ctx.toggleChannelMuted(channelId),
    markRead: () => ctx.markChannelRead(channelId),
  };
}
