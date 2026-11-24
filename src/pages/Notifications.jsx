import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2, RefreshCw, ArrowUpRight, FileText, Trophy, CalendarDays, MessageSquare, Shield } from "lucide-react";
import "./notifications.css";
import { formatDistanceToNow } from "@/lib/momentDate";
import { useTranslation } from "@/hooks/useTranslation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

function notificationIcon(type = "") {
  if (/contract|transfer/.test(type)) return FileText;
  if (/tournament|league|cup|reward/.test(type)) return Trophy;
  if (/match|result|schedule|reminder/.test(type)) return CalendarDays;
  if (/club|join|invite/.test(type)) return Shield;
  if (/message|chat/.test(type)) return MessageSquare;
  return Bell;
}

function emitNotificationsRead(ids) {
  const readIds = ids.filter(Boolean);
  if (!readIds.length) return;
  window.dispatchEvent(new CustomEvent("stage:notifications-read", {
    detail: { ids: readIds, count: readIds.length },
  }));
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    let userEmail = null;
    let intervalId = null;
    let stopped = false;

    async function load() {
      const u = await stageClient.auth.me();
      if (stopped) return;
      userEmail = String(u.email || "").trim().toLowerCase();
      await fetchNotifications(userEmail);
      // Fallback polling if realtime misses events.
      intervalId = window.setInterval(() => {
        if (!stopped && userEmail) fetchNotifications(userEmail).catch(err => setError(err.message || "Unable to refresh notifications."));
      }, 15000);
    }
    load().catch(err => { if (!stopped) { setError(err.message || "Unable to load notifications."); setLoading(false); } });

    // Real-time subscription — only handle this user's notifications
    const unsub = stageClient.entities.Notification.subscribe((event) => {
      if (!userEmail) return;
      const email = String(event.data?.recipient_email || "").trim().toLowerCase();
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

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
      unsub();
    };
  }, []);

  async function fetchNotifications(email) {
    const data = await stageClient.entities.Notification.filter(
      { recipient_email: email },
      "-created_date",
      100
    );
    setNotifications(data || []);
    setError("");
    setLoading(false);
  }

  async function markAsRead(notif) {
    if (notif.read) return true;
    try {
      const updated = await stageClient.http.post(`/notifications/${notif.id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, ...updated, read: true } : n));
      emitNotificationsRead([notif.id]);
      return true;
    } catch (err) { setError(err.message || "Unable to mark notification as read."); return false; }
  }

  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length || busy) return;
    setBusy(true);
    setError("");
    await Promise.all(unread.map(markAsRead));
    setBusy(false);
  }

  async function deleteNotif(id) {
    const wasUnread = notifications.some(n => n.id === id && !n.read);
    try {
      await stageClient.entities.Notification.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) emitNotificationsRead([id]);
    } catch (err) { setError(err.message || "Unable to delete notification."); }
  }

  async function openNotification(notif) {
    if (!await markAsRead(notif)) return;
    if (notif.link) {
      // Fix legacy "/messages" links → "/inbox"
      const link = notif.link.replace(/^\/messages/, "/inbox");
      navigate(link);
    }
  }

  async function deleteAll() {
    if (busy) return;
    setBusy(true);
    setError("");
    await Promise.all(notifications.map(n => deleteNotif(n.id)));
    setBusy(false);
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const visible = notifications.filter(n => filter === "all" || !n.read);

  return (
    <div className="stage-notifications landing-v2">
      <header className="notifications-heading">
        <div><p className="notifications-eyebrow">STAGE / ACTIVITY CENTRE</p>
          <h1>{t("commonPages.notifTitle")}<span className="notifications-square" aria-hidden="true" /></h1>
          <p>Your matches. Your club. Every important update.</p>
        </div>
        <div className="notifications-summary"><span>{unreadCount}</span><p>Unread<br />notifications</p></div>
      </header>
      <section className="notifications-panel" aria-label="Your notifications">
        <div className="notifications-toolbar">
          <div className="notifications-tabs" aria-label="Notification filters">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All activity <span>{notifications.length}</span></button>
            <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Unread <span>{unreadCount}</span></button>
          </div>
          <div className="notifications-actions">
            <button type="button" disabled={!unreadCount || busy} onClick={markAllAsRead}><CheckCheck size={16} />{t("commonPages.notifMarkAllRead")}</button>
            <AlertDialog>
              <AlertDialogTrigger asChild><button type="button" disabled={!notifications.length || busy}><Trash2 size={16} />{t("commonPages.notifDeleteAll")}</button></AlertDialogTrigger>
              <AlertDialogContent className="notifications-confirm landing-v2 rounded-none border-white/20 bg-[#0b1423] text-white">
                <AlertDialogHeader><AlertDialogTitle>{t("commonPages.notifDeleteAllConfirmTitle")}</AlertDialogTitle><AlertDialogDescription className="text-white/65">{t("commonPages.notifDeleteAllConfirmDesc", { count: notifications.length })}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel className="rounded-none">{t("commonPages.cancel")}</AlertDialogCancel><AlertDialogAction onClick={deleteAll} className="rounded-none bg-blue-500 text-white">{t("commonPages.notifDeleteAll")}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {error && <div role="alert" className="notifications-error">{error}<button type="button" onClick={() => { setLoading(true); stageClient.auth.me().then(u => fetchNotifications(u.email)).catch(err => { setError(err.message); setLoading(false); }); }}>Retry</button></div>}
        {loading ? <div className="notifications-empty" role="status"><RefreshCw className="animate-spin" /><p>Loading notifications…</p></div> : visible.length === 0 ? <div className="notifications-empty"><Bell size={30} /><h2>{filter === "unread" ? "You're all caught up." : "Your activity starts here."}</h2><p>{filter === "unread" ? "No unread notifications. Switch to All activity to browse earlier updates." : t("commonPages.notifEmpty")}</p></div> :
          <ul className="notifications-list">{visible.map(notif => {
            const Icon = notificationIcon(notif.type);
            return <li key={notif.id} className={`notification-row ${notif.read ? "is-read" : "is-unread"}`}>
              <div className="notification-type" aria-hidden="true"><Icon size={20} /></div>
              <button type="button" className="notification-content" onClick={() => openNotification(notif)}>
                <span className="notification-title">{notif.title}</span>
                {notif.body && <span className="notification-body">{notif.body}</span>}
                <span className="notification-time">{formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}{!notif.read && <span className="notification-unread">Unread</span>}</span>
              </button>
              <div className="notification-row-actions">
                {!notif.read && <button type="button" onClick={() => markAsRead(notif)} aria-label={t("commonPages.notifMarkAsRead")} title={t("commonPages.notifMarkAsRead")}><Check size={16} /></button>}
                <button type="button" onClick={() => deleteNotif(notif.id)} aria-label={t("commonPages.delete")} title={t("commonPages.delete")}><Trash2 size={16} /></button>
                {notif.link && <button type="button" onClick={() => openNotification(notif)} aria-label={`Open ${notif.title}`}><ArrowUpRight size={17} /></button>}
              </div>
            </li>;
          })}</ul>}
        <footer className="notifications-footer">Showing your latest {notifications.length} notifications <span>Updates refresh automatically</span></footer>
      </section>
    </div>
  );
}
