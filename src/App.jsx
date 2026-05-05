import React from 'react';
import { motion } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { TranslationProvider } from '@/lib/TranslationContext';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { base44 } from '@/api/base44Client';
import BannerImg from '@/assets/Banner.jpg';

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
import Admin from './pages/Admin';
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
import FollowBack from './pages/FollowBack';
import Competitions from './pages/Competitions';
import CompetitionDetail from './pages/CompetitionDetail';
import LeagueDetail from './pages/LeagueDetail';
import SeasonRegistrations from './pages/SeasonRegistrations';

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
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();
  const [playerSetupComplete, setPlayerSetupComplete] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);

  React.useEffect(() => {
    if (user?.email) {
      Promise.all([
        base44.entities.Player.filter({ email: user.email }),
        base44.entities.Club.filter({ owner_email: user.email }),
      ]).then(([players, clubs]) => {
        setPlayerSetupComplete(players.length > 0 || clubs.length > 0);
      });
    }
  }, [user]);

  // Show splash screen while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <SplashScreen />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      if (showLogin) return <Login />;
      return <Landing onSignIn={() => setShowLogin(true)} />;
    }
  }

  // No user → landing page, then login on demand
  if (!user) {
    if (showLogin) return <Login />;
    return <Landing onSignIn={() => setShowLogin(true)} />;
  }

  // If user is authenticated but hasn't completed onboarding, show onboarding
  if (user && !playerSetupComplete) {
    return <Onboarding onComplete={() => setPlayerSetupComplete(true)} />;
  }

  // Render the main app
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
        <Route path="/admin" element={<Admin />} />
        <Route path="/tournaments/:id/clubs" element={<ClubsRegistered />} />
        <Route path="/tournaments/:id/players" element={<PlayersRegistered />} />
        <Route path="/contracts/create" element={<CreateContract />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/game-day" element={<GameDay />} />
        <Route path="/transfer-market" element={<TransferMarket />} />
        <Route path="/lifestyle" element={<Lifestyle />} />
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
      <TranslationProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </TranslationProvider>
    </AuthProvider>
  );
}

export default App;
