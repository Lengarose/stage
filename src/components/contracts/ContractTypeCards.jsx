import { cn } from "@/lib/utils";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/contractTypes";
import { Gamepad2, Clock } from "lucide-react";

export default function ContractTypeCards({ selectedType, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {CONTRACT_TYPE_OPTIONS.map((opt) => {
        const isSelected = selectedType === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "relative rounded-xl border-2 p-5 text-left transition-all",
              isSelected
                ? `${opt.bg} ${opt.border} ring-1 ring-offset-1 ring-offset-background`
                : "bg-card border-border hover:border-primary/20"
            )}
            style={isSelected ? { ringColor: `var(--${opt.color})` } : undefined}
          >
            {isSelected && (
              <div className={cn(
                "absolute top-3 right-3 w-3 h-3 rounded-full",
                opt.color.replace("text-", "bg-")
              )} />
            )}

            <p className={cn(
              "font-heading text-lg uppercase tracking-wide",
              isSelected ? opt.color : "text-foreground"
            )}>
              {opt.label}
            </p>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                <span>{opt.max_games} games</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{opt.max_days} days</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}