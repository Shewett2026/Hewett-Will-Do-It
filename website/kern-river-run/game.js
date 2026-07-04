// ================================================================
// KERN RIVER RUN — game.js
// Phase 3 + Visual Polish + Angled Perspective + Start Screen
// ================================================================

// ── FIXED CONSTANTS ──────────────────────────────────────────────
const JUMP_DURATION           = 42;
const JUMP_SCALE_PEAK         = 1.45;
const PIXELS_PER_MILE         = 900;
const SCORE_PER_FRAME         = 2;
const MIN_OBSTACLE_GAP        = 135;
const SPAWN_Y_OFFSET          = 60;
const PLAYER_Y_RATIO          = 0.80;
const HUD_H                   = 54;
const HORIZON_OFFSET          = 80;     // horizon is this many px below HUD
const COLLECTIBLE_SCORE_VALUE = 50;
const COLLECTIBLE_FREQUENCY   = 0.008;
const ENDING_SLOWDOWN_FRAMES  = 90;

const COLL_GLOW = { drop: '#38BDF8', fish: '#34D399', poppy: '#F97316' };
// ─────────────────────────────────────────────────────────────────

// ── STAGE DATA ───────────────────────────────────────────────────
const STAGES = [
  {
    num: 1, name: 'HEADWATERS', enterMsg: null,
    startMile: 0,   endMile: 33,  lanes: 7,
    speed: 1.7,  obsFreq: 0.014, fwFreq: 0.11,
    obsTypes: ['rock','rock','branch','roots','rapids'],
    fwType: 'wooden_bridge',
  },
  {
    num: 2, name: 'UPPER KERN', enterMsg: 'ENTERING UPPER KERN',
    startMile: 33,  endMile: 66,  lanes: 6,
    speed: 1.9,  obsFreq: 0.015, fwFreq: 0.12,
    obsTypes: ['boulder','boulder','wave','kayak_traffic','branch'],
    fwType: ['wooden_bridge','tube_procession'],
  },
  {
    num: 3, name: 'LAKE ISABELLA', enterMsg: 'ENTERING LAKE ISABELLA',
    startMile: 66,  endMile: 99,  lanes: 5,
    speed: 2.05, obsFreq: 0.016, fwFreq: 0.10,
    obsTypes: ['piling','fishing','cooler','wave','boulder'],
    fwType: 'tube_procession',
  },
  {
    num: 4, name: 'KERN CANYON', enterMsg: 'ENTERING KERN CANYON',
    startMile: 99,  endMile: 132, lanes: 4,
    speed: 2.2,  obsFreq: 0.017, fwFreq: 0.12,
    obsTypes: ['rockslide','cone','barrier','boulder','crack'],
    fwType: 'tube_riders',
  },
  {
    num: 5, name: 'BAKERSFIELD', enterMsg: 'APPROACHING BAKERSFIELD',
    startMile: 132, endMile: 165, lanes: 3,
    speed: 2.3,  obsFreq: 0.015, fwFreq: 0.09,
    obsTypes: ['tumbleweed','sandbar','crack','cone','branch'],
    fwType: 'tube_riders',
    subNarrow: [
      { atMile: 150, lanes: 2, msg: 'THE RIVER NARROWS', obsFreq: 0.012 },
      { atMile: 160, lanes: 1, msg: 'FINAL STRETCH',     obsFreq: 0.009 },
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

// ── PLAYER ───────────────────────────────────────────────────────
const player = {
  lane: 3, targetLane: 3, x: 0, y: 0,
  isJumping: false, jumpFrame: 0, jumpScale: 1.0, shadowScale: 1.0,
  animFrame: 0, dead: false,
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

// River width at a given screen y (scales with perspective)
function riverWidthAt(y) {
  return riverW() * Math.max(0, perspT(y));
}

// Left edge of river at screen y
function riverLeftAt(y) {
  return canvas.width / 2 - riverWidthAt(y) / 2;
}

// X position for lane center at screen y (perspective-correct)
function laneXAt(lane, y) {
  const t  = Math.max(0, perspT(y));
  const rw = riverW() * t;
  const lw = rw / currentLanes;
  return canvas.width / 2 - rw / 2 + (lane + 0.5) * lw;
}

// Uniform scale factor for sprites: 1.0 at player.y, small near horizon
function scaleAt(y) {
  return Math.max(0.05, perspT(y));
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

  // River trapezoid — converges to a point at (W/2, hy)
  const botLx = riverLeftAt(H), botRx = W - botLx;
  const riverGrad = ctx.createLinearGradient(0, hy, 0, H);
  riverGrad.addColorStop(0,   th.wm);
  riverGrad.addColorStop(0.5, th.we);
  riverGrad.addColorStop(1,   th.wm);
  ctx.fillStyle = riverGrad;
  ctx.beginPath();
  ctx.moveTo(W / 2, hy);
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

  // Lane dividers — lines converging to horizon center
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 1;
  for (let l = 1; l < currentLanes; l++) {
    const ex = riverLeftAt(H) + l * (riverWidthAt(H) / currentLanes);
    ctx.beginPath(); ctx.moveTo(W / 2, hy); ctx.lineTo(ex, H); ctx.stroke();
  }
  ctx.restore();

  // Left bank trapezoid
  const lbGrad = ctx.createLinearGradient(0, hy, 0, H);
  lbGrad.addColorStop(0, th.bl); lbGrad.addColorStop(1, th.bd);
  ctx.fillStyle = lbGrad;
  ctx.beginPath();
  ctx.moveTo(0, hy); ctx.lineTo(W / 2, hy);
  ctx.lineTo(botLx, H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();

  // Right bank trapezoid
  const rbGrad = ctx.createLinearGradient(0, hy, 0, H);
  rbGrad.addColorStop(0, th.bl); rbGrad.addColorStop(1, th.bd);
  ctx.fillStyle = rbGrad;
  ctx.beginPath();
  ctx.moveTo(W / 2, hy); ctx.lineTo(W, hy);
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
  ctx.shadowColor   = 'rgba(0,0,0,0.50)';
  ctx.shadowBlur    = 12 * scaleAt(obs.y);
  ctx.shadowOffsetY = 6  * scaleAt(obs.y);
  switch (obs.type) {
    case 'wooden_bridge':   drawWoodenBridge(obs);   break;
    case 'tube_procession': drawTubeProcession(obs); break;
    case 'tube_riders':     drawTubeRiders(obs);     break;
    default:                drawWoodenBridge(obs);   break;
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

// ── DRAW: LANE OBSTACLES (PERSPECTIVE-SCALED) ────────────────────
function drawLaneObs(obs) {
  const sc  = scaleAt(obs.y);
  const lw_ = Math.max(1, riverWidthAt(obs.y) / currentLanes);
  const cx  = laneXAt(obs.lane, obs.y);
  const r   = Math.min(lw_ * 0.44, obs.h * 0.68 * sc);

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = 8 * sc;
  ctx.shadowOffsetY = 5 * sc;
  ctx.shadowOffsetX = 1 * sc;
  drawObsAt(obs.type, cx, obs.y, r, lw_);
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

function drawCollAt(type, cx, cy, s) {
  if      (type === 'drop')  drawDrop(cx, cy, s);
  else if (type === 'fish')  drawFish(cx, cy, s);
  else if (type === 'poppy') drawPoppy(cx, cy, s);
}

// ── COLLECTIBLE MANAGEMENT ───────────────────────────────────────
function pickCollectibleType() {
  const r = Math.random();
  if (currentStageIdx <= 2) {
    if (r < 0.50) return 'fish';
    if (r < 0.80) return 'drop';
    return 'poppy';
  } else {
    if (r < 0.50) return 'poppy';
    if (r < 0.80) return 'drop';
    return 'fish';
  }
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
    const sc = scaleAt(c.y);
    const x  = laneXAt(c.lane, c.y);
    const s  = 11 * sc;
    ctx.save();
    ctx.shadowColor = COLL_GLOW[c.type] || '#FFFFFF';
    ctx.shadowBlur  = 14 * sc;
    drawCollAt(c.type, x, c.y, s);
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
      score += COLLECTIBLE_SCORE_VALUE;
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
  const KW = 12, KH = 28;
  const s  = player.jumpScale;
  const px = player.x, py = player.y;
  const paddleLeft  = (player.animFrame % 60) < 30;
  const paddleAngle = paddleLeft ? -0.30 : 0.30;

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
const H_OVERRIDES = { rapids:46, wave:44, kayak_traffic:40, sandbar:40, boulder:36, rockslide:38 };

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

// Collision operates at player.y where perspT=1:
// laneXAt(lane, player.y) === getLaneX(lane), geometry is identical to pre-perspective code
function checkCollision() {
  const py = player.y, half = 12;
  for (const obs of obstacles) {
    if (obs.resolved) continue;
    if (obs.y + obs.h >= py - half && obs.y <= py + half) {
      obs.resolved = true;
      const safe = player.isJumping || (!obs.fullWidth && obs.lane !== player.targetLane);
      if (!safe) { endRun(false); return; }
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

  } else if (gameState === 'start')   { drawStartScreen(); }
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
  obstacles = []; collectibles = []; splashes = [];
  dustParticles = []; endingPhase = 0; endingTimer = 0; endingSpeedMult = 1.0;
  initBgDecor();
  gameState = 'playing';
}

// ── SCREEN: START ────────────────────────────────────────────────
function drawStartScreen() {
  const W = canvas.width, H = canvas.height;

  // Base gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B1F3A'); bg.addColorStop(0.55, '#0B2D4F'); bg.addColorStop(1, '#1A3D5C');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Sierra Nevada background image — fills lower 58% of screen
  const bgY = H * 0.36;
  if (bgSceneLoaded) {
    ctx.drawImage(bgSceneImg, 0, bgY, W, H - bgY);
    // Fade the top edge of the image to blend with gradient above
    const fadeH = H * 0.16;
    const fade  = ctx.createLinearGradient(0, bgY, 0, bgY + fadeH);
    fade.addColorStop(0, '#0B2D4F');
    fade.addColorStop(1, 'rgba(11,45,79,0)');
    ctx.fillStyle = fade; ctx.fillRect(0, bgY, W, fadeH);
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

  // Logo with 'screen' blend mode to remove baked-in black background
  const logoW = Math.min(W * 0.76, 300);
  if (logoLoaded && logoImg.naturalWidth > 0) {
    const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, (W - logoW) / 2, H * 0.05, logoW, logoH);
    ctx.restore();
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C9883A'; ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('KERN',  W/2, H*0.14); ctx.fillText('RIVER', W/2, H*0.14+30);
    ctx.fillStyle = '#F5F0E8'; ctx.fillText('RUN', W/2, H*0.14+60);
  }

  // Subtitle — scaled up significantly (9px, was 6px)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#BAE6FD';
  ctx.fillText('Can you follow the Kern River', W/2, H*0.46);
  ctx.fillText('all 165 miles to Bakersfield?', W/2, H*0.46 + 17);

  // Buttons (labels drawn at 9px via drawBtn)
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
    ['Paddle left/right between', '#F5F0E8'],
    ['river lanes to dodge',      '#F5F0E8'],
    ['rocks, branches & more.',   '#F5F0E8'],
    ['', ''],
    ['JUMP over full-width',      '#FDE68A'],
    ['obstacles spanning',        '#FDE68A'],
    ['the whole river!',          '#FDE68A'],
    ['', ''],
    ['Grab drops, fish &',        '#38BDF8'],
    ['poppies for +50 pts each.', '#38BDF8'],
    ['', ''],
    ['— DESKTOP —',               '#C9883A'],
    ['LEFT / RIGHT  arrow keys',  '#F5F0E8'],
    ['SPACE or UP   jump',        '#F5F0E8'],
    ['', ''],
    ['— MOBILE —',                '#C9883A'],
    ['SWIPE left / right  lane',  '#F5F0E8'],
    ['TAP anywhere   jump',       '#F5F0E8'],
    ['', ''],
    ['Follow the Kern River',     '#93C5FD'],
    ['165 miles to Bakersfield!', '#93C5FD'],
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
  ctx.fillText('ITEM GUIDE', W/2, H*0.07);

  const iconR  = 13, iconS = 11, lw_ = 65;
  const colL   = W * 0.27, colR = W * 0.73;
  const startY = H * 0.16;
  const rowH   = Math.min(52, (H - startY - 90) / 7);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#EF4444'; ctx.textAlign = 'center';
  ctx.fillText('— AVOID —', colL, startY - 16);
  ctx.fillStyle = '#34D399'; ctx.fillText('— COLLECT —', colR, startY - 16);

  const avoidItems = [
    { type:'rock',       label:'Rock' },
    { type:'boulder',    label:'Boulder' },
    { type:'branch',     label:'Branch' },
    { type:'wave',       label:'Wave' },
    { type:'tumbleweed', label:'Tumbleweed' },
    { type:'sandbar',    label:'Sandbar' },
  ];
  for (let i = 0; i < avoidItems.length; i++) {
    const { type, label } = avoidItems[i];
    const iy = startY + i * rowH;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
    drawObsAt(type, colL, iy, iconR, lw_);
    ctx.restore();
    ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#F5F0E8'; ctx.textAlign = 'center';
    ctx.fillText(label, colL, iy + iconR + 9);
  }

  const bridgeY = startY + avoidItems.length * rowH;
  const bW = 34, bH = 14;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=6; ctx.shadowOffsetY=4;
  ctx.fillStyle = '#92400E'; ctx.fillRect(colL - bW/2, bridgeY - bH/2, bW, bH);
  ctx.fillStyle = '#5C2D0A';
  ctx.fillRect(colL - bW/2 - 2, bridgeY - bH/2 - 5, 5, bH + 10);
  ctx.fillRect(colL + bW/2 - 3, bridgeY - bH/2 - 5, 5, bH + 10);
  ctx.restore(); ctx.save(); clearShadow();
  ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#FDE68A'; ctx.textAlign = 'center';
  ctx.fillText('Bridge',  colL, bridgeY + bH/2 + 9);
  ctx.fillText('(JUMP!)', colL, bridgeY + bH/2 + 20);
  ctx.restore();

  const collectItems = [
    { type:'drop',  label:'Drop',  pts:'+50' },
    { type:'fish',  label:'Fish',  pts:'+50' },
    { type:'poppy', label:'Poppy', pts:'+50' },
  ];
  for (let i = 0; i < collectItems.length; i++) {
    const { type, label, pts } = collectItems[i];
    const iy = startY + rowH + i * rowH * 1.6;
    ctx.save();
    ctx.shadowColor = COLL_GLOW[type]; ctx.shadowBlur = 14;
    drawCollAt(type, colR, iy, iconS);
    ctx.restore();
    ctx.font = '5px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#F5F0E8'; ctx.fillText(label, colR, iy + iconS + 9);
    ctx.fillStyle = '#C9883A'; ctx.fillText(pts + ' pts', colR, iy + iconS + 20);
  }

  drawBtn('< BACK',  W*0.27, H*0.93, W*0.48, 38, '#1E3A5F', '#C9883A');
  drawBtn('GOT IT!', W*0.73, H*0.93, W*0.48, 38, '#2D6A4F', '#F5F0E8');
}

// ── SCREEN: GAME OVER ────────────────────────────────────────────
function drawGameOver() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.92)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#EF4444'; ctx.font = '11px "Press Start 2P", monospace';
  ctx.fillText('RUN ENDED', W/2, H*0.22);
  const stg = STAGES[currentStageIdx];
  ctx.font = '7px "Press Start 2P", monospace'; ctx.fillStyle = '#F5F0E8';
  ctx.fillText('Wiped out on ' + stg.name, W/2, H*0.32);
  ctx.fillText('Mile ' + currentMile + ' / 165', W/2, H*0.32+18);
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = '#C9883A'; ctx.fillText('SCORE  ' + Math.floor(score),     W/2, H*0.52);
  ctx.fillStyle = '#93C5FD'; ctx.fillText('BEST   ' + Math.floor(highScore), W/2, H*0.52+22);
  drawBtn('TRY AGAIN', W/2, H*0.68,      W*0.62, 42, '#2D6A4F', '#F5F0E8');
  drawBtn('MAIN MENU', W/2, H*0.68 + 56, W*0.62, 42, '#1E3A5F', '#C9883A');
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
  if (player.targetLane > 0) { spawnSplash(player.x, player.y+8); player.targetLane--; }
}
function doMoveRight() {
  if (player.targetLane < currentLanes-1) { spawnSplash(player.x, player.y+8); player.targetLane++; }
}
function doJump() {
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

document.fonts.ready.then(() => requestAnimationFrame(gameLoop));
