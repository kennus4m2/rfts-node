const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./errors');

const app = express();
app.disable('x-powered-by');

// Hub Contract: allow CORS from the hub's address only. Set CORS_ORIGINS in .env
const origins = (process.env.CORS_ORIGINS || 'http://localhost')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

app.use(express.json());

// If the hub does NOT remove /games/reach-for-the-stars before forwarding to
// your port, set API_PREFIX=/games/reach-for-the-stars in .env
const PREFIX = (process.env.API_PREFIX || '').replace(/\/+$/, '') + '/api/v1';
app.use(PREFIX, routes);

// The 400 x 300 PNG that game-info points to.
const THUMBNAIL = path.join(__dirname, 'assets', 'thumbnail.png');
app.get(['/thumbnail.png', '/games/reach-for-the-stars/thumbnail.png'], (req, res) => {
  res.type('image/png').sendFile(THUMBNAIL);
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
