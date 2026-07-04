// ================================================================
// KERN RIVER RUN — game.js
// Phase 1 · Stage 1: Mt. Whitney Headwaters (Miles 0–33)
// Portrait top-down vertical lane-runner
// ================================================================

// ── TUNABLE CONSTANTS ────────────────────────────────────────────
// Increase SCROLL_SPEED to make the game faster overall.
// Was 3 (felt brisk/stressful). Reduced ~43% for a relaxed river-float feel.
const SCROLL_SPEED        = 1.7;    // px per frame — river scroll & obstacle movement
// Longer JUMP_DURATION = more time to clear full-width obstacles.
const JUMP_DURATION       = 42;     // frames for a complete jump arc (~0.7 s at 60 fps)
// How much the player visually "grows" at the peak of a jump.
const JUMP_SCALE_PEAK     = 1.45;   // multiplier on player sprite at apex
// Higher = more frequent obstacles; keep below 0.03 to avoid impossible runs.
// Was 0.022. Reduced alongside SCROLL_SPEED so obstacles have comfortable spacing.
const OBSTACLE_FREQUENCY  = 0.014;  // per-frame spawn probability
// Fraction of spawned obstacles that are full-width (require a jump).
const FULL_WIDTH_FREQ     = 0.11;   // ~1 in 9 obstacles; keep well below 0.25
// Number of lateral river lanes the player moves between.
const LANE_COUNT          = 7;
// Stage 1 ends at mile 33 of the 165-mile Kern River journey.
const STAGE_LENGTH_MILES  = 33;
// Controls how quickly in-game miles tick up. Lower = longer stage.
const PIXELS_PER_MILE     = 900;    // pixels scrolled per 1 in-game mile
// Points awarded each frame while running (also tied to distance scrolled).
const SCORE_PER_FRAME     = 2;
// Minimum pixel gap enforced between consecutive obstacle spawns.
// At SCROLL_SPEED=1.7 this equals ~79 frames (~1.3 s) between spawns.
const MIN_OBSTACLE_GAP    = 135;    // px
// How far above the canvas top obstacles are born.
const SPAWN_Y_OFFSET      = 60;     // px
// Player's fixed vertical position as a fraction of canvas height.
const PLAYER_Y_RATIO      = 0.78;
// ─────────────────────────────────────────────────────────────────

// ── CANVAS ───────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const HUD_H  = 54; // px — height of the top HUD bar

function resizeCanvas() {
  canvas.width  = Math.min(window.innerWidth, 430);
  canvas.height = window.innerHeight;
  if (player) {
    player.y = Math.floor(canvas.height * PLAYER_Y_RATIO);
    if (gameState === 'playing') player.x = getLaneX(player.targetLane);
  }
}
window.addEventListener('resize', resizeCanvas);

// ── GAME STATE ───────────────────────────────────────────────────
// 'start' | 'howtoplay' | 'playing' | 'gameover'
let gameState        = 'start';
let score            = 0;
let highScore        = parseInt(localStorage.getItem('krr_hs') || '0', 10);
let distance         = 0;   // total pixels scrolled this run
let currentMile      = 0;
let bgScrollY        = 0;   // continuous background scroll offset
let framesSinceLast  = 0;   // frames since last obstacle spawn
let stageComplete    = false;
let obstacles        = [];
let bgDecor          = [];  // bank trees/rocks pool
let splashes         = [];  // lane-change water ripple effects

// ── PLAYER ───────────────────────────────────────────────────────
const player = {
  lane:        3,    // active lane index (0–6); snaps after move
  targetLane:  3,    // destination lane; used for collision + smooth x
  x:           0,    // current x (lerps to lane center)
  y:           0,    // fixed vertical position (set by resizeCanvas)
  isJumping:   false,
  jumpFrame:   0,    // 0..JUMP_DURATION
  jumpScale:   1.0,  // sprite scale driven by jump easing
  shadowScale: 1.0,  // shadow shrinks to near-zero at jump apex
  animFrame:   0,    // runs continuously; drives paddle-stroke animation
  dead:        false,
};

// ── LANE GEOMETRY ────────────────────────────────────────────────
function bankW()    { return Math.floor(canvas.width * 0.07); }
function riverW()   { return canvas.width - 2 * bankW(); }
function laneW()    { return riverW() / LANE_COUNT; }
function getLaneX(lane) { return bankW() + (lane + 0.5) * laneW(); }

// ── BACKGROUND DECOR POOL ────────────────────────────────────────
// Trees and rocks on the banks; pooled and wrapped so they scroll forever.
function initBgDecor() {
  bgDecor = [];
  const poolH = canvas.height * 2.2;
  const bw = bankW();
  for (let i = 0; i < 26; i++) {
    bgDecor.push({
      type:  Math.random() < 0.6 ? 'tree' : 'rock',
      side:  Math.random() < 0.5 ? 'L' : 'R',
      offX:  bw * (0.1 + Math.random() * 0.8),
      y:     Math.random() * poolH,
      sz:    5 + Math.random() * 9,
      hue:   Math.random() < 0.5 ? '#166534' : '#15803D',
    });
  }
}

// ── DRAW: BACKGROUND ─────────────────────────────────────────────
function drawBackground() {
  const W  = canvas.width;
  const H  = canvas.height;
  const bw = bankW();
  const rw = riverW();

  // Water gradient — deeper blue at edges, lighter in center
  const wg = ctx.createLinearGradient(bw, 0, bw + rw, 0);
  wg.addColorStop(0,    '#1A56C4');
  wg.addColorStop(0.25, '#2563EB');
  wg.addColorStop(0.5,  '#3B82F6');
  wg.addColorStop(0.75, '#2563EB');
  wg.addColorStop(1.0,  '#1A56C4');
  ctx.fillStyle = wg;
  ctx.fillRect(bw, 0, rw, H);

  // Scrolling current lines
  const lg = 38;
  const lo = bgScrollY % lg;
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#BAE6FD';
  ctx.lineWidth   = 1;
  for (let y = -lg + lo; y < H + lg; y += lg) {
    ctx.beginPath(); ctx.moveTo(bw, y); ctx.lineTo(bw + rw, y); ctx.stroke();
  }
  ctx.restore();

  // Subtle lane dividers
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#93C5FD';
  ctx.lineWidth   = 1;
  const lw = laneW();
  for (let l = 1; l < LANE_COUNT; l++) {
    const x = bw + l * lw;
    ctx.beginPath(); ctx.moveTo(x, HUD_H); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.restore();

  // Bank fills — rocky gray gradient for Stage 1 mountain terrain
  const lgL = ctx.createLinearGradient(0, 0, bw, 0);
  lgL.addColorStop(0, '#374151'); lgL.addColorStop(1, '#4B5563');
  ctx.fillStyle = lgL;
  ctx.fillRect(0, 0, bw, H);

  const lgR = ctx.createLinearGradient(W - bw, 0, W, 0);
  lgR.addColorStop(0, '#4B5563'); lgR.addColorStop(1, '#374151');
  ctx.fillStyle = lgR;
  ctx.fillRect(W - bw, 0, bw, H);

  // Static snow patches on banks (distant scenery, doesn't scroll)
  ctx.save();
  ctx.fillStyle   = '#EFF6FF';
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 8; i++) {
    const sx = (i * 17 % bw);
    const sy = (i * 53 % H);
    ctx.fillRect(sx,          sy, 6 + i % 4, 3);
    ctx.fillRect(W - bw + sx, sy + 20, 5 + i % 3, 3);
  }
  ctx.restore();

  drawBankDecor();
}

function drawBankDecor() {
  const W    = canvas.width;
  const H    = canvas.height;
  const bw   = bankW();
  const pool = H * 2.2;

  for (const d of bgDecor) {
    const rawY = (d.y + bgScrollY * 0.9) % pool; // slight parallax vs. river
    const sy   = rawY - H * 0.1;
    if (sy < -d.sz * 3 || sy > H + d.sz) continue;

    const sx = d.side === 'L' ? d.offX : W - bw + (bw - d.offX);

    if (d.type === 'tree') {
      ctx.fillStyle = d.hue;
      ctx.beginPath();
      ctx.moveTo(sx,               sy - d.sz);
      ctx.lineTo(sx - d.sz * 0.7,  sy + d.sz * 0.55);
      ctx.lineTo(sx + d.sz * 0.7,  sy + d.sz * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.fillStyle   = '#EFF6FF';
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(sx,               sy - d.sz);
      ctx.lineTo(sx - d.sz * 0.22, sy - d.sz * 0.25);
      ctx.lineTo(sx + d.sz * 0.22, sy - d.sz * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#6B7280';
      ctx.beginPath();
      ctx.ellipse(sx, sy, d.sz, d.sz * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.fillStyle   = '#EFF6FF';
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.ellipse(sx, sy - d.sz * 0.12, d.sz * 0.6, d.sz * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── DRAW: OBSTACLES ──────────────────────────────────────────────
function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.resolved && obs.y > player.y) continue;
    obs.type === 'log' ? drawLog(obs) : drawLaneObs(obs);
  }
}

function drawLog(obs) {
  const bw  = bankW();
  const rw  = riverW();
  ctx.fillStyle = '#78350F';
  ctx.fillRect(bw, obs.y, rw, obs.h);
  ctx.fillStyle = '#92400E';
  const seg = rw / 7;
  for (let i = 1; i < 7; i++) {
    ctx.fillRect(bw + i * seg - 1, obs.y + 3, 2, obs.h - 6);
  }
  ctx.fillStyle = '#A16207';
  ctx.fillRect(bw, obs.y, 7, obs.h);
  ctx.fillRect(bw + rw - 7, obs.y, 7, obs.h);
  ctx.fillStyle = '#B45309';
  ctx.fillRect(bw, obs.y, rw, 3);
  if (obs.y > 0 && obs.y < canvas.height * 0.5) {
    ctx.save();
    ctx.font         = '6px "Press Start 2P", monospace';
    ctx.fillStyle    = '#FDE68A';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JUMP!', canvas.width / 2, obs.y + obs.h / 2);
    ctx.restore();
  }
}

function drawLaneObs(obs) {
  const lw = laneW();
  const cx = getLaneX(obs.lane);
  const cy = obs.y + obs.h / 2;
  const r  = Math.min(lw * 0.34, obs.h * 0.52);

  if (obs.type === 'rock') {
    ctx.fillStyle = '#5D6875';
    ctx.beginPath();
    ctx.moveTo(cx,            cy - r);
    ctx.lineTo(cx + r * 0.9,  cy - r * 0.15);
    ctx.lineTo(cx + r * 0.7,  cy + r * 0.8);
    ctx.lineTo(cx - r * 0.7,  cy + r * 0.8);
    ctx.lineTo(cx - r * 0.9,  cy - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3,  cy - r * 0.9);
    ctx.lineTo(cx + r * 0.4,  cy - r * 0.45);
    ctx.lineTo(cx - r * 0.1,  cy - r * 0.1);
    ctx.closePath();
    ctx.fill();

  } else if (obs.type === 'branch') {
    ctx.save();
    ctx.lineCap     = 'round';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth   = Math.max(5, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.7);
    ctx.stroke();
    ctx.strokeStyle = '#166534';
    ctx.lineWidth   = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * r * 0.22, cy + i * r * 0.22);
      ctx.lineTo(cx + i * r * 0.22 + r * 0.32, cy + i * r * 0.22 - r * 0.32);
      ctx.stroke();
    }
    ctx.restore();

  } else if (obs.type === 'roots') {
    ctx.save();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 0.85, cx + r * 0.5, cy - r * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy + r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.35, cx + r * 0.9, cy + r * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.1, cy - r * 0.6);
    ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.5, cx + r * 0.4, cy + r * 0.9);
    ctx.stroke();
    ctx.restore();

  } else if (obs.type === 'rapids') {
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(cx - lw * 0.42, obs.y, lw * 0.84, obs.h);
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle   = '#EFF6FF';
    for (let wy = obs.y + 2; wy < obs.y + obs.h; wy += 9) {
      ctx.beginPath();
      ctx.arc(cx - r * 0.28, wy + 4, 4, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.28, wy + 1, 3, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── DRAW: WATER SPLASH RIPPLES ───────────────────────────────────
// Spawned when the kayaker switches lanes; expand outward and fade.
function spawnSplash(x, y) {
  splashes.push({ x, y, life: 26, maxLife: 26 });
}

function drawSplashes() {
  for (const sp of splashes) {
    const t  = 1 - sp.life / sp.maxLife; // 0 (fresh) → 1 (gone)
    const r  = 4 + 20 * t;               // 4 → 24 px radius
    const a  = (sp.life / sp.maxLife) * 0.52;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#BAE6FD';
    ctx.lineWidth   = 2;
    // Outer ring — flat ellipse (top-down water perspective)
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, r, r * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring (only for early lifetime — gives double-ripple feel)
    if (t < 0.45) {
      ctx.globalAlpha = a * 0.5;
      const ri = r * 0.42;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, ri, ri * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── DRAW: PLAYER (KAYAKER) ───────────────────────────────────────
// Top-down view: elongated kayak hull with paddler sitting in cockpit.
// Paddle alternates left/right dip every ~30 frames for a relaxed stroke cadence.
// Jump uses the same scale-up + shadow-shrink effect as before.
function drawPlayer() {
  const KW  = 12;    // kayak width (px, at scale 1.0)
  const KH  = 28;    // kayak height — elongated bow-to-stern
  const s   = player.jumpScale;
  const px  = player.x;
  const py  = player.y;

  // Paddle stroke phase: left dip for 30 frames, right dip for 30 frames (~1 s cycle)
  const paddleLeft = (player.animFrame % 60) < 30;
  // Slight angle tilt for the active dip side
  const paddleAngle = paddleLeft ? -0.30 : 0.30;

  // Water shadow under kayak — shrinks toward zero at jump apex
  ctx.save();
  const shadowA = player.isJumping ? 0.20 * player.shadowScale : 0.30;
  ctx.globalAlpha = shadowA;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(
    px, py + KH * 0.28,
    KW * 0.55 * (player.isJumping ? player.shadowScale : 1),
    KW * 0.18,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Scale entire sprite from its center for jump animation
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);

  // ── Kayak hull ── pointed bow (top) and stern (bottom), bezier curves
  ctx.fillStyle = '#0B1F3A';
  ctx.beginPath();
  ctx.moveTo(0, -KH / 2);                                          // bow tip
  ctx.bezierCurveTo( KW / 2, -KH * 0.32,  KW / 2,  KH * 0.32, 0,  KH / 2); // right side
  ctx.bezierCurveTo(-KW / 2,  KH * 0.32, -KW / 2, -KH * 0.32, 0, -KH / 2); // left side
  ctx.closePath();
  ctx.fill();

  // Hull center stripe — lighter navy for dimension
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0, -KH * 0.46);
  ctx.bezierCurveTo( KW * 0.17, -KH * 0.28,  KW * 0.17,  KH * 0.28, 0,  KH * 0.46);
  ctx.bezierCurveTo(-KW * 0.17,  KH * 0.28, -KW * 0.17, -KH * 0.28, 0, -KH * 0.46);
  ctx.closePath();
  ctx.fill();

  // Campaign green accent stripe down the centerline
  ctx.fillStyle = '#2D6A4F';
  ctx.fillRect(-KW * 0.07, -KH * 0.40, KW * 0.14, KH * 0.80);

  // Cockpit opening — oval recess
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(0, KH * 0.04, KW * 0.30, KH * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit rim
  ctx.strokeStyle = '#334155';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, KH * 0.04, KW * 0.30, KH * 0.20, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Paddler head — small circle in the cockpit
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(0, -KH * 0.03, KW * 0.20, 0, Math.PI * 2);
  ctx.fill();

  // Paddle assembly — tilts with each stroke phase
  ctx.save();
  ctx.rotate(paddleAngle);

  // Shaft — horizontal bar crossing the kayak width
  ctx.fillStyle = '#92400E';
  const shaftHalf = KW * 0.88;
  ctx.fillRect(-shaftHalf, -2.5, shaftHalf * 2, 5);

  // Left blade
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.ellipse(-shaftHalf - KW * 0.18, 0, KW * 0.16, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Left blade highlight
  ctx.fillStyle = '#A16207';
  ctx.beginPath();
  ctx.ellipse(-shaftHalf - KW * 0.18, -1.5, KW * 0.10, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Right blade
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.ellipse(shaftHalf + KW * 0.18, 0, KW * 0.16, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right blade highlight
  ctx.fillStyle = '#A16207';
  ctx.beginPath();
  ctx.ellipse(shaftHalf + KW * 0.18, -1.5, KW * 0.10, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // paddle rotation

  ctx.restore(); // sprite scale + translation
}

// ── DRAW: HUD ────────────────────────────────────────────────────
function drawHUD() {
  const W = canvas.width;

  ctx.fillStyle = 'rgba(11,31,58,0.84)';
  ctx.fillRect(0, 0, W, HUD_H);

  ctx.font         = '7px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#F5F0E8';

  ctx.textAlign = 'left';   ctx.fillText('HEADWATERS',            8, 14);
  ctx.textAlign = 'center'; ctx.fillText('MILE ' + currentMile + ' / 165', W / 2, 14);
  ctx.textAlign = 'right';  ctx.fillText('STAGE 1/5',             W - 8, 14);

  ctx.fillStyle = '#C9883A';
  ctx.font      = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';  ctx.fillText('SCORE ' + Math.floor(score),    8, 42);
  ctx.textAlign = 'right'; ctx.fillText('BEST '  + Math.floor(highScore), W - 8, 42);
}

// ── SPAWN OBSTACLES ──────────────────────────────────────────────
const OBS_TYPES = ['rock', 'rock', 'branch', 'roots', 'rapids'];

function spawnObstacle() {
  if (Math.random() < FULL_WIDTH_FREQ) {
    obstacles.push({ type: 'log', fullWidth: true, lane: -1,
      y: -SPAWN_Y_OFFSET, h: 17, resolved: false });
  } else {
    const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
    const lane = Math.floor(Math.random() * LANE_COUNT);
    obstacles.push({ type, fullWidth: false, lane,
      y: -SPAWN_Y_OFFSET, h: type === 'rapids' ? 32 : 22, resolved: false });
  }
}

// ── UPDATE ───────────────────────────────────────────────────────
function update() {
  bgScrollY += SCROLL_SPEED;
  distance  += SCROLL_SPEED;
  score     += SCORE_PER_FRAME;
  currentMile = Math.floor(distance / PIXELS_PER_MILE);

  if (currentMile >= STAGE_LENGTH_MILES && !stageComplete) {
    stageComplete = true;
    endRun();
    return;
  }

  // Smooth player x toward target lane
  const tx = getLaneX(player.targetLane);
  player.x += (tx - player.x) * 0.28;
  if (Math.abs(player.x - tx) < 0.6) { player.x = tx; player.lane = player.targetLane; }
  player.animFrame++;

  // Jump arc — sin easing for scale and shadow
  if (player.isJumping) {
    player.jumpFrame++;
    const t            = player.jumpFrame / JUMP_DURATION;
    const arc          = Math.sin(t * Math.PI);
    player.jumpScale   = 1 + (JUMP_SCALE_PEAK - 1) * arc;
    player.shadowScale = 1 - arc * 0.9;
    if (player.jumpFrame >= JUMP_DURATION) {
      player.isJumping   = false;
      player.jumpFrame   = 0;
      player.jumpScale   = 1.0;
      player.shadowScale = 1.0;
    }
  }

  // Spawn logic — enforce minimum gap via frame counter
  framesSinceLast++;
  const minF = Math.ceil(MIN_OBSTACLE_GAP / SCROLL_SPEED);
  if (framesSinceLast >= minF && Math.random() < OBSTACLE_FREQUENCY) {
    spawnObstacle();
    framesSinceLast = 0;
  }

  // Move obstacles down and cull off-screen
  for (const obs of obstacles) { obs.y += SCROLL_SPEED; }
  obstacles = obstacles.filter(obs => obs.y < canvas.height + 80);

  // Age splash ripples and cull spent ones
  for (const sp of splashes) { sp.life--; }
  splashes = splashes.filter(sp => sp.life > 0);

  checkCollision();
}

function checkCollision() {
  const py   = player.y;
  const half = 12;

  for (const obs of obstacles) {
    if (obs.resolved) continue;
    if (obs.y + obs.h >= py - half && obs.y <= py + half) {
      obs.resolved = true;
      const safe = player.isJumping ||
                   (!obs.fullWidth && obs.lane !== player.targetLane);
      if (!safe) { endRun(); return; }
    }
  }
}

function endRun() {
  player.dead = true;
  gameState   = 'gameover';
  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem('krr_hs', highScore);
  }
}

// ── GAME LOOP ────────────────────────────────────────────────────
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'playing') {
    update();
    drawBackground();
    drawObstacles();
    drawSplashes();   // ripples render under the kayak
    drawPlayer();
    drawHUD();
  } else if (gameState === 'start') {
    drawStartScreen();
  } else if (gameState === 'howtoplay') {
    drawHowToPlay();
  } else if (gameState === 'gameover') {
    drawGameOver();
  }

  requestAnimationFrame(gameLoop);
}

// ── START GAME ───────────────────────────────────────────────────
function startGame() {
  score           = 0;
  distance        = 0;
  currentMile     = 0;
  bgScrollY       = 0;
  obstacles       = [];
  splashes        = [];
  framesSinceLast = 0;
  stageComplete   = false;

  player.lane        = 3;
  player.targetLane  = 3;
  player.x           = getLaneX(3);
  player.y           = Math.floor(canvas.height * PLAYER_Y_RATIO);
  player.isJumping   = false;
  player.jumpFrame   = 0;
  player.jumpScale   = 1.0;
  player.shadowScale = 1.0;
  player.animFrame   = 0;
  player.dead        = false;

  initBgDecor();
  gameState = 'playing';
}

// ── SCREEN: START ────────────────────────────────────────────────
function drawStartScreen() {
  const W = canvas.width;
  const H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#0B1F3A');
  bg.addColorStop(0.5, '#0B2D4F');
  bg.addColorStop(1.0, '#1D4ED8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawStartScenery(W, H);

  ctx.font         = '6px "Press Start 2P", monospace';
  ctx.fillStyle    = 'rgba(245,240,232,0.5)';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('< BACK TO CAMPAIGN', 12, 10);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#C9883A';
  ctx.font      = '20px "Press Start 2P", monospace';
  ctx.fillText('KERN',  W / 2, H * 0.20);
  ctx.fillText('RIVER', W / 2, H * 0.20 + 28);
  ctx.fillStyle = '#F5F0E8';
  ctx.fillText('RUN',   W / 2, H * 0.20 + 56);

  ctx.font      = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('Can you follow the Kern River', W / 2, H * 0.20 + 84);
  ctx.fillText('all 165 miles to Bakersfield?', W / 2, H * 0.20 + 98);

  drawBtn('START RUN',   W / 2, H * 0.62,      W * 0.62, 40, '#2D6A4F', '#F5F0E8');
  drawBtn('HOW TO PLAY', W / 2, H * 0.62 + 56, W * 0.62, 40, '#1E3A5F', '#C9883A');
}

function drawStartScenery(W, H) {
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0,       H * 0.78);
  ctx.lineTo(W * 0.12, H * 0.57);
  ctx.lineTo(W * 0.28, H * 0.70);
  ctx.lineTo(W * 0.47, H * 0.50);
  ctx.lineTo(W * 0.65, H * 0.62);
  ctx.lineTo(W * 0.80, H * 0.53);
  ctx.lineTo(W,        H * 0.66);
  ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.fillStyle   = '#EFF6FF';
  ctx.globalAlpha = 0.85;
  const peaks = [[W * 0.47, H * 0.50, W * 0.09], [W * 0.80, H * 0.53, W * 0.06]];
  for (const [px, py, pw] of peaks) {
    ctx.beginPath();
    ctx.moveTo(px,      py);
    ctx.lineTo(px - pw, py + pw * 0.75);
    ctx.lineTo(px + pw, py + pw * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#2563EB';
  ctx.fillRect(W * 0.12, H * 0.83, W * 0.76, H * 0.17);

  ctx.fillStyle = '#166534';
  const treeX = [0.06, 0.2, 0.36, 0.57, 0.73, 0.91];
  for (const tx of treeX) {
    const x = W * tx, y = H * 0.77, sz = 10 + ((tx * 100) % 5);
    ctx.beginPath();
    ctx.moveTo(x,            y - sz);
    ctx.lineTo(x - sz * 0.6, y + sz * 0.5);
    ctx.lineTo(x + sz * 0.6, y + sz * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

// ── SCREEN: HOW TO PLAY ──────────────────────────────────────────
function drawHowToPlay() {
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = 'rgba(11,31,58,0.96)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#C9883A';
  ctx.font         = '10px "Press Start 2P", monospace';
  ctx.fillText('HOW TO PLAY', W / 2, H * 0.10);

  const lines = [
    ['Paddle left/right between', '#F5F0E8'],
    ['river lanes to dodge',      '#F5F0E8'],
    ['rocks, branches & roots.',  '#F5F0E8'],
    ['', ''],
    ['JUMP over full-width',      '#FDE68A'],
    ['fallen logs!',              '#FDE68A'],
    ['', ''],
    ['— DESKTOP —',               '#C9883A'],
    ['LEFT / RIGHT  arrow keys',  '#F5F0E8'],
    ['SPACE or UP   jump',        '#F5F0E8'],
    ['', ''],
    ['— MOBILE —',                '#C9883A'],
    ['SWIPE left / right  lane',  '#F5F0E8'],
    ['TAP anywhere   jump',       '#F5F0E8'],
    ['', ''],
    ['Reach Mile 33 to complete', '#93C5FD'],
    ['Stage 1!',                  '#93C5FD'],
  ];

  ctx.font = '6px "Press Start 2P", monospace';
  lines.forEach(([txt, col], i) => {
    if (!txt) return;
    ctx.fillStyle = col;
    ctx.fillText(txt, W / 2, H * 0.21 + i * 15);
  });

  drawBtn('GOT IT!', W / 2, H * 0.91, W * 0.58, 40, '#2D6A4F', '#F5F0E8');
}

// ── SCREEN: GAME OVER ────────────────────────────────────────────
function drawGameOver() {
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = 'rgba(11,31,58,0.9)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  if (stageComplete) {
    ctx.fillStyle = '#C9883A';
    ctx.font      = '11px "Press Start 2P", monospace';
    ctx.fillText('STAGE 1',   W / 2, H * 0.22);
    ctx.fillText('COMPLETE!', W / 2, H * 0.22 + 20);
    ctx.font      = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText('You paddled the Kern River',  W / 2, H * 0.22 + 48);
    ctx.fillText('from the Sierra Nevada',      W / 2, H * 0.22 + 63);
    ctx.fillText('through Miles 0 – 33!',       W / 2, H * 0.22 + 78);
  } else {
    ctx.fillStyle = '#EF4444';
    ctx.font      = '11px "Press Start 2P", monospace';
    ctx.fillText('RUN ENDED', W / 2, H * 0.24);
    ctx.font      = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText('Made it to Mile ' + currentMile + ' / 165', W / 2, H * 0.34);
  }

  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillStyle = '#C9883A';
  ctx.fillText('SCORE  ' + Math.floor(score),     W / 2, H * 0.52);
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('BEST   ' + Math.floor(highScore),  W / 2, H * 0.52 + 20);

  drawBtn('TRY AGAIN',  W / 2, H * 0.68,      W * 0.62, 40, '#2D6A4F', '#F5F0E8');
  drawBtn('MAIN MENU',  W / 2, H * 0.68 + 54, W * 0.62, 40, '#1E3A5F', '#C9883A');
}

// ── BUTTON HELPER ────────────────────────────────────────────────
function drawBtn(label, cx, cy, bw, bh, bg, fg) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw, bh);
  ctx.fillStyle = bg;
  ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.strokeStyle = fg;
  ctx.lineWidth   = 2;
  ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.fillStyle    = fg;
  ctx.font         = '8px "Press Start 2P", monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}

function hitBtn(mx, my, cx, cy, bw, bh) {
  return mx >= cx - bw / 2 && mx <= cx + bw / 2 &&
         my >= cy - bh / 2 && my <= cy + bh / 2;
}

// Converts a client coordinate to canvas-space, accounting for CSS scaling.
function clientToCanvas(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return [
    (cx - r.left) * (canvas.width  / r.width),
    (cy - r.top)  * (canvas.height / r.height),
  ];
}

// ── INPUT: GAMEPLAY ──────────────────────────────────────────────
function doMoveLeft() {
  if (player.targetLane > 0) {
    spawnSplash(player.x, player.y + 8);
    player.targetLane--;
  }
}
function doMoveRight() {
  if (player.targetLane < LANE_COUNT - 1) {
    spawnSplash(player.x, player.y + 8);
    player.targetLane++;
  }
}
function doJump() {
  if (!player.isJumping && gameState === 'playing') {
    player.isJumping   = true;
    player.jumpFrame   = 0;
    player.jumpScale   = 1.0;
    player.shadowScale = 1.0;
  }
}

window.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;
  switch (e.key) {
    case 'ArrowLeft':  case 'a': case 'A': doMoveLeft();  break;
    case 'ArrowRight': case 'd': case 'D': doMoveRight(); break;
    case 'ArrowUp': case 'w': case 'W': case ' ':
      e.preventDefault(); doJump(); break;
  }
});

// ── INPUT: TOUCH ─────────────────────────────────────────────────
let tStartX = 0, tStartY = 0, tStartMs = 0;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t  = e.changedTouches[0];
  tStartX  = t.clientX;
  tStartY  = t.clientY;
  tStartMs = Date.now();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t   = e.changedTouches[0];
  const dx  = t.clientX - tStartX;
  const dy  = t.clientY - tStartY;
  const dt  = Date.now() - tStartMs;
  const mag = Math.hypot(dx, dy);

  if (gameState === 'playing') {
    if (mag < 22 && dt < 280) {
      doJump();
    } else if (Math.abs(dx) > Math.abs(dy) && mag > 28) {
      dx < 0 ? doMoveLeft() : doMoveRight();
    } else if (dy < -28) {
      doJump();
    }
  } else {
    const [mx, my] = clientToCanvas(t.clientX, t.clientY);
    handleTap(mx, my);
  }
}, { passive: false });

// ── INPUT: CLICK (desktop button handling) ────────────────────────
canvas.addEventListener('click', e => {
  if (gameState === 'playing') return;
  const [mx, my] = clientToCanvas(e.clientX, e.clientY);
  handleTap(mx, my);
});

function handleTap(mx, my) {
  const W = canvas.width;
  const H = canvas.height;

  if (gameState === 'start') {
    if (my < 28) { window.location.href = '../'; return; }
    if (hitBtn(mx, my, W/2, H*0.62,      W*0.62, 40)) { startGame(); return; }
    if (hitBtn(mx, my, W/2, H*0.62 + 56, W*0.62, 40)) { gameState = 'howtoplay'; }

  } else if (gameState === 'howtoplay') {
    if (hitBtn(mx, my, W/2, H*0.91, W*0.58, 40)) { gameState = 'start'; }

  } else if (gameState === 'gameover') {
    if (hitBtn(mx, my, W/2, H*0.68,      W*0.62, 40)) { startGame(); return; }
    if (hitBtn(mx, my, W/2, H*0.68 + 54, W*0.62, 40)) { gameState = 'start'; }
  }
}

// ── INIT ─────────────────────────────────────────────────────────
resizeCanvas();
player.x = getLaneX(3);
player.y = Math.floor(canvas.height * PLAYER_Y_RATIO);

// Wait for the pixel font to load before starting the render loop
// so the first frame doesn't flash with system-fallback text.
document.fonts.ready.then(() => requestAnimationFrame(gameLoop));
