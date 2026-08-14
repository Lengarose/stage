import { useEffect, useState } from "react";
import { Coins, Lock } from "lucide-react";
import { format } from "@/lib/momentDate";
import { cn } from "@/lib/utils";
import { formatSTC } from "@/lib/playerValue";
import {
  formatBroadcastUnit,
  getKickoffCountdownParts,
} from "@/lib/gameDayPresentation";
import GameDayCrest from "./GameDayCrest";

export default function GameDayKickoffArena({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homeYou,
  awayYou,
  homeLabel = "Home",
  awayLabel = "Away",
  date,
  status,
  statusLabel,
  competitionLabel,
  homeScore,
  awayScore,
  wagerStc = 0,
  wagerLocked = false,
  children,
}) {
  const [now, setNow] = useState(() => new Date());
  const isLive = status === "in_progress";
  const isFinished = status === "completed" || status === "forfeit";
  const showScore = isLive || isFinished;
  const countdown = !isLive && !isFinished ? getKickoffCountdownParts(date, now) : null;

  useEffect(() => {
    if (isLive || isFinished) return undefined;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [isLive, isFinished]);

  return (
    <section className="relative overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 90% 55% at 50% -8%, rgba(245,197,66,0.22), transparent 52%)",
            "radial-gradient(ellipse 42% 58% at 12% 48%, rgba(0,229,255,0.10), transparent 58%)",
            "radial-gradient(ellipse 42% 58% at 88% 48%, rgba(0,229,255,0.10), transparent 58%)",
            "repeating-linear-gradient(90deg, #08150f 0px, #08150f 56px, #0b1c13 56px, #0b1c13 112px)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-[280px] sm:w-[280px]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-[42%] h-px bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/70" />

      <div className="relative z-[1] px-4 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-[11px] font-black uppercase tracking-[0.28em] text-[#f5c542]">
              {competitionLabel}
            </p>
            {date ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {format(date, "EEEE d MMMM · HH:mm")}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "rounded-sm px-2.5 py-1 font-heading text-[10px] font-black uppercase tracking-[0.22em]",
              isLive && "bg-[#00e5ff] text-black motion-safe:animate-pulse",
              isFinished && "bg-white/10 text-white/80",
              !isLive && !isFinished && "bg-[#f5c542]/15 text-[#f5c542] ring-1 ring-[#f5c542]/40",
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
          <Side
            name={homeName}
            logo={homeLogo}
            you={homeYou}
            youLabel={homeLabel}
            align="right"
          />

          <div className="flex flex-col items-center gap-2 px-1 sm:px-3">
            {showScore ? (
              <p className="font-heading text-4xl font-black tabular-nums text-white sm:text-5xl">
                {homeScore ?? 0}
                <span className="mx-2 text-[#f5c542]">–</span>
                {awayScore ?? 0}
              </p>
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center bg-gradient-to-b from-[#ffe27a] to-[#c9a227] text-black sm:h-14 sm:w-14"
                style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
              >
                <span className="font-heading text-sm font-black tracking-widest sm:text-base">VS</span>
              </div>
            )}
          </div>

          <Side
            name={awayName}
            logo={awayLogo}
            you={awayYou}
            youLabel={awayLabel}
            align="left"
          />
        </div>

        {countdown && !countdown.started ? (
          <div className="mt-6 flex justify-center gap-5 sm:gap-8">
            <ClockCell value={formatBroadcastUnit(countdown.hours)} label="Hours" />
            <ClockCell value={padClock(countdown.minutes)} label="Mins" />
            <ClockCell value={padClock(countdown.seconds)} label="Secs" />
          </div>
        ) : null}

        {Number(wagerStc) > 0 ? (
          <div className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-3 rounded-sm border border-[#f5c542]/35 bg-black/40 px-4 py-2.5 text-[#f5c542]">
            <Coins className="h-4 w-4 shrink-0" />
            <p className="font-heading text-xs font-black uppercase tracking-[0.18em] sm:text-sm">
              {formatSTC(wagerStc)} · pot {formatSTC(Number(wagerStc) * 2)}
            </p>
            {wagerLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-[#f5c542]/80" /> : null}
          </div>
        ) : null}

        {children ? <div className="mx-auto mt-6 max-w-xl">{children}</div> : null}
      </div>
    </section>
  );
}

function padClock(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

function ClockCell({ value, label }) {
  return (
    <div className="text-center">
      <p className="font-heading text-4xl font-black tabular-nums leading-none text-white sm:text-5xl">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45">{label}</p>
    </div>
  );
}

function Side({ name, logo, you, youLabel, align }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-3", align === "right" ? "sm:items-end" : "sm:items-start")}>
      <GameDayCrest name={name} imageUrl={logo} size="lg" glow={you} />
      <div className={cn("min-w-0 text-center", align === "right" ? "sm:text-right" : "sm:text-left")}>
        <p className="font-heading text-xl font-black uppercase leading-none tracking-tight text-white sm:text-3xl md:text-4xl">
          <span className="block truncate">{name}</span>
        </p>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
          {youLabel}
          {you ? <span className="ml-2 text-[#f5c542]">●</span> : null}
        </p>
      </div>
    </div>
  );
}
