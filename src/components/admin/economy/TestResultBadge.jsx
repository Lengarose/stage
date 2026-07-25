import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export default function TestResultBadge({ status }) {
  const { t } = useTranslation();
  const cfg = {
    pass:  { label: t("admin.economy.testStatus.pass"),  cls: 'bg-success/20 text-success border-success/30' },
    fail:  { label: t("admin.economy.testStatus.fail"),  cls: 'bg-destructive/20 text-destructive border-destructive/30' },
    warn:  { label: t("admin.economy.testStatus.warn"),  cls: 'bg-warning/20 text-warning border-warning/30' },
    error: { label: t("admin.economy.testStatus.error"), cls: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  const c = cfg[status] || { label: '—', cls: 'bg-secondary text-muted-foreground border-border' };
  return <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border', c.cls)}>{c.label}</span>;
}
