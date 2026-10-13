const crypto = require('crypto');
const { UniqueConstraintError } = require('sequelize');
const rules = require('../rules');
const { transaction } = require('../db');
const { AppError } = require('../errors');
const sessions = require('../repositories/sessionRepository');
const players = require('../repositories/playerRepository');
const questionSets = require('../repositories/questionSetRepository');
const { createPlayerToken, PLAYER_TOKEN_HOURS } = require('../security');
const { iso } = require('../timeutil');
const { isBadNickname } = require('../validators');

/** Find a session by join code. Ends it first if the round time ran out. */
async function load(code, t, lock = false) {
  let row = await sessions.getByCode(code, t, lock);
  if (!row) throw new AppError(404, 'SESSION_NOT_FOUND', `No game uses the join code ${code.slice(0, 20)}.`);
  if (row.expired) {
    await sessions.setEnded(row.id, t);
    row = await sessions.getByCode(code, t, lock);
  }
  return row;
}

async function toPublic(row, t) {
  return {
    join_code: row.join_code,
    status: row.status,
    question_set_title: row.question_set_title,
    duration_sec: row.duration_sec,
    starting_lives: row.starting_lives,
    player_count: await sessions.playerCount(row.id, t),
    max_players: rules.MAX_PLAYERS,
    seconds_left: row.seconds_left,
    started_at: iso(row.started_at),
    ends_at: iso(row.ends_at),
    ended_at: iso(row.ended_at),
    created_at: iso(row.created_at),
  };
}

/** 6 random digits, never starting with 0, not used by any other session. */
async function newCode(t) {
  for (let i = 0; i < 50; i++) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!(await sessions.codeExists(code, t))) return code;
  }
  throw new AppError(500, 'SERVER_ERROR', 'Could not create a join code. Please try again.');
}

const create = (hostId, body) =>
  transaction(async (t) => {
    const qs = await questionSets.getSet(body.question_set_id, t);
    if (!qs) throw new AppError(404, 'QUESTION_SET_NOT_FOUND', `No question set has the id ${body.question_set_id}.`);
    if (qs.host_id !== hostId) throw new AppError(403, 'NOT_YOUR_QUESTION_SET', 'This question set belongs to another host.');
    const code = await newCode(t);
    await sessions.create(hostId, body.question_set_id, code, body.duration_sec, body.starting_lives, t);
    return toPublic(await sessions.getByCode(code, t), t);
  });

async function listForHost(hostId) {
  const rows = await transaction((t) => sessions.listForHost(hostId, t));
  return rows.map((r) => ({
    join_code: r.join_code, status: r.status,
    question_set_title: r.question_set_title, player_count: r.player_count,
    duration_sec: r.duration_sec, starting_lives: r.starting_lives,
    started_at: iso(r.started_at), ended_at: iso(r.ended_at), created_at: iso(r.created_at),
  }));
}

const getPublic = (code) => transaction(async (t) => toPublic(await load(code, t), t));

const changeStatus = (hostId, code, newStatus) =>
  transaction(async (t) => {
    const row = await load(code, t, true);
    if (row.host_id !== hostId) throw new AppError(403, 'NOT_YOUR_SESSION', 'This game belongs to another host.');
    if (row.status === 'ended') throw new AppError(409, 'SESSION_ENDED', 'This game has already ended.');
    if (newStatus === 'playing') {
      if (row.status !== 'waiting') throw new AppError(409, 'INVALID_STATUS_CHANGE', 'This game has already started.');
      await sessions.setPlaying(row.id, t);
    } else {
      await sessions.setEnded(row.id, t);
    }
    return toPublic(await sessions.getByCode(code, t), t);
  });

const join = (code, nickname) =>
  transaction(async (t) => {
    const row = await load(code, t, true); // lock so two joins cannot pass the limit together
    if (row.status === 'ended') throw new AppError(409, 'SESSION_ENDED', 'This game has already ended.');
    if ((await sessions.playerCount(row.id, t)) >= rules.MAX_PLAYERS) {
      throw new AppError(409, 'SESSION_FULL', 'This game is full.');
    }
    if (isBadNickname(nickname)) throw new AppError(400, 'NICKNAME_NOT_ALLOWED', 'Please pick a different nickname.');
    if (await players.nicknameTaken(row.id, nickname, t)) {
      throw new AppError(409, 'NICKNAME_TAKEN', 'That nickname is already used in this game.');
    }
    let playerId;
    try {
      playerId = await players.create(row.id, nickname, row.starting_lives, t);
    } catch (e) {
      if (e instanceof UniqueConstraintError) {
        throw new AppError(409, 'NICKNAME_TAKEN', 'That nickname is already used in this game.');
      }
      throw e;
    }
    return {
      player_id: playerId,
      nickname,
      token: createPlayerToken(playerId, row.id),
      token_type: 'Bearer',
      expires_in: PLAYER_TOKEN_HOURS * 3600,
      stars: 0,
      lives: row.starting_lives,
      session_status: row.status,
    };
  });

module.exports = { load, create, listForHost, getPublic, changeStatus, join };
