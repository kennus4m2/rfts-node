'use strict';
const { Sequelize } = require('sequelize');
const { SCHEMA, table } = require('../config/schema');

module.exports = {
  async up(qi) {
    await qi.createSchema(SCHEMA);
    await qi.createTable(table('hosts'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false }, // bcrypt hash, never plain text
      display_name: { type: Sequelize.STRING(100), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
  },
  async down(qi) {
    await qi.dropTable(table('hosts'));
    await qi.dropSchema(SCHEMA);
  },
};
