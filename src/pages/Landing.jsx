import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import BannerImg from '@/assets/Banner.jpg';
import LogoImg from '@/assets/Logo.PNG';

/* ─── inline icons ───────────────────────────────────────── */
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
    <path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><path d="M12 17v4"/><path d="M8 21h8"/>
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ArrowRightLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
  </svg>
);
const ContractIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

/* ─── data ───────────────────────────────────────────────── */
const FEATURES = [
  {
    Icon: TrophyIcon,
    title: 'Tournaments',
    desc: 'Create tournaments. Run group stages, knockout brackets, and league competitions — with automated prize distribution at the final whistle.',
    accent: '#f59e0b',
    bg: 'from-amber-500/15 to-transparent',
    border: 'border-amber-500/25',
  },
  {
    Icon: ShieldIcon,
    title: 'Club Management',
    desc: 'Build your squad, manage club finances, fill your trophy cabinet, upgrade your stadium, and climb the rankings every season.',
    accent: '#3b82f6',
    bg: 'from-blue-500/15 to-transparent',
    border: 'border-blue-500/25',
  },
  {
    Icon: ArrowRightLeft,
    title: 'Transfer Market',
    desc: 'Buy and sell players during transfer windows. Negotiate fees, wages, and bonus clauses in real time.',
    accent: '#10b981',
    bg: 'from-emerald-500/15 to-transparent',
    border: 'border-emerald-500/25',
  },
  {
    Icon: ContractIcon,
    title: 'Player Contracts',
    desc: 'Get signed by a clubs team, negotiate your contract with performance bonuses, salary caps, and much more.',
    accent: '#8b5cf6',
    bg: 'from-violet-500/15 to-transparent',
    border: 'border-violet-500/25',
  },
  {
    Icon: ChartIcon,
    title: 'Live Stats & Rankings',
    desc: 'Track every goal, assist, and clean sheet. Real-time leaderboards keep the competition fierce.',
    accent: '#ef4444',
    bg: 'from-red-500/15 to-transparent',
    border: 'border-red-500/25',
  },
  {
    Icon: HomeIcon,
    title: 'Lifestyle & Assets',
    desc: 'Spend your earnings on mansions, supercars, and exclusive gear — flex your status off the pitch.',
    accent: '#ec4899',
    bg: 'from-pink-500/15 to-transparent',
    border: 'border-pink-500/25',
  },
];

const STATS = [
  { value: '2 000+', label: 'Active Players' },
  { value: '200+',   label: 'Clubs' },
  { value: '500+',   label: 'Tournaments Played' },
  { value: '10 000+',label: 'Matches Recorded' },
];

const STEPS = [
  { num: '01', title: 'Create Your Profile', desc: 'Sign up, set your position, and build your player identity in minutes.' },
  { num: '02', title: 'Join or Found a Club', desc: 'Represent a club, negotiate your contract, and train with your squad.' },
  { num: '03', title: 'Compete & Dominate', desc: 'Enter tournaments, climb the leaderboard, and chase every trophy.' },
];

/* ─── animated section wrapper ──────────────────────────── */
const FadeIn = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── component ──────────────────────────────────────────── */
export default function Landing({ onSignIn }) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <img src={LogoImg} alt="STAGE" className="h-20 w-auto object-contain" />
        <button
          onClick={onSignIn}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold uppercase tracking-wider transition-colors"
        >
          Sign In
        </button>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-6">
        {/* background */}
        <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/45 to-background" />

        {/* content */}
        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-blue-400 text-xs md:text-sm font-bold uppercase tracking-[0.35em] mb-5"
          >
            The Ultimate Platform For EA FC Clubs
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl md:text-8xl lg:text-9xl font-black uppercase leading-none tracking-tight mb-6"
          >
            <span className="text-white">Where </span>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Champions</span>
            <br />
            <span className="text-white">Are Made</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-white/60 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Compete in tournaments, create your lifestyle, manage your club — all in one platform built for EA FC players.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onSignIn}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl text-sm transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:scale-105"
            >
              Get Started — It's Free
            </button>
            <button
              onClick={onSignIn}
              className="px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold uppercase tracking-widest rounded-xl text-sm transition-all backdrop-blur-sm"
            >
              Sign In
            </button>
          </motion.div>
        </div>

        {/* scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 flex flex-col items-center gap-1 text-white/30 text-xs"
        >
          <span className="uppercase tracking-widest text-[10px]">Scroll</span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ChevronDown />
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────── */}
      <section className="border-y border-white/8 bg-white/3">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/8">
          {STATS.map(({ value, label }, i) => (
            <FadeIn key={label} delay={i * 0.08}>
              <div className="py-10 px-6 text-center">
                <p className="text-3xl md:text-4xl font-black text-white mb-1">{value}</p>
                <p className="text-white/40 text-xs uppercase tracking-widest">{label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.35em] mb-4">Everything you need</p>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white">
              Built for the<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Competitive Player</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, desc, accent, bg, border }, i) => (
              <FadeIn key={title} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`group relative rounded-2xl border ${border} bg-gradient-to-br ${bg} p-6 h-full cursor-default overflow-hidden`}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle at 0% 0%, ${accent}12, transparent 60%)` }}
                  />
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-xl" style={{ background: `${accent}20`, color: accent }}>
                      <Icon />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-wide text-white mb-2">{title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-28 px-6 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.35em] mb-4">Simple process</p>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white">How It Works</h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }, i) => (
              <FadeIn key={num} delay={i * 0.12}>
                <div className="relative text-center md:text-left">
                  {/* connector line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute top-8 left-[calc(100%+1rem)] w-8 h-px bg-gradient-to-r from-blue-500/50 to-transparent" />
                  )}
                  <p className="text-6xl font-black text-white/5 leading-none mb-4">{num}</p>
                  <h3 className="text-xl font-black uppercase tracking-wide text-white mb-3 -mt-8">{title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section className="relative py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 via-blue-800/10 to-blue-900/30" />
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, #3b82f6 0%, transparent 70%)' }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <FadeIn>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.35em] mb-4">Join the community</p>
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-6">
              Ready to<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Play?</span>
            </h2>
            <p className="text-white/50 text-base mb-10 leading-relaxed">
              Thousands of players are already competing. Your club is waiting.
            </p>
            <button
              onClick={onSignIn}
              className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl text-sm transition-all shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/50 hover:scale-105"
            >
              Start Playing Now
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={LogoImg} alt="STAGE" className="h-9 w-auto object-contain opacity-40" />
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Stage. All rights reserved.</p>
          <button onClick={onSignIn} className="text-blue-400 hover:text-blue-300 text-xs font-semibold uppercase tracking-widest transition-colors">
            Sign In →
          </button>
        </div>
      </footer>
    </div>
  );
}
