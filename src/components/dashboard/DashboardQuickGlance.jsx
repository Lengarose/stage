import { Link } from "react-router-dom";
import { Bell, Coins, Mail, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

function GlanceCard({ to, icon: Icon, label, value, highlight = false }) {
  const body = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 transition-colors",
        to && "hover:border-primary/30"
      )}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", highlight ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <p className="font-heading font-black text-xl text-foreground leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block min-w-0">{body}</Link>;
  }
  return body;
}

function formatStc(value) {
  return Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export default function DashboardQuickGlance({ glance }) {
  const { t } = useTranslation();
  if (!glance) return null;

  const unreadTotal = (glance.unreadInbox || 0) + (glance.unreadNotifications || 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <GlanceCard
        to="/store"
        icon={Coins}
        label={t("commonPages.dashboardGlanceStc")}
        value={formatStc(glance.stc)}
      />
      <GlanceCard
        to="/store"
        icon={Store}
        label={t("commonPages.dashboardGlanceCredits")}
        value={formatStc(glance.credits)}
      />
      <GlanceCard
        to="/inbox"
        icon={Mail}
        label={t("commonPages.dashboardGlanceInbox")}
        value={glance.unreadInbox || 0}
        highlight={(glance.unreadInbox || 0) > 0}
      />
      <GlanceCard
        to="/notifications"
        icon={Bell}
        label={t("commonPages.dashboardGlanceAlerts")}
        value={unreadTotal}
        highlight={unreadTotal > 0}
      />
    </div>
  );
}
