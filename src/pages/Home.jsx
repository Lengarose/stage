import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import HeroImg from "@/assets/WIS.PNG";
import StageDeskImg from "@/assets/Stage Desk.png";
import BFCHomeImg from "@/assets/BFC Home.PNG";
import HIWImg from "@/assets/HIW.PNG";
import {
  Trophy, Zap, ShoppingBag, Shield, Users, Gamepad2, Award,
  ArrowRight, Mail, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Defaults shown before/without a LandingPageContent record ── */
const DEFAULTS = {
  hero_title:        "Welcome To",
  hero_subtitle:     "STAGE",
  hero_description:  "Create your club, compete in structured leagues and tournaments, and build your legacy in the ultimate competitive football gaming community.",
  hero_image_url:    HeroImg,
  hero_cta_1_label:  "Competitions",
  hero_cta_1_url:    "/competitions",
  hero_cta_2_label:  "Game Day",
  hero_cta_2_url:    "/game-day",
  hero_cta_3_label:  "Store",
  hero_cta_3_url:    "/lifestyle",
  section1_title:    "What is STAGE?",
  section1_text:     "STAGE is the premier structured competitive platform for EA FC players. We provide the infrastructure for real clubs, real leagues, and real trophies — all within a professional community built around the game.",
  section1_image_url: HIWImg,
  section2_title:    "How It Works",
  section2_text:     "Register your club, sign players to contracts, and enter league seasons or knockout tournaments. Every match is tracked, every goal counts, and every season crowns a champion.",
  section2_image_url: StageDeskImg,
  section3_title:    "Built for Competitors",
  section3_text:     "From transfer markets and player contracts to STC rewards and custom trophies — STAGE gives serious players the structure and recognition their game deserves.",
  section3_image_url: BFCHomeImg,
  faq_items: [
    { question: "How do I join STAGE?",                   answer: "Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions." },
    { question: "What game does STAGE support?",           answer: "STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox." },
    { question: "How do leagues and competitions work?",   answer: "Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time." },
    { question: "What are STC points?",                   answer: "STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features." },
    { question: "Is STAGE free to use?",                  answer: "Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay." },
  ],
  contact_email:  "contact@stage.gg",
  footer_tagline: "The premier competitive football gaming platform.",
};

const NAV_CARDS = [
  { icon: Trophy,      label: "Competitions", desc: "Leagues & knockout cups",  to: "/competitions", accent: "amber"   },
  { icon: Zap,         label: "Game Day",      desc: "Schedule & play matches",  to: "/game-day",     accent: "primary" },
  { icon: Shield,      label: "Clubs",         desc: "Browse & manage clubs",    to: "/clubs",        accent: "blue"    },
  { icon: ShoppingBag, label: "Store",         desc: "Spend your STC coins",     to: "/lifestyle",    accent: "purple"  },
];

const ACCENT = {
  amber:   { bg: "from-amber-500/20 to-amber-500/5",    border: "border-amber-500/25",   icon: "text-amber-400"   },
  primary: { bg: "from-primary/20 to-primary/5",        border: "border-primary/25",     icon: "text-primary"     },
  blue:    { bg: "from-blue-500/20 to-blue-500/5",      border: "border-blue-500/25",    icon: "text-blue-400"    },
  purple:  { bg: "from-purple-500/20 to-purple-500/5",  border: "border-purple-500/25",  icon: "text-purple-400"  },
};

const SECTION_ICONS = [Users, Gamepad2, Award];

/* ── FAQ accordion item ─────────────────────────────────────── */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-colors",
      open ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card"
    )}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-bold text-sm text-foreground">{question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0 text-primary" />
          : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

/* ── Alternating image / text section ───────────────────────── */
function FeatureSection({ title, text, imageUrl, icon: Icon, flip, objectPosition = "center" }) {
  const img = imageUrl ? (
    <img src={imageUrl} alt={title} className="w-full h-56 sm:h-72 object-cover rounded-2xl border border-border" style={{ objectPosition }} />
  ) : (
    <div className="w-full h-56 sm:h-72 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center">
      <Icon className="w-12 h-12 text-muted-foreground/20" />
    </div>
  );

  const txt = (
    <div className="flex flex-col justify-center space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.28em]">STAGE</span>
      </div>
      <h2
        className="font-heading font-black uppercase leading-tight text-foreground"
        style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
      >
        {title}
      </h2>
      <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{text}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-14 items-center py-14 border-b border-border/40 last:border-0">
      {flip ? <>{txt}{img}</> : <>{img}{txt}</>}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function Home() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    (stageClient.entities.LandingPageContent?.filter({}, null, 1) ?? Promise.resolve([]))
      .catch(() => [])
      .then(rows => { if (rows[0]) setContent(rows[0]); });
  }, []);

  const c = { ...DEFAULTS, ...content };

  return (
    <div className="min-h-screen">

      {/* ══════════════════════════════════════════════════════
          HERO
         ══════════════════════════════════════════════════════ */}
      <section
        className="relative flex items-center overflow-hidden"
        style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw", minHeight: "88vh" }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${c.hero_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center 10%",
          }}
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-black/10" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 45%)" }}
        />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-28">
          <p
            className="font-heading font-bold uppercase mb-1 text-xs sm:text-sm"
            style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.35em" }}
          >
            {c.hero_title}
          </p>
          <h1
            className="font-heading font-black leading-none"
            style={{
              fontSize: "clamp(5.5rem, 18vw, 11rem)",
              color: "hsl(189,100%,52%)",
              textShadow: "0 0 30px hsl(189 100% 52% / 0.6), 0 0 90px hsl(189 100% 52% / 0.25)",
            }}
          >
            {c.hero_subtitle}
          </h1>
          <p
            className="mt-6 max-w-md text-sm sm:text-base leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {c.hero_description}
          </p>
          <div className="flex flex-wrap gap-3 mt-9">
            <Link to={c.hero_cta_1_url}>
              <Button
                size="lg"
                className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Trophy className="w-4 h-4" /> {c.hero_cta_1_label}
              </Button>
            </Link>
            <Link to={c.hero_cta_2_url}>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm"
                style={{ color: "white", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.07)" }}
              >
                <Zap className="w-4 h-4" /> {c.hero_cta_2_label}
              </Button>
            </Link>
            <Link to={c.hero_cta_3_url}>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm"
                style={{ color: "white", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.07)" }}
              >
                <ShoppingBag className="w-4 h-4" /> {c.hero_cta_3_label}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURE SECTIONS
         ══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-8">
        {[
          { title: c.section1_title, text: c.section1_text, imageUrl: c.section1_image_url, flip: false },
          { title: c.section2_title, text: c.section2_text, imageUrl: c.section2_image_url, flip: true  },
          { title: c.section3_title, text: c.section3_text, imageUrl: c.section3_image_url, flip: false, objectPosition: "center top" },
        ].map((s, i) => (
          <FeatureSection key={i} {...s} icon={SECTION_ICONS[i]} />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          QUICK NAVIGATION
         ══════════════════════════════════════════════════════ */}
      <section
        className="border-y border-border py-16"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          width: "100vw",
          background: "hsl(var(--secondary) / 0.3)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-1">Platform</p>
          <h2
            className="font-heading font-black uppercase text-foreground mb-1"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
          >
            Jump In
          </h2>
          <p className="text-muted-foreground text-sm mb-8">Everything you need, one tap away.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {NAV_CARDS.map(card => {
              const a = ACCENT[card.accent];
              return (
                <Link key={card.to} to={card.to}>
                  <div className={cn(
                    "group relative overflow-hidden rounded-2xl border p-5 h-full",
                    "bg-gradient-to-br transition-all duration-200 hover:scale-[1.02]",
                    a.bg, a.border
                  )}>
                    <card.icon className={cn("w-8 h-8 mb-3", a.icon)} />
                    <p className="font-heading font-black text-base sm:text-lg uppercase text-foreground tracking-wide">
                      {card.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 absolute bottom-4 right-4 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FAQ
         ══════════════════════════════════════════════════════ */}
      <section className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-1 text-center">Questions</p>
        <h2
          className="font-heading font-black uppercase text-foreground text-center mb-2"
          style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
        >
          FAQ
        </h2>
        <p className="text-muted-foreground text-sm text-center mb-8">
          Common questions about the platform.
        </p>
        <div className="space-y-2">
          {(c.faq_items || []).map((item, i) => (
            <FaqItem key={i} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
         ══════════════════════════════════════════════════════ */}
      <footer
        className="border-t border-border"
        style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw", background: "hsl(var(--card))" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">

            {/* Brand */}
            <div>
              <p
                className="font-heading font-black text-4xl uppercase mb-3"
                style={{ color: "hsl(189,100%,52%)", textShadow: "0 0 16px hsl(189 100% 52% / 0.35)" }}
              >
                STAGE
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {c.footer_tagline}
              </p>
            </div>

            {/* Platform links */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">
                Platform
              </p>
              <div className="space-y-2">
                {[
                  ["Competitions", "/competitions"],
                  ["Game Day",     "/game-day"],
                  ["Clubs",        "/clubs"],
                  ["Rankings",     "/rankings"],
                  ["Store",        "/lifestyle"],
                ].map(([label, to]) => (
                  <Link key={to} to={to} className="block text-sm text-foreground/60 hover:text-foreground transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">
                Contact
              </p>
              <a
                href={`mailto:${c.contact_email}`}
                className="flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {c.contact_email}
              </a>
            </div>

          </div>
          <div className="border-t border-border pt-6 text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} STAGE. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
