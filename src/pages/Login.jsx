import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stageClient } from '@/api/stageClient';
import { useAuth } from '@/lib/AuthContext';
import { ensureAdminPanelMode, isAppAdminUser } from '@/lib/adminAuth';
import BannerImg from '@/assets/Banner.jpg';
import LogoImg from '@/assets/Stadium Logo.png';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.3C9.7 35.7 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40.9 36 44 31.5 44 24c0-1.2-.1-2.4-.4-3.5z"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 21 21">
    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 814 1000" fill="currentColor">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.5-49 191.3-49 30.8 0 110.7 2.6 162.6 63.1zm-234.5-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
  </svg>
);

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

const ProviderButton = ({ onClick, icon, label, className = '' }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    className={`w-full flex items-center justify-center gap-3 font-semibold py-3 rounded-xl transition-colors shadow-lg ${className}`}
  >
    {icon}
    {label}
  </motion.button>
);

export default function Login() {
  const { checkUserAuth } = useAuth();
  const [mode, setMode] = useState('signin');
  const isSignup = mode === 'signup';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const { access_token } = isSignup
        ? await stageClient.auth.registerViaEmailPassword({ email: identifier, password })
        : await stageClient.auth.loginViaEmailPassword(identifier, password);
      if (access_token) {
        stageClient.auth.setToken(access_token);
        await checkUserAuth();
        const u = await stageClient.auth.me().catch(() => null);
        if (isAppAdminUser(u)) ensureAdminPanelMode();
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } catch (err) {
      const serverError = err?.error || err?.message || '';
      if (isSignup && String(serverError).toLowerCase().includes('this user with this email exist')) {
        setError('An account with this email already exists.');
      } else {
        setError(serverError || (isSignup ? 'Unable to create account. Please try again.' : 'Invalid email, gamertag, or password.'));
      }
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
      {/* Background */}
      <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm mx-4"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">

          {/* Branding */}
          <div className="flex flex-col items-center mb-7 gap-2">
            <img src={LogoImg} alt="STAGE" className="h-24 w-auto object-contain" />
            <p className="text-white/50 text-xs uppercase tracking-[0.25em]">
              {isSignup ? 'Create account' : 'Welcome back'}
            </p>
          </div>

          {/* OAuth providers */}
          <div className="space-y-3 mb-5">
            <ProviderButton
              onClick={() => stageClient.auth.loginWithProvider('google', window.location.href)}
              icon={<GoogleIcon />}
              label="Continue with Google"
              className="bg-white text-gray-800 hover:bg-gray-100 active:bg-gray-200"
            />
            <ProviderButton
              onClick={() => stageClient.auth.loginWithProvider('microsoft', window.location.href)}
              icon={<MicrosoftIcon />}
              label="Continue with Outlook"
              className="bg-[#0078D4] text-white hover:bg-[#006CBE] active:bg-[#005EA6]"
            />
            <ProviderButton
              onClick={() => stageClient.auth.loginWithProvider('apple', window.location.href)}
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
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              type={isSignup ? 'email' : 'text'}
              placeholder={isSignup ? 'Email address' : 'Email, gamertag, or club name'}
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {isSignup && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            )}

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
              className="w-full bg-white text-[#0d2461] font-bold py-3 rounded-xl hover:bg-gray-100 disabled:opacity-55 transition-all shadow-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#0d2461]/25 border-t-[#0d2461] rounded-full animate-spin" />
                  {isSignup ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : (isSignup ? 'Create Account' : 'Sign In')}
            </motion.button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMode(isSignup ? 'signin' : 'signup');
              }}
              className="w-full text-center text-xs text-white/60 hover:text-white/90 transition-colors pt-1"
            >
              {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
