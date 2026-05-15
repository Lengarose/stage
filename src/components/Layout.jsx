import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Shield, Trophy, BarChart3, User, ArrowLeftRight,
  Search, Rss, ShoppingBag, Video, UsersRound, Handshake,
  Palette, ChevronDown, Newspaper, ShieldAlert, Settings,
  Inbox, CalendarDays, Zap, Coins, Heart, Sun, Moon, LogOut, Star, Bell,
  AlertTriangle, Flag, MessagesSquare,
} from "lucide-react";
import LogoImg from '@/assets/Stadium Logo.png';
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { stageClient } from "@/api/stageClient";
import { isAppAdminUser, shouldShowAdminHeader } from "@/lib/adminAuth";
import { processPlayerSalary } from "@/lib/salaryProcessor";
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

function getPlayerGroups(_clubPath) {
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
        { path: "/game-day",        icon: Zap,       label: "Game Day" },
        { path: "/competitions",    icon: Star,      label: "Competitions" },
        { path: "/tournaments",     icon: Trophy,    label: "Tournaments" },
        { path: "/register-league", icon: Shield,    label: "Register" },
        { path: "/rankings",        icon: BarChart3, label: "Rankings" },
      ],
    },
    {
      label: "Community",
      items: [
        { path: "/clubs",        icon: Shield,     label: "Clubs" },
        { path: "/players-list", icon: UsersRound, label: "Players" },
        { path: "/recruitment",  icon: Handshake,  label: "Recruitment" },
        { path: "/social",       icon: Rss,        label: "Feed" },
        { path: "/community",    icon: MessagesSquare, label: "Discord" },
        { path: "/follow-back",  icon: Heart,      label: "Follow Back" },
      ],
    },
    {
      label: "Market",
      items: [
        { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers" },
        { path: "/lifestyle",       icon: Coins,          label: "Lifestyle" },
        { path: "/wallet",          icon: Zap,            label: "Wallet" },
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
        { path: "/recruitment",     icon: Handshake,      label: "Recruitment" },
        { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers" },
        { path: "/game-day",        icon: Zap,            label: "Game Day" },
      ],
    },
    {
      label: "Competitions",
      items: [
        { path: "/competitions",    icon: Star,      label: "Competitions" },
        { path: "/tournaments",     icon: Trophy,    label: "Tournaments" },
        { path: "/register-league", icon: Shield,    label: "Register" },
        { path: "/rankings",        icon: BarChart3, label: "Rankings" },
      ],
    },
    {
      label: "Discover",
      items: [
        { path: "/news",  icon: Newspaper,   label: "News" },
        { path: "/community", icon: MessagesSquare, label: "Discord" },
        { path: "/store", icon: ShoppingBag, label: "Store" },
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
        { path: "/admin/leagues", icon: Trophy, label: "Leagues" },
        { path: "/admin/tournaments", icon: Trophy, label: "Tournaments" },
        { path: "/admin/recruitment", icon: Handshake, label: "Recruitment" },
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

/* ── EAFC26 design tokens ─────────────────────────────────── */
const TEAL = "#00E5BD";
const headingFont = { fontFamily: "var(--font-heading), 'Barlow Condensed', sans-serif", fontStyle: "italic" };

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
          fontWeight: 700,
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
              style={{ ...headingFont, fontWeight: 700 }}
            >
              <span>{triggerLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-45" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className={cn("z-[70] max-h-[min(70vh,28rem)] min-w-[12rem] overflow-y-auto p-1 shadow-xl", isWhiteTheme ? "text-slate-900" : "text-white")} style={getEafcDropdownStyle(isWhiteTheme)}>
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <DropdownMenuSeparator className="my-0.5" style={{ background: "rgba(0,229,189,0.1)" }} />}
                <DropdownMenuLabel className="px-3 py-1 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 700, color: "rgba(0,229,189,0.5)" }}>
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
                  style={{ ...headingFont, fontWeight: 900, letterSpacing: "0.14em", transition: "color 0.12s" }}
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
            <p className={cn("truncate", isWhiteTheme ? "text-slate-900" : "text-white")} style={{ ...headingFont, fontWeight: 900, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0", isWhiteTheme ? "text-slate-900/55" : "text-white/40")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn("z-[80] w-52 p-1", isWhiteTheme ? "text-slate-900" : "text-white")} style={getEafcDropdownStyle(isWhiteTheme)}>
        {canSwitchRole && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] uppercase tracking-[0.22em]" style={{ ...headingFont, fontWeight: 700, color: "rgba(0,229,189,0.5)" }}>
              Account
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={accountMode} onValueChange={switchMode}>
              <DropdownMenuRadioItem
                value="player"
                className={cn("cursor-pointer gap-2 py-2.5 focus:bg-blue-600/20", isWhiteTheme ? "text-slate-900/80 focus:text-slate-900" : "text-white/80 focus:text-white")}
                style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <User className="h-4 w-4 shrink-0 text-blue-400" /> Player
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="club"
                className={cn("cursor-pointer gap-2 py-2.5 focus:bg-amber-500/20", isWhiteTheme ? "text-slate-900/80 focus:text-slate-900" : "text-white/80 focus:text-white")}
                style={{ ...headingFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
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
const MOBILE_PRIMARY = [
  { path: "/",             icon: Home,   label: "Home"    },
  { path: "/competitions", icon: Trophy, label: "Compete" },
  { path: "/search",       icon: Search, label: "Search"  },
      { path: "/social",       icon: Rss,    label: "Social"  },
      { path: "/profile",      icon: User,   label: "Profile" },
];

const MOBILE_MORE_GROUPS = [
  {
    label: "Play",
    items: [
      { path: "/game-day",        icon: Zap,           label: "Game Day"      },
      { path: "/tournaments",     icon: Trophy,        label: "Tournaments"   },
      { path: "/register-league", icon: Shield,        label: "Register"      },
      { path: "/rankings",        icon: BarChart3,     label: "Rankings"      },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/community",       icon: MessagesSquare, label: "Discord"       },
      { path: "/clubs",           icon: Shield,        label: "Clubs"         },
      { path: "/players-list",    icon: UsersRound,    label: "Players"       },
      { path: "/follow-back",     icon: Heart,         label: "Follow Back"   },
      { path: "/free-agents",     icon: UsersRound,    label: "Free Agents"   },
    ],
  },
  {
    label: "Market",
    items: [
      { path: "/transfer-market", icon: ArrowLeftRight, label: "Transfers"   },
      { path: "/lifestyle",       icon: Coins,           label: "Lifestyle"  },
      { path: "/store",           icon: ShoppingBag,     label: "Store"      },
    ],
  },
  {
    label: "Info",
    items: [
      { path: "/news",            icon: Newspaper,     label: "News"          },
      { path: "/inbox",           icon: Inbox,         label: "Inbox"         },
      { path: "/schedule",        icon: CalendarDays,  label: "Schedule"      },
      { path: "/notifications",   icon: Bell,          label: "Notifications" },
      { path: "/settings",        icon: Settings,      label: "Settings"      },
    ],
  },
];

function MobileMoreSheet({ open, onClose, pathname }) {
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
        className="fixed left-0 right-0 z-[91] rounded-t-3xl overflow-hidden transition-transform duration-300 ease-out"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(110%)",
          background: "linear-gradient(180deg, #0e1530 0%, #090d1c 100%)",
          borderTop: "1.5px solid rgba(0,229,189,0.2)",
          boxShadow: "0 -12px 60px rgba(0,0,0,0.8)",
          paddingBottom: "calc(var(--mobile-tab-h) + var(--safe-bottom))",
          maxHeight: "82vh",
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>

        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ maxHeight: "calc(82vh - 60px)", WebkitOverflowScrolling: "touch" }}
        >
          {MOBILE_MORE_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-2 px-1"
                style={{ fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)", fontWeight: 700, color: "rgba(0,229,189,0.45)" }}
              >
                {group.label}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(item.path, pathname);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 transition-all active:scale-95"
                      style={{
                        background: isActive ? "rgba(0,229,189,0.12)" : "rgba(255,255,255,0.04)",
                        border: isActive ? "1px solid rgba(0,229,189,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isActive ? "#00E5BD" : "rgba(255,255,255,0.5)" }}
                      />
                      <span
                        className="text-[9px] text-center leading-tight"
                        style={{
                          fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: isActive ? "#00E5BD" : "rgba(255,255,255,0.45)",
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

function MobileBottomBar({ pathname, myPlayer, myClub, accountMode, subscriptionTier, notifCount }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryActive = MOBILE_PRIMARY.find((t) => isNavItemActive(t.path, pathname));
  const moreActive = findActiveInGroups(MOBILE_MORE_GROUPS, pathname);
  const inMore = !primaryActive && Boolean(moreActive);
  const moreLabel = moreActive?.item.label ?? "More";

  return (
    <>
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />

      <nav
        className="fixed left-0 right-0 bottom-0 z-[80] md:hidden flex items-end"
        style={{
          background: "rgba(8,11,24,0.92)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderTop: "1px solid rgba(0,229,189,0.12)",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.6)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="flex w-full">
          {MOBILE_PRIMARY.map((tab) => {
            const isActive = isNavItemActive(tab.path, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-90"
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
                </div>
                <span
                  className="text-[9px] transition-colors"
                  style={{
                    fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: isActive ? "#00E5BD" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* More */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-90"
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
                fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: (moreOpen || inMore) ? "#00E5BD" : "rgba(255,255,255,0.3)",
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
  const navigate = useNavigate();
  const takeoverId = typeof window !== "undefined" ? localStorage.getItem("admin_takeover_club_id") : null;
  const showAdminTakeoverExit = isAdmin && takeoverId && pathname && !pathname.startsWith("/admin");

  return (
    <header
      className="md:hidden relative z-50 shrink-0 flex items-center justify-between px-4"
      style={{
        paddingTop: "calc(var(--safe-top) + 10px)",
        paddingBottom: 10,
        position: "relative",
        background: "linear-gradient(180deg, #090d1c 0%, rgba(9,13,28,0.92) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,229,189,0.1)",
      }}
    >
      <Link to="/" className="shrink-0">
        <img src={LogoImg} alt="STAGE" className="h-9 w-auto object-contain" />
      </Link>

      {activePageLabel && (
        <span
          className="absolute left-1/2 -translate-x-1/2 text-[11px] uppercase truncate max-w-[42vw] pointer-events-none"
          style={{ ...headingFont, fontWeight: 900, letterSpacing: "0.14em", color: TEAL }}
        >
          {activePageLabel}
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="bg-transparent outline-none border border-white/10 rounded-lg px-2 py-1 text-[10px] uppercase"
          style={{
            fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#080f1c] text-white normal-case">{t.label}</option>
          ))}
        </select>

        <NotificationBell />

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
              fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
              fontWeight: 800,
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

        {/* Identity avatar tap → profile */}
        <Link to="/profile" className="ml-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border"
            style={{
              border: "1.5px solid rgba(0,229,189,0.4)",
              background: myPlayer?.avatar_url ? `url(${myPlayer.avatar_url})` : "rgba(255,255,255,0.08)",
              backgroundSize: `${myPlayer?.avatar_zoom || 150}%`,
              backgroundPosition: myPlayer?.avatar_position || "50% 50%",
              backgroundRepeat: "no-repeat",
            }}
          >
            {!myPlayer?.avatar_url && <User className="w-4 h-4 text-white/50" />}
          </div>
        </Link>
      </div>
    </header>
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
      className="md:hidden relative z-50 shrink-0"
      style={{
        paddingTop: "calc(var(--safe-top) + 8px)",
        paddingBottom: 8,
        background: "linear-gradient(180deg, #160a12 0%, #090d1c 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(248,113,113,0.22)",
      }}
    >
      <div className="flex items-center justify-between px-3">
        <Link to="/admin" className="flex items-center gap-2">
          <img src={LogoImg} alt="STAGE" className="h-8 w-auto object-contain" />
          <span
            className="text-[10px] uppercase truncate max-w-[9rem]"
            style={{ ...headingFont, fontWeight: 900, letterSpacing: "0.16em", color: "#f87171" }}
          >
            {headerTitle}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Link to="/admin" className="rounded p-1.5" style={{ color: isNavItemActive("/admin", pathname) ? TEAL : "rgba(255,255,255,0.6)" }}>
            <Home className="w-4 h-4" />
          </Link>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-transparent outline-none border border-white/10 rounded px-1.5 py-1 text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.55)",
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
                <span style={{ ...headingFont, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [authUser,         setAuthUser]         = useState(null);
  const [takeoverClubName, setTakeoverClubName] = useState(null);
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
      const u = await stageClient.auth.me();
      if (!u) return;
      const clubs = await stageClient.entities.Club.filter({ owner_email: u.email });
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
      const u = await stageClient.auth.me();
      if (!u) return;
      const players = await stageClient.entities.Player.filter({ email: u.email });
      const p = players?.[0];
      if (!p) return;
      setMyPlayer(p);
      setSubscriptionTier((p.subscription || "rookie").toLowerCase());
      // Fire-and-forget: pay any pending weekly salary on app load
      processPlayerSalary(p).catch(() => {});
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
  const showAdminHeader = shouldShowAdminHeader(location.pathname, authUser, isAdmin);
  const adminTakeoverClubId =
    typeof window !== "undefined" ? localStorage.getItem("admin_takeover_club_id") : null;
  const showAdminTakeoverChip =
    isAdmin && adminTakeoverClubId && !showAdminHeader;
  const clubPath = myClubId ? `/clubs/${myClubId}` : null;
  const playerGroups = getPlayerGroups(clubPath);
  const ownerGroups = getOwnerGroups(clubPath);
  const adminGroups = getAdminGroups();
  const headerNavGroups = showAdminHeader
    ? adminGroups
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
                    <span style={{ ...headingFont, fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fbbf24" }}>Owner</span>
                    <Link to="/profile" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Player profile</Link>
                  </>
                )}
                {myPlayer && !myClubId && (
                  <>
                    <span style={{ ...headingFont, fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa" }}>Player</span>
                    <Link to="/clubs" style={{ ...headingFont, fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.35)" }} className="hover:text-[#00E5BD] transition-colors">+ Create club</Link>
                  </>
                )}
              </div>
            )}

            {showAdminHeader ? (
              <>
                <div className="hidden sm:flex shrink-0 items-center px-3">
                  <span style={{ ...headingFont, fontWeight: 900, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171" }}>
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
                groups={accountMode === "club" ? ownerGroups : playerGroups}
                pathname={location.pathname}
                isWhiteTheme={isWhiteTheme}
              />
            )}

            <div className="hidden sm:flex shrink-0 items-center px-3 self-stretch">
              <span style={{ ...headingFont, fontWeight: 700, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.35)" : "rgba(0,229,189,0.22)" }}>
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
                  fontWeight: 800,
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
                style={{ ...headingFont, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: isWhiteTheme ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.55)" }}
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

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────── */}
      {!showAdminHeader && (
        <MobileBottomBar
          pathname={location.pathname}
          myPlayer={myPlayer}
          myClub={myClub}
          accountMode={accountMode}
          subscriptionTier={subscriptionTier}
          notifCount={notifCount}
        />
      )}
    </div>
  );
}
