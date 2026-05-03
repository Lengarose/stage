import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home, Shield, Trophy, BarChart3, User, ArrowLeftRight,
  Search, Rss, ShoppingBag, Video, UsersRound,
  Palette, ChevronDown, Newspaper, ShieldAlert, Settings,
  Inbox, CalendarDays, Zap, Coins, Heart, Sun, Moon, LogOut,
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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

function getPlayerGroups(clubPath) {
  const homeItems = [
    { path: "/",         icon: Home,         label: "Home" },
    { path: "/profile",  icon: User,         label: "My Profile" },
    { path: "/inbox",    icon: Inbox,        label: "Inbox" },
    { path: "/schedule", icon: CalendarDays, label: "Schedule" },
  ];
  return [
    { label: "Home", items: homeItems },
    {
      label: "Compete",
      items: [
        { path: "/game-day",    icon: Zap,       label: "Game Day" },
        { path: "/tournaments", icon: Trophy,    label: "Tournaments" },
        { path: "/rankings",    icon: BarChart3, label: "Rankings" },
      ],
    },
    {
      label: "Community",
      items: [
        { path: "/clubs",        icon: Shield,     label: "Clubs" },
        { path: "/players-list", icon: UsersRound, label: "Players" },
        { path: "/social",       icon: Rss,        label: "Feed" },
        { path: "/follow-back",  icon: Heart,      label: "Follow Back" },
      ],
    },
    {
      label: "Market",
      items: [
        { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers" },
        { path: "/lifestyle",       icon: Coins,          label: "Lifestyle" },
      ],
    },
    {
      label: "Discover",
      items: [
        { path: "/news",  icon: Newspaper,   label: "News" },
        { path: "/store", icon: ShoppingBag, label: "Store" },
      ],
    },
  ];
}

function getOwnerGroups(clubPath) {
  const homeItems = [
    { path: "/",         icon: Home,         label: "Home" },
    { path: "/inbox",    icon: Inbox,        label: "Inbox" },
    { path: "/schedule", icon: CalendarDays, label: "Schedule" },
  ];
  if (clubPath) homeItems.push({ path: clubPath, icon: Shield, label: "My Club" });
  return [
    { label: "Home", items: homeItems },
    {
      label: "Squad",
      items: [
        { path: "/players-list",    icon: UsersRound,     label: "Players" },
        { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers" },
        { path: "/game-day",        icon: Zap,            label: "Game Day" },
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
        { path: "/news",  icon: Newspaper,   label: "News" },
        { path: "/store", icon: ShoppingBag, label: "Store" },
      ],
    },
  ];
}

/* ── EAFC26 design tokens ─────────────────────────────────── */
const TEAL = "#00E5BD";
const headingFont = { fontFamily: "var(--font-heading), 'Barlow Condensed', sans-serif", fontStyle: "italic" };

const EAFC_DD = {
  background: "linear-gradient(160deg, #0c1426 0%, #080f1d 100%)",
  border: "1px solid rgba(0,229,189,0.14)",
  borderTop: "2px solid #00E5BD",
  borderRadius: "0 0 3px 3px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,189,0.05)",
};

function EafcNavLink({ to, onClick, isActive, icon: Icon, children }) {
  return (
    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2.5 px-3 py-2.5 outline-none transition-colors",
          isActive ? "text-[#00E5BD]" : "text-white/55 hover:text-white"
        )}
        style={{
          ...headingFont,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: isActive ? "rgba(0,229,189,0.08)" : "transparent",
        }}
      >
        {isActive && <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: TEAL }} />}
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#00E5BD]" : "text-white/30")} />
        {children}
      </Link>
    </DropdownMenuItem>
  );
}

function SidebarNavSectionDropdowns({ groups, pathname, onItemClick, variant = "sidebar" }) {
  const isHeader = variant === "header";

  if (!isHeader) {
    const anyActive = groups.some((g) => g.items.some((i) => pathname === i.path));
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
              style={{ ...headingFont, fontWeight: 700 }}
            >
              <span>Navigate</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-45" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className="z-[70] max-h-[min(70vh,28rem)] min-w-[12rem] overflow-y-auto p-1 text-white shadow-xl" style={EAFC_DD}>
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />}
                <DropdownMenuLabel className="px-3 py-1 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 700, color: "rgba(0,229,189,0.5)" }}>
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((item) => (
                  <EafcNavLink key={item.path} to={item.path} onClick={onItemClick} isActive={pathname === item.path} icon={item.icon}>
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
        const anyActive = group.items.some((i) => pathname === i.path);
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
                  className={cn("select-none text-[12px] sm:text-[14px] uppercase", anyActive ? "text-[#00E5BD]" : "text-white/40")}
                  style={{ ...headingFont, fontWeight: 900, letterSpacing: "0.14em", transition: "color 0.12s" }}
                >
                  {group.label}
                </span>
                <ChevronDown className={cn("shrink-0 h-3 w-3", anyActive ? "text-[#00E5BD]" : "text-white/25")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={0} className="z-[70] min-w-[12.5rem] p-1 text-white shadow-2xl" style={EAFC_DD}>
              {group.items.map((item) => (
                <EafcNavLink key={item.path} to={item.path} onClick={onItemClick} isActive={pathname === item.path} icon={item.icon}>
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

  const subLabelStyle = { ...headingFont, fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: TEAL };

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
            <p className="truncate text-white" style={{ ...headingFont, fontWeight: 900, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
                  <span style={subLabelStyle}>{myPlayer ? subscriptionTier : "Club"}</span>
                </>
              )}
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="z-[80] w-52 p-1 text-white" style={EAFC_DD}>
        {canSwitchRole && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 700, color: "rgba(0,229,189,0.5)" }}>
              Account
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={accountMode} onValueChange={switchMode}>
              <DropdownMenuRadioItem
                value="player"
                className="cursor-pointer gap-2 py-2.5 text-white/80 focus:bg-blue-600/20 focus:text-white"
                style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <User className="h-4 w-4 shrink-0 text-blue-400" /> Player
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="club"
                className="cursor-pointer gap-2 py-2.5 text-white/80 focus:bg-amber-500/20 focus:text-white"
                style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-400" /> Owner
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
          </>
        )}
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-2.5 text-white/80"
            style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <Settings className="h-4 w-4 shrink-0 text-[#00E5BD]" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-2 py-2.5 text-red-400 focus:bg-red-500/15 focus:text-red-300"
          style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── layout ────────────────────────────────────────────────── */
export default function Layout() {
  const location  = useLocation();
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [myClubId,         setMyClubId]         = useState(null);
  const [myClub,           setMyClub]           = useState(null);
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
      const c = clubs?.[0];
      if (c?.id) {
        setMyClubId(c.id);
        setMyClub(c);
      } else {
        setMyClubId(null);
        setMyClub(null);
      }
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

  useEffect(() => {
    if (myPlayer && myClubId) return;
    if (myClubId && !myPlayer && accountMode !== "club") switchMode("club");
    if (myPlayer && !myClubId && accountMode !== "player") switchMode("player");
  }, [myPlayer, myClubId, accountMode, switchMode]);

  const isVideoTheme = theme === "theme-video" || theme === "theme-white";
  const isWhiteTheme = theme === "theme-white";
  const clubPath = myClubId ? `/clubs/${myClubId}` : null;
  const playerGroups = getPlayerGroups(clubPath);
  const ownerGroups = getOwnerGroups(clubPath);

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
          sessionStorage.setItem("club-onboarding-dismissed", "true");
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

      {/* ── EAFC26 HEADER ─────────────────────────────────────── */}
      <header
        className="relative z-50 shrink-0 overflow-visible"
        style={{
          background: "linear-gradient(180deg, #0b1024 0%, #080d1b 100%)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 0%, #00E5BD 15%, #00E5BD 85%, transparent 100%)", opacity: 0.65 }} />

        <div className="flex min-h-[3.75rem] h-16 items-stretch">

          <Link to="/" className="flex shrink-0 items-center px-4 sm:px-5 self-stretch">
            <img src={LogoImg} alt="STAGE" className="h-11 w-auto object-contain sm:h-12" />
          </Link>

          <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {(myPlayer || myClubId) && (
              <div className="flex shrink-0 items-center px-3 sm:px-4">
                <HeaderIdentityMenu
                  myPlayer={myPlayer}
                  myClub={myClub}
                  myClubId={myClubId}
                  accountMode={accountMode}
                  switchMode={switchMode}
                  subscriptionTier={subscriptionTier}
                />
              </div>
            )}

            {!(myPlayer && myClubId) && (myClubId || myPlayer) && (
              <div className="flex shrink-0 flex-col justify-center gap-0.5 px-3 sm:px-4">
                {myClubId && !myPlayer && (
                  <>
                    <span style={{ ...headingFont, fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fbbf24" }}>Owner</span>
                    <Link to="/profile" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Player profile</Link>
                  </>
                )}
                {myPlayer && !myClubId && (
                  <>
                    <span style={{ ...headingFont, fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa" }}>Player</span>
                    <Link to="/clubs" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Create club</Link>
                  </>
                )}
              </div>
            )}

            <SidebarNavSectionDropdowns
              variant="header"
              groups={accountMode === "club" ? ownerGroups : playerGroups}
              pathname={location.pathname}
            />

            <div className="hidden sm:flex shrink-0 items-center px-3 self-stretch">
              <span style={{ ...headingFont, fontWeight: 700, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(0,229,189,0.22)" }}>
                STAGE v2.0
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 px-2 sm:px-3">
            <Link
              to="/search"
              className="rounded p-2 transition-all"
              style={{ color: location.pathname === "/search" ? TEAL : "rgba(255,255,255,0.35)", background: location.pathname === "/search" ? "rgba(0,229,189,0.1)" : "transparent" }}
            >
              <Search className="h-[1.125rem] w-[1.125rem]" />
            </Link>
            <NotificationBell />
            <Link
              to="/settings"
              className="rounded p-2 transition-all"
              style={{ color: location.pathname === "/settings" ? TEAL : "rgba(255,255,255,0.35)", background: location.pathname === "/settings" ? "rgba(0,229,189,0.1)" : "transparent" }}
            >
              <Settings className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-1 px-2 py-1 ml-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,229,189,0.12)", borderRadius: 2 }}>
              <Palette className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(0,229,189,0.5)" }} />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="cursor-pointer bg-transparent outline-none max-w-[5rem] sm:max-w-none"
                style={{ ...headingFont, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}
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
                style={{ ...headingFont, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f87171", borderRadius: 2 }}
                title="Admin"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </div>
        </div>

        {/* Gradient fade into content */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 translate-y-full h-10 z-50"
          style={{ background: "linear-gradient(to bottom, #080d1b, transparent)" }}
        />
      </header>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className={cn("relative flex flex-1 overflow-hidden", isVideoTheme && "z-[1]")}>
        <main
          className={cn(
            "relative z-[1] flex-1 overflow-y-auto",
            isVideoTheme ? "bg-transparent" : "bg-background"
          )}
        >
          <div className="min-h-full pb-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
