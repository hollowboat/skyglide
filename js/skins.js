// ============ SKINS ============

// Prices: Level1 free, Level2 = 20, Level3 = 30, ... Level12 = 300
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
 *
 * If logged in: the Cloud Function is the source of truth — it verifies
 * coin balance and sequential order server-side in a transaction, so the
 * client can't unlock skins it hasn't paid for no matter what it sends.
 *
 * If NOT logged in: falls back to local-only bookkeeping (there's no
 * server to validate against yet), synced/re-validated on next login via
 * mergeGuestProgress.
 */
async function tryUnlockNextSkin() {
  if (AuthState.isLoggedIn) {
    try {
      const response = await callUnlockSkin();
      const { coins, unlockedSkins } = response.data;
      LocalState.setCoins(coins);
      LocalState.setUnlockedSkins(unlockedSkins);
      return { success: true, unlockedLevel: unlockedSkins };
    } catch (err) {
      console.error("Unlock failed:", err.code, err.message);
      return { success: false, reason: err.message || "Unlock not available" };
    }
  }

  // Guest fallback (local-only, capped and re-validated on login)
  const unlocked = LocalState.getUnlockedSkins();
  const nextLevel = unlocked + 1;
  if (nextLevel > 12) return { success: false, reason: "All skins already unlocked" };

  const skin = SKINS[nextLevel - 1];
  const coins = LocalState.getCoins();
  if (coins < skin.price) return { success: false, reason: "Not enough coins" };

  LocalState.setCoins(coins - skin.price);
  LocalState.setUnlockedSkins(nextLevel);
  return { success: true, unlockedLevel: nextLevel };
}

function equipSkin(level) {
  if (level > LocalState.getUnlockedSkins()) return false;
  LocalState.setCurrentSkin(level);
  return true;
}
