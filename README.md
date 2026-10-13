# Reach for the Stars API

CS 313 Library Game Hub. **Node.js + Express + PostgreSQL + Sequelize.** Follows Hub Contract v1.

## The team stack

| Layer | We all use | Its job |
|---|---|---|
| Runtime | Node.js 22 LTS or newer | Runs JavaScript outside the browser |
| Framework | Express 5 | Receives requests, sends responses |
| Database | PostgreSQL 16 or newer | Stores rows, enforces constraints |
| ORM and migrations | Sequelize 6 with sequelize-cli | Builds tables, reads and writes rows |
| Version control | Git and GitHub | Branches, pull requests, history |
| API client | Postman | Sends test requests until SE2 builds the UI |

## Setup
1. Install Node.js 22 LTS or newer (`node -v` to check) and make sure PostgreSQL 16+ is running
   (Services > postgresql-x64-xx > Running).
2. In pgAdmin, create a database named `reach_for_the_stars`.
3. Copy `.env.example` to `.env`. Fill in `DB_PASSWORD`, `JWT_SECRET`, `TEAM_NAME`.
4. Install packages:  `npm install`
5. Build the tables (runs the files in `migrations/`):  `npm run migrate`
6. Create a host account:  `npm run create-host`

## Run
    npm run dev        (restarts automatically when you save a file)
    npm start          (plain start)

The API listens on http://localhost:3001. Test it with Postman: import
`docs/Reach_for_the_Stars.postman_collection.json` and run the requests from top to bottom
(set the `username` and `password` collection variables to your host account first).
Login, Create session, Join and Next question save their tokens and ids into collection variables for you.

## Database commands (sequelize-cli)
    npm run migrate              run all new migrations
    npm run migrate:undo         undo the last migration
    npm run migrate:undo:all     drop everything this project created
    npx sequelize-cli migration:generate --name add-something    make a new migration

Never edit a migration that is already pushed. Add a new one instead.
If you already built the tables with the old `docs/schema.sql`, drop the `reach_for_the_stars`
schema first (`DROP SCHEMA reach_for_the_stars CASCADE;`), then run `npm run migrate`.

## How a game works
1. Host logs in, creates a question set, then a session (gets a 6-digit join code).
2. Players join with a nickname (no account) and get a player token.
3. Host starts the session (PATCH status=playing). The round timer starts.
4. Each player: GET next question, POST answer, repeat.
   Every 5th correct answer in a row offers 3 mystery chests: POST a chest pick.
5. Host ends the session (or time runs out). Leaderboard stays saved.

## Endpoints (all start with /api/v1)
| Verb | URL | What it does | Token | Success | Errors |
|---|---|---|---|---|---|
| GET | /game-info | Hub reads game details | No | 200 | 500 |
| GET | /health | API and database check | No | 200 | 503 |
| POST | /auth/login | Host logs in | No | 200 | 400, 401 |
| POST | /question-sets | Create a question set | Host | 201 | 400, 401 |
| GET | /question-sets | List my sets | Host | 200 | 401 |
| GET | /question-sets/{id} | Read one set (with answers) | Host | 200 | 401, 403, 404 |
| PUT | /question-sets/{id} | Replace a set | Host | 200 | 400, 401, 403, 404, 409 |
| DELETE | /question-sets/{id} | Delete a set | Host | 200 | 401, 403, 404, 409 |
| POST | /sessions | Start a game, get join code | Host | 201 | 400, 401, 403, 404 |
| GET | /sessions | List my games | Host | 200 | 401 |
| GET | /sessions/{code} | Game status | No | 200 | 404 |
| PATCH | /sessions/{code} | Start or end a game | Host | 200 | 400, 401, 403, 404, 409 |
| POST | /sessions/{code}/players | Player joins | No | 201 | 400, 404, 409 |
| GET | /sessions/{code}/players/me | My stars, lives, streak, rank | Player | 200 | 401, 403, 404 |
| GET | /sessions/{code}/questions/next | Next question (no answer) | Player | 200 | 401, 403, 404, 409 |
| POST | /sessions/{code}/answers | Submit an answer | Player | 201 | 400, 401, 403, 404, 409 |
| POST | /sessions/{code}/chests | Open a mystery chest | Player | 201 | 400, 401, 403, 404, 409 |
| GET | /sessions/{code}/leaderboard | Ranking | No | 200 | 404 |

## Game rules (change them in src/rules.js)
- Correct answer: 10 stars. Streak of 3-4: x1.5. Streak of 5 or more: x2.
- Wrong answer or timeout: lose 1 life, lose 5 stars (not below 0), streak resets.
- Every 5th correct answer in a row: 3 chests (Double Star, Protection Card, Empty), shuffled.
  Pick one. Unopened chests expire after 30 seconds and block the next question until then.
- Double Star: next correct answer earns 2x stars.
- Protection Card: next wrong answer costs no stars and keeps the streak (the life is still lost).
- Out of lives: the player is finished. Session time runs out: the game ends.
- Rank: most stars, then most correct answers, then fastest average answer time.
- Start: 3 lives, 5 minutes, up to 30 players (host can change lives and time).

## Error codes
SESSION_NOT_FOUND, SESSION_ENDED, SESSION_NOT_STARTED, SESSION_FULL, NICKNAME_TAKEN,
NICKNAME_NOT_ALLOWED, QUESTION_SET_NOT_FOUND, NOT_YOUR_QUESTION_SET, NOT_YOUR_SESSION,
QUESTION_SET_IN_USE, QUESTION_NOT_ACTIVE, ALREADY_ANSWERED, INVALID_STATUS_CHANGE, PLAYER_OUT_OF_LIVES,
CHEST_PENDING, CHEST_NOT_FOUND, CHEST_ALREADY_OPENED, CHEST_EXPIRED, WRONG_SESSION, plus the shared
AUTH_REQUIRED, INVALID_CREDENTIALS, VALIDATION_FAILED, FORBIDDEN, NOT_FOUND, SERVER_ERROR, DATABASE_DOWN.

## Folder map
    server.js                 start here (npm run dev)
    src/app.js                Express app, CORS, routes, error handler
    src/routes/               all endpoints (controllers)
    src/services/             game rules and checks
    src/repositories/         all database access (Sequelize + SQL) lives here
    src/models/               Sequelize models
    src/rules.js              numbers for stars, lives, chests
    migrations/               sequelize-cli migrations (build the tables)
    config/                   database settings for sequelize-cli and the app
    scripts/createHost.js     create a host account
    docs/                     Postman collection + the old schema.sql for reference
