import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { stageClient } from "@/api/stageClient";
import { useAuth } from "@/lib/AuthContext";
import { ensureAdminPanelMode, isAppAdminUser } from "@/lib/adminAuth";
import { format, parseISO, isValid } from "@/lib/momentDate";
import BannerImg from "@/assets/Banner.jpg";
import LogoImg from "@/assets/Stadium Logo.png";

// ── Inline SVG icons (kept local so this screen has zero asset dependencies
// beyond the banner + logo; matches the visual treatment of `Login.jsx`). ──
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.3C9.7 35.7 16.3 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40.9 36 44 31.5 44 24c0-1.2-.1-2.4-.4-3.5z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 21 21">
    <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
    <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
    <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 814 1000" fill="currentColor">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.5-49 191.3-49 30.8 0 110.7 2.6 162.6 63.1zm-234.5-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ProviderButton = ({ onClick, icon, label, className = "" }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    className={`w-full flex items-center justify-center gap-3 font-semibold py-3.5 md:py-3 text-[15px] md:text-sm rounded-xl transition-colors shadow-lg ${className}`}
  >
    {icon}
    {label}
  </motion.button>
);

function formatDateRange(start, end) {
  const s = start ? parseISO(start) : null;
  const e = end   ? parseISO(end)   : null;
  const sOk = s && isValid(s);
  const eOk = e && isValid(e);
  if (sOk && eOk) return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
  if (sOk)        return format(s, "d MMM yyyy");
  if (eOk)        return format(e, "d MMM yyyy");
  return null;
}

function hasPaidPlan(user) {
  if (!user) return false;
  const roleId = Number(user.role_id ?? 1);
  if (roleId === 0 || roleId === 2) return true; // admin / staff
  const sub = String(user.subscription || "").toLowerCase();
  if (!sub) return false;
  return !["rookie", "free", "basic_free"].includes(sub);
}

// Map server-side `reason` codes into human-readable messages.
const REASON_MESSAGES = {
  not_found:             "This tournament entrance link does not exist.",
  revoked:               "This entrance link has been revoked.",
  expired:               "This entrance link has expired.",
  tournament_not_found:  "The tournament linked to this entrance no longer exists.",
  tournament_started:    "Registration is closed — this tournament has already started.",
};

// Common input className. Bigger touch target + 16px+ font on mobile to
// prevent iOS Safari's auto-zoom on focus.
const INPUT_CLS =
  "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-4 md:py-3 text-base md:text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";

export default function EntranceAuthCard({ mode }) {
  const isSignup     = mode === "signup";
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { checkUserAuth } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [resolveError, setResolveError] = useState("");   // top-level token error (no form below)
  const [tournament, setTournament] = useState(null);

  const [identifier, setIdentifier]               = useState("");
  const [password, setPassword]                   = useState("");
  const [confirmPassword, setConfirmPassword]     = useState("");
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  // Guard so we don't double-trigger the post-OAuth limited-mode-apply pass.
  const postAuthHandledRef = useRef(false);

  // After a successful local or OAuth signin, apply the tournament-limited
  // access-mode (when relevant) then route the user into the tournament page.
  const finalizeAuthedUser = useCallback(async (tournamentId) => {
    const me = await stageClient.auth.me().catch(() => null);
    if (!me) throw new Error("Unable to load your account.");
    if (isAppAdminUser(me)) ensureAdminPanelMode();
    // Only newly-onboarded / free-tier users get scoped into the tournament-only
    // experience. Existing paid-plan users keep full access.
    if (!hasPaidPlan(me) && tournamentId) {
      await stageClient.functions
        .invoke("applyTournamentEntranceAccessMode", { tournament_id: tournamentId })
        .catch(() => {});
      // Refresh auth so `user.access_mode` reflects the new limited state.
      await checkUserAuth().catch(() => {});
    }
    navigate(`/tournaments/${tournamentId}`, { replace: true });
  }, [navigate, checkUserAuth]);

  // 1) Resolve the entrance token, fetch tournament context. If the user is
  // already authed (typical case: they just came back from an OAuth round-trip)
  // run the post-auth finalize flow directly.
  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        const resolved = await stageClient.http.post("/public/resolve-entrance-token", { token });
        if (!resolved?.data?.success) {
          if (mounted) {
            setResolveError(REASON_MESSAGES[resolved?.data?.reason] || "This tournament entrance link is invalid.");
            setTournament(resolved?.data?.tournament || null);
          }
          return;
        }
        const t = resolved.data.tournament || null;
        if (mounted) setTournament(t);

        const isAuthed = await stageClient.auth.isAuthenticated().catch(() => false);
        if (isAuthed && t?.id && !postAuthHandledRef.current) {
          postAuthHandledRef.current = true;
          await finalizeAuthedUser(t.id);
          return;
        }
      } catch (err) {
        if (mounted) setResolveError(err?.message || "Unable to load this entrance link.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    bootstrap();
    return () => { mounted = false; };
  }, [token, finalizeAuthedUser]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (isSignup && password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { access_token } = isSignup
        ? await stageClient.auth.registerViaEmailPassword({ email: identifier, password })
        : await stageClient.auth.loginViaEmailPassword(identifier, password);
      if (!access_token) {
        setFormError(isSignup ? "Unable to create account. Please try again." : "Sign-in failed. Please try again.");
        return;
      }
      stageClient.auth.setToken(access_token);
      await checkUserAuth();
      if (tournament?.id) await finalizeAuthedUser(tournament.id);
    } catch (err) {
      const serverError = err?.error || err?.message || "";
      if (isSignup && String(serverError).toLowerCase().includes("this user with this email exist")) {
        setFormError("An account with this email already exists.");
      } else {
        setFormError(serverError || (isSignup ? "Unable to create account. Please try again." : "Invalid email, gamertag, or password."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setFormError("");
    navigate(`/tournaments/entrance/${token}/${isSignup ? "signin" : "signup"}`, { replace: true });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tournamentName = tournament?.name?.trim() || "this tournament";
  const dateRange      = formatDateRange(tournament?.start_date, tournament?.end_date);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center overflow-hidden bg-[#0a0e1a] md:bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* ── Desktop background: full-bleed banner with dark overlay ─────────── */}
      <img
        src={BannerImg}
        alt=""
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
      />
      <div className="hidden md:block absolute inset-0 bg-black/55" />

      {/* ── Mobile hero: banner photo + logo + tournament context up top ───── */}
      <div className="md:hidden relative w-full h-[40vh] min-h-[240px] max-h-[340px] shrink-0 overflow-hidden">
        <img
          src={BannerImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Fade to background so the hero blends into the form panel below. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[#0a0e1a]" />
        <motion.div
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative h-full flex flex-col items-center justify-end gap-2 px-6 pb-5"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
        >
          <img
            src={LogoImg}
            alt="STAGE"
            className="h-20 w-auto object-contain drop-shadow-2xl"
          />
          <p className="text-white/70 text-[10px] uppercase tracking-[0.3em]">
            Tournament Entrance
          </p>
        </motion.div>
      </div>

      {/* ── Card / content ─────────────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 w-full md:max-w-sm md:mx-4 flex-1 md:flex-initial overflow-y-auto md:overflow-visible"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <div
          className="px-6 pt-2 md:p-8 md:bg-white/10 md:backdrop-blur-xl md:border md:border-white/20 md:rounded-2xl md:shadow-2xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
        >
          {/* Desktop-only branding (mobile shows it in hero) */}
          <div className="hidden md:flex flex-col items-center mb-6 gap-2">
            <img src={LogoImg} alt="STAGE" className="h-24 w-auto object-contain" />
            <p className="text-white/50 text-xs uppercase tracking-[0.25em]">
              {isSignup ? "Create account" : "Welcome back"}
            </p>
          </div>

          {/* Tournament ticket — context this entrance link is for */}
          {tournament && (
            <div className="mb-5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center">
              <p className="text-white/45 text-[10px] uppercase tracking-[0.22em]">
                {isSignup ? "Joining tournament" : "Signing in for"}
              </p>
              <p className="text-white text-base md:text-sm font-bold mt-1 truncate">
                {tournamentName}
              </p>
              {dateRange && (
                <p className="text-white/55 text-xs md:text-[11px] mt-0.5">{dateRange}</p>
              )}
            </div>
          )}

          {/* Hard error block — token invalid/expired/revoked, no form below. */}
          {!loading && resolveError && (
            <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-4 text-center">
              <p className="text-red-200 text-sm">{resolveError}</p>
              <p className="text-white/45 text-[11px] mt-2">
                Ask the tournament organiser for a fresh invite link.
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="py-10 flex justify-center">
              <span className="w-6 h-6 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Auth UI — only shown once token is valid */}
          {!loading && !resolveError && (
            <>
              {/* OAuth providers */}
              <div className="space-y-3 mb-5">
                <ProviderButton
                  onClick={() => stageClient.auth.loginWithProvider("google", window.location.href)}
                  icon={<GoogleIcon />}
                  label="Continue with Google"
                  className="bg-white text-gray-800 hover:bg-gray-100 active:bg-gray-200"
                />
                <ProviderButton
                  onClick={() => stageClient.auth.loginWithProvider("microsoft", window.location.href)}
                  icon={<MicrosoftIcon />}
                  label="Continue with Outlook"
                  className="bg-[#0078D4] text-white hover:bg-[#006CBE] active:bg-[#005EA6]"
                />
                <ProviderButton
                  onClick={() => stageClient.auth.loginWithProvider("apple", window.location.href)}
                  icon={<AppleIcon />}
                  label="Continue with Apple"
                  className="bg-black text-white hover:bg-neutral-900 active:bg-neutral-800"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-white/35 text-[11px] uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>

              {/* Email / Password form */}
              <form onSubmit={handleAuthSubmit} className="space-y-3" noValidate>
                <input
                  type={isSignup ? "email" : "text"}
                  inputMode={isSignup ? "email" : "text"}
                  enterKeyHint="next"
                  autoComplete={isSignup ? "email" : "username"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={isSignup ? "Email address" : "Email, gamertag, or club name"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className={INPUT_CLS}
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    enterKeyHint={isSignup ? "next" : "go"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isSignup ? 6 : undefined}
                    className={`${INPUT_CLS} pr-11`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors p-1"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                {isSignup && (
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      enterKeyHint="go"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className={`${INPUT_CLS} pr-11`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {formError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs text-center pt-1"
                    >
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-white text-[#0d2461] font-bold py-4 md:py-3 text-[15px] md:text-sm rounded-xl hover:bg-gray-100 disabled:opacity-55 transition-all shadow-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#0d2461]/25 border-t-[#0d2461] rounded-full animate-spin" />
                      {isSignup ? "Creating account…" : "Signing in…"}
                    </span>
                  ) : (
                    isSignup ? "Create Account" : "Sign In"
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={toggleMode}
                  className="w-full text-center text-[13px] md:text-xs text-white/65 hover:text-white/95 active:text-white transition-colors py-2 md:pt-1"
                >
                  {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                </button>

                <p className="text-white/35 text-[11px] md:text-[10px] text-center pt-2 leading-snug">
                  Your account will be scoped to <span className="text-white/55">{tournamentName}</span> until the tournament ends. Full access unlocks automatically afterwards.
                </p>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
