import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import { useTranslation } from '@/hooks/useTranslation';
import BannerImg from '@/assets/Banner.jpg';
import LogoImg from '@/assets/Stadium Logo.png';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function ResetPassword() {
  const { language, setLanguage, t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = String(params.get('token') || '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setChecking(false);
      setValid(false);
      return undefined;
    }
    stageClient.auth.validateResetToken(token)
      .then((ok) => {
        if (!cancelled) setValid(ok);
      })
      .catch(() => {
        if (!cancelled) setValid(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setIsLoading(true);
    try {
      await stageClient.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const code = String(err?.error || err?.message || '');
      if (code === 'invalid_token') setError(t('auth.resetLinkInvalid'));
      else if (code === 'password_too_short') setError(t('auth.passwordTooShort'));
      else setError(code || t('auth.resetFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />

      <motion.div
        className="relative z-10 w-full max-w-sm mx-4"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-7 gap-2">
            <img src={LogoImg} alt="STAGE" className="h-24 w-auto object-contain" />
            <p className="font-heading text-white/50 text-sm uppercase tracking-[0.25em]">
              {t('auth.resetTitle')}
            </p>
          </div>

          {checking ? (
            <div className="flex justify-center py-6">
              <span className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <p className="text-white/80 text-sm">{t('auth.resetSuccess')}</p>
              <p className="text-white/45 text-xs">{t('auth.resetGoogleHint')}</p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/?signin=1', { replace: true })}
                className="w-full bg-white text-[#0d2461] font-heading text-lg uppercase tracking-wide py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg"
              >
                {t('auth.signIn')}
              </motion.button>
            </div>
          ) : !valid ? (
            <div className="space-y-4 text-center">
              <p className="text-white/80 text-sm">{t('auth.resetLinkInvalid')}</p>
              <button
                type="button"
                onClick={() => navigate('/?signin=1', { replace: true })}
                className="w-full text-center font-heading text-sm uppercase tracking-wide text-white/60 hover:text-white/90 transition-colors"
              >
                {t('auth.backToSignin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-white/55 text-xs text-center pb-1">{t('auth.resetGoogleHint')}</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.newPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all"
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-xs text-center pt-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-white text-[#0d2461] font-heading text-lg uppercase tracking-wide py-3 rounded-xl hover:bg-gray-100 disabled:opacity-55 transition-all shadow-lg"
              >
                {isLoading ? t('auth.resetting') : t('auth.savePassword')}
              </motion.button>

              <label className="block pt-1">
                <span className="mb-2 block text-center text-[11px] font-semibold text-white/45">
                  {t('auth.chooseLanguage')}
                </span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", textTransform: 'none' }}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white outline-none transition-all focus:border-white/50 focus:bg-white/15"
                >
                  {SUPPORTED_LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value} className="bg-[#081021] text-white" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", textTransform: 'none' }}>
                      {item.nativeLabel}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
