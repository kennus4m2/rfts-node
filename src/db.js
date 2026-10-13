const { Sequelize } = require('sequelize');
const config = require('../config/config').development;
const { SCHEMA } = require('../config/schema');

/**
 * One Sequelize instance for the whole app.
 *  - Every model lives in the team schema (define.schema).
 *  - search_path is set so the raw SQL in the repositories can say
 *    "FROM hosts" instead of "FROM reach_for_the_stars.hosts".
 *  - Times are UTC.
 */
const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: 'postgres',
  logging: false,
  timezone: '+00:00',
  define: { schema: SCHEMA, timestamps: false, freezeTableName: true },
  dialectOptions: {
    connectTimeout: 15000,
    options: `-c search_path=${SCHEMA}`,
  },
});

/**
 * One database transaction. Commits on success, rolls back on any error.
 * Usage:  await transaction(async (t) => { ... pass { transaction: t } ... })
 */
const transaction = (work) => sequelize.transaction(work);

module.exports = { sequelize, transaction };
