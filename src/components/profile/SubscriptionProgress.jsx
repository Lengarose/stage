import { Crown } from "lucide-react";
import { getSubscriptionCountdown } from "@/lib/subscriptionUtils";

/**
 * STAGE Plus renewal countdown with a progress bar.
 *
 * - Monthly plans: shows the days left until the next renewal.
 * - Yearly plans: shows the days left, plus the months already used / left.
 *
 * Renders nothing when the player has no active STAGE Plus subscription.
 */
export default function SubscriptionProgress({ player }) {
  const info = getSubscriptionCountdown(player);
  if (!info) return null;

  const { billing, daysLeft, totalDays, percent, monthsElapsed, monthsLeft, expiresAt, isExpired } = info;
  const renewalDate = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 mb-4">
      <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-400/25 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                STAGE Plus · <span className="capitalize text-cyan-300">{billing}</span>
              </p>
              <p className="text-[11px] text-white/50">
                {isExpired ? "Renewal due" : `Renews ${renewalDate}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black leading-none text-cyan-300">{daysLeft}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/50">
              {daysLeft === 1 ? "day left" : "days left"}
            </p>
          </div>
        </div>

        {/* Progress bar: how much of the current billing period has elapsed. */}
        <div
          className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Time elapsed in current billing period"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/45">
          <span>{totalDays - daysLeft} / {totalDays} days used</span>
          {billing === "yearly" && (
            <span>
              {monthsElapsed} {monthsElapsed === 1 ? "month" : "months"} in · {monthsLeft} to go
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
