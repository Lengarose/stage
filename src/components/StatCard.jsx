import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, trend, className }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        {trend && (
          <span className={cn("text-xs font-medium px-2 py-1 rounded-full", 
            trend > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl leading-relaxed font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}