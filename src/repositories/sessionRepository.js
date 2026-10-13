/** All database access for sessions. */
const { QueryTypes } = require('sequelize');
const { sequelize, GameSession } = require('../models');

const select = (sql, replacements, t) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction: t });

async function codeExists(code, t) {
  const rows = await select('SELECT 1 AS found FROM sessions WHERE join_code = :code', { code }, t);
  return rows.length > 0;
}

async function create(hostId, setId, code, durationSec, lives, t) {
  const row = await GameSession.create(
    { host_id: hostId, question_set_id: setId, join_code: code, duration_sec: durationSec, starting_lives: lives },
    { transaction: t }
  );
  return row.id;
}

/** Returns the session plus `expired` (playing, but the round time ran out). */
async function getByCode(code, t, lock = false) {
  const sql =
    `SELECT s.*, qs.title AS question_set_title,
            (s.status = 'playing' AND s.ends_at < NOW()) AS expired,
            CASE WHEN s.status = 'playing'
                 THEN GREATEST(0, CAST(EXTRACT(EPOCH FROM (s.ends_at - NOW())) AS INTEGER)) END AS seconds_left
     FROM sessions s JOIN question_sets qs ON qs.id = s.question_set_id
     WHERE s.join_code = :code` + (lock ? ' FOR UPDATE OF s' : '');
  const rows = await select(sql, { code }, t);
  return rows[0] || null;
}

async function listForHost(hostId, t) {
  const rows = await select(
    `SELECT s.id, s.join_code, s.status, s.duration_sec, s.starting_lives, s.started_at,
            s.ends_at, s.ended_at, s.created_at, qs.title AS question_set_title,
            (SELECT COUNT(*) FROM session_players p WHERE p.session_id = s.id) AS player_count
     FROM sessions s JOIN question_sets qs ON qs.id = s.question_set_id
     WHERE s.host_id = :hostId ORDER BY s.id DESC`,
    { hostId }, t
  );
  return rows.map((r) => ({ ...r, player_count: Number(r.player_count) }));
}

async function playerCount(sessionId, t) {
  const [row] = await select(
    'SELECT COUNT(*) AS n FROM session_players WHERE session_id = :sessionId', { sessionId }, t
  );
  return Number(row.n);
}

const run = (sql, replacements, t) =>
  sequelize.query(sql, { replacements, type: QueryTypes.UPDATE, transaction: t });

const setPlaying = (sessionId, t) =>
  run(
    `UPDATE sessions SET status = 'playing', started_at = NOW(),
            ends_at = NOW() + duration_sec * INTERVAL '1 second' WHERE id = :sessionId`,
    { sessionId }, t
  );

// If the time simply ran out, the end time is when it ran out
const setEnded = (sessionId, t) =>
  run(
    `UPDATE sessions SET status = 'ended', ended_at = LEAST(ends_at, NOW()) WHERE id = :sessionId`,
    { sessionId }, t
  );

module.exports = { codeExists, create, getByCode, listForHost, playerCount, setPlaying, setEnded };
