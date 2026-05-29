import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { formatDistanceToNow } from "@/lib/momentDate";
import { Inbox, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomeInboxPanel() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      // Small delay to avoid rate-limiting burst on page load
      await new Promise(r => setTimeout(r, 300));
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const user = await stageClient.auth.me();
      if (!user?.email) { setLoading(false); return; }

      const data = await stageClient.entities.InboxMessage.filter(
        { recipient_email: user.email },
        "-created_date",
        6
      );
      setMessages(data || []);
      setUnreadCount((data || []).filter(m => !m.is_read).length);
      setLoading(false);
    }
    load();

    // Defensive upsert: stageClient.subscribe only knows ids it has seen via
    // the socket, so an update broadcast for an initially-fetched message
    // arrives as type="create". Without an id-check the old logic prepended
    // the same row again and double-counted the unread badge.
    const unsub = stageClient.entities.InboxMessage.subscribe((event) => {
      if (event.type === "delete") {
        setMessages(prev => {
          const wasUnread = prev.find(m => m.id === event.id && !m.is_read);
          if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
          return prev.filter(m => m.id !== event.id);
        });
        return;
      }
      const incoming = event.data;
      if (!incoming?.id) return;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === incoming.id);
        if (idx >= 0) {
          const existing = prev[idx];
          // Adjust unread badge based on read-state transitions only.
          if (!existing.is_read && incoming.is_read) {
            setUnreadCount(c => Math.max(0, c - 1));
          } else if (existing.is_read && !incoming.is_read) {
            setUnreadCount(c => c + 1);
          }
          const next = prev.slice();
          next[idx] = incoming;
          return next;
        }
        if (!incoming.is_read) setUnreadCount(c => c + 1);
        return [incoming, ...prev].slice(0, 6);
      });
    });

    return () => unsub();
  }, []);

  if (loading) return null;
  if (messages.length === 0) return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
      No messages
    </div>
  );

  return (
    <div className="space-y-0 divide-y divide-border rounded-xl overflow-hidden border border-border">
      {messages.map((msg) => (
        <button
          key={msg.id}
          onClick={() => navigate(`/inbox?id=${msg.id}`)}
          className={cn(
            "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors",
            !msg.is_read && "bg-primary/[0.04]"
          )}
        >
          {/* Avatar */}
          <div className="shrink-0">
            {msg.is_system ? (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm">⚡</div>
            ) : msg.sender_avatar_url ? (
              <img src={msg.sender_avatar_url} alt={msg.sender_gamertag} className="w-8 h-8 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground">
                {(msg.sender_gamertag || "?")[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-xs truncate", !msg.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                {msg.is_system ? "STAGE System" : (msg.sender_gamertag || "Unknown")}
              </span>
              {!msg.is_read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
            </div>
            <p className={cn("text-xs truncate", !msg.is_read ? "text-foreground" : "text-muted-foreground")}>
              {msg.subject}
            </p>
          </div>

          {/* Time */}
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            {formatDistanceToNow(new Date(msg.created_date), { addSuffix: false })}
          </span>
        </button>
      ))}

      <Link
        to="/inbox"
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-card"
      >
        View all messages <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}