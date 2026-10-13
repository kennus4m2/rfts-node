'use strict';
const { Sequelize } = require('sequelize');
const { SCHEMA, table } = require('../config/schema');

module.exports = {
  async up(qi) {
    await qi.createTable(table('question_sets'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      host_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: table('hosts'), key: 'id' } },
      title: { type: Sequelize.STRING(80), allowNull: false },
      description: { type: Sequelize.STRING(255) },
      subject: { type: Sequelize.STRING(50) },       // the category (Science, History, ...)
      grade_level: { type: Sequelize.STRING(50) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."question_sets" ADD CONSTRAINT question_sets_title_len CHECK (CHAR_LENGTH(title) BETWEEN 3 AND 80)`
    );

    await qi.createTable(table('questions'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      question_set_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('question_sets'), key: 'id' },
      },
      position: { type: Sequelize.INTEGER, allowNull: false },          // order inside the set
      text: { type: Sequelize.STRING(500), allowNull: false },
      type: { type: Sequelize.STRING(20), allowNull: false },
      time_limit_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 20 },
    });
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."questions" ADD CONSTRAINT questions_type_check CHECK (type IN ('multiple_choice', 'true_false'))`
    );
    await qi.sequelize.query(
      `ALTER TABLE "${SCHEMA}"."questions" ADD CONSTRAINT questions_time_limit_check CHECK (time_limit_sec BETWEEN 5 AND 60)`
    );
    await qi.addConstraint(table('questions'), {
      type: 'unique', fields: ['question_set_id', 'position'], name: 'questions_set_position_key',
    });

    // is_correct stays on the server. Players never receive it.
    await qi.createTable(table('choices'), {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      question_id: {
        type: Sequelize.INTEGER, allowNull: false, onDelete: 'CASCADE',
        references: { model: table('questions'), key: 'id' },
      },
      choice_index: { type: Sequelize.INTEGER, allowNull: false },      // counts from 0
      text: { type: Sequelize.STRING(120), allowNull: false },
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    });
    await qi.addConstraint(table('choices'), {
      type: 'unique', fields: ['question_id', 'choice_index'], name: 'choices_question_index_key',
    });
  },
  async down(qi) {
    await qi.dropTable(table('choices'));
    await qi.dropTable(table('questions'));
    await qi.dropTable(table('question_sets'));
  },
};
