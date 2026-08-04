import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { stageClient } from "@/api/stageClient";
import { useAuth } from "@/lib/AuthContext";
import { ensureAdminPanelMode, isAppAdminUser } from "@/lib/adminAuth";
import { shouldApplyTournamentEntranceAccess } from "@/lib/tournamentEntranceAccess";
import { format, parseISO, isValid } from "@/lib/momentDate";
import { useTranslation } from "@/hooks/useTranslation";
import BannerImg from "@/assets/Banner.jpg";
import LogoImg from "@/assets/Stadium Logo.png";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

const KickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#53FC18">
    <path d="M1.5 0h7.5v6h3V3h3V0h7.5v9h-3v3h3v9H15v-3h-3v-3h-3v6H1.5z" />
  </svg>
);

const TwitchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#9146FF">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
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

const ProviderIconButton = ({ onClick, icon, label }) => (
  <motion.button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.95 }}
    className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 hover:border-white/30 transition-colors shadow-lg"
  >
    {icon}
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

const INPUT_CLS =
  "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-4 md:py-3 text-base md:text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";

export default function EntranceAuthCard({ mode }) {
  const { t } = useTranslation();
  const isSignup     = mode === "signup";
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { checkUserAuth } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [resolveError, setResolveError] = useState("");
  const [tournament, setTournament] = useState(null);

  const [identifier, setIdentifier]               = useState("");
  const [password, setPassword]                   = useState("");
  const [confirmPassword, setConfirmPassword]     = useState("");
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  const postAuthHandledRef = useRef(false);

  const finalizeAuthedUser = useCallback(async (tournamentId) => {
    const me = await stageClient.auth.me().catch(() => null);
    if (!me) throw new Error(t("commonPages.teUnableAccount"));
    if (isAppAdminUser(me)) ensureAdminPanelMode();
    if (tournamentId && shouldApplyTournamentEntranceAccess(me)) {
      await stageClient.functions
        .invoke("applyTournamentEntranceAccessMode", { tournament_id: tournamentId })
        .catch(() => {});
      await checkUserAuth().catch(() => {});
    }
    navigate("/", { replace: true });
  }, [navigate, checkUserAuth, isSignup, t]);

  useEffect(() => {
    let mounted = true;
    const reasonMessages = {
      not_found:             t("commonPages.teReasonNotFound"),
      revoked:               t("commonPages.teReasonRevoked"),
      tournament_not_found:  t("commonPages.teReasonTournamentGone"),
      tournament_full:       t("commonPages.teReasonFull"),
    };
    async function bootstrap() {
      try {
        const resolved = await stageClient.http.post("/public/resolve-entrance-token", { token });
        if (!resolved?.data?.success) {
          if (mounted) {
            setResolveError(reasonMessages[resolved?.data?.reason] || t("commonPages.teInvalidLink"));
            setTournament(resolved?.data?.tournament || null);
          }
          return;
        }
        const row = resolved.data.tournament || null;
        if (mounted) setTournament(row);

        const isAuthed = await stageClient.auth.isAuthenticated().catch(() => false);
        if (isAuthed && row?.id && !postAuthHandledRef.current) {
          postAuthHandledRef.current = true;
          // Returning from OAuth (or already signed in): finish entrance signup then home.
          // Onboarding gate in App.jsx will open if this is a new OAuth account.
          try {
            await finalizeAuthedUser(row.id);
          } catch {
            navigate("/", { replace: true });
          }
          return;
        }
      } catch (err) {
        if (mounted) setResolveError(err?.message || t("commonPages.teUnableLoadLink"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    bootstrap();
    return () => { mounted = false; };
  }, [token, navigate, t, finalizeAuthedUser]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setFormError("");
    const emailValue = String(identifier || "").trim();
    if (isSignup || emailValue.includes("@")) {
      if (!EMAIL_REGEX.test(emailValue)) {
        setFormError(t("auth.invalidEmail"));
        return;
      }
    }
    if (isSignup && password !== confirmPassword) {
      setFormError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setSubmitting(true);
    try {
      const { access_token } = isSignup
        ? await stageClient.auth.registerViaEmailPassword({ email: identifier, password })
        : await stageClient.auth.loginViaEmailPassword(identifier, password);
      if (!access_token) {
        setFormError(isSignup ? t("auth.signupFailed") : t("auth.signinFailed"));
        return;
      }
      stageClient.auth.setToken(access_token);
      await checkUserAuth();
      if (tournament?.id) await finalizeAuthedUser(tournament.id);
    } catch (err) {
      const serverError = err?.error || err?.message || "";
      if (isSignup && String(serverError).toLowerCase().includes("this user with this email exist")) {
        setFormError(t("auth.accountExists"));
      } else {
        setFormError(serverError || (isSignup ? t("auth.signupFailed") : t("auth.invalidSignin")));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setFormError("");
    navigate(`/tournaments/entrance/${token}/${isSignup ? "signin" : "signup"}`, { replace: true });
  }

  const tournamentName = tournament?.name?.trim() || t("commonPages.teThisTournament");
  const dateRange      = formatDateRange(tournament?.start_date, tournament?.end_date);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center overflow-hidden bg-[#0a0e1a] md:bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <img
        src={BannerImg}
        alt=""
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
      />
      <div className="hidden md:block absolute inset-0 bg-black/55" />

      <div className="md:hidden relative w-full h-[40vh] min-h-[240px] max-h-[340px] shrink-0 overflow-hidden">
        <img
          src={BannerImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
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
            {t("commonPages.teEntrance")}
          </p>
        </motion.div>
      </div>

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
          <div className="hidden md:flex flex-col items-center mb-6 gap-2">
            <img src={LogoImg} alt="STAGE" className="h-24 w-auto object-contain" />
            <p className="text-white/50 text-xs uppercase tracking-[0.25em]">
              {isSignup ? t("auth.createAccount") : t("auth.welcomeBack")}
            </p>
          </div>

          {tournament && (
            <div className="mb-5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center">
              <p className="text-white/45 text-[10px] uppercase tracking-[0.22em]">
                {isSignup ? t("commonPages.teJoining") : t("commonPages.teSigningInFor")}
              </p>
              <p className="text-white text-base md:text-sm font-bold mt-1 truncate">
                {tournamentName}
              </p>
              {dateRange && (
                <p className="text-white/55 text-xs md:text-[11px] mt-0.5">{dateRange}</p>
              )}
            </div>
          )}

          {!loading && resolveError && (
            <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-4 text-center">
              <p className="text-red-200 text-sm">{resolveError}</p>
              <p className="text-white/45 text-[11px] mt-2">
                {t("commonPages.teAskFreshLink")}
              </p>
            </div>
          )}

          {loading && (
            <div className="py-10 flex justify-center">
              <span className="w-6 h-6 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {!loading && !resolveError && (
            <>
              <div className="flex gap-3 mb-5">
                <ProviderIconButton
                  onClick={() => stageClient.auth.loginWithProvider("google", window.location.href)}
                  icon={<GoogleIcon />}
                  label={t("auth.continueGoogle")}
                />
                <ProviderIconButton
                  onClick={() => stageClient.auth.loginWithProvider("microsoft", window.location.href)}
                  icon={<MicrosoftIcon />}
                  label={t("auth.continueOutlook")}
                />
                <ProviderIconButton
                  onClick={() => stageClient.auth.loginWithProvider("kick", window.location.href)}
                  icon={<KickIcon />}
                  label={t("auth.continueKick")}
                />
                <ProviderIconButton
                  onClick={() => stageClient.auth.loginWithProvider("twitch", window.location.href)}
                  icon={<TwitchIcon />}
                  label={t("auth.continueTwitch")}
                />
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-white/35 text-[11px] uppercase tracking-widest">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3" noValidate>
                <input
                  type={isSignup ? "email" : "text"}
                  inputMode={isSignup ? "email" : "text"}
                  enterKeyHint="next"
                  autoComplete={isSignup ? "email" : "username"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={isSignup ? t("auth.emailAddress") : t("auth.identifier")}
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
                    placeholder={t("auth.password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isSignup ? 6 : undefined}
                    className={`${INPUT_CLS} pr-11`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? t("commonPages.teHidePassword") : t("commonPages.teShowPassword")}
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
                      placeholder={t("auth.confirmPassword")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className={`${INPUT_CLS} pr-11`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? t("commonPages.teHidePassword") : t("commonPages.teShowPassword")}
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
                  className="w-full bg-white text-[#0d2461] font-heading text-lg md:text-base uppercase tracking-wide py-4 md:py-3 rounded-xl hover:bg-gray-100 disabled:opacity-55 transition-all shadow-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#0d2461]/25 border-t-[#0d2461] rounded-full animate-spin" />
                      {isSignup ? t("auth.creating") : t("auth.signingIn")}
                    </span>
                  ) : (
                    isSignup ? t("auth.createAccount") : t("auth.signIn")
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={toggleMode}
                  className="w-full text-center font-heading text-sm uppercase tracking-wide text-white/65 hover:text-white/95 active:text-white transition-colors py-2 md:pt-1"
                >
                  {isSignup ? t("auth.switchToSignin") : t("auth.switchToSignup")}
                </button>

                <p className="text-white/35 text-[11px] md:text-[10px] text-center pt-2 leading-snug">
                  {t("commonPages.teScopedNote", { name: tournamentName })}
                </p>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
