// ============ LEADERBOARD ============

const LEADERBOARD_MAX = 30;

/**
 * Call after a player's highscore updates (while logged in).
 * Handles qualification check, write, and trimming down to top 30.
 */
async function submitToLeaderboard(uid, displayName, score, tier) {
  const leaderboardRef = db.ref("leaderboard");
  const snap = await leaderboardRef.get();
  const entries = [];
  snap.forEach(child => { entries.push({ uid: child.key, ...child.val() }); });

  const alreadyOnBoard = entries.some(e => e.uid === uid);
  const isFull = entries.length >= LEADERBOARD_MAX;

  if (isFull && !alreadyOnBoard) {
    const lowest = entries.reduce((min, e) => (e.score < min.score ? e : min), entries[0]);
    if (score <= lowest.score) {
      return { qualified: false, reason: "Score too low for Top 30" };
    }
  }

  await db.ref(`leaderboard/${uid}`).set({ displayName, score, tier });
  await trimLeaderboard();

  return { qualified: true };
}

/** Ensures /leaderboard never holds more than LEADERBOARD_MAX entries. */
async function trimLeaderboard() {
  const snap = await db.ref("leaderboard").get();
  const entries = [];
  snap.forEach(child => { entries.push({ uid: child.key, score: child.val().score }); });

  if (entries.length <= LEADERBOARD_MAX) return;

  entries.sort((a, b) => a.score - b.score); // ascending, lowest first
  const overflowCount = entries.length - LEADERBOARD_MAX;
  const toRemove = entries.slice(0, overflowCount);

  await Promise.all(toRemove.map(e => db.ref(`leaderboard/${e.uid}`).remove()));
}

/** One-time fetch of the Top 30, sorted highest score first. */
async function getTop30() {
  const q = db.ref("leaderboard").orderByChild("score").limitToLast(LEADERBOARD_MAX);
  const snap = await q.get();
  const rows = [];
  snap.forEach(child => rows.push({ uid: child.key, ...child.val() }));
  rows.reverse();
  return rows;
}

/**
 * Returns HUD/game-over text describing how far the player is from
 * entering the Top 30, or from beating the next rank up.
 * Cache the Top 30 list once per run and pass currentScore each frame/update.
 */
function getRankProgressFromCache(entries, currentScore) {
  if (entries.length < LEADERBOARD_MAX) {
    const remaining = LEADERBOARD_MAX - entries.length;
    return {
      inTop30: true,
      message: entries.length === 0
        ? "Be the first on the Top 30 Leaderboard!"
        : `Leaderboard has ${remaining} open spot(s) — you're in range!`
    };
  }

  // entries assumed sorted descending (rank 1 first)
  for (let i = entries.length - 1; i >= 0; i--) {
    if (currentScore < entries[i].score) {
      const pointsNeeded = entries[i].score - currentScore + 1;
      const rank = i + 1;
      if (rank === LEADERBOARD_MAX) {
        return { inTop30: false, message: `${pointsNeeded} points away from entering the Top 30 Leaderboard` };
      }
      return { inTop30: true, message: `${pointsNeeded} points away from beating #${rank} ${entries[i].displayName}` };
    }
  }

  return { inTop30: true, message: "You're #1!" };
}
