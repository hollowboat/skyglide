// ============ APP ============
// Screen/UI management and all event wiring — the DOM-facing half of the
// game (engine.js holds state/physics and has no DOM dependencies of its
// own besides reading a couple of #ids).

const UI = {
  skinsReturnTo: "screen-opening", // where "BACK" on the Skins screen goes

  showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  },

  // ---------- Opening screen ----------
  goToOpening() {
    this.showScreen("screen-opening");
  },

  // ---------- Skins screen ----------
  goToSkins(returnTo) {
    this.skinsReturnTo = returnTo || "screen-opening";
    this.renderSkinsGrid();
    this.showScreen("screen-skins");
  },

  renderSkinsGrid() {
    const grid = document.getElementById("skins-grid");
    grid.innerHTML = "";
    document.getElementById("skins-coin-count").textContent = LocalState.getCoins();

    const unlocked = LocalState.getUnlockedSkins();
    const current = LocalState.getCurrentSkin();
    const coins = LocalState.getCoins();

    SKINS.forEach(skin => {
      const isUnlocked = skin.level <= unlocked;
      const isNext = skin.level === unlocked + 1;
      const isEquipped = skin.level === current;

      const card = document.createElement("div");
      card.className = `skin-card ${isUnlocked ? "" : "locked"}`;

      const img = document.createElement("img");
      img.src = skin.file;
      card.appendChild(img);

      const name = document.createElement("div");
      name.className = "skin-name";
      name.textContent = `Level ${skin.level}`;
      card.appendChild(name);

      const tier = document.createElement("div");
      tier.className = "skin-tier";
      tier.textContent = skin.tier;
      card.appendChild(tier);

      const btn = document.createElement("button");
      btn.className = "unlock-btn";

      if (isEquipped) {
        btn.textContent = "EQUIPPED";
        btn.classList.add("equipped");
        btn.disabled = true;
      } else if (isUnlocked) {
        btn.textContent = "EQUIP";
        btn.disabled = false;
        btn.onclick = () => {
          equipSkin(skin.level);
          this.renderSkinsGrid();
        };
      } else if (isNext) {
        btn.textContent = `UNLOCK (${skin.price})`;
        const canAfford = coins >= skin.price;
        if (canAfford) btn.classList.add("affordable");
        btn.disabled = !canAfford;
        btn.onclick = () => {
          const result = tryUnlockNextSkin();
          if (!result.success) alert(result.reason);
          this.renderSkinsGrid();
        };
      } else {
        btn.textContent = "LOCKED";
        btn.disabled = true;
      }

      card.appendChild(btn);
      grid.appendChild(card);
    });
  },

  // ---------- Game screen ----------
  startGame() {
    this.showScreen("screen-game");

    document.getElementById("hud-score").textContent = "0";

    Game.onScoreUpdate = (score) => {
      document.getElementById("hud-score").textContent = score;
    };

    Game.onGameOver = (finalScore, coinsEarned) => this.handleGameOver(finalScore, coinsEarned);

    const canvas = document.getElementById("game-canvas");
    if (!Game.canvas) {
      Game.init(canvas);
      // pointerdown unifies mouse clicks (laptop) and taps (phone/tablet)
      // in a single listener with no extra input lag.
      canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        Game.flap();
      });
    }
    Game.start(LocalState.getCurrentSkin());
  },

  // ---------- Game over screen ----------
  handleGameOver(finalScore, coinsEarnedThisRun) {
    document.getElementById("go-score").textContent = finalScore;

    const coins = LocalState.getCoins() + coinsEarnedThisRun;
    LocalState.setCoins(coins);
    if (finalScore > LocalState.getHighScore()) LocalState.setHighScore(finalScore);
    const highScore = LocalState.getHighScore();

    document.getElementById("go-coins").textContent = coins;
    document.getElementById("go-highscore").textContent = highScore;

    this.showScreen("screen-gameover");
  }
};

// ---------- Event wiring ----------
document.addEventListener("DOMContentLoaded", () => {

  // Opening screen
  document.getElementById("btn-play").addEventListener("click", () => UI.startGame());
  document.getElementById("btn-skins").addEventListener("click", () => UI.goToSkins("screen-opening"));
  document.getElementById("btn-exit").addEventListener("click", () => {
    if (confirm("Exit the game?")) {
      window.close();
      // Most browsers block scripts from closing a tab they didn't open —
      // if we're still here a moment later, let the player know what to do.
      setTimeout(() => alert("You can close this tab now. Thanks for playing!"), 200);
    }
  });

  // Skins screen
  document.getElementById("btn-skins-back").addEventListener("click", () => UI.showScreen(UI.skinsReturnTo));

  // Game over screen
  document.getElementById("btn-retry").addEventListener("click", () => UI.startGame());
  document.getElementById("btn-change-skin").addEventListener("click", () => UI.goToSkins("screen-gameover"));

  UI.goToOpening();
});
