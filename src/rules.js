/** Game rules for Reach for the Stars. Change the numbers here, nowhere else. */

// Hub limits (also reported by GET /game-info)
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 30;

// Session defaults (a host can override them when creating a session)
const DEFAULT_LIVES = 3;
const DEFAULT_DURATION_SEC = 300;

// Stars
const BASE_STARS = 10;      // stars for one correct answer before multipliers
const WRONG_PENALTY = 5;    // stars lost on a wrong answer or timeout (never below 0)

// Mystery chests
const CHEST_EVERY = 5;      // a chest appears on every 5th correct answer in a row
const CHEST_COUNT = 3;
const CHEST_TIMEOUT_SEC = 30; // unopened chests expire after this long
const REWARDS = ['double_star', 'protection_card', 'empty'];

// The server allows a little extra time for network delay
const ANSWER_GRACE_MS = 2000;

/** Score multiplier for streak answers. */
function streakMultiplier(streak) {
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

function scoreCorrect(stars, streak, doubleStarReady) {
  const newStreak = streak + 1;
  let earned = Math.round(BASE_STARS * streakMultiplier(newStreak));
  if (doubleStarReady) earned *= 2;
  return {
    stars_change: earned,
    stars: stars + earned,
    streak: newStreak,
    double_star_used: doubleStarReady,
    protection_used: false,
  };
}

/**
 * A wrong answer always costs one life (the caller handles lives).
 * A Protection Card saves the stars and the streak.
 */
function scoreWrong(stars, streak, protectionReady) {
  if (protectionReady) {
    return { stars_change: 0, stars, streak, double_star_used: false, protection_used: true };
  }
  const lost = Math.min(stars, WRONG_PENALTY);
  return { stars_change: -lost, stars: stars - lost, streak: 0, double_star_used: false, protection_used: false };
}

function chestEarned(streakAfter) {
  return streakAfter > 0 && streakAfter % CHEST_EVERY === 0;
}

/** One of each reward, shuffled across the 3 chests (Fisher-Yates). */
function makeChestSlots() {
  const slots = [...REWARDS];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

module.exports = {
  MIN_PLAYERS, MAX_PLAYERS, DEFAULT_LIVES, DEFAULT_DURATION_SEC,
  BASE_STARS, WRONG_PENALTY, CHEST_EVERY, CHEST_COUNT, CHEST_TIMEOUT_SEC, REWARDS, ANSWER_GRACE_MS,
  streakMultiplier, scoreCorrect, scoreWrong, chestEarned, makeChestSlots,
};
