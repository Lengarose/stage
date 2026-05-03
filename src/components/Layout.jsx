import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home, Shield, Trophy, BarChart3, User, ArrowLeftRight,
  Search, Rss, ShoppingBag, Video, UsersRound,
  Palette, ChevronDown, Newspaper, ShieldAlert, Settings,
  Inbox, CalendarDays, Zap, Coins, Heart, Sun, Moon,
} from "lucide-react";
import LogoImg from '@/assets/Logo.PNG';
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import ProfileCompletionModal from "./ProfileCompletionModal";
import ClubOnboardingModal from "./ClubOnboardingModal";
import NotificationBell from "./NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ── constants ─────────────────────────────────────────────── */
const BADGE_IMAGES = {
  rookie: "https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/e3c8b3841_generated_image.png",
  pro:    "https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/613a73d38_generated_image.png",
  elite:  "https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/e95c37867_generated_image.png",
};

const THEMES = [
  { id: "theme-dark",   label: "Dark",       icon: Moon },
  { id: "theme-light",  label: "Day",        icon: Sun  },
  { id: "theme-video",  label: "Live Dark",  icon: Video },
  { id: "theme-white",  label: "Live White", icon: Sun  },
  { id: "theme-custom", label: "Custom",     icon: Palette },
];

/* Player nav — grouped */
const PLAYER_GROUPS = [
  {
    label: "Overview",
    items: [
      { path: "/",        icon: Home,         label: "Home" },
      { path: "/profile", icon: User,         label: "My Profile" },
      { path: "/inbox",   icon: Inbox,        label: "Inbox" },
      { path: "/schedule",icon: CalendarDays, label: "Schedule" },
    ],
  },
  {
    label: "Compete",
    items: [
      { path: "/game-day",    icon: Zap,      label: "Game Day" },
      { path: "/tournaments", icon: Trophy,   label: "Tournaments" },
      { path: "/rankings",    icon: BarChart3,label: "Rankings" },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/clubs",        icon: Shield,      label: "Clubs" },
      { path: "/players-list", icon: UsersRound,  label: "Players" },
      { path: "/social",       icon: Rss,         label: "Feed" },
      { path: "/follow-back",  icon: Heart,       label: "Follow Back" },
    ],
  },
  {
    label: "Market",
    items: [
      { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers" },
      { path: "/lifestyle",       icon: Coins,          label: "Lifestyle" },
      { path: "/store",           icon: ShoppingBag,    label: "Store" },
    ],
  },
  {
    label: "Info",
    items: [
      { path: "/news", icon: Newspaper, label: "News" },
    ],
  },
];

/* Owner nav — grouped */
const OWNER_GROUPS = [
  {
    label: "Overview",
    items: [
      { path: "/",         icon: Home,         label: "Home" },
      { path: "/inbox",    icon: Inbox,        label: "Inbox" },
      { path: "/schedule", icon: CalendarDays, label: "Schedule" },
    ],
  },
  {
    label: "Squad",
    items: [
      { path: "/players-list",    icon: UsersRound,    label: "Players" },
      { path: "/transfer-market", icon: ArrowLeftRight,label: "Transfers" },
      { path: "/game-day",        icon: Zap,           label: "Game Day" },
    ],
  },
  {
    label: "Competitions",
    items: [
      { path: "/tournaments", icon: Trophy,    label: "Tournaments" },
      { path: "/rankings",    icon: BarChart3, label: "Rankings" },
    ],
  },
  {
    label: "Discover",
    items: [
      { path: "/news",  icon: Newspaper,  label: "News" },
      { path: "/store", icon: ShoppingBag,label: "Store" },
    ],
  },
];

/* ── nav sections as dropdowns (stacked in drawer, horizontal in header) ─ */
function SidebarNavSectionDropdowns({ groups, pathname, onItemClick, variant = "sidebar" }) {
  const isHeader = variant === "header";
  return (
    <nav
      className={cn(
        isHeader
          ? "flex flex-row items-center gap-1 sm:gap-1.5 shrink-0"
          : "flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
      )}
    >
      {groups.map((group) => {
        const anyActive = group.items.some((i) => pathname === i.path);
        return (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-between gap-1.5 rounded-lg border text-left transition-all",
                  isHeader
                    ? "shrink-0 px-2 py-1.5 sm:px-2.5 sm:py-2"
                    : "w-full px-3 py-2.5",
                  anyActive
                    ? "border-blue-500/25 bg-blue-600/14 text-white"
                    : "border-white/6 bg-white/[0.02] text-white/40 hover:border-white/10 hover:bg-white/[0.06] hover:text-white/80"
                )}
              >
                <span className={cn("uppercase font-semibold tracking-[0.18em]", isHeader ? "text-[8px] sm:text-[9px]" : "text-[9px] tracking-[0.22em]")}>
                  {group.label}
                </span>
                <ChevronDown className={cn("shrink-0 opacity-45", isHeader ? "h-3 w-3" : "h-3.5 w-3.5")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isHeader ? "bottom" : "right"}
              align="start"
              sideOffset={isHeader ? 6 : 8}
              className="min-w-[10.5rem] max-w-[min(calc(100vw-2rem),17rem)] bg-[#0a1224] border border-white/10 p-1 text-white z-[70] shadow-xl"
            >
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.path} asChild className="p-0 focus:bg-transparent">
                    <Link
                      to={item.path}
                      onClick={onItemClick}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-xs uppercase tracking-widest font-semibold outline-none",
                        isActive ? "bg-blue-600/18 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-blue-500" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-400" : "text-white/45")} />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

/* Profile switcher + identity */
function SidebarProfileRoleBlock({ myPlayer, myClubId, accountMode, switchMode, subscriptionTier, variant = "sidebar" }) {
  if (!myPlayer && !myClubId) return null;

  const isHeader = variant === "header";

  const inner = (
    <div className={cn("flex gap-2.5", isHeader ? "flex-row flex-wrap items-center" : "flex-col")}>
        {myPlayer && myClubId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.06] font-bold uppercase tracking-widest text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50",
                  isHeader ? "px-2 py-1.5 text-[9px] sm:px-2.5 sm:py-2 sm:text-[10px]" : "w-full px-3 py-2.5 text-[10px]",
                  accountMode === "player" ? "ring-1 ring-blue-500/40" : "ring-1 ring-amber-500/30"
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  {accountMode === "player" ? (
                    <><User className="h-3.5 w-3.5 shrink-0 text-blue-400 sm:h-4 sm:w-4" /><span className="truncate">Player</span></>
                  ) : (
                    <><Shield className="h-3.5 w-3.5 shrink-0 text-amber-400 sm:h-4 sm:w-4" /><span className="truncate">Owner</span></>
                  )}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 text-white/40 sm:h-3.5 sm:w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side={isHeader ? "bottom" : "bottom"} sideOffset={4} className="z-[80] w-44 border border-white/10 bg-[#0a1224] p-1 text-white">
              <DropdownMenuRadioGroup value={accountMode} onValueChange={(v) => switchMode(v)}>
                <DropdownMenuRadioItem
                  value="player"
                  className="gap-2 text-xs uppercase tracking-widest font-bold text-white/80 focus:bg-blue-600/25 focus:text-white cursor-pointer py-2.5"
                >
                  <User className="w-4 h-4 text-blue-400" /> Player
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="club"
                  className="gap-2 text-xs uppercase tracking-widest font-bold text-white/80 focus:bg-amber-500/20 focus:text-white cursor-pointer py-2.5"
                >
                  <Shield className="w-4 h-4 text-amber-400" /> Owner
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : myPlayer ? (
          <div className={cn("flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] font-bold uppercase tracking-widest text-white/55", isHeader ? "px-2 py-1.5 text-[9px]" : "w-full px-3 py-2.5 text-[10px]")}>
            <User className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            Player
          </div>
        ) : (
          <div className={cn("flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] font-bold uppercase tracking-widest text-white/55", isHeader ? "px-2 py-1.5 text-[9px]" : "w-full px-3 py-2.5 text-[10px]")}>
            <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
            Owner
          </div>
        )}

        {myPlayer && (
          <div className={cn("flex min-w-0 items-center gap-2", isHeader ? "max-w-[140px] sm:max-w-[200px]" : "gap-2.5")}>
            <div
              className={cn("shrink-0 rounded-full border border-white/20 bg-white/10", isHeader ? "h-7 w-7 sm:h-8 sm:w-8" : "h-9 w-9")}
              style={myPlayer.avatar_url ? {
                backgroundImage: `url(${myPlayer.avatar_url})`,
                backgroundSize: `${myPlayer.avatar_zoom || 150}%`,
                backgroundPosition: myPlayer.avatar_position || "50% 50%",
                backgroundRepeat: "no-repeat",
              } : {}}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-bold uppercase tracking-widest text-white/80", isHeader ? "text-[10px] sm:text-xs" : "text-xs")}>{myPlayer.gamertag}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {BADGE_IMAGES[subscriptionTier] && (
                  <img src={BADGE_IMAGES[subscriptionTier]} alt={subscriptionTier} className="h-3.5 w-3.5 rounded-full border border-white/20 object-cover sm:h-4 sm:w-4" />
                )}
                <span className="text-[8px] uppercase tracking-wider text-white/35 sm:text-[9px]">{subscriptionTier}</span>
              </div>
            </div>
          </div>
        )}
    </div>
  );

  if (isHeader) return <div className="shrink-0">{inner}</div>;
  return <div className="shrink-0 border-b border-white/8 px-3 pb-3 pt-4">{inner}</div>;
}

/* ── layout ────────────────────────────────────────────────── */
export default function Layout() {
  const location  = useLocation();
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [myClubId,         setMyClubId]         = useState(null);
  const [myPlayer,         setMyPlayer]         = useState(null);
  const [subscriptionTier, setSubscriptionTier] = useState("rookie");
  const [accountMode,      setAccountMode]      = useState(() => localStorage.getItem("stage-account-mode") || "player");
  const [theme,            setTheme]            = useState(() => localStorage.getItem("stage-theme") || "theme-dark");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClubModal,    setShowClubModal]    = useState(false);

  const switchMode = useCallback((mode) => {
    localStorage.setItem("stage-account-mode", mode);
    setAccountMode(mode);
  }, []);

  /* theme sync */
  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.remove(t.id));
    root.classList.add(theme);
    const dark = ["theme-dark", "theme-red", "theme-video"].includes(theme);
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("stage-theme", theme);
  }, [theme]);

  /* user / club / player */
  useEffect(() => {
    (async () => {
      if (!await base44.auth.isAuthenticated()) return;
      const u = await base44.auth.me();
      if (u?.role === "admin") setIsAdmin(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!await base44.auth.isAuthenticated()) return;
      const u = await base44.auth.me();
      if (!u) return;
      const clubs = await base44.entities.Club.filter({ owner_email: u.email });
      if (clubs?.[0]?.id) setMyClubId(clubs[0].id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      if (!u) return;
      const players = await base44.entities.Player.filter({ email: u.email });
      const p = players?.[0];
      if (!p) return;
      setMyPlayer(p);
      setSubscriptionTier((p.subscription || "rookie").toLowerCase());
      if (!p.gamertag) {
        localStorage.removeItem("profile-completed");
        setShowProfileModal(true);
      } else {
        localStorage.setItem("profile-completed", "true");
        if (!p.club_id && !sessionStorage.getItem("club-onboarding-dismissed"))
          setShowClubModal(true);
      }
    })();
  }, []);

  /* Keep stored mode valid when only one profile exists */
  useEffect(() => {
    if (myPlayer && myClubId) return;
    if (myClubId && !myPlayer && accountMode !== "club") switchMode("club");
    if (myPlayer && !myClubId && accountMode !== "player") switchMode("player");
  }, [myPlayer, myClubId, accountMode, switchMode]);

  const isVideoTheme = theme === "theme-video" || theme === "theme-white";
  const isWhiteTheme = theme === "theme-white";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#06091a]">

      {/* modals */}
      <ProfileCompletionModal
        open={showProfileModal}
        player={myPlayer}
        onComplete={(club) => { setShowProfileModal(false); if (club) setMyClubId(club.id); }}
      />
      <ClubOnboardingModal
        open={showClubModal && !showProfileModal}
        player={myPlayer}
        onComplete={(club) => {
          sessionStorage.setItem("club-onboarding-dismissed", "true");
          setShowClubModal(false);
          if (club) setMyClubId(club.id);
        }}
      />

      {/* video bg */}
      {isVideoTheme && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <style>{`@keyframes bgPan{0%{transform:scale(1.15) translate(-4%,0%) rotate(-.5deg)}25%{transform:scale(1.18) translate(0%,-2%) rotate(0deg)}50%{transform:scale(1.15) translate(4%,1%) rotate(.5deg)}75%{transform:scale(1.18) translate(1%,-1%) rotate(0deg)}100%{transform:scale(1.15) translate(-4%,0%) rotate(-.5deg)}}`}</style>
          <div className="absolute inset-0" style={{ backgroundImage:`url(https://media.base44.com/images/public/69c51f9745b037f35a61ba4a/fbcf1e4e7_1C12710F-CA04-4F58-908B-BCE68BB4500E.png)`, backgroundSize:"cover", backgroundPosition:"center", animation:"bgPan 20s ease-in-out infinite", filter:"blur(3px)" }} />
          {isWhiteTheme ? (
            <><div className="absolute inset-0 bg-white/60"/><div className="absolute inset-0" style={{background:"linear-gradient(to top,rgba(255,255,255,.95) 0%,rgba(255,255,255,.4) 40%,rgba(255,255,255,.2) 100%)"}}/></>
          ) : (
            <><div className="absolute inset-0 bg-black/50"/><div className="absolute inset-0" style={{background:"linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 40%,rgba(0,0,0,.1) 100%)"}}/></>
          )}
        </div>
      )}

      {/* ── HEADER (logo + former sidebar: profile, onboarding, nav, version) ─ */}
      <header className="relative z-50 shrink-0 border-b border-white/8 bg-[#06091a]/95 backdrop-blur-md">
        <div className="flex min-h-14 items-stretch gap-2 px-2 py-1.5 sm:gap-3 sm:px-3 md:px-5">
          <Link to="/" className="flex shrink-0 items-center self-center">
            <img src={LogoImg} alt="STAGE" className="h-14 w-auto object-contain sm:h-[4.25rem]" />
          </Link>

          <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(myPlayer || myClubId) && (
              <SidebarProfileRoleBlock
                variant="header"
                myPlayer={myPlayer}
                myClubId={myClubId}
                accountMode={accountMode}
                switchMode={switchMode}
                subscriptionTier={subscriptionTier}
              />
            )}

            {!(myPlayer && myClubId) && (myClubId || myPlayer) && (
              <div className="flex shrink-0 flex-col gap-0.5 border-l border-white/10 pl-2 sm:pl-3">
                {myClubId && !myPlayer && (
                  <>
                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-amber-400 sm:text-[9px]">
                      <span className="h-1 w-1 rounded-full bg-amber-400" /> Owner
                    </span>
                    <Link to="/profile" className="whitespace-nowrap text-[8px] uppercase tracking-widest text-white/40 hover:text-white/70 sm:text-[9px]">
                      + Player profile
                    </Link>
                  </>
                )}
                {myPlayer && !myClubId && (
                  <>
                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-blue-400 sm:text-[9px]">
                      <span className="h-1 w-1 rounded-full bg-blue-400" /> Player
                    </span>
                    <Link to="/clubs" className="whitespace-nowrap text-[8px] uppercase tracking-widest text-white/40 hover:text-white/70 sm:text-[9px]">
                      + Create club
                    </Link>
                  </>
                )}
              </div>
            )}

            {accountMode === "club" && myClubId && (
              <Link
                to={`/clubs/${myClubId}`}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest transition-colors sm:gap-2 sm:px-2.5 sm:py-2 sm:text-[10px]",
                  location.pathname === `/clubs/${myClubId}`
                    ? "border-amber-500/35 bg-amber-500/15 text-white"
                    : "border-white/10 text-white/50 hover:border-white/15 hover:bg-white/[0.06] hover:text-white/85"
                )}
              >
                <Shield className={cn("h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4", location.pathname === `/clubs/${myClubId}` ? "text-amber-400" : "")} />
                My Club
              </Link>
            )}

            <SidebarNavSectionDropdowns
              variant="header"
              groups={accountMode === "club" ? OWNER_GROUPS : PLAYER_GROUPS}
              pathname={location.pathname}
            />

            <span className="hidden shrink-0 self-center text-[8px] uppercase tracking-[0.2em] text-white/20 sm:inline md:text-[9px]">
              STAGE v2.0
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 self-center border-l border-white/10 pl-1.5 sm:gap-1 sm:pl-2 md:pl-3">
            <Link to="/search" className={cn("rounded-lg p-2 transition-colors text-white/40 hover:bg-white/5 hover:text-white", location.pathname === "/search" && "bg-white/8 text-white")}>
              <Search className="h-4 w-4" />
            </Link>
            <NotificationBell />
            <Link to="/settings" className={cn("rounded-lg p-2 transition-colors text-white/40 hover:bg-white/5 hover:text-white", location.pathname === "/settings" && "bg-white/8 text-white")}>
              <Settings className="h-4 w-4" />
            </Link>
            <div className="ml-0.5 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 sm:px-2 sm:py-1.5">
              <Palette className="h-3 w-3 shrink-0 text-white/35 sm:h-3.5 sm:w-3.5" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="max-w-[4.5rem] cursor-pointer bg-transparent text-[9px] uppercase tracking-wider text-white/60 outline-none sm:max-w-none sm:text-[10px] md:text-[11px]"
              >
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#06091a] text-white normal-case">{t.label}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[9px] uppercase tracking-widest text-red-400 hover:bg-red-500/10 sm:px-2 md:text-[11px]" title="Admin">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div className={cn("flex flex-1 overflow-hidden relative", isVideoTheme && "bg-transparent")}>

        {/* ── MAIN CONTENT ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-[#06091a]">
          <div className="min-h-full pb-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
