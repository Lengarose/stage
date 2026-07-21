const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET } = require('../constants/constants');

const verifyToken = (req, res, next) => {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  jwt.verify(token, ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    if (!user?.id && !user?.email) return res.status(401).json({ success: false, message: 'Invalid token payload' });
    req.user = user;
    next();
  });
};

module.exports = { verifyToken };
