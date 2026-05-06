const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = require('../../constants/constants');

const generateAccessToken  = (payload) => jwt.sign(payload, ACCESS_TOKEN_SECRET,  { expiresIn: '1d' });
const generateRefreshToken = (payload) => jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

module.exports = { generateAccessToken, generateRefreshToken };
