const { DataTypes, Sequelize } = require('sequelize');
const { sequelize } = require('../db');

// Created-at columns use the DATABASE clock (NOW()), not the Node server's clock.
const NOW = Sequelize.literal('NOW()');
const id = { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true };
const createdAt = (name = 'created_at') => ({ type: DataTypes.DATE, allowNull: false, defaultValue: NOW, field: name });

const Host = sequelize.define('Host', {
  id,
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  display_name: { type: DataTypes.STRING(100), allowNull: false },
  created_at: createdAt(),
}, { tableName: 'hosts' });

const QuestionSet = sequelize.define('QuestionSet', {
  id,
  host_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(80), allowNull: false },
  description: DataTypes.STRING(255),
  subject: DataTypes.STRING(50),
  grade_level: DataTypes.STRING(50),
  created_at: createdAt(),
}, { tableName: 'question_sets' });

const Question = sequelize.define('Question', {
  id,
  question_set_id: { type: DataTypes.INTEGER, allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.STRING(500), allowNull: false },
  type: { type: DataTypes.STRING(20), allowNull: false },
  time_limit_sec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
}, { tableName: 'questions' });

const Choice = sequelize.define('Choice', {
  id,
  question_id: { type: DataTypes.INTEGER, allowNull: false },
  choice_index: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.STRING(120), allowNull: false },
  is_correct: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'choices' });

const GameSession = sequelize.define('GameSession', {
  id,
  host_id: { type: DataTypes.INTEGER, allowNull: false },
  question_set_id: { type: DataTypes.INTEGER, allowNull: false },
  join_code: { type: DataTypes.CHAR(6), allowNull: false, unique: true },
  status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'waiting' },
  starting_lives: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  duration_sec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 300 },
  started_at: DataTypes.DATE,
  ends_at: DataTypes.DATE,
  ended_at: DataTypes.DATE,
  created_at: createdAt(),
}, { tableName: 'sessions' });

const SessionPlayer = sequelize.define('SessionPlayer', {
  id,
  session_id: { type: DataTypes.INTEGER, allowNull: false },
  nickname: { type: DataTypes.STRING(20), allowNull: false },
  stars: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lives: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  current_streak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  best_streak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  correct_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  answer_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_answer_ms: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  double_star_ready: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  protection_ready: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  current_question_id: DataTypes.INTEGER,
  question_served_at: DataTypes.DATE,
  joined_at: createdAt('joined_at'),
}, { tableName: 'session_players' });

const Answer = sequelize.define('Answer', {
  id,
  player_id: { type: DataTypes.INTEGER, allowNull: false },
  question_id: { type: DataTypes.INTEGER, allowNull: false },
  choice_id: DataTypes.INTEGER,
  is_correct: { type: DataTypes.BOOLEAN, allowNull: false },
  answer_time_ms: { type: DataTypes.INTEGER, allowNull: false },
  stars_earned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  streak_after: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  double_star_used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  protection_used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: createdAt(),
}, { tableName: 'answers' });

const ChestOffer = sequelize.define('ChestOffer', {
  id,
  answer_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  player_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'offered' },
  picked_slot: DataTypes.INTEGER,
  created_at: createdAt(),
  opened_at: DataTypes.DATE,
}, { tableName: 'chest_offers' });

const ChestSlot = sequelize.define('ChestSlot', {
  id,
  chest_offer_id: { type: DataTypes.INTEGER, allowNull: false },
  slot_number: { type: DataTypes.INTEGER, allowNull: false },
  reward_type: { type: DataTypes.STRING(20), allowNull: false },
}, { tableName: 'chest_slots' });

// Relations (the database already enforces them; these let us use include)
Question.hasMany(Choice, { foreignKey: 'question_id', as: 'choices', onDelete: 'CASCADE' });
Choice.belongsTo(Question, { foreignKey: 'question_id' });

module.exports = {
  sequelize, Host, QuestionSet, Question, Choice,
  GameSession, SessionPlayer, Answer, ChestOffer, ChestSlot,
};
