/** All database access for players and the leaderboard. */
const { QueryTypes } = require('sequelize');
const { sequelize, SessionPlayer } = require('../models');

// Rank: most stars, then most correct answers, then fastest average answer.
// Players who are equal on all three share a rank.
const RANKED = `
  SELECT id, nickname, stars, correct_count, best_streak, current_streak, lives,
         double_star_ready, protection_ready,
         RANK() OVER (
           ORDER BY stars DESC, correct_count DESC,
                    (CAST(total_answer_ms AS DOUBLE PRECISION) / NULLIF(answer_count, 0)) ASC NULLS LAST
         ) AS rank
  FROM session_players WHERE session_id = :sessionId
`;

const select = (sql, replacements, t) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction: t });

const withNumberRank = (row) => (row ? { ...row, rank: Number(row.rank) } : row);

async function create(sessionId, nickname, lives, t) {
  const row = await SessionPlayer.create({ session_id: sessionId, nickname, lives }, { transaction: t });
  return row.id;
}

async function nicknameTaken(sessionId, nickname, t) {
  const rows = await select(
    'SELECT 1 AS found FROM session_players WHERE session_id = :sessionId AND LOWER(nickname) = LOWER(:nickname)',
    { sessionId, nickname }, t
  );
  return rows.length > 0;
}

async function get(playerId, t, lock = false) {
  const row = await SessionPlayer.findByPk(playerId, {
    raw: true,
    transaction: t,
    ...(lock ? { lock: t.LOCK.UPDATE } : {}),
  });
  if (row) row.total_answer_ms = Number(row.total_answer_ms);
  return row;
}

async function getRanked(sessionId, playerId, t) {
  const rows = await select(`SELECT * FROM (${RANKED}) r WHERE r.id = :playerId`, { sessionId, playerId }, t);
  return withNumberRank(rows[0] || null);
}

async function leaderboard(sessionId, t) {
  const rows = await select(`SELECT * FROM (${RANKED}) r ORDER BY r.rank, r.id`, { sessionId }, t);
  return rows.map(withNumberRank);
}

const run = (sql, replacements, t) =>
  sequelize.query(sql, { replacements, type: QueryTypes.UPDATE, transaction: t });

const setCurrentQuestion = (playerId, questionId, t) =>
  run(
    'UPDATE session_players SET current_question_id = :questionId, question_served_at = NOW() WHERE id = :playerId',
    { playerId, questionId }, t
  );

async function elapsedMs(playerId, t) {
  const [row] = await select(
    `SELECT CAST(EXTRACT(EPOCH FROM (clock_timestamp() - question_served_at)) * 1000 AS BIGINT) AS ms
     FROM session_players WHERE id = :playerId`,
    { playerId }, t
  );
  return Number(row.ms);
}

const updateAfterAnswer = (playerId, v, t) =>
  run(
    `UPDATE session_players SET stars = :stars, lives = :lives, current_streak = :streak,
            best_streak = GREATEST(best_streak, :streak), correct_count = correct_count + :correct,
            answer_count = answer_count + 1, total_answer_ms = total_answer_ms + :timeMs,
            double_star_ready = :doubleStarReady, protection_ready = :protectionReady,
            current_question_id = NULL, question_served_at = NULL WHERE id = :playerId`,
    {
      playerId, stars: v.stars, lives: v.lives, streak: v.streak, correct: v.correct ? 1 : 0,
      timeMs: v.timeMs, doubleStarReady: v.doubleStarReady, protectionReady: v.protectionReady,
    },
    t
  );

function setReadyFlag(playerId, column, t) {
  if (!['double_star_ready', 'protection_ready'].includes(column)) throw new Error('bad column');
  return run(`UPDATE session_players SET ${column} = TRUE WHERE id = :playerId`, { playerId }, t);
}

module.exports = {
  create, nicknameTaken, get, getRanked, leaderboard, setCurrentQuestion, elapsedMs,
  updateAfterAnswer, setReadyFlag,
};
