import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Shield, Trophy, BarChart3, User, ArrowLeftRight,
  Search, Rss, ShoppingBag, Video, UsersRound, Handshake,
  Palette, ChevronDown, Newspaper, ShieldAlert, Settings,
  Inbox, CalendarDays, Zap, Coins, Heart, Sun, Moon, LogOut, Star, Bell,
  AlertTriangle, Flag, MessagesSquare, Globe2, Activity, HelpCircle,
  ChevronLeft, ChevronRight, X, LayoutDashboard,
} from "lucide-react";
import LogoImg from '@/assets/Stadium Logo.png';
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { useAuth } from "@/lib/AuthContext";
import { isAppAdminUser, shouldShowAdminHeader } from "@/lib/adminAuth";
import { processPlayerSalary } from "@/lib/salaryProcessor";
import { normalizeSubscriptionTier } from "@/lib/subscriptionUtils";
import { useTranslation } from "@/hooks/useTranslation";
import ProfileCompletionModal from "./ProfileCompletionModal";
import ClubOnboardingModal from "./ClubOnboardingModal";
import NotificationBell from "./NotificationBell";
import { useChatNotifications } from "@/lib/ChatNotificationsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Paths that only match exactly (never as a prefix for child routes). */
const NAV_ROOT_PATHS = new Set(["/", "/admin"]);

function isNavItemActive(itemPath, pathname) {
  if (pathname === itemPath) return true;
  if (NAV_ROOT_PATHS.has(itemPath)) return false;
  return pathname.startsWith(`${itemPath}/`);
}

function findActiveNavItem(items, pathname) {
  let best = null;
  for (const item of items) {
    if (!isNavItemActive(item.path, pathname)) continue;
    if (!best || item.path.length > best.path.length) best = item;
  }
  return best;
}

function findActiveInGroups(groups, pathname) {
  for (const group of groups) {
    const item = findActiveNavItem(group.items, pathname);
    if (item) return { group, item };
  }
  return null;
}

/* ── constants ─────────────────────────────────────────────── */
const BADGE_IMAGES = {
  stage_plus: "https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/e95c37867_generated_image.png",
};

const SUBSCRIPTION_LABELS = {
  free: "free",
  stage_plus: "stage plus",
};

const THEMES = [
  { id: "theme-dark",   label: "Dark",       icon: Moon },
  { id: "theme-light",  label: "Day",        icon: Sun  },
  { id: "theme-video",  label: "Live Dark",  icon: Video },
  { id: "theme-white",  label: "Live White", icon: Sun  },
  { id: "theme-custom", label: "Custom",     icon: Palette },
];

function getPlayerGroups(t, _clubPath) {
  const homeItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { path: "/",            icon: Home,            label: t("nav.welcome") },
    { path: "/profile",     icon: User,            label: t("nav.myProfile") },
    { path: "/inbox",       icon: Inbox,           label: t("nav.inbox") },
    { path: "/schedule",    icon: CalendarDays,    label: t("nav.schedule") },
  ];
  return [
    { label: t("nav.home"), items: homeItems },
    {
      label: t("nav.compete"),
      items: [
        { path: "/game-day",        icon: Zap,       label: t("nav.gameDay") },
        { path: "/competitions",    icon: Star,      label: t("nav.competitions") },
        { path: "/tournaments",     icon: Trophy,    label: t("nav.tournaments") },
        { path: "/international",   icon: Globe2,    label: t("nav.international") },
        { path: "/register-league", icon: Shield,    label: t("nav.register") },
        { path: "/rankings",        icon: BarChart3, label: t("nav.rankings") },
      ],
    },
    {
      label: t("nav.community"),
      items: [
        { path: "/clubs",        icon: Shield,     label: t("nav.clubs") },
        { path: "/players-list", icon: UsersRound, label: t("nav.players") },
        { path: "/social",       icon: Rss,        label: t("nav.feed") },
        { path: "/community",    icon: MessagesSquare, label: t("nav.discord") },
        { path: "/follow-back",  icon: Heart,      label: t("nav.followBack") },
      ],
    },
    {
      label: t("nav.market"),
      items: [
        { path: "/recruitment",     icon: Handshake,      label: t("nav.recruitment") },
        { path: "/transfer-market", icon: ArrowLeftRight, label: t("nav.transfers") },
        { path: "/lifestyle",       icon: Coins,          label: t("nav.lifestyle") },
        { path: "/wallet",          icon: Zap,            label: t("nav.wallet") },
      ],
    },
    {
      label: t("nav.discover"),
      items: [
        { path: "/news",  icon: Newspaper,   label: t("nav.news") },
        { path: "/store", icon: ShoppingBag, label: t("nav.store") },
      ],
    },
  ];
}

function getTournamentLimitedGroups(t, tournamentId, participantType) {
  const tid = tournamentId || "";
  const isPlayerType = participantType === "player";

  const communityItems = isPlayerType
    ? [{ path: "/tournaments/players", icon: UsersRound, label: t("nav.players") }]
    : [{ path: "/tournaments/clubs",   icon: Shield,     label: t("nav.clubs") }];
  communityItems.push({ path: "/tournaments/trophy", icon: Trophy, label: t("nav.trophy") });

  const profileItems = [
    { path: "/tournaments/profile-player", icon: User, label: t("nav.myProfile") },
  ];
  if (!isPlayerType) {
    profileItems.push({ path: "/tournaments/profile-club", icon: Shield, label: t("nav.myClub") });
  }
  profileItems.push({ path: "/tournaments/settings", icon: Settings, label: t("nav.settings") });

  return [
    {
      label: t("nav.tournament"),
      items: [
        { path: `/tournaments/${tid}`,   icon: Trophy,       label: t("nav.tournament") },
        { path: "/tournaments/game-day", icon: Zap,          label: t("nav.gameDay") },
        { path: "/tournaments/schedule", icon: CalendarDays, label: t("nav.schedule") },
        { path: "/tournaments/inbox",    icon: Inbox,        label: t("nav.inbox") },
      ],
    },
    { label: isPlayerType ? t("nav.players") : t("nav.clubs"), items: communityItems },
    { label: t("nav.profile"), items: profileItems },
  ];
}

function getOwnerGroups(t, clubPath) {
  const homeItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { path: "/",            icon: Home,            label: t("nav.welcome") },
    { path: "/inbox",       icon: Inbox,           label: t("nav.inbox") },
    { path: "/schedule",    icon: CalendarDays,    label: t("nav.schedule") },
  ];
  if (clubPath) homeItems.push({ path: clubPath, icon: Shield, label: t("nav.myClub") });
  return [
    { label: t("nav.home"), items: homeItems },
    {
      label: t("nav.squad"),
      items: [
        { path: "/players-list",    icon: UsersRound,     label: t("nav.players") },
        { path: "/game-day",        icon: Zap,            label: t("nav.gameDay") },
      ],
    },
    {
      label: t("nav.market"),
      items: [
        { path: "/recruitment",     icon: Handshake,      label: t("nav.recruitment") },
        { path: "/transfer-market", icon: ArrowLeftRight, label: t("nav.transfers") },
        { path: "/lifestyle",       icon: Coins,          label: t("nav.lifestyle") },
        { path: "/wallet",          icon: Zap,            label: t("nav.wallet") },
      ],
    },
    {
      label: t("nav.competitions"),
      items: [
        { path: "/competitions",    icon: Star,      label: t("nav.competitions") },
        { path: "/tournaments",     icon: Trophy,    label: t("nav.tournaments") },
        { path: "/international",   icon: Globe2,    label: t("nav.international") },
        { path: "/register-league", icon: Shield,    label: t("nav.register") },
        { path: "/rankings",        icon: BarChart3, label: t("nav.rankings") },
      ],
    },
    {
      label: t("nav.discover"),
      items: [
        { path: "/news",  icon: Newspaper,   label: t("nav.news") },
        { path: "/community", icon: MessagesSquare, label: t("nav.discord") },
        { path: "/store", icon: ShoppingBag, label: t("nav.store") },
      ],
    },
  ];
}

function getAdminGroups() {
  return [
    {
      label: "Admin",
      items: [
        { path: "/admin", icon: ShieldAlert, label: "Dashboard" },
        { path: "/admin/disputes", icon: AlertTriangle, label: "Disputes" },
        { path: "/admin/forfeits", icon: Flag, label: "Forfeits" },
        { path: "/admin/players", icon: UsersRound, label: "Players" },
        { path: "/admin/identity-claims", icon: User, label: "Identity Claims" },
        { path: "/admin/clubs", icon: Shield, label: "Clubs" },
        { path: "/admin/rankings", icon: BarChart3, label: "Rankings" },
        { path: "/admin/analytics", icon: Activity, label: "Analytics" },
        { path: "/admin/leagues", icon: Trophy, label: "Leagues" },
        { path: "/admin/tournaments", icon: Trophy, label: "Tournaments" },
        { path: "/admin/international-tournaments", icon: Globe2, label: "International" },
        { path: "/admin/recruitment", icon: Handshake, label: "Recruitment" },
        { path: "/admin/store", icon: ShoppingBag, label: "Store" },
      ],
    },
    {
      label: "Operations",
      items: [
        { path: "/admin/trophies", icon: Trophy, label: "Trophies" },
        { path: "/admin/rewards", icon: Star, label: "Rewards" },
        { path: "/admin/news", icon: Newspaper, label: "News" },
        { path: "/admin/press-conferences", icon: Newspaper, label: "PressConferences" },
        { path: "/admin/lifestyles", icon: Coins, label: "LifeStyles" },
        { path: "/admin/transfers", icon: ArrowLeftRight, label: "Transfers" },
        { path: "/admin/home", icon: Palette, label: "Home Page" },
        { path: "/admin/landing", icon: Palette, label: "Landing Page" },
      ],
    },
    {
      label: "Community",
      items: [
        { path: "/community", icon: MessagesSquare, label: "Discord" },
      ],
    },
  ];
}

/* ── Layout typography ───────────────────────────────────── */
const TEAL = "#00E5BD";
const headingFont = { fontFamily: "var(--font-heading)" };

const MOBILE_WALKTHROUGHS = [
  {
    path: "/tournaments/game-day",
    label: "Tournament match",
    title: "Tournament match day",
    steps: [
      "Use this screen for tournament fixtures that need to be played or confirmed.",
      "Open a match to see opponent, rules, deadline and result actions.",
      "Submit results carefully because tournament standings depend on this flow.",
    ],
  },
  {
    path: "/tournaments/schedule",
    label: "Tournament schedule",
    title: "Tournament schedule",
    steps: [
      "Check tournament fixtures, rounds and deadlines here.",
      "Use this before match day to understand what is coming next.",
      "If timing needs coordination, continue through Inbox or the match detail.",
    ],
  },
  {
    path: "/tournaments/inbox",
    label: "Tournament inbox",
    title: "Tournament inbox",
    steps: [
      "Tournament invites, match messages and admin decisions arrive here.",
      "Open each item to accept, respond, or continue the tournament flow.",
      "Unread items usually mean your tournament progress needs attention.",
    ],
  },
  {
    path: "/tournaments/players",
    label: "Tournament players",
    title: "Tournament players",
    steps: [
      "Review registered players and tournament participants here.",
      "Open profiles to inspect identity, eligibility and performance context.",
      "Use this page before matches to understand who is active in the bracket or league.",
    ],
  },
  {
    path: "/tournaments/clubs",
    label: "Tournament clubs",
    title: "Tournament clubs",
    steps: [
      "Review registered clubs and tournament teams here.",
      "Open club profiles to inspect squad, owner and tournament context.",
      "Use this page before matches to understand opponents and participants.",
    ],
  },
  {
    path: "/game-day",
    label: "Matchs",
    title: "Match day",
    steps: [
      "Start here when you have a fixture to play, confirm, or follow live.",
      "Open the match card to see opponent, deadline, chat, stream and result actions.",
      "After the game, submit the result and keep evidence ready if there is a dispute.",
    ],
  },
  {
    path: "/competitions",
    label: "Compete",
    title: "Compete",
    steps: [
      "Use this page to choose what kind of competition you want to enter.",
      "Open a competition to see format, entry rules, standings and available actions.",
      "If you are not sure where to start, go from Competitions to Register or Tournaments.",
    ],
  },
  {
    path: "/clubs",
    label: "Club",
    title: "Club hub",
    steps: [
      "Find clubs, open your club profile, or inspect another team before a match.",
      "Club owners manage identity, squad, finance and operations from the club detail page.",
      "Players can use club pages to understand rosters, activity and recruitment fit.",
    ],
  },
  {
    path: "/schedule",
    label: "Schedule",
    title: "Schedule",
    steps: [
      "Check upcoming fixtures and deadlines here before going to Match Day.",
      "Use filters or calendar views to find the match that needs attention.",
      "If a time needs to be arranged, use the match details or inbox proposal flow.",
    ],
  },
  {
    path: "/inbox",
    label: "Inbox",
    title: "Inbox",
    steps: [
      "This is where match proposals, contract offers, club messages and requests arrive.",
      "Open a message to accept, decline, reply, or continue the related action.",
      "Unread items usually mean something needs a decision before you continue.",
    ],
  },
  {
    path: "/tournaments",
    label: "Tournament",
    title: "Tournaments",
    steps: [
      "Browse available tournaments and open one to inspect rules, teams and schedule.",
      "Admins and eligible club owners can create or manage tournaments from tournament controls.",
      "Players should check registration status and deadlines before match day starts.",
    ],
  },
  {
    path: "/international",
    label: "International",
    title: "International",
    steps: [
      "Use this area for national competitions and international tournament formats.",
      "Open a tournament card to see eligibility, squad rules and current phase.",
      "Follow the page prompts to register, vote, build squads, or track progress.",
    ],
  },
  {
    path: "/register-league",
    label: "Register",
    title: "Register",
    steps: [
      "Start registration here when a league or season opens.",
      "Check the requirements, choose your club or player entry, then submit before the deadline.",
      "After registering, use Schedule and Inbox to follow next steps.",
    ],
  },
  {
    path: "/rankings",
    label: "Rankings",
    title: "Rankings",
    steps: [
      "Compare players, clubs and competition performance here.",
      "Use ranking context to understand form, activity and who is moving up.",
      "Open profiles from rankings when you want deeper stats or scouting context.",
    ],
  },
  {
    path: "/players-list",
    label: "Players",
    title: "Players",
    steps: [
      "Search the player pool and open profiles to inspect stats, role and activity.",
      "Club owners can use this page as a scouting starting point.",
      "Players can compare themselves and discover potential teammates or rivals.",
    ],
  },
  {
    path: "/free-agents",
    label: "Free Agents",
    title: "Free agents",
    steps: [
      "Find players who are available for clubs or looking for opportunities.",
      "Open a player profile before contacting or recruiting them.",
      "Use Recruitment or Inbox when you are ready to move from interest to action.",
    ],
  },
  {
    path: "/recruitment",
    label: "Recruitment",
    title: "Recruitment",
    steps: [
      "Club owners manage scouting and recruitment conversations from here.",
      "Review player fit, availability and current status before making an offer.",
      "Use Inbox to continue conversations and contract flows after contact starts.",
    ],
  },
  {
    path: "/transfer-market",
    label: "Transfers",
    title: "Transfers",
    steps: [
      "Browse players and transfer opportunities across the market.",
      "Use filters to narrow by role, value, availability or club context.",
      "Open a transfer detail before making a move so the terms are clear.",
    ],
  },
  {
    path: "/wallet",
    label: "Wallet",
    title: "Wallet",
    steps: [
      "Track your balance, rewards and financial activity here.",
      "Check recent movements before making club, contract or store decisions.",
      "If something looks wrong, keep the transaction visible before contacting an admin.",
    ],
  },
  {
    path: "/social",
    label: "Feed",
    title: "Feed",
    steps: [
      "Use the feed to follow community updates, club moments and player activity.",
      "Post or react when the page offers social actions.",
      "Open profiles, clubs or news items from the feed when something needs context.",
    ],
  },
  {
    path: "/community",
    label: "Discord",
    title: "Discord",
    steps: [
      "This page connects the app community and Discord-style coordination.",
      "Use it when you need broader discussion, announcements or community links.",
      "For private match or contract actions, use Inbox instead.",
    ],
  },
  {
    path: "/follow-back",
    label: "Follow Back",
    title: "Follow back",
    steps: [
      "See who follows you and decide who to follow back.",
      "Use this to build a useful player and club network without searching manually.",
      "Open profiles first when you want to check who someone is before following.",
    ],
  },
  {
    path: "/profile",
    label: "Profile",
    title: "Profile",
    steps: [
      "This is your player identity: stats, reputation, trophies and public information.",
      "Keep your profile complete so clubs and tournament admins can understand your role.",
      "Use club links, trophy sections and activity to move into deeper details.",
    ],
  },
  {
    path: "/search",
    label: "Search",
    title: "Search",
    steps: [
      "Search across players, clubs and key app content from one place.",
      "Use precise names when you know them, or broad terms when discovering.",
      "Open a result to continue into the correct page flow.",
    ],
  },
  {
    path: "/lifestyle",
    label: "Lifestyle",
    title: "Lifestyle",
    steps: [
      "Browse lifestyle items and identity upgrades for your STAGE presence.",
      "Open an item to understand its price, effect and availability.",
      "Check Wallet first if you are planning purchases or rewards spending.",
    ],
  },
  {
    path: "/store",
    label: "Store",
    title: "Store",
    steps: [
      "Use the store for purchasable items, upgrades and unlocks.",
      "Open an item before buying so you understand cost and ownership.",
      "Wallet shows your balance and recent transactions after store activity.",
    ],
  },
  {
    path: "/news",
    label: "News",
    title: "News",
    steps: [
      "Read announcements, competition updates and platform news here.",
      "Open articles when you need the full context behind a change or event.",
      "Important news may affect registration windows, schedules or admin decisions.",
    ],
  },
];

const MOBILE_WALKTHROUGH_KEYS_BY_PATH = {
  "/tournaments/game-day": "tournamentMatch",
  "/tournaments/schedule": "tournamentSchedule",
  "/tournaments/inbox": "tournamentInbox",
  "/tournaments/players": "tournamentPlayers",
  "/tournaments/clubs": "tournamentClubs",
  "/game-day": "matches",
  "/competitions": "compete",
  "/clubs": "club",
  "/schedule": "schedule",
  "/inbox": "inbox",
  "/tournaments": "tournaments",
  "/international": "international",
  "/register-league": "register",
  "/rankings": "rankings",
  "/players-list": "players",
  "/free-agents": "freeAgents",
  "/recruitment": "recruitment",
  "/transfer-market": "transfers",
  "/wallet": "wallet",
  "/social": "feed",
  "/community": "discord",
  "/follow-back": "followBack",
  "/profile": "profile",
  "/search": "search",
  "/lifestyle": "lifestyle",
  "/store": "store",
  "/news": "news",
};

const NAV_LABEL_KEYS = {
  "Home": "home",
  "Welcome": "welcome",
  "Dashboard": "dashboard",
  "Matchs": "matches",
  "Matches": "matches",
  "Game Day": "gameDay",
  "Compete": "compete",
  "Competitions": "compete",
  "Club": "club",
  "Clubs": "club",
  "My Club": "myClub",
  "More": "more",
  "Schedule": "schedule",
  "Inbox": "inbox",
  "Notifications": "notifications",
  "Tournaments": "tournaments",
  "Tournament": "tournament",
  "International": "international",
  "Register": "register",
  "Rankings": "rankings",
  "Players": "players",
  "Free Agents": "freeAgents",
  "Recruitment": "recruitment",
  "Transfers": "transfers",
  "Wallet": "wallet",
  "Feed": "feed",
  "Discord": "discord",
  "Follow Back": "followBack",
  "Profile": "profile",
  "My Profile": "myProfile",
  "Search": "search",
  "Lifestyle": "lifestyle",
  "Store": "store",
  "News": "news",
  "Settings": "settings",
  "Trophy": "trophy",
};

function translateNavLabel(t, label) {
  const key = NAV_LABEL_KEYS[label];
  return key ? t(`nav.${key}`) : label;
}

function getMobileWalkthrough(pathname) {
  if (!pathname || pathname.startsWith("/settings")) return null;
  const normalized = pathname.replace(/\/$/, "") || "/";
  const sorted = [...MOBILE_WALKTHROUGHS].sort((a, b) => b.path.length - a.path.length);
  const guide = sorted.find((item) => normalized === item.path || normalized.startsWith(`${item.path}/`));
  if (!guide) return null;
  return { ...guide, i18nKey: MOBILE_WALKTHROUGH_KEYS_BY_PATH[guide.path] };
}

const getEafcDropdownStyle = (isWhiteTheme = false) => ({
  background: isWhiteTheme
    ? "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)"
    : "linear-gradient(160deg, #0c1426 0%, #080f1d 100%)",
  border: "1px solid rgba(0,229,189,0.14)",
  borderTop: "2px solid #00E5BD",
  borderRadius: "0 0 3px 3px",
  boxShadow: isWhiteTheme
    ? "0 20px 50px rgba(15,23,42,0.14), 0 0 24px rgba(0,229,189,0.05)"
    : "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,189,0.05)",
});

function EafcNavLink({ to, onClick, isActive, icon: Icon, children, isWhiteTheme = false }) {
  return (
    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2.5 px-3 py-2.5 outline-none transition-colors",
          isActive ? "text-[#00E5BD]" : (isWhiteTheme ? "text-slate-900/75 hover:text-slate-900" : "text-white/55 hover:text-white")
        )}
        style={{
          ...headingFont,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: isActive ? "rgba(0,229,189,0.08)" : "transparent",
        }}
      >
        {isActive && <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: TEAL }} />}
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#00E5BD]" : (isWhiteTheme ? "text-slate-900/45" : "text-white/30"))} />
        {children}
      </Link>
    </DropdownMenuItem>
  );
}

function SidebarNavSectionDropdowns({ groups, pathname, onItemClick, variant = "sidebar", isWhiteTheme = false }) {
  const isHeader = variant === "header";

  if (!isHeader) {
    const activeNav = findActiveInGroups(groups, pathname);
    const anyActive = Boolean(activeNav);
    const triggerLabel = activeNav?.item.label ?? "Navigate";
    return (
      <div className="flex flex-1 flex-col px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.18em] transition-all",
                anyActive
                  ? "border-[#00E5BD]/25 bg-[#00E5BD]/10 text-white"
                  : "border-white/6 bg-white/[0.02] text-white/40 hover:border-white/10 hover:bg-white/[0.06] hover:text-white/80"
              )}
              style={{ ...headingFont, fontWeight: 600 }}
            >
              <span>{triggerLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-45" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className={cn("z-[70] max-h-[min(70vh,28rem)] min-w-[12rem] overflow-y-auto p-1 shadow-xl", isWhiteTheme ? "text-slate-900" : "text-white")} style={getEafcDropdownStyle(isWhiteTheme)}>
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />}
                <DropdownMenuLabel className="px-3 py-1 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 600, color: "rgba(0,229,189,0.5)" }}>
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((item) => (
                  <EafcNavLink key={item.path} to={item.path} onClick={onItemClick} isActive={isNavItemActive(item.path, pathname)} icon={item.icon} isWhiteTheme={isWhiteTheme}>
                    {item.label}
                  </EafcNavLink>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <nav className="flex flex-row items-stretch gap-px shrink-0 self-stretch">
      {groups.map((group) => {
        const activeItem = findActiveNavItem(group.items, pathname);
        const anyActive = Boolean(activeItem);
        const triggerLabel = activeItem?.label ?? group.label;
        return (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 flex items-center gap-1 px-3 sm:px-4 outline-none self-stretch"
                style={{
                  ...headingFont,
                  clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
                  transition: "all 0.12s ease",
                  background: anyActive
                    ? "linear-gradient(135deg, rgba(0,229,189,0.18) 0%, rgba(0,229,189,0.08) 100%)"
                    : "rgba(255,255,255,0.025)",
                  borderBottom: anyActive ? "2px solid #00E5BD" : "2px solid rgba(255,255,255,0.07)",
                  boxShadow: anyActive ? "0 0 16px rgba(0,229,189,0.15), inset 0 1px 0 rgba(0,229,189,0.12)" : "none",
                }}
              >
                <span
                  className={cn("select-none text-[12px] sm:text-[14px] uppercase", anyActive ? "text-[#00E5BD]" : (isWhiteTheme ? "text-slate-900/65" : "text-white/40"))}
                  style={{ ...headingFont, fontWeight: 600, letterSpacing: "0.14em", transition: "color 0.12s" }}
                >
                  {triggerLabel}
                </span>
                <ChevronDown className={cn("shrink-0 h-3 w-3", anyActive ? "text-[#00E5BD]" : (isWhiteTheme ? "text-slate-900/45" : "text-white/25"))} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={0} className={cn("z-[70] min-w-[12.5rem] p-1 shadow-2xl", isWhiteTheme ? "text-slate-900" : "text-white")} style={getEafcDropdownStyle(isWhiteTheme)}>
              {group.items.map((item) => (
                <EafcNavLink key={item.path} to={item.path} onClick={onItemClick} isActive={isNavItemActive(item.path, pathname)} icon={item.icon} isWhiteTheme={isWhiteTheme}>
                  {item.label}
                </EafcNavLink>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

/* Header: identity (player gamertag or club name) opens menu with Player/Owner + settings + logout */
function HeaderIdentityMenu({
  myPlayer,
  myClub,
  myClubId,
  accountMode,
  switchMode,
  subscriptionTier,
  isWhiteTheme = false,
}) {
  const canUseClubIdentity = Boolean(myClubId && myClub);
  const showAsOwner = accountMode === "club" && canUseClubIdentity;
  const canSwitchRole = Boolean(myPlayer && myClubId);

  if (!myPlayer && !canUseClubIdentity) return null;

  const avatarPx = 36;
  const avatarRing = {
    width: avatarPx,
    height: avatarPx,
    outline: "1.5px solid rgba(0,229,189,0.4)",
    outlineOffset: 1,
    borderRadius: "9999px",
  };

  const clubLogoFallback =
    myClub &&
    `https://ui-avatars.com/api/?name=${encodeURIComponent(myClub.tag || myClub.name || "?")}&background=1a1a2e&color=fff&size=128&bold=true&font-size=0.4`;

  const primaryLine =
    showAsOwner && myClub ? myClub.name : myPlayer?.gamertag || myClub?.name || "";

  const subLabelStyle = { ...headingFont, fontWeight: 600, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: TEAL };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex shrink-0 items-center gap-2.5 text-left outline-none transition-opacity hover:opacity-95" style={{ maxWidth: 280 }}>
          {showAsOwner && myClub ? (
            <div className="shrink-0 overflow-hidden rounded-full bg-white/10" style={avatarRing}>
              <img
                src={myClub.logo_url || clubLogoFallback}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: myClub.logo_position || "50% 50%" }}
              />
            </div>
          ) : (
            <div
              className="shrink-0 rounded-full bg-white/10"
              style={{
                ...avatarRing,
                ...(myPlayer?.avatar_url
                  ? {
                      backgroundImage: `url(${myPlayer.avatar_url})`,
                      backgroundSize: `${myPlayer.avatar_zoom || 150}%`,
                      backgroundPosition: myPlayer.avatar_position || "50% 50%",
                      backgroundRepeat: "no-repeat",
                    }
                  : {}),
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("truncate", isWhiteTheme ? "text-slate-900" : "text-white")} style={{ ...headingFont, fontWeight: 600, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {primaryLine}
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              {showAsOwner && myClub ? (
                <span style={subLabelStyle}>{myClub.tag ? `[${myClub.tag}]` : "Owner"}</span>
              ) : (
                <>
                  {BADGE_IMAGES[subscriptionTier] && myPlayer && (
                    <img src={BADGE_IMAGES[subscriptionTier]} alt={subscriptionTier} className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />
                  )}
                  <span style={subLabelStyle}>{myPlayer ? (SUBSCRIPTION_LABELS[subscriptionTier] || subscriptionTier) : "Club"}</span>
                </>
              )}
            </div>
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0", isWhiteTheme ? "text-slate-900/55" : "text-white/40")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn("z-[80] w-52 p-1", isWhiteTheme ? "text-slate-900" : "text-white")} style={getEafcDropdownStyle(isWhiteTheme)}>
        {canSwitchRole && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 600, color: "rgba(0,229,189,0.5)" }}>
              Account
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={accountMode} onValueChange={switchMode}>
              <DropdownMenuRadioItem
                value="player"
                className={cn("cursor-pointer gap-2 py-2.5 focus:bg-blue-600/20", isWhiteTheme ? "text-slate-900/80 focus:text-slate-900" : "text-white/80 focus:text-white")}
                style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <User className="h-4 w-4 shrink-0 text-blue-400" /> Player
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="club"
                className={cn("cursor-pointer gap-2 py-2.5 focus:bg-amber-500/20", isWhiteTheme ? "text-slate-900/80 focus:text-slate-900" : "text-white/80 focus:text-white")}
                style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-400" /> Owner
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
          </>
        )}
        <DropdownMenuItem asChild className={cn("cursor-pointer", isWhiteTheme ? "focus:bg-slate-900/10" : "focus:bg-white/10")}>
          <Link
            to="/settings"
            className={cn("flex items-center gap-2 px-2 py-2.5", isWhiteTheme ? "text-slate-900/80" : "text-white/80")}
            style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <Settings className="h-4 w-4 shrink-0 text-[#00E5BD]" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-2 py-2.5 text-red-400 focus:bg-red-500/15 focus:text-red-300"
          style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          onClick={() => stageClient.auth.logout()}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Mobile primary tabs ──────────────────────────────────── */
function getMobilePrimary(accountMode, clubPath, isTournamentLimited, tournamentId) {
  if (isTournamentLimited) {
    return [
      { path: `/tournaments/${tournamentId || ""}`, icon: Trophy,       label: "Tournament" },
      { path: "/tournaments/game-day",              icon: Zap,          label: "Game Day"   },
      { path: "/tournaments/schedule",              icon: CalendarDays, label: "Schedule"   },
      { path: "/tournaments/inbox",                 icon: Inbox,        label: "Inbox"      },
    ];
  }
  if (accountMode === "club") {
    return [
      { path: "/dashboard",                 icon: LayoutDashboard, label: "Dashboard" },
      { path: "/game-day",                  icon: Zap,             label: "Matchs"   },
      { path: "/competitions",              icon: Trophy,          label: "Compete"  },
      { path: clubPath || "/clubs",         icon: Shield,          label: "Club"     },
    ];
  }
  return [
    { path: "/dashboard",                 icon: LayoutDashboard, label: "Dashboard" },
    { path: "/game-day",                  icon: Zap,             label: "Matchs"  },
    { path: "/competitions",              icon: Trophy,          label: "Compete" },
    { path: clubPath || "/clubs",         icon: Shield,          label: "Club"    },
  ];
}

const MOBILE_MORE_GROUPS_PLAYER = [
  {
    label: "Matchs",
    items: [
      { path: "/schedule",        icon: CalendarDays,  label: "Schedule"      },
      { path: "/inbox",           icon: Inbox,         label: "Inbox"         },
      { path: "/notifications",   icon: Bell,          label: "Notifications" },
    ],
  },
  {
    label: "Compete",
    items: [
      { path: "/tournaments",     icon: Trophy,        label: "Tournaments"   },
      { path: "/international",   icon: Globe2,        label: "International" },
      { path: "/register-league", icon: Shield,        label: "Register"      },
      { path: "/rankings",        icon: BarChart3,     label: "Rankings"      },
    ],
  },
  {
    label: "Club",
    items: [
      { path: "/players-list",    icon: UsersRound,    label: "Players"       },
      { path: "/free-agents",     icon: UsersRound,    label: "Free Agents"   },
      { path: "/recruitment",     icon: Handshake,      label: "Recruitment" },
      { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers"   },
      { path: "/wallet",          icon: Zap,            label: "Wallet"      },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/social",          icon: Rss,            label: "Feed"          },
      { path: "/community",       icon: MessagesSquare, label: "Discord"       },
      { path: "/follow-back",     icon: Heart,          label: "Follow Back"   },
    ],
  },
  {
    label: "Account",
    items: [
      { path: "/profile",         icon: User,          label: "Profile"       },
      { path: "/search",          icon: Search,        label: "Search"        },
      { path: "/lifestyle",       icon: Coins,           label: "Lifestyle"  },
      { path: "/store",           icon: ShoppingBag,     label: "Store"      },
      { path: "/news",            icon: Newspaper,     label: "News"          },
      { path: "/settings",        icon: Settings,      label: "Settings"      },
    ],
  },
];

function getMobileMoreGroupsOwner(clubPath) {
  return [
    {
      label: "Matchs",
      items: [
        { path: "/schedule",        icon: CalendarDays,  label: "Schedule"     },
        { path: "/inbox",           icon: Inbox,         label: "Inbox"        },
        { path: "/notifications",   icon: Bell,          label: "Notifications" },
      ],
    },
    {
      label: "Club",
      items: [
        ...(clubPath ? [{ path: clubPath, icon: Shield, label: "My Club" }] : []),
        { path: "/players-list",    icon: UsersRound,    label: "Squad"       },
        { path: "/recruitment",     icon: Handshake,      label: "Recruitment" },
        { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers"   },
        { path: "/contracts/create", icon: Handshake,     label: "Contracts"   },
        { path: "/lifestyle",       icon: Coins,          label: "Lifestyle"   },
        { path: "/wallet",          icon: Zap,            label: "Wallet"      },
      ],
    },
    {
      label: "Compete",
      items: [
        { path: "/tournaments",     icon: Trophy,         label: "Tournaments"  },
        { path: "/international",   icon: Globe2,         label: "International" },
        { path: "/register-league", icon: Shield,         label: "Register"     },
        { path: "/rankings",        icon: BarChart3,      label: "Rankings"     },
      ],
    },
    {
      label: "Account",
      items: [
        { path: "/profile",         icon: User,           label: "Profile"       },
        { path: "/social",          icon: Rss,            label: "Feed"          },
        { path: "/search",          icon: Search,         label: "Search"        },
        { path: "/news",            icon: Newspaper,      label: "News"          },
        { path: "/store",           icon: ShoppingBag,    label: "Store"         },
        { path: "/notifications",   icon: Bell,           label: "Notifications" },
        { path: "/settings",        icon: Settings,       label: "Settings"      },
      ],
    },
  ];
}

function getMobileMoreGroups(accountMode, clubPath, isTournamentLimited, _tournamentId, participantType) {
  if (isTournamentLimited) {
    const isPlayerType = participantType === "player";
    const communityItems = isPlayerType
      ? [{ path: "/tournaments/players", icon: UsersRound, label: "Players" }]
      : [{ path: "/tournaments/clubs",   icon: Shield,     label: "Clubs" }];
    communityItems.push({ path: "/tournaments/trophy", icon: Trophy, label: "Trophy" });

    const profileItems = [
      { path: "/tournaments/profile-player", icon: User, label: "My Profile" },
    ];
    if (!isPlayerType) {
      profileItems.push({ path: "/tournaments/profile-club", icon: Shield, label: "My Club" });
    }
    profileItems.push({ path: "/tournaments/settings", icon: Settings, label: "Settings" });

    return [
      { label: isPlayerType ? "Players" : "Clubs", items: communityItems },
      { label: "Profile", items: profileItems },
    ];
  }
  if (accountMode === "club") return getMobileMoreGroupsOwner(clubPath);
  return MOBILE_MORE_GROUPS_PLAYER;
}

function MobileMoreSheet({ open, onClose, pathname, accountMode, clubPath, isTournamentLimited, tournamentId, participantType }) {
  const { t } = useTranslation();
  const groups = getMobileMoreGroups(accountMode, clubPath, isTournamentLimited, tournamentId, participantType);
  return (
    <>
      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          style={{ WebkitBackdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
      )}
      {/* sheet */}
      <div
        className="mobile-liquid-sheet fixed left-0 right-0 z-[91] rounded-t-3xl overflow-hidden transition-transform duration-300 ease-out"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(110%)",
          paddingBottom: "calc(var(--mobile-tab-h) + var(--safe-bottom))",
          maxHeight: "82vh",
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="mobile-liquid-handle w-10 h-1 rounded-full" />
        </div>

        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ maxHeight: "calc(82vh - 60px)", WebkitOverflowScrolling: "touch" }}
        >
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-2 px-1"
                style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "rgba(0,229,189,0.45)" }}
              >
                {translateNavLabel(t, group.label)}
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(item.path, pathname);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        "mobile-liquid-menu-tile flex flex-col items-center gap-2 rounded-2xl py-5 px-2 transition-all active:scale-95",
                        isActive && "is-active"
                      )}
                    >
                      <Icon
                        className="w-7 h-7"
                        style={{ color: isActive ? "#00E5BD" : "rgba(255,255,255,0.55)" }}
                      />
                      <span
                        className="text-[11px] text-center leading-tight"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: isActive ? "#00E5BD" : "rgba(255,255,255,0.55)",
                        }}
                      >
                        {translateNavLabel(t, item.label)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MobileWalkthrough({ pathname }) {
  const { t } = useTranslation();
  const guide = getMobileWalkthrough(pathname);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const translatedGuide = guide?.i18nKey ? t(`walkthrough.${guide.i18nKey}`) : null;
  const translatedSteps = Array.isArray(translatedGuide?.steps) ? translatedGuide.steps : guide?.steps;
  const guideLabel = translatedGuide?.label || guide?.label;
  const guideTitle = translatedGuide?.title || guide?.title;
  const totalSteps = translatedSteps?.length || 0;
  const activeStep = translatedSteps?.[stepIndex] || "";

  useEffect(() => {
    setOpen(false);
    setStepIndex(0);
  }, [pathname]);

  if (!guide) return null;

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < totalSteps - 1;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="mobile-guide-chip md:hidden fixed right-4 z-[79] inline-flex items-center gap-2 rounded-full px-3.5 py-2 active:scale-95"
          style={{ bottom: "calc(var(--mobile-tab-h) + var(--safe-bottom) + 20px)" }}
          onClick={() => setOpen(true)}
          aria-label={t("mobile.openGuide", { label: guideLabel })}
        >
          <HelpCircle className="h-4 w-4" />
          <span>{t("mobile.guide")}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[92] bg-black/55 backdrop-blur-sm md:hidden"
          style={{ WebkitBackdropFilter: "blur(5px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <section
        className="mobile-guide-sheet md:hidden fixed left-0 right-0 z-[93] rounded-t-3xl overflow-hidden transition-transform duration-300 ease-out"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(110%)",
          paddingBottom: "calc(var(--safe-bottom) + 18px)",
        }}
        aria-hidden={!open}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="mobile-liquid-handle w-10 h-1 rounded-full" />
        </div>

        <div className="px-5 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mobile-guide-kicker">{guideLabel}</p>
              <h2 className="mobile-guide-title">{guideTitle}</h2>
            </div>
            <button
              type="button"
              className="mobile-guide-icon-button h-11 w-11 shrink-0 rounded-full"
              onClick={() => setOpen(false)}
              aria-label={t("mobile.closeGuide")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mobile-guide-card mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="mobile-guide-step-label">{t("mobile.stepCount", { current: stepIndex + 1, total: totalSteps })}</span>
              <div className="flex gap-1">
                {guide.steps.map((_, index) => (
                  <span
                    key={index}
                    className={cn("mobile-guide-dot", index === stepIndex && "is-active")}
                  />
                ))}
              </div>
            </div>
            <p className="mobile-guide-copy">{activeStep}</p>
          </div>

          <div className="mt-4 grid grid-cols-[44px_1fr_44px] gap-3">
            <button
              type="button"
              className="mobile-guide-icon-button rounded-2xl disabled:opacity-35"
              onClick={() => setStepIndex((v) => Math.max(0, v - 1))}
              disabled={!canGoBack}
              aria-label={t("mobile.previousStep")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="mobile-guide-primary rounded-2xl"
              onClick={() => (canGoNext ? setStepIndex((v) => v + 1) : setOpen(false))}
            >
              {canGoNext ? t("mobile.next") : t("mobile.done")}
            </button>
            <button
              type="button"
              className="mobile-guide-icon-button rounded-2xl disabled:opacity-35"
              onClick={() => setStepIndex((v) => Math.min(totalSteps - 1, v + 1))}
              disabled={!canGoNext}
              aria-label={t("mobile.nextStep")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function MobileBottomBar({ pathname, myPlayer, myClub, accountMode, notifCount, isTournamentLimited, tournamentId, participantType }) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { totalUnread: chatUnreadTotal, markAllRead: markAllChatsRead } = useChatNotifications();

  // Opening the Game Day page clears the unread-chat badge.
  const onGameDay = pathname === "/game-day" || pathname.startsWith("/game-day/");
  useEffect(() => {
    if (onGameDay && chatUnreadTotal > 0) markAllChatsRead();
  }, [onGameDay, chatUnreadTotal, markAllChatsRead]);

  const clubPath = myClub?.id ? `/clubs/${myClub.id}` : null;
  const primaryTabs = getMobilePrimary(accountMode, clubPath, isTournamentLimited, tournamentId);
  const moreGroups = getMobileMoreGroups(accountMode, clubPath, isTournamentLimited, tournamentId, participantType);
  const primaryActive = primaryTabs.find((t) => isNavItemActive(t.path, pathname));
  const moreActive = findActiveInGroups(moreGroups, pathname);
  const inMore = !primaryActive && Boolean(moreActive);
  const moreLabel = moreActive?.item.label ?? "More";
  return (
    <>
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
        accountMode={accountMode}
        clubPath={clubPath}
        isTournamentLimited={isTournamentLimited}
        tournamentId={tournamentId}
        participantType={participantType}
      />

      <nav
        className="mobile-liquid-nav fixed left-0 right-0 bottom-0 z-[80] md:hidden flex items-end"
        style={{
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="mobile-liquid-bar flex w-full">
          {primaryTabs.map((tab) => {
            const isActive = isNavItemActive(tab.path, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "mobile-liquid-tab flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
                  isActive && "is-active"
                )}
                style={{ minHeight: "var(--mobile-tab-h)" }}
                onClick={() => setMoreOpen(false)}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className="w-[22px] h-[22px] transition-colors"
                    style={{ color: isActive ? "#00E5BD" : "rgba(255,255,255,0.38)" }}
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: "#00E5BD", boxShadow: "0 0 6px #00E5BD" }}
                    />
                  )}
                  {tab.path === "/game-day" && chatUnreadTotal > 0 && (
                    <span
                      aria-label={`${chatUnreadTotal} unread chat messages`}
                      className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ background: "#ff4757", color: "#fff", padding: "0 3px" }}
                    >
                      {chatUnreadTotal > 9 ? "9+" : chatUnreadTotal}
                    </span>
                  )}
                </div>
                <span
                  className="text-[9px] transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: isActive ? "#00E5BD" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {translateNavLabel(t, tab.label)}
                </span>
              </Link>
            );
          })}

          {/* More */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "mobile-liquid-tab flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
              (moreOpen || inMore) && "is-active"
            )}
            style={{ minHeight: "var(--mobile-tab-h)" }}
          >
            <div className="relative">
              <div
                className="w-[22px] h-[22px] flex flex-col items-center justify-center gap-[3px]"
              >
                {[0,1,2].map((i) => (
                  <span
                    key={i}
                    className="block rounded-full transition-all"
                    style={{
                      width: moreOpen ? (i === 1 ? 14 : 10) : 14,
                      height: 2,
                      background: (moreOpen || inMore) ? "#00E5BD" : "rgba(255,255,255,0.38)",
                    }}
                  />
                ))}
              </div>
              {notifCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ background: "#ff4757", color: "#fff", padding: "0 3px" }}
                >
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </div>
            <span
              className="text-[9px] transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: (moreOpen || inMore) ? "#00E5BD" : "rgba(255,255,255,0.3)",
              }}
            >
              {translateNavLabel(t, moreLabel)}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

const ADMIN_MOBILE_PRIMARY = [
  { path: "/admin", icon: ShieldAlert, label: "Dash" },
  { path: "/admin/tournaments", icon: Trophy, label: "Tournois" },
  { path: "/admin/disputes", icon: AlertTriangle, label: "Matchs" },
  { path: "/admin/players", icon: UsersRound, label: "Players" },
];

const ADMIN_MOBILE_MORE_GROUPS = [
  {
    label: "Operations",
    items: [
      { path: "/admin/forfeits", icon: Flag, label: "Forfeits" },
      { path: "/admin/clubs", icon: Shield, label: "Clubs" },
      { path: "/admin/transfers", icon: ArrowLeftRight, label: "Transfers" },
      { path: "/admin/recruitment", icon: Handshake, label: "Recruitment" },
    ],
  },
  {
    label: "Competitions",
    items: [
      { path: "/admin/leagues", icon: Trophy, label: "Leagues" },
      { path: "/admin/international-tournaments", icon: Globe2, label: "International" },
      { path: "/admin/rankings", icon: BarChart3, label: "Rankings" },
      { path: "/admin/analytics", icon: Activity, label: "Analytics" },
    ],
  },
  {
    label: "Content",
    items: [
      { path: "/admin/news", icon: Newspaper, label: "News" },
      { path: "/admin/press-conferences", icon: Newspaper, label: "Press" },
      { path: "/admin/store", icon: ShoppingBag, label: "Store" },
      { path: "/admin/lifestyles", icon: Coins, label: "Lifestyle" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/admin/trophies", icon: Trophy, label: "Trophies" },
      { path: "/admin/rewards", icon: Star, label: "Rewards" },
      { path: "/admin/home", icon: Palette, label: "Home Page" },
      { path: "/admin/landing", icon: Palette, label: "Landing Page" },
      { path: "/community", icon: MessagesSquare, label: "Discord" },
    ],
  },
];

function AdminMobileMoreSheet({ open, onClose, pathname }) {
  const groups = ADMIN_MOBILE_MORE_GROUPS;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm md:hidden"
          style={{ WebkitBackdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
      )}
      <div
        className="mobile-liquid-sheet mobile-liquid-sheet-admin fixed left-0 right-0 z-[91] rounded-t-3xl overflow-hidden transition-transform duration-300 ease-out md:hidden"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(110%)",
          paddingBottom: "calc(var(--mobile-tab-h) + var(--safe-bottom))",
          maxHeight: "82vh",
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="mobile-liquid-handle w-10 h-1 rounded-full" />
        </div>

        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ maxHeight: "calc(82vh - 60px)", WebkitOverflowScrolling: "touch" }}
        >
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-2 px-1"
                style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "rgba(248,113,113,0.68)" }}
              >
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(item.path, pathname);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        "mobile-liquid-menu-tile flex flex-col items-center gap-2 rounded-2xl py-5 px-2 transition-all active:scale-95",
                        isActive && "is-active"
                      )}
                    >
                      <Icon
                        className="w-7 h-7"
                        style={{ color: isActive ? "#f87171" : "rgba(255,255,255,0.58)" }}
                      />
                      <span
                        className="text-[11px] text-center leading-tight"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: isActive ? "#f87171" : "rgba(255,255,255,0.58)",
                        }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AdminMobileBottomBar({ pathname }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryActive = ADMIN_MOBILE_PRIMARY.find((t) => isNavItemActive(t.path, pathname));
  const moreActive = findActiveInGroups(ADMIN_MOBILE_MORE_GROUPS, pathname);
  const inMore = !primaryActive && Boolean(moreActive);
  const moreLabel = inMore ? moreActive.item.label : "More";

  return (
    <>
      <AdminMobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
      />

      <nav
        className="mobile-liquid-nav mobile-liquid-nav-admin fixed left-0 right-0 bottom-0 z-[80] md:hidden flex items-end"
        style={{
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="mobile-liquid-bar flex w-full">
          {ADMIN_MOBILE_PRIMARY.map((tab) => {
            const isActive = isNavItemActive(tab.path, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "mobile-liquid-tab flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
                  isActive && "is-active"
                )}
                style={{ minHeight: "var(--mobile-tab-h)" }}
                onClick={() => setMoreOpen(false)}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className="w-[22px] h-[22px] transition-colors"
                    style={{ color: isActive ? "#f87171" : "rgba(255,255,255,0.38)" }}
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: "#f87171", boxShadow: "0 0 6px #f87171" }}
                    />
                  )}
                </div>
                <span
                  className="text-[9px] transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: isActive ? "#f87171" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "mobile-liquid-tab flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
              (moreOpen || inMore) && "is-active"
            )}
            style={{ minHeight: "var(--mobile-tab-h)" }}
          >
            <div className="w-[22px] h-[22px] flex flex-col items-center justify-center gap-[3px]">
              {[0,1,2].map((i) => (
                <span
                  key={i}
                  className="block rounded-full transition-all"
                  style={{
                    width: moreOpen ? (i === 1 ? 14 : 10) : 14,
                    height: 2,
                    background: (moreOpen || inMore) ? "#f87171" : "rgba(255,255,255,0.38)",
                  }}
                />
              ))}
            </div>
            <span
              className="text-[9px] transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: (moreOpen || inMore) ? "#f87171" : "rgba(255,255,255,0.3)",
              }}
            >
              {moreLabel}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function MobileTopBar({ myPlayer, myClub, accountMode, switchMode, subscriptionTier, notifCount, theme, setTheme, pathname, isAdmin, activePageLabel }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const takeoverId = typeof window !== "undefined" ? localStorage.getItem("admin_takeover_club_id") : null;
  const showAdminTakeoverExit = isAdmin && takeoverId && pathname && !pathname.startsWith("/admin");

  return (
    <header
      className="mobile-liquid-topbar md:hidden relative z-50 shrink-0 flex items-center justify-between px-4"
      style={{
        paddingTop: "calc(var(--safe-top) + 10px)",
        paddingBottom: 10,
        position: "relative",
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Link to="/" className="shrink-0">
          <img src={LogoImg} alt="STAGE" className="h-10 w-auto object-contain" />
        </Link>
        {activePageLabel && (
          <span
            className="text-[12px] uppercase truncate"
            style={{ ...headingFont, fontWeight: 600, letterSpacing: "0.14em", color: TEAL }}
          >
            {translateNavLabel(t, activePageLabel)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <MobileThemeButton theme={theme} setTheme={setTheme} />

        <NotificationBell />

        <Link
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className="mobile-liquid-icon-button w-11 h-11 flex items-center justify-center rounded-full outline-none"
          style={{
            color: isNavItemActive("/settings", pathname) ? TEAL : "rgba(255,255,255,0.7)",
          }}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>

        {showAdminTakeoverExit && (
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("admin_takeover_club_id");
              localStorage.setItem("stage_admin_effective_role_id", "0");
              navigate("/admin");
            }}
            className="ml-0.5 flex items-center gap-1 rounded-lg border border-amber-500/45 bg-amber-500/10 px-2 py-1"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#fbbf24",
            }}
            title="Admin takeover — back to Admin panel"
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Admin
          </button>
        )}

        <MobileIdentityMenu
          myPlayer={myPlayer}
          myClub={myClub}
          accountMode={accountMode}
          switchMode={switchMode}
        />
      </div>
    </header>
  );
}

function MobileThemeButton({ theme, setTheme }) {
  const current = THEMES.find((t) => t.id === theme) || THEMES[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mobile-liquid-icon-button w-11 h-11 flex items-center justify-center rounded-full outline-none"
          aria-label="Theme"
        >
          <Icon className="w-[18px] h-[18px] text-white/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[90] w-44 p-1 text-white"
        style={getEafcDropdownStyle(false)}
      >
        <DropdownMenuLabel
          className="px-2 py-1.5 text-[11px] uppercase tracking-[0.22em]"
          style={{ ...headingFont, fontWeight: 600, color: "rgba(0,229,189,0.5)" }}
        >
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEMES.map((t) => {
            const ThemeIcon = t.icon;
            return (
              <DropdownMenuRadioItem
                key={t.id}
                value={t.id}
                className="cursor-pointer gap-2 py-2 text-white/80 focus:bg-white/10 focus:text-white"
                style={{ ...headingFont, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <ThemeIcon className="h-3.5 w-3.5 shrink-0 text-[#00E5BD]" />
                {t.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileIdentityMenu({ myPlayer, myClub, accountMode, switchMode }) {
  const canSwitchRole = Boolean(myPlayer && myClub?.id);
  const showAsOwner = accountMode === "club" && Boolean(myClub?.id);
  const clubLogoFallback =
    myClub &&
    `https://ui-avatars.com/api/?name=${encodeURIComponent(myClub.tag || myClub.name || "?")}&background=1a1a2e&color=fff&size=128&bold=true&font-size=0.4`;

  const showPlayerAvatarBg = !showAsOwner && Boolean(myPlayer?.avatar_url);
  const avatarNode = (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border"
      style={{
        border: "1.5px solid rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.12)",
        ...(showPlayerAvatarBg && {
          backgroundImage: `url(${myPlayer.avatar_url})`,
          backgroundSize: `${myPlayer?.avatar_zoom || 150}%`,
          backgroundPosition: myPlayer?.avatar_position || "50% 50%",
          backgroundRepeat: "no-repeat",
        }),
      }}
    >
      {showAsOwner && myClub ? (
        <img
          src={myClub.logo_url || clubLogoFallback}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: myClub.logo_position || "50% 50%" }}
        />
      ) : (
        !myPlayer?.avatar_url && <User className="w-4 h-4 text-white/50" />
      )}
    </div>
  );

  // If user has only one identity, keep the bar minimal — direct link to profile.
  if (!canSwitchRole) {
    return (
      <Link to="/profile" className="ml-1">
        {avatarNode}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ml-1 outline-none">
          {avatarNode}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[90] w-52 p-1 text-white"
        style={getEafcDropdownStyle(false)}
      >
        <DropdownMenuLabel
          className="px-2 py-1.5 text-[11px] uppercase tracking-[0.22em]"
          style={{ ...headingFont, fontWeight: 600, color: "rgba(0,229,189,0.5)" }}
        >
          Account
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={accountMode} onValueChange={switchMode}>
          <DropdownMenuRadioItem
            value="player"
            className="cursor-pointer gap-2 py-2.5 text-white/80 focus:bg-blue-600/20 focus:text-white"
            style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <User className="h-4 w-4 shrink-0 text-blue-400" /> Player
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="club"
            className="cursor-pointer gap-2 py-2.5 text-white/80 focus:bg-amber-500/20 focus:text-white"
            style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <Shield className="h-4 w-4 shrink-0 text-amber-400" /> Owner
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link
            to="/profile"
            className="flex items-center gap-2 px-2 py-2.5 text-white/80"
            style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <User className="h-4 w-4 shrink-0 text-[#00E5BD]" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-2.5 text-white/80"
            style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <Settings className="h-4 w-4 shrink-0 text-[#00E5BD]" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-2 py-2.5 text-red-400 focus:bg-red-500/15 focus:text-red-300"
          style={{ ...headingFont, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
          onClick={() => stageClient.auth.logout()}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminMobileTopBar({ pathname, theme, setTheme }) {
  const adminGroups = getAdminGroups();
  const activeNav = findActiveInGroups(adminGroups, pathname);
  const headerTitle = activeNav?.item.label ?? "Admin";

  const adminTabs = [
    { path: "/admin", label: "Dash", icon: ShieldAlert },
    { path: "/admin/players", label: "Players", icon: UsersRound },
    { path: "/admin/clubs", label: "Clubs", icon: Shield },
    { path: "/admin/transfers", label: "Transfers", icon: ArrowLeftRight },
  ];

  return (
    <header
      className="mobile-liquid-topbar mobile-liquid-topbar-admin md:hidden relative z-50 shrink-0"
      style={{
        paddingTop: "calc(var(--safe-top) + 8px)",
        paddingBottom: 8,
      }}
    >
      <div className="flex items-center justify-between px-3">
        <Link to="/admin" className="flex items-center gap-2">
          <img src={LogoImg} alt="STAGE" className="h-8 w-auto object-contain" />
          <span
            className="text-[10px] uppercase truncate max-w-[9rem]"
            style={{ ...headingFont, fontWeight: 600, letterSpacing: "0.16em", color: "#f87171" }}
          >
            {headerTitle}
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          <NotificationBell />
          <Link
            to="/admin"
            aria-label="Admin home"
            title="Admin home"
            className="mobile-liquid-icon-button inline-flex items-center justify-center w-11 h-11 rounded-lg"
            style={{ color: isNavItemActive("/admin", pathname) ? TEAL : "rgba(255,255,255,0.6)" }}
          >
            <Home className="w-4 h-4" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className="mobile-liquid-icon-button inline-flex items-center justify-center w-11 h-11 rounded-lg"
            style={{ color: isNavItemActive("/settings", pathname) ? TEAL : "rgba(255,255,255,0.6)" }}
          >
            <Settings className="w-4 h-4" />
          </Link>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            aria-label="Theme"
            className="bg-transparent outline-none border border-white/10 rounded-lg px-3 h-11 min-h-[44px] text-[11px] uppercase appearance-none cursor-pointer"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#080f1c] text-white normal-case">{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 px-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1.5 min-w-max">
          {adminTabs.map((tab) => {
            const isActive = isNavItemActive(tab.path, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{
                  background: isActive ? "rgba(248,113,113,0.14)" : "rgba(255,255,255,0.04)",
                  border: isActive ? "1px solid rgba(248,113,113,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? "#f87171" : "rgba(255,255,255,0.55)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span style={{ ...headingFont, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

/* ── layout ────────────────────────────────────────────────── */
export default function Layout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { t } = useTranslation();
  const { user: authContextUser } = useAuth();
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [authUser,         setAuthUser]         = useState(null);
  const [takeoverClubName, setTakeoverClubName] = useState(null);
  const [myClubId,         setMyClubId]         = useState(null);
  const [tournamentParticipantType, setTournamentParticipantType] = useState(null);
  const [myClub,           setMyClub]           = useState(null);
  const [myPlayer,         setMyPlayer]         = useState(null);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [accountMode,      setAccountMode]      = useState(() => localStorage.getItem("stage-account-mode") || "player");
  const [theme,            setTheme]            = useState(() => localStorage.getItem("stage-theme") || "theme-dark");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClubModal,    setShowClubModal]    = useState(false);

  const switchMode = useCallback((mode) => {
    localStorage.setItem("stage-account-mode", mode);
    setAccountMode(mode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.remove(t.id));
    root.classList.add(theme);
    const dark = ["theme-dark", "theme-red", "theme-video"].includes(theme);
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("stage-theme", theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      if (!await stageClient.auth.isAuthenticated()) return;
      const u = await stageClient.auth.me();
      setAuthUser(u);
      if (isAppAdminUser(u)) setIsAdmin(true);
    })();
  }, []);

  /** Leaving takeover context: any navigation into the admin panel clears club takeover. */
  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) return;
    if (localStorage.getItem("admin_takeover_club_id")) {
      localStorage.removeItem("admin_takeover_club_id");
    }
    localStorage.setItem("stage_admin_effective_role_id", "0");
  }, [location.pathname]);

  useEffect(() => {
    const tid = localStorage.getItem("admin_takeover_club_id");
    if (tid && isAdmin && (location.pathname === `/clubs/${tid}` || location.pathname.startsWith(`/clubs/${tid}/`))) {
      localStorage.setItem("stage-account-mode", "club");
      setAccountMode("club");
    }
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    const id = localStorage.getItem("admin_takeover_club_id");
    if (!id || !isAdmin || location.pathname.startsWith("/admin")) {
      setTakeoverClubName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await stageClient.entities.Club.filter({ id }, null, 1).catch(() => []);
      if (!cancelled) setTakeoverClubName(rows[0]?.name || null);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    (async () => {
      if (!await stageClient.auth.isAuthenticated()) return;
      const { user: u, player: p, club: c } = await resolveMyPlayerAndClub();
      if (!u) return;

      // Club
      if (c?.id) {
        setMyClubId(c.id);
        setMyClub(c);
      } else {
        setMyClubId(null);
        setMyClub(null);
      }

      // Player
      if (!p) return;
      setMyPlayer(p);
      setSubscriptionTier(normalizeSubscriptionTier(p.subscription));
      // Fire-and-forget: pay any pending weekly salary on app load
      processPlayerSalary(p).catch(() => {});
      if (!p.gamertag) {
        localStorage.removeItem("profile-completed");
        setShowProfileModal(true);
      } else {
        localStorage.setItem("profile-completed", "true");
        // Keep prompting until the player actually has a club (owner OR member).
        // No permanent "skip": the popup returns on each app load until club
        // onboarding is done — and can also be resumed from the profile page.
        if (!c?.id)
          setShowClubModal(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (myPlayer && myClubId) return;
    if (myClubId && !myPlayer && accountMode !== "club") switchMode("club");
    if (myPlayer && !myClubId && accountMode !== "player") switchMode("player");
  }, [myPlayer, myClubId, accountMode, switchMode]);

  const isVideoTheme = theme === "theme-video" || theme === "theme-white";
  const isWhiteTheme = theme === "theme-white";
  const showAdminHeader = shouldShowAdminHeader(location.pathname, authUser, isAdmin);
  const adminTakeoverClubId =
    typeof window !== "undefined" ? localStorage.getItem("admin_takeover_club_id") : null;
  const showAdminTakeoverChip =
    isAdmin && adminTakeoverClubId && !showAdminHeader;
  const clubPath = myClubId ? `/clubs/${myClubId}` : null;
  const effectiveUser = authContextUser || authUser;
  const isTournamentLimited = effectiveUser?.access_mode === "tournament_limited";
  const limitedTournamentId = effectiveUser?.limited_tournament_id;

  useEffect(() => {
    if (!isTournamentLimited || !limitedTournamentId) return;
    stageClient.entities.Tournament.get(limitedTournamentId)
      .then(t => setTournamentParticipantType(t?.participant_type || "club"))
      .catch(() => setTournamentParticipantType("club"));
  }, [isTournamentLimited, limitedTournamentId]);

  const tournamentLimitedGroups = getTournamentLimitedGroups(t, limitedTournamentId, tournamentParticipantType);
  const playerGroups = getPlayerGroups(t, clubPath);
  const ownerGroups = getOwnerGroups(t, clubPath);
  const adminGroups = getAdminGroups();
  const headerNavGroups = showAdminHeader
    ? adminGroups
    : isTournamentLimited
      ? tournamentLimitedGroups
      : (accountMode === "club" ? ownerGroups : playerGroups);
  const activeHeaderNav = findActiveInGroups(headerNavGroups, location.pathname);
  const activePageLabel = activeHeaderNav?.item.label ?? null;
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    (async () => {
      const u = await stageClient.auth.me().catch(() => null);
      if (!u) return;
      const notifs = await stageClient.entities.Notification
        .filter({ recipient_email: u.email }, "-created_date", 30)
        .catch(() => []);
      setNotifCount(notifs.filter(n => !n.read).length);
    })();
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col h-screen overflow-hidden",
        isVideoTheme ? "bg-transparent" : "bg-background"
      )}
    >

      <ProfileCompletionModal
        open={showProfileModal}
        player={myPlayer}
        onComplete={(club) => {
          setShowProfileModal(false);
          if (club) {
            setMyClubId(club.id);
            setMyClub(club);
          }
        }}
      />
      <ClubOnboardingModal
        open={showClubModal && !showProfileModal}
        player={myPlayer}
        onComplete={(club) => {
          // "Skip for now" just closes it — it returns on the next app load
          // until the player has joined or created a club.
          setShowClubModal(false);
          if (club) {
            setMyClubId(club.id);
            setMyClub(club);
          }
        }}
      />

      {isVideoTheme && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <style>{`@keyframes bgPan{0%{transform:scale(1.15) translate(-4%,0%) rotate(-.5deg)}25%{transform:scale(1.18) translate(0%,-2%) rotate(0deg)}50%{transform:scale(1.15) translate(4%,1%) rotate(.5deg)}75%{transform:scale(1.18) translate(1%,-1%) rotate(0deg)}100%{transform:scale(1.15) translate(-4%,0%) rotate(-.5deg)}}`}</style>
          <div className="absolute inset-0" style={{ backgroundImage: `url(https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/fbcf1e4e7_1C12710F-CA04-4F58-908B-BCE68BB4500E.png)`, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 20s ease-in-out infinite", filter: "blur(3px)" }} />
          {isWhiteTheme ? (
            <><div className="absolute inset-0 bg-white/60" /><div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(255,255,255,.95) 0%,rgba(255,255,255,.4) 40%,rgba(255,255,255,.2) 100%)" }} /></>
          ) : (
            <><div className="absolute inset-0 bg-black/50" /><div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 40%,rgba(0,0,0,.1) 100%)" }} /></>
          )}
        </div>
      )}

      {/* ── MOBILE TOP BAR (phone only) ───────────────────────── */}
      {showAdminHeader ? (
        <AdminMobileTopBar pathname={location.pathname} theme={theme} setTheme={setTheme} />
      ) : (
        <MobileTopBar
          myPlayer={myPlayer}
          myClub={myClub}
          accountMode={accountMode}
          switchMode={switchMode}
          subscriptionTier={subscriptionTier}
          notifCount={notifCount}
          theme={theme}
          setTheme={setTheme}
          pathname={location.pathname}
          isAdmin={isAdmin}
          activePageLabel={activePageLabel}
        />
      )}

      {/* ── EAFC26 HEADER (desktop only) ──────────────────────── */}
      <header
        className="relative z-50 shrink-0 overflow-visible hidden md:block"
        style={{
          background: isWhiteTheme
            ? "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.74) 100%)"
            : "linear-gradient(180deg, #0b1024 0%, #080d1b 100%)",
          boxShadow: isWhiteTheme ? "0 4px 24px rgba(15,23,42,0.15)" : "0 4px 24px rgba(0,0,0,0.55)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 0%, #00E5BD 15%, #00E5BD 85%, transparent 100%)", opacity: isWhiteTheme ? 0.45 : 0.65 }} />
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 0%, #00E5BD 15%, #00E5BD 85%, transparent 100%)", opacity: isWhiteTheme ? 0.45 : 0.65 }} />

        <div className="flex min-h-[3.75rem] h-16 items-stretch">

          <Link to="/" className="flex shrink-0 items-center px-4 sm:px-5 self-stretch">
            <img src={LogoImg} alt="STAGE" className="h-12 w-auto object-contain sm:h-14" />
          </Link>

          <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {!showAdminHeader && (myPlayer || myClubId) && (
              <div className="flex shrink-0 items-center px-3 sm:px-4">
                <HeaderIdentityMenu
                  myPlayer={myPlayer}
                  myClub={myClub}
                  myClubId={myClubId}
                  accountMode={accountMode}
                  switchMode={switchMode}
                  subscriptionTier={subscriptionTier}
                  isWhiteTheme={isWhiteTheme}
                />
              </div>
            )}

            {!showAdminHeader && !(myPlayer && myClubId) && (myClubId || myPlayer) && (
              <div className="flex shrink-0 flex-col justify-center gap-0.5 px-3 sm:px-4">
                {myClubId && !myPlayer && (
                  <>
                    <span style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fbbf24" }}>Owner</span>
                    <Link to="/profile" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Player profile</Link>
                  </>
                )}
                {myPlayer && !myClubId && (
                  <>
                    <span style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa" }}>Player</span>
                    <Link to="/clubs" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Create club</Link>
                  </>
                )}
              </div>
            )}

            {showAdminHeader ? (
              <>
                <div className="hidden sm:flex shrink-0 items-center px-3">
                  <span style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171" }}>
                    Stage Control Panel
                  </span>
                </div>
                <SidebarNavSectionDropdowns
                  variant="header"
                  groups={adminGroups}
                  pathname={location.pathname}
                  isWhiteTheme={isWhiteTheme}
                />
              </>
            ) : (
              <SidebarNavSectionDropdowns
                variant="header"
                groups={headerNavGroups}
                pathname={location.pathname}
                isWhiteTheme={isWhiteTheme}
              />
            )}

            <div className="hidden sm:flex shrink-0 items-center px-3 self-stretch">
              <span style={{ ...headingFont, fontWeight: 500, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.35)" : "rgba(0,229,189,0.22)" }}>
                STAGE v2.0
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 px-2 sm:px-3">
            <Link
              to={showAdminHeader ? "/admin" : "/search"}
              className="rounded p-2 transition-all"
              style={{ color: (showAdminHeader ? location.pathname === "/admin" : location.pathname === "/search") ? TEAL : (isWhiteTheme ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.35)"), background: (showAdminHeader ? location.pathname === "/admin" : location.pathname === "/search") ? "rgba(0,229,189,0.1)" : "transparent" }}
            >
              {showAdminHeader ? <Home className="h-[1.125rem] w-[1.125rem]" /> : <Search className="h-[1.125rem] w-[1.125rem]" />}
            </Link>
            <NotificationBell />
            {showAdminTakeoverChip && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("admin_takeover_club_id");
                  localStorage.setItem("stage_admin_effective_role_id", "0");
                  navigate("/admin");
                }}
                className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 transition-colors hover:bg-amber-500/15 ml-0.5"
                style={{
                  ...headingFont,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#fbbf24",
                  border: "1px solid rgba(245,158,11,0.45)",
                  background: "rgba(245,158,11,0.08)",
                }}
                title={
                  takeoverClubName
                    ? `Admin · viewing ${takeoverClubName} — click to return to Admin`
                    : "Admin takeover active — click to return to Admin panel"
                }
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <Link
              to="/settings"
              className="rounded p-2 transition-all"
              style={{ color: location.pathname === "/settings" ? TEAL : (isWhiteTheme ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.35)"), background: location.pathname === "/settings" ? "rgba(0,229,189,0.1)" : "transparent" }}
            >
              <Settings className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-1 px-2 py-1 ml-1" style={{ background: isWhiteTheme ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(0,229,189,0.12)", borderRadius: 2 }}>
              <Palette className="h-3.5 w-3.5 shrink-0" style={{ color: isWhiteTheme ? "rgba(15,23,42,0.55)" : "rgba(0,229,189,0.5)" }} />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="cursor-pointer bg-transparent outline-none max-w-[5rem] sm:max-w-none"
                style={{ ...headingFont, fontWeight: 600, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.55)" }}
              >
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#080f1c] text-white normal-case">{t.label}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-red-500/10 ml-0.5"
                style={{ ...headingFont, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f87171", borderRadius: 2 }}
                title="Admin"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </div>
        </div>

      </header>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className={cn("relative flex flex-1 overflow-hidden", isVideoTheme && "z-[1]")}>
        <main
          className={cn(
            "relative z-[1] flex-1 overflow-y-auto",
            isVideoTheme ? "bg-transparent" : "bg-background"
          )}
        >
          {/* pb: mobile accounts for bottom tab + home indicator; desktop uses pb-8 */}
          <div className="min-h-full pb-[calc(var(--mobile-tab-h)+var(--safe-bottom)+1rem)] md:pb-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <MobileWalkthrough pathname={location.pathname} />

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────── */}
      {showAdminHeader ? (
        <AdminMobileBottomBar pathname={location.pathname} />
      ) : (
        <MobileBottomBar
          pathname={location.pathname}
          myPlayer={myPlayer}
          myClub={myClub}
          accountMode={accountMode}
          notifCount={notifCount}
          isTournamentLimited={isTournamentLimited}
          tournamentId={effectiveUser?.limited_tournament_id}
          participantType={tournamentParticipantType}
        />
      )}
    </div>
  );
}
