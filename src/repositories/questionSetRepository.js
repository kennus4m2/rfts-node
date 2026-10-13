/** All database access for question sets, questions and choices. */
const { QueryTypes } = require('sequelize');
const { sequelize, QuestionSet, Question, Choice } = require('../models');

async function insertQuestions(setId, questions, t) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const row = await Question.create(
      { question_set_id: setId, position: i + 1, text: q.text, type: q.type, time_limit_sec: q.time_limit_sec },
      { transaction: t }
    );
    await Choice.bulkCreate(
      q.choices.map((text, index) => ({
        question_id: row.id, choice_index: index, text, is_correct: index === q.correct_index,
      })),
      { transaction: t }
    );
  }
}

async function insertSet(hostId, data, t) {
  const set = await QuestionSet.create(
    {
      host_id: hostId, title: data.title, description: data.description ?? null,
      subject: data.subject ?? null, grade_level: data.grade_level ?? null,
    },
    { transaction: t }
  );
  await insertQuestions(set.id, data.questions, t);
  return set.id;
}

const getSet = (setId, t) =>
  QuestionSet.findByPk(setId, { raw: true, transaction: t });

/** The question set in the Hub Contract Rule 3 shape (host view, includes correct_index). */
async function getFull(setId, t) {
  const header = await getSet(setId, t);
  if (!header) return null;

  const rows = await Question.findAll({
    where: { question_set_id: setId },
    include: [{ model: Choice, as: 'choices' }],
    order: [['position', 'ASC'], [{ model: Choice, as: 'choices' }, 'choice_index', 'ASC']],
    transaction: t,
  });

  const questions = rows.map((q) => {
    const correct = q.choices.find((c) => c.is_correct);
    return {
      text: q.text,
      type: q.type,
      choices: q.choices.map((c) => c.text),
      correct_index: correct ? correct.choice_index : null,
      time_limit_sec: q.time_limit_sec,
    };
  });
  return { header, questions };
}

async function listForHost(hostId, t) {
  const rows = await sequelize.query(
    `SELECT s.id, s.title, s.description, s.subject, s.grade_level, s.created_at,
            (SELECT COUNT(*) FROM questions q WHERE q.question_set_id = s.id) AS question_count
     FROM question_sets s WHERE s.host_id = :hostId ORDER BY s.id DESC`,
    { replacements: { hostId }, type: QueryTypes.SELECT, transaction: t }
  );
  return rows.map((r) => ({ ...r, question_count: Number(r.question_count) }));
}

async function updateSet(setId, data, t) {
  await QuestionSet.update(
    {
      title: data.title, description: data.description ?? null,
      subject: data.subject ?? null, grade_level: data.grade_level ?? null,
    },
    { where: { id: setId }, transaction: t }
  );
  await Question.destroy({ where: { question_set_id: setId }, transaction: t }); // choices cascade
  await insertQuestions(setId, data.questions, t);
}

const deleteSet = (setId, t) => QuestionSet.destroy({ where: { id: setId }, transaction: t });

async function countSessions(setId, t) {
  const [row] = await sequelize.query(
    'SELECT COUNT(*) AS n FROM sessions WHERE question_set_id = :setId',
    { replacements: { setId }, type: QueryTypes.SELECT, transaction: t }
  );
  return Number(row.n);
}

module.exports = { insertSet, getSet, getFull, listForHost, updateSet, deleteSet, countSessions };
