const { Host } = require('../models');

const getByUsername = (username, t) =>
  Host.findOne({
    attributes: ['id', 'username', 'password_hash', 'display_name'],
    where: { username },
    raw: true,
    transaction: t,
  });

async function create(username, passwordHash, displayName, t) {
  const host = await Host.create(
    { username, password_hash: passwordHash, display_name: displayName },
    { transaction: t }
  );
  return host.id;
}

module.exports = { getByUsername, create };
