// ============ UI / SCREEN MANAGEMENT ============

const UI = {
  currentTop30: [],  // cached once per run for the ego tracker

  showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  },

  // ---------- Opening screen ----------
  async goToOpening() {
    this.showScreen("screen-opening");
  },

  // ---------- Skins screen ----------
  async goToSkins() {
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
          if (result.success) {
            this.renderSkinsGrid();
          } else {
            alert(result.reason);
          }
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
  async startGame() {
    this.showScreen("screen-game");

    // Cache leaderboard once per run for the HUD ego tracker (avoids live listener errors)
    try {
      this.currentTop30 = await getTop30();
    } catch (err) {
      console.error("Could not load leaderboard for HUD:", err);
      this.currentTop30 = [];
    }

    document.getElementById("hud-score").textContent = "0";
    document.getElementById("hud-ego-tracker").textContent = "";

    Game.onScoreUpdate = (score) => {
      document.getElementById("hud-score").textContent = score;
      const progress = getRankProgressFromCache(this.currentTop30, score);
      document.getElementById("hud-ego-tracker").textContent = progress.message || "";
    };

    Game.onGameOver = (finalScore, coinsEarned) => this.handleGameOver(finalScore, coinsEarned);

    const canvas = document.getElementById("game-canvas");
    if (!Game.canvas) Game.init(canvas);
    Game.start(LocalState.getCurrentSkin());

    canvas.onclick = () => Game.flap();
  },

  // ---------- Game over screen ----------
  async handleGameOver(finalScore, coinsEarned) {
    const newCoins = LocalState.getCoins() + coinsEarned;
    LocalState.setCoins(newCoins);

    const priorHigh = LocalState.getHighScore();
    const isNewHigh = finalScore > priorHigh;
    if (isNewHigh) LocalState.setHighScore(finalScore);
    const highScore = LocalState.getHighScore();

    document.getElementById("go-coins").textContent = newCoins;
    document.getElementById("go-score").textContent = finalScore;
    document.getElementById("go-highscore").textContent = highScore;

    const progress = getRankProgressFromCache(this.currentTop30, highScore);
    const reachedTop30 = progress.inTop30;

    const loginShout = document.getElementById("go-login-shout");
    const rankProgressEl = document.getElementById("go-rank-progress");
    const thirdBtn = document.getElementById("btn-leaderboard-or-login");

    if (AuthState.isLoggedIn) {
      loginShout.classList.add("hidden");
      rankProgressEl.textContent = progress.message || "";

      if (isNewHigh) {
        await submitToLeaderboard(AuthState.uid, AuthState.displayName, highScore, tierForSkin(LocalState.getUnlockedSkins()));
      }
      await syncProgressToFirebaseIfLoggedIn();

      thirdBtn.textContent = "LEADERBOARD";
      thirdBtn.onclick = () => this.goToLeaderboard();
    } else {
      rankProgressEl.textContent = "";
      if (reachedTop30) {
        loginShout.classList.remove("hidden");
      } else {
        loginShout.classList.add("hidden");
      }
      thirdBtn.textContent = "LOGIN FOR LEADERBOARD";
      thirdBtn.onclick = () => this.attemptLogin();
    }

    this.showScreen("screen-gameover");
  },

  async attemptLogin() {
    const success = await loginWithGoogle();
    if (success) {
      // Refresh game-over screen state now that we're logged in
      this.handleGameOver(Number(document.getElementById("go-score").textContent), 0);
    }
  },

  // ---------- Leaderboard screen ----------
  async goToLeaderboard() {
    const tbody = document.getElementById("leaderboard-body");
    tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
    this.showScreen("screen-leaderboard");

    try {
      const top30 = await getTop30();
      tbody.innerHTML = "";
      top30.forEach((entry, i) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${i + 1}</td>
          <td>${escapeHtml(entry.displayName)}<span class="tier-badge">(${escapeHtml(entry.tier)})</span></td>
          <td>${entry.score}</td>
        `;
        tbody.appendChild(row);
      });
      if (top30.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3'>No scores yet — be the first!</td></tr>";
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      tbody.innerHTML = "<tr><td colspan='3'>Could not load leaderboard. Please try again.</td></tr>";
    }
  }
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
