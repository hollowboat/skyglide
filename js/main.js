// ============ MAIN / EVENT WIRING ============

document.addEventListener("DOMContentLoaded", () => {

  // Opening screen
  document.getElementById("btn-start").addEventListener("click", () => UI.startGame());
  document.getElementById("btn-skins").addEventListener("click", () => UI.goToSkins());
  document.getElementById("btn-google-login-opening").addEventListener("click", () => loginWithGoogle());

  // Skins screen
  document.getElementById("btn-skins-back").addEventListener("click", () => UI.goToOpening());

  // Game over screen
  document.getElementById("btn-retry").addEventListener("click", () => UI.startGame());
  document.getElementById("btn-change-skin").addEventListener("click", () => UI.goToSkins());
  document.getElementById("btn-google-login-gameover").addEventListener("click", () => UI.attemptLogin());

  // Leaderboard screen
  document.getElementById("btn-leaderboard-back").addEventListener("click", () => UI.goToOpening());

  UI.goToOpening();
});
