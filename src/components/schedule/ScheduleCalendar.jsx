import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  format, parseISO, isValid, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isToday,
} from "@/lib/momentDate";
import {
  ChevronLeft, ChevronRight, ChevronDown, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MatchDetail from "./MatchDetail";
import { COMPETITIONS } from "@/lib/competitionUtils";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

function buildDateMap(events) {
  const map = new Map();
  events.forEach((ev) => {
    if (ev.type === "contract_reminder") return;
    const d = parseDate(ev.date);
    if (!d) return;
    const key = format(d, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  });
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ta = parseDate(a.date)?.getTime() || 0;
      const tb = parseDate(b.date)?.getTime() || 0;
      return ta - tb;
    });
  }
  return map;
}

function resolveGostSlug(ev = {}) {
  const raw = String(ev.competitionSlug || ev.competition_slug || "").toLowerCase().trim();
  if (COMPETITIONS.some((c) => c.slug === raw)) return raw;
  const name = String(ev.competition || ev.competition_name || "").toLowerCase();
  if (name.includes("supreme")) return "supreme";
  if (name.includes("elite")) return "elite";
  if (name.includes("challenger")) return "challenger";
  return null;
}

function shortName(name = "", max = 18) {
  const cleaned = String(name || "").trim() || "TBD";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

/** FM-style solid match block colours */
function matchBlockStyle(ev) {
  if (ev.type === "contract_end") {
    return {
      bg: "linear-gradient(90deg,#3b2a08,#5c4210)",
      label: "Contract",
      accent: "#FBBF24",
    };
  }
  if (ev.type === "tournament_start") {
    return {
      bg: "linear-gradient(90deg,#2a1548,#4c1d95)",
      label: "Tournament",
      accent: "#C084FC",
    };
  }

  const slug = resolveGostSlug(ev);
  if (slug === "supreme") {
    return {
      bg: "linear-gradient(90deg,#0c4a6e,#0369a1)",
      label: "Supreme",
      accent: "#38BDF8",
    };
  }
  if (slug === "elite") {
    return {
      bg: "linear-gradient(90deg,#1e3a8a,#4338ca)",
      label: "Elite",
      accent: "#A5B4FC",
    };
  }
  if (slug === "challenger") {
    return {
      bg: "linear-gradient(90deg,#14532d,#166534)",
      label: "Challenger",
      accent: "#4ADE80",
    };
  }
  if (ev.source === "regional" || /regional|league/i.test(String(ev.competition || ""))) {
    return {
      bg: "linear-gradient(90deg,#7f1d1d,#991b1b)",
      label: shortName(String(ev.competition || "Regional").replace(/^STAGE\s+/i, ""), 16),
      accent: "#FCA5A5",
    };
  }
  return {
    bg: "linear-gradient(90deg,#881337,#9f1239)",
    label: shortName(String(ev.competition || "Match").replace(/^STAGE\s+/i, ""), 16),
    accent: "#FDA4AF",
  };
}

function homeAwayNames(ev) {
  if (ev.homeName || ev.awayName) {
    return { home: ev.homeName || "TBD", away: ev.awayName || "TBD" };
  }
  const m = ev.matchData;
  if (m) {
    return {
      home: m.home_club_name || m.home_player_name || "TBD",
      away: m.away_club_name || m.away_player_name || "TBD",
    };
  }
  if (ev.opposition) {
    return {
      home: ev.isHome ? (ev.myClubName || "You") : ev.opposition,
      away: ev.isHome ? ev.opposition : (ev.myClubName || "You"),
    };
  }
  return { home: "TBD", away: "TBD" };
}

function timeOrScore(ev) {
  if (ev.result?.display) return ev.result.display;
  const m = ev.matchData;
  if (m && ["completed", "awaiting_confirmation", "played"].includes(String(m.status || "")) && m.home_score != null) {
    return `${m.home_score}-${m.away_score}`;
  }
  if (ev.homeScore != null && ev.awayScore != null) {
    const st = String(ev.status || "").toLowerCase();
    if (["played", "completed", "finished"].includes(st) || Number(ev.homeScore) + Number(ev.awayScore) > 0) {
      return `${ev.homeScore}-${ev.awayScore}`;
    }
  }
  const d = parseDate(ev.date);
  if (d) {
    const hm = format(d, "HH:mm");
    if (hm !== "00:00") return hm;
  }
  if (ev.matchday) return `MD${ev.matchday}`;
  return "TBD";
}

function venueLetter(ev, myClubId) {
  if (ev.venueKey === "home" || ev.venue === "Home") return "H";
  if (ev.venueKey === "away" || ev.venue === "Away") return "A";
  if (myClubId && ev.matchData) {
    if (String(ev.matchData.home_club_id) === String(myClubId)) return "H";
    if (String(ev.matchData.away_club_id) === String(myClubId)) return "A";
  }
  return "";
}

function MatchBlock({ ev, myClub, onClick }) {
  const style = matchBlockStyle(ev);
  const { home, away } = homeAwayNames(ev);
  const opp = myClub?.id
    ? (String(ev.matchData?.home_club_id || ev.fixtureData?.home_club_id) === String(myClub.id) ? away : home)
    : away;
  const venue = venueLetter(ev, myClub?.id);
  const when = timeOrScore(ev);

  if (ev.type === "contract_end" || ev.type === "tournament_start") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-[3px] px-1.5 py-1 text-left text-[10px] font-semibold text-white shadow-sm"
        style={{ background: style.bg }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate" style={{ color: style.accent }}>{style.label}</span>
          <span className="shrink-0 tabular-nums text-white/80">{when}</span>
        </div>
        <p className="truncate font-bold text-white">
          {ev.type === "tournament_start" ? (ev.tournamentData?.name || ev.competition) : "Contract ends"}
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[3px] px-1.5 py-1 text-left shadow-sm transition hover:brightness-110"
      style={{ background: style.bg }}
      title={`${home} vs ${away}`}
    >
      <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wide text-white/85">
        <span className="truncate">{style.label}</span>
        <span className="shrink-0 tabular-nums">{when}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1">
        <p className="truncate text-[11px] font-bold leading-tight text-white">
          {shortName(opp || away, 16)}
        </p>
        <span className="shrink-0 text-[9px] font-black text-white/70">
          {venue}
        </span>
      </div>
      <p className="truncate text-[9px] leading-tight text-white/55">
        {shortName(home, 12)} vs {shortName(away, 12)}
      </p>
    </button>
  );
}

export default function ScheduleCalendar({ events, myPlayer, myClub, fullScreen = true }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailEvent, setDetailEvent] = useState(null);
  const [filter, setFilter] = useState("all");
  const [didAutoJump, setDidAutoJump] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  const openMonthPicker = (open) => {
    if (open) setPickerYear(currentMonth.getFullYear());
    setMonthPickerOpen(open);
  };

  const selectMonth = (monthIndex) => {
    setCurrentMonth(new Date(pickerYear, monthIndex, 1));
    setMonthPickerOpen(false);
  };

  const filteredEvents = useMemo(() => {
    return (events || []).filter((ev) => {
      if (filter === "gost") {
        return ev.type === "match" && (ev.source === "gost" || resolveGostSlug(ev));
      }
      if (filter === "fixtures") {
        return ev.type === "match";
      }
      return true;
    });
  }, [events, filter]);

  const dateMap = useMemo(() => buildDateMap(filteredEvents), [filteredEvents]);

  useEffect(() => {
    if (didAutoJump) return;
    const dated = filteredEvents.map((ev) => parseDate(ev.date)).filter(Boolean).sort((a, b) => a - b);
    if (!dated.length) return;
    const monthKey = format(currentMonth, "yyyy-MM");
    const hasInMonth = dated.some((d) => format(d, "yyyy-MM") === monthKey);
    if (!hasInMonth) {
      const upcoming = dated.find((d) => d >= new Date()) || dated[dated.length - 1];
      setCurrentMonth(startOfMonth(upcoming));
    }
    setDidAutoJump(true);
  }, [filteredEvents, currentMonth, didAutoJump]);

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
  const weekCount = Math.max(1, Math.ceil(days.length / 7));

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col bg-background text-foreground",
        fullScreen && "min-h-0"
      )}
    >
      {/* FM toolbar */}
      <div className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Overview <span className="text-muted-foreground/50">›</span> <span className="text-foreground/80">Calendar</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            {[
              { id: "all", label: "General" },
              { id: "gost", label: "GOST" },
              { id: "fixtures", label: "Fixtures" },
            ].map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold transition",
                  i > 0 && "border-l border-border",
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Popover open={monthPickerOpen} onOpenChange={openMonthPicker}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Select month"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80"
              >
                {format(currentMonth, "MMMM yyyy")}
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  monthPickerOpen && "rotate-180"
                )} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[240px] border-border bg-card p-3 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Previous year"
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-sm font-bold tabular-nums text-foreground">{pickerYear}</p>
                <button
                  type="button"
                  aria-label="Next year"
                  onClick={() => setPickerYear((y) => y + 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_LABELS.map((label, monthIndex) => {
                  const selected =
                    currentMonth.getFullYear() === pickerYear
                    && currentMonth.getMonth() === monthIndex;
                  const isCurrent =
                    new Date().getFullYear() === pickerYear
                    && new Date().getMonth() === monthIndex;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => selectMonth(monthIndex)}
                      className={cn(
                        "rounded-md px-1.5 py-2 text-[11px] font-semibold transition",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                            ? "bg-secondary text-primary hover:bg-secondary/80"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date())}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            >
              Today
            </button>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {COMPETITIONS.map((c) => (
              <span key={c.slug} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                {c.name.replace(/^STAGE\s+/i, "").replace(" League", "")}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-sm bg-[#991b1b]" />
              Regional
            </span>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-secondary/40">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="border-r border-border/60 px-2 py-1.5 text-[11px] font-medium text-muted-foreground last:border-r-0"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Full-height month grid */}
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = (dateMap.get(key) || []).filter((ev) => {
            if (filter === "fixtures") return ev.type === "match";
            return true;
          });
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const visible = dayEvents.slice(0, 5);
          const extra = dayEvents.length - visible.length;
          const dateLabel = !inMonth || format(day, "d") === "1"
            ? format(day, "d MMM")
            : format(day, "d");

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-0 flex-col border-b border-r border-border/60 bg-card p-1 last:border-r-0 sm:p-1.5",
                !inMonth && "bg-background opacity-50",
                today && "ring-1 ring-inset ring-primary/70"
              )}
            >
              <div
                className={cn(
                  "mb-1 shrink-0 px-0.5 text-[11px] font-medium tabular-nums",
                  today ? "font-bold text-primary" : "text-muted-foreground"
                )}
              >
                {dateLabel}
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visible.map((ev) => (
                  <MatchBlock
                    key={ev.id}
                    ev={ev}
                    myClub={myClub}
                    onClick={() => setDetailEvent(ev)}
                  />
                ))}
                {extra > 0 ? (
                  <p className="px-0.5 text-[9px] font-semibold text-muted-foreground">+{extra} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail overlay */}
      {detailEvent ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-bold text-foreground">
                {homeAwayNames(detailEvent).home} vs {homeAwayNames(detailEvent).away}
              </p>
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[min(70vh,560px)] overflow-y-auto p-4">
              {detailEvent.matchData || detailEvent.type === "contract_end" || detailEvent.type === "tournament_start" ? (
                <MatchDetail event={detailEvent} myPlayer={myPlayer} myClub={myClub} />
              ) : (
                <div
                  className="rounded-xl p-4"
                  style={{ background: matchBlockStyle(detailEvent).bg }}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/70">
                    {matchBlockStyle(detailEvent).label}
                    {detailEvent.matchday ? ` · MD ${detailEvent.matchday}` : ""}
                  </p>
                  <p className="mt-2 font-heading text-2xl font-black uppercase text-white">
                    {homeAwayNames(detailEvent).home}
                    <span className="mx-2 text-white/40">vs</span>
                    {homeAwayNames(detailEvent).away}
                  </p>
                  <p className="mt-2 text-sm text-white/70">{detailEvent.competition}</p>
                  <p className="mt-1 text-sm font-bold text-white">{timeOrScore(detailEvent)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
