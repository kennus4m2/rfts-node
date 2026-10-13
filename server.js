/** Start the API with:  npm run dev   (or: npm start) */
require('dotenv').config();
const app = require('./src/app');

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 3001);

app.listen(port, host, () => {
  console.log(`Reach for the Stars API listening on http://${host}:${port}`);
});
