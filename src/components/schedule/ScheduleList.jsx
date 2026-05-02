import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { AlertTriangle, FileText, ChevronRight } from "lucide-react";

function fmtDate(d) {
  if (!d) return "—";
  const parsed = typeof d === "string" ? parseISO(d) : new Date(d);
  if (!isValid(parsed)) return "—";
  return format(parsed, "dd MMM yyyy");
}
function fmtTime(d) {
  if (!d) return "—";
  const parsed = typeof d === "string" ? parseISO(d) : new Date(d);
  if (!isValid(parsed)) return "—";
  return format(parsed, "HH:mm");
}

const STATUS_LABEL = {
  scheduled:             { label: "Scheduled", cls: "text-primary bg-primary/10" },
  in_progress:           { label: "Live",      cls: "text-success bg-success/10 animate-pulse" },
  awaiting_confirmation: { label: "Pending",   cls: "text-warning bg-warning/10" },
  disputed:              { label: "Disputed",  cls: "text-destructive bg-destructive/10" },
  completed:             { label: "FT",        cls: "text-muted-foreground bg-secondary" },
  forfeit:               { label: "Forfeit",   cls: "text-destructive bg-destructive/10" },
};

export default function ScheduleList({ events, selectedId, onSelect }) {
  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-muted-foreground text-sm">No scheduled matches yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Desktop table header (hidden on mobile) ── */}
      <div className="hidden lg:grid grid-cols-[90px_70px_1fr_80px_70px_1fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        <span>Date</span>
        <span>Time</span>
        <span>Opposition</span>
        <span className="text-center">Venue</span>
        <span className="text-center">Result</span>
        <span>Competition</span>
      </div>

      {/* ── Mobile column headers ── */}
      <div className="lg:hidden grid grid-cols-[1fr_auto] gap-2 px-4 py-2 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        <span>Match</span>
        <span className="text-right">Result / Status</span>
      </div>

      <div className="divide-y divide-border">
        {events.map(ev => {
          if (ev.type === "contract_end")
            return <ContractEndRow key={ev.id} ev={ev} selected={selectedId === ev.id} onClick={() => onSelect(ev)} />;
          if (ev.type === "contract_reminder")
            return <ContractReminderRow key={ev.id} ev={ev} selected={selectedId === ev.id} onClick={() => onSelect(ev)} />;
          return <MatchRow key={ev.id} ev={ev} selected={selectedId === ev.id} onClick={() => onSelect(ev)} />;
        })}
      </div>
    </div>
  );
}

function MatchRow({ ev, selected, onClick }) {
  const status = STATUS_LABEL[ev.status] || { label: ev.status, cls: "text-muted-foreground bg-secondary" };
  const resultColor = !ev.result ? "" :
    ev.result.outcome === "W" ? "text-success font-bold" :
    ev.result.outcome === "L" ? "text-destructive font-bold" :
    "text-warning font-bold";

  return (
    <>
      {/* ── Desktop row ── */}
      <div
        onClick={onClick}
        className={cn(
          "hidden lg:grid grid-cols-[90px_70px_1fr_80px_70px_1fr] gap-2 px-4 py-3 cursor-pointer transition-all text-sm items-center",
          selected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        <span className="text-xs text-foreground">{fmtDate(ev.date)}</span>
        <span className="text-xs text-muted-foreground">{fmtTime(ev.date)}</span>
        <span className="font-medium text-foreground truncate">{ev.opposition || <span className="italic text-muted-foreground">TBD</span>}</span>
        <span className={cn("text-center text-xs font-medium", ev.venue === "Home" ? "text-primary" : "text-muted-foreground")}>
          {ev.venue || "—"}
        </span>
        <span className={cn("text-center text-xs", resultColor)}>
          {ev.result ? ev.result.display : (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", status.cls)}>{status.label}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground truncate">{ev.competition || "—"}</span>
      </div>

      {/* ── Mobile card row ── */}
      <div
        onClick={onClick}
        className={cn(
          "lg:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all",
          selected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        {/* Date block */}
        <div className="shrink-0 w-12 text-center">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold leading-none">
            {ev.date ? format(parseISO(ev.date), "MMM") : "—"}
          </p>
          <p className="text-lg font-bold text-foreground leading-tight">
            {ev.date ? format(parseISO(ev.date), "dd") : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none">
            {fmtTime(ev.date)}
          </p>
        </div>

        {/* Vertical divider */}
        <div className="w-px h-10 bg-border shrink-0" />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {ev.opposition || <span className="italic text-muted-foreground">TBD</span>}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn("text-[10px] font-medium", ev.venue === "Home" ? "text-primary" : "text-muted-foreground")}>
              {ev.venue || "—"}
            </span>
            {ev.competition && (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[140px]">{ev.competition}</span>
            )}
          </div>
        </div>

        {/* Result / status */}
        <div className="shrink-0 flex items-center gap-1.5">
          {ev.result ? (
            <span className={cn("text-sm font-bold", resultColor)}>{ev.result.display}</span>
          ) : (
            <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", status.cls)}>{status.label}</span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      </div>
    </>
  );
}

function ContractEndRow({ ev, selected, onClick }) {
  return (
    <>
      {/* Desktop */}
      <div
        onClick={onClick}
        className={cn(
          "hidden lg:grid grid-cols-[90px_70px_1fr_80px_70px_1fr] gap-2 px-4 py-3 cursor-pointer transition-all items-center",
          selected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        <span className="text-xs text-foreground">{fmtDate(ev.date)}</span>
        <span className="text-xs text-muted-foreground">—</span>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground font-medium capitalize">Contract End · {ev.contractData?.contract_type}</span>
        </div>
        <span className="text-center text-xs text-muted-foreground">—</span>
        <span className="text-center text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">End</span>
        <span className="text-xs text-muted-foreground">Contract</span>
      </div>

      {/* Mobile */}
      <div
        onClick={onClick}
        className={cn(
          "lg:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all",
          selected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        <div className="shrink-0 w-12 text-center">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold">{ev.date ? format(parseISO(ev.date), "MMM") : "—"}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{ev.date ? format(parseISO(ev.date), "dd") : "—"}</p>
        </div>
        <div className="w-px h-10 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate capitalize">Contract End · {ev.contractData?.contract_type}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Contract</p>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">End</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      </div>
    </>
  );
}

function ContractReminderRow({ ev, selected, onClick }) {
  return (
    <>
      {/* Desktop */}
      <div
        onClick={onClick}
        className={cn(
          "hidden lg:grid grid-cols-[90px_70px_1fr_80px_70px_1fr] gap-2 px-4 py-3 cursor-pointer transition-all items-center",
          selected ? "bg-warning/10 border-l-2 border-l-warning" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        <span className="text-xs text-foreground">{fmtDate(ev.date)}</span>
        <span className="text-xs text-muted-foreground">—</span>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="text-xs text-warning font-medium">Contract Expiring Soon</span>
        </div>
        <span className="text-center text-xs text-muted-foreground">—</span>
        <span className="text-center text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">!</span>
        <span className="text-xs text-muted-foreground">Contract</span>
      </div>

      {/* Mobile */}
      <div
        onClick={onClick}
        className={cn(
          "lg:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all",
          selected ? "bg-warning/10 border-l-2 border-l-warning" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
        )}
      >
        <div className="shrink-0 w-12 text-center">
          <AlertTriangle className="w-5 h-5 text-warning mx-auto" />
        </div>
        <div className="w-px h-10 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warning truncate">Contract Expiring Soon</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Tap to see details</p>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning font-bold">!</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      </div>
    </>
  );
}