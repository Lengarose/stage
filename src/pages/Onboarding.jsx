import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stageClient } from "@/api/stageClient";
import PlayerSetup from "@/components/onboarding/PlayerSetup";
import ClubSetup from "@/components/onboarding/ClubSetup";
import IdentityClaimSetup from "@/components/onboarding/IdentityClaimSetup";
import TutorialPopup from "@/components/onboarding/TutorialPopup";
import DiscordJoinCard from "@/components/community/DiscordJoinCard";
import { isDiscordConfigured } from "@/lib/discordConfig";
import { cn } from "@/lib/utils";
import BannerImg from "@/assets/Banner.jpg";
import LogoImg from "@/assets/Stadium Logo.png";

/* ── icons ─────────────────────────────────────────────────── */
const PlayerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const OwnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-1 text-white/25 group-hover:text-white/60 transition-colors">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

/* ── step meta ─────────────────────────────────────────────── */
const STEPS = {
  choose:     { label: "Choose Role",     index: 0, total: 2 },
  player:     { label: "Player Profile",  index: 1, total: 4 },
  identity:   { label: "Verify Identity", index: 2, total: 4 },
  club:       { label: "Club Setup",      index: 3, total: 4 },
  owner_club: { label: "Club Setup",      index: 1, total: 2 },
};

/* ── component ─────────────────────────────────────────────── */
export default function Onboarding({ onComplete }) {
  const [user,         setUser]         = useState(null);
  const [player,       setPlayer]       = useState(null);
  const [step,         setStep]         = useState("choose");
  const [loading,      setLoading]      = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await stageClient.auth.me();
        setUser(u);
        const [players, clubs] = await Promise.all([
          stageClient.entities.Player.filter({ email: u.email }),
          stageClient.entities.Club.filter({ owner_email: u.email }),
        ]);
        if (players[0]) {
          setPlayer(players[0]);
        }
        // Already onboarded — don't show role chooser after localStorage was cleared
        if (u.player_id || players[0]?.id) {
          onComplete?.();
          return;
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [onComplete]);

  const handlePlayerComplete = async (optimisticPlayer = null) => {
    try {
      const updated = await stageClient.entities.Player.filter({ email: user.email });
      if (updated[0]) {
        setPlayer(updated[0]);
      } else if (optimisticPlayer) {
        setPlayer(optimisticPlayer);
      }
      setStep("identity");
    } catch (err) {
      console.error(err);
      if (optimisticPlayer) {
        setPlayer(optimisticPlayer);
        setStep("identity");
      }
    }
  };

  const finishOnboarding = () => {
    if (isDiscordConfigured()) setStep("discord");
    else setTutorialOpen(true);
  };
  const finishDiscordStep = () => setTutorialOpen(true);
  const handleTutorialClose = () => { setTutorialOpen(false); onComplete?.(); };

  const meta = STEPS[step] || STEPS.choose;
  const progress = ((meta.index) / (meta.total - 1)) * 100;
  const isWideStep = step === "identity" || step === "discord";

  return (
    <motion.div className={cn(
      "fixed inset-0 bg-background",
      isWideStep ? "overflow-y-auto" : "overflow-hidden"
    )}>
      <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/65 via-background/50 to-background/85" />

      {/* Nav */}
      <nav className="absolute top-0 inset-x-0 z-50 flex items-center px-6 md:px-12 py-5">
        <img src={LogoImg} alt="STAGE" className="h-20 w-auto object-contain" />
      </nav>

      {/* Card */}
      <div className={cn(
        "relative z-10 flex justify-center min-h-screen px-4",
        isWideStep ? "items-start py-14 md:py-16 pb-10" : "items-center py-24"
      )}>
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Loading…</p>
          </div>
        ) : !user ? null : (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={cn(
              "w-full transition-[max-width] duration-300",
              isWideStep ? "max-w-3xl my-2" : "max-w-md max-h-[calc(100vh-5rem)]"
            )}
          >
            <div className={cn(
              "bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl",
              isWideStep
                ? "p-6 md:p-8"
                : "flex flex-col max-h-[calc(100vh-5rem)] min-h-0 overflow-hidden p-8"
            )}>

              {/* Step header */}
              {step !== "choose" && step !== "discord" && (
                <div className="mb-7 shrink-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-2">
                    Step {meta.index} of {meta.total - 1} — {meta.label}
                  </p>
                  <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              )}

              <div className={cn(!isWideStep && "flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1")}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >

                  {/* ── CHOOSE ──────────────────────────────── */}
                  {step === "choose" && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h2
                          style={{ fontFamily: "'Anton', sans-serif" }}
                          className="text-2xl italic uppercase tracking-tight text-white mb-1"
                        >
                          How do you play?
                        </h2>
                        <p className="text-white/40 text-xs">Choose your role — you can add the other later</p>
                      </div>

                      <div className="space-y-3">
                        {/* Player */}
                        <button
                          onClick={() => setStep("player")}
                          className="w-full group text-left bg-white/5 border border-white/15 hover:border-blue-500/60 hover:bg-blue-500/8 rounded-2xl p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 shrink-0">
                              <PlayerIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase tracking-wide text-white text-sm mb-1">Player</p>
                              <p className="text-white/40 text-xs leading-relaxed">Create a player profile, join a club, sign contracts and compete in tournaments.</p>
                            </div>
                            <ChevronRight />
                          </div>
                        </button>

                        {/* Owner */}
                        <button
                          onClick={() => {
                            localStorage.setItem("stage-account-mode", "club");
                            setStep("owner_club");
                          }}
                          className="w-full group text-left bg-white/5 border border-white/15 hover:border-amber-500/60 hover:bg-amber-500/8 rounded-2xl p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                              <OwnerIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase tracking-wide text-white text-sm mb-1">Club Owner</p>
                              <p className="text-white/40 text-xs leading-relaxed">Found and manage your own club, sign players and enter tournaments.</p>
                            </div>
                            <ChevronRight />
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── PLAYER SETUP ────────────────────────── */}
                  {step === "player" && !player && (
                    <PlayerSetup onComplete={handlePlayerComplete} user={user} />
                  )}
                  {step === "player" && player && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">Player Profile Ready</h2>
                        <p className="text-white/40 text-xs">
                          Your player profile already exists ({player.gamertag || user?.email}). Continue to identity verification.
                        </p>
                      </div>
                      <button
                        onClick={() => setStep("identity")}
                        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 transition-all shadow-lg"
                      >
                        Continue to Verification →
                      </button>
                    </div>
                  )}

                  {/* ── IDENTITY CLAIM ─────────────────────── */}
                  {step === "identity" && player && (
                    <IdentityClaimSetup
                      player={player}
                      onComplete={() => setStep("club")}
                    />
                  )}

                  {/* ── OPTIONAL CLUB (player path) ─────────── */}
                  {step === "club" && (
                    <ClubSetup
                      onSkip={finishOnboarding}
                      onComplete={finishOnboarding}
                      player={player}
                      user={user}
                    />
                  )}

                  {/* ── REQUIRED CLUB (owner path) ──────────── */}
                  {step === "owner_club" && (
                    <ClubSetup
                      onComplete={finishOnboarding}
                      user={user}
                      required
                    />
                  )}

                  {step === "discord" && (
                    <DiscordJoinCard
                      variant="onboarding"
                      onSkip={finishDiscordStep}
                      onContinue={finishDiscordStep}
                    />
                  )}

                </motion.div>
              </AnimatePresence>
              </div>

              {/* Back to choose */}
              {step !== "choose" && step !== "club" && step !== "owner_club" && step !== "discord" && (
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="mt-5 shrink-0 text-white/25 hover:text-white/50 text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <TutorialPopup open={tutorialOpen} onClose={handleTutorialClose} />
    </motion.div>
  );
}
