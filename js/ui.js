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
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = "...";
          const result = await tryUnlockNextSkin();
          if (result.success) {
            this.renderSkinsGrid();
          } else {
            alert(result.reason);
            this.renderSkinsGrid();
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

    // Stamp a server-side run start time so submitScore can validate
    // elapsed time later. Guests (not logged in) skip this — their
    // scores only ever live locally until they log in and get re-merged.
    if (AuthState.isLoggedIn) {
      try {
        await callStartRun();
      } catch (err) {
        console.error("Could not start server-tracked run:", err);
      }
    }

    // Cache leaderboard once per run for the HUD ego tracker
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
  async handleGameOver(finalScore, coinsEarnedLocalEstimate) {
    document.getElementById("go-score").textContent = finalScore;

    let coins, highScore;

    if (AuthState.isLoggedIn) {
      // Server is authoritative: it validates finalScore against elapsed
      // server-clock time, then returns the REAL updated coins/highScore.
      try {
        const response = await callSubmitScore({ score: finalScore });
        coins = response.data.coins;
        highScore = response.data.highScore;
        LocalState.setCoins(coins);
        LocalState.setHighScore(highScore);
      } catch (err) {
        console.error("Score submission rejected:", err.code, err.message);
        // Fall back to displaying prior known-good local values —
        // we do NOT locally credit coins/highscore the server rejected.
        coins = LocalState.getCoins();
        highScore = LocalState.getHighScore();
      }
    } else {
      // Guest mode: no server to validate against, so we track locally.
      // This progress gets re-validated (capped) on first login.
      coins = LocalState.getCoins() + coinsEarnedLocalEstimate;
      LocalState.setCoins(coins);
      if (finalScore > LocalState.getHighScore()) LocalState.setHighScore(finalScore);
      highScore = LocalState.getHighScore();
    }

    document.getElementById("go-coins").textContent = coins;
    document.getElementById("go-highscore").textContent = highScore;

    const progress = getRankProgressFromCache(this.currentTop30, highScore);
    const reachedTop30 = progress.inTop30;

    const loginShout = document.getElementById("go-login-shout");
    const rankProgressEl = document.getElementById("go-rank-progress");
    const thirdBtn = document.getElementById("btn-leaderboard-or-login");

    if (AuthState.isLoggedIn) {
      loginShout.classList.add("hidden");
      rankProgressEl.textContent = progress.message || "";
      thirdBtn.textContent = "LEADERBOARD";
      thirdBtn.onclick = () => this.goToLeaderboard();
    } else {
      rankProgressEl.textContent = "";
      loginShout.classList.toggle("hidden", !reachedTop30);
      thirdBtn.textContent = "LOGIN FOR LEADERBOARD";
      thirdBtn.onclick = () => this.attemptLogin();
    }

    this.showScreen("screen-gameover");
  },

  async attemptLogin() {
    const success = await loginWithGoogle();
    if (success) {
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
