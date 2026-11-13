import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import HeroImg from "@/assets/WIS.PNG";
import CoachLuisImg from "@/assets/Coach Luis.PNG";
import BFCHomeImg from "@/assets/BFC Home.PNG";
import HIWImg from "@/assets/HIW.PNG";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import DiscordJoinCard from "@/components/community/DiscordJoinCard";
import { shouldShowDiscordPrompt } from "@/lib/discordJoin";
import { COMPETITIONS } from "@/lib/competitionUtils";
import { useTranslation } from "@/hooks/useTranslation";
import {
  CLIP_12,
  CLIP_16,
  CLIP_28,
  focusRing,
  fontDisplay,
  fontItalic,
  fontMono,
  pagePad,
} from "@/components/landing/clips";

/* ── Defaults ──────────────────────────────────────────────── */
const DEFAULTS = {
  hero_title:        "Welcome To",
  hero_subtitle:     "STAGE",
  hero_description:  "Create your club, compete in structured leagues and tournaments, and build your legacy in the ultimate competitive football gaming community.",
  hero_image_url:    HeroImg,
  hero_cta_1_label:  "Competitions",
  hero_cta_1_url:    "/competitions",
  hero_cta_2_label:  "GameDay",
  hero_cta_2_url:    "/game-day",
  hero_cta_3_label:  "Store",
  hero_cta_3_url:    "/lifestyle",
  section1_title:    "What is STAGE?",
  section1_text:     "STAGE is the premier structured competitive platform for EA FC players. We provide the infrastructure for real clubs, real leagues, and real trophies — all within a professional community built around the game.",
  section1_image_url: HIWImg,
  section2_title:    "How It Works",
  section2_text:     "Register your club, sign players to contracts, and enter league seasons or knockout tournaments. Every match is tracked, every goal counts, and every season crowns a champion.",
  section2_image_url: CoachLuisImg,
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
  { labelKey: "homeNavCompetitions", descKey: "homeNavCompetitionsDesc", to: "/competitions", accent: "#00d4ff" },
  { labelKey: "homeNavGameDay",      descKey: "homeNavGameDayDesc",      to: "/game-day",     accent: "#f59e0b" },
  { labelKey: "homeNavClubs",        descKey: "homeNavClubsDesc",        to: "/clubs",        accent: "#4d8dff" },
  { labelKey: "homeNavStore",        descKey: "homeNavStoreDesc",        to: "/lifestyle",    accent: "#10b981" },
];

const FEATURES = [
  { number: "01", accent: "#f59e0b", flip: false },
  { number: "02", accent: "#4d8dff", flip: true },
  { number: "03", accent: "#10b981", flip: false },
];

const textOrDefault = (value, fallback) =>
  typeof value === "string" ? (value.trim() ? value : fallback) : (value ?? fallback);

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const kickerClass = `${fontMono} text-xs font-bold uppercase tracking-[.32em] text-[#4d8dff]`;
const quietLink = `${focusRing} ${fontMono} inline-flex items-center text-xs font-bold uppercase tracking-[.14em] text-[#7f8aa3] transition-colors hover:text-white`;
const primaryCta = `${CLIP_12} ${focusRing} inline-flex items-center justify-center border-0 bg-[#2563eb] px-[clamp(16px,2vw,30px)] py-[clamp(10px,1.25vw,18px)] text-sm font-bold uppercase tracking-[.14em] text-white shadow-[0_10px_40px_rgba(37,99,235,.45)] transition-colors hover:bg-[#3b76f6]`;
const ghostCta = `${CLIP_12} ${focusRing} inline-flex items-center justify-center border-0 bg-white/10 px-[clamp(16px,2vw,30px)] py-[clamp(10px,1.25vw,18px)] text-sm font-bold uppercase tracking-[.14em] text-white transition-colors hover:bg-white/20`;

function ClipCard({ accent = "rgba(255,255,255,.16)", children, className }) {
  return (
    <div className={cn(CLIP_16, "h-full p-px", className)} style={{ background: accent }}>
      <div className={cn(CLIP_16, "flex h-full flex-col bg-[#0a1130] px-7 pb-8 pt-7")}>
        {children}
      </div>
    </div>
  );
}

function SectionHeading({ kicker, title, action }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div className="min-w-0">
        {kicker ? <div className={cn(kickerClass, "mb-[18px]")}>{kicker}</div> : null}
        <h2 className={cn(fontDisplay, "m-0 text-[clamp(40px,5vw,72px)] font-normal uppercase leading-[.9] text-white")}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("border-t border-white/12", open && "border-[#00d4ff]")}>
      <button
        type="button"
        className={cn(focusRing, "landing-keep flex w-full items-center justify-between gap-4 border-0 bg-transparent px-0 py-5 text-left")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={cn(fontDisplay, "text-[clamp(22px,2.4vw,32px)] font-normal uppercase leading-[1.05] text-white")}>
          {question}
        </span>
        {open
          ? <ChevronUp className="h-5 w-5 shrink-0 text-[#00d4ff]" />
          : <ChevronDown className="h-5 w-5 shrink-0 text-[#7f8aa3]" />}
      </button>
      {open && (
        <p className="m-0 max-w-[68ch] pb-6 text-base leading-[1.6] text-[#aab3c8]">{answer}</p>
      )}
    </div>
  );
}

function FeatureBlock({ title, text, imageUrl, flip, objectPosition = "50% 28%", imageZoom, number, accent }) {
  const zoom = Number(imageZoom);
  const frame = imageUrl ? (
    <div className={cn(CLIP_28, "aspect-video w-full min-w-0 overflow-hidden [flex:1.2_1_420px]")}>
      <img
        src={imageUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{
          objectPosition: objectPosition || "center",
          transform: Number.isFinite(zoom) && zoom > 0 ? `scale(${zoom / 100})` : undefined,
        }}
      />
    </div>
  ) : (
    <div className={cn(CLIP_28, "aspect-video w-full min-w-0 bg-[#0a1130] [flex:1.2_1_420px]")} role="img" aria-label={title} />
  );

  const copy = (
    <div className="min-w-0 [flex:1_1_380px]">
      <div className={cn(fontMono, "flex items-center gap-3.5 text-xs font-bold uppercase tracking-[.3em]")} style={{ color: accent }}>
        <span className={cn(fontDisplay, "text-[15px] font-normal tracking-[.08em]")}>{number}</span>
        <span aria-hidden="true" className="h-px w-9" style={{ background: accent }} />
      </div>
      <h2 className={cn(fontDisplay, "mb-[22px] mt-5 text-[clamp(40px,5vw,72px)] font-normal uppercase leading-[.95] text-white")}>
        {title}
      </h2>
      <p className="m-0 max-w-[560px] text-lg leading-[1.6] text-[#aab3c8] text-pretty">{text}</p>
    </div>
  );

  return (
    <section className={cn(pagePad, "flex items-center gap-[clamp(32px,5vw,80px)] pt-[clamp(64px,8vw,120px)]", flip ? "flex-wrap-reverse" : "flex-wrap")}>
      {flip ? <>{copy}{frame}</> : <>{frame}{copy}</>}
    </section>
  );
}

function EventsCarousel({ seasons, tournaments, leagues, compact = false }) {
  const [activeTab, setActiveTab] = useState("competitions");
  const { t } = useTranslation();

  const TABS = [
    { key: "competitions", label: t("commonPages.homeCompetitions"), accent: "#00d4ff", viewAllTo: "/competitions" },
    { key: "tournaments",  label: t("commonPages.homeTournaments"),  accent: "#f59e0b", viewAllTo: "/tournaments" },
    { key: "leagues",      label: t("commonPages.homeLeagues"),      accent: "#a78bfa", viewAllTo: "/leagues" },
  ];
  const currentTab = TABS.find((tab) => tab.key === activeTab) || TABS[0];

  const statusBadge = (status) => {
    if (!status) return null;
    const sl = String(status).toLowerCase();
    if (["open", "registration"].includes(sl)) return { text: "OPEN", color: "#34d399" };
    if (["league_phase", "in_progress", "group_stage"].includes(sl)) return { text: "LIVE", color: "#34d399" };
    if (sl === "playoffs") return { text: "PLAYOFFS", color: "#facc15" };
    if (sl === "knockout") return { text: "KNOCKOUT", color: "#fb923c" };
    if (sl === "completed") return { text: "COMPLETED", color: "#7f8aa3" };
    if (sl === "cancelled") return { text: "CANCELLED", color: "#f87171" };
    return null;
  };

  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const renderCompetitions = () =>
    COMPETITIONS.map((comp) => {
      const season = seasons?.find((item) => item.competition_name?.toLowerCase().includes(comp.slug) || item.tier === comp.tier);
      const badge = season ? statusBadge(season.status) : null;
      return (
        <Link key={comp.slug} to="/competitions" className={cn(focusRing, "group block h-full min-w-0")}>
          <ClipCard accent={comp.color}>
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className={cn(fontMono, "flex items-center gap-2.5 text-xs font-bold uppercase tracking-[.3em]")} style={{ color: comp.color }}>
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: comp.color, boxShadow: `0 0 12px ${comp.color}` }} />
                {t("commonPages.homeTier", { tier: comp.tier })}
              </div>
              {badge && (
                <span className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.16em]")} style={{ color: badge.color }}>
                  {badge.text}
                </span>
              )}
            </div>
            <h3 className={cn(fontDisplay, "text-[clamp(28px,3vw,40px)] font-normal uppercase leading-none text-white")}>
              {comp.name.replace("STAGE ", "")}
            </h3>
            <p className="mt-4 text-sm leading-[1.6] text-[#aab3c8]">{comp.description}</p>
            <div className={cn(fontMono, "mt-auto pt-6 text-[11px] font-medium uppercase tracking-[.14em] text-[#7f8aa3] transition-colors group-hover:text-white")}>
              {t("commonPages.homeViewBracket")}
            </div>
          </ClipCard>
        </Link>
      );
    });

  const renderEventCards = (items, linkPrefix, accent) =>
    items.slice(0, 6).map((item) => {
      const badge = statusBadge(item.status);
      const regPlayers = parseJsonArray(item.registered_players);
      const regClubs = parseJsonArray(item.registered_clubs);
      const count = Math.max(regPlayers.length, regClubs.length);
      const max = Number(item.max_teams || 0);
      const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0;

      return (
        <Link key={item.id} to={`${linkPrefix}/${item.id}`} className={cn(focusRing, "group block h-full min-w-0")}>
          <ClipCard accent={accent}>
            <div className="mb-6 flex items-start justify-between gap-3">
              {item.type ? (
                <div className={cn(fontMono, "text-xs font-bold uppercase tracking-[.3em]")} style={{ color: accent }}>
                  {String(item.type).replace(/_/g, " ")}
                </div>
              ) : <span />}
              {badge && (
                <span className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.16em]")} style={{ color: badge.color }}>
                  {badge.text}
                </span>
              )}
            </div>
            <h3 className={cn(fontDisplay, "text-[clamp(28px,3vw,40px)] font-normal uppercase leading-none text-white")}>
              {item.name}
            </h3>
            {max > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.16em] text-[#7f8aa3]")}>
                    {t("commonPages.homePlayers", { count, max })}
                  </span>
                  {count >= max && (
                    <span className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.16em] text-[#f87171]")}>
                      {t("commonPages.homeFull")}
                    </span>
                  )}
                </div>
                <div className="h-0.5 w-full bg-white/10">
                  <div className="h-full" style={{ width: `${pct}%`, background: count >= max ? "#f87171" : accent }} />
                </div>
              </div>
            )}
            <div className={cn(fontMono, "mt-auto pt-6 text-[11px] font-medium uppercase tracking-[.14em] text-[#7f8aa3] transition-colors group-hover:text-white")}>
              {t("commonPages.homeViewDetails")}
            </div>
          </ClipCard>
        </Link>
      );
    });

  const renderContent = () => {
    if (activeTab === "competitions") return renderCompetitions();
    if (activeTab === "tournaments") {
      if (!tournaments?.length) return [<p key="empty" className="col-span-full py-8 text-center text-base text-[#aab3c8]">{t("commonPages.homeNoTournaments")}</p>];
      return renderEventCards(tournaments, "/tournaments", currentTab.accent);
    }
    if (!leagues?.length) return [<p key="empty" className="col-span-full py-8 text-center text-base text-[#aab3c8]">{t("commonPages.homeNoLeagues")}</p>];
    return renderEventCards(leagues, "/leagues", currentTab.accent);
  };

  const content = renderContent();
  const isEmptyMessage = content.length === 1 && content[0]?.type === "p";

  const tabs = (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={cn(
            "landing-keep cursor-pointer border-0 bg-transparent p-0 uppercase transition-colors",
            compact ? fontMono : fontDisplay,
            activeTab === tab.key
              ? compact
                ? "text-[#00d4ff]"
                : "text-[clamp(40px,5vw,72px)] leading-[.9] text-white"
              : compact
                ? "text-[#7f8aa3]"
                : "text-[clamp(22px,2.4vw,32px)] leading-none text-white/25 hover:text-white/55",
            compact && "text-[11px] font-bold tracking-[.16em]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className={cn(fontDisplay, "text-[32px] font-normal uppercase leading-none text-white")}>
            {t("commonPages.homeMobileDiscover")}
          </h2>
          <Link to={currentTab.viewAllTo} className={quietLink}>
            {t("commonPages.homeViewAll")}
          </Link>
        </div>
        {tabs}
        {isEmptyMessage ? content[0] : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {content.map((node, index) => (
              <div key={node.key || index} className="w-[min(82vw,280px)] shrink-0 snap-start">
                {node}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={cn(pagePad, "border-y border-white/[.08] py-[clamp(64px,8vw,112px)]")}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className={cn(kickerClass, "mb-[18px]")} style={{ color: currentTab.accent }}>
            {t("commonPages.homePlatform")}
          </div>
          {tabs}
        </div>
        <Link to={currentTab.viewAllTo} className={quietLink}>
          {t("commonPages.homeViewAll")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {content}
      </div>
    </section>
  );
}

function NewsMosaic({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;

  const [featured, ...rest] = items.slice(0, 4);

  return (
    <section className={cn(pagePad, "pt-[clamp(64px,8vw,120px)]")}>
      <SectionHeading
        kicker={t("commonPages.homeLatest")}
        title={t("commonPages.newsTitle")}
        action={(
          <Link to="/news" className={quietLink}>
            {t("commonPages.homeAllNews")}
          </Link>
        )}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {featured && (
          <Link to="/news" className={cn(focusRing, "group block lg:col-span-3")}>
            <ClipCard accent="#00d4ff" className="min-h-[260px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className={cn(fontMono, "text-[11px] font-bold uppercase tracking-[.2em] text-[#00d4ff]")}>
                  {t("commonPages.featured")}
                </span>
                <span className={cn(fontMono, "text-[11px] tracking-[.12em] text-[#7f8aa3]")}>
                  {timeAgo(featured.published_at)}
                </span>
              </div>
              <h3 className={cn(fontDisplay, "text-[clamp(28px,3vw,44px)] font-normal uppercase leading-[.95] text-white")}>
                {featured.title}
              </h3>
              {featured.body && (
                <p className="mt-4 line-clamp-3 text-base leading-[1.6] text-[#aab3c8]">{featured.body}</p>
              )}
              {(featured.club_name || featured.player_name) && (
                <div className="mt-auto flex items-center gap-2 pt-6">
                  {featured.club_logo_url && (
                    <img src={featured.club_logo_url} alt="" className="h-5 w-5 object-cover" />
                  )}
                  {featured.player_avatar_url && (
                    <img src={featured.player_avatar_url} alt="" className="h-5 w-5 object-cover" />
                  )}
                  <span className="text-sm text-[#aab3c8]">
                    {featured.club_name || featured.player_name}
                  </span>
                </div>
              )}
            </ClipCard>
          </Link>
        )}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {rest.slice(0, 3).map((item) => (
            <Link key={item.id} to="/news" className={cn(focusRing, "group block flex-1")}>
              <ClipCard accent="rgba(255,255,255,.16)">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className={cn(fontMono, "text-[11px] font-bold uppercase tracking-[.2em] text-[#4d8dff]")}>
                    {item._category || item.category || "News"}
                  </span>
                  <span className={cn(fontMono, "shrink-0 text-[11px] tracking-[.12em] text-[#7f8aa3]")}>
                    {timeAgo(item.published_at)}
                  </span>
                </div>
                <p className={cn(fontDisplay, "text-[26px] font-normal uppercase leading-[1.05] text-white")}>
                  {item.title}
                </p>
              </ClipCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScheduleFrame({ matches }) {
  const { t } = useTranslation();
  const formatDate = (value) => {
    if (!value) return "TBD";
    const dt = new Date(value);
    return `${dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const statusColor = (status) => {
    if (status === "live") return "#34d399";
    if (status === "completed") return "#7f8aa3";
    return "#00d4ff";
  };

  return (
    <section className={cn(pagePad, "pt-[clamp(64px,8vw,120px)]")}>
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-3">
        <div>
          <div className={cn(kickerClass, "mb-[18px]")}>{t("commonPages.homeUpcoming")}</div>
          <h2 className={cn(fontDisplay, "m-0 text-[clamp(40px,5vw,72px)] font-normal uppercase leading-[.9] text-white")}>
            {t("commonPages.homeSchedule")}
          </h2>
          <p className="mb-8 mt-5 max-w-[36ch] text-lg leading-[1.6] text-[#aab3c8]">
            {t("commonPages.homeScheduleDesc")}
          </p>
          <Link to="/game-day" className={primaryCta}>
            {t("commonPages.homeGameDay")}
          </Link>
        </div>
        <div className="lg:col-span-2">
          {!matches?.length ? (
            <p className="border-t border-white/12 py-10 text-base text-[#aab3c8]">
              {t("commonPages.homeNoMatches")}
            </p>
          ) : (
            <div>
              {matches.slice(0, 6).map((match, index) => {
                const home = match.home_club_name || match.home_player_name || "TBD";
                const away = match.away_club_name || match.away_player_name || "TBD";
                const live = match.status === "live";
                return (
                  <div key={match.id || index} className="grid grid-cols-1 items-center gap-3 border-t border-white/12 py-4 sm:grid-cols-[9.5rem_1fr]">
                    <div>
                      <div className={cn(fontMono, "text-xs font-bold uppercase tracking-[.14em]")} style={{ color: statusColor(match.status) }}>
                        {live ? "LIVE" : formatDate(match.scheduled_date)}
                      </div>
                      {match.competition && (
                        <div className={cn(fontMono, "mt-1 truncate text-[10px] uppercase tracking-[.14em] text-[#7f8aa3]")}>
                          {match.competition}
                        </div>
                      )}
                    </div>
                    <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <span className="truncate text-base font-medium text-white">{home}</span>
                      <span className={cn(fontMono, "text-[10px] uppercase tracking-[.16em] text-[#7f8aa3]")}>vs</span>
                      <span className="truncate text-right text-base font-medium text-white">{away}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function InboxPanel({ messages, user }) {
  const { t } = useTranslation();
  const unread = messages?.filter((message) => !message.is_read).length || 0;

  return (
    <section className={cn(pagePad, "pt-[clamp(64px,8vw,120px)]")}>
      <div className="ml-auto max-w-2xl">
        <SectionHeading
          kicker={t("commonPages.homeMessages")}
          title={(
            <span className="inline-flex items-center gap-3">
              {t("nav.inbox")}
              {unread > 0 && (
                <span className={cn(fontMono, "text-sm font-bold tracking-[.08em] text-[#04130d]", "bg-[#00d4ff] px-2 py-1")}>
                  {unread}
                </span>
              )}
            </span>
          )}
          action={(
            <Link to="/inbox" className={quietLink}>
              {t("commonPages.homeOpen")}
            </Link>
          )}
        />

        {!user ? (
          <div className="border-t border-white/12 py-8">
            <p className="mb-5 text-base text-[#aab3c8]">{t("commonPages.homeSignInMessages")}</p>
            <Link to="/login" className={ghostCta}>{t("auth.signIn")}</Link>
          </div>
        ) : !messages?.length ? (
          <p className="border-t border-white/12 py-8 text-base text-[#aab3c8]">
            {t("commonPages.homeInboxEmpty")}
          </p>
        ) : (
          <div>
            {messages.slice(0, 5).map((msg) => (
              <Link
                key={msg.id}
                to={`/inbox?id=${msg.id}`}
                className={cn(focusRing, "grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-white/12 py-4")}
              >
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden bg-[#10183a] text-xs font-bold text-[#aab3c8]">
                  {msg.sender_avatar_url ? (
                    <img src={msg.sender_avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    msg.is_system ? "S" : (msg.sender_gamertag || "?")[0].toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate text-sm font-medium", msg.is_read ? "text-[#7f8aa3]" : "text-white")}>
                      {msg.is_system ? t("commonPages.homeStageSystem") : (msg.sender_gamertag || t("commonPages.homeUnknown"))}
                    </span>
                    <span className={cn(fontMono, "shrink-0 text-[10px] tracking-[.12em] text-[#7f8aa3]")}>
                      {timeAgo(msg.created_date)}
                    </span>
                  </div>
                  <p className={cn("mt-1 truncate text-sm", msg.is_read ? "text-[#7f8aa3]" : "text-[#aab3c8]")}>
                    {msg.subject}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 rounded-full", msg.is_read ? "bg-white/15" : "bg-[#00d4ff]")}
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function formatMatchWhen(dateStr) {
  if (!dateStr) return "TBD";
  const dt = new Date(dateStr);
  return `${dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function MobileHomeDashboard({
  user,
  player,
  matches,
  messages,
  newsItems,
  seasons,
  tournaments,
  leagues,
  showDiscordBanner,
  onSkipDiscord,
}) {
  const { t } = useTranslation();
  const unread = messages?.filter((message) => !message.is_read).length || 0;
  const nextMatch = matches?.[0];
  const homeName = nextMatch?.home_club_name || nextMatch?.home_player_name || "TBD";
  const awayName = nextMatch?.away_club_name || nextMatch?.away_player_name || "TBD";
  const displayName = player?.gamertag || user?.email?.split("@")[0] || null;

  return (
    <div className={cn(pagePad, "space-y-8 pb-8 pt-6 md:hidden")}>
      <header className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className={cn(focusRing, "min-w-0 flex-1")}>
          <p className={cn(kickerClass, "mb-2")}>STAGE</p>
          <h1 className={cn(fontDisplay, "truncate text-[40px] font-normal uppercase leading-none text-white")}>
            {displayName
              ? t("commonPages.homeMobileWelcomeBack")
              : t("commonPages.homeMobileWelcome")}
          </h1>
          {displayName && (
            <p className="mt-2 truncate text-base text-[#aab3c8]">{displayName}</p>
          )}
        </Link>
        {player?.avatar_url && (
          <div
            className={cn(CLIP_12, "h-11 w-11 shrink-0 bg-cover bg-center")}
            style={{ backgroundImage: `url(${player.avatar_url})` }}
            role="img"
            aria-label={displayName || "Player"}
          />
        )}
      </header>

      <Link to="/game-day" className={cn(focusRing, "block")}>
        <ClipCard accent="#00d4ff">
          <p className={cn(fontMono, "text-[11px] font-bold uppercase tracking-[.2em] text-[#00d4ff]")}>
            {t("commonPages.homeGameDay")}
          </p>
          <p className={cn(fontDisplay, "mt-3 text-[32px] font-normal uppercase leading-none text-white")}>
            {t("commonPages.homeMobileOpenGameDay")}
          </p>
          <p className="mt-3 text-sm leading-[1.55] text-[#aab3c8]">
            {nextMatch
              ? `${formatMatchWhen(nextMatch.scheduled_date)} · ${homeName} vs ${awayName}`
              : t("commonPages.homeMobileNoMatchHint")}
          </p>
        </ClipCard>
      </Link>

      {matches?.length > 1 && (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className={cn(fontDisplay, "text-[28px] font-normal uppercase leading-none text-white")}>
              {t("commonPages.homeMobileNextMatch")}
            </h2>
            <Link to="/schedule" className={quietLink}>
              {t("commonPages.homeMobileSeeSchedule")}
            </Link>
          </div>
          {matches.slice(1, 3).map((match, index) => {
            const home = match.home_club_name || match.home_player_name || "TBD";
            const away = match.away_club_name || match.away_player_name || "TBD";
            return (
              <Link key={match.id || index} to="/game-day" className={cn(focusRing, "grid grid-cols-[5.5rem_1fr] items-center gap-3 border-t border-white/12 py-3")}>
                <span className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.12em] text-[#00d4ff]")}>
                  {match.status === "live" ? "LIVE" : formatMatchWhen(match.scheduled_date).split(" · ")[0]}
                </span>
                <span className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm text-white">
                  <span className="truncate">{home}</span>
                  <span className={cn(fontMono, "text-[10px] uppercase tracking-[.14em] text-[#7f8aa3]")}>vs</span>
                  <span className="truncate text-right">{away}</span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {user && (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className={cn(fontDisplay, "inline-flex items-center gap-2 text-[28px] font-normal uppercase leading-none text-white")}>
              {t("nav.inbox")}
              {unread > 0 && (
                <span className={cn(fontMono, "bg-[#00d4ff] px-1.5 py-0.5 text-[10px] font-bold text-[#04130d]")}>
                  {unread}
                </span>
              )}
            </h2>
            <Link to="/inbox" className={quietLink}>
              {t("commonPages.homeOpen")}
            </Link>
          </div>
          {!messages?.length ? (
            <p className="border-t border-white/12 py-4 text-sm text-[#aab3c8]">{t("commonPages.homeInboxEmpty")}</p>
          ) : (
            messages.slice(0, 2).map((msg) => (
              <Link key={msg.id} to={`/inbox?id=${msg.id}`} className={cn(focusRing, "flex items-center gap-3 border-t border-white/12 py-3")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", msg.is_read ? "text-[#7f8aa3]" : "font-medium text-white")}>
                    {msg.subject || msg.title || t("commonPages.homeStageSystem")}
                  </p>
                  <p className={cn(fontMono, "mt-1 text-[10px] tracking-[.12em] text-[#7f8aa3]")}>
                    {timeAgo(msg.created_date)}
                  </p>
                </div>
                {!msg.is_read && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#00d4ff]" />}
              </Link>
            ))
          )}
        </section>
      )}

      {showDiscordBanner && user && (
        <DiscordJoinCard variant="banner" onSkip={onSkipDiscord} />
      )}

      <EventsCarousel seasons={seasons} tournaments={tournaments} leagues={leagues} compact />

      {newsItems?.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className={cn(fontDisplay, "text-[28px] font-normal uppercase leading-none text-white")}>
              {t("commonPages.newsTitle")}
            </h2>
            <Link to="/news" className={quietLink}>
              {t("commonPages.homeAllNews")}
            </Link>
          </div>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {newsItems.slice(0, 4).map((item) => (
              <Link key={item.id} to="/news" className={cn(focusRing, "w-[min(78vw,260px)] shrink-0 snap-start")}>
                <ClipCard accent="#4d8dff">
                  <p className={cn(fontMono, "text-[10px] font-bold uppercase tracking-[.18em] text-[#4d8dff]")}>
                    {item._category || item.category || t("commonPages.general")}
                  </p>
                  <p className={cn(fontDisplay, "mt-3 text-[22px] font-normal uppercase leading-[1.05] text-white")}>
                    {item.title}
                  </p>
                  <p className={cn(fontMono, "mt-3 text-[10px] tracking-[.12em] text-[#7f8aa3]")}>
                    {timeAgo(item.published_at)}
                  </p>
                </ClipCard>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const FOOTER_LINKS = [
  ["homeNavCompetitions", "/competitions"],
  ["homeNavGameDay", "/game-day"],
  ["homeNavClubs", "/clubs"],
  ["homeFooterRankings", "/rankings"],
  ["homeNavStore", "/lifestyle"],
];

export default function Home() {
  const { t } = useTranslation();
  const [cms, setCms] = useState(null);
  const [faqItems, setFaqItems] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [showDiscordBanner, setShowDiscordBanner] = useState(() => shouldShowDiscordPrompt());
  const pageRef = useRef(null);

  useEffect(() => {
    const safe = (promise) => Promise.resolve(promise).catch(() => []);

    safe(stageClient.entities.HomePageContent.filter({}, null, 1))
      .then((rows) => setCms(rows?.[0] || null));

    safe(stageClient.entities.FaqItem.filter({ is_active: 1 }, "sort_order", 50))
      .then((rows) => setFaqItems(rows || []));

    safe(stageClient.entities.CompetitionSeason.list("-season_number", 10))
      .then((rows) => setSeasons(rows || []));

    safe(stageClient.entities.Tournament.filter({}, "-created_date", 20))
      .then((rows) => setTournaments((rows || []).filter((item) => item.status !== "deleted")));

    safe(stageClient.entities.RegionalLeague.filter({}, "-created_date", 20))
      .then((rows) => setLeagues((rows || []).filter((item) => item.status !== "deleted")));

    safe(stageClient.entities.NewsItem.list("-published_at", 6))
      .then((rows) => setNewsItems((rows || []).map((item) => ({ ...item, _category: item.category || item.type || "general" }))));

    safe(stageClient.entities.Match.filter({ status: "scheduled" }, "-scheduled_date", 10))
      .then((rows) => setMatches(rows || []));

    stageClient.auth.me()
      .then((account) => {
        if (!account?.email) return;
        setUser(account);
        safe(stageClient.entities.InboxMessage.filter({ recipient_email: account.email }, "-created_date", 5))
          .then((rows) => setMessages(rows || []));
        const playerId = localStorage.getItem("stage_player_id");
        if (playerId) {
          safe(stageClient.entities.Player.get(playerId))
            .then((row) => setPlayer(row || null));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const node = pageRef.current;
    if (!node) return;
    const scroller = node.closest("main");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });
    else window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const c = cms ? { ...DEFAULTS, ...cms } : DEFAULTS;
  const heroBg = textOrDefault(c.hero_image_url, DEFAULTS.hero_image_url);
  const heroBgPosition = textOrDefault(c.hero_image_position, "50% 10%");
  const heroBgZoom = c.hero_image_zoom ? Number(c.hero_image_zoom) : null;
  const heroTitle = textOrDefault(c.hero_title, DEFAULTS.hero_title);
  const heroSubtitle = textOrDefault(c.hero_subtitle, DEFAULTS.hero_subtitle);
  const ctas = [
    { label: textOrDefault(c.hero_cta_1_label, DEFAULTS.hero_cta_1_label), url: textOrDefault(c.hero_cta_1_url, DEFAULTS.hero_cta_1_url), primary: true },
    { label: textOrDefault(c.hero_cta_2_label, DEFAULTS.hero_cta_2_label), url: textOrDefault(c.hero_cta_2_url, DEFAULTS.hero_cta_2_url) },
    { label: textOrDefault(c.hero_cta_3_label, DEFAULTS.hero_cta_3_label), url: textOrDefault(c.hero_cta_3_url, DEFAULTS.hero_cta_3_url) },
  ];
  const features = [1, 2, 3].map((index) => ({
    ...FEATURES[index - 1],
    title: textOrDefault(c[`section${index}_title`], DEFAULTS[`section${index}_title`]),
    text: textOrDefault(c[`section${index}_text`], DEFAULTS[`section${index}_text`]),
    imageUrl: textOrDefault(c[`section${index}_image_url`], DEFAULTS[`section${index}_image_url`]),
    objectPosition: textOrDefault(c[`section${index}_image_position`], "50% 28%"),
    imageZoom: c[`section${index}_image_zoom`] ? Number(c[`section${index}_image_zoom`]) : null,
  }));

  return (
    <div
      ref={pageRef}
      className="landing-v2 min-h-screen overflow-x-hidden bg-[#06091a] font-['Chakra_Petch',system-ui,sans-serif] text-white selection:bg-[#00d4ff] selection:text-[#04131a]"
    >
      <MobileHomeDashboard
        user={user}
        player={player}
        matches={matches}
        messages={messages}
        newsItems={newsItems}
        seasons={seasons}
        tournaments={tournaments}
        leagues={leagues}
        showDiscordBanner={showDiscordBanner}
        onSkipDiscord={() => setShowDiscordBanner(false)}
      />

      <div className="hidden md:block">
        <section className={cn(pagePad, "relative box-border flex aspect-auto min-h-[720px] flex-col justify-center overflow-hidden bg-[#06091a] py-[clamp(56px,6vw,96px)] lg:aspect-video lg:min-h-0")}>
          <img
            src={heroBg}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: heroBgPosition,
              transform: heroBgZoom ? `scale(${heroBgZoom / 100})` : undefined,
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#06091a_0%,rgba(6,9,26,.92)_28%,rgba(6,9,26,.55)_52%,rgba(6,9,26,0)_78%)]"
          />
          <div className="relative z-10 max-w-[720px]">
            <h1 className={cn(fontDisplay, "m-0 text-[clamp(36px,9vw,160px)] font-normal uppercase leading-[.88] tracking-[-.01em] text-white")}>
              {heroTitle}
              <br />
              <span className={cn(fontDisplay, fontItalic, "text-[#00d4ff] [text-shadow:0_0_48px_rgba(0,212,255,.45)]")}>
                {heroSubtitle}
              </span>
            </h1>
            <p className="mb-[clamp(14px,2.2vw,36px)] mt-[clamp(12px,2vw,32px)] max-w-[520px] text-[clamp(13px,1.35vw,19px)] leading-[1.55] text-[#aab3c8] text-pretty">
              {textOrDefault(c.hero_description, DEFAULTS.hero_description)}
            </p>
            <div className="flex flex-wrap gap-3.5">
              {ctas.map((cta) => (
                <Link key={`${cta.label}-${cta.url}`} to={cta.url} className={cta.primary ? primaryCta : ghostCta}>
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <EventsCarousel seasons={seasons} tournaments={tournaments} leagues={leagues} />

        {showDiscordBanner && user && (
          <div className={cn(pagePad, "pt-10")}>
            <DiscordJoinCard variant="banner" onSkip={() => setShowDiscordBanner(false)} />
          </div>
        )}

        <FeatureBlock {...features[0]} />
        <NewsMosaic items={newsItems} />
        <FeatureBlock {...features[1]} />
        <ScheduleFrame matches={matches} />
        <FeatureBlock {...features[2]} />
        <InboxPanel messages={messages} user={user} />

        <section className="border-t border-white/[.08] bg-[#080d22] py-[clamp(64px,8vw,112px)]">
          <div className={pagePad}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <h2 className={cn(fontDisplay, "m-0 text-[clamp(48px,6vw,96px)] font-normal uppercase leading-[.9] text-white")}>
                {t("commonPages.homeJumpIn")}
              </h2>
              <div className={cn(fontMono, "text-xs font-bold uppercase tracking-[.32em] text-[#4d8dff]")}>
                {t("commonPages.homePlatform")}
              </div>
            </div>
            <p className="mb-8 max-w-[52ch] text-lg leading-[1.6] text-[#aab3c8]">
              {t("commonPages.homeJumpInDesc")}
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-px border border-white/10 bg-white/10">
              {NAV_CARDS.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className={cn(focusRing, "block bg-[#080d22] px-8 pb-10 pt-9 transition-colors hover:bg-[#0c1330]")}
                >
                  <div className="mb-6 h-1 w-7" style={{ background: card.accent }} />
                  <h3 className={cn(fontDisplay, "m-0 text-[26px] font-normal uppercase leading-[1.1] text-white")}>
                    {t(`commonPages.${card.labelKey}`)}
                  </h3>
                  <p className="mt-3 text-base leading-[1.6] text-[#aab3c8]">
                    {t(`commonPages.${card.descKey}`)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(pagePad, "mx-auto max-w-3xl py-[clamp(64px,8vw,112px)]")}>
          <div className={cn(kickerClass, "mb-[18px]")}>{t("commonPages.homeQuestions")}</div>
          <h2 className={cn(fontDisplay, "m-0 text-[clamp(40px,5vw,72px)] font-normal uppercase leading-[.9] text-white")}>
            {t("commonPages.homeFaq")}
          </h2>
          <p className="mb-8 mt-5 text-lg leading-[1.6] text-[#aab3c8]">{t("commonPages.homeFaqDesc")}</p>
          <div>
            {(faqItems.length ? faqItems : DEFAULTS.faq_items).map((item) => (
              <FaqItem key={item.id || item.question} question={item.question} answer={item.answer} />
            ))}
            <div className="border-t border-white/12" />
          </div>
        </section>

        <footer className={cn(pagePad, "border-t border-white/[.08] py-12")}>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div>
              <p className={cn(fontDisplay, fontItalic, "text-5xl uppercase leading-none text-[#00d4ff] [text-shadow:0_0_28px_rgba(0,212,255,.45)]")}>
                STAGE
              </p>
              <p className="mt-4 max-w-xs text-sm leading-[1.6] text-[#7f8aa3]">
                {textOrDefault(c.footer_tagline, DEFAULTS.footer_tagline)}
              </p>
            </div>
            <div>
              <p className={cn(fontMono, "mb-4 text-[11px] font-bold uppercase tracking-[.22em] text-[#7f8aa3]")}>
                {t("commonPages.homePlatform")}
              </p>
              <div className="space-y-2">
                {FOOTER_LINKS.map(([labelKey, to]) => (
                  <Link key={to} to={to} className="block text-sm text-[#aab3c8] transition-colors hover:text-white">
                    {t(`commonPages.${labelKey}`)}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className={cn(fontMono, "mb-4 text-[11px] font-bold uppercase tracking-[.22em] text-[#7f8aa3]")}>
                {t("commonPages.homeContact")}
              </p>
              <a
                href={`mailto:${textOrDefault(c.contact_email, DEFAULTS.contact_email)}`}
                className={cn(focusRing, "text-sm text-[#aab3c8] transition-colors hover:text-[#00d4ff]")}
              >
                {textOrDefault(c.contact_email, DEFAULTS.contact_email)}
              </a>
            </div>
          </div>
          <div className={cn(fontMono, "mt-10 border-t border-white/[.08] pt-6 text-center text-[11px] tracking-[.14em] text-[#7f8aa3]")}>
            © {new Date().getFullYear()} STAGE. {t("commonPages.homeRights")}
          </div>
        </footer>
      </div>
    </div>
  );
}
