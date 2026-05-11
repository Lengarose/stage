import { cn } from "@/lib/utils";

export default function TestResultBadge({ status }) {
  const cfg = {
    pass:  { label: 'PASS',  cls: 'bg-success/20 text-success border-success/30' },
    fail:  { label: 'FAIL',  cls: 'bg-destructive/20 text-destructive border-destructive/30' },
    warn:  { label: 'WARN',  cls: 'bg-warning/20 text-warning border-warning/30' },
    error: { label: 'ERROR', cls: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  const c = cfg[status] || { label: '—', cls: 'bg-secondary text-muted-foreground border-border' };
  return <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border', c.cls)}>{c.label}</span>;
}
