import { Link } from "react-router-dom";
import { Bell, Coins, Mail, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const CLIP = { clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)" };

const GLANCE_SURFACE = {
  default: "border-cyan-300/20 bg-gradient-to-br from-[#070b14]/95 via-[#0a101c]/92 to-black/90",
  highlight: "border-cyan-300/35 bg-gradient-to-br from-cyan-950/75 via-[#061018]/95 to-black/90 shadow-[0_0_24px_-12px_rgba(0,229,255,0.8)]",
};

function GlanceCard({ to, icon: Icon, label, value, highlight = false }) {
  const body = (
    <div
      className={cn(
        "min-w-0 border px-4 py-3 flex items-center gap-3 transition-all backdrop-blur-md",
        highlight ? GLANCE_SURFACE.highlight : GLANCE_SURFACE.default,
        to && !highlight && "hover:border-cyan-200/35 hover:from-cyan-950/50",
      )}
      style={CLIP}
    >
      <div className={cn(
        "w-10 h-10 flex items-center justify-center shrink-0 border bg-black/50",
        highlight ? "text-cyan-300 border-cyan-300/30" : "text-white/55 border-white/15",
      )}
      style={{ clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)" }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">{label}</p>
        <p className="font-heading font-black text-xl text-white leading-none mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{value}</p>
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
