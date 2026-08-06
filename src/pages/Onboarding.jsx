import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveMyPlayerAndClub, userNeedsOnboarding } from "@/api/stageClient";
import PlayerSetup from "@/components/onboarding/PlayerSetup";
import ClubSetup from "@/components/onboarding/ClubSetup";
import IdentityClaimSetup from "@/components/onboarding/IdentityClaimSetup";
import TutorialPopup from "@/components/onboarding/TutorialPopup";
import DiscordJoinCard from "@/components/community/DiscordJoinCard";
import { isDiscordConfigured } from "@/lib/discordConfig";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { writeAccountIntent } from "@/lib/accountIntent";
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
const PlayerPresidentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <circle cx="8" cy="8" r="3"/><path d="M3 20c0-3.2 2.2-5.5 5-5.5s5 2.3 5 5.5"/><path d="M17 21s4-2.2 4-5.8v-4.1L17 9.5l-4 1.6v4.1c0 3.6 4 5.8 4 5.8z"/>
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-1 text-white/25 group-hover:text-white/60 transition-colors">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

/* ── step meta ─────────────────────────────────────────────── */
function getStepMeta(intent, step, phase) {
  // Player: choose → player → identity
  // Player+President: choose → player → identity → president → club profile
  const dual = intent === "both";

  if (step === "player") {
    return { labelKey: "obStepPlayerProfile", index: 1, total: dual ? 5 : 3 };
  }

  if (step === "identity") {
    return { labelKey: "obStepVerifyIdentity", index: 2, total: dual ? 5 : 3 };
  }

  if (step === "club" && dual) {
    if (phase === "club") {
      return { label: "Club Profile", labelKey: "obStepClubSetup", index: 4, total: 5 };
    }
    return { label: "President Profile", labelKey: "obStepClubSetup", index: 3, total: 5 };
  }

  // President-only: choose → president → club profile
  if (step === "owner_club") {
    if (phase === "club") {
      return { label: "Club Profile", labelKey: "obStepClubSetup", index: 2, total: 3 };
    }
    return { label: "President Profile", labelKey: "obStepClubSetup", index: 1, total: 3 };
  }

  return { labelKey: "obStepChooseRole", index: 0, total: 2 };
}

/* ── component ─────────────────────────────────────────────── */
export default function Onboarding({ onComplete }) {
  const { t } = useTranslation();
  const [user,         setUser]         = useState(null);
  const [player,       setPlayer]       = useState(null);
  const [step,         setStep]         = useState("choose");
  const [intent,       setIntent]       = useState("player");
  const [clubSetupPhase, setClubSetupPhase] = useState("president");
  const [loading,      setLoading]      = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const setOnboardingIntent = (nextIntent, accountMode) => {
    setIntent(nextIntent);
    writeAccountIntent(nextIntent, user?.id);
    localStorage.setItem("stage-account-mode", accountMode);
  };

  useEffect(() => {
    (async () => {
      try {
        const { user: u, player: pl } = await resolveMyPlayerAndClub();
        setUser(u);
        if (pl) setPlayer(pl);

        const forceOnboarding = Boolean(u?.id && userNeedsOnboarding(u.id));
        // OAuth creates a stub player — still run onboarding until profile is finished.
        if ((u.player_id || pl?.id) && !forceOnboarding) {
          onComplete?.();
          return;
        }
        // Keep role chooser for OAuth; PlayerSetup prefills the stub when they pick Player.
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [onComplete]);

  const handlePlayerComplete = async (optimisticPlayer = null) => {
    try {
      const { player: updated } = await resolveMyPlayerAndClub();
      if (updated) {
        setPlayer(updated);
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

  const meta = getStepMeta(intent, step, clubSetupPhase);
  const progress = ((meta.index) / (Math.max(meta.total - 1, 1))) * 100;
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
                    {t("commonPages.obStepOf", {
                      current: meta.index,
                      total: meta.total - 1,
                      label: meta.label || t(`commonPages.${meta.labelKey}`),
                    })}
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
                          {t("commonPages.obHowPlay")}
                        </h2>
                        <p className="text-white/40 text-xs">{t("commonPages.obChooseRole")}</p>
                      </div>

                      <div className="space-y-3">
                        {/* Player */}
                        <button
                          onClick={() => {
                            setOnboardingIntent("player", "player");
                            setStep("player");
                          }}
                          className="w-full group text-left bg-white/5 border border-white/15 hover:border-blue-500/60 hover:bg-blue-500/8 rounded-2xl p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 shrink-0">
                              <PlayerIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase tracking-wide text-white text-sm mb-1">{t("commonPages.storePlayer")}</p>
                              <p className="text-white/40 text-xs leading-relaxed">{t("commonPages.obPlayerDesc")}</p>
                            </div>
                            <ChevronRight />
                          </div>
                        </button>

                        {/* President */}
                        <button
                          onClick={() => {
                            setOnboardingIntent("president", "club");
                            setClubSetupPhase("president");
                            setStep("owner_club");
                          }}
                          className="w-full group text-left bg-white/5 border border-white/15 hover:border-amber-500/60 hover:bg-amber-500/8 rounded-2xl p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                              <OwnerIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase tracking-wide text-white text-sm mb-1">{t("commonPages.obClubOwner")}</p>
                              <p className="text-white/40 text-xs leading-relaxed">{t("commonPages.obClubOwnerDesc")}</p>
                            </div>
                            <ChevronRight />
                          </div>
                        </button>

                        {/* Player + President */}
                        <button
                          onClick={() => {
                            setOnboardingIntent("both", "player");
                            setStep("player");
                          }}
                          className="w-full group text-left bg-white/5 border border-white/15 hover:border-emerald-400/60 hover:bg-emerald-500/8 rounded-2xl p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 shrink-0">
                              <PlayerPresidentIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase tracking-wide text-white text-sm mb-1">
                                {t("commonPages.storePlayer")} + {t("commonPages.obClubOwner")}
                              </p>
                              <p className="text-white/40 text-xs leading-relaxed">
                                {t("commonPages.obPlayerDesc")} {t("commonPages.obClubOwnerDesc")}
                              </p>
                            </div>
                            <ChevronRight />
                          </div>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/8 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">STAGE Plus</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/55">
                          Start free with 50 credits for one community tournament. Plus is €4.99/month or €49.99/year and unlocks official competitions, tournament creation, full rankings, full stats, and 150 refreshed credits every month.
                        </p>
                        <a
                          href="/store"
                          className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-cyan-200 hover:text-white"
                        >
                          View Plus
                        </a>
                      </div>
                    </div>
                  )}

                  {/* ── PLAYER SETUP ────────────────────────── */}
                  {step === "player" && (!player || !player.country) && (
                    <PlayerSetup
                      onComplete={handlePlayerComplete}
                      user={user}
                      initialPlayer={player}
                      intent={intent}
                    />
                  )}
                  {step === "player" && player?.country && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">{t("commonPages.obProfileReady")}</h2>
                        <p className="text-white/40 text-xs">
                          {t("commonPages.obProfileReadyDesc", { name: player.gamertag || user?.email })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("identity")}
                        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 transition-all shadow-lg"
                      >
                        {t("commonPages.obContinueVerification")}
                      </button>
                    </div>
                  )}

                  {/* ── IDENTITY CLAIM ─────────────────────── */}
                  {step === "identity" && player && (
                    <IdentityClaimSetup
                      player={player}
                      onComplete={() => {
                        if (intent === "both") setStep("club");
                        else finishOnboarding();
                      }}
                    />
                  )}

                  {/* ── CLUB (Player + President only) ───────── */}
                  {step === "club" && intent === "both" && (
                    <ClubSetup
                      onSkip={finishOnboarding}
                      onComplete={finishOnboarding}
                      onPhaseChange={setClubSetupPhase}
                      player={player}
                      user={user}
                      required
                    />
                  )}

                  {/* ── REQUIRED CLUB (president-only path) ──── */}
                  {step === "owner_club" && (
                    <ClubSetup
                      onComplete={finishOnboarding}
                      onPhaseChange={setClubSetupPhase}
                      player={player}
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

              {/* Back */}
              {step !== "choose" && step !== "club" && step !== "owner_club" && step !== "discord" && (
                <button
                  type="button"
                  onClick={() => setStep(step === "identity" ? "player" : "choose")}
                  className="mt-5 shrink-0 text-white/25 hover:text-white/50 text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <TutorialPopup open={tutorialOpen} onClose={handleTutorialClose} intent={intent} />
    </motion.div>
  );
}
