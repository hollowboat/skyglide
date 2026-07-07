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

// Merging is done server-side (mergeGuestProgress Cloud Function) so the
// client can't hand over an inflated localStorage value and have it
// trusted verbatim beyond a fixed cap enforced on the server.
async function mergeLocalDataToFirebase(user) {
  const local = {
    highScore: LocalState.getHighScore(),
    coins: LocalState.getCoins(),
    unlockedSkins: LocalState.getUnlockedSkins()
  };

  const response = await callMergeGuestProgress(local);
  const merged = response.data;

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
