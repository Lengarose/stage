function registerMobileCompatRoutes(app, { verifyToken }) {
  const authRoutes = require('../mobile/authRoutes');
  const userRoutes = require('../mobile/userRoutes');
  const teamRoutes = require('../mobile/teamRoutes');
  const tournamentRoutes = require('../mobile/tournamentRoutes');
  const matchRoutes = require('../mobile/matchRoutes');
  const socialRoutes = require('../mobile/socialRoutes');
  const uploadRoutes = require('../mobile/uploadRoutes');

  // Health for the mobile client (expects { status: 'ok' } via eafc-app healthCheck,
  // but also accepts Stage's { ok: true }. We return both shapes.
  app.get('/api/mobile/health', (_req, res) => {
    res.status(200).json({ status: 'ok', ok: true, service: 'stage-mobile-compat' });
  });

  // Public auth surface matching eafc-app paths under EXPO_PUBLIC_API_URL=/api/mobile
  app.use('/api/mobile/auth', authRoutes);

  // Protected resources
  app.use('/api/mobile/users', verifyToken, userRoutes);
  app.use('/api/mobile/teams', verifyToken, teamRoutes);
  app.use('/api/mobile/tournaments', verifyToken, tournamentRoutes);
  app.use('/api/mobile/matches', verifyToken, matchRoutes);
  app.use('/api/mobile/social', verifyToken, socialRoutes);
  app.use('/api/mobile/uploads', verifyToken, uploadRoutes);

  // Convenience aliases used by some screens
  app.use('/api/mobile/upload', verifyToken, uploadRoutes);
}

module.exports = { registerMobileCompatRoutes };
