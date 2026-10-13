'use strict';
const { Sequelize } = require('sequelize');
const { SCHEMA, table } = require('../config/schema');

module.exports = {
  async up(qi) {
    await qi.createTable(table('sessions'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      host_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: table('hosts'), key: 'id' } },
      question_set_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: table('question_sets'), key: 'id' },
      },
      join_code: { type: Sequelize.CHAR(6), allowNull: false, unique: true },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'waiting' },
      starting_lives: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      duration_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 300 },
      started_at: { type: Sequelize.DATE },
      ends_at: { type: Sequelize.DATE },          // server compares NOW() to this
      ended_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."sessions" ADD CONSTRAINT sessions_join_code_check CHECK (join_code ~ '^[1-9][0-9]{5}$')`
    );
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."sessions" ADD CONSTRAINT sessions_status_check CHECK (status IN ('waiting', 'playing', 'ended'))`
    );
    await qi.addIndex(table('sessions'), ['host_id'], { name: 'idx_sessions_host' });

    await qi.createTable(table('session_players'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      session_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('sessions'), key: 'id' },
      },
      nickname: { type: Sequelize.STRING(20), allowNull: false },
      stars: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lives: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      current_streak: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      best_streak: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      correct_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      answer_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_answer_ms: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 }, // average-time tie-break
      double_star_ready: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      protection_ready: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      current_question_id: { type: Sequelize.INTEGER, references: { model: table('questions'), key: 'id' } },
      question_served_at: { type: Sequelize.DATE },   // when it was served (server timer)
      joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."session_players" ADD CONSTRAINT session_players_nickname_len CHECK (CHAR_LENGTH(nickname) BETWEEN 2 AND 20)`
    );
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."session_players" ADD CONSTRAINT session_players_stars_check CHECK (stars >= 0)`
    );
    await qi.addConstraint(table('session_players'), {
      type: 'unique', fields: ['session_id', 'nickname'], name: 'session_players_session_nickname_key',
    });
    // "Star" and "star" count as the same nickname (409 NICKNAME_TAKEN)
    await qi.sequelize.query(
      `CREATE UNIQUE INDEX uq_player_nickname_ci ON "${SCHEMA}"."session_players" (session_id, LOWER(nickname))`
    );
  },
  async down(qi) {
    await qi.dropTable(table('session_players'));
    await qi.dropTable(table('sessions'));
  },
};
