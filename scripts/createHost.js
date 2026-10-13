/**
 * Create a host account. Run from the project root:
 *
 *     npm run create-host
 */
require('dotenv').config();
const readline = require('readline');
const { transaction, sequelize } = require('../src/db');
const hostRepository = require('../src/repositories/hostRepository');
const { hashPassword } = require('../src/security');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
const originalWrite = rl._writeToOutput.bind(rl);
rl._writeToOutput = (text) => { if (!muted) originalWrite(text); };

const ask = (question, hidden = false) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
    muted = hidden;
  });

(async () => {
  const username = (await ask('Host username: ')).trim();
  const displayName = (await ask('Display name: ')).trim();
  const password = await ask('Password: ', true);
  rl.close();

  if (!username || !displayName || password.length < 8) {
    console.error('Username and name are required, and the password needs 8+ characters.');
    process.exit(1);
  }

  try {
    const hostId = await transaction(async (t) =>
      hostRepository.create(username, await hashPassword(password), displayName, t)
    );
    console.log(`Host created with id ${hostId}`);
  } catch (e) {
    console.error(`Could not create host: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
