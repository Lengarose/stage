import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Inbox, RefreshCw, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import InboxMessageList from "@/components/inbox/InboxMessageList";
import InboxMessageDetail from "@/components/inbox/InboxMessageDetail";

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);

  useEffect(() => {
    let unsub = null;

    async function load() {
      const u = await stageClient.auth.me();
      setUser(u);

      const players = await stageClient.entities.Player.filter({ email: u.email }).catch(() => []);
      const player = players[0] || null;
      setMyPlayer(player);
      if (player?.club_id) {
        const clubs = await stageClient.entities.Club.filter({ id: player.club_id }).catch(() => []);
        setMyClub(clubs[0] || null);
      }

      const data = await stageClient.entities.InboxMessage.filter({ recipient_email: u.email }, "-created_date", 200);
      setMessages(data || []);

      // Auto-open from URL param
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("id");
      if (targetId && data?.length) {
        const target = data.find(m => m.id === targetId);
        if (target) openMessage(target);
      }

      setLoading(false);

      // Real-time subscription — set up AFTER we have the user's email
      const currentEmail = u.email;
      unsub = stageClient.entities.InboxMessage.subscribe((event) => {
        if (event.type === "create") {
          if (event.data?.recipient_email === currentEmail) {
            setMessages(prev => [event.data, ...prev]);
          }
        }
        if (event.type === "update") {
          if (event.data?.recipient_email === currentEmail) {
            setMessages(prev => prev.map(m => m.id === event.id ? event.data : m));
            setSelected(prev => prev?.id === event.id ? event.data : prev);
          }
        }
        if (event.type === "delete") {
          setMessages(prev => prev.filter(m => m.id !== event.id));
          setSelected(prev => prev?.id === event.id ? null : prev);
        }
      });
    }

    load();

    return () => { if (unsub) unsub(); };
  }, []);

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.is_read) {
      try {
        await stageClient.entities.InboxMessage.update(msg.id, { is_read: true });
        const updated = { ...msg, is_read: true };
        setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
        setSelected(updated);
      } catch {
        // ignore mark-as-read failure
      }
    }
  }

  async function markAllAsRead() {
    const unread = messages.filter(m => !m.is_read);
    if (unread.length === 0) return;
    await Promise.all(unread.map(m => stageClient.entities.InboxMessage.update(m.id, { is_read: true })));
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    if (selected) setSelected(prev => ({ ...prev, is_read: true }));
  }

  function handleDeleted(id) {
    setMessages(prev => prev.filter(m => m.id !== id));
    setSelected(null);
  }

  function handleStatusChanged(id, newStatus) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus, is_read: true } : m));
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus, is_read: true } : prev);
  }

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] lg:h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
        <Inbox className="w-5 h-5 text-primary" />
        <h1
          className="font-heading font-black text-3xl md:text-4xl text-foreground uppercase"
          style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
        >
          INBOX
        </h1>
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="ml-auto text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: message list */}
        <div className={`
          flex flex-col border-r border-border bg-card overflow-y-auto
          ${selected ? "hidden lg:flex lg:w-80 xl:w-96 shrink-0" : "flex w-full lg:w-80 xl:w-96 shrink-0"}
        `}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Your inbox is empty</p>
            </div>
          ) : (
            <InboxMessageList
              messages={messages}
              selectedId={selected?.id}
              onSelect={(msg) => openMessage(msg)}
            />
          )}
        </div>

        {/* Right: message detail */}
        <div className={`
          flex-1 overflow-y-auto bg-background
          ${selected ? "flex flex-col" : "hidden lg:flex lg:flex-col"}
        `}>
          {selected ? (
            <>
              {/* Mobile back button */}
              <button
                className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm text-primary border-b border-border"
                onClick={() => setSelected(null)}
              >
                ← Back to inbox
              </button>
              <InboxMessageDetail
                message={selected}
                onDeleted={handleDeleted}
                onStatusChanged={handleStatusChanged}
                myClub={myClub}
                myEmail={user?.email}
                myGamertag={myPlayer?.gamertag}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Inbox className="w-16 h-16 text-muted-foreground/10 mb-4" />
              <p className="text-sm text-muted-foreground">Select a message to read it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}