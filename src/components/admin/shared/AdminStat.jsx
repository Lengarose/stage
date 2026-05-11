import { cn } from "@/lib/utils";

export default function AdminStat({ icon: Icon, label, value, color, accent }) {
  return (
    <div className={cn("bg-card border border-border border-l-2 rounded p-4", accent)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <p className={cn("font-heading font-black text-4xl leading-none", color)}>{value}</p>
    </div>
  );
}
