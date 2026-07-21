// ============ ENGINE ============
// Local storage, skins, and core game physics/rendering — everything that
// is NOT screen/DOM management (that lives in app.js).

// ---------- Local storage (all game state lives here) ----------
const STORAGE_KEYS = {
  coins: "coins",
  highScore: "highScore",
  unlockedSkins: "unlockedSkins",
  currentSkin: "currentSkin"
};

const LocalState = {
  getCoins() {
    return Number(localStorage.getItem(STORAGE_KEYS.coins)) || 0;
  },
  setCoins(value) {
    localStorage.setItem(STORAGE_KEYS.coins, String(value));
  },
  getHighScore() {
    return Number(localStorage.getItem(STORAGE_KEYS.highScore)) || 0;
  },
  setHighScore(value) {
    localStorage.setItem(STORAGE_KEYS.highScore, String(value));
  },
  getUnlockedSkins() {
    return Number(localStorage.getItem(STORAGE_KEYS.unlockedSkins)) || 1;
  },
  setUnlockedSkins(value) {
    localStorage.setItem(STORAGE_KEYS.unlockedSkins, String(value));
  },
  getCurrentSkin() {
    return Number(localStorage.getItem(STORAGE_KEYS.currentSkin)) || 1;
  },
  setCurrentSkin(value) {
    localStorage.setItem(STORAGE_KEYS.currentSkin, String(value));
  }
};

// ---------- Skins ----------
function tierForSkin(level) {
  if (level >= 10) return "Elite";
  if (level >= 7) return "Master";
  if (level >= 4) return "Star";
  return "Basic";
}

// Prices: Level1 free, Level2 = 10, Level3 = 20, ... Level12 = 110
const SKINS = Array.from({ length: 12 }, (_, i) => {
  const level = i + 1;
  return {
    level,
    file: `images/Level${level}.png`,
    price: level === 1 ? 0 : (level - 1) * 10,
    tier: tierForSkin(level)
  };
});

function tryUnlockNextSkin() {
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

// ---------- Core game (physics, collision, rendering) ----------
const Game = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,

  running: false,
  score: 0,
  coinsThisRun: 0,

  bird: { x: 0, y: 0, vy: 0, radius: 0 },
  pipes: [],

  // Internal resolution is 960x540. All motion below is expressed in
  // "units per 60fps-equivalent frame" and scaled by delta-time in
  // _update(), so the game plays at the same speed on a 60Hz laptop and a
  // 120/144Hz phone or gaming monitor.
  baseSpeed: 2.0,          // pipe speed for the first `speedBumpScore` pipes
  fastSpeed: 2.8,          // pipe speed after `speedBumpScore` — one gentle step up, not a constant ramp
  speedBumpScore: 30,
  speed: 2.0,
  basePipeGapX: 420,       // horizontal distance between pipe pairs
  pipeGapY: 230,           // vertical gap the bird flies through (much bigger than bird)
  pipeWidth: 100,
  lastPipeX: 0,

  gravity: 0.25,
  flapStrength: -6.2,
  maxFallSpeed: 8,         // terminal velocity cap so a long fall never feels like it's snowballing

  skinImage: null,

  onScoreUpdate: null,   // callback(score) — drives HUD score display
  onGameOver: null,      // callback(finalScore, coinsEarned)

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  },

  resize() {
    // Keep internal resolution fixed for consistent physics regardless of CSS scaling.
    this.width = 960;
    this.height = 540; // 16:9 internal resolution
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  },

  loadSkin(skinLevel) {
    const img = new Image();
    img.src = `images/Level${skinLevel}.png`;
    this.skinImage = img;
  },

  start(skinLevel) {
    this.loadSkin(skinLevel);

    this.score = 0;
    this.coinsThisRun = 0;
    this.speed = this.baseSpeed;
    this.pipes = [];
    this.lastPipeX = this.width + 100;

    this.bird = {
      x: this.width * 0.25,
      y: this.height / 2,
      vy: 0,
      radius: 28
    };

    this.running = true;
    this._spawnInitialPipes();
    // Grace period in real milliseconds (not frame count) so it lasts the
    // same amount of real time regardless of screen refresh rate.
    this._graceMs = 500;
    this._lastTimestamp = null;
    requestAnimationFrame((t) => this._loop(t));
  },

  flap() {
    if (!this.running) return;
    this.bird.vy = this.flapStrength;
  },

  _spawnInitialPipes() {
    let x = this.width + 260;
    for (let i = 0; i < 4; i++) {
      this._spawnPipe(x);
      x += this._currentPipeGapX();
    }
  },

  _currentPipeGapX() {
    const speedRatio = this.speed / this.baseSpeed;
    return this.basePipeGapX * speedRatio;
  },

  _spawnPipe(x) {
    const margin = 40;
    const gapCenter = margin + Math.random() * (this.height - margin * 2 - this.pipeGapY) + this.pipeGapY / 2;
    this.pipes.push({ x, gapCenter, passed: false });
  },

  _updateDifficulty(dt) {
    const targetSpeed = this.score >= this.speedBumpScore ? this.fastSpeed : this.baseSpeed;
    this.speed += (targetSpeed - this.speed) * 0.02 * dt;
  },

  _loop(timestamp) {
    if (!this.running) return;

    if (this._lastTimestamp === null) this._lastTimestamp = timestamp;
    const elapsedMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    const dt = Math.min(Math.max(elapsedMs / (1000 / 60), 0), 3);

    this._update(dt, elapsedMs);
    this._render();
    requestAnimationFrame((t) => this._loop(t));
  },

  _update(dt, elapsedMs) {
    this._updateDifficulty(dt);

    if (this._graceMs > 0) {
      this._graceMs -= elapsedMs;
      this.bird.vy *= 0.8;
    } else {
      this.bird.vy += this.gravity * dt;
      if (this.bird.vy > this.maxFallSpeed) this.bird.vy = this.maxFallSpeed;
    }
    this.bird.y += this.bird.vy * dt;

    if (this.bird.y + this.bird.radius >= this.height || this.bird.y - this.bird.radius <= 0) {
      this._gameOver();
      return;
    }

    for (const pipe of this.pipes) {
      pipe.x -= this.speed * dt;
    }

    if (this.pipes.length && this.pipes[0].x < -this.pipeWidth) {
      this.pipes.shift();
    }
    const rightmost = this.pipes[this.pipes.length - 1];
    if (rightmost && rightmost.x < this.width + 60 - this._currentPipeGapX()) {
      this._spawnPipe(rightmost.x + this._currentPipeGapX());
    }

    for (const pipe of this.pipes) {
      const withinX = this.bird.x + this.bird.radius > pipe.x &&
                       this.bird.x - this.bird.radius < pipe.x + this.pipeWidth;
      const topEdge = pipe.gapCenter - this.pipeGapY / 2;
      const bottomEdge = pipe.gapCenter + this.pipeGapY / 2;
      const withinGap = this.bird.y - this.bird.radius > topEdge &&
                         this.bird.y + this.bird.radius < bottomEdge;

      if (withinX && !withinGap) {
        this._gameOver();
        return;
      }

      if (!pipe.passed && pipe.x + this.pipeWidth < this.bird.x - this.bird.radius) {
        pipe.passed = true;
        this._onScore();
      }
    }
  },

  _onScore() {
    this.score += 1;
    this.coinsThisRun += 1;

    const ding = document.getElementById("sfx-ding");
    if (ding) {
      ding.currentTime = 0;
      ding.play().catch(() => {});
    }

    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
  },

  _gameOver() {
    this.running = false;
    if (this.onGameOver) this.onGameOver(this.score, this.coinsThisRun);
  },

  // ---- Procedural pipe art (jade/stone pillar, no image file needed) ----
  // Matches the floating-island background: dark teal stone body, a paler
  // jade rim ("cap") at the open end facing the gap, and a soft glowing
  // edge line, echoing the glowing peaks/waterfalls in the art.
  _drawPipeSegment(ctx, x, segY, w, h, capAtBottom) {
    if (h <= 0) return;

    // Stone body
    const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    bodyGrad.addColorStop(0, "#152f3d");
    bodyGrad.addColorStop(0.5, "#2f6e7d");
    bodyGrad.addColorStop(1, "#152f3d");
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, segY, w, h);

    // Faint horizontal stone-block seams
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let ly = segY + 16; ly < segY + h - 4; ly += 30) {
      ctx.beginPath();
      ctx.moveTo(x + 4, ly);
      ctx.lineTo(x + w - 4, ly);
      ctx.stroke();
    }

    // Jade rim at the open end (the end facing the gap)
    const capH = 26;
    const capY = capAtBottom ? segY + h - capH : segY;
    const capGrad = ctx.createLinearGradient(x - 7, 0, x + w + 7, 0);
    capGrad.addColorStop(0, "#0e2530");
    capGrad.addColorStop(0.5, "#6fe0d0");
    capGrad.addColorStop(1, "#0e2530");
    ctx.fillStyle = capGrad;
    ctx.fillRect(x - 7, capY, w + 14, capH);

    // Soft glowing edge right at the gap boundary
    const glowY = capAtBottom ? capY + capH - 3 : capY;
    ctx.fillStyle = "rgba(190, 255, 245, 0.6)";
    ctx.fillRect(x - 7, glowY, w + 14, 3);
  },

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Sky gradient matching the background art's misty blue tones
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, "#3f8fd6");
    sky.addColorStop(1, "#bfe8f5");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Pipes
    for (const pipe of this.pipes) {
      const topHeight = pipe.gapCenter - this.pipeGapY / 2;
      const bottomY = pipe.gapCenter + this.pipeGapY / 2;
      const bottomHeight = this.height - bottomY;

      this._drawPipeSegment(ctx, pipe.x, 0, this.pipeWidth, topHeight, true);
      this._drawPipeSegment(ctx, pipe.x, bottomY, this.pipeWidth, bottomHeight, false);
    }

    // Bird
    if (this.skinImage && this.skinImage.complete) {
      const size = this.bird.radius * 4.4;
      ctx.drawImage(this.skinImage, this.bird.x - size / 2, this.bird.y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.arc(this.bird.x, this.bird.y, this.bird.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") Game.flap();
});
