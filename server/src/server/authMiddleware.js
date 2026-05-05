const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET } = require('../constants/constants');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

module.exports = { verifyToken };
