const express = require('express');
const rules = require('../rules');
const { sequelize } = require('../db');
const { AppError } = require('../errors');
const { requireHost, requirePlayer, createHostToken, verifyPassword, HOST_TOKEN_HOURS } = require('../security');
const hostRepository = require('../repositories/hostRepository');
const { transaction } = require('../db');
const schemas = require('../schemas');
const { parseBody, parseIntParam } = schemas;
const questionSets = require('../services/questionSetService');
const sessionService = require('../services/sessionService');
const gameService = require('../services/gameService');

const router = express.Router();

// ---------- game-info and health (no token) ----------

router.get('/game-info', (req, res) => {
  res.json({
    slug: 'reach-for-the-stars',
    name: 'Reach for the Stars',
    team: process.env.TEAM_NAME || 'Team 5 (BSCS 3-_)', // set TEAM_NAME in .env
    description: 'Answer trivia questions, collect stars, open mystery chests, and climb the leaderboard.',
    min_players: rules.MIN_PLAYERS,
    max_players: rules.MAX_PLAYERS,
    thumbnail_url: '/games/reach-for-the-stars/thumbnail.png',
    play_url: '/games/reach-for-the-stars/',
    version: '1.0.0',
  });
});

router.get('/health', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
  } catch (e) {
    console.error('HEALTH CHECK ERROR:', e.message); // shows the real reason in your terminal
    throw new AppError(503, 'DATABASE_DOWN', 'The database is not available right now.');
  }
  res.json({ status: 'ok', database: 'ok', time: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') });
});

// ---------- auth ----------

router.post('/auth/login', async (req, res) => {
  const body = parseBody(schemas.loginRequest, req.body);
  const host = await transaction((t) => hostRepository.getByUsername(body.username, t));

  // Same message for a wrong username and a wrong password
  if (!host || !(await verifyPassword(body.password, host.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'The username or password is wrong.');
  }
  res.json({
    token: createHostToken(host.id),
    token_type: 'Bearer',
    expires_in: HOST_TOKEN_HOURS * 3600,
    host: { id: host.id, username: host.username, display_name: host.display_name },
  });
});

// ---------- question sets (host) ----------

router.post('/question-sets', requireHost, async (req, res) => {
  const body = parseBody(schemas.questionSetIn, req.body);
  res.status(201).json(await questionSets.create(req.hostId, body));
});

router.get('/question-sets', requireHost, async (req, res) => {
  res.json({ question_sets: await questionSets.listSets(req.hostId) });
});

router.get('/question-sets/:id', requireHost, async (req, res) => {
  res.json(await questionSets.get(req.hostId, parseIntParam(req.params.id, 'set_id')));
});

router.put('/question-sets/:id', requireHost, async (req, res) => {
  const setId = parseIntParam(req.params.id, 'set_id');
  const body = parseBody(schemas.questionSetIn, req.body);
  res.json(await questionSets.replace(req.hostId, setId, body));
});

router.delete('/question-sets/:id', requireHost, async (req, res) => {
  res.json(await questionSets.remove(req.hostId, parseIntParam(req.params.id, 'set_id')));
});

// ---------- sessions ----------

router.post('/sessions', requireHost, async (req, res) => {
  const body = parseBody(schemas.sessionCreate, req.body);
  res.status(201).json(await sessionService.create(req.hostId, body));
});

router.get('/sessions', requireHost, async (req, res) => {
  res.json({ sessions: await sessionService.listForHost(req.hostId) });
});

router.get('/sessions/:code', async (req, res) => {
  res.json(await sessionService.getPublic(req.params.code));
});

router.patch('/sessions/:code', requireHost, async (req, res) => {
  const body = parseBody(schemas.sessionPatch, req.body);
  res.json(await sessionService.changeStatus(req.hostId, req.params.code, body.status));
});

// ---------- players ----------

router.post('/sessions/:code/players', async (req, res) => {
  const body = parseBody(schemas.joinRequest, req.body);
  res.status(201).json(await sessionService.join(req.params.code, body.nickname));
});

router.get('/sessions/:code/players/me', requirePlayer, async (req, res) => {
  res.json(await gameService.me(req.params.code, req.player));
});

// ---------- gameplay ----------

router.get('/sessions/:code/questions/next', requirePlayer, async (req, res) => {
  res.json(await gameService.nextQuestion(req.params.code, req.player));
});

router.post('/sessions/:code/answers', requirePlayer, async (req, res) => {
  const body = parseBody(schemas.answerRequest, req.body);
  res.status(201).json(await gameService.submitAnswer(req.params.code, req.player, body));
});

router.post('/sessions/:code/chests', requirePlayer, async (req, res) => {
  const body = parseBody(schemas.chestRequest, req.body);
  res.status(201).json(await gameService.openChest(req.params.code, req.player, body));
});

router.get('/sessions/:code/leaderboard', async (req, res) => {
  res.json(await gameService.leaderboard(req.params.code));
});

module.exports = router;
