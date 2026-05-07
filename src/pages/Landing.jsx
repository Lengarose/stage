import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Trophy, Shield, Zap, ShoppingBag, ArrowRight } from 'lucide-react';
import BannerImg from '@/assets/Banner.jpg';
import HeroImg from '@/assets/WIS.PNG';
import HIWImg from '@/assets/HIW.PNG';
import StageDeskImg from '@/assets/Stage Desk.png';
import BFCHomeImg from '@/assets/BFC Home.PNG';
import LogoImg from '@/assets/Stadium Logo.png';

const ITEMS = [
  { icon: Trophy, title: 'Competitions', desc: 'Structured leagues, knockout cups, promotion and relegation.' },
  { icon: Shield, title: 'Club Management', desc: 'Build squad identity, run budgets, and chase trophies.' },
  { icon: Zap, title: 'Game Day', desc: 'Schedule fixtures, track results, and settle disputes quickly.' },
  { icon: ShoppingBag, title: 'Lifestyle & STC', desc: 'Spend earnings, buy assets, and flex your journey.' },
];

const FadeIn = ({ children, delay = 0 }) => {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, margin: '-120px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
};

function FeatureBand({ image, title, body, reverse = false }) {
  return (
    <div className={`grid gap-8 items-center py-14 border-b border-white/10 ${reverse ? 'md:grid-cols-[1.1fr,1fr]' : 'md:grid-cols-[1fr,1.1fr]'}`}>
      {!reverse && <img src={image} alt={title} className="w-full h-64 md:h-80 object-cover rounded-2xl border border-white/15" />}
      <div>
        <p className="text-cyan-300/80 text-[10px] uppercase tracking-[0.35em] font-bold mb-3">Stage</p>
        <h3 className="text-white font-black uppercase leading-tight text-3xl md:text-5xl">{title}</h3>
        <p className="text-white/65 mt-4 leading-relaxed text-sm md:text-base">{body}</p>
      </div>
      {reverse && <img src={image} alt={title} className="w-full h-64 md:h-80 object-cover rounded-2xl border border-white/15" />}
    </div>
  );
}

export default function Landing({ onSignIn }) {
  return (
    <div className="min-h-screen bg-[#010817] text-white">
      <nav className="fixed top-0 inset-x-0 z-50 h-16 px-5 md:px-12 flex items-center justify-between border-b border-white/10 bg-[#020a1f]/70 backdrop-blur-xl">
        <img src={LogoImg} alt="STAGE" className="h-10 w-auto object-contain" />
        <button
          onClick={onSignIn}
          className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/50 transition-all"
        >
          Sign In
        </button>
      </nav>

      <section className="relative min-h-screen pt-16 overflow-hidden">
        <img src={BannerImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105" />
        <img src={HeroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020a1f]/75 via-[#020a1f]/80 to-[#010817]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.18),transparent_58%)]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
          <FadeIn>
            <p className="text-cyan-300/85 text-[10px] md:text-xs uppercase tracking-[0.42em] font-bold text-center">
              The Ultimate Platform For EA FC Clubs
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="mt-4 text-center font-black uppercase leading-[0.86] tracking-tight" style={{ fontSize: 'clamp(3.5rem, 13vw, 9rem)' }}>
              <span className="text-white">Where</span><br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Champions</span><br />
              <span className="text-white">Are Made</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="max-w-2xl mx-auto mt-6 text-center text-white/75 text-sm md:text-lg leading-relaxed">
              Create your identity, manage your club, compete in real seasons, and build a legacy with trophies, transfers, contracts, and STC progression.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onSignIn}
                className="h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/60 transition-all"
              >
                Get Started — It&apos;s Free
              </button>
              <button
                onClick={onSignIn}
                className="h-12 px-10 rounded-xl border border-white/25 bg-white/10 hover:bg-white/15 text-sm font-bold uppercase tracking-[0.2em] transition-all"
              >
                Sign In
              </button>
            </div>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ITEMS.map(({ icon: Icon, title, desc }, idx) => (
              <FadeIn key={title} delay={0.1 * idx}>
                <div className="h-full rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent px-4 py-4 backdrop-blur-sm">
                  <Icon className="w-5 h-5 text-cyan-300 mb-2" />
                  <p className="font-black uppercase text-sm tracking-wide">{title}</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <FeatureBand
            image={HIWImg}
            title="Play In A Real Competitive Ecosystem"
            body="From registration to finals, STAGE provides a complete competitive structure with fixtures, standings, and transparent progression."
          />
          <FeatureBand
            image={StageDeskImg}
            title="Manage Club Decisions Like A Pro"
            body="Control contracts, transfer strategy, budgets, and squad planning. Every decision shapes your season."
            reverse
          />
          <FeatureBand
            image={BFCHomeImg}
            title="Build Your Identity Beyond Matchday"
            body="Track achievements, grow your lifestyle profile, and turn your results into status both on and off the pitch."
          />

          <FadeIn delay={0.2}>
            <div className="mt-16 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/12 to-blue-500/10 p-10 md:p-14 text-center">
              <p className="text-cyan-300/80 uppercase tracking-[0.3em] text-[10px] font-bold mb-4">Your next season starts now</p>
              <h2 className="text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                Ready To Enter<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">The Arena?</span>
              </h2>
              <p className="max-w-xl mx-auto mt-5 text-white/70 text-sm md:text-base">
                Join the platform where clubs are built, legends are made, and every fixture matters.
              </p>
              <button
                onClick={onSignIn}
                className="mt-8 h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/60 transition-all inline-flex items-center gap-2"
              >
                Start Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}

