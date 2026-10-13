'use strict';
const { Sequelize } = require('sequelize');
const { SCHEMA, table } = require('../config/schema');

module.exports = {
  async up(qi) {
    await qi.createTable(table('answers'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      player_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('session_players'), key: 'id' },
      },
      question_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: table('questions'), key: 'id' } },
      choice_id: { type: Sequelize.INTEGER, references: { model: table('choices'), key: 'id' } }, // NULL = timeout
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false },
      answer_time_ms: { type: Sequelize.INTEGER, allowNull: false },      // measured by the server
      stars_earned: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      streak_after: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      double_star_used: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      protection_used: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await qi.addConstraint(table('answers'), {
      type: 'unique', fields: ['player_id', 'question_id'], name: 'answers_player_question_key', // one answer per question
    });
    await qi.addIndex(table('answers'), ['player_id'], { name: 'idx_answers_player' });

    // A 5th correct answer in a row creates one offer with 3 slots. The server
    // fills the slots BEFORE the player picks. Contents are never sent early.
    await qi.createTable(table('chest_offers'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      answer_id: {
        type: Sequelize.INTEGER, allowNull: false, unique: true, onDelete: 'CASCADE',
        references: { model: table('answers'), key: 'id' },
      },
      player_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('session_players'), key: 'id' },
      },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'offered' },
      picked_slot: { type: Sequelize.INTEGER },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      opened_at: { type: Sequelize.DATE },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."chest_offers" ADD CONSTRAINT chest_offers_status_check CHECK (status IN ('offered', 'opened', 'expired'))`
    );
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."chest_offers" ADD CONSTRAINT chest_offers_slot_check CHECK (picked_slot BETWEEN 1 AND 3)`
    );

    // reward_type: double_star, protection_card, or empty ("Better Luck Next Time")
    await qi.createTable(table('chest_slots'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      chest_offer_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('chest_offers'), key: 'id' },
      },
      slot_number: { type: Sequelize.INTEGER, allowNull: false },
      reward_type: { type: Sequelize.STRING(20), allowNull: false },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."chest_slots" ADD CONSTRAINT chest_slots_slot_check CHECK (slot_number BETWEEN 1 AND 3)`
    );
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."chest_slots" ADD CONSTRAINT chest_slots_reward_check CHECK (reward_type IN ('double_star', 'protection_card', 'empty'))`
    );
    await qi.addConstraint(table('chest_slots'), {
      type: 'unique', fields: ['chest_offer_id', 'slot_number'], name: 'chest_slots_offer_slot_key',
    });
  },
  async down(qi) {
    await qi.dropTable(table('chest_slots'));
    await qi.dropTable(table('chest_offers'));
    await qi.dropTable(table('answers'));
  },
};
