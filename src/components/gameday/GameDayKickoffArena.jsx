import { useEffect, useState } from "react";
import { Coins, Lock, MoreHorizontal } from "lucide-react";
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
  backgroundStyle,
  onChangeBackground,
  children,
}) {
  const [now, setNow] = useState(() => new Date());
  const isLive = status === "in_progress";
  const isFinished = status === "completed" || status === "forfeit";
  const showScore = isLive || isFinished;
  const countdown = !isLive && !isFinished ? getKickoffCountdownParts(date, now) : null;
  const hasCustomBackground = Boolean(backgroundStyle?.backgroundImage);

  useEffect(() => {
    if (isLive || isFinished) return undefined;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [isLive, isFinished]);

  return (
    <section className="relative overflow-hidden border border-[#d8dee8]/22 bg-[#080b10] text-white shadow-[0_0_88px_-28px_rgba(238,243,251,0.38)]">
      {backgroundStyle ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 bg-no-repeat",
            hasCustomBackground ? "opacity-100" : "bg-cover bg-center opacity-60",
          )}
          style={backgroundStyle}
        />
      ) : null}

      {hasCustomBackground ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/72" />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[42%] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-[280px] sm:w-[280px]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-[42%] h-px bg-white/10" />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                "radial-gradient(ellipse 90% 55% at 50% -8%, rgba(238,243,251,0.30), transparent 52%)",
                "radial-gradient(ellipse 42% 58% at 12% 48%, rgba(255,255,255,0.18), transparent 58%)",
                "radial-gradient(ellipse 42% 58% at 88% 48%, rgba(142,238,255,0.12), transparent 58%)",
                "linear-gradient(110deg, #151b25 0%, #0a0d13 48%, #242b36 100%)",
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 72px)",
              ].join(", "),
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[42%] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-[280px] sm:w-[280px]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-[42%] h-px bg-white/10" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/70" />
        </>
      )}

      <div className="relative z-[1] px-4 pb-5 pt-4 sm:px-8 sm:pb-6 sm:pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-[11px] font-black uppercase tracking-[0.28em] text-[#f8fbff]">
              {competitionLabel}
            </p>
            {date ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {format(date, "EEEE d MMMM · HH:mm")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-sm px-2.5 py-1 font-heading text-[10px] font-black uppercase tracking-[0.22em]",
                isLive && "bg-[#00e5ff] text-black motion-safe:animate-pulse",
                isFinished && "bg-white/10 text-white/80",
                !isLive && !isFinished && "bg-white/12 text-[#eef3fb] ring-1 ring-white/35",
              )}
            >
              {statusLabel}
            </span>
            {onChangeBackground ? (
              <button
                type="button"
                aria-label="Change Match Details background"
                onClick={onChangeBackground}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-black/35 text-white/65 transition hover:border-[#f8fbff]/60 hover:bg-[#d8dee8]/15 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : null}
          </div>
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
                <span className="mx-2 text-white/55">–</span>
                {awayScore ?? 0}
              </p>
            ) : (
              <div
                className="flex h-12 w-16 items-center justify-center border border-[#f8fbff]/35 bg-white/10 text-white shadow-[0_0_24px_-16px_rgba(255,255,255,0.8)] sm:h-14 sm:w-20"
                style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
              >
                <span className="font-heading text-sm font-black tracking-widest text-white/85 sm:text-base">VS</span>
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
          <div className="mt-4 flex justify-center gap-5 sm:gap-8">
            <ClockCell value={formatBroadcastUnit(countdown.hours)} label="Hours" />
            <ClockCell value={padClock(countdown.minutes)} label="Mins" />
            <ClockCell value={padClock(countdown.seconds)} label="Secs" />
          </div>
        ) : null}

        {Number(wagerStc) > 0 ? (
          <div className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-3 rounded-sm border border-white/30 bg-white/8 px-4 py-2.5 text-[#eef3fb] shadow-[0_0_28px_-20px_rgba(238,243,251,0.9)]">
            <Coins className="h-4 w-4 shrink-0" />
            <p className="font-heading text-xs font-black uppercase tracking-[0.18em] sm:text-sm">
              {formatSTC(wagerStc)} · pot {formatSTC(Number(wagerStc) * 2)}
            </p>
            {wagerLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-[#dbe4ef]/80" /> : null}
          </div>
        ) : null}

        {children ? <div className="mx-auto mt-4 max-w-xl">{children}</div> : null}
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
          {you ? <span className="ml-2 text-[#eef3fb]">●</span> : null}
        </p>
      </div>
    </div>
  );
}
