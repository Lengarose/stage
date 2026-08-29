import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SocketProvider } from '@/lib/SocketContext';
import { ChatNotificationsProvider } from '@/lib/ChatNotificationsContext';
import { TranslationProvider } from '@/lib/TranslationContext';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { stageClient, clearNeedsOnboarding, clearOAuthReturnState, userNeedsOnboarding } from '@/api/stageClient';
import { ensureAdminPanelMode, isAppAdminUser, isEffectiveAdmin, isAdminGlobalRoute } from '@/lib/adminAuth';
import { getOwnedClubId } from '@/lib/userIdentityFields';
import { shouldApplyTournamentEntranceAccess } from '@/lib/tournamentEntranceAccess';
import BannerImg from '@/assets/Name logo.png';
import ErrorBoundary from '@/components/ErrorBoundary';
import TournamentEntranceRouteGuard from '@/components/TournamentEntranceRouteGuard';

import PageNotFound from './lib/PageNotFound';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt';

// Eagerly loaded — needed for initial render / auth flow
import Login from './pages/Login';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';

// Lazy-loaded pages — split into separate chunks for faster initial load
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ClubDetail = React.lazy(() => import('./pages/ClubDetail'));
const Clubs = React.lazy(() => import('./pages/Clubs'));
const Tournaments = React.lazy(() => import('./pages/Tournaments'));
const TournamentDetail = React.lazy(() => import('./pages/TournamentDetail'));
const InternationalTournaments = React.lazy(() => import('./pages/InternationalTournaments'));
const Rankings = React.lazy(() => import('./pages/Rankings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Social = React.lazy(() => import('./pages/Social'));
const Search = React.lazy(() => import('./pages/Search'));
const Store = React.lazy(() => import('./pages/Store'));
const PlayerProfile = React.lazy(() => import('./pages/PlayerProfile'));
const PresidentLegacyRedirect = React.lazy(() => import('./pages/PresidentLegacyRedirect'));
const Presidents = React.lazy(() => import('./pages/Presidents'));
const EAFCClub = React.lazy(() => import('./pages/EAFCClub'));
const FreeAgents = React.lazy(() => import('./pages/FreeAgents'));
const PlayerStats = React.lazy(() => import('./pages/PlayerStats'));
const PredictionLeaderboard = React.lazy(() => import('./pages/PredictionLeaderboard'));
const Settings = React.lazy(() => import('./pages/Settings'));
const FontPreview = React.lazy(() => import('./pages/FontPreview'));
const News = React.lazy(() => import('./pages/News'));
const Players = React.lazy(() => import('./pages/Players'));
const ClubsRegistered = React.lazy(() => import('./pages/ClubsRegistered'));
const PlayersRegistered = React.lazy(() => import('./pages/PlayersRegistered'));
const CreateContract = React.lazy(() => import('./pages/CreateContract'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
const InboxPage = React.lazy(() => import('./pages/Inbox'));
const Schedule = React.lazy(() => import('./pages/Schedule'));
const GameDay = React.lazy(() => import('./pages/GameDay'));
const TransferMarket = React.lazy(() => import('./pages/TransferMarket'));
const Scouting = React.lazy(() => import('./pages/Scouting'));
const Lifestyle = React.lazy(() => import('./pages/Lifestyle'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const Competitions = React.lazy(() => import('./pages/Competitions'));
const CompetitionDetail = React.lazy(() => import('./pages/CompetitionDetail'));
const RegionalLeagues = React.lazy(() => import('./pages/RegionalLeagues'));
const LeagueDetail = React.lazy(() => import('./pages/LeagueDetail'));
const SeasonRegistrations = React.lazy(() => import('./pages/SeasonRegistrations'));
const Community = React.lazy(() => import('./pages/Community'));
const EntranceTournamentSigninPage = React.lazy(() => import('./pages/tournament-entrance/EntranceTournamentSigninPage'));
const EntranceTournamentSignupPage = React.lazy(() => import('./pages/tournament-entrance/EntranceTournamentSignupPage'));
const TournamentGameDayPage = React.lazy(() => import('./pages/tournament-entrance/TournamentGameDayPage'));
const TournamentSchedulePage = React.lazy(() => import('./pages/tournament-entrance/TournamentSchedulePage'));
const TournamentInboxPage = React.lazy(() => import('./pages/tournament-entrance/TournamentInboxPage'));
const TournamentPlayerProfilePage = React.lazy(() => import('./pages/tournament-entrance/TournamentPlayerProfilePage'));
const TournamentPlayersPage = React.lazy(() => import('./pages/tournament-entrance/TournamentPlayersPage'));
const TournamentClubsPage = React.lazy(() => import('./pages/tournament-entrance/TournamentClubsPage'));
const TournamentTrophyPage = React.lazy(() => import('./pages/tournament-entrance/TournamentTrophyPage'));
const TournamentClubProfilePage = React.lazy(() => import('./pages/tournament-entrance/TournamentClubProfilePage'));
const TournamentSettingsPage = React.lazy(() => import('./pages/tournament-entrance/TournamentSettingsPage'));

// Admin pages — lazy-loaded (only admins need these)
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminDisputesPage = React.lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminForfeitsPage = React.lazy(() => import('./pages/admin/AdminForfeitsPage'));
const AdminPlayersPage = React.lazy(() => import('./pages/admin/AdminPlayersPage'));
const AdminClubsPage = React.lazy(() => import('./pages/admin/AdminClubsPage'));
const AdminRankingsPage = React.lazy(() => import('./pages/admin/AdminRankingsPage'));
const AdminLeaguesPage = React.lazy(() => import('./pages/admin/AdminLeaguesPage'));
const AdminGostPage = React.lazy(() => import('./pages/admin/AdminGostPage'));
const AdminTournamentsPage = React.lazy(() => import('./pages/admin/AdminTournamentsPage'));
const AdminInternationalTournamentsPage = React.lazy(() => import('./pages/admin/AdminInternationalTournamentsPage'));
const AdminTrophiesPage = React.lazy(() => import('./pages/admin/AdminTrophiesPage'));
const AdminRewardsPage = React.lazy(() => import('./pages/admin/AdminRewardsPage'));
const AdminNewsPage = React.lazy(() => import('./pages/admin/AdminNewsPage'));
const AdminLifestylesPage = React.lazy(() => import('./pages/admin/AdminLifestylesPage'));
const AdminTransfersPage = React.lazy(() => import('./pages/admin/AdminTransfersPage'));
const AdminLandingPage = React.lazy(() => import('./pages/admin/AdminLandingPage'));
const AdminHomePage = React.lazy(() => import('./pages/admin/AdminHomePage'));
const AdminAnalyticsPage = React.lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminSectionRoutePage = React.lazy(() => import('./pages/admin/AdminSectionRoutePage'));

// Lightweight loading spinner for lazy-loaded route chunks
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Handles redirect from OAuth backend: /auth/callback?accessToken=&refreshToken=&playerId=
const OAuthCallback = () => {
  const { checkUserAuth } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // If OAuth was started from the mobile app, leave the website immediately.
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mobile') === '1' || params.get('client') === 'mobile') {
          window.location.replace(`stage://auth/callback?${params.toString()}`);
          return;
        }
      } catch {
        /* continue with web flow */
      }

      const result = stageClient.auth.handleOAuthCallback();
      if (!result?.ok) {
        clearOAuthReturnState();
        navigate('/', { replace: true });
        return;
      }

      await checkUserAuth().catch(() => null);
      if (cancelled) return;

      const u = await stageClient.auth.me().catch(() => null);
      if (isAppAdminUser(u)) {
        ensureAdminPanelMode();
        clearOAuthReturnState();
        navigate('/admin', { replace: true });
        return;
      }

      // Tournament entrance invites: apply limited mode for eligible free users
      // before onboarding mounts (Onboarding replaces the entrance route).
      const returnTo = result.returnTo || '/';

      const entranceMatch = String(returnTo).match(/\/tournaments\/entrance\/([^/]+)\/(signin|signup)/);
      const shouldLimit =
        Boolean(entranceMatch) &&
        shouldApplyTournamentEntranceAccess(u);

      if (shouldLimit) {
        try {
          const resolved = await stageClient.http.post('/public/resolve-entrance-token', {
            token: entranceMatch[1],
          });
          const tournamentId = resolved?.data?.tournament?.id;
          if (tournamentId) {
            await stageClient.functions
              .invoke('applyTournamentEntranceAccessMode', { tournament_id: tournamentId })
              .catch(() => {});
            await checkUserAuth().catch(() => null);
          }
        } catch {
          /* keep going — onboarding still required for new users */
        }
      }

      clearOAuthReturnState();
      // Always land on home so AuthenticatedApp can show Onboarding when needed.
      navigate('/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

// SPA fallback when /auth/mobile-handoff is served as index.html (no Express hit).
// Immediately deep-links into the native app so Safari never shows a website 404.
const MobileOAuthHandoff = () => {
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectUri = params.get('redirect_uri') || 'stage://auth/callback';
      params.delete('redirect_uri');
      const allowed =
        redirectUri === 'stage://auth/callback' ||
        redirectUri.startsWith('stage://auth/callback') ||
        /^exp:\/\//i.test(redirectUri);
      const deepBase = allowed ? redirectUri.split('?')[0] : 'stage://auth/callback';
      const qs = params.toString();
      window.location.replace(qs ? `${deepBase}?${qs}` : deepBase);
    } catch {
      window.location.replace('stage://auth/callback');
    }
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Opening the Stage app…</p>
    </div>
  );
};

// Stripe only allows https success/cancel URLs. Mobile checkout returns here, then
// this page opens the native Store. Web checkout keeps using /store without client=mobile.
const MobileStoreHandoff = () => {
  const [deepLink, setDeepLink] = React.useState('stage://apps/store');

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('client');
      const qs = params.toString();
      const next = qs ? `stage://apps/store?${qs}` : 'stage://apps/store';
      setDeepLink(next);
      window.location.replace(next);
    } catch {
      window.location.replace('stage://apps/store');
    }
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Opening the Stage app…</p>
      <p className="text-xs text-muted-foreground">
        If nothing happens, <a className="underline" href={deepLink}>tap here</a>.
      </p>
    </div>
  );
};

const SplashScreen = () => (
  <motion.div
    className="fixed inset-0 z-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
  >
    <img src={BannerImg} alt="Stage" className="w-full h-full object-cover" />
    <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-3 h-3 rounded-full bg-white"
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
        />
      ))}
    </div>
  </motion.div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, user, checkUserAuth } = useAuth();
  const [playerSetupComplete, setPlayerSetupComplete] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);
  const location = useLocation();
  const isTournamentEntrancePath = location.pathname.startsWith('/tournaments/entrance/');

  const handleOnboardingComplete = React.useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`stage_onboarding_completed_${user.id}`, '1');
      clearNeedsOnboarding(user.id);
    }
    setPlayerSetupComplete(true);
  }, [user?.id]);

  const hasCompletedOnboarding = React.useMemo(() => {
    if (!user?.id) return false;
    // Brand-new OAuth accounts must finish onboarding even though a stub player exists.
    if (userNeedsOnboarding(user.id)) return false;
    const userScopedKey = `stage_onboarding_completed_${user.id}`;
    if (localStorage.getItem(userScopedKey) === '1') return true;
    // OAuth stubs have player_id immediately. That is not onboarding complete.
    if (getOwnedClubId(user) && !user.player_id) return true;
    return false;
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    if (isAppAdminUser(user)) ensureAdminPanelMode();
    if (hasCompletedOnboarding) {
      const userScopedKey = `stage_onboarding_completed_${user.id}`;
      if (localStorage.getItem(userScopedKey) !== '1') {
        localStorage.setItem(userScopedKey, '1');
      }
      setPlayerSetupComplete(true);
    }
  }, [user, hasCompletedOnboarding]);

  // Run automated contract maintenance once per session
  React.useEffect(() => {
    if (!user) return;
    const sessionKey = `stage_contract_maintenance_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    stageClient.functions.invoke('contractManagement', { action: 'expire_overdue' }).catch(() => {});
    stageClient.functions.invoke('contractManagement', { action: 'auto_pay_salaries' }).catch(() => {});
  }, [user?.id]);

  // Auto-release tournament-limited users when tournament is completed or end_date has passed.
  React.useEffect(() => {
    if (!user?.id) return;
    if (String(user.access_mode || '').toLowerCase() !== 'tournament_limited') return;
    stageClient.functions
      .invoke('releaseTournamentLimitedAccessIfEligible', {})
      .then((res) => {
        if (res?.data?.released) return checkUserAuth();
      })
      .catch(() => {});
  }, [user?.id, user?.access_mode, checkUserAuth]);

  if (isLoadingAuth) return <SplashScreen />;

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      if (isTournamentEntrancePath) {
        return (
          <ErrorBoundary>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/tournaments/entrance/:token/signin" element={<EntranceTournamentSigninPage />} />
                <Route path="/tournaments/entrance/:token/signup" element={<EntranceTournamentSignupPage />} />
                <Route path="*" element={<Landing onSignIn={() => setShowLogin(true)} />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        );
      }
      if (showLogin) return <Login />;
      return <Landing onSignIn={() => setShowLogin(true)} />;
    }
  }

  if (!user) {
    if (isTournamentEntrancePath) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/tournaments/entrance/:token/signin" element={<EntranceTournamentSigninPage />} />
              <Route path="/tournaments/entrance/:token/signup" element={<EntranceTournamentSignupPage />} />
              <Route path="*" element={<Landing onSignIn={() => setShowLogin(true)} />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (showLogin) return <Login />;
    return <Landing onSignIn={() => setShowLogin(true)} />;
  }

  const isAdmin = isEffectiveAdmin(user);
  const takeoverClubId =
    typeof window !== 'undefined' ? localStorage.getItem('admin_takeover_club_id') : null;
  const isAdminTakeoverClubRoute =
    Boolean(takeoverClubId) &&
    (location.pathname === `/clubs/${takeoverClubId}` ||
      location.pathname.startsWith(`/clubs/${takeoverClubId}/`));
  const isAdminAllowedGlobalRoute = isAdminGlobalRoute(location.pathname);
  if (
    isAdmin &&
    !location.pathname.startsWith('/admin') &&
    !isAdminTakeoverClubRoute &&
    !isAdminAllowedGlobalRoute
  ) {
    return <Navigate to="/admin" replace />;
  }

  if (!isAppAdminUser(user) && !playerSetupComplete && !hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        <TournamentEntranceRouteGuard>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/tournaments/entrance/:token/signin" element={<EntranceTournamentSigninPage />} />
              <Route path="/tournaments/entrance/:token/signup" element={<EntranceTournamentSignupPage />} />
            <Route path="/" element={isAdmin ? <Navigate to="/admin" replace /> : <Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:id" element={<ClubDetail />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/international" element={<InternationalTournaments />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/social" element={<Social />} />
            <Route path="/community" element={<Community />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/store" element={<Store />} />
            <Route path="/players/:id" element={<PlayerProfile />} />
            <Route path="/presidents-list" element={<Presidents />} />
            <Route path="/presidents/:id" element={<PresidentLegacyRedirect />} />
            <Route path="/eafc" element={<EAFCClub />} />
            <Route path="/free-agents" element={<FreeAgents />} />
            <Route path="/stats" element={<PlayerStats />} />
            <Route path="/players-list" element={<Players />} />
            <Route path="/predictions" element={<PredictionLeaderboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/font-preview" element={<FontPreview />} />
            <Route path="/news" element={<News />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/disputes" element={<AdminDisputesPage />} />
            <Route path="/admin/forfeits" element={<AdminForfeitsPage />} />
            <Route path="/admin/players" element={<AdminPlayersPage />} />
            <Route path="/admin/clubs" element={<AdminClubsPage />} />
            <Route path="/admin/rankings" element={<AdminRankingsPage />} />
            <Route path="/admin/leagues" element={<AdminLeaguesPage />} />
            <Route path="/admin/gost" element={<AdminGostPage />} />
            <Route path="/admin/tournaments" element={<AdminTournamentsPage />} />
            <Route path="/admin/international-tournaments" element={<AdminInternationalTournamentsPage />} />
            <Route path="/admin/trophies" element={<AdminTrophiesPage />} />
            <Route path="/admin/rewards" element={<AdminRewardsPage />} />
            <Route path="/admin/news" element={<AdminNewsPage />} />
            <Route path="/admin/lifestyles" element={<AdminLifestylesPage />} />
            <Route path="/admin/transfers" element={<AdminTransfersPage />} />
            <Route path="/admin/landing" element={<AdminLandingPage />} />
            <Route path="/admin/home" element={<AdminHomePage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            {/* The admin recruitment tab is gone. Without this, /admin/:section
                below still matches and renders an empty admin shell — worse than
                a redirect for anyone with the old bookmark. */}
            <Route path="/admin/recruitment" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/:section" element={<AdminSectionRoutePage />} />
            <Route path="/tournaments/:id/clubs" element={<ClubsRegistered />} />
            <Route path="/tournaments/:id/players" element={<PlayersRegistered />} />
            <Route path="/contracts/create" element={<CreateContract />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/game-day" element={<GameDay />} />
            <Route path="/tournaments/inbox" element={<TournamentInboxPage />} />
            <Route path="/tournaments/schedule" element={<TournamentSchedulePage />} />
            <Route path="/tournaments/game-day" element={<TournamentGameDayPage />} />
            <Route path="/tournaments/profile-player" element={<TournamentPlayerProfilePage />} />
            <Route path="/tournaments/profile-player/edit" element={<TournamentPlayerProfilePage />} />
            <Route path="/tournaments/players" element={<TournamentPlayersPage />} />
            <Route path="/tournaments/clubs" element={<TournamentClubsPage />} />
            <Route path="/tournaments/trophy" element={<TournamentTrophyPage />} />
            <Route path="/tournaments/profile-club" element={<TournamentClubProfilePage />} />
            <Route path="/tournaments/settings" element={<TournamentSettingsPage />} />
            <Route path="/transfer-market" element={<TransferMarket />} />
            {/* The recruitment board was replaced by club scouting. Redirect
                rather than 404 so old links, bookmarks and shared URLs still land
                somewhere useful. */}
            <Route path="/recruitment" element={<Navigate to="/scouting" replace />} />
            <Route path="/scouting" element={<Scouting />} />
            <Route path="/lifestyle" element={<Lifestyle />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitions/:slug" element={<CompetitionDetail />} />
            <Route path="/leagues" element={<RegionalLeagues />} />
            <Route path="/leagues/:slug" element={<LeagueDetail />} />
            <Route path="/register-league" element={<SeasonRegistrations />} />
            <Route path="*" element={<PageNotFound />} />
            </Route>
          </Routes>
        </TournamentEntranceRouteGuard>
      </Suspense>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
        <TranslationProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <Routes>
                {/* OAuth callback must be outside AuthenticatedApp so tokens are stored before auth check */}
                <Route path="/auth/callback" element={<OAuthCallback />} />
                <Route path="/auth/mobile-handoff" element={<MobileOAuthHandoff />} />
                <Route path="/auth/store-return" element={<MobileStoreHandoff />} />
                <Route path="/store/mobile-return" element={<MobileStoreHandoff />} />
                <Route path="*" element={
                  <ChatNotificationsProvider>
                    <AuthenticatedApp />
                  </ChatNotificationsProvider>
                } />
              </Routes>
            </Router>
            <PWAUpdatePrompt />
            <Toaster />
          </QueryClientProvider>
        </TranslationProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
