// The Hub Contract gives each team its own PostgreSQL schema.
require('dotenv').config();

const SCHEMA = process.env.DB_SCHEMA || 'reach_for_the_stars';

// { tableName, schema } object that Sequelize understands everywhere
const table = (name) => ({ tableName: name, schema: SCHEMA });

module.exports = { SCHEMA, table };
