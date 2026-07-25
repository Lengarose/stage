import { cn } from "@/lib/utils";

const OUTCOME_STYLE = {
  win: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  draw: "bg-secondary text-muted-foreground border-border",
  loss: "bg-destructive/10 text-destructive border-destructive/30",
};

function ratingStyle(value) {
  if (value >= 8) return "bg-amber-400/90 text-black border-amber-400/50";
  if (value >= 7) return "bg-emerald-500/80 text-black border-emerald-500/40";
  if (value >= 6) return "bg-primary/60 text-white border-primary/40";
  return "bg-secondary text-muted-foreground border-border";
}

export default function DashboardFormStrip({ label, mode = "outcome", items = [], emptyLabel }) {
  if (!items?.length) {
    return emptyLabel ? (
      <div>
        {label ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">{label}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    ) : null;
  }

  return (
    <div>
      {label ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">{label}</p>
      ) : null}
      <div className="flex gap-1.5 flex-wrap">
        {items.map((item, i) => {
          if (mode === "rating") {
            return (
              <span
                key={`${item}-${i}`}
                className={cn("w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-black", ratingStyle(item))}
              >
                {Number(item).toFixed(1)}
              </span>
            );
          }

          const outcome = String(item || "draw").toLowerCase();
          const letter = outcome === "win" ? "W" : outcome === "loss" ? "L" : "D";
          return (
            <span
              key={`${outcome}-${i}`}
              className={cn("w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-black", OUTCOME_STYLE[outcome] || OUTCOME_STYLE.draw)}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </div>
  );
}
