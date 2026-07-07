// ============ LEADERBOARD (read-only client side) ============
// Writing to /leaderboard is done exclusively by Cloud Functions now
// (submitScore, mergeGuestProgress) — the client only ever reads here.

const LEADERBOARD_MAX = 30;

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
 * Pass a cached Top 30 snapshot (fetched once per run) plus the current score.
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
