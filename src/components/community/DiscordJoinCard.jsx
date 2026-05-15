import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MessageCircle, Users, Megaphone, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DiscordMark from "@/components/community/DiscordMark";
import DiscordWidget from "@/components/community/DiscordWidget";
import {
  DISCORD_INVITE_URL,
  DISCORD_SERVER_ID,
  isDiscordConfigured,
} from "@/lib/discordConfig";
import {
  dismissDiscordPrompt,
  hasMarkedDiscordJoined,
  markDiscordJoined,
  openDiscordInvite,
} from "@/lib/discordJoin";

const BENEFITS = [
  { icon: Users, text: "Find clubs, players, and scrims fast" },
  { icon: Megaphone, text: "League announcements and match reminders" },
  { icon: Swords, text: "Talk tactics, transfers, and highlights" },
  { icon: MessageCircle, text: "Get help from staff and the community" },
];

export default function DiscordJoinCard({
  variant = "full",
  className = "",
  onSkip,
  onContinue,
  showSkip = true,
  showWidget = true,
}) {
  const [joined, setJoined] = useState(() => hasMarkedDiscordJoined());
  const configured = isDiscordConfigured();
  const hasInvite = Boolean(DISCORD_INVITE_URL);
  const hasWidget = Boolean(DISCORD_SERVER_ID) && showWidget;

  if (!configured) {
    if (variant === "banner") return null;
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-6 text-center", className)}>
        <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Discord link is not set up yet. Ask an admin to add invite settings.
        </p>
      </div>
    );
  }

  const handleJoin = () => {
    openDiscordInvite(DISCORD_INVITE_URL);
    setJoined(true);
    onContinue?.();
  };

  const handleSkip = () => {
    dismissDiscordPrompt();
    onSkip?.();
  };

  const handleAlreadyJoined = () => {
    markDiscordJoined();
    setJoined(true);
    onContinue?.();
  };

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-[#5865F2]/30 bg-gradient-to-r from-[#5865F2]/15 via-card to-card p-5 sm:p-6",
          className
        )}
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#5865F2]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#5865F2]/25 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shrink-0">
              <DiscordMark className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#5865F2] font-bold mb-1">Community</p>
              <h2 className="font-heading text-lg uppercase tracking-tight text-foreground">
                Join our Discord
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Free to join — meet players, get match updates, and find your next club.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {hasInvite && (
              <Button
                type="button"
                onClick={handleJoin}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white gap-2"
              >
                <DiscordMark className="w-4 h-4" />
                Join Discord
              </Button>
            )}
            <Button type="button" variant="outline" asChild className="border-border">
              <Link to="/community">Learn more</Link>
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("rounded-2xl border border-[#5865F2]/25 bg-card overflow-hidden", className)}>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-11 h-11 rounded-lg bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
              <DiscordMark className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Stage League Discord</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {joined ? "You're set — hop in anytime from Community." : "Join competitors on Discord."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {hasInvite && !joined && (
              <Button type="button" onClick={handleJoin} className="bg-[#5865F2] hover:bg-[#4752C4] text-white gap-2">
                <DiscordMark className="w-4 h-4" />
                Join server
              </Button>
            )}
            <Button type="button" variant="outline" asChild>
              <Link to="/community">Open Community</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "onboarding") {
    return (
      <div className={cn("space-y-5", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/25 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shrink-0">
                <DiscordMark className="w-8 h-8" />
              </div>
              <div>
                <h2
                  style={{ fontFamily: "'Anton', sans-serif" }}
                  className="text-2xl italic uppercase tracking-tight text-white mb-1"
                >
                  Join the community
                </h2>
                <p className="text-white/50 text-xs leading-relaxed">
                  Almost done! Discord is where players find clubs and get league news. Join now or later from Community in the menu.
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white/70 text-xs">
                  <Icon className="w-4 h-4 text-[#5865F2] shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {hasWidget && (
            <div className="rounded-xl overflow-hidden border border-white/15 bg-[#2f3136]">
              <div className="px-4 py-2 border-b border-white/10 bg-black/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Server preview
                </p>
              </div>
              <DiscordWidget compact className="w-full block" />
            </div>
          )}
        </div>

        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hasInvite && (
              <Button
                type="button"
                onClick={handleJoin}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-widest gap-2 h-11"
              >
                <DiscordMark className="w-5 h-5" />
                Join Discord
                <ExternalLink className="w-4 h-4 opacity-80" />
              </Button>
            )}
            {onContinue && (
              <Button
                type="button"
                onClick={onContinue}
                className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest h-11 hover:bg-gray-100"
              >
                Continue to STAGE →
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleAlreadyJoined}
              className="text-white/50 hover:text-white hover:bg-white/10 text-[10px] uppercase tracking-widest h-8 px-2"
            >
              I already joined
            </Button>
            {showSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-white/35 hover:text-white/60 text-[10px] uppercase tracking-widest py-1 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-2xl border border-[#5865F2]/20 bg-gradient-to-br from-[#5865F2]/10 via-card to-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5865F2]/15 border border-[#5865F2]/30 text-[#5865F2] text-[10px] font-bold uppercase tracking-wider">
              <DiscordMark className="w-3.5 h-3.5" />
              Official server
            </div>
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl uppercase tracking-tight text-foreground">
                Your home off the pitch
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-lg">
                Discord is free and takes under a minute. Join to chat with clubs, get match updates, and stay connected — whether you signed up today or joined months ago.
              </p>
            </div>

            <ol className="space-y-3">
              {[
                "Click Join Discord — opens in a new tab",
                "Create a Discord account or sign in (free)",
                "Accept the invite and pick your channels",
              ].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-foreground/90 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <ul className="grid sm:grid-cols-2 gap-2">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border/60"
                >
                  <Icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-1">
              {hasInvite && (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleJoin}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white gap-2 font-heading uppercase tracking-wide"
                >
                  <DiscordMark className="w-5 h-5" />
                  {joined ? "Open Discord again" : "Join Discord — it's free"}
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </Button>
              )}
              {!joined && (
                <Button type="button" variant="outline" size="lg" onClick={handleAlreadyJoined}>
                  I&apos;m already in the server
                </Button>
              )}
            </div>
          </div>

          {hasWidget && (
            <div className="w-full lg:w-[340px] shrink-0 rounded-xl border border-border overflow-hidden shadow-xl bg-[#2f3136]">
              <div className="px-4 py-2.5 border-b border-white/10 bg-black/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Live preview
                </p>
              </div>
              <DiscordWidget className="w-full block min-h-[420px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
