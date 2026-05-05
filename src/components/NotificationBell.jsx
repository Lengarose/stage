import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { stageClient } from "@/api/stageClient";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let userEmail = null;

    async function init() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) return;
      const user = await stageClient.auth.me();
      if (!user?.email) return;
      userEmail = user.email;

      const notifications = await stageClient.entities.Notification.filter(
        { recipient_email: userEmail, read: false },
        "-created_date",
        100
      );
      setUnreadCount((notifications || []).length);
    }

    init();

    // Real-time subscription — no polling needed
    const unsub = stageClient.entities.Notification.subscribe((event) => {
      if (!userEmail) return;
      const email = event.data?.recipient_email;
      if (email && email !== userEmail) return;
      if (event.type === "create" && !event.data?.read) setUnreadCount(c => c + 1);
      if (event.type === "update" && event.data?.read === true) setUnreadCount(c => Math.max(0, c - 1));
      if (event.type === "delete" && !event.data?.read) setUnreadCount(c => Math.max(0, c - 1));
    });

    return () => unsub();
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