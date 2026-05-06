import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { stageClient } from "@/api/stageClient";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let userEmail = null;
    let intervalId = null;
    let stopped = false;

    async function refreshUnread() {
      if (!userEmail || stopped) return;
      try {
        const notifications = await stageClient.entities.Notification.filter(
          { recipient_email: userEmail, read: false },
          "-created_date",
          100
        );
        if (!stopped) setUnreadCount((notifications || []).length);
      } catch {
        // non-fatal
      }
    }

    async function init() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) return;
      const user = await stageClient.auth.me();
      if (!user?.email) return;
      userEmail = user.email;
      await refreshUnread();
      // Fallback strategy: poll because stageClient.subscribe is a compatibility stub.
      intervalId = window.setInterval(refreshUnread, 15000);
    }

    init();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };
    window.addEventListener("focus", refreshUnread);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshUnread);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <Link to="/notifications" className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}