import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import PlayerSetup from "@/components/onboarding/PlayerSetup";
import ClubSetup from "@/components/onboarding/ClubSetup";
import TutorialPopup from "@/components/onboarding/TutorialPopup";
import BannerImg from "@/assets/Banner.jpg";
import LogoImg from "@/assets/Logo.PNG";

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
  player:     { label: "Player Profile",  index: 1, total: 3 },
  club:       { label: "Club Setup",      index: 2, total: 3 },
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
        const u = await base44.auth.me();
        setUser(u);
        const [players, clubs] = await Promise.all([
          base44.entities.Player.filter({ email: u.email }),
          base44.entities.Club.filter({ owner_email: u.email }),
        ]);
        if (players[0] || clubs[0]) {
          onComplete?.();
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePlayerComplete = async () => {
    try {
      const updated = await base44.entities.Player.filter({ email: user.email });
      if (updated[0]) { setPlayer(updated[0]); setStep("club"); }
    } catch (err) {
      console.error(err);
    }
  };

  const finishOnboarding = () => setTutorialOpen(true);
  const handleTutorialClose = () => { setTutorialOpen(false); onComplete?.(); };

  const meta = STEPS[step] || STEPS.choose;
  const progress = ((meta.index) / (meta.total - 1)) * 100;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06091a]">
      <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06091a]/60 via-[#06091a]/50 to-[#06091a]/80" />

      {/* Nav */}
      <nav className="absolute top-0 inset-x-0 z-50 flex items-center px-6 md:px-12 py-5">
        <img src={LogoImg} alt="STAGE" className="h-20 w-auto object-contain" />
      </nav>

      {/* Card */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-24">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/40 text-xs uppercase tracking-widest">Loading…</p>
          </div>
        ) : !user ? null : (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">

              {/* Step header */}
              {step !== "choose" && (
                <div className="mb-7">
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

                  {/* ── OPTIONAL CLUB (player path) ─────────── */}
                  {step === "club" && player && (
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

                </motion.div>
              </AnimatePresence>

              {/* Back to choose */}
              {step !== "choose" && step !== "club" && step !== "owner_club" && (
                <button
                  onClick={() => setStep("choose")}
                  className="mt-5 text-white/25 hover:text-white/50 text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <TutorialPopup open={tutorialOpen} onClose={handleTutorialClose} />
    </div>
  );
}
