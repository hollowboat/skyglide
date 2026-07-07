// ============ AUTH ============

const AuthState = {
  isLoggedIn: false,
  uid: null,
  displayName: null
};

function tierForSkin(skinLevel) {
  if (skinLevel >= 10) return "Elite";
  if (skinLevel >= 7) return "Master";
  if (skinLevel >= 4) return "Star";
  return "Basic";
}

async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    await mergeLocalDataToFirebase(result.user);
    return true;
  } catch (err) {
    console.error("Login failed:", err.code, err.message);
    alert("Login failed. Please try again.");
    return false;
  }
}

async function mergeLocalDataToFirebase(user) {
  const local = {
    highScore: LocalState.getHighScore(),
    coins: LocalState.getCoins(),
    unlockedSkins: LocalState.getUnlockedSkins()
  };

  const snap = await db.ref(`users/${user.uid}`).get();
  const remote = snap.exists() ? snap.val() : null;

  const merged = {
    displayName: user.displayName || "Player",
    highScore: Math.max(local.highScore, remote?.highScore || 0),
    coins: Math.max(local.coins, remote?.coins || 0),
    unlockedSkins: Math.max(local.unlockedSkins, remote?.unlockedSkins || 1),
    lastUpdated: Date.now()
  };
  merged.tier = tierForSkin(merged.unlockedSkins);

  await db.ref(`users/${user.uid}`).set(merged);

  // Push to public leaderboard mirror (qualification-checked + trimmed)
  await submitToLeaderboard(user.uid, merged.displayName, merged.highScore, merged.tier);

  // Sync merged values back down to localStorage
  LocalState.setHighScore(merged.highScore);
  LocalState.setCoins(merged.coins);
  LocalState.setUnlockedSkins(merged.unlockedSkins);

  AuthState.isLoggedIn = true;
  AuthState.uid = user.uid;
  AuthState.displayName = merged.displayName;
}

function logout() {
  auth.signOut();
  AuthState.isLoggedIn = false;
  AuthState.uid = null;
  AuthState.displayName = null;
}

// Keep AuthState in sync if the SDK restores a previous session
auth.onAuthStateChanged((user) => {
  if (user) {
    AuthState.isLoggedIn = true;
    AuthState.uid = user.uid;
    AuthState.displayName = user.displayName || "Player";
  } else {
    AuthState.isLoggedIn = false;
    AuthState.uid = null;
    AuthState.displayName = null;
  }
});
