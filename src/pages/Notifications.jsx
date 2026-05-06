import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const TYPE_ICONS = {
  contract_offer:      "📋",
  contract_accepted:   "✅",
  contract_rejected:   "❌",
  contract_terminated: "🚫",
  contract_expired:    "⏰",
  contract_completed:  "🏆",
  match_scheduled:     "📅",
  match_result:        "⚽",
  match_reminder:      "⏰",
  result_submitted:    "📤",
  result_confirmed:    "✅",
  join_request:        "🙋",
  join_approved:       "✅",
  join_rejected:       "❌",
  club_update:         "🛡️",
  invite:              "📨",
  message:             "💬",
  tournament_start:    "🏆",
  tournament_complete: "🥇",
  announcement:        "📢",
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let userEmail = null;

    async function load() {
      const u = await stageClient.auth.me();
      setUser(u);
      userEmail = u.email;
      await fetchNotifications(u.email);
    }
    load();

    // Real-time subscription — only handle this user's notifications
    const unsub = stageClient.entities.Notification.subscribe((event) => {
      if (!userEmail) return;
      const email = event.data?.recipient_email;
      if (email && email !== userEmail) return;

      if (event.type === "create") {
        setNotifications(prev => [event.data, ...prev]);
      }
      if (event.type === "update") {
        setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
      }
      if (event.type === "delete") {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });

    return () => unsub();
  }, []);

  async function fetchNotifications(email) {
    setLoading(true);
    const data = await stageClient.entities.Notification.filter(
      { recipient_email: email },
      "-created_date",
      100
    );
    setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(notif) {
    if (notif.read) return;
    await stageClient.entities.Notification.update(notif.id, { read: true });
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
  }

  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => stageClient.entities.Notification.update(n.id, { read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function deleteNotif(id, e) {
    e.stopPropagation();
    await stageClient.entities.Notification.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function handleClick(notif) {
    markAsRead(notif);
    if (notif.link) {
      // Fix legacy "/messages" links → "/inbox"
      const link = notif.link.replace(/^\/messages/, "/inbox");
      navigate(link);
    }
  }

  async function deleteAll() {
    await Promise.all(notifications.map(n => stageClient.entities.Notification.delete(n.id)));
    setNotifications([]);
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <h1
            className="font-heading font-black text-4xl md:text-5xl text-foreground uppercase"
            style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
          >
            NOTIFICATIONS
          </h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-muted-foreground hover:text-foreground gap-2">
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {notifications.length} notification{notifications.length !== 1 ? "s" : ""}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      )}

      {/* Notification list */}
      <div className="space-y-2">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => handleClick(notif)}
            className={`
              relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group
              ${notif.read
                ? "bg-card border-border hover:border-primary/30"
                : "bg-primary/5 border-primary/20 hover:border-primary/40"
              }
            `}
          >
            {/* Unread dot */}
            {!notif.read && (
              <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
            )}

            {/* Icon */}
            <div className="text-2xl shrink-0 mt-0.5">
              {TYPE_ICONS[notif.type] || "🔔"}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-relaxed ${notif.read ? "text-foreground/80" : "text-foreground"}`}>
                {notif.title}
              </p>
              {notif.body && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
              )}
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notif.read && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAsRead(notif); }}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => deleteNotif(notif.id, e)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}