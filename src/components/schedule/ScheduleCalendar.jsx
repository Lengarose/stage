import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  format, parseISO, isValid, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay, isToday
} from "@/lib/momentDate";
import { ChevronLeft, ChevronRight, X, Trophy, FileText, Shield, Star } from "lucide-react";
import MatchDetail from "./MatchDetail";

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

function buildDateMap(events) {
  const map = new Map();
  events.forEach(ev => {
    if (ev.type === "contract_reminder") return; // inline reminder — no calendar date
    const d = parseDate(ev.date);
    if (!d) return;
    const key = format(d, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  });
  return map;
}

const OUTCOME_STYLE = {
  W: "text-success",
  L: "text-destructive",
  D: "text-warning",
};

const STATUS_BADGE = {
  scheduled:             { label: "Scheduled",  cls: "bg-primary/10 text-primary" },
  awaiting_confirmation: { label: "Pending",    cls: "bg-warning/10 text-warning" },
  completed:             { label: "FT",         cls: "bg-secondary text-muted-foreground" },
  forfeit:               { label: "Forfeit",    cls: "bg-destructive/10 text-destructive" },
  in_progress:           { label: "Live",       cls: "bg-success/10 text-success" },
  disputed:              { label: "Disputed",   cls: "bg-destructive/10 text-destructive" },
};

// Derive a player display name from a contract event
function contractPlayerName(ev, players) {
  const c = ev.contractData;
  if (!c) return null;
  // Try to find by player id stored in user_id
  if (players && c.user_id) {
    const p = players.find(pl => pl.id === c.user_id);
    if (p?.gamertag) return p.gamertag;
  }
  return null;
}

export default function ScheduleCalendar({ events, myPlayer, myClub, players = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);

  // Hover tooltip state
  const [tooltip, setTooltip] = useState(null); // { x, y, dayEvents, dayLabel }
  const tooltipTimeout = useRef(null);

  const dateMap = buildDateMap(events);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedEvents = selectedKey ? (dateMap.get(selectedKey) || []) : [];

  function handleDayClick(day) {
    const key = format(day, "yyyy-MM-dd");
    const dayEvents = dateMap.get(key) || [];
    setSelectedDate(day);
    setDetailEvent(null);
    if (dayEvents.length === 1) setDetailEvent(dayEvents[0]);
    setTooltip(null);
  }

  const handleMouseEnter = useCallback((e, day, dayEvents) => {
    if (dayEvents.length === 0) return;
    clearTimeout(tooltipTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY,
      dayEvents,
      dayLabel: format(day, "d MMM"),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 80);
  }, []);

  return (
    <div className="flex flex-col xl:flex-row gap-5">
      {/* ── Calendar grid ── */}
      <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-secondary/40">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-heading text-xl font-bold text-foreground uppercase tracking-widest">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map(d => (
            <div key={d} className="py-2 sm:py-3 text-center text-[9px] sm:text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {/* Day tiles — NO overflow-hidden so tooltips aren't clipped */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = dateMap.get(key) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const todayDay = isToday(day);
            const hasMatch = dayEvents.some(e => e.type === "match");
            const hasContract = dayEvents.some(e => e.type === "contract_end");
            const hasTournament = dayEvents.some(e => e.type === "tournament_start");

            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                onMouseEnter={e => handleMouseEnter(e, day, dayEvents)}
                onMouseLeave={handleMouseLeave}
                className={cn(
                  "relative min-h-[44px] sm:min-h-[72px] md:min-h-[90px] p-1 sm:p-2 md:p-3 border-b border-r border-border transition-all",
                  "flex flex-col items-center gap-0.5 sm:gap-1",
                  !isCurrentMonth && "opacity-25",
                  isSelected && "bg-primary/15 ring-1 ring-inset ring-primary/40",
                  !isSelected && dayEvents.length > 0 && "hover:bg-secondary/60",
                  !isSelected && dayEvents.length === 0 && "hover:bg-secondary/20 cursor-default",
                  (i + 1) % 7 === 0 && "border-r-0"
                )}
              >
                {/* Day number */}
                <span className={cn(
                  "text-[11px] sm:text-sm md:text-base font-semibold w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-colors leading-none",
                  todayDay && !isSelected && "bg-primary text-primary-foreground",
                  isSelected && !todayDay && "text-primary font-bold",
                  !todayDay && !isSelected && "text-foreground"
                )}>
                  {format(day, "d")}
                </span>

                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="flex items-center justify-center gap-0.5">
                    {hasMatch && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />}
                    {hasContract && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-warning" />}
                    {hasTournament && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent" />}
                  </div>
                )}

                {/* Inline event count label on larger tiles */}
                {dayEvents.length > 1 && (
                  <span className="hidden sm:block text-[9px] text-muted-foreground font-medium">
                    {dayEvents.length} events
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-border bg-secondary/20 flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Match</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-warning" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Contract End</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Tournament</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/40" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Today</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={cn(
        "xl:w-[400px] shrink-0 xl:sticky xl:top-6 xl:self-start",
        !selectedDate && "hidden xl:block"
      )}>
        {!selectedDate ? (
          <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center min-h-[300px] shadow-lg">
            <Trophy className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Click a date to see events</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
              <div>
                <p className="font-heading text-base font-bold text-foreground uppercase tracking-wide">
                  {format(selectedDate, "EEEE")}
                </p>
                <p className="text-xs text-muted-foreground">{format(selectedDate, "d MMMM yyyy")}</p>
              </div>
              <button
                onClick={() => { setSelectedDate(null); setDetailEvent(null); }}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No events on this day</p>
              </div>
            ) : detailEvent ? (
              <div>
                <button
                  onClick={() => setDetailEvent(null)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs text-primary hover:underline border-b border-border w-full text-left"
                >
                  ← Back to {format(selectedDate, "d MMM")}
                </button>
                <div className="p-4">
                  <MatchDetail event={detailEvent} myPlayer={myPlayer} myClub={myClub} />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {selectedEvents.map(ev => (
                  <DayEventRow key={ev.id} ev={ev} players={players} onClick={() => setDetailEvent(ev)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile slide-up ── */}
      {selectedDate && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedDate(null); setDetailEvent(null); }} />
          <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              {detailEvent ? (
                <button onClick={() => setDetailEvent(null)} className="text-xs text-primary">← Back</button>
              ) : (
                <p className="font-semibold text-foreground text-sm">{format(selectedDate, "EEEE d MMMM")}</p>
              )}
              <button onClick={() => { setSelectedDate(null); setDetailEvent(null); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {detailEvent ? (
                <div className="p-4">
                  <MatchDetail event={detailEvent} myPlayer={myPlayer} myClub={myClub} />
                </div>
              ) : selectedEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No events on this day</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedEvents.map(ev => (
                    <DayEventRow key={ev.id} ev={ev} players={players} onClick={() => setDetailEvent(ev)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Portal tooltip (always renders above everything) ── */}
      {tooltip && createPortal(
        <HoverTooltip
          tooltip={tooltip}
          players={players}
          onMouseEnter={() => clearTimeout(tooltipTimeout.current)}
          onMouseLeave={() => setTooltip(null)}
        />,
        document.body
      )}
    </div>
  );
}

/* ─── Portal Tooltip ─────────────────────────────────────────────────────── */
function HoverTooltip({ tooltip, players, onMouseEnter, onMouseLeave }) {
  const { x, y, dayEvents, dayLabel } = tooltip;
  const W = 224; // tooltip width px

  // Position above the tile, centred horizontally, clamped to viewport
  const left = Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8));
  const top = y - 8; // will be shifted up by translateY(-100%)

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "absolute",
        top,
        left,
        width: W,
        transform: "translateY(-100%)",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="bg-card border border-border rounded-xl shadow-2xl p-3 animate-in fade-in duration-100"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {dayLabel} · {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {dayEvents.slice(0, 4).map(ev => (
          <HoverEventCard key={ev.id} ev={ev} players={players} />
        ))}
        {dayEvents.length > 4 && (
          <p className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 4} more</p>
        )}
      </div>
    </div>
  );
}

/* ─── Hover event card ───────────────────────────────────────────────────── */
function HoverEventCard({ ev, players }) {
  if (ev.type === "tournament_start") {
    const t = ev.tournamentData;
    return (
      <div className="flex items-center gap-2">
        <Star className="w-3 h-3 text-accent shrink-0" />
        <span className="text-[11px] text-foreground truncate font-semibold">{t.name} — Starts</span>
      </div>
    );
  }
  if (ev.type === "contract_end") {
    const name = contractPlayerName(ev, players);
    return (
      <div className="flex items-center gap-2">
        <FileText className="w-3 h-3 text-warning shrink-0" />
        <span className="text-[11px] text-foreground truncate">
          {name ? `${name} contract ends` : "Contract End"}
        </span>
      </div>
    );
  }
  const m = ev.matchData;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-foreground truncate">{ev.opposition || "TBD"}</span>
        {ev.result && (
          <span className={cn("text-[10px] font-bold ml-auto shrink-0", OUTCOME_STYLE[ev.result.outcome])}>
            {ev.result.display}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground truncate">{ev.competition}</p>
      {m?.scheduled_date && (
        <p className="text-[10px] text-muted-foreground">
          {format(parseISO(m.scheduled_date), "HH:mm")} · {ev.venue}
        </p>
      )}
    </div>
  );
}

/* ─── Day event row (right panel / mobile) ───────────────────────────────── */
function DayEventRow({ ev, players, onClick }) {
  if (ev.type === "tournament_start") {
    const t = ev.tournamentData;
    const startTime = t.start_date ? format(parseISO(t.start_date), "HH:mm") : null;
    const now = new Date();
    const startDate = t.start_date ? parseISO(t.start_date) : null;
    const diffMs = startDate ? startDate - now : null;
    const diffDays = diffMs !== null ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : null;
    const countdown = diffDays !== null && diffDays > 0 ? `In ${diffDays} day${diffDays !== 1 ? "s" : ""}` : diffDays === 0 ? "Today!" : null;
    return (
      <div className="w-full text-left px-5 py-4 flex items-center gap-3 bg-accent/5 border-l-2 border-accent">
        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">Tournament Start</span>
            {startTime && <span className="text-[10px] text-muted-foreground">{startTime}</span>}
            {t.platform && <span className="text-[10px] text-muted-foreground/60">{t.platform}</span>}
          </div>
        </div>
        {countdown && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-medium shrink-0">{countdown}</span>
        )}
      </div>
    );
  }
  if (ev.type === "contract_end") {
    const c = ev.contractData;
    const name = contractPlayerName(ev, players);
    return (
      <button onClick={onClick} className="w-full text-left px-5 py-4 hover:bg-secondary/40 transition-colors flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {name ? `${name} contract ends` : "Contract End"}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{c?.contract_type} · {c?.max_games} games</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning font-medium shrink-0">End</span>
      </button>
    );
  }

  const m = ev.matchData;
  const resultColor = ev.result
    ? ev.result.outcome === "W" ? "text-success" : ev.result.outcome === "L" ? "text-destructive" : "text-warning"
    : "";
  const badge = STATUS_BADGE[m?.status] || { label: m?.status, cls: "bg-secondary text-muted-foreground" };

  const oppLogoUrl = ev.isHome ? ev.awayAvatarUrl : ev.homeAvatarUrl;
  const isClubMatch = !!(ev.matchData?.home_club_id || ev.matchData?.away_club_id);

  return (
    <button onClick={onClick} className="w-full text-left px-5 py-4 hover:bg-secondary/40 transition-colors flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
        {isClubMatch && oppLogoUrl
          ? <img src={oppLogoUrl} alt={ev.opposition} className="w-full h-full object-cover" style={{ objectPosition: "50% 50%" }} />
          : <Shield className="w-4 h-4 text-primary" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{ev.opposition || "TBD"}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {m?.scheduled_date && (
            <span className="text-[10px] text-muted-foreground">{format(parseISO(m.scheduled_date), "HH:mm")}</span>
          )}
          <span className={cn("text-[10px] font-medium", ev.venue === "Home" ? "text-primary" : "text-muted-foreground")}>
            {ev.venue}
          </span>
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[140px]">{ev.competition}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {ev.result ? (
          <span className={cn("text-sm font-bold", resultColor)}>{ev.result.display}</span>
        ) : (
          <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", badge.cls)}>{badge.label}</span>
        )}
      </div>
    </button>
  );
}