const { transaction } = require('../db');
const { AppError } = require('../errors');
const repo = require('../repositories/questionSetRepository');
const { iso } = require('../timeutil');

async function ownedSet(hostId, setId, t) {
  const header = await repo.getSet(setId, t);
  if (!header) throw new AppError(404, 'QUESTION_SET_NOT_FOUND', `No question set has the id ${setId}.`);
  if (header.host_id !== hostId) throw new AppError(403, 'NOT_YOUR_QUESTION_SET', 'This question set belongs to another host.');
  return header;
}

/** Hub Contract Rule 3 shape, plus id and created_at. */
async function shape(setId, t) {
  const { header, questions } = await repo.getFull(setId, t);
  return {
    id: header.id,
    title: header.title,
    description: header.description,
    subject: header.subject,
    grade_level: header.grade_level,
    questions,
    created_at: iso(header.created_at),
  };
}

const create = (hostId, data) =>
  transaction(async (t) => shape(await repo.insertSet(hostId, data, t), t));

async function listSets(hostId) {
  const rows = await transaction((t) => repo.listForHost(hostId, t));
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

const get = (hostId, setId) =>
  transaction(async (t) => {
    await ownedSet(hostId, setId, t);
    return shape(setId, t);
  });

const replace = (hostId, setId, data) =>
  transaction(async (t) => {
    await ownedSet(hostId, setId, t);
    if ((await repo.countSessions(setId, t)) > 0) {
      throw new AppError(409, 'QUESTION_SET_IN_USE', 'This set was already used in a game and cannot be changed.');
    }
    await repo.updateSet(setId, data, t);
    return shape(setId, t);
  });

const remove = (hostId, setId) =>
  transaction(async (t) => {
    await ownedSet(hostId, setId, t);
    if ((await repo.countSessions(setId, t)) > 0) {
      throw new AppError(409, 'QUESTION_SET_IN_USE', 'This set was already used in a game and cannot be deleted.');
    }
    await repo.deleteSet(setId, t);
    return { deleted: true, id: setId };
  });

module.exports = { create, listSets, get, replace, remove };
