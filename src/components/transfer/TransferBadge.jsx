import { cn } from "@/lib/utils";

const BADGE_CONFIG = {
  free_agent:     { label: "Free Agent",            cls: "bg-success/10 text-success border-success/20" },
  expiring:       { label: "Expiring",               cls: "bg-warning/10 text-warning border-warning/20" },
  expiring_soon:  { label: "Expiring Soon",          cls: "bg-destructive/10 text-destructive border-destructive/20" },
  pending_offer:  { label: "Pending Offer",          cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  offer_accepted: { label: "Offer Accepted",         cls: "bg-primary/10 text-primary border-primary/20" },
  pending_window: { label: "Waiting for Window",     cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  under_contract: { label: "Under Contract",         cls: "bg-muted/60 text-muted-foreground border-border" },
};

export default function TransferBadge({ type, daysLeft }) {
  const cfg = BADGE_CONFIG[type];
  if (!cfg) return null;

  const label = (type === "expiring" || type === "expiring_soon") && daysLeft != null
    ? `${daysLeft}d left`
    : cfg.label;

  return (
    <span className={cn(
      "text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0",
      cfg.cls
    )}>
      {label}
    </span>
  );
}