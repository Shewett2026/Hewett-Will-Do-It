// ================================================================
// KERN RIVER RUN — game.js
// Phase 3 + Visual Polish + Angled Perspective + Start Screen
// ================================================================

// ── FIXED CONSTANTS ──────────────────────────────────────────────
const JUMP_DURATION               = 56;
const JUMP_SCALE_PEAK             = 1.45;
const PIXELS_PER_MILE             = 900;
const SCORE_PER_FRAME             = 2;
const MIN_OBSTACLE_GAP            = 135;
const SPAWN_Y_OFFSET              = 60;
const PLAYER_Y_RATIO              = 0.82;
const HUD_H                       = 54;
const HORIZON_OFFSET              = 70;
const HORIZON_MIN_W               = 0.28;  // river width fraction at horizon (widens spawn area)
const COMMON_COLLECTIBLE_VALUE    = 50;
const RARE_COLLECTIBLE_VALUE      = 150;
const COLLECTIBLE_FREQUENCY       = 0.006;
const ENDING_SLOWDOWN_FRAMES      = 90;
const RIVER_WASH_SPINOUT_DURATION = 90;  // ~1.5s at 60fps

const RARE_COLLECTIBLE_TYPES = new Set(['mountain_crystal', 'treasure_chest']);

const COLL_GLOW = {
  poppy:                '#F97316',
  golden_trout:         '#FBBF24',
  mountain_crystal:     '#A5F3FC',
  fishing_lure:         '#EF4444',
  golden_eagle_feather: '#C9883A',
  beach_ball:           '#60A5FA',
  cooler:               '#38BDF8',
  gold_nugget:          '#FBBF24',
  treasure_chest:       '#F59E0B',
  fox_theater_ticket:   '#E879F9',
  city_seal_medallion:  '#93C5FD',
};
// ─────────────────────────────────────────────────────────────────

// ── STAGE DATA ───────────────────────────────────────────────────
const STAGES = [
  {
    num: 1, name: 'HEADWATERS', enterMsg: null,
    startMile: 0,   endMile: 33,  lanes: 7,
    speed: 1.48, obsFreq: 0.011, fwFreq: 0.11,
    stageObs: 'deadfall_log',
    obsTypes: ['deadfall_log', 'deadfall_log', 'boulder', 'boulder', 'river_wash'],
    fwType: 'fallen_sequoia',
    collA: 'golden_trout', collB: 'mountain_crystal',
  },
  {
    num: 2, name: 'UPPER KERN', enterMsg: 'ENTERING UPPER KERN',
    startMile: 33,  endMile: 66,  lanes: 6,
    speed: 1.65, obsFreq: 0.012, fwFreq: 0.12,
    stageObs: 'capsized_raft',
    obsTypes: ['capsized_raft', 'capsized_raft', 'boulder', 'boulder', 'river_wash'],
    fwType: 'raft_train',
    collA: 'fishing_lure', collB: 'golden_eagle_feather',
  },
  {
    num: 3, name: 'LAKE ISABELLA', enterMsg: 'ENTERING LAKE ISABELLA',
    startMile: 66,  endMile: 99,  lanes: 5,
    speed: 1.78, obsFreq: 0.012, fwFreq: 0.10,
    stageObs: 'drifting_sailboat',
    obsTypes: ['drifting_sailboat', 'drifting_sailboat', 'boulder', 'boulder', 'river_wash'],
    fwType: 'pontoon_party',
    collA: 'beach_ball', collB: 'cooler',
  },
  {
    num: 4, name: 'KERN CANYON', enterMsg: 'ENTERING KERN CANYON',
    startMile: 99,  endMile: 132, lanes: 4,
    speed: 1.91, obsFreq: 0.013, fwFreq: 0.12,
    stageObs: 'mine_cart',
    obsTypes: ['mine_cart', 'mine_cart', 'boulder', 'boulder', 'river_wash'],
    fwType: 'old_mining_bridge',
    collA: 'gold_nugget', collB: 'treasure_chest',
  },
  {
    num: 5, name: 'BAKERSFIELD', enterMsg: 'APPROACHING BAKERSFIELD',
    startMile: 132, endMile: 165, lanes: 3,
    speed: 2.00, obsFreq: 0.012, fwFreq: 0.09,
    stageObs: 'shopping_cart',
    obsTypes: ['shopping_cart', 'shopping_cart', 'boulder', 'boulder', 'river_wash'],
    fwType: 'tube_float_parade',
    collA: 'fox_theater_ticket', collB: 'city_seal_medallion',
    subNarrow: [
      { atMile: 150, lanes: 2, msg: 'THE RIVER NARROWS', obsFreq: 0.009 },
      { atMile: 160, lanes: 1, msg: 'FINAL STRETCH',     obsFreq: 0.007 },
    ],
  },
];

// ── VISUAL THEMES ────────────────────────────────────────────────
const BG_THEMES = [
  { we:'#1A56C4', wm:'#3B82F6', bd:'#374151', bl:'#4B5563', ca:0.11, cc:'#BAE6FD',
    skyTop:'#0B1F3A', skyBot:'#1E3A5F', mtFill:'#C8D8E8', mtSnow:'#E2E8F0', snow:true },
  { we:'#1D4ED8', wm:'#2563EB', bd:'#7C2D12', bl:'#9A3412', ca:0.17, cc:'#FED7AA',
    skyTop:'#0B1F3A', skyBot:'#1C3D5A', mtFill:'#7C2D12', mtSnow:'#A16207', snow:false },
  { we:'#1E6CB5', wm:'#38BDF8', bd:'#78716C', bl:'#A8A29E', ca:0.07, cc:'#BAE6FD',
    skyTop:'#0B1F3A', skyBot:'#164E63', mtFill:'#57534E', mtSnow:'#78716C', snow:false },
  { we:'#1E3A5F', wm:'#1D4ED8', bd:'#1C1917', bl:'#292524', ca:0.13, cc:'#93C5FD',
    skyTop:'#0B1F3A', skyBot:'#0B1F3A', mtFill:'#1C1917', mtSnow:'#292524', snow:false },
  { we:'#1D4ED8', wm:'#60A5FA', bd:'#D97706', bl:'#FBBF24', ca:0.06, cc:'#BAE6FD',
    skyTop:'#0B1F3A', skyBot:'#1A3D5C', mtFill:'#92400E', mtSnow:'#D97706', snow:false },
];

const DECOR_THEMES = [
  { types:['tree','rock'],       hues:['#166534','#15803D'] },
  { types:['rock','rock'],       hues:['#A16207','#78350F'] },
  { types:['tree','dock'],       hues:['#D97706','#B45309'] },
  { types:['rock','rock'],       hues:['#44403C','#57534E'] },
  { types:['cottonwood','rock'], hues:['#A16207','#CA8A04'] },
];

// ── CANVAS ───────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

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
let gameState       = 'start';
let score           = 0;
let highScore       = parseInt(localStorage.getItem('krr_hs') || '0', 10);
let distance        = 0;
let currentMile     = 0;
let bgScrollY       = 0;
let framesSinceLast = 0;
let obstacles       = [];
let bgDecor         = [];
let splashes        = [];
let collectibles    = [];

let currentStageIdx = 0;
let currentLanes    = STAGES[0].lanes;
let currentSpeed    = STAGES[0].speed;
let currentObsFreq  = STAGES[0].obsFreq;
let currentFwFreq   = STAGES[0].fwFreq;
let currentObsTypes = STAGES[0].obsTypes;
let currentFwType   = STAGES[0].fwType;
let transitionMsg   = null;
let subNarrowFired  = new Set();

let endingPhase     = 0;
let endingTimer     = 0;
let endingSpeedMult = 1.0;
let dustParticles   = [];
let startAnimTime   = 0;

// ── PLAYER ───────────────────────────────────────────────────────
const player = {
  lane: 3, targetLane: 3, x: 0, y: 0,
  isJumping: false, jumpFrame: 0, jumpScale: 1.0, shadowScale: 1.0,
  animFrame: 0, dead: false,
  hasShield: false,
  spinoutFrames: 0,
};

// ── FLAT LANE GEOMETRY (reference frame at player.y, perspT=1) ───
function bankW() {
  return Math.floor(canvas.width * (0.07 + (7 - currentLanes) * 0.04));
}
function riverW()  { return canvas.width - 2 * bankW(); }
function laneW()   { return riverW() / currentLanes; }
// At player.y, perspT=1, so laneXAt(lane, player.y) == getLaneX(lane)
function getLaneX(lane) { return bankW() + (lane + 0.5) * laneW(); }

// ── PERSPECTIVE HELPERS ───────────────────────────────────────────
// Horizon is HORIZON_OFFSET px below the HUD
function horizonY() { return HUD_H + HORIZON_OFFSET; }

// t = 0 at horizon, t = 1 at player.y, t > 1 below player
function perspT(y) {
  return (y - horizonY()) / (player.y - horizonY());
}

// River width at a given screen y — floor at HORIZON_MIN_W to widen the spawn area
function riverWidthAt(y) {
  return riverW() * Math.max(HORIZON_MIN_W, perspT(y));
}

// Left edge of river at screen y
function riverLeftAt(y) {
  return canvas.width / 2 - riverWidthAt(y) / 2;
}

// X position for lane center at screen y (perspective-correct, uses widened riverWidthAt)
function laneXAt(lane, y) {
  const rw = riverWidthAt(y);
  const lw = rw / currentLanes;
  return canvas.width / 2 - rw / 2 + (lane + 0.5) * lw;
}

// Uniform scale factor: 1.0 at player.y, minimum ~0.18 at horizon
function scaleAt(y) {
  return Math.max(HORIZON_MIN_W * 0.65, perspT(y));
}

// ── STAGE MANAGEMENT ─────────────────────────────────────────────
function applyStage(idx, msg) {
  const stg       = STAGES[idx];
  currentStageIdx = idx;
  currentObsFreq  = stg.obsFreq;
  currentFwFreq   = stg.fwFreq;
  currentObsTypes = stg.obsTypes;
  currentFwType   = stg.fwType;
  currentSpeed    = stg.speed;
  setLanes(stg.lanes);
  if (msg) showTransition(msg, 160);
  obstacles = []; collectibles = []; splashes = [];
  initBgDecor();
  updateLegend(idx);
}

function setLanes(n) {
  currentLanes = n;
  const max = n - 1;
  if (player.targetLane > max) player.targetLane = max;
  if (player.lane      > max) player.lane       = max;
  player.x = getLaneX(player.targetLane);
}

function showTransition(text, life) {
  transitionMsg = { text, life, maxLife: life };
}

// ── BG DECOR POOL ────────────────────────────────────────────────
// offX stored as fraction 0-1 of bank width (not pixels) for perspective use
function initBgDecor() {
  bgDecor = [];
  const dt    = DECOR_THEMES[currentStageIdx];
  const poolH = canvas.height * 2.2;
  for (let i = 0; i < 28; i++) {
    const ti = Math.floor(Math.random() * dt.types.length);
    bgDecor.push({
      type: dt.types[ti], hue: dt.hues[ti],
      side: Math.random() < 0.5 ? 'L' : 'R',
      offX: 0.08 + Math.random() * 0.84,  // fraction of bank width
      y:    Math.random() * poolH,
      sz:   5 + Math.random() * 9,
    });
  }
}

// ── DRAW: BACKGROUND (PERSPECTIVE) ───────────────────────────────
function drawBackground() {
  const W  = canvas.width, H = canvas.height;
  const hy = horizonY();
  const th = BG_THEMES[currentStageIdx];

  // Sky strip: HUD bottom to horizon
  const skyGrad = ctx.createLinearGradient(0, HUD_H, 0, hy);
  skyGrad.addColorStop(0, th.skyTop);
  skyGrad.addColorStop(1, th.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, HUD_H, W, hy - HUD_H);

  // Per-stage horizon art (mountains, canyon walls, etc.)
  drawHorizonArt(W, hy, th);

  // Thin horizon glow line
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = th.cc; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
  ctx.restore();

  // River trapezoid — flat top at widened horizon, fans out toward player
  const botLx = riverLeftAt(H), botRx = W - botLx;
  const topLx = riverLeftAt(hy), topRx = W - topLx;
  const riverGrad = ctx.createLinearGradient(0, hy, 0, H);
  riverGrad.addColorStop(0,   th.wm);
  riverGrad.addColorStop(0.5, th.we);
  riverGrad.addColorStop(1,   th.wm);
  ctx.fillStyle = riverGrad;
  ctx.beginPath();
  ctx.moveTo(topLx, hy);
  ctx.lineTo(topRx, hy);
  ctx.lineTo(botRx, H);
  ctx.lineTo(botLx, H);
  ctx.closePath(); ctx.fill();

  // Stage 5 dry patch overlay
  if (currentStageIdx === 4 && currentMile > 148) {
    const dry = Math.min(1, (currentMile - 148) / 17);
    ctx.save(); ctx.globalAlpha = dry * 0.38; ctx.fillStyle = '#D97706';
    for (let i = 0; i < 9; i++) {
      const t_ = 0.2 + (i * 0.085) % 0.6;
      const py_ = hy + t_ * (H - hy);
      const lx_ = riverLeftAt(py_), rw_ = riverWidthAt(py_);
      const px  = lx_ + ((i * 67 + 23) % Math.max(1, rw_ - 20));
      const off = (bgScrollY * 0.4 + i * 50) % (H - hy);
      ctx.beginPath(); ctx.ellipse(px, hy + off, 12+i%6, 6+i%4, i*0.4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Perspective flow lines inside river
  drawFlowLines(W, hy, th);

  // Lane dividers — two-segment: vertical through HORIZON_MIN_W zone, then angled,
  // matching riverWidthAt() exactly so items never drift relative to dividers
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 1;
  const yTrans = hy + HORIZON_MIN_W * (player.y - hy);
  for (let l = 1; l < currentLanes; l++) {
    const transX = topLx + l * (riverWidthAt(hy) / currentLanes);
    const botX   = riverLeftAt(H) + l * (riverWidthAt(H) / currentLanes);
    ctx.beginPath();
    ctx.moveTo(transX, hy);
    ctx.lineTo(transX, yTrans);
    ctx.lineTo(botX,   H);
    ctx.stroke();
  }
  ctx.restore();

  // Left bank trapezoid
  const lbGrad = ctx.createLinearGradient(0, hy, 0, H);
  lbGrad.addColorStop(0, th.bl); lbGrad.addColorStop(1, th.bd);
  ctx.fillStyle = lbGrad;
  ctx.beginPath();
  ctx.moveTo(0, hy); ctx.lineTo(topLx, hy);
  ctx.lineTo(botLx, H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();

  // Right bank trapezoid
  const rbGrad = ctx.createLinearGradient(0, hy, 0, H);
  rbGrad.addColorStop(0, th.bl); rbGrad.addColorStop(1, th.bd);
  ctx.fillStyle = rbGrad;
  ctx.beginPath();
  ctx.moveTo(topRx, hy); ctx.lineTo(W, hy);
  ctx.lineTo(W, H); ctx.lineTo(botRx, H);
  ctx.closePath(); ctx.fill();

  // Stage 4 canyon wall striations
  if (currentStageIdx === 3) {
    ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = '#57534E'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const t_ = 0.12 + i * 0.18;
      const sy  = hy + t_ * (H - hy);
      const lx_ = riverLeftAt(sy);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(lx_ * 1.05, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, sy); ctx.lineTo(W - lx_ * 1.05, sy); ctx.stroke();
    }
    ctx.restore();
  }

  drawBankDecor();
}

// Per-stage scenery in the sky/horizon strip above horizonY
function drawHorizonArt(W, hy, th) {
  const stripH = hy - HUD_H;
  if (stripH < 4) return;

  if (currentStageIdx === 0) {
    // Stage 1: Sierra Nevada — use bg photo if loaded
    if (bgSceneLoaded) {
      ctx.save();
      ctx.globalAlpha = 0.90;
      ctx.drawImage(bgSceneImg, 0, HUD_H, W, stripH);
      ctx.restore();
    } else {
      drawMountainSilhouette(W, hy, stripH, th.mtFill, th.mtSnow, true);
    }
    return;
  }

  if (currentStageIdx === 1) {
    // Stage 2: Upper Kern — red rocky peaks
    drawMountainSilhouette(W, hy, stripH, th.mtFill, th.mtSnow, false);
    return;
  }

  if (currentStageIdx === 2) {
    // Stage 3: Lake Isabella — softer hills, teal sky
    ctx.save(); ctx.globalAlpha = 0.40; ctx.fillStyle = '#164E63';
    ctx.fillRect(0, HUD_H, W, stripH); ctx.restore();
    drawMountainSilhouette(W, hy, stripH, th.mtFill, th.mtSnow, false);
    return;
  }

  if (currentStageIdx === 3) {
    // Stage 4: Kern Canyon — dark canyon walls framing a narrow opening
    ctx.fillStyle = '#0C0A09'; ctx.fillRect(0, HUD_H, W, stripH);
    ctx.save(); ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.moveTo(0, HUD_H); ctx.lineTo(W * 0.34, HUD_H);
    ctx.lineTo(W * 0.12, hy); ctx.lineTo(0, hy); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, HUD_H); ctx.lineTo(W * 0.66, HUD_H);
    ctx.lineTo(W * 0.88, hy); ctx.lineTo(W, hy); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  if (currentStageIdx === 4) {
    // Stage 5: Bakersfield — flat scrubland, warm amber horizon
    const flat = ctx.createLinearGradient(0, HUD_H, 0, hy);
    flat.addColorStop(0, '#0B1F3A'); flat.addColorStop(1, '#1A3D5C');
    ctx.fillStyle = flat; ctx.fillRect(0, HUD_H, W, stripH);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#92400E';
    ctx.fillRect(0, hy - Math.ceil(stripH * 0.30), W, Math.ceil(stripH * 0.30));
    ctx.restore();
    return;
  }
}

function drawMountainSilhouette(W, hy, stripH, fillCol, snowCol, doSnow) {
  const peaks = [
    [0.04,0.30], [0.16,0.07], [0.27,0.38], [0.40,0.13],
    [0.54,0.42], [0.66,0.09], [0.77,0.32], [0.89,0.19], [1.00,0.48],
  ];
  ctx.save();
  ctx.fillStyle = fillCol;
  ctx.beginPath(); ctx.moveTo(0, hy);
  for (const [fx, fh] of peaks) {
    ctx.lineTo(fx * W, HUD_H + fh * stripH);
  }
  ctx.lineTo(W, hy); ctx.closePath(); ctx.fill();

  if (doSnow) {
    ctx.fillStyle = snowCol; ctx.globalAlpha = 0.82;
    for (const [fx, fh] of peaks) {
      const px = fx * W, py = HUD_H + fh * stripH, capH = stripH * 0.13;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - capH * 0.72, py + capH);
      ctx.lineTo(px + capH * 0.72, py + capH);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// Animated flow lines — perspective-correct widths at each y
function drawFlowLines(W, hy, th) {
  const span = player.y - hy;
  if (span <= 0) return;
  const scrollFrac = (bgScrollY * 0.42) % span;

  ctx.save();
  ctx.globalAlpha = th.ca * 0.85;
  ctx.strokeStyle = th.cc;
  ctx.lineWidth   = 0.85;

  const N = 12;
  for (let n = 0; n < N; n++) {
    // Linear t scrolled and looped, then squared for perspective compression
    const t0   = n / N;
    const tRaw = (t0 + scrollFrac / span) % 1.0;
    const t    = tRaw * tRaw;   // compress lines toward horizon
    const lineY = hy + t * span;
    const lx   = riverLeftAt(lineY), rx = W - lx;
    if (lx >= rx) continue;
    ctx.beginPath(); ctx.moveTo(lx, lineY); ctx.lineTo(rx, lineY); ctx.stroke();
  }
  ctx.restore();
}

// ── BANK DECOR (PERSPECTIVE-AWARE) ───────────────────────────────
function drawBankDecor() {
  const W    = canvas.width, H = canvas.height;
  const hy   = horizonY();
  const pool = H * 2.2;
  const th   = BG_THEMES[currentStageIdx];

  for (const d of bgDecor) {
    const rawY = (d.y + bgScrollY * 0.9) % pool;
    const sy   = rawY - H * 0.1;
    if (sy < hy) continue;       // don't place decor in sky strip
    if (sy > H + d.sz * 3) continue;

    const bwAtY = Math.max(1, (W - riverWidthAt(sy)) / 2);
    const sx    = d.side === 'L' ? d.offX * bwAtY : W - d.offX * bwAtY;
    const sc    = Math.max(0.15, scaleAt(sy));
    const sz    = d.sz * sc * 1.25;

    if (d.type === 'tree') {
      ctx.fillStyle = d.hue;
      ctx.beginPath();
      ctx.moveTo(sx, sy-sz);
      ctx.lineTo(sx-sz*0.7, sy+sz*0.55);
      ctx.lineTo(sx+sz*0.7, sy+sz*0.55);
      ctx.closePath(); ctx.fill();
      if (th.snow) {
        ctx.save(); ctx.fillStyle = '#EFF6FF'; ctx.globalAlpha = 0.52;
        ctx.beginPath();
        ctx.moveTo(sx, sy-sz);
        ctx.lineTo(sx-sz*0.22, sy-sz*0.25);
        ctx.lineTo(sx+sz*0.22, sy-sz*0.25);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    } else if (d.type === 'cottonwood') {
      ctx.fillStyle = d.hue;
      ctx.beginPath(); ctx.ellipse(sx, sy, sz*0.8, sz*0.65, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = th.bd;
      ctx.fillRect(sx-2*sc, sy+sz*0.5, 4*sc, sz*0.65);
    } else if (d.type === 'dock') {
      ctx.fillStyle = '#44403C';
      ctx.fillRect(sx-2*sc, sy-sz*0.5, 4*sc, sz*1.2);
      ctx.fillStyle = '#57534E';
      ctx.fillRect(sx-2*sc, sy-sz*0.5, 4*sc, 2*sc);
    } else {
      ctx.fillStyle = d.hue;
      ctx.beginPath(); ctx.ellipse(sx, sy, sz, sz*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.fillStyle = '#EFF6FF'; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.ellipse(sx, sy-sz*0.12, sz*0.5, sz*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}

// ── SHADOW HELPER ────────────────────────────────────────────────
function clearShadow() {
  ctx.shadowColor   = 'transparent';
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ── DRAW: OBSTACLES ──────────────────────────────────────────────
function drawObstacles() {
  const hy = horizonY();
  for (const obs of obstacles) {
    if (obs.resolved && obs.y > canvas.height) continue;
    if (obs.y + obs.h < hy) continue;  // still above horizon — not visible
    obs.fullWidth ? drawFullWidthObs(obs) : drawLaneObs(obs);
  }
}

// ── DRAW: FULL-WIDTH OBSTACLES ───────────────────────────────────
function jumpLabelAt(obs) {
  const t = perspT(obs.y);
  if (t > 0.18 && t < 0.96) {
    const sc = Math.min(1.0, t);
    ctx.save(); clearShadow();
    ctx.font = `${Math.max(5, Math.round(8 * sc))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#FDE68A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('JUMP!', canvas.width / 2, obs.y + obs.h * 0.5);
    ctx.restore();
  }
}

function drawFullWidthObs(obs) {
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.62)';
  ctx.shadowBlur    = 16 * scaleAt(obs.y);
  ctx.shadowOffsetY = 8  * scaleAt(obs.y);
  switch (obs.type) {
    case 'wooden_bridge':    drawWoodenBridge(obs);    break;
    case 'tube_procession':  drawTubeProcession(obs);  break;
    case 'tube_riders':      drawTubeRiders(obs);      break;
    case 'fallen_sequoia':   drawFallenSequoia(obs);   break;
    case 'raft_train':       drawRaftTrain(obs);       break;
    case 'pontoon_party':    drawPontoonParty(obs);    break;
    case 'old_mining_bridge':drawOldMiningBridge(obs); break;
    case 'tube_float_parade':drawTubeFloatParade(obs); break;
    default:                 drawWoodenBridge(obs);    break;
  }
  ctx.restore();
}

function drawWoodenBridge(obs) {
  const W    = canvas.width;
  const topY = obs.y,  botY  = obs.y + obs.h;
  const topLx = riverLeftAt(topY), topRx = W - topLx;
  const botLx = riverLeftAt(botY), botRx = W - botLx;

  // Main plank body
  ctx.fillStyle = '#92400E';
  ctx.beginPath();
  ctx.moveTo(topLx, topY); ctx.lineTo(topRx, topY);
  ctx.lineTo(botRx, botY); ctx.lineTo(botLx, botY);
  ctx.closePath(); ctx.fill();

  // Top highlight strip
  const h3Y  = topY + (botY - topY) * 0.22;
  const h3Lx = riverLeftAt(h3Y), h3Rx = W - h3Lx;
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.moveTo(topLx, topY); ctx.lineTo(topRx, topY);
  ctx.lineTo(h3Rx, h3Y);  ctx.lineTo(h3Lx, h3Y);
  ctx.closePath(); ctx.fill();

  // Bottom shadow strip
  const shY  = botY - (botY - topY) * 0.22;
  const shLx = riverLeftAt(shY), shRx = W - shLx;
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.moveTo(shLx, shY); ctx.lineTo(shRx, shY);
  ctx.lineTo(botRx, botY); ctx.lineTo(botLx, botY);
  ctx.closePath(); ctx.fill();

  // Support posts
  ctx.save(); clearShadow();
  ctx.strokeStyle = '#5C2D0A';
  ctx.lineWidth   = Math.max(2, 3 * scaleAt(obs.y));
  for (let i = 0; i <= 4; i++) {
    const f   = i / 4;
    const ptx = topLx + f * (topRx - topLx);
    const pbx = botLx + f * (botRx - botLx);
    const esc = scaleAt(obs.y);
    ctx.beginPath();
    ctx.moveTo(ptx, topY - 5 * esc);
    ctx.lineTo(pbx, botY + 5 * esc);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(2, 4 * scaleAt(obs.y));
  ctx.strokeStyle = '#431D08';
  ctx.beginPath(); ctx.moveTo(topLx, topY - 3); ctx.lineTo(topRx, topY - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(botLx, botY + 3); ctx.lineTo(botRx, botY + 3); ctx.stroke();
  ctx.restore();

  jumpLabelAt(obs);
}

function drawTubeProcession(obs) {
  const W     = canvas.width;
  const cy    = obs.y + obs.h / 2;
  const rw    = riverWidthAt(cy);
  const lx    = riverLeftAt(cy);
  const sc    = scaleAt(cy);
  const tubeR = obs.h * 0.42 * sc;
  const spacing = tubeR * 2.3;
  const count   = Math.ceil(rw / spacing) + 1;

  ctx.save(); clearShadow();
  ctx.strokeStyle = '#92400E'; ctx.lineWidth = 2 * sc;
  ctx.beginPath(); ctx.moveTo(lx, cy); ctx.lineTo(lx + rw, cy); ctx.stroke();

  for (let i = 0; i < count; i++) {
    const tx = lx + (i + 0.5) * spacing;
    if (tx > lx + rw + tubeR) continue;
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 4 * sc;
    ctx.beginPath(); ctx.arc(tx, cy, tubeR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath(); ctx.arc(tx, cy, tubeR * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#FED7AA'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx, cy - tubeR*0.3, tubeR*0.65, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  jumpLabelAt(obs);
}

function drawTubeRiders(obs) {
  const W     = canvas.width;
  const cy    = obs.y + obs.h / 2;
  const rw    = riverWidthAt(cy);
  const lx    = riverLeftAt(cy);
  const sc    = scaleAt(cy);
  const tubeR = obs.h * 0.38 * sc;
  const posF  = [0.14, 0.37, 0.62, 0.83];

  ctx.save(); clearShadow();
  for (const pf of posF) {
    const tx = lx + pf * rw;
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 3.5 * sc;
    ctx.beginPath(); ctx.arc(tx, cy + tubeR*0.2, tubeR, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath(); ctx.arc(tx, cy + tubeR*0.2, tubeR*0.38, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath(); ctx.arc(tx, cy - tubeR*0.55, tubeR*0.30, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#92400E'; ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx - tubeR*0.5, cy - tubeR*0.35);
    ctx.lineTo(tx,              cy - tubeR*0.12);
    ctx.lineTo(tx + tubeR*0.5, cy - tubeR*0.35);
    ctx.stroke();
  }
  ctx.restore();
  jumpLabelAt(obs);
}

function drawFallenSequoia(obs) {
  const W = canvas.width;
  const topY = obs.y, botY = obs.y + obs.h;
  const topLx = riverLeftAt(topY), topRx = W - topLx;
  const botLx = riverLeftAt(botY), botRx = W - botLx;
  const sc = scaleAt(obs.y);
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.moveTo(topLx-4,topY); ctx.lineTo(topRx+4,topY);
  ctx.lineTo(botRx+4,botY); ctx.lineTo(botLx-4,botY);
  ctx.closePath(); ctx.fill();
  const midY = topY + (botY-topY)*0.35, midLx = riverLeftAt(midY), midRx = W-midLx;
  ctx.fillStyle = '#92400E';
  ctx.beginPath();
  ctx.moveTo(topLx-4,topY); ctx.lineTo(topRx+4,topY);
  ctx.lineTo(midRx+4,midY); ctx.lineTo(midLx-4,midY);
  ctx.closePath(); ctx.fill();
  ctx.save(); clearShadow(); ctx.strokeStyle = '#5C2002'; ctx.lineWidth = Math.max(1, 1.5*sc);
  ctx.globalAlpha = 0.30;
  for (let i = 1; i <= 4; i++) {
    const t=i/5, ty=topY+t*(botY-topY), lx=riverLeftAt(ty), rx=W-lx;
    ctx.beginPath(); ctx.moveTo(lx,ty); ctx.lineTo(rx,ty); ctx.stroke();
  }
  ctx.globalAlpha = 0.40; ctx.strokeStyle='#B45309'; ctx.lineWidth=1.5*sc;
  ctx.beginPath(); ctx.arc(botLx+8*sc, (topY+botY)/2, obs.h*0.35*sc, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  jumpLabelAt(obs);
}

function drawRaftTrain(obs) {
  const W = canvas.width;
  const cy = obs.y + obs.h/2, rw = riverWidthAt(cy), lx = riverLeftAt(cy), sc = scaleAt(cy);
  const raftH = obs.h*0.72*sc, raftW = rw*0.28;
  ctx.save(); clearShadow();
  for (let i = 0; i < 3; i++) {
    const rx = lx + rw*(0.12 + i*0.36);
    ctx.fillStyle = '#92400E'; ctx.fillRect(rx-raftW/2, cy-raftH/2, raftW, raftH);
    ctx.fillStyle = '#B45309'; ctx.fillRect(rx-raftW/2, cy-raftH/2, raftW, raftH*0.28);
    ctx.strokeStyle = '#78350F'; ctx.lineWidth = 1*sc;
    for (let p=1; p<=2; p++) {
      const px_=rx-raftW/2+p*raftW/3;
      ctx.beginPath(); ctx.moveTo(px_,cy-raftH/2); ctx.lineTo(px_,cy+raftH/2); ctx.stroke();
    }
    if (i < 2) {
      const nrx = lx + rw*(0.12+(i+1)*0.36);
      ctx.strokeStyle='#78350F'; ctx.lineWidth=2*sc;
      ctx.beginPath(); ctx.moveTo(rx+raftW/2,cy); ctx.lineTo(nrx-raftW/2,cy); ctx.stroke();
    }
  }
  ctx.restore(); jumpLabelAt(obs);
}

function drawPontoonParty(obs) {
  const W = canvas.width;
  const topY=obs.y, botY=obs.y+obs.h;
  const topLx=riverLeftAt(topY), topRx=W-topLx;
  const botLx=riverLeftAt(botY), botRx=W-botLx;
  const sc=scaleAt(obs.y);
  ctx.fillStyle='#1D4ED8';
  ctx.beginPath();
  ctx.moveTo(topLx,topY); ctx.lineTo(topRx,topY);
  ctx.lineTo(botRx,botY); ctx.lineTo(botLx,botY);
  ctx.closePath(); ctx.fill();
  const deckY=topY+(botY-topY)*0.42, dLx=riverLeftAt(deckY), dRx=W-dLx;
  ctx.fillStyle='rgba(239,246,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(topLx,topY); ctx.lineTo(topRx,topY);
  ctx.lineTo(dRx,deckY); ctx.lineTo(dLx,deckY);
  ctx.closePath(); ctx.fill();
  const colors=['#F97316','#FBBF24','#34D399','#F97316'], fw=topRx-topLx;
  ctx.save(); clearShadow();
  for (let i=0;i<4;i++) {
    ctx.fillStyle=colors[i];
    ctx.beginPath(); ctx.arc(topLx+fw*(0.15+i*0.22), topY-3*sc, 3*sc, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore(); jumpLabelAt(obs);
}

function drawOldMiningBridge(obs) {
  const W=canvas.width;
  const topY=obs.y, botY=obs.y+obs.h;
  const topLx=riverLeftAt(topY), topRx=W-topLx;
  const botLx=riverLeftAt(botY), botRx=W-botLx;
  const sc=scaleAt(obs.y);
  ctx.fillStyle='#44403C';
  ctx.beginPath();
  ctx.moveTo(topLx,topY); ctx.lineTo(topRx,topY);
  ctx.lineTo(botRx,botY); ctx.lineTo(botLx,botY);
  ctx.closePath(); ctx.fill();
  const h3Y=topY+(botY-topY)*0.22, h3Lx=riverLeftAt(h3Y), h3Rx=W-h3Lx;
  ctx.fillStyle='#78350F';
  ctx.beginPath();
  ctx.moveTo(topLx,topY); ctx.lineTo(topRx,topY); ctx.lineTo(h3Rx,h3Y); ctx.lineTo(h3Lx,h3Y);
  ctx.closePath(); ctx.fill();
  ctx.save(); clearShadow();
  ctx.strokeStyle='#292524'; ctx.lineWidth=Math.max(3,4*sc); ctx.lineCap='butt';
  for (let i=0; i<=4; i++) {
    const f=i/4;
    ctx.beginPath();
    ctx.moveTo(topLx+f*(topRx-topLx), topY-6*sc);
    ctx.lineTo(botLx+f*(botRx-botLx), botY+6*sc); ctx.stroke();
  }
  ctx.lineWidth=Math.max(2,3*sc); ctx.strokeStyle='#1C1917';
  ctx.beginPath(); ctx.moveTo(topLx,topY); ctx.lineTo(topRx,topY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(botLx,botY); ctx.lineTo(botRx,botY); ctx.stroke();
  ctx.restore(); jumpLabelAt(obs);
}

function drawTubeFloatParade(obs) {
  const W=canvas.width;
  const cy=obs.y+obs.h/2, rw=riverWidthAt(cy), lx=riverLeftAt(cy), sc=scaleAt(cy);
  const tubeR=obs.h*0.42*sc;
  const colors=['#F97316','#3B82F6','#F472B6','#34D399'];
  const posF=[0.14,0.37,0.62,0.83];
  ctx.save(); clearShadow();
  for (let i=0; i<posF.length; i++) {
    const tx=lx+posF[i]*rw;
    ctx.strokeStyle=colors[i%colors.length]; ctx.lineWidth=4*sc;
    ctx.beginPath(); ctx.arc(tx, cy+tubeR*0.15, tubeR, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(tx, cy+tubeR*0.15, tubeR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#FBBF24';
    ctx.beginPath(); ctx.arc(tx, cy-tubeR*0.60, tubeR*0.30, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#92400E'; ctx.lineWidth=1.8*sc; ctx.lineCap='round';
    const wave=Math.sin(obs.y*0.04+i*1.2)*0.35;
    ctx.beginPath();
    ctx.moveTo(tx-tubeR*0.52, cy-tubeR*(0.22+wave));
    ctx.lineTo(tx,              cy-tubeR*0.10);
    ctx.lineTo(tx+tubeR*0.52, cy-tubeR*(0.22-wave));
    ctx.stroke();
  }
  ctx.restore(); jumpLabelAt(obs);
}

// ── DRAW: LANE OBSTACLES (PERSPECTIVE-SCALED) ────────────────────
function drawLaneObs(obs) {
  const sc  = scaleAt(obs.y);
  const lw_ = Math.max(1, riverWidthAt(obs.y) / currentLanes);
  const cx  = laneXAt(obs.lane, obs.y);
  const r   = Math.min(lw_ * 0.44, obs.h * 0.68 * sc);

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur    = 14 * sc;
  ctx.shadowOffsetY = 8  * sc;
  ctx.shadowOffsetX = 2  * sc;
  drawObsAt(obs.type, cx, obs.y, r, lw_);
  ctx.restore();

  // Depth: soft top-left light highlight gives obstacles a 3-D quality
  ctx.save(); clearShadow();
  ctx.globalAlpha = 0.16;
  const hiG = ctx.createRadialGradient(cx - r*0.32, obs.y - r*0.42, r*0.04, cx, obs.y, r*1.08);
  hiG.addColorStop(0,    'rgba(255,255,255,1)');
  hiG.addColorStop(0.48, 'rgba(255,255,255,0)');
  hiG.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = hiG;
  ctx.beginPath(); ctx.arc(cx, obs.y, r*1.08, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// Core sprite renderer — all params are already perspective-corrected by caller
function drawObsAt(type, cx, cy, r, lw_) {
  if (type === 'rock') {
    ctx.fillStyle = '#5D6875';
    ctx.beginPath();
    ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r*0.9, cy-r*0.15);
    ctx.lineTo(cx+r*0.7, cy+r*0.8); ctx.lineTo(cx-r*0.7, cy+r*0.8);
    ctx.lineTo(cx-r*0.9, cy-r*0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.3, cy-r*0.9); ctx.lineTo(cx+r*0.4, cy-r*0.45); ctx.lineTo(cx-r*0.1, cy-r*0.1);
    ctx.closePath(); ctx.fill();

  } else if (type === 'branch') {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#92400E'; ctx.lineWidth = Math.max(4, r*0.5);
    ctx.beginPath(); ctx.moveTo(cx-r*0.85, cy-r*0.7); ctx.lineTo(cx+r*0.85, cy+r*0.7); ctx.stroke();
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx+i*r*0.22, cy+i*r*0.22);
      ctx.lineTo(cx+i*r*0.22+r*0.30, cy+i*r*0.22-r*0.30); ctx.stroke();
    }
    ctx.restore();

  } else if (type === 'roots') {
    ctx.save(); ctx.strokeStyle = '#78350F'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-r*0.9, cy-r*0.3);
    ctx.quadraticCurveTo(cx-r*0.1, cy-r*0.85, cx+r*0.5, cy-r*0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-r*0.4, cy+r*0.5);
    ctx.quadraticCurveTo(cx+r*0.4, cy-r*0.35, cx+r*0.9, cy+r*0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-r*0.1, cy-r*0.6);
    ctx.quadraticCurveTo(cx+r*0.2, cy+r*0.5, cx+r*0.4, cy+r*0.9); ctx.stroke();
    ctx.restore();

  } else if (type === 'rapids' || type === 'wave') {
    const intense = type === 'wave' ? 0.88 : 0.72;
    ctx.fillStyle = type === 'wave' ? '#1D4ED8' : '#60A5FA';
    ctx.fillRect(cx - lw_*0.42, cy-r, lw_*0.84, r*2);
    ctx.save(); ctx.globalAlpha = intense; ctx.fillStyle = '#EFF6FF';
    const step = type === 'wave' ? 7 : 9;
    for (let wy = cy-r+2; wy < cy+r; wy += step) {
      ctx.beginPath(); ctx.arc(cx-r*0.3, wy+4, type==='wave'?5:4, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+r*0.3, wy+1, 3, Math.PI, 0); ctx.fill();
      if (type==='wave') { ctx.beginPath(); ctx.arc(cx, wy+5, 3, Math.PI, 0); ctx.fill(); }
    }
    ctx.restore();

  } else if (type === 'boulder') {
    ctx.fillStyle = '#7C2D12';
    ctx.beginPath();
    ctx.moveTo(cx, cy-r*1.05); ctx.lineTo(cx+r, cy-r*0.15);
    ctx.lineTo(cx+r*0.8, cy+r*0.85); ctx.lineTo(cx-r*0.8, cy+r*0.85);
    ctx.lineTo(cx-r, cy-r*0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#A16207';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.25, cy-r*0.85); ctx.lineTo(cx+r*0.45, cy-r*0.3); ctx.lineTo(cx+r*0.05, cy+r*0.05);
    ctx.closePath(); ctx.fill();

  } else if (type === 'kayak_traffic') {
    const kw = Math.min(r*0.7, 9), kh = Math.min(r*1.3, 18);
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#DC2626';
    ctx.beginPath(); ctx.moveTo(0,-kh);
    ctx.bezierCurveTo(kw,-kh*0.6,kw,kh*0.6,0,kh);
    ctx.bezierCurveTo(-kw,kh*0.6,-kw,-kh*0.6,0,-kh); ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath(); ctx.arc(0,-kh*0.1,kw*0.35,0,Math.PI*2); ctx.fill();
    ctx.restore();

  } else if (type === 'piling') {
    ctx.fillStyle = '#44403C'; ctx.fillRect(cx-r*0.35, cy-r, r*0.7, r*2);
    ctx.fillStyle = '#57534E'; ctx.fillRect(cx-r*0.35, cy-r, r*0.7, 3);
    ctx.save(); ctx.strokeStyle = '#292524'; ctx.lineWidth = 0.8;
    for (let wy = cy-r+6; wy < cy+r-2; wy += 5) {
      ctx.beginPath(); ctx.moveTo(cx-r*0.32,wy); ctx.lineTo(cx+r*0.32,wy); ctx.stroke();
    }
    ctx.restore();

  } else if (type === 'fishing') {
    ctx.save(); ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy-r);
    ctx.quadraticCurveTo(cx+r*0.6, cy, cx+r*0.3, cy+r); ctx.stroke();
    ctx.strokeStyle = '#6B7280'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(cx+r*0.3, cy+r-3, 3, -Math.PI*0.5, Math.PI); ctx.stroke();
    ctx.restore();

  } else if (type === 'cooler') {
    ctx.fillStyle = '#2563EB'; ctx.fillRect(cx-r*0.75, cy-r*0.45, r*1.5, r*0.9);
    ctx.fillStyle = '#EFF6FF'; ctx.fillRect(cx-r*0.75, cy-r*0.45, r*1.5, r*0.20);
    ctx.fillStyle = '#60A5FA'; ctx.fillRect(cx-r*0.22, cy-r*0.47, r*0.44, r*0.10);

  } else if (type === 'rockslide') {
    const offs = [[-0.5,-0.22],[0.3,0.1],[-0.1,0.42],[0.55,-0.38]];
    for (const [ox,oy] of offs) {
      const rs = r*0.42; ctx.fillStyle = '#44403C';
      ctx.beginPath();
      ctx.moveTo(cx+ox*r, cy+oy*r-rs); ctx.lineTo(cx+ox*r+rs*0.8, cy+oy*r);
      ctx.lineTo(cx+ox*r, cy+oy*r+rs*0.7); ctx.lineTo(cx+ox*r-rs*0.8, cy+oy*r);
      ctx.closePath(); ctx.fill();
    }

  } else if (type === 'cone') {
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.moveTo(cx, cy-r*0.9); ctx.lineTo(cx+r*0.5, cy+r*0.7); ctx.lineTo(cx-r*0.5, cy+r*0.7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#EFF6FF'; ctx.fillRect(cx-r*0.42, cy+r*0.08, r*0.84, r*0.18);

  } else if (type === 'barrier') {
    ctx.fillStyle = '#D1D5DB'; ctx.fillRect(cx-r*0.65, cy-r*0.52, r*1.3, r*1.04);
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.65, cy-r*0.52); ctx.lineTo(cx-r*0.48, cy-r*0.74);
    ctx.lineTo(cx+r*0.48, cy-r*0.74); ctx.lineTo(cx+r*0.65, cy-r*0.52);
    ctx.closePath(); ctx.fill();

  } else if (type === 'crack') {
    ctx.save(); ctx.strokeStyle = '#1C1917'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.7, cy-r*0.6); ctx.lineTo(cx-r*0.2, cy-r*0.1);
    ctx.lineTo(cx+r*0.4, cy+r*0.3); ctx.lineTo(cx+r*0.7, cy+r*0.7); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx-r*0.2, cy-r*0.1); ctx.lineTo(cx-r*0.6, cy+r*0.45); ctx.stroke();
    ctx.restore();

  } else if (type === 'tumbleweed') {
    ctx.save(); ctx.strokeStyle = '#A16207'; ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(161,98,7,0.15)';
    ctx.beginPath(); ctx.arc(cx, cy, r*0.72, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    for (let a = 0; a < Math.PI*2; a += Math.PI/6) {
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*r*0.30, cy+Math.sin(a)*r*0.30);
      ctx.lineTo(cx+Math.cos(a)*r*0.78, cy+Math.sin(a)*r*0.78); ctx.stroke();
    }
    ctx.restore();

  } else if (type === 'sandbar') {
    ctx.fillStyle = '#D97706';
    ctx.beginPath(); ctx.ellipse(cx, cy, lw_*0.42, r*0.88, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath(); ctx.ellipse(cx-r*0.1, cy-r*0.12, lw_*0.22, r*0.44, 0, 0, Math.PI*2); ctx.fill();

  } else if (type === 'river_wash') {
    ctx.save();
    ctx.fillStyle = 'rgba(56,189,248,0.20)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    // Swirl arcs
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i===0 ? '#38BDF8' : i===1 ? '#7DD3FC' : '#EFF6FF';
      ctx.lineWidth   = Math.max(1.2, r * 0.17);
      ctx.globalAlpha = 0.88 - i * 0.22;
      ctx.beginPath(); ctx.arc(cx, cy, r * (0.35 + i * 0.27), 0, Math.PI * 1.4); ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#EFF6FF';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, Math.PI*2); ctx.fill();
    ctx.restore();

  } else if (type === 'deadfall_log') {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#44403C'; ctx.lineWidth = Math.max(7, r * 0.85);
    ctx.beginPath(); ctx.moveTo(cx-r, cy-r*0.2); ctx.lineTo(cx+r, cy+r*0.2); ctx.stroke();
    ctx.strokeStyle = '#57534E'; ctx.lineWidth = Math.max(2, r * 0.25);
    ctx.beginPath(); ctx.moveTo(cx-r, cy-r*0.2); ctx.lineTo(cx+r, cy+r*0.2); ctx.stroke();
    ctx.strokeStyle = '#292524'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx-r*0.75, cy-r*0.12, r*0.22, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

  } else if (type === 'capsized_raft') {
    ctx.save();
    ctx.fillStyle = '#57534E';
    ctx.beginPath(); ctx.ellipse(cx, cy, lw_*0.44, r*0.52, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#292524'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * lw_*0.14, cy - r*0.52);
      ctx.lineTo(cx + i * lw_*0.14, cy + r*0.52); ctx.stroke();
    }
    ctx.fillStyle = '#92400E';
    ctx.beginPath(); ctx.arc(cx + lw_*0.3, cy - r*0.35, r*0.18, 0, Math.PI*2); ctx.fill();
    ctx.restore();

  } else if (type === 'drifting_sailboat') {
    ctx.save();
    ctx.fillStyle = '#1E3A5F';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.75, cy+r*0.28); ctx.lineTo(cx+r*0.75, cy+r*0.28);
    ctx.lineTo(cx+r*0.45, cy+r*0.75); ctx.lineTo(cx-r*0.45, cy+r*0.75);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#EFF6FF'; ctx.fillRect(cx-r*0.75, cy+r*0.18, r*1.5, r*0.18);
    ctx.strokeStyle = '#57534E'; ctx.lineWidth = Math.max(1.5, r*0.12);
    ctx.beginPath(); ctx.moveTo(cx, cy+r*0.28); ctx.lineTo(cx, cy-r*0.88); ctx.stroke();
    ctx.fillStyle = 'rgba(239,246,255,0.90)';
    ctx.beginPath();
    ctx.moveTo(cx, cy-r*0.82); ctx.lineTo(cx+r*0.72, cy-r*0.04); ctx.lineTo(cx, cy+r*0.24);
    ctx.closePath(); ctx.fill();
    ctx.restore();

  } else if (type === 'mine_cart') {
    ctx.save();
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.moveTo(cx-r*0.72, cy-r*0.52); ctx.lineTo(cx+r*0.72, cy-r*0.52);
    ctx.lineTo(cx+r*0.55, cy+r*0.42); ctx.lineTo(cx-r*0.55, cy+r*0.42);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#292524'; ctx.fillRect(cx-r*0.72, cy-r*0.56, r*1.44, r*0.22);
    ctx.fillStyle = '#44403C';
    ctx.beginPath(); ctx.arc(cx-r*0.40, cy+r*0.58, r*0.25, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+r*0.40, cy+r*0.58, r*0.25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#57534E';
    ctx.beginPath(); ctx.arc(cx-r*0.40, cy+r*0.58, r*0.11, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+r*0.40, cy+r*0.58, r*0.11, 0, Math.PI*2); ctx.fill();
    ctx.restore();

  } else if (type === 'shopping_cart') {
    ctx.save(); ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = Math.max(1.5, r*0.13); ctx.lineCap = 'round';
    ctx.strokeRect(cx-r*0.62, cy-r*0.52, r*1.24, r*1.0);
    ctx.beginPath(); ctx.moveTo(cx-r*0.20, cy-r*0.52); ctx.lineTo(cx-r*0.20, cy+r*0.48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+r*0.20, cy-r*0.52); ctx.lineTo(cx+r*0.20, cy+r*0.48); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-r*0.48, cy-r*0.52); ctx.lineTo(cx-r*0.48, cy-r*0.88);
    ctx.lineTo(cx+r*0.62, cy-r*0.88); ctx.stroke();
    ctx.fillStyle = '#6B7280';
    ctx.beginPath(); ctx.arc(cx-r*0.35, cy+r*0.62, r*0.20, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+r*0.35, cy+r*0.62, r*0.20, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── DRAW: SPLASHES ───────────────────────────────────────────────
function spawnSplash(x, y) {
  splashes.push({ x, y, life: 26, maxLife: 26 });
}

function drawSplashes() {
  for (const sp of splashes) {
    const t = 1 - sp.life / sp.maxLife;
    const r = 4 + 20 * t;
    const a = (sp.life / sp.maxLife) * 0.52;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = '#BAE6FD'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r, r*0.36, 0, 0, Math.PI*2); ctx.stroke();
    if (t < 0.45) {
      ctx.globalAlpha = a*0.5;
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r*0.42, r*0.42*0.36, 0, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
}

// ── DRAW: COLLECTIBLE SPRITES ────────────────────────────────────
function drawDrop(x, y, s) {
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(x, y-s);
  ctx.bezierCurveTo(x+s*0.7, y-s*0.3, x+s*0.7, y+s*0.5, x, y+s*0.6);
  ctx.bezierCurveTo(x-s*0.7, y+s*0.5, x-s*0.7, y-s*0.3, x, y-s);
  ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = '#BAE6FD';
  ctx.beginPath(); ctx.ellipse(x-s*0.18, y-s*0.25, s*0.18, s*0.32, -0.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawFish(x, y, s) {
  ctx.fillStyle = '#34D399';
  ctx.beginPath(); ctx.ellipse(x-s*0.1, y, s*0.75, s*0.38, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x+s*0.6, y); ctx.lineTo(x+s*1.2, y-s*0.42); ctx.lineTo(x+s*1.2, y+s*0.42);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0B1F3A';
  ctx.beginPath(); ctx.arc(x-s*0.4, y-s*0.07, s*0.12, 0, Math.PI*2); ctx.fill();
}

function drawPoppy(x, y, s) {
  const angles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
  for (const a of angles) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = (a===0||a===Math.PI) ? '#F97316' : '#FB923C';
    ctx.beginPath(); ctx.ellipse(0, -s*0.55, s*0.30, s*0.55, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath(); ctx.arc(x, y, s*0.28, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#78350F';
  ctx.beginPath(); ctx.arc(x, y, s*0.12, 0, Math.PI*2); ctx.fill();
}

function drawGoldenTrout(x, y, s) {
  ctx.fillStyle='#FBBF24';
  ctx.beginPath(); ctx.ellipse(x-s*0.12, y, s*0.78, s*0.40, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x+s*0.60,y); ctx.lineTo(x+s*1.22,y-s*0.45); ctx.lineTo(x+s*1.22,y+s*0.45);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#F59E0B';
  ctx.beginPath(); ctx.ellipse(x-s*0.12, y, s*0.52, s*0.25, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#0B1F3A';
  ctx.beginPath(); ctx.arc(x-s*0.42, y-s*0.08, s*0.12, 0, Math.PI*2); ctx.fill();
}

function drawMountainCrystal(x, y, s) {
  ctx.fillStyle='#A5F3FC';
  ctx.beginPath();
  ctx.moveTo(x, y-s); ctx.lineTo(x+s*0.72, y-s*0.22); ctx.lineTo(x+s*0.55, y+s*0.78);
  ctx.lineTo(x-s*0.55, y+s*0.78); ctx.lineTo(x-s*0.72, y-s*0.22);
  ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha=0.80; ctx.fillStyle='#E0F9FF';
  ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s*0.72,y-s*0.22); ctx.lineTo(x,y-s*0.10);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha=0.65; ctx.fillStyle='#38BDF8';
  ctx.beginPath(); ctx.moveTo(x,y-s*0.10); ctx.lineTo(x-s*0.55,y+s*0.78); ctx.lineTo(x+s*0.55,y+s*0.78);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawFishingLure(x, y, s) {
  ctx.fillStyle='#EF4444';
  ctx.beginPath(); ctx.ellipse(x, y, s*0.42, s*0.78, 0, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.globalAlpha=0.7; ctx.fillStyle='#FCA5A5';
  ctx.beginPath(); ctx.ellipse(x-s*0.12, y-s*0.22, s*0.22, s*0.42, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.strokeStyle='#9CA3AF'; ctx.lineWidth=s*0.14; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(x+s*0.12, y+s*0.62, s*0.28, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

function drawGoldenEagleFeather(x, y, s) {
  ctx.save(); ctx.fillStyle='#C9883A';
  ctx.beginPath();
  ctx.moveTo(x, y-s*0.88);
  ctx.bezierCurveTo(x+s*0.48,y-s*0.40, x+s*0.52,y+s*0.40, x,y+s*0.75);
  ctx.bezierCurveTo(x-s*0.52,y+s*0.40, x-s*0.48,y-s*0.40, x,y-s*0.88);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#B45309';
  ctx.beginPath();
  ctx.moveTo(x-s*0.10,y-s*0.88);
  ctx.bezierCurveTo(x+s*0.18,y-s*0.38, x+s*0.18,y+s*0.38, x,y+s*0.75);
  ctx.bezierCurveTo(x-s*0.18,y+s*0.38, x-s*0.18,y-s*0.38, x-s*0.10,y-s*0.88);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#A16207'; ctx.lineWidth=s*0.08; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x,y-s*0.80); ctx.lineTo(x,y+s*0.70); ctx.stroke();
  ctx.restore();
}

function drawBeachBall(x, y, s) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='#60A5FA'; ctx.fillRect(x-s,y-s,s*2,s*2);
  ctx.fillStyle='#EF4444';
  ctx.beginPath(); ctx.moveTo(x,y-s); ctx.arc(x,y,s,-Math.PI*0.5,-Math.PI*0.17); ctx.lineTo(x,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#FDE68A';
  ctx.beginPath(); ctx.moveTo(x,y-s); ctx.arc(x,y,s,-Math.PI*0.5,-Math.PI*0.83,true); ctx.lineTo(x,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#34D399';
  ctx.beginPath(); ctx.moveTo(x,y+s); ctx.arc(x,y,s,Math.PI*0.5,Math.PI*0.17,true); ctx.lineTo(x,y); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=0.22; ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(x-s*0.30,y-s*0.35,s*0.28,s*0.18,-0.4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawCoolerCollectible(x, y, s) {
  ctx.fillStyle='#1D4ED8'; ctx.fillRect(x-s*0.72,y-s*0.50,s*1.44,s*0.88);
  ctx.fillStyle='#EFF6FF'; ctx.fillRect(x-s*0.72,y-s*0.50,s*1.44,s*0.30);
  ctx.fillStyle='#3B82F6'; ctx.fillRect(x-s*0.22,y-s*0.58,s*0.44,s*0.15);
  ctx.fillStyle='#1E40AF';
  ctx.fillRect(x-s*0.60,y-s*0.50,s*0.18,s*0.80);
  ctx.fillRect(x+s*0.42,y-s*0.50,s*0.18,s*0.80);
}

function drawGoldNugget(x, y, s) {
  ctx.fillStyle='#FBBF24';
  ctx.beginPath();
  ctx.moveTo(x,y-s); ctx.lineTo(x+s*0.75,y-s*0.18); ctx.lineTo(x+s*0.55,y+s*0.78);
  ctx.lineTo(x-s*0.55,y+s*0.78); ctx.lineTo(x-s*0.75,y-s*0.18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#FDE68A';
  ctx.beginPath();
  ctx.moveTo(x-s*0.18,y-s*0.82); ctx.lineTo(x+s*0.52,y-s*0.22); ctx.lineTo(x+s*0.08,y+s*0.10);
  ctx.closePath(); ctx.fill();
}

function drawTreasureChest(x, y, s) {
  ctx.fillStyle='#92400E'; ctx.fillRect(x-s*0.72,y-s*0.05,s*1.44,s*0.85);
  ctx.fillStyle='#B45309';
  ctx.beginPath();
  ctx.moveTo(x-s*0.72,y-s*0.05); ctx.lineTo(x+s*0.72,y-s*0.05);
  ctx.lineTo(x+s*0.72,y-s*0.55);
  ctx.bezierCurveTo(x+s*0.72,y-s*0.85, x-s*0.72,y-s*0.85, x-s*0.72,y-s*0.55);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#FBBF24'; ctx.fillRect(x-s*0.14,y-s*0.12,s*0.28,s*0.22);
  ctx.fillStyle='#C9883A'; ctx.fillRect(x-s*0.06,y-s*0.04,s*0.12,s*0.10);
  ctx.strokeStyle='#78350F'; ctx.lineWidth=s*0.14;
  ctx.beginPath(); ctx.moveTo(x-s*0.72,y-s*0.05); ctx.lineTo(x+s*0.72,y-s*0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-s*0.72,y+s*0.80); ctx.lineTo(x+s*0.72,y+s*0.80); ctx.stroke();
}

function drawFoxTheaterTicket(x, y, s) {
  ctx.fillStyle='#7C3AED'; ctx.fillRect(x-s*0.82,y-s*0.55,s*1.64,s*0.92);
  ctx.fillStyle='#8B5CF6'; ctx.fillRect(x-s*0.82,y-s*0.55,s*1.64,s*0.38);
  ctx.save(); ctx.setLineDash([2,3]); ctx.strokeStyle='#6D28D9'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x-s*0.48,y-s*0.55); ctx.lineTo(x-s*0.48,y+s*0.37); ctx.stroke();
  ctx.restore();
  // 5-pointed star
  ctx.fillStyle='#FBBF24';
  ctx.save(); ctx.translate(x+s*0.18, y+s*0.06);
  ctx.beginPath();
  for (let i=0; i<5; i++) {
    const a=(i*Math.PI*2/5)-Math.PI/2, ar=a+Math.PI/5;
    i===0 ? ctx.moveTo(Math.cos(a)*s*0.28, Math.sin(a)*s*0.28)
           : ctx.lineTo(Math.cos(a)*s*0.28, Math.sin(a)*s*0.28);
    ctx.lineTo(Math.cos(ar)*s*0.12, Math.sin(ar)*s*0.12);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawCitySealMedallion(x, y, s) {
  ctx.fillStyle='#C9883A';
  ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1D4ED8';
  ctx.beginPath(); ctx.arc(x,y,s*0.78,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#93C5FD'; ctx.lineWidth=s*0.12;
  ctx.beginPath(); ctx.arc(x,y,s*0.52,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#93C5FD';
  ctx.beginPath(); ctx.arc(x,y,s*0.26,0,Math.PI*2); ctx.fill();
  for (let a=0; a<Math.PI*2; a+=Math.PI/2) {
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(a)*s*0.40, y+Math.sin(a)*s*0.40);
    ctx.lineTo(x+Math.cos(a)*s*0.68, y+Math.sin(a)*s*0.68); ctx.stroke();
  }
}

function drawCollAt(type, cx, cy, s) {
  switch (type) {
    case 'poppy':                drawPoppy(cx,cy,s);              break;
    case 'golden_trout':         drawGoldenTrout(cx,cy,s);        break;
    case 'mountain_crystal':     drawMountainCrystal(cx,cy,s);    break;
    case 'fishing_lure':         drawFishingLure(cx,cy,s);        break;
    case 'golden_eagle_feather': drawGoldenEagleFeather(cx,cy,s); break;
    case 'beach_ball':           drawBeachBall(cx,cy,s);          break;
    case 'cooler':               drawCoolerCollectible(cx,cy,s);  break;
    case 'gold_nugget':          drawGoldNugget(cx,cy,s);         break;
    case 'treasure_chest':       drawTreasureChest(cx,cy,s);      break;
    case 'fox_theater_ticket':   drawFoxTheaterTicket(cx,cy,s);   break;
    case 'city_seal_medallion':  drawCitySealMedallion(cx,cy,s);  break;
  }
}

// ── COLLECTIBLE MANAGEMENT ───────────────────────────────────────
function pickCollectibleType() {
  const stg = STAGES[currentStageIdx];
  const r   = Math.random();
  if (r < 0.12) return 'poppy';      // universal shield buff
  if (r < 0.22) return stg.collB;    // rare/secondary
  return stg.collA;                  // common
}

function spawnCollectible() {
  collectibles.push({
    type: pickCollectibleType(),
    lane: Math.floor(Math.random() * currentLanes),
    y:    -SPAWN_Y_OFFSET,
    collected: false,
  });
}

function drawCollectibles() {
  const hy = horizonY();
  for (const c of collectibles) {
    if (c.collected || c.y < hy) continue;
    const sc       = scaleAt(c.y);
    const x        = laneXAt(c.lane, c.y);
    const s        = 11 * sc;
    const hoverOff = Math.round(7 * sc);

    // Water shadow — tinted ellipse sitting on the water surface below the hovering item
    ctx.save(); clearShadow();
    ctx.globalAlpha = 0.34 * Math.min(1, sc * 2);
    ctx.fillStyle = COLL_GLOW[c.type] || '#888888';
    ctx.beginPath(); ctx.ellipse(x, c.y + s*0.28, s*0.68, s*0.20, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Hovering collectible with glow
    ctx.save();
    ctx.shadowColor = COLL_GLOW[c.type] || '#FFFFFF';
    ctx.shadowBlur  = 18 * sc;
    drawCollAt(c.type, x, c.y - hoverOff, s);
    ctx.restore();

    // Specular glint — top-left highlight reinforces 3-D depth
    ctx.save(); clearShadow();
    ctx.globalAlpha = 0.22;
    const specG = ctx.createRadialGradient(
      x - s*0.22, c.y - hoverOff - s*0.32, 0,
      x,          c.y - hoverOff,           s*0.92
    );
    specG.addColorStop(0,    'rgba(255,255,255,0.95)');
    specG.addColorStop(0.42, 'rgba(255,255,255,0)');
    specG.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = specG;
    ctx.beginPath(); ctx.arc(x, c.y - hoverOff, s*0.92, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// Collision detection stays at player.y where perspT=1, geometry is identical
function checkCollectibles() {
  const py = player.y, half = 18;
  for (const c of collectibles) {
    if (c.collected) continue;
    if (c.lane === player.targetLane && c.y >= py - half && c.y <= py + half) {
      c.collected = true;
      if (c.type === 'poppy') {
        player.hasShield = true; // shield buff — no score awarded
      } else if (RARE_COLLECTIBLE_TYPES.has(c.type)) {
        score += RARE_COLLECTIBLE_VALUE;
      } else {
        score += COMMON_COLLECTIBLE_VALUE;
      }
    }
  }
}

// ── DUST PARTICLES ───────────────────────────────────────────────
function spawnDust() {
  const bw = bankW(), rw = riverW();
  dustParticles.push({
    x: bw + Math.random()*rw, y: canvas.height*(0.35 + Math.random()*0.55),
    vx: (Math.random()-0.5)*1.4, vy: -(0.3+Math.random()*0.7),
    r: 1+Math.random()*3, life: 70+Math.floor(Math.random()*50), maxLife: 120,
  });
}
function updateDust() {
  for (const d of dustParticles) { d.x+=d.vx; d.y+=d.vy; d.life--; }
  dustParticles = dustParticles.filter(d => d.life > 0);
}
function drawDust() {
  for (const d of dustParticles) {
    ctx.save(); ctx.globalAlpha = (d.life/d.maxLife)*0.50;
    ctx.fillStyle = '#D97706';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── TEXT WRAP ────────────────────────────────────────────────────
function wrapText(text, maxWidth, font) {
  ctx.save(); ctx.font = font;
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  ctx.restore(); return lines;
}

// ── DRAW: PLAYER ────────────────────────────────────────────────
function drawPlayer() {
  const KW = 19, KH = 44;
  const s  = player.jumpScale;
  const px = player.x, py = player.y;
  const paddleLeft  = (player.animFrame % 60) < 30;
  const paddleAngle = paddleLeft ? -0.30 : 0.30;

  // Spinout: rotate the entire sprite around its center
  ctx.save();
  if (player.spinoutFrames > 0) {
    const elapsed = RIVER_WASH_SPINOUT_DURATION - player.spinoutFrames;
    ctx.translate(px, py);
    ctx.rotate((elapsed / RIVER_WASH_SPINOUT_DURATION) * Math.PI * 4);
    ctx.translate(-px, -py);
  }

  ctx.save();
  const shadowA = player.isJumping ? 0.20*player.shadowScale : 0.30;
  ctx.globalAlpha = shadowA; ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px, py+KH*0.28, KW*0.55*(player.isJumping?player.shadowScale:1), KW*0.18, 0, 0, Math.PI*2);
  ctx.fill(); ctx.restore();

  ctx.save(); ctx.translate(px, py); ctx.scale(s, s);

  ctx.fillStyle = '#0B1F3A';
  ctx.beginPath();
  ctx.moveTo(0,-KH/2);
  ctx.bezierCurveTo(KW/2,-KH*0.32,KW/2,KH*0.32,0,KH/2);
  ctx.bezierCurveTo(-KW/2,KH*0.32,-KW/2,-KH*0.32,0,-KH/2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0,-KH*0.46);
  ctx.bezierCurveTo(KW*0.17,-KH*0.28,KW*0.17,KH*0.28,0,KH*0.46);
  ctx.bezierCurveTo(-KW*0.17,KH*0.28,-KW*0.17,-KH*0.28,0,-KH*0.46);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2D6A4F'; ctx.fillRect(-KW*0.07,-KH*0.40,KW*0.14,KH*0.80);
  ctx.fillStyle = '#0F172A';
  ctx.beginPath(); ctx.ellipse(0,KH*0.04,KW*0.30,KH*0.20,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0,KH*0.04,KW*0.30,KH*0.20,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath(); ctx.arc(0,-KH*0.03,KW*0.20,0,Math.PI*2); ctx.fill();

  ctx.save(); ctx.rotate(paddleAngle);
  const sh = KW*0.88;
  ctx.fillStyle = '#92400E'; ctx.fillRect(-sh,-2.5,sh*2,5);
  ctx.fillStyle = '#78350F';
  ctx.beginPath(); ctx.ellipse(-sh-KW*0.18,0,KW*0.16,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sh+KW*0.18,0,KW*0.16,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#A16207';
  ctx.beginPath(); ctx.ellipse(-sh-KW*0.18,-1.5,KW*0.10,2.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sh+KW*0.18,-1.5,KW*0.10,2.5,0,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.restore();
  ctx.restore(); // end spinout wrapper

  // Shield glow ring — drawn outside spinout transform so it stays centred
  if (player.hasShield) {
    const pulse = 0.65 + Math.sin(player.animFrame * 0.15) * 0.30;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 3;
    ctx.shadowColor = '#F97316'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

// ── DRAW: HUD ────────────────────────────────────────────────────
function drawHUD() {
  const W   = canvas.width;
  const stg = STAGES[currentStageIdx];
  ctx.fillStyle = 'rgba(11,31,58,0.88)'; ctx.fillRect(0, 0, W, HUD_H);
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#F5F0E8';
  ctx.textAlign = 'left';   ctx.fillText(stg.name,                        8,    14);
  ctx.textAlign = 'center'; ctx.fillText('MILE ' + currentMile + ' / 165', W/2,  14);
  ctx.textAlign = 'right';  ctx.fillText('STAGE ' + stg.num + '/5',       W-8,  14);
  ctx.fillStyle = '#C9883A'; ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';  ctx.fillText('SCORE ' + Math.floor(score),      8,  42);
  ctx.textAlign = 'right'; ctx.fillText('BEST '  + Math.floor(highScore), W-8, 42);
  drawPauseBtn();
}

function drawPauseBtn() {
  const W = canvas.width, bx = W / 2, by = 42;
  ctx.save();
  ctx.globalAlpha = 0.70; ctx.fillStyle = '#1E3A5F'; ctx.fillRect(bx-14, by-10, 28, 20);
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = 'rgba(245,240,232,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(bx-14, by-10, 28, 20);
  ctx.strokeStyle = '#F5F0E8'; ctx.lineWidth = 2.5; ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(bx-5, by-6); ctx.lineTo(bx-5, by+6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+5, by-6); ctx.lineTo(bx+5, by+6); ctx.stroke();
  ctx.restore();
}

// ── DRAW: TRANSITION MESSAGE ──────────────────────────────────────
function drawTransitionMsg() {
  if (!transitionMsg) return;
  const t = transitionMsg.life / transitionMsg.maxLife;
  let alpha;
  if      (t > 0.73) alpha = (1-t)/0.27;
  else if (t > 0.27) alpha = 1.0;
  else               alpha = t/0.27;
  const W = canvas.width;
  ctx.save();
  ctx.globalAlpha = alpha*0.9; ctx.fillStyle = 'rgba(11,31,58,0.90)';
  ctx.fillRect(0, canvas.height*0.42, W, 50);
  ctx.globalAlpha = alpha; ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = '#C9883A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(transitionMsg.text, W/2, canvas.height*0.42+25);
  ctx.restore();
}

// ── SPAWN OBSTACLES ──────────────────────────────────────────────
const H_OVERRIDES = {
  boulder: 36, river_wash: 38, deadfall_log: 28,
  capsized_raft: 32, drifting_sailboat: 44, mine_cart: 36, shopping_cart: 38,
};

function spawnObstacle() {
  if (Math.random() < currentFwFreq) {
    const fwType = Array.isArray(currentFwType)
      ? currentFwType[Math.floor(Math.random() * currentFwType.length)]
      : currentFwType;
    obstacles.push({ type: fwType, fullWidth: true, lane: -1,
      y: -SPAWN_Y_OFFSET, h: 26, resolved: false });
  } else {
    const type = currentObsTypes[Math.floor(Math.random() * currentObsTypes.length)];
    const lane = Math.floor(Math.random() * currentLanes);
    const h    = H_OVERRIDES[type] || 32;
    obstacles.push({ type, fullWidth: false, lane, y: -SPAWN_Y_OFFSET, h, resolved: false });
  }
}

// ── UPDATE ───────────────────────────────────────────────────────
function update() {
  bgScrollY   += currentSpeed;
  distance    += currentSpeed;
  score       += SCORE_PER_FRAME;
  currentMile  = Math.floor(distance / PIXELS_PER_MILE);

  if (currentMile >= 165) { endRun(true); return; }

  const stg = STAGES[currentStageIdx];
  if (currentMile >= stg.endMile && currentStageIdx < STAGES.length - 1) {
    applyStage(currentStageIdx + 1, STAGES[currentStageIdx+1].enterMsg); return;
  }

  if (currentStageIdx === 4 && STAGES[4].subNarrow) {
    for (const sn of STAGES[4].subNarrow) {
      if (currentMile >= sn.atMile && !subNarrowFired.has(sn.atMile)) {
        subNarrowFired.add(sn.atMile);
        setLanes(sn.lanes);
        if (sn.obsFreq !== undefined) currentObsFreq = sn.obsFreq;
        showTransition(sn.msg, 150);
        obstacles = []; collectibles = []; splashes = [];
      }
    }
  }

  // Spinout countdown
  if (player.spinoutFrames > 0) player.spinoutFrames--;

  const tx = getLaneX(player.targetLane);
  player.x += (tx - player.x) * 0.28;
  if (Math.abs(player.x - tx) < 0.6) { player.x = tx; player.lane = player.targetLane; }
  player.animFrame++;

  if (player.isJumping) {
    player.jumpFrame++;
    const arc = Math.sin((player.jumpFrame / JUMP_DURATION) * Math.PI);
    player.jumpScale  = 1 + (JUMP_SCALE_PEAK - 1) * arc;
    player.shadowScale = 1 - arc * 0.9;
    if (player.jumpFrame >= JUMP_DURATION) {
      player.isJumping = false; player.jumpFrame = 0;
      player.jumpScale = 1.0;  player.shadowScale = 1.0;
      spawnSplash(player.x, player.y + 8);
    }
  }

  framesSinceLast++;
  const minF = Math.ceil(MIN_OBSTACLE_GAP / currentSpeed);
  if (framesSinceLast >= minF && Math.random() < currentObsFreq) {
    spawnObstacle(); framesSinceLast = 0;
  }

  if (Math.random() < COLLECTIBLE_FREQUENCY) spawnCollectible();

  for (const obs of obstacles) obs.y += currentSpeed;
  obstacles = obstacles.filter(o => o.y < canvas.height + 120);
  for (const c of collectibles) c.y += currentSpeed;
  collectibles = collectibles.filter(c => !c.collected && c.y < canvas.height + 60);
  for (const sp of splashes) sp.life--;
  splashes = splashes.filter(sp => sp.life > 0);
  if (transitionMsg) { transitionMsg.life--; if (transitionMsg.life <= 0) transitionMsg = null; }

  checkCollectibles();
  checkCollision();
}

// Collision at player.y — laneXAt(lane, player.y) === getLaneX(lane), geometry unchanged
function checkCollision() {
  const py = player.y, half = 12;
  for (const obs of obstacles) {
    if (obs.resolved) continue;
    if (obs.y + obs.h < py - half || obs.y > py + half) continue;
    obs.resolved = true;
    const safe = player.isJumping || (!obs.fullWidth && obs.lane !== player.targetLane);
    if (safe) continue;
    // Shield absorbs any single hit
    if (player.hasShield) {
      player.hasShield = false;
      spawnSplash(player.x, player.y);
      continue;
    }
    // River wash = spinout instead of instant death
    if (obs.type === 'river_wash') {
      player.spinoutFrames = Math.max(player.spinoutFrames, RIVER_WASH_SPINOUT_DURATION);
    } else {
      endRun(false); return;
    }
  }
}

function endRun(complete) {
  player.dead = true;
  if (score > highScore) { highScore = Math.floor(score); localStorage.setItem('krr_hs', highScore); }
  if (complete) {
    endingPhase = 0; endingTimer = 0; endingSpeedMult = 1.0; dustParticles = [];
    gameState = 'ending';
  } else {
    gameState = 'gameover';
  }
}

// ── ENDING SEQUENCE ──────────────────────────────────────────────
function updateEnding() {
  endingTimer++;
  if (endingPhase === 0) {
    const t   = Math.min(1, endingTimer / ENDING_SLOWDOWN_FRAMES);
    endingSpeedMult = (1 - t) * (1 - t);
    const spd = currentSpeed * endingSpeedMult;
    bgScrollY += spd;
    for (const obs of obstacles)    obs.y += spd;
    for (const c   of collectibles) c.y   += spd;
    for (const sp  of splashes) sp.life--;
    splashes = splashes.filter(s => s.life > 0);
    if (endingTimer > 20 && Math.random() < 0.10) spawnDust();
    if (endingTimer >= ENDING_SLOWDOWN_FRAMES + 30) {
      endingPhase = 1; endingTimer = 0;
      obstacles = []; collectibles = []; splashes = [];
    }
  }
  updateDust();
}

// ── GAME LOOP ────────────────────────────────────────────────────
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'playing') {
    update();
    drawBackground(); drawObstacles(); drawCollectibles();
    drawSplashes(); drawPlayer(); drawTransitionMsg(); drawHUD();

  } else if (gameState === 'paused') {
    drawBackground(); drawObstacles(); drawCollectibles();
    drawSplashes(); drawPlayer(); drawHUD(); drawPaused();

  } else if (gameState === 'ending') {
    updateEnding(); drawBackground();
    if (endingPhase === 0) {
      drawObstacles(); drawCollectibles(); drawSplashes();
      drawPlayer(); drawDust(); drawHUD();
    } else {
      drawPlayer(); drawDust();
      if (endingPhase === 1) drawDialog1();
      else                   drawDialog2();
    }

  } else if (gameState === 'start')   { startAnimTime++; drawStartScreen(); }
  else if (gameState === 'howtoplay') { drawHowToPlay(); }
  else if (gameState === 'itemguide') { drawItemGuide(); }
  else if (gameState === 'gameover')  { drawGameOver(); }

  requestAnimationFrame(gameLoop);
}

// ── START GAME ───────────────────────────────────────────────────
function startGame() {
  score = 0; distance = 0; currentMile = 0;
  bgScrollY = 0; framesSinceLast = 0;
  transitionMsg = null; subNarrowFired = new Set();
  currentStageIdx = 0;
  currentLanes    = STAGES[0].lanes;
  currentSpeed    = STAGES[0].speed;
  currentObsFreq  = STAGES[0].obsFreq;
  currentFwFreq   = STAGES[0].fwFreq;
  currentObsTypes = STAGES[0].obsTypes;
  currentFwType   = STAGES[0].fwType;
  const startLane = Math.floor(STAGES[0].lanes / 2);
  player.lane = startLane; player.targetLane = startLane;
  player.x = getLaneX(startLane);
  player.y = Math.floor(canvas.height * PLAYER_Y_RATIO);
  player.isJumping = false; player.jumpFrame = 0;
  player.jumpScale = 1.0;  player.shadowScale = 1.0;
  player.animFrame = 0;    player.dead = false;
  player.hasShield = false; player.spinoutFrames = 0;
  obstacles = []; collectibles = []; splashes = [];
  dustParticles = []; endingPhase = 0; endingTimer = 0; endingSpeedMult = 1.0;
  initBgDecor();
  updateLegend(0);
  gameState = 'playing';
}

// ── HELPER: draw image with cover-crop (no stretch), optional horizontal pan ─
function drawImageCover(img, dx, dy, dw, dh, panPx) {
  if (!img.naturalWidth) return;
  const imgR = img.naturalWidth / img.naturalHeight;
  const dstR = dw / dh;
  let sx, sy, sw, sh;
  if (imgR > dstR) {
    // image is wider than destination — crop sides, pan horizontally
    sh = img.naturalHeight;
    sw = sh * dstR;
    const maxPan = img.naturalWidth - sw;
    const centerX = (img.naturalWidth - sw) / 2;
    sx = Math.max(0, Math.min(maxPan, centerX + (panPx || 0) * (img.naturalWidth / dw)));
    sy = 0;
  } else {
    // image is taller than destination — crop top/bottom
    sw = img.naturalWidth;
    sh = sw / dstR;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// ── START SCREEN SPARKLE POSITIONS (as fractions of bg area) ─────
const START_SPARKLES = [
  [0.10,0.38],[0.64,0.45],[0.36,0.55],[0.52,0.32],[0.80,0.52],
  [0.20,0.68],[0.88,0.40],[0.44,0.74],[0.72,0.62],[0.28,0.48],
];

// ── SCREEN: START ────────────────────────────────────────────────
function drawStartScreen() {
  const W = canvas.width, H = canvas.height;

  // Base navy gradient behind everything
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B1F3A'); bg.addColorStop(0.55, '#0B2D4F'); bg.addColorStop(1, '#1A3D5C');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Sierra Nevada photo — cover-cropped, slow horizontal drift
  const bgY   = H * 0.36;
  const drift = Math.sin(startAnimTime * 0.0006) * W * 0.012;
  if (bgSceneLoaded) {
    drawImageCover(bgSceneImg, 0, bgY, W, H - bgY, drift);
    // Blend top edge into gradient
    const fadeH = H * 0.16;
    const fade  = ctx.createLinearGradient(0, bgY, 0, bgY + fadeH);
    fade.addColorStop(0, '#0B2D4F');
    fade.addColorStop(1, 'rgba(11,45,79,0)');
    ctx.fillStyle = fade; ctx.fillRect(0, bgY, W, fadeH);
    // Subtle sparkles over photo area
    for (let i = 0; i < START_SPARKLES.length; i++) {
      const [fx, fy] = START_SPARKLES[i];
      const phase = (startAnimTime * 0.016 + i * 1.4) % (Math.PI * 2);
      const alpha = Math.max(0, Math.sin(phase)) * 0.45;
      if (alpha < 0.02) continue;
      const r = 1.0 + Math.sin(startAnimTime * 0.022 + i * 0.9) * 0.35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#EFF6FF';
      ctx.beginPath(); ctx.arc(fx * W, bgY + fy * (H - bgY), r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else {
    drawStartScenerFallback(W, H);
  }

  // River gleam at very bottom
  const gl = ctx.createLinearGradient(0, H*0.82, 0, H);
  gl.addColorStop(0, 'rgba(29,78,216,0)'); gl.addColorStop(1, 'rgba(29,78,216,0.50)');
  ctx.fillStyle = gl; ctx.fillRect(0, H*0.82, W, H*0.18);

  // Back link
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.40)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('< BACK TO CAMPAIGN', 12, 10);

  // Logo — draw dark navy rect first so 'screen' blend always composites cleanly
  const logoW = Math.min(W * 0.76, 300);
  const logoX = (W - logoW) / 2;
  const logoY = H * 0.05;
  if (logoLoaded && logoImg.naturalWidth > 0) {
    const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth);
    // Dark backing ensures screen blend removes black regardless of bg content
    ctx.save();
    ctx.fillStyle = '#0B1F3A';
    ctx.fillRect(logoX - 6, logoY - 6, logoW + 12, logoH + 12);
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
    ctx.restore();
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C9883A'; ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('KERN',  W/2, H*0.14); ctx.fillText('RIVER', W/2, H*0.14+30);
    ctx.fillStyle = '#F5F0E8'; ctx.fillText('RUN', W/2, H*0.14+60);
  }

  // Subtitle — 13px with drop shadow for legibility over photo
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 6;
  ctx.font = '13px "Press Start 2P", monospace'; ctx.fillStyle = '#BAE6FD';
  ctx.fillText('Can you follow the Kern River', W/2, H*0.46);
  ctx.fillText('all 165 miles to Bakersfield?', W/2, H*0.46 + 22);
  ctx.restore();

  // Buttons
  drawBtn('START RUN',   W/2, H*0.60,      W*0.66, 46, '#2D6A4F', '#F5F0E8');
  drawBtn('HOW TO PLAY', W/2, H*0.60 + 62, W*0.66, 46, '#1E3A5F', '#C9883A');
}

function drawStartScenerFallback(W, H) {
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0,H*0.78); ctx.lineTo(W*0.12,H*0.57); ctx.lineTo(W*0.28,H*0.70);
  ctx.lineTo(W*0.47,H*0.50); ctx.lineTo(W*0.65,H*0.62); ctx.lineTo(W*0.80,H*0.53);
  ctx.lineTo(W,H*0.66); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2563EB'; ctx.fillRect(W*0.12, H*0.83, W*0.76, H*0.17);
  ctx.fillStyle = '#166534';
  for (const tx of [0.06,0.2,0.36,0.57,0.73,0.91]) {
    const x=W*tx, y=H*0.77, sz=10+((tx*100)%5);
    ctx.beginPath(); ctx.moveTo(x,y-sz); ctx.lineTo(x-sz*0.6,y+sz*0.5); ctx.lineTo(x+sz*0.6,y+sz*0.5);
    ctx.closePath(); ctx.fill();
  }
}

// ── SCREEN: HOW TO PLAY ──────────────────────────────────────────
function drawHowToPlay() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.97)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C9883A'; ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('HOW TO PLAY', W/2, H*0.09);

  const lines = [
    ['Dodge obstacles &',           '#F5F0E8'],
    ['collect items paddling',      '#F5F0E8'],
    ['165 miles to Bakersfield.',   '#F5F0E8'],
    ['', ''],
    ['JUMP over full-river',        '#FDE68A'],
    ['obstacles — trees,',          '#FDE68A'],
    ['rafts, pontoons & more!',     '#FDE68A'],
    ['', ''],
    ['BOULDERS  instant crash',     '#EF4444'],
    ['RIVER WASH  spin-out!',       '#38BDF8'],
    ['POPPY  grants a shield',      '#F97316'],
    ['(absorbs 1 obstacle hit)',    '#F5F0E8'],
    ['', ''],
    ['Each stage has its own',      '#C9883A'],
    ['unique obstacles &',          '#C9883A'],
    ['collectibles. Check the',     '#C9883A'],
    ['legend panel in-game!',       '#C9883A'],
    ['', ''],
    ['— DESKTOP —',                 '#93C5FD'],
    ['LEFT / RIGHT  arrow keys',    '#F5F0E8'],
    ['SPACE or UP   jump',          '#F5F0E8'],
    ['', ''],
    ['— MOBILE —',                  '#93C5FD'],
    ['SWIPE left / right  lane',    '#F5F0E8'],
    ['TAP anywhere   jump',         '#F5F0E8'],
  ];
  ctx.font = '7px "Press Start 2P", monospace';
  lines.forEach(([txt, col], i) => {
    if (!txt) return;
    ctx.fillStyle = col; ctx.fillText(txt, W/2, H*0.18 + i*14);
  });

  drawBtn('GOT IT!',      W/2, H*0.87,      W*0.58, 40, '#2D6A4F', '#F5F0E8');
  drawBtn('ITEM GUIDE >', W/2, H*0.87 + 52, W*0.58, 40, '#1E3A5F', '#C9883A');
}

// ── SCREEN: ITEM GUIDE ───────────────────────────────────────────
function drawItemGuide() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.97)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C9883A'; ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillText('ITEM GUIDE', W/2, H*0.06);

  const S = 11, R = 13, lw_ = 55;
  const cx = W/2;
  let y = H*0.14;
  const rowH = Math.min(46, (H*0.74) / 9);

  // Universal section
  ctx.font='6px "Press Start 2P", monospace'; ctx.fillStyle='#93C5FD';
  ctx.fillText('— IN EVERY STAGE —', cx, y); y += rowH*0.7;

  const universals = [
    { draw: () => { ctx.save(); ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=5; ctx.shadowOffsetY=3; drawObsAt('boulder',cx-W*0.30,y,R,lw_); ctx.restore(); },
      label:'Boulder', sub:'instant crash', col:'#EF4444' },
    { draw: () => { ctx.save(); ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=5; ctx.shadowOffsetY=3; drawObsAt('river_wash',cx,y,R,lw_); ctx.restore(); },
      label:'River Wash', sub:'spin-out!', col:'#38BDF8' },
    { draw: () => { ctx.save(); ctx.shadowColor=COLL_GLOW['poppy']; ctx.shadowBlur=12; drawCollAt('poppy',cx+W*0.30,y,S); ctx.restore(); },
      label:'Poppy Power', sub:'grants shield', col:'#F97316' },
  ];
  for (const item of universals) {
    item.draw();
  }
  ctx.font='5px "Press Start 2P", monospace';
  ctx.fillStyle='#EF4444';  ctx.fillText(universals[0].label, cx-W*0.30, y+R+9);
  ctx.fillStyle='#EF4444';  ctx.fillText(universals[0].sub,   cx-W*0.30, y+R+20);
  ctx.fillStyle='#38BDF8';  ctx.fillText(universals[1].label, cx,        y+R+9);
  ctx.fillStyle='#38BDF8';  ctx.fillText(universals[1].sub,   cx,        y+R+20);
  ctx.fillStyle='#F97316';  ctx.fillText(universals[2].label, cx+W*0.30, y+R+9);
  ctx.fillStyle='#F97316';  ctx.fillText(universals[2].sub,   cx+W*0.30, y+R+20);
  y += rowH * 1.8;

  // Per-stage collectibles preview
  ctx.font='6px "Press Start 2P", monospace'; ctx.fillStyle='#C9883A';
  ctx.fillText('— STAGE COLLECTIBLES —', cx, y); y += rowH*0.65;

  const stgPreviews = [
    { name:'S1 HEADWATERS', a:'golden_trout', b:'mountain_crystal' },
    { name:'S2 UPPER KERN',  a:'fishing_lure',  b:'golden_eagle_feather' },
    { name:'S3 LAKE ISABELLA',a:'beach_ball',   b:'cooler' },
    { name:'S4 KERN CANYON', a:'gold_nugget',   b:'treasure_chest' },
    { name:'S5 BAKERSFIELD', a:'fox_theater_ticket', b:'city_seal_medallion' },
  ];
  const colA=W*0.22, colB=W*0.50, colC=W*0.78;
  ctx.font='4px "Press Start 2P", monospace'; ctx.fillStyle='#9CA3AF';
  ctx.fillText('Stage', colA, y); ctx.fillText('Common +50', colB, y); ctx.fillText('Rare / +150', colC, y);
  y += rowH*0.55;

  for (const sp of stgPreviews) {
    ctx.font='4px "Press Start 2P", monospace'; ctx.fillStyle='#F5F0E8';
    ctx.textAlign='left'; ctx.fillText(sp.name, W*0.02, y+4);
    ctx.textAlign='center';
    ctx.save(); ctx.shadowColor=COLL_GLOW[sp.a]||'#fff'; ctx.shadowBlur=10;
    drawCollAt(sp.a, colB, y, S*0.85); ctx.restore();
    ctx.save(); ctx.shadowColor=COLL_GLOW[sp.b]||'#fff'; ctx.shadowBlur=10;
    drawCollAt(sp.b, colC, y, S*0.85); ctx.restore();
    y += rowH*0.90;
  }

  drawBtn('< BACK',  W*0.27, H*0.93, W*0.48, 38, '#1E3A5F', '#C9883A');
  drawBtn('GOT IT!', W*0.73, H*0.93, W*0.48, 38, '#2D6A4F', '#F5F0E8');
}

// ── SCREEN: GAME OVER ────────────────────────────────────────────
function drawGameOver() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.92)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#EF4444'; ctx.font = '18px "Press Start 2P", monospace';
  ctx.fillText('RUN ENDED', W/2, H*0.22);
  const stg = STAGES[currentStageIdx];
  ctx.font = '11px "Press Start 2P", monospace'; ctx.fillStyle = '#F5F0E8';
  ctx.fillText('Wiped out on ' + stg.name, W/2, H*0.34);
  ctx.fillText('Mile ' + currentMile + ' / 165',  W/2, H*0.34 + 24);
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.fillStyle = '#C9883A'; ctx.fillText('SCORE  ' + Math.floor(score),     W/2, H*0.54);
  ctx.fillStyle = '#93C5FD'; ctx.fillText('BEST   ' + Math.floor(highScore), W/2, H*0.54 + 26);
  drawBtn('TRY AGAIN', W/2, H*0.70,      W*0.62, 42, '#2D6A4F', '#F5F0E8');
  drawBtn('MAIN MENU', W/2, H*0.70 + 56, W*0.62, 42, '#1E3A5F', '#C9883A');
}

// ── SCREEN: PAUSED ───────────────────────────────────────────────
function drawPaused() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.78)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F5F0E8'; ctx.font = '14px "Press Start 2P", monospace';
  ctx.fillText('PAUSED', W/2, H*0.36);
  drawBtn('RESUME',    W/2, H*0.52,      W*0.60, 42, '#2D6A4F', '#F5F0E8');
  drawBtn('QUIT RUN',  W/2, H*0.52 + 56, W*0.60, 42, '#1E3A5F', '#C9883A');
}

// ── ENDING DIALOG 1 ───────────────────────────────────────────────
function drawDialog1() {
  const W = canvas.width, H = canvas.height;
  const pad=14, bx=pad, by=HUD_H+6, bdw=W-2*pad, bdh=H-by-6, cx=bx+bdw/2;
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(bx+3,by+3,bdw,bdh);
  ctx.fillStyle='#0B1F3A'; ctx.fillRect(bx,by,bdw,bdh);
  ctx.strokeStyle='#C9883A'; ctx.lineWidth=2; ctx.strokeRect(bx,by,bdw,bdh);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  let y = by + 20;
  ctx.fillStyle='#C9883A'; ctx.font='8px "Press Start 2P", monospace';
  ctx.fillText('YOU MADE IT.', cx, y); y += 18;
  ctx.fillStyle='#F97316';
  ctx.fillText('THE KERN RIVER', cx, y); y += 15;
  ctx.fillText("DOESN'T.", cx, y); y += 18;
  const bodyFont='5px "Press Start 2P", monospace', textW=bdw-22, lineH=12;
  const paras = [
    'Every year, snowmelt begins a 165-mile journey from the Sierra Nevada toward Bakersfield.',
    'The Kern River has shaped our communities, our history, and our identity for generations.',
    'This public resource deserves public stewardship.',
    'My campaign is committed to ensuring the Kern River is better protected, better appreciated, and better connected to the people of Bakersfield.',
  ];
  for (const para of paras) {
    for (const line of wrapText(para, textW, bodyFont)) {
      ctx.font=bodyFont; ctx.fillStyle='#F5F0E8'; ctx.fillText(line, cx, y); y+=lineH;
    }
    y += 5;
  }
  drawBtn('CONTINUE >', cx, by+bdh-24, bdw*0.74, 36, '#2D6A4F', '#F5F0E8');
}

// ── ENDING DIALOG 2 ───────────────────────────────────────────────
function drawDialog2() {
  const W = canvas.width, H = canvas.height;
  const pad=14, bx=pad, by=HUD_H+6, bdw=W-2*pad, bdh=H-by-6, cx=bx+bdw/2;
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(bx+3,by+3,bdw,bdh);
  ctx.fillStyle='#0B1F3A'; ctx.fillRect(bx,by,bdw,bdh);
  ctx.strokeStyle='#C9883A'; ctx.lineWidth=2; ctx.strokeRect(bx,by,bdw,bdh);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const textW=bdw-22, bodyFont='6px "Press Start 2P", monospace', lineH=14;
  const btnW=bdw*0.84, btnH=36, btnGap=8;
  const btn3Y=by+bdh-12-btnH/2, btn2Y=btn3Y-btnH-btnGap, btn1Y=btn2Y-btnH-btnGap;
  let y = by + 20;
  const intro='In June 1973, Bakersfield leaders negotiated the Kern River into public hands.';
  ctx.font=bodyFont; ctx.fillStyle='#F5F0E8';
  for (const line of wrapText(intro,textW,bodyFont)) { ctx.fillText(line,cx,y); y+=lineH; }
  y += 10;
  const quote='"We achieved far more for the citizens of Bakersfield than we had dared dream."';
  ctx.fillStyle='#FDE68A';
  for (const line of wrapText(quote,textW,bodyFont)) { ctx.fillText(line,cx,y); y+=lineH; }
  y += 8;
  const attr='— Walter F. Heisey, after negotiating the Kern River from a private company for $17.9 million';
  ctx.font='5px "Press Start 2P", monospace'; ctx.fillStyle='#93C5FD';
  for (const line of wrapText(attr,textW,'5px "Press Start 2P", monospace')) { ctx.fillText(line,cx,y); y+=12; }
  y += 8;
  ctx.font='6px "Press Start 2P", monospace';
  ctx.fillStyle='#C9883A'; ctx.fillText('FINAL SCORE: '+Math.floor(score),cx,y); y+=14;
  ctx.fillStyle='#93C5FD'; ctx.fillText('BEST: '+Math.floor(highScore),cx,y);
  drawBtn('LEARN MORE',         cx, btn1Y, btnW, btnH, '#1E3A5F', '#38BDF8');
  drawBtn('RETURN TO CAMPAIGN', cx, btn2Y, btnW, btnH, '#374151', '#F5F0E8');
  drawBtn('PLAY AGAIN',         cx, btn3Y, btnW, btnH, '#2D6A4F', '#F5F0E8');
}

// ── BUTTON HELPERS ───────────────────────────────────────────────
function drawBtn(label, cx, cy, bw, bh, bg, fg) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(cx-bw/2+3, cy-bh/2+3, bw, bh);
  ctx.fillStyle = bg; ctx.fillRect(cx-bw/2, cy-bh/2, bw, bh);
  ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.strokeRect(cx-bw/2, cy-bh/2, bw, bh);
  ctx.fillStyle = fg; ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}
function hitBtn(mx, my, cx, cy, bw, bh) {
  return mx>=cx-bw/2 && mx<=cx+bw/2 && my>=cy-bh/2 && my<=cy+bh/2;
}
function clientToCanvas(ex, ey) {
  const r = canvas.getBoundingClientRect();
  return [(ex-r.left)*(canvas.width/r.width), (ey-r.top)*(canvas.height/r.height)];
}

// ── INPUT ────────────────────────────────────────────────────────
function doMoveLeft() {
  if (player.spinoutFrames > 0) return;
  if (player.targetLane > 0) { spawnSplash(player.x, player.y+8); player.targetLane--; }
}
function doMoveRight() {
  if (player.spinoutFrames > 0) return;
  if (player.targetLane < currentLanes-1) { spawnSplash(player.x, player.y+8); player.targetLane++; }
}
function doJump() {
  if (player.spinoutFrames > 0) return;
  if (!player.isJumping && gameState==='playing') {
    player.isJumping=true; player.jumpFrame=0; player.jumpScale=1.0; player.shadowScale=1.0;
  }
}

window.addEventListener('keydown', e => {
  if (gameState === 'playing') {
    switch (e.key) {
      case 'ArrowLeft':  case 'a': case 'A': doMoveLeft();  break;
      case 'ArrowRight': case 'd': case 'D': doMoveRight(); break;
      case 'ArrowUp': case 'w': case 'W': case ' ': e.preventDefault(); doJump(); break;
      case 'Escape': case 'p': case 'P': gameState = 'paused'; break;
    }
  } else if (gameState === 'paused') {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') gameState = 'playing';
  }
});

let tStartX=0, tStartY=0, tStartMs=0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0]; tStartX=t.clientX; tStartY=t.clientY; tStartMs=Date.now();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const dx=t.clientX-tStartX, dy=t.clientY-tStartY;
  const dt=Date.now()-tStartMs, mag=Math.hypot(dx,dy);
  if (gameState === 'playing') {
    const [mx,my] = clientToCanvas(t.clientX, t.clientY);
    if (hitBtn(mx,my, canvas.width/2, 42, 28, 20)) { gameState='paused'; return; }
    if      (mag < 22 && dt < 280)                   doJump();
    else if (Math.abs(dx)>Math.abs(dy) && mag>28)    dx<0 ? doMoveLeft() : doMoveRight();
    else if (dy < -28)                                doJump();
  } else {
    const [mx,my] = clientToCanvas(t.clientX, t.clientY); handleTap(mx,my);
  }
}, { passive: false });

canvas.addEventListener('click', e => {
  const [mx,my] = clientToCanvas(e.clientX, e.clientY); handleTap(mx, my);
});

function handleTap(mx, my) {
  const W = canvas.width, H = canvas.height;

  if (gameState === 'playing') {
    if (hitBtn(mx,my, W/2, 42, 28, 20)) gameState = 'paused';
    return;
  }

  if (gameState === 'start') {
    if (my < 28) { window.location.href = '../'; return; }
    if (hitBtn(mx,my, W/2, H*0.60,      W*0.66, 46)) { startGame(); return; }
    if (hitBtn(mx,my, W/2, H*0.60 + 62, W*0.66, 46)) gameState = 'howtoplay';

  } else if (gameState === 'howtoplay') {
    if (hitBtn(mx,my, W/2, H*0.87,      W*0.58, 40)) gameState = 'start';
    if (hitBtn(mx,my, W/2, H*0.87 + 52, W*0.58, 40)) gameState = 'itemguide';

  } else if (gameState === 'itemguide') {
    if (hitBtn(mx,my, W*0.27, H*0.93, W*0.48, 38)) gameState = 'howtoplay';
    if (hitBtn(mx,my, W*0.73, H*0.93, W*0.48, 38)) gameState = 'start';

  } else if (gameState === 'gameover') {
    if (hitBtn(mx,my, W/2, H*0.68,      W*0.62, 42)) { startGame(); return; }
    if (hitBtn(mx,my, W/2, H*0.68 + 56, W*0.62, 42)) gameState = 'start';

  } else if (gameState === 'paused') {
    if (hitBtn(mx,my, W/2, H*0.52,      W*0.60, 42)) { gameState = 'playing'; return; }
    if (hitBtn(mx,my, W/2, H*0.52 + 56, W*0.60, 42)) gameState = 'start';

  } else if (gameState === 'ending') {
    if (endingPhase === 1) {
      const pad=14, bx=pad, by=HUD_H+6, bdw=W-2*pad, bdh=H-by-6, cx=bx+bdw/2;
      if (hitBtn(mx,my, cx, by+bdh-24, bdw*0.74, 36)) { endingPhase=2; endingTimer=0; }
    } else if (endingPhase === 2) {
      const pad=14, bx=pad, by=HUD_H+6, bdw=W-2*pad, bdh=H-by-6, cx=bx+bdw/2;
      const btnW=bdw*0.84, btnH=36, btnGap=8;
      const btn3Y=by+bdh-12-btnH/2, btn2Y=btn3Y-btnH-btnGap, btn1Y=btn2Y-btnH-btnGap;
      if      (hitBtn(mx,my, cx, btn1Y, btnW, btnH)) window.location.href='/kern-river';
      else if (hitBtn(mx,my, cx, btn2Y, btnW, btnH)) window.location.href='/';
      else if (hitBtn(mx,my, cx, btn3Y, btnW, btnH)) startGame();
    }
  }
}

// ── DYNAMIC LEGEND ───────────────────────────────────────────────
const ITEM_ICONS = {
  boulder:          { svg:`<svg width="26" height="26" viewBox="0 0 26 26"><path d="M13,1 L24,7 L22,24 L4,24 L2,7 Z" fill="#7C2D12"/><path d="M6,4 L15,8 L10,13 Z" fill="#A16207" opacity="0.70"/></svg>`, label:'Boulder', sub:null, cat:'avoid' },
  river_wash:       { svg:`<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="rgba(56,189,248,0.18)" stroke="#38BDF8" stroke-width="1.5"/><path d="M14,6 Q20,10 18,14 Q16,19 14,16 Q11,12 13,8 Q15,5 20,8" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="14" r="3" fill="#EFF6FF"/></svg>`, label:'River Wash', sub:'SPIN OUT', cat:'avoid' },
  deadfall_log:     { svg:`<svg width="40" height="18" viewBox="0 0 40 18"><rect x="4" y="5" width="32" height="9" rx="4" fill="#44403C"/><rect x="4" y="5" width="32" height="4" rx="3" fill="#57534E"/><circle cx="12" cy="9" r="3" fill="none" stroke="#292524" stroke-width="1.2"/></svg>`, label:'Deadfall Log', sub:null, cat:'avoid' },
  capsized_raft:    { svg:`<svg width="38" height="18" viewBox="0 0 38 18"><ellipse cx="19" cy="11" rx="15" ry="5" fill="#57534E"/><rect x="9" y="6" width="20" height="6" fill="#44403C"/><line x1="15" y1="6" x2="15" y2="12" stroke="#292524" stroke-width="1.5"/><line x1="23" y1="6" x2="23" y2="12" stroke="#292524" stroke-width="1.5"/></svg>`, label:'Capsized Raft', sub:null, cat:'avoid' },
  drifting_sailboat:{ svg:`<svg width="28" height="28" viewBox="0 0 28 28"><path d="M6,20 L22,20 L19,26 L9,26 Z" fill="#1E3A5F"/><rect x="6" y="18" width="16" height="3" fill="#EFF6FF"/><line x1="14" y1="20" x2="14" y2="4" stroke="#57534E" stroke-width="2"/><path d="M14,5 L23,17 L14,20 Z" fill="rgba(239,246,255,0.88)"/></svg>`, label:'Sailboat', sub:null, cat:'avoid' },
  mine_cart:        { svg:`<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4,10 L24,10 L21,20 L7,20 Z" fill="#1C1917"/><rect x="4" y="8" width="20" height="3" fill="#292524"/><circle cx="9" cy="24" r="3" fill="#44403C"/><circle cx="19" cy="24" r="3" fill="#44403C"/></svg>`, label:'Mine Cart', sub:null, cat:'avoid' },
  shopping_cart:    { svg:`<svg width="28" height="28" viewBox="0 0 28 28"><rect x="8" y="5" width="16" height="13" fill="none" stroke="#9CA3AF" stroke-width="2"/><line x1="13" y1="5" x2="13" y2="18" stroke="#9CA3AF" stroke-width="1"/><path d="M5,3 L8,3 L8,18" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="23" r="2.5" fill="#6B7280"/><circle cx="20" cy="23" r="2.5" fill="#6B7280"/></svg>`, label:'Shopping Cart', sub:null, cat:'avoid' },
  fallen_sequoia:   { svg:`<svg width="44" height="18" viewBox="0 0 44 18"><rect x="2" y="5" width="40" height="10" rx="5" fill="#166534"/><rect x="2" y="5" width="40" height="4" rx="4" fill="#15803D"/><line x1="10" y1="5" x2="10" y2="15" stroke="#14532D" stroke-width="1.5"/><line x1="22" y1="5" x2="22" y2="15" stroke="#14532D" stroke-width="1.5"/><line x1="34" y1="5" x2="34" y2="15" stroke="#14532D" stroke-width="1.5"/></svg>`, label:'Sequoia', sub:'JUMP!', cat:'jump' },
  raft_train:       { svg:`<svg width="44" height="18" viewBox="0 0 44 18"><rect x="2" y="4" width="18" height="10" rx="2" fill="#92400E"/><rect x="24" y="4" width="18" height="10" rx="2" fill="#92400E"/><rect x="2" y="4" width="18" height="4" rx="2" fill="#B45309"/><rect x="24" y="4" width="18" height="4" rx="2" fill="#B45309"/><line x1="20" y1="9" x2="24" y2="9" stroke="#78350F" stroke-width="2"/></svg>`, label:'Raft Train', sub:'JUMP!', cat:'jump' },
  pontoon_party:    { svg:`<svg width="44" height="22" viewBox="0 0 44 22"><rect x="4" y="10" width="36" height="10" rx="3" fill="#1D4ED8"/><rect x="4" y="4" width="36" height="8" rx="2" fill="#EFF6FF" opacity="0.9"/><circle cx="13" cy="8" r="2.5" fill="#FBBF24"/><circle cx="22" cy="8" r="2.5" fill="#F97316"/><circle cx="31" cy="8" r="2.5" fill="#FBBF24"/></svg>`, label:'Pontoon Party', sub:'JUMP!', cat:'jump' },
  old_mining_bridge:{ svg:`<svg width="44" height="20" viewBox="0 0 44 20"><rect x="2" y="6" width="40" height="10" fill="#44403C"/><rect x="2" y="6" width="40" height="4" fill="#78350F"/><line x1="7" y1="2" x2="7" y2="20" stroke="#292524" stroke-width="3"/><line x1="37" y1="2" x2="37" y2="20" stroke="#292524" stroke-width="3"/><line x1="2" y1="5" x2="42" y2="5" stroke="#1C1917" stroke-width="2"/></svg>`, label:'Old Bridge', sub:'JUMP!', cat:'jump' },
  tube_float_parade:{ svg:`<svg width="44" height="22" viewBox="0 0 44 22"><circle cx="10" cy="14" r="7" fill="none" stroke="#F97316" stroke-width="3"/><circle cx="22" cy="14" r="7" fill="none" stroke="#60A5FA" stroke-width="3"/><circle cx="34" cy="14" r="7" fill="none" stroke="#F472B6" stroke-width="3"/><circle cx="10" cy="5" r="3" fill="#FBBF24"/><circle cx="22" cy="5" r="3" fill="#FBBF24"/><circle cx="34" cy="5" r="3" fill="#FBBF24"/></svg>`, label:'Float Parade', sub:'JUMP!', cat:'jump' },
  poppy:            { svg:`<svg width="26" height="26" viewBox="0 0 26 26"><ellipse cx="13" cy="6" rx="3.5" ry="6" fill="#F97316"/><ellipse cx="13" cy="20" rx="3.5" ry="6" fill="#FB923C"/><ellipse cx="6" cy="13" rx="6" ry="3.5" fill="#F97316"/><ellipse cx="20" cy="13" rx="6" ry="3.5" fill="#FB923C"/><circle cx="13" cy="13" r="3.5" fill="#FBBF24"/><circle cx="13" cy="13" r="1.5" fill="#78350F"/></svg>`, label:'Poppy Power', sub:'SHIELD', cat:'collect' },
  golden_trout:     { svg:`<svg width="30" height="18" viewBox="0 0 30 18"><ellipse cx="12" cy="9" rx="9" ry="5" fill="#FBBF24"/><polygon points="21,9 30,4 30,14" fill="#FBBF24"/><ellipse cx="12" cy="9" rx="6" ry="3" fill="#F59E0B"/><circle cx="6" cy="7" r="1.5" fill="#0B1F3A"/></svg>`, label:'Golden Trout', sub:'+50', cat:'collect' },
  mountain_crystal: { svg:`<svg width="24" height="28" viewBox="0 0 24 28"><polygon points="12,2 22,10 18,26 6,26 2,10" fill="#A5F3FC"/><polygon points="12,2 22,10 12,10" fill="#E0F9FF" opacity="0.8"/><polygon points="12,10 6,26 18,26" fill="#38BDF8" opacity="0.7"/></svg>`, label:'M. Crystal', sub:'+150 RARE', cat:'collect' },
  fishing_lure:     { svg:`<svg width="24" height="26" viewBox="0 0 24 26"><ellipse cx="12" cy="12" rx="5" ry="9" fill="#EF4444"/><ellipse cx="10.5" cy="9.5" rx="2.5" ry="5" fill="#FCA5A5" opacity="0.7"/><path d="M12,21 Q17,24 18,21 Q18,17 16,19" fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round"/></svg>`, label:'Fishing Lure', sub:'+50', cat:'collect' },
  golden_eagle_feather:{ svg:`<svg width="16" height="30" viewBox="0 0 16 30"><path d="M8,2 C12,8 14,16 10,26 C8,28 6,28 6,26 C4,22 4,14 8,2 Z" fill="#C9883A"/><line x1="8" y1="4" x2="8" y2="26" stroke="#B45309" stroke-width="1" stroke-linecap="round"/></svg>`, label:'Eagle Feather', sub:'+50', cat:'collect' },
  beach_ball:       { svg:`<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#60A5FA"/><path d="M2,13 Q13,2 24,13" fill="#EF4444"/><path d="M2,13 Q13,24 24,13" fill="#FDE68A"/></svg>`, label:'Beach Ball', sub:'+50', cat:'collect' },
  cooler:           { svg:`<svg width="32" height="22" viewBox="0 0 32 22"><rect x="3" y="6" width="26" height="13" rx="2" fill="#1D4ED8"/><rect x="3" y="6" width="26" height="5" rx="2" fill="#EFF6FF"/><rect x="11" y="2" width="10" height="5" rx="1" fill="#3B82F6"/></svg>`, label:'Cooler', sub:'+50', cat:'collect' },
  gold_nugget:      { svg:`<svg width="24" height="22" viewBox="0 0 24 22"><path d="M12,2 L21,7 L19,20 L5,20 L3,7 Z" fill="#FBBF24"/><path d="M6,4 L14,8 L10,13 Z" fill="#FDE68A" opacity="0.75"/></svg>`, label:'Gold Nugget', sub:'+50', cat:'collect' },
  treasure_chest:   { svg:`<svg width="28" height="24" viewBox="0 0 28 24"><rect x="2" y="10" width="24" height="12" rx="2" fill="#92400E"/><path d="M2,10 Q14,4 26,10" fill="#B45309"/><rect x="2" y="10" width="24" height="3" fill="#B45309"/><rect x="11" y="11" width="6" height="5" rx="1" fill="#FBBF24"/><circle cx="14" cy="14" r="1.5" fill="#C9883A"/></svg>`, label:'Treasure Chest', sub:'+150 RARE', cat:'collect' },
  fox_theater_ticket:{ svg:`<svg width="30" height="20" viewBox="0 0 30 20"><rect x="2" y="3" width="26" height="14" rx="2" fill="#7C3AED"/><rect x="2" y="3" width="26" height="6" rx="2" fill="#8B5CF6"/><circle cx="15" cy="12" r="3" fill="#FBBF24"/></svg>`, label:'Fox Ticket', sub:'+50', cat:'collect' },
  city_seal_medallion:{ svg:`<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#C9883A"/><circle cx="13" cy="13" r="8.5" fill="#1D4ED8"/><circle cx="13" cy="13" r="5" fill="none" stroke="#93C5FD" stroke-width="1.5"/><circle cx="13" cy="13" r="2.5" fill="#93C5FD"/></svg>`, label:'City Seal', sub:'+50', cat:'collect' },
};

function legendRow(type) {
  const info = ITEM_ICONS[type];
  if (!info) return '';
  let sub = '';
  if      (info.cat === 'jump')    sub = '<br><em>(JUMP!)</em>';
  else if (info.sub === 'SPIN OUT') sub = '<br><em>SPIN OUT</em>';
  else if (info.sub === 'SHIELD')  sub = '<br><em>SHIELD</em>';
  else if (info.sub)               sub = `<br><em>${info.sub}</em>`;
  return `<div class="legend-row">${info.svg}<span>${info.label}${sub}</span></div>`;
}

function updateLegend(idx) {
  const el = document.getElementById('gameLegend');
  if (!el) return;
  const stg    = STAGES[idx];
  const fwType = Array.isArray(stg.fwType) ? stg.fwType[0] : stg.fwType;
  el.innerHTML =
    `<p class="legend-title">STAGE ${stg.num}: ${stg.name}</p>` +
    `<p class="legend-section avoid-label">AVOID</p>` +
    legendRow('boulder') +
    legendRow('river_wash') +
    legendRow(stg.stageObs) +
    legendRow(fwType) +
    `<p class="legend-section collect-label">COLLECT</p>` +
    legendRow('poppy') +
    legendRow(stg.collA) +
    legendRow(stg.collB);
}

// ── IMAGE PRELOADS ────────────────────────────────────────────────
const logoImg     = new Image();
let   logoLoaded  = false;
logoImg.onload    = () => { logoLoaded = true; };
logoImg.src       = 'assets/kern-river-run-logo.png';

// Sierra Nevada photo — start screen background + Stage 1 horizon art
const bgSceneImg    = new Image();
let   bgSceneLoaded = false;
bgSceneImg.onload   = () => { bgSceneLoaded = true; };
bgSceneImg.src      = 'sierra-nevada-bg.png.png';

// ── INIT ─────────────────────────────────────────────────────────
resizeCanvas();
player.x = getLaneX(player.targetLane);
player.y = Math.floor(canvas.height * PLAYER_Y_RATIO);
updateLegend(0);

document.fonts.ready.then(() => requestAnimationFrame(gameLoop));
