import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import HeroImg from "@/assets/WIS.PNG";
import StageDeskImg from "@/assets/Stage Desk.png";
import BFCHomeImg from "@/assets/BFC Home.PNG";
import HIWImg from "@/assets/HIW.PNG";
import {
  Trophy, Zap, ShoppingBag, Shield, Users, Gamepad2, Award,
  ArrowRight, Mail, ChevronDown, ChevronUp, Calendar, Inbox,
  Newspaper, Clock, CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMPETITIONS } from "@/lib/competitionUtils";

/* ── Defaults ──────────────────────────────────────────────── */
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

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── FAQ accordion item ──────────────────────────────────── */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-colors",
      open ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card"
    )}>
      <button type="button" className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpen(o => !o)}>
        <span className="font-bold text-sm text-foreground">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0 text-primary" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5"><p className="text-sm text-muted-foreground leading-relaxed">{answer}</p></div>}
    </div>
  );
}

/* ── Alternating image / text section ───────────────────── */
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
      <h2 className="font-heading font-black uppercase leading-tight text-foreground" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}>
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

/* ══════════════════════════════════════════════════════════
   SECTION A — COMPETITIONS STRIP
   Full-width cinematic tier bar
   ══════════════════════════════════════════════════════════ */
function CompetitionsStrip({ seasons }) {
  const statusLabel = (s) => {
    if (!s) return null;
    if (s === "league_phase") return { text: "LIVE",         cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    if (s === "registration") return { text: "OPEN",         cls: "bg-[hsl(189,100%,52%)]/15 text-[hsl(189,100%,52%)] border-[hsl(189,100%,52%)]/30" };
    if (s === "playoffs")     return { text: "PLAYOFFS",     cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
    if (s === "knockout")     return { text: "KNOCKOUT",     cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
    return null;
  };

  return (
    <section
      className="border-y border-white/8 py-14 relative overflow-hidden"
      style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw",
        background: "linear-gradient(135deg, #060e1f 0%, #0a1628 50%, #060e1f 100%)" }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 80% at 50% 50%, hsl(189 100% 52% / 0.04) 0%, transparent 70%)"
      }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[hsl(189,100%,52%)]/70 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">Platform</p>
            <h2 className="font-heading font-black uppercase text-white leading-none"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
              Competitions
            </h2>
          </div>
          <Link to="/competitions" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[hsl(189,100%,52%)] transition-colors font-medium uppercase tracking-widest">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COMPETITIONS.map((comp, i) => {
            const season = seasons?.find(s => s.competition_name?.toLowerCase().includes(comp.slug) || s.tier === comp.tier);
            const badge  = season ? statusLabel(season.status) : null;
            return (
              <Link key={comp.slug} to="/competitions" className="group block">
                <div className="relative overflow-hidden rounded-2xl border border-white/8 group-hover:border-white/20 transition-all duration-300 p-6 h-full"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  {/* Tier accent line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: comp.color }} />
                  {/* Rank number watermark */}
                  <div className="absolute right-4 top-4 font-heading font-black text-6xl leading-none select-none pointer-events-none"
                    style={{ color: comp.color, opacity: 0.06 }}>
                    {i + 1}
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${comp.color}18`, border: `1px solid ${comp.color}30` }}>
                      <Trophy className="w-5 h-5" style={{ color: comp.color }} />
                    </div>
                    {badge && (
                      <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border", badge.cls)}>
                        {badge.text}
                      </span>
                    )}
                  </div>

                  <p className="text-white/40 text-[9px] uppercase tracking-[0.3em] font-bold mb-1">Tier {comp.tier}</p>
                  <h3 className="font-heading font-black text-white uppercase leading-tight text-lg mb-2 group-hover:text-[hsl(189,100%,52%)] transition-colors">
                    {comp.name.replace("STAGE ", "")}
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed">{comp.description}</p>

                  <div className="flex items-center gap-1.5 mt-5 text-white/30 text-[10px] font-medium group-hover:text-[hsl(189,100%,52%)] transition-colors">
                    View bracket <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION B — NEWS MOSAIC
   Asymmetric editorial grid
   ══════════════════════════════════════════════════════════ */
function NewsMosaic({ items }) {
  if (!items?.length) return null;

  const [featured, ...rest] = items.slice(0, 4);

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[hsl(189,100%,52%)]/70 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">Latest</p>
          <h2 className="font-heading font-black uppercase text-foreground leading-none"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
            News
          </h2>
        </div>
        <Link to="/news" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium uppercase tracking-widest">
          All news <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Featured — large left card */}
        {featured && (
          <Link to="/news" className="lg:col-span-3 group block">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card h-full min-h-[260px] flex flex-col hover:border-primary/30 transition-all duration-300">
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[hsl(189,100%,52%)] to-transparent" />
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-wider">
                    <Newspaper className="w-2.5 h-2.5" /> Featured
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(featured.published_at)}</span>
                </div>
                <h3 className="font-heading font-black text-foreground text-xl sm:text-2xl uppercase leading-tight group-hover:text-primary transition-colors flex-1 mb-4">
                  {featured.title}
                </h3>
                {featured.body && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">{featured.body}</p>
                )}
                {(featured.club_name || featured.player_name) && (
                  <div className="flex items-center gap-2 mt-auto">
                    {featured.club_logo_url && (
                      <img src={featured.club_logo_url} alt="" className="w-5 h-5 rounded-full object-cover border border-border" />
                    )}
                    {featured.player_avatar_url && (
                      <img src={featured.player_avatar_url} alt="" className="w-5 h-5 rounded-full object-cover border border-border" />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {featured.club_name || featured.player_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* Side stack */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {rest.slice(0, 3).map((item) => (
            <Link key={item.id} to="/news" className="group block flex-1">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 hover:border-primary/30 transition-all duration-300 h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">{item._category || item.category || "News"}</span>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">{timeAgo(item.published_at)}</span>
                </div>
                <p className="font-bold text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION C — SCHEDULE FRAME
   Wide angled timeline
   ══════════════════════════════════════════════════════════ */
function ScheduleFrame({ matches }) {
  const formatDate = (d) => {
    if (!d) return "TBD";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " +
           dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const statusBadge = (s) => {
    if (s === "live")      return "text-emerald-400";
    if (s === "completed") return "text-white/30 line-through";
    return "text-[hsl(189,100%,52%)]";
  };

  return (
    <section
      className="py-14 relative overflow-hidden"
      style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw",
        background: "linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--secondary)/0.3) 50%, hsl(var(--background)) 100%)" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">

          {/* Left — heading block */}
          <div className="lg:col-span-1 flex flex-col justify-center">
            <p className="text-[hsl(189,100%,52%)]/70 text-[10px] uppercase tracking-[0.35em] font-bold mb-2">Upcoming</p>
            <h2 className="font-heading font-black uppercase text-foreground leading-none mb-4"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
              Schedule
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Track every fixture across all competitions. Game Day is where it all happens.
            </p>
            <Link to="/game-day">
              <Button className="gap-2 font-heading font-black uppercase tracking-wider text-sm bg-primary text-primary-foreground hover:bg-primary/90 w-fit">
                <Calendar className="w-4 h-4" /> Game Day
              </Button>
            </Link>
          </div>

          {/* Right — match list */}
          <div className="lg:col-span-2">
            {!matches?.length ? (
              <div className="text-center py-12 text-muted-foreground/40 text-sm border border-border rounded-2xl">
                No upcoming matches scheduled.
              </div>
            ) : (
              <div className="space-y-2">
                {matches.slice(0, 6).map((m, i) => {
                  const home = m.home_club_name || m.home_player_name || "TBD";
                  const away = m.away_club_name || m.away_player_name || "TBD";
                  const isLive = m.status === "live";
                  return (
                    <div key={m.id || i}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:border-primary/25 transition-all group">
                      {/* Time */}
                      <div className="shrink-0 w-20 text-center">
                        <div className={cn("text-xs font-black", statusBadge(m.status))}>
                          {isLive ? "LIVE" : formatDate(m.scheduled_date)}
                        </div>
                        {m.competition && (
                          <div className="text-[9px] text-muted-foreground/50 mt-0.5 truncate">{m.competition}</div>
                        )}
                      </div>
                      {/* Divider */}
                      <div className="w-px h-8 bg-border shrink-0" />
                      {/* Match */}
                      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                        <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{home}</span>
                        <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest shrink-0">vs</span>
                        <span className="font-bold text-sm text-foreground truncate text-right group-hover:text-primary transition-colors">{away}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION D — INBOX PANEL
   Notification-style message list
   ══════════════════════════════════════════════════════════ */
function InboxPanel({ messages, user }) {
  const unread = messages?.filter(m => !m.is_read).length || 0;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl ml-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[hsl(189,100%,52%)]/70 text-[10px] uppercase tracking-[0.35em] font-bold mb-1">Messages</p>
            <div className="flex items-center gap-3">
              <h2 className="font-heading font-black uppercase text-foreground leading-none"
                style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                Inbox
              </h2>
              {unread > 0 && (
                <span className="bg-[hsl(189,100%,52%)] text-black text-xs font-black px-2 py-0.5 rounded-full shadow-[0_0_12px_hsl(189_100%_52%/0.5)]">
                  {unread}
                </span>
              )}
            </div>
          </div>
          <Link to="/inbox" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium uppercase tracking-widest">
            Open <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!user ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Sign in to view your messages.</p>
            <Link to="/login">
              <Button variant="outline" size="sm" className="font-heading font-black uppercase tracking-wider text-xs">
                Sign In
              </Button>
            </Link>
          </div>
        ) : !messages?.length ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Your inbox is empty.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {messages.slice(0, 5).map((msg) => (
              <Link key={msg.id} to="/inbox" className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition-colors group">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full border border-border overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                  {msg.sender_avatar_url ? (
                    <img src={msg.sender_avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      {msg.is_system ? "S" : (msg.sender_gamertag || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-bold truncate", !msg.is_read ? "text-foreground" : "text-muted-foreground")}>
                      {msg.is_system ? "STAGE System" : (msg.sender_gamertag || "Unknown")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-auto">
                      {timeAgo(msg.created_date)}
                    </span>
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", !msg.is_read ? "text-foreground/70" : "text-muted-foreground/50")}>
                    {msg.subject}
                  </p>
                </div>
                {/* Read indicator */}
                <div className="shrink-0">
                  {!msg.is_read
                    ? <Circle className="w-2 h-2 fill-[hsl(189,100%,52%)] text-[hsl(189,100%,52%)]" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/20" />
                  }
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════ */
export default function Home() {
  const [content,    setContent]    = useState(null);
  const [seasons,    setSeasons]    = useState([]);
  const [newsItems,  setNewsItems]  = useState([]);
  const [matches,    setMatches]    = useState([]);
  const [messages,   setMessages]   = useState([]);
  const [user,       setUser]       = useState(null);

  useEffect(() => {
    const safe = (p) => Promise.resolve(p).catch(() => []);

    safe(stageClient.entities.LandingPageContent.filter({}, null, 1))
      .then(rows => { if (rows?.[0]) setContent(rows[0]); });

    safe(stageClient.entities.CompetitionSeason.list("-season_number", 10))
      .then(rows => setSeasons(rows || []));

    safe(stageClient.entities.NewsItem.list("-published_at", 6))
      .then(rows => setNewsItems((rows || []).map(i => ({ ...i, _category: i.category || i.type || "general" }))));

    safe(stageClient.entities.Match.filter({ status: "scheduled" }, "-scheduled_date", 10))
      .then(rows => setMatches(rows || []));

    stageClient.auth.me()
      .then(u => {
        if (!u?.email) return;
        setUser(u);
        safe(stageClient.entities.InboxMessage.filter({ recipient_email: u.email }, "-created_date", 5))
          .then(msgs => setMessages(msgs || []));
      })
      .catch(() => {});
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
        <div className="absolute inset-0" style={{ backgroundImage: `url(${c.hero_image_url})`, backgroundSize: "cover", backgroundPosition: "center 10%" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-black/10" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 45%)" }} />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-28">
          <p className="font-heading font-bold uppercase mb-1 text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.35em" }}>
            {c.hero_title}
          </p>
          <h1 className="font-heading font-black leading-none" style={{ fontSize: "clamp(5.5rem, 18vw, 11rem)", color: "hsl(189,100%,52%)", textShadow: "0 0 30px hsl(189 100% 52% / 0.6), 0 0 90px hsl(189 100% 52% / 0.25)" }}>
            {c.hero_subtitle}
          </h1>
          <p className="mt-6 max-w-md text-sm sm:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
            {c.hero_description}
          </p>
          <div className="flex flex-wrap gap-3 mt-9">
            <Link to={c.hero_cta_1_url}>
              <Button size="lg" className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                <Trophy className="w-4 h-4" /> {c.hero_cta_1_label}
              </Button>
            </Link>
            <Link to={c.hero_cta_2_url}>
              <Button size="lg" variant="outline" className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm" style={{ color: "white", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.07)" }}>
                <Zap className="w-4 h-4" /> {c.hero_cta_2_label}
              </Button>
            </Link>
            <Link to={c.hero_cta_3_url}>
              <Button size="lg" variant="outline" className="h-12 px-7 gap-2 font-heading font-black uppercase tracking-wider text-sm" style={{ color: "white", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.07)" }}>
                <ShoppingBag className="w-4 h-4" /> {c.hero_cta_3_label}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          A — COMPETITIONS STRIP
         ══════════════════════════════════════════════════════ */}
      <CompetitionsStrip seasons={seasons} />

      {/* ══════════════════════════════════════════════════════
          FEATURE SECTION 1 — What is STAGE?
         ══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-8">
        <FeatureSection title={c.section1_title} text={c.section1_text} imageUrl={c.section1_image_url} icon={SECTION_ICONS[0]} flip={false} />
      </div>

      {/* ══════════════════════════════════════════════════════
          B — NEWS MOSAIC
         ══════════════════════════════════════════════════════ */}
      <NewsMosaic items={newsItems} />

      {/* ══════════════════════════════════════════════════════
          FEATURE SECTION 2 — How It Works
         ══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-8">
        <FeatureSection title={c.section2_title} text={c.section2_text} imageUrl={c.section2_image_url} icon={SECTION_ICONS[1]} flip={true} />
      </div>

      {/* ══════════════════════════════════════════════════════
          C — SCHEDULE FRAME
         ══════════════════════════════════════════════════════ */}
      <ScheduleFrame matches={matches} />

      {/* ══════════════════════════════════════════════════════
          FEATURE SECTION 3 — Built for Competitors
         ══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-8">
        <FeatureSection title={c.section3_title} text={c.section3_text} imageUrl={c.section3_image_url} icon={SECTION_ICONS[2]} flip={false} objectPosition="center top" />
      </div>

      {/* ══════════════════════════════════════════════════════
          D — INBOX PANEL
         ══════════════════════════════════════════════════════ */}
      <InboxPanel messages={messages} user={user} />

      {/* ══════════════════════════════════════════════════════
          QUICK NAVIGATION
         ══════════════════════════════════════════════════════ */}
      <section
        className="border-y border-border py-16"
        style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw", background: "hsl(var(--secondary) / 0.3)" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-1">Platform</p>
          <h2 className="font-heading font-black uppercase text-foreground mb-1" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>Jump In</h2>
          <p className="text-muted-foreground text-sm mb-8">Everything you need, one tap away.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {NAV_CARDS.map(card => {
              const a = ACCENT[card.accent];
              return (
                <Link key={card.to} to={card.to}>
                  <div className={cn("group relative overflow-hidden rounded-2xl border p-5 h-full bg-gradient-to-br transition-all duration-200 hover:scale-[1.02]", a.bg, a.border)}>
                    <card.icon className={cn("w-8 h-8 mb-3", a.icon)} />
                    <p className="font-heading font-black text-base sm:text-lg uppercase text-foreground tracking-wide">{card.label}</p>
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
        <h2 className="font-heading font-black uppercase text-foreground text-center mb-2" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>FAQ</h2>
        <p className="text-muted-foreground text-sm text-center mb-8">Common questions about the platform.</p>
        <div className="space-y-2">
          {(c.faq_items || []).map((item, i) => <FaqItem key={i} question={item.question} answer={item.answer} />)}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
         ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border" style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw", background: "hsl(var(--card))" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <p className="font-heading font-black text-4xl uppercase mb-3" style={{ color: "hsl(189,100%,52%)", textShadow: "0 0 16px hsl(189 100% 52% / 0.35)" }}>STAGE</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{c.footer_tagline}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">Platform</p>
              <div className="space-y-2">
                {[["Competitions", "/competitions"], ["Game Day", "/game-day"], ["Clubs", "/clubs"], ["Rankings", "/rankings"], ["Store", "/lifestyle"]].map(([label, to]) => (
                  <Link key={to} to={to} className="block text-sm text-foreground/60 hover:text-foreground transition-colors">{label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">Contact</p>
              <a href={`mailto:${c.contact_email}`} className="flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors">
                <Mail className="w-4 h-4 shrink-0" /> {c.contact_email}
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
