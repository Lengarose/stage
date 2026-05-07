import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Trophy, Shield, Zap, ShoppingBag, ArrowRight } from 'lucide-react';
import BannerImg from '@/assets/Banner.jpg';
import HeroImg from '@/assets/WIS.PNG';
import HIWImg from '@/assets/HIW.PNG';
import StageDeskImg from '@/assets/Stage Desk.png';
import BFCHomeImg from '@/assets/BFC Home.PNG';
import LogoImg from '@/assets/Stadium Logo.png';

/* ─── fade-in wrapper ────────────────────────────────────── */
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

/* ─── alternating image + text band ─────────────────────── */
function FeatureBand({ image, title, body, reverse = false, objectPosition = 'center' }) {
  return (
    <div className={`grid gap-10 md:gap-16 items-center py-16 border-b border-white/10 last:border-0 ${reverse ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
      {!reverse && (
        <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <img src={image} alt={title} className="w-full h-full object-cover" style={{ objectPosition }} />
        </div>
      )}
      <div className="flex flex-col justify-center space-y-5">
        <p className="text-cyan-300/80 text-[10px] uppercase tracking-[0.35em] font-bold">Stage</p>
        <h3 className="text-white font-black uppercase leading-tight text-3xl md:text-5xl">{title}</h3>
        <p className="text-white/60 text-sm md:text-base leading-relaxed">{body}</p>
      </div>
      {reverse && (
        <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <img src={image} alt={title} className="w-full h-full object-cover" style={{ objectPosition }} />
        </div>
      )}
    </div>
  );
}

/* ─── data ───────────────────────────────────────────────── */
const HERO_CARDS = [
  { icon: Trophy,      title: 'Competitions', desc: 'Structured leagues, knockout cups, promotion and relegation.' },
  { icon: Shield,      title: 'Club Management', desc: 'Build squad identity, run budgets, and chase trophies.' },
  { icon: Zap,         title: 'Game Day', desc: 'Schedule fixtures, track results, and settle disputes quickly.' },
  { icon: ShoppingBag, title: 'Lifestyle & STC', desc: 'Spend earnings, buy assets, and flex your journey.' },
];

const FEATURES = [
  {
    title: 'Competitions & Leagues',
    desc: 'Enter structured regional leagues and knockout competitions. Every season has standings, match days, and a champion crowned at the final whistle.',
    accent: '#f59e0b', border: 'border-amber-500/25', bg: 'from-amber-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>,
  },
  {
    title: 'Club Management',
    desc: 'Found your club, set your formation, manage your wage budget, upgrade your stadium, and build a legacy across multiple seasons.',
    accent: '#3b82f6', border: 'border-blue-500/25', bg: 'from-blue-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    title: 'Game Day',
    desc: "Schedule matches, submit scores, and track every result in real time. Your club's form, streaks, and standings update instantly.",
    accent: '#10b981', border: 'border-emerald-500/25', bg: 'from-emerald-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    title: 'Player Contracts',
    desc: 'Sign to a club on a formal contract with wages, bonuses, and release clauses — just like the real game.',
    accent: '#8b5cf6', border: 'border-violet-500/25', bg: 'from-violet-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    title: 'Transfer Market',
    desc: 'Buy and sell players during transfer windows. Negotiate fees, wages, and bonuses with clubs across the platform.',
    accent: '#ef4444', border: 'border-red-500/25', bg: 'from-red-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>,
  },
  {
    title: 'Rankings & Live Stats',
    desc: 'Goals, assists, ratings, clean sheets — every stat tracked. See where you rank against every player on the platform.',
    accent: '#ec4899', border: 'border-pink-500/25', bg: 'from-pink-500/12 to-transparent',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
];

const STATS = [
  { value: '2 000+',  label: 'Active Players' },
  { value: '200+',    label: 'Clubs' },
  { value: '500+',    label: 'Competitions Played' },
  { value: '10 000+', label: 'Matches Recorded' },
];

const STEPS = [
  { num: '01', title: 'Create Your Profile', desc: 'Sign up, pick your position and platform, upload your photo, and build your player identity in minutes.' },
  { num: '02', title: 'Join or Found a Club', desc: 'Browse existing clubs and request to join, or create your own — set the name, badge, region, and start recruiting.' },
  { num: '03', title: 'Register & Compete', desc: 'Enter a regional league or competition, schedule your matches on Game Day, and chase the title every season.' },
];

/* ─── component ──────────────────────────────────────────── */
export default function Landing({ onSignIn }) {
  return (
    <div className="min-h-screen bg-[#010817] text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 px-6 md:px-12 flex items-center justify-between border-b border-white/10 bg-[#020a1f]/70 backdrop-blur-xl">
        <img src={LogoImg} alt="STAGE" className="h-12 w-auto object-contain" />
        <button
          onClick={onSignIn}
          className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/50 transition-all"
        >
          Sign In
        </button>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen pt-16 flex flex-col justify-center overflow-hidden">
        <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 blur-sm scale-105" />
        <img src={HeroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" style={{ objectPosition: 'center 10%' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020a1f]/70 via-[#020a1f]/75 to-[#010817]" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 35%, rgba(56,189,248,0.15), transparent 58%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-20 text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="text-cyan-300/85 text-[10px] md:text-xs uppercase tracking-[0.42em] font-bold mb-5"
          >
            The Competitive EA FC Platform
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="font-black uppercase leading-none tracking-tight mb-6"
            style={{ fontSize: 'clamp(3.5rem, 13vw, 9rem)' }}
          >
            <span className="text-white">Your </span>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Stage</span>
            <br />
            <span className="text-white">Awaits</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="text-white/65 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Leagues, competitions, clubs, contracts, and a community — everything the serious EA FC player needs, all in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button onClick={onSignIn} className="h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/60 transition-all hover:scale-105">
              Get Started — It&apos;s Free
            </button>
            <button onClick={onSignIn} className="h-12 px-10 rounded-xl border border-white/25 bg-white/10 hover:bg-white/15 text-sm font-bold uppercase tracking-[0.2em] transition-all">
              Sign In
            </button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HERO_CARDS.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={0.1 * i}>
                <div className="h-full rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent px-4 py-4 backdrop-blur-sm text-left">
                  <Icon className="w-5 h-5 text-cyan-300 mb-2" />
                  <p className="font-black uppercase text-sm tracking-wide">{title}</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
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

      {/* ── PICTURE SECTIONS ─────────────────────────────── */}
      <section className="py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <FeatureBand
              image={HIWImg}
              title="Play In A Real Competitive Ecosystem"
              body="From registration to finals, STAGE provides a complete competitive structure with fixtures, standings, and transparent progression. Every season crowns a champion."
            />
          </FadeIn>
          <FadeIn>
            <FeatureBand
              image={StageDeskImg}
              title="Manage Club Decisions Like A Pro"
              body="Control contracts, transfer strategy, budgets, and squad planning. Every decision shapes your season and builds your club's identity."
              reverse
            />
          </FadeIn>
          <FadeIn>
            <FeatureBand
              image={BFCHomeImg}
              title="Build Your Identity Beyond Matchday"
              body="Track achievements, grow your lifestyle profile, and turn your results into status both on and off the pitch."
              objectPosition="center top"
            />
          </FadeIn>
        </div>
      </section>

      {/* ── FEATURE GRID ─────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-blue-950/15 to-transparent">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.35em] mb-4">Everything you need</p>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white">
              One Platform.<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Every Feature.</span>
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon, title, desc, accent, bg, border }, i) => (
              <FadeIn key={title} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`group relative rounded-2xl border ${border} bg-gradient-to-br ${bg} p-6 h-full cursor-default overflow-hidden`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 0% 0%, ${accent}18, transparent 60%)` }} />
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-xl" style={{ background: `${accent}20`, color: accent }}>{icon}</div>
                    <h3 className="text-base font-black uppercase tracking-wide text-white mb-2">{title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.35em] mb-4">Get started in minutes</p>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white">How It Works</h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }, i) => (
              <FadeIn key={num} delay={i * 0.12}>
                <div className="relative text-center md:text-left">
                  {i < 2 && <div className="hidden md:block absolute top-8 left-[calc(100%+1rem)] w-8 h-px bg-gradient-to-r from-blue-500/50 to-transparent" />}
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
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/12 to-blue-500/10 p-10 md:p-14 text-center">
              <p className="text-cyan-300/80 uppercase tracking-[0.3em] text-[10px] font-bold mb-4">Your next season starts now</p>
              <h2 className="text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight mb-5">
                Ready To Enter<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">The Arena?</span>
              </h2>
              <p className="max-w-xl mx-auto text-white/70 text-sm md:text-base mb-8">
                Thousands of players and clubs are already active. Sign up free and find your competition.
              </p>
              <button
                onClick={onSignIn}
                className="h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/60 transition-all hover:scale-105 inline-flex items-center gap-2"
              >
                Start Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
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
