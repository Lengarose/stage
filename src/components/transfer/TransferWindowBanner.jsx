import { CheckCircle, AlertCircle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TransferWindowBanner({ window: currentWindow }) {
  const isOpen = currentWindow?.status === "open";

  return (
    <div className={cn(
      "rounded-2xl border p-4 flex items-center gap-4",
      isOpen
        ? "bg-success/10 border-success/30"
        : "bg-secondary/60 border-border"
    )}>
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
        isOpen ? "bg-success/20" : "bg-muted"
      )}>
        {isOpen
          ? <CheckCircle className="w-5 h-5 text-success" />
          : <AlertCircle className="w-5 h-5 text-muted-foreground" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-sm", isOpen ? "text-success" : "text-foreground")}>
          Transfer Window: {isOpen ? "OPEN" : "CLOSED"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {currentWindow?.label && <span className="font-medium">{currentWindow.label} · </span>}
          {isOpen && currentWindow?.end_date
            ? `Open until ${new Date(currentWindow.end_date).toLocaleDateString()}`
            : !isOpen && currentWindow
            ? "Contracts accepted now will execute when the next window opens."
            : !currentWindow
            ? "No transfer window has been scheduled yet."
            : null}
        </p>
      </div>

      {!isOpen && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5 border border-border shrink-0 hidden sm:flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" />
          Offers queue until window opens
        </div>
      )}
    </div>
  );
}