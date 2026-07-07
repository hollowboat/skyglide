// ============ CORE GAME (Flappy Bird mechanics) ============

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

  baseSpeed: 2.4,
  speed: 2.4,
  basePipeGapX: 260,   // horizontal distance between pipe pairs
  pipeGapY: 150,        // vertical gap the bird flies through
  pipeWidth: 0,
  lastPipeX: 0,

  gravity: 0.45,
  flapStrength: -8,

  skinImage: null,
  pipeImage: null,

  onScoreUpdate: null,   // callback(score) — used to drive HUD ego tracker
  onGameOver: null,      // callback(finalScore, coinsEarned)

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  },

  resize() {
    // Keep internal resolution fixed for consistent physics regardless of CSS scaling
    this.width = 480;
    this.height = 270; // 16:9 internal resolution
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  },

  loadSkin(skinLevel) {
    const img = new Image();
    img.src = `images/Level${skinLevel}.png`;
    this.skinImage = img;
  },

  loadPipeImage() {
    const img = new Image();
    img.src = "images/Pipe.png";
    this.pipeImage = img;
  },

  start(skinLevel) {
    this.loadSkin(skinLevel);
    this.loadPipeImage();

    this.score = 0;
    this.coinsThisRun = 0;
    this.speed = this.baseSpeed;
    this.pipes = [];
    this.lastPipeX = this.width + 100;
    this.pipeWidth = 52;

    this.bird = {
      x: this.width * 0.28,
      y: this.height / 2,
      vy: 0,
      radius: 14
    };

    this.running = true;
    this._spawnInitialPipes();
    this._loop();
  },

  flap() {
    if (!this.running) return;
    this.bird.vy = this.flapStrength;
  },

  _spawnInitialPipes() {
    let x = this.width + 60;
    for (let i = 0; i < 4; i++) {
      this._spawnPipe(x);
      x += this._currentPipeGapX();
    }
  },

  _currentPipeGapX() {
    // Gap scales up proportionally with speed so reaction time stays fair
    const speedRatio = this.speed / this.baseSpeed;
    return this.basePipeGapX * speedRatio;
  },

  _spawnPipe(x) {
    const margin = 40;
    const gapCenter = margin + Math.random() * (this.height - margin * 2 - this.pipeGapY) + this.pipeGapY / 2;
    this.pipes.push({
      x,
      gapCenter,
      passed: false
    });
  },

  _updateDifficulty() {
    // Speed increases slowly as score rises, capped so it never becomes impossible
    const targetSpeed = this.baseSpeed + Math.min(this.score * 0.03, 3.5);
    this.speed += (targetSpeed - this.speed) * 0.02;
  },

  _loop() {
    if (!this.running) return;
    this._update();
    this._render();
    requestAnimationFrame(() => this._loop());
  },

  _update() {
    this._updateDifficulty();

    this.bird.vy += this.gravity;
    this.bird.y += this.bird.vy;

    // Ground / ceiling collision
    if (this.bird.y + this.bird.radius >= this.height || this.bird.y - this.bird.radius <= 0) {
      this._gameOver();
      return;
    }

    // Move pipes
    for (const pipe of this.pipes) {
      pipe.x -= this.speed;
    }

    // Remove offscreen pipes, spawn new ones to maintain the fair gap
    if (this.pipes.length && this.pipes[0].x < -this.pipeWidth) {
      this.pipes.shift();
    }
    const rightmost = this.pipes[this.pipes.length - 1];
    if (rightmost && rightmost.x < this.width + 60 - this._currentPipeGapX()) {
      this._spawnPipe(rightmost.x + this._currentPipeGapX());
    }

    // Collision + scoring
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
      ding.play().catch(() => {}); // ignore autoplay-policy rejections
    }

    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
  },

  _gameOver() {
    this.running = false;
    if (this.onGameOver) this.onGameOver(this.score, this.coinsThisRun);
  },

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Sky
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, this.width, this.height);

    // Pipes (top pipe = Pipe.png rotated+flipped; bottom pipe = Pipe.png as-is)
    for (const pipe of this.pipes) {
      const topHeight = pipe.gapCenter - this.pipeGapY / 2;
      const bottomY = pipe.gapCenter + this.pipeGapY / 2;
      const bottomHeight = this.height - bottomY;

      if (this.pipeImage && this.pipeImage.complete) {
        // Bottom pipe: draw as-is (downward-facing asset, matches upward opening)
        ctx.drawImage(this.pipeImage, pipe.x, bottomY, this.pipeWidth, bottomHeight);

        // Top pipe: duplicate, rotate 180 + flip vertically to face downward
        ctx.save();
        ctx.translate(pipe.x + this.pipeWidth / 2, topHeight / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(this.pipeImage, -this.pipeWidth / 2, -topHeight / 2, this.pipeWidth, topHeight);
        ctx.restore();
      } else {
        // Fallback rectangles until Pipe.png loads
        ctx.fillStyle = "#3cb043";
        ctx.fillRect(pipe.x, 0, this.pipeWidth, topHeight);
        ctx.fillRect(pipe.x, bottomY, this.pipeWidth, bottomHeight);
      }
    }

    // Bird
    if (this.skinImage && this.skinImage.complete) {
      const size = this.bird.radius * 2.4;
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
