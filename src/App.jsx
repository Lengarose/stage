import React from 'react';
import { motion } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SocketProvider } from '@/lib/SocketContext';
import { TranslationProvider } from '@/lib/TranslationContext';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { stageClient } from '@/api/stageClient';
import BannerImg from '@/assets/Name logo.png';

import PageNotFound from './lib/PageNotFound';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';

import Login from './pages/Login';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Clubs from './pages/Clubs';
import ClubDetail from './pages/ClubDetail';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Rankings from './pages/Rankings';
import Profile from './pages/Profile';
import Social from './pages/Social';
import Search from './pages/Search';
import Store from './pages/Store';
import PlayerProfile from './pages/PlayerProfile';
import EAFCClub from './pages/EAFCClub';
import FreeAgents from './pages/FreeAgents';
import PlayerStats from './pages/PlayerStats';
import PredictionLeaderboard from './pages/PredictionLeaderboard';
import Settings from './pages/Settings';
import FontPreview from './pages/FontPreview';
import News from './pages/News';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminDisputesPage from './pages/admin/AdminDisputesPage';
import AdminForfeitsPage from './pages/admin/AdminForfeitsPage';
import AdminPlayersPage from './pages/admin/AdminPlayersPage';
import AdminClubsPage from './pages/admin/AdminClubsPage';
import AdminRankingsPage from './pages/admin/AdminRankingsPage';
import AdminLeaguesPage from './pages/admin/AdminLeaguesPage';
import AdminTournamentsPage from './pages/admin/AdminTournamentsPage';
import AdminTrophiesPage from './pages/admin/AdminTrophiesPage';
import AdminRewardsPage from './pages/admin/AdminRewardsPage';
import AdminNewsPage from './pages/admin/AdminNewsPage';
import AdminPressConferencesPage from './pages/admin/AdminPressConferencesPage';
import AdminLifestylesPage from './pages/admin/AdminLifestylesPage';
import AdminTransfersPage from './pages/admin/AdminTransfersPage';
import AdminLandingPage from './pages/admin/AdminLandingPage';
import AdminSectionRoutePage from './pages/admin/AdminSectionRoutePage';
import Players from './pages/Players';
import ClubsRegistered from './pages/ClubsRegistered';
import PlayersRegistered from './pages/PlayersRegistered';
import CreateContract from './pages/CreateContract';
import Notifications from './pages/Notifications';
import InboxPage from './pages/Inbox';
import Schedule from './pages/Schedule';
import GameDay from './pages/GameDay';
import TransferMarket from './pages/TransferMarket';
import Lifestyle from './pages/Lifestyle';
import Wallet from './pages/Wallet';
import FollowBack from './pages/FollowBack';
import Competitions from './pages/Competitions';
import CompetitionDetail from './pages/CompetitionDetail';
import LeagueDetail from './pages/LeagueDetail';
import SeasonRegistrations from './pages/SeasonRegistrations';

// Handles redirect from OAuth backend: /auth/callback?accessToken=&refreshToken=&playerId=
const OAuthCallback = () => {
  const { checkUserAuth } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const ok = stageClient.auth.handleOAuthCallback();
    if (ok) {
      checkUserAuth().then(() => navigate('/', { replace: true }));
    } else {
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
  const { isLoadingAuth, authError, user } = useAuth();
  const [playerSetupComplete, setPlayerSetupComplete] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    if (!user) return;
    const userScopedKey = `stage_onboarding_completed_${user.id}`;
    const userScopedDone = localStorage.getItem(userScopedKey) === '1';
    const legacyDone = localStorage.getItem('stage_onboarding_completed') === '1';
    // Consider onboarding complete if user already has profile data on backend.
    const hasProfileData = Boolean(user.player_id || user.owner_id);
    setPlayerSetupComplete(userScopedDone || legacyDone || hasProfileData);
  }, [user]);

  if (isLoadingAuth) return <SplashScreen />;

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      if (showLogin) return <Login />;
      return <Landing onSignIn={() => setShowLogin(true)} />;
    }
  }

  if (!user) {
    if (showLogin) return <Login />;
    return <Landing onSignIn={() => setShowLogin(true)} />;
  }

  const roleOverrideRaw =
    typeof window !== 'undefined' ? localStorage.getItem('stage_admin_effective_role_id') : null;
  const dbRoleId = Number(user.role_id);
  const effectiveRoleId =
    dbRoleId === 0 && roleOverrideRaw !== null ? Number(roleOverrideRaw) : dbRoleId;
  const isAdmin = effectiveRoleId === 0;
  const takeoverClubId =
    typeof window !== 'undefined' ? localStorage.getItem('admin_takeover_club_id') : null;
  const isAdminTakeoverClubRoute =
    Boolean(takeoverClubId) &&
    (location.pathname === `/clubs/${takeoverClubId}` ||
      location.pathname.startsWith(`/clubs/${takeoverClubId}/`));
  const isAdminAllowedGlobalRoute =
    location.pathname === '/' ||
    location.pathname === '/clubs' ||
    location.pathname.startsWith('/clubs/') ||
    location.pathname === '/search' ||
    location.pathname === '/notifications' ||
    location.pathname === '/settings';
  if (
    isAdmin &&
    !location.pathname.startsWith('/admin') &&
    !isAdminTakeoverClubRoute &&
    !isAdminAllowedGlobalRoute
  ) {
    return <Navigate to="/admin" replace />;
  }

  const isDatabaseAdmin = dbRoleId === 0;
  if (!isAdmin && !isDatabaseAdmin && !playerSetupComplete) {
    return <Onboarding onComplete={() => {
      localStorage.setItem('stage_onboarding_completed', '1');
      if (user?.id) localStorage.setItem(`stage_onboarding_completed_${user.id}`, '1');
      setPlayerSetupComplete(true);
    }} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/clubs/:id" element={<ClubDetail />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/social" element={<Social />} />
        <Route path="/search" element={<Search />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/store" element={<Store />} />
        <Route path="/players/:id" element={<PlayerProfile />} />
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
        <Route path="/admin/tournaments" element={<AdminTournamentsPage />} />
        <Route path="/admin/trophies" element={<AdminTrophiesPage />} />
        <Route path="/admin/rewards" element={<AdminRewardsPage />} />
        <Route path="/admin/news" element={<AdminNewsPage />} />
        <Route path="/admin/press-conferences" element={<AdminPressConferencesPage />} />
        <Route path="/admin/lifestyles" element={<AdminLifestylesPage />} />
        <Route path="/admin/transfers" element={<AdminTransfersPage />} />
        <Route path="/admin/landing" element={<AdminLandingPage />} />
        <Route path="/admin/:section" element={<AdminSectionRoutePage />} />
        <Route path="/tournaments/:id/clubs" element={<ClubsRegistered />} />
        <Route path="/tournaments/:id/players" element={<PlayersRegistered />} />
        <Route path="/contracts/create" element={<CreateContract />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/game-day" element={<GameDay />} />
        <Route path="/transfer-market" element={<TransferMarket />} />
        <Route path="/lifestyle" element={<Lifestyle />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/follow-back" element={<FollowBack />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/competitions/:slug" element={<CompetitionDetail />} />
        <Route path="/leagues/:slug" element={<LeagueDetail />} />
        <Route path="/register-league" element={<SeasonRegistrations />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <TranslationProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              {/* OAuth callback must be outside AuthenticatedApp so tokens are stored before auth check */}
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </TranslationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
