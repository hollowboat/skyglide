// ============ SKINS ============

// Prices: Level1 free, Level2 = 20, Level3 = 30, ... Level12 = 300
// (i.e. Level(N) costs (N-1)*10 coins, for N from 2 to 12)
const SKINS = Array.from({ length: 12 }, (_, i) => {
  const level = i + 1;
  return {
    level,
    file: `images/Level${level}.png`,
    price: level === 1 ? 0 : (level - 1) * 10,
    tier: tierForSkin(level)
  };
});

function getSkinTierLabel(level) {
  if (level >= 10) return "Elite";
  if (level >= 7) return "Master";
  if (level >= 4) return "Star";
  return "Basic";
}

/**
 * Attempts to unlock the next skin in sequence.
 * Skins must be unlocked strictly in order (2 -> 3 -> ... -> 12).
 */
function tryUnlockNextSkin() {
  const unlocked = LocalState.getUnlockedSkins();
  const nextLevel = unlocked + 1;
  if (nextLevel > 12) return { success: false, reason: "All skins already unlocked" };

  const skin = SKINS[nextLevel - 1];
  const coins = LocalState.getCoins();

  if (coins < skin.price) {
    return { success: false, reason: "Not enough coins" };
  }

  LocalState.setCoins(coins - skin.price);
  LocalState.setUnlockedSkins(nextLevel);

  syncProgressToFirebaseIfLoggedIn();

  return { success: true, unlockedLevel: nextLevel };
}

function equipSkin(level) {
  if (level > LocalState.getUnlockedSkins()) return false;
  LocalState.setCurrentSkin(level);
  return true;
}

/** Push current coins/unlockedSkins (and derived tier) to Firebase if logged in. */
async function syncProgressToFirebaseIfLoggedIn() {
  if (!AuthState.isLoggedIn || !AuthState.uid) return;

  const unlockedSkins = LocalState.getUnlockedSkins();
  const coins = LocalState.getCoins();
  const tier = tierForSkin(unlockedSkins);

  await db.ref(`users/${AuthState.uid}`).update({
    coins,
    unlockedSkins,
    tier,
    lastUpdated: Date.now()
  });
}
