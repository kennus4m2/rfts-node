const rules = require('../rules');
const { transaction } = require('../db');
const { AppError } = require('../errors');
const game = require('../repositories/gameplayRepository');
const players = require('../repositories/playerRepository');
const sessionService = require('./sessionService');

const REWARD_MESSAGES = {
  double_star: 'Double Star! Your next correct answer earns 2x stars.',
  protection_card: 'Protection Card! Your next wrong answer will not cost stars or break your streak.',
  empty: 'Better luck next time! This chest was empty.',
};

async function context(code, who, t, lockPlayer = true) {
  const session = await sessionService.load(code, t);
  if (who.session_id !== session.id) {
    throw new AppError(403, 'WRONG_SESSION', 'Your player token is for a different game.');
  }
  const player = await players.get(who.player_id, t, lockPlayer);
  if (!player) throw new AppError(401, 'AUTH_REQUIRED', 'This player no longer exists. Please join again.');
  return { session, player };
}

function requirePlaying(session) {
  if (session.status === 'ended') throw new AppError(409, 'SESSION_ENDED', 'This game has ended.');
  if (session.status === 'waiting') throw new AppError(409, 'SESSION_NOT_STARTED', 'The host has not started the game yet.');
}

/** An unopened chest blocks the next question until it is opened or expires. */
async function handlePendingChest(player, t) {
  const chest = await game.pendingChest(player.id, t);
  if (!chest) return;
  if (chest.expired) await game.markChest(chest.id, 'expired', null, t);
  else throw new AppError(409, 'CHEST_PENDING', 'Open your mystery chest first.');
}

// ---------- player state ----------

const me = (code, who) =>
  transaction(async (t) => {
    const { session, player } = await context(code, who, t, false);
    const ranked = await players.getRanked(session.id, player.id, t);
    return {
      nickname: player.nickname,
      stars: player.stars,
      lives: player.lives,
      streak: player.current_streak,
      best_streak: player.best_streak,
      correct_count: player.correct_count,
      double_star_ready: player.double_star_ready,
      protection_ready: player.protection_ready,
      rank: ranked.rank,
      session_status: session.status,
      seconds_left: session.seconds_left,
    };
  });

// ---------- questions ----------

const nextQuestion = (code, who) =>
  transaction(async (t) => {
    const { session, player } = await context(code, who, t);
    requirePlaying(session);
    if (player.lives <= 0) return { finished: true, reason: 'out_of_lives' };
    await handlePendingChest(player, t);

    const q = await game.nextQuestion(session.question_set_id, player.id, t);
    if (!q) return { finished: true, reason: 'no_more_questions' };

    // The timer starts the first time a question is served. Asking again does not restart it.
    if (player.current_question_id !== q.id) await players.setCurrentQuestion(player.id, q.id, t);

    return {
      finished: false,
      question: {
        id: q.id,
        number: q.position,
        total: await game.countQuestions(session.question_set_id, t),
        text: q.text,
        type: q.type,
        choices: await game.getChoices(q.id, t), // no correct answer
        time_limit_sec: q.time_limit_sec,
      },
    };
  });

// ---------- answers ----------

const submitAnswer = (code, who, body) =>
  transaction(async (t) => {
    const { session, player } = await context(code, who, t);
    requirePlaying(session);
    if (player.lives <= 0) throw new AppError(409, 'PLAYER_OUT_OF_LIVES', 'You have no lives left.');
    await handlePendingChest(player, t);

    if (player.current_question_id !== body.question_id || player.question_served_at === null) {
      throw new AppError(409, 'QUESTION_NOT_ACTIVE', 'Ask for the question first, then answer it.');
    }
    if (await game.alreadyAnswered(player.id, body.question_id, t)) {
      throw new AppError(409, 'ALREADY_ANSWERED', 'You already answered this question.');
    }

    const question = await game.getQuestion(body.question_id, t);
    const choice = await game.getChoice(body.question_id, body.choice_index, t);
    if (!choice) throw new AppError(400, 'VALIDATION_FAILED', 'choice_index: that choice does not exist for this question.');

    // The server measures the time, never the player's device
    const limitMs = question.time_limit_sec * 1000;
    const elapsed = await players.elapsedMs(player.id, t);
    const late = elapsed > limitMs + rules.ANSWER_GRACE_MS;
    const correct = Boolean(choice.is_correct) && !late;

    let result, lives, doubleReady, protectionReady;
    if (correct) {
      result = rules.scoreCorrect(player.stars, player.current_streak, player.double_star_ready);
      lives = player.lives;
      doubleReady = false;
      protectionReady = player.protection_ready;
    } else {
      result = rules.scoreWrong(player.stars, player.current_streak, player.protection_ready);
      lives = player.lives - 1; // a wrong answer or timeout always costs a life
      doubleReady = player.double_star_ready;
      protectionReady = result.protection_used ? false : player.protection_ready;
    }

    const timeMs = Math.min(elapsed, limitMs);
    const answerId = await game.insertAnswer(
      {
        playerId: player.id, questionId: body.question_id, choiceId: late ? null : choice.id,
        isCorrect: correct, timeMs, starsChange: result.stars_change, streakAfter: result.streak,
        doubleStarUsed: result.double_star_used, protectionUsed: result.protection_used,
      },
      t
    );
    await players.updateAfterAnswer(
      player.id,
      { stars: result.stars, lives, streak: result.streak, correct, timeMs, doubleStarReady: doubleReady, protectionReady },
      t
    );

    let chest = null;
    if (correct && rules.chestEarned(result.streak)) {
      const offerId = await game.createChest(answerId, player.id, rules.makeChestSlots(), t);
      chest = { chest_offer_id: offerId, chests: rules.CHEST_COUNT, expires_in_sec: rules.CHEST_TIMEOUT_SEC };
    }

    let finishedReason = null;
    if (lives <= 0) finishedReason = 'out_of_lives';
    else if ((await game.remainingQuestions(session.question_set_id, player.id, t)) === 0) finishedReason = 'no_more_questions';

    const ranked = await players.getRanked(session.id, player.id, t);
    return {
      correct,
      timed_out: late,
      stars_change: result.stars_change,
      stars: result.stars,
      streak: result.streak,
      lives,
      double_star_used: result.double_star_used,
      protection_used: result.protection_used,
      rank: ranked.rank,
      chest_offer: chest,
      finished: finishedReason !== null,
      finished_reason: finishedReason,
    };
  });

// ---------- chests ----------

const openChest = (code, who, body) =>
  transaction(async (t) => {
    const { session, player } = await context(code, who, t);
    if (session.status === 'ended') throw new AppError(409, 'SESSION_ENDED', 'This game has ended.');

    const chest = await game.getChest(body.chest_offer_id, player.id, t);
    if (!chest) throw new AppError(404, 'CHEST_NOT_FOUND', 'No chest with that id.');
    if (chest.status === 'opened') throw new AppError(409, 'CHEST_ALREADY_OPENED', 'You already opened this chest.');
    if (chest.status === 'expired' || chest.expired) throw new AppError(409, 'CHEST_EXPIRED', 'This chest expired.');

    const reward = await game.getSlotReward(chest.id, body.slot_number, t);
    await game.markChest(chest.id, 'opened', body.slot_number, t);
    if (reward === 'double_star') await players.setReadyFlag(player.id, 'double_star_ready', t);
    else if (reward === 'protection_card') await players.setReadyFlag(player.id, 'protection_ready', t);

    const fresh = await players.get(player.id, t);
    return {
      reward,
      message: REWARD_MESSAGES[reward],
      double_star_ready: fresh.double_star_ready,
      protection_ready: fresh.protection_ready,
    };
  });

// ---------- leaderboard ----------

const leaderboard = (code) =>
  transaction(async (t) => {
    const session = await sessionService.load(code, t);
    const rows = await players.leaderboard(session.id, t);
    return {
      join_code: session.join_code,
      status: session.status,
      seconds_left: session.seconds_left,
      players: rows.map((r) => ({
        rank: r.rank, nickname: r.nickname, stars: r.stars,
        correct_count: r.correct_count, best_streak: r.best_streak, lives: r.lives,
      })),
    };
  });

module.exports = { me, nextQuestion, submitAnswer, openChest, leaderboard };
