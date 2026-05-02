import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
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
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const user = await base44.auth.me();
      if (!user?.email) { setLoading(false); return; }

      const data = await base44.entities.InboxMessage.filter(
        { recipient_email: user.email },
        "-created_date",
        6
      );
      setMessages(data || []);
      setUnreadCount((data || []).filter(m => !m.is_read).length);
      setLoading(false);
    }
    load();

    const unsub = base44.entities.InboxMessage.subscribe((event) => {
      if (event.type === "create") {
        setMessages(prev => [event.data, ...prev].slice(0, 6));
        setUnreadCount(c => c + 1);
      }
      if (event.type === "update") {
        setMessages(prev => {
          const existing = prev.find(m => m.id === event.id);
          // Only decrement if it was previously unread and is now read
          if (existing && !existing.is_read && event.data?.is_read) {
            setUnreadCount(c => Math.max(0, c - 1));
          }
          return prev.map(m => m.id === event.id ? event.data : m);
        });
      }
      if (event.type === "delete") {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
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