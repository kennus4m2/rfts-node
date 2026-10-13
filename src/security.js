const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('./errors');

const HOST_TOKEN_HOURS = 8;
const PLAYER_TOKEN_HOURS = 3; // Hub Contract: player token expires after 3 hours

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set in .env');
  return value;
}

// bcrypt only reads the first 72 bytes
const hashPassword = (password) => bcrypt.hash(password, 10);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

function makeToken(claims, hours) {
  return jwt.sign(claims, secret(), { algorithm: 'HS256', expiresIn: `${hours}h` });
}

const createHostToken = (hostId) => makeToken({ sub: String(hostId), role: 'host' }, HOST_TOKEN_HOURS);

/** Valid for one session only (the session id is inside the token). */
const createPlayerToken = (playerId, sessionId) =>
  makeToken({ sub: String(playerId), role: 'player', sid: sessionId }, PLAYER_TOKEN_HOURS);

function decode(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in first.');
  try {
    return jwt.verify(match[1].trim(), secret(), { algorithms: ['HS256'] });
  } catch {
    throw new AppError(401, 'AUTH_REQUIRED', 'Your login is invalid or has expired.');
  }
}

/** Middleware for host-only endpoints. Sets req.hostId. */
function requireHost(req, res, next) {
  const payload = decode(req);
  if (payload.role !== 'host') throw new AppError(403, 'FORBIDDEN', 'Only hosts can do this.');
  req.hostId = Number(payload.sub);
  next();
}

/** Middleware for player endpoints. Sets req.player = { player_id, session_id }. */
function requirePlayer(req, res, next) {
  const payload = decode(req);
  if (payload.role !== 'player') throw new AppError(403, 'FORBIDDEN', 'Only players can do this.');
  req.player = { player_id: Number(payload.sub), session_id: Number(payload.sid) };
  next();
}

module.exports = {
  HOST_TOKEN_HOURS, PLAYER_TOKEN_HOURS,
  hashPassword, verifyPassword, createHostToken, createPlayerToken, requireHost, requirePlayer,
};
