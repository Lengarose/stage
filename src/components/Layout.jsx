import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home, Shield, Trophy, BarChart3, User, ArrowLeftRight,
  Menu, X, Search, Rss, ShoppingBag, Video, UsersRound,
  Palette, ChevronDown, Newspaper, ShieldAlert, Settings,
  Inbox, CalendarDays, Zap, Coins, Heart, Sun, Moon,
} from "lucide-react";
import LogoImg from '@/assets/Logo.PNG';
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import ProfileCompletionModal from "./ProfileCompletionModal";
import ClubOnboardingModal from "./ClubOnboardingModal";
import NotificationBell from "./NotificationBell";

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

/* ── nav group label ───────────────────────────────────────── */
function NavGroup({ label, children }) {
  return (
    <div className="mb-1">
      <p className="text-[9px] text-white/20 uppercase tracking-[0.22em] font-semibold px-4 pt-4 pb-1">{label}</p>
      {children}
    </div>
  );
}

/* ── nav item ──────────────────────────────────────────────── */
function NavItem({ item, isActive, onClick }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 group relative",
        isActive
          ? "bg-blue-600/15 text-white"
          : "text-white/45 hover:text-white/80 hover:bg-white/5"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-blue-500" />
      )}
      <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-blue-400" : "group-hover:text-white/70")} />
      <span className={cn(
        "text-xs uppercase tracking-widest font-semibold transition-colors",
        isActive ? "text-white" : ""
      )}>
        {item.label}
      </span>
    </Link>
  );
}

/* ── layout ────────────────────────────────────────────────── */
export default function Layout() {
  const location  = useLocation();
  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [profileMenuOpen,  setProfileMenuOpen]  = useState(false);
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [myClubId,         setMyClubId]         = useState(null);
  const [myPlayer,         setMyPlayer]         = useState(null);
  const [subscriptionTier, setSubscriptionTier] = useState("rookie");
  const [accountMode,      setAccountMode]      = useState(() => localStorage.getItem("stage-account-mode") || "player");
  const [theme,            setTheme]            = useState(() => localStorage.getItem("stage-theme") || "theme-dark");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClubModal,    setShowClubModal]    = useState(false);

  function switchMode(mode) {
    localStorage.setItem("stage-account-mode", mode);
    setAccountMode(mode);
  }

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

  const isVideoTheme = theme === "theme-video" || theme === "theme-white";
  const isWhiteTheme = theme === "theme-white";

  /* close mobile menu on route change */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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

      {/* ── TOP NAV ───────────────────────────────────────────── */}
      <header className="relative z-50 shrink-0 h-14 flex items-center px-4 md:px-6 gap-4 bg-[#06091a]/95 backdrop-blur-md border-b border-white/8">
        {/* wordmark */}
        <Link to="/" className="shrink-0">
          <img src={LogoImg} alt="STAGE" className="h-20 w-auto object-contain" />
        </Link>

        {/* divider */}
        <div className="hidden lg:block w-px h-5 bg-white/10" />

        {/* player chip */}
        {myPlayer && (
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <div
              className="w-7 h-7 rounded-full border border-white/20 bg-white/10 shrink-0"
              style={myPlayer.avatar_url ? {
                backgroundImage:`url(${myPlayer.avatar_url})`,
                backgroundSize:`${myPlayer.avatar_zoom || 150}%`,
                backgroundPosition: myPlayer.avatar_position || "50% 50%",
                backgroundRepeat:"no-repeat",
              } : {}}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">
              {myPlayer.gamertag}
            </span>
            {BADGE_IMAGES[subscriptionTier] && (
              <img src={BADGE_IMAGES[subscriptionTier]} alt={subscriptionTier} className="w-5 h-5 rounded-full object-cover border border-white/20" />
            )}
          </div>
        )}

        {/* spacer */}
        <div className="flex-1" />

        {/* right actions */}
        <div className="flex items-center gap-1">
          <Link to="/search" className={cn("p-2 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5", location.pathname === "/search" && "text-white bg-white/8")}>
            <Search className="w-4 h-4" />
          </Link>
          <NotificationBell />
          <Link to="/settings" className={cn("p-2 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5", location.pathname === "/settings" && "text-white bg-white/8")}>
            <Settings className="w-4 h-4" />
          </Link>

          {/* theme picker */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 ml-1">
            <Palette className="w-3.5 h-3.5 text-white/35 shrink-0" />
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              className="bg-transparent text-[11px] uppercase tracking-wider text-white/60 outline-none cursor-pointer"
            >
              {THEMES.map(t => <option key={t.id} value={t.id} className="bg-[#06091a] text-white normal-case">{t.label}</option>)}
            </select>
          </div>

          {isAdmin && (
            <Link to="/admin" className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-[11px] uppercase tracking-widest transition-colors">
              <ShieldAlert className="w-3.5 h-3.5" /> Admin
            </Link>
          )}

          {/* mobile burger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors ml-1"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div className={cn("flex flex-1 overflow-hidden relative", isVideoTheme && "bg-transparent")}>

        {/* ── SIDEBAR (desktop) ─────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 bg-[#060c18] border-r border-white/6 overflow-y-auto">

          {/* Mode switcher */}
          <div className="px-3 pt-4 pb-2">
            {myPlayer && myClubId ? (
              /* Has both roles — show toggle */
              <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] uppercase tracking-widest font-bold">
                <button
                  onClick={() => switchMode("player")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 transition-all", accountMode === "player" ? "bg-blue-600 text-white" : "text-white/35 hover:text-white/60")}
                >
                  <User className="w-3 h-3" /> Player
                </button>
                <button
                  onClick={() => { switchMode("club"); }}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 transition-all", accountMode === "club" ? "bg-amber-500 text-white" : "text-white/35 hover:text-white/60")}
                >
                  <Shield className="w-3 h-3" /> Owner
                </button>
              </div>
            ) : myClubId && !myPlayer ? (
              /* Owner only */
              <div className="px-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Owner Mode</span>
                </div>
                <Link to="/profile" className="flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors">
                  + Create Player Profile
                </Link>
              </div>
            ) : myPlayer && !myClubId ? (
              /* Player only */
              <div className="px-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Player Mode</span>
                </div>
                <Link to="/clubs" className="flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors">
                  + Create Club
                </Link>
              </div>
            ) : null}
          </div>

          {/* My Club pinned link (owner mode) */}
          {accountMode === "club" && myClubId && (
            <div className="px-3 pb-1">
              <Link
                to={`/clubs/${myClubId}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all relative",
                  location.pathname === `/clubs/${myClubId}` ? "bg-amber-500/15 text-white" : "text-white/45 hover:text-white/80 hover:bg-white/5"
                )}
              >
                {location.pathname === `/clubs/${myClubId}` && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-amber-400" />}
                <Shield className={cn("w-4 h-4 shrink-0", location.pathname === `/clubs/${myClubId}` ? "text-amber-400" : "")} />
                <span className="text-xs uppercase tracking-widest font-semibold">My Club</span>
              </Link>
            </div>
          )}

          <div className="w-full h-px bg-white/6 mb-1" />

          <nav className="flex-1 px-3 py-1 overflow-y-auto">
            {(accountMode === "club" ? OWNER_GROUPS : PLAYER_GROUPS).map((group) => (
              <NavGroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <NavItem key={item.path} item={item} isActive={location.pathname === item.path} />
                ))}
              </NavGroup>
            ))}
          </nav>

          <div className="px-3 pb-4 border-t border-white/6 pt-3">
            <p className="text-[9px] text-white/15 uppercase tracking-[0.25em] text-center">STAGE v2.0</p>
          </div>
        </aside>

        {/* ── MOBILE MENU ───────────────────────────────────── */}
        {mobileOpen && (
          <div className="lg:hidden absolute inset-0 z-40 flex">
            <div className="w-64 bg-[#060c18] border-r border-white/8 flex flex-col overflow-y-auto">
              {myPlayer && (
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
                  <div
                    className="w-9 h-9 rounded-full border border-white/20 bg-white/10 shrink-0"
                    style={myPlayer.avatar_url ? {
                      backgroundImage:`url(${myPlayer.avatar_url})`,
                      backgroundSize:`${myPlayer.avatar_zoom || 150}%`,
                      backgroundPosition: myPlayer.avatar_position || "50% 50%",
                      backgroundRepeat:"no-repeat",
                    } : {}}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white">{myPlayer.gamertag}</p>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">{subscriptionTier}</p>
                  </div>
                </div>
              )}

              {/* Mobile mode switcher */}
              {myPlayer && myClubId && (
                <div className="px-3 py-3 border-b border-white/8">
                  <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] uppercase tracking-widest font-bold">
                    <button onClick={() => switchMode("player")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 transition-all", accountMode === "player" ? "bg-blue-600 text-white" : "text-white/35")}>
                      <User className="w-3 h-3" /> Player
                    </button>
                    <button onClick={() => switchMode("club")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 transition-all", accountMode === "club" ? "bg-amber-500 text-white" : "text-white/35")}>
                      <Shield className="w-3 h-3" /> Owner
                    </button>
                  </div>
                </div>
              )}

              {/* My Club pinned (owner mobile) */}
              {accountMode === "club" && myClubId && (
                <div className="px-3 pt-2">
                  <NavItem item={{ path: `/clubs/${myClubId}`, icon: Shield, label: "My Club" }} isActive={location.pathname === `/clubs/${myClubId}`} />
                </div>
              )}

              <nav className="flex-1 px-3 py-1 overflow-y-auto">
                {(accountMode === "club" ? OWNER_GROUPS : PLAYER_GROUPS).map((group) => (
                  <NavGroup key={group.label} label={group.label}>
                    {group.items.map((item) => (
                      <NavItem key={item.path} item={item} isActive={location.pathname === item.path} />
                    ))}
                  </NavGroup>
                ))}
              </nav>

              <div className="px-3 pb-4 space-y-2 border-t border-white/8 pt-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Palette className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <select value={theme} onChange={e => setTheme(e.target.value)} className="flex-1 bg-transparent text-xs uppercase tracking-wider text-white/50 outline-none">
                    {THEMES.map(t => <option key={t.id} value={t.id} className="bg-[#06091a] text-white normal-case">{t.label}</option>)}
                  </select>
                </div>
                {isAdmin && (
                  <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 text-xs uppercase tracking-widest">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin
                  </Link>
                )}
              </div>
            </div>

            {/* backdrop */}
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          </div>
        )}

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
