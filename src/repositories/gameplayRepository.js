/** All database access for questions served to players, answers and chests. */
const { QueryTypes } = require('sequelize');
const rules = require('../rules');
const { sequelize, Question, Choice, Answer, ChestOffer, ChestSlot } = require('../models');

const select = (sql, replacements, t) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction: t });

async function nextQuestion(setId, playerId, t) {
  const rows = await select(
    `SELECT q.id, q.position, q.text, q.type, q.time_limit_sec FROM questions q
     WHERE q.question_set_id = :setId
       AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.player_id = :playerId AND a.question_id = q.id)
     ORDER BY q.position LIMIT 1`,
    { setId, playerId }, t
  );
  return rows[0] || null;
}

// correct answers are never selected here
async function getChoices(questionId, t) {
  const rows = await Choice.findAll({
    attributes: ['text'], where: { question_id: questionId },
    order: [['choice_index', 'ASC']], raw: true, transaction: t,
  });
  return rows.map((r) => r.text);
}

const countQuestions = (setId, t) => Question.count({ where: { question_set_id: setId }, transaction: t });

const getQuestion = (questionId, t) =>
  Question.findByPk(questionId, { attributes: ['id', 'question_set_id', 'time_limit_sec'], raw: true, transaction: t });

const getChoice = (questionId, choiceIndex, t) =>
  Choice.findOne({
    attributes: ['id', 'is_correct'],
    where: { question_id: questionId, choice_index: choiceIndex },
    raw: true, transaction: t,
  });

async function alreadyAnswered(playerId, questionId, t) {
  const n = await Answer.count({ where: { player_id: playerId, question_id: questionId }, transaction: t });
  return n > 0;
}

async function insertAnswer(v, t) {
  const row = await Answer.create(
    {
      player_id: v.playerId, question_id: v.questionId, choice_id: v.choiceId, is_correct: v.isCorrect,
      answer_time_ms: v.timeMs, stars_earned: v.starsChange, streak_after: v.streakAfter,
      double_star_used: v.doubleStarUsed, protection_used: v.protectionUsed,
    },
    { transaction: t }
  );
  return row.id;
}

async function remainingQuestions(setId, playerId, t) {
  const [row] = await select(
    `SELECT COUNT(*) AS n FROM questions q WHERE q.question_set_id = :setId
       AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.player_id = :playerId AND a.question_id = q.id)`,
    { setId, playerId }, t
  );
  return Number(row.n);
}

// ---------- chests ----------

async function createChest(answerId, playerId, slots, t) {
  const offer = await ChestOffer.create({ answer_id: answerId, player_id: playerId }, { transaction: t });
  await ChestSlot.bulkCreate(
    slots.map((reward, i) => ({ chest_offer_id: offer.id, slot_number: i + 1, reward_type: reward })),
    { transaction: t }
  );
  return offer.id;
}

async function pendingChest(playerId, t) {
  const rows = await select(
    `SELECT id, (created_at + :secs * INTERVAL '1 second' < NOW()) AS expired
     FROM chest_offers WHERE player_id = :playerId AND status = 'offered' ORDER BY id DESC LIMIT 1`,
    { secs: rules.CHEST_TIMEOUT_SEC, playerId }, t
  );
  return rows[0] || null;
}

async function getChest(offerId, playerId, t) {
  const rows = await select(
    `SELECT id, status, (created_at + :secs * INTERVAL '1 second' < NOW()) AS expired
     FROM chest_offers WHERE id = :offerId AND player_id = :playerId FOR UPDATE`,
    { secs: rules.CHEST_TIMEOUT_SEC, offerId, playerId }, t
  );
  return rows[0] || null;
}

async function getSlotReward(offerId, slotNumber, t) {
  const row = await ChestSlot.findOne({
    attributes: ['reward_type'], where: { chest_offer_id: offerId, slot_number: slotNumber },
    raw: true, transaction: t,
  });
  return row ? row.reward_type : null;
}

function markChest(offerId, status, pickedSlot, t) {
  return sequelize.query(
    `UPDATE chest_offers SET status = :status, picked_slot = :pickedSlot,
            opened_at = CASE WHEN :status = 'opened' THEN NOW() ELSE opened_at END WHERE id = :offerId`,
    { replacements: { status, pickedSlot: pickedSlot ?? null, offerId }, type: QueryTypes.UPDATE, transaction: t }
  );
}

module.exports = {
  nextQuestion, getChoices, countQuestions, getQuestion, getChoice, alreadyAnswered, insertAnswer,
  remainingQuestions, createChest, pendingChest, getChest, getSlotReward, markChest,
};
