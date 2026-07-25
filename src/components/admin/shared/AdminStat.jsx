import DashboardGamerStatCard from "@/components/dashboard/DashboardGamerStatCard";

const ACCENT_MAP = {
  "text-destructive": "rose",
  "text-warning": "gold",
  "text-primary": "cyan",
  "text-success": "green",
  "text-sky-400": "cyan",
  "text-violet-400": "violet",
  "text-emerald-400": "green",
  "text-amber-400": "gold",
  "text-rose-400": "rose",
};

export default function AdminStat({ icon, label, value, color, accent: _accent, sub }) {
  return (
    <DashboardGamerStatCard
      label={label}
      value={value}
      sub={sub}
      accent={ACCENT_MAP[color] || "cyan"}
      icon={icon}
    />
  );
}
