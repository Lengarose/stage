import MatchupBackdrop from "./MatchupBackdrop";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "@/lib/momentDate";
import { AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import SchedulePortrait from "./SchedulePortrait";
import { penaltyOutcome } from "@/lib/penaltyOutcome";

function dateOf(value) {
  const date = value ? parseISO(value) : null;
  return date && isValid(date) ? date : null;
}

const statusKeys = {
  scheduled: "scheduled", in_progress: "live", awaiting_confirmation: "pending",
  disputed: "disputed", completed: "fullTime", forfeit: "forfeit",
};
const competitionColors = {
  supreme: "bg-sky-400", elite: "bg-yellow-400", challenger: "bg-emerald-500",
  regional_cup: "bg-orange-400", regional: "bg-rose-400", tournament: "bg-purple-400",
};

export default function ScheduleList({ events, selectedId, onSelect }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("all");
  const [competition, setCompetition] = useState("");
  const matches = events.filter(event => event.type === "match");
  const reminders = events.filter(event => event.type === "contract_end" || event.type === "contract_reminder");
  const competitions = [...new Set(matches.map(event => event.competition).filter(Boolean))].sort();
  const visible = matches.filter(event => (!competition || event.competition === competition)
    && (mode === "all" || (mode === "results" ? Boolean(event.result) : !event.result)))
    .sort((a, b) => {
      // Keep outstanding matches first; within each section show upcoming in order and results newest first.
      if (mode === "all" && Boolean(a.result) !== Boolean(b.result)) return a.result ? 1 : -1;
      const left = dateOf(a.date)?.valueOf() ?? Infinity;
      const right = dateOf(b.date)?.valueOf() ?? Infinity;
      return (a.result ? -1 : 1) * (left - right);
    });
  const groups = new Map();
  visible.forEach(event => {
    const date = dateOf(event.date);
    const key = `${event.result ? "results" : "upcoming"}:${date ? format(date, "yyyy-MM-dd") : "undated"}`;
    if (!groups.has(key)) groups.set(key, { date, events: [] });
    groups.get(key).events.push(event);
  });

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <select
          aria-label={t("matchFlow.competition")}
          value={competition}
          onChange={event => { setCompetition(event.target.value); onSelect(null); }}
          className="min-h-11 min-w-0 max-w-full rounded-none border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <option value="">{t("matchFlow.agendaAllCompetitions", "All competitions")}</option>
          {competitions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className="flex flex-wrap gap-4" aria-label={t("matchFlow.agendaFilter", "Fixture filter")}>
          {[["upcoming", t("matchFlow.upcoming", "Upcoming")], ["results", t("matchFlow.agendaResults", "Results")], ["all", t("matchFlow.agendaAll", "All")]].map(([key, label]) => (
            <button type="button" key={key} aria-pressed={mode === key}
              onClick={() => { setMode(key); onSelect(null); }}
              className={cn("min-h-11 rounded-none border border-transparent bg-transparent px-1 text-xs transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", mode === key ? "text-foreground [text-shadow:0_0_14px_rgba(96,200,255,0.6)]" : "text-muted-foreground")}
            >{label}</button>
          ))}
        </div>
        <p className="w-full text-[11px] text-muted-foreground">{t("matchFlow.agendaTimezone", "Times shown in {timezone}", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
      </div>
      {[...groups.entries()].map(([key, group]) => (
        <section key={key}>
          <h2 className="mb-3 font-heading text-xl font-bold uppercase tracking-wider text-foreground">
            {group.date ? format(group.date, "EEEE d MMMM yyyy") : t("matchFlow.agendaDatePending", "Date to be confirmed")}
          </h2>
          <div className="border-t border-border">
            {group.events.map(event => <MatchRow key={event.id} event={event} selected={selectedId === event.id} onClick={() => onSelect(event)} />)}
          </div>
        </section>
      ))}
      {!visible.length && <p className="border-y border-border py-12 text-center text-sm text-muted-foreground">{mode === "results" ? t("matchFlow.agendaNoResults", "No results match these filters.") : t("matchFlow.agendaNoFixtures", "No fixtures match these filters.")}</p>}
      {reminders.length > 0 && (
        <section className="border-t border-border pt-5">
          <h2 className="mb-3 font-heading text-lg uppercase tracking-wider text-foreground">{t("matchFlow.agendaReminders", "Reminders")}</h2>
          {reminders.map(event => {
            const Icon = event.type === "contract_reminder" ? AlertTriangle : FileText;
            const date = dateOf(event.date);
            return <button type="button" key={event.id} onClick={() => onSelect(event)} aria-pressed={selectedId === event.id}
              className={cn("flex min-h-14 w-full items-center gap-3 rounded-none border border-transparent border-b-border px-3 py-3 text-left text-xs hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", selectedId === event.id && "bg-primary/10")}>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 break-words">{t(event.type === "contract_reminder" ? "matchFlow.contractExpiringSoon" : "matchFlow.contractEnd")}</span>
              <span className="text-muted-foreground">{date ? format(date, "dd MMM yyyy") : "—"}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </button>;
          })}
        </section>
      )}
    </div>
  );
}

function MatchRow({ event, selected, onClick }) {
  const { t } = useTranslation();
  const date = dateOf(event.date);
  const penaltyLabel = penaltyOutcome(event.matchData || event.fixtureData);
  const competitionKind = event.competitionSlug || (event.source === "regional" ? "regional" : event.tournament ? "tournament" : "friendly");
  const status = statusKeys[event.status];
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cn("agenda-match-row relative isolate overflow-hidden grid min-h-24 w-full grid-cols-[54px_minmax(0,1fr)] items-center gap-2 rounded-none border border-transparent border-b-border px-2 py-4 text-left transition-colors sm:grid-cols-[76px_minmax(0,1fr)_90px] sm:gap-4 sm:px-4 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", selected && "bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]")}
    >
      <MatchupBackdrop event={event} />
      <span className="agenda-match-time whitespace-nowrap font-sans text-sm font-bold tabular-nums text-foreground sm:text-lg">{date ? format(date, "HH:mm") : "—"}</span>
      <span className="col-span-2 row-start-2 min-w-0 space-y-2 sm:col-span-1 sm:row-auto">
        <span className="flex min-w-0 flex-col items-start gap-x-3 gap-y-2 text-base font-medium text-foreground sm:flex-row sm:flex-wrap sm:items-center sm:text-lg">
          <Team name={event.homeName || t("matchFlow.tbd")} image={event.homeAvatarUrl} photo={event.homePhoto} />
          <span className="text-[11px] font-normal text-muted-foreground">{t("matchFlow.versus")}</span>
          <Team name={event.awayName || t("matchFlow.tbd")} image={event.awayAvatarUrl} photo={event.awayPhoto} />
        </span>
        <span className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <span className={cn("mt-1 h-1.5 w-1.5 shrink-0", competitionColors[competitionKind] || "bg-slate-400")} />
          <span className="break-words">{event.competition || "—"} · {event.venue || "—"}</span>
        </span>
        {penaltyLabel && <span className="block text-[11px] text-muted-foreground">{penaltyLabel}</span>}
      </span>
      <span className="col-start-2 row-start-1 min-w-0 break-words text-right text-[11px] text-muted-foreground sm:col-auto sm:row-auto">
        {event.result ? <><span className="block font-heading text-2xl tracking-wider text-foreground">{event.result.display}</span>{status ? t(`matchFlow.${status}`) : event.status}</> : status ? t(`matchFlow.${status}`) : event.status || "—"}
      </span>
    </button>
  );
}

function Team({ name, image, photo }) {
  return <span className="inline-flex min-w-0 items-center gap-2">
    <SchedulePortrait image={image} photo={photo} className="w-9 sm:w-10" />
    <span className="min-w-0 break-words font-heading font-bold uppercase tracking-wider">{name}</span>
  </span>;
}
