// ================================================================
// KERN RIVER RUN — game.js   Phase 2
// All 5 stages · Miles 0–165 · Progressive lane narrowing
// ================================================================

// ── FIXED CONSTANTS ──────────────────────────────────────────────
const JUMP_DURATION    = 42;    // frames for full jump arc (~0.7 s @ 60 fps)
const JUMP_SCALE_PEAK  = 1.45;  // sprite scale multiplier at jump apex
const PIXELS_PER_MILE  = 900;   // px scrolled per in-game mile
const SCORE_PER_FRAME  = 2;     // points per frame while playing
const MIN_OBSTACLE_GAP = 135;   // px minimum gap between spawns
const SPAWN_Y_OFFSET   = 60;    // px above canvas where obstacles are born
const PLAYER_Y_RATIO   = 0.78;  // player's fixed y as fraction of canvas height
const HUD_H            = 54;    // px height of top HUD bar
// ─────────────────────────────────────────────────────────────────

// ── STAGE DATA ───────────────────────────────────────────────────
// Each stage defines its own lane count, speed, obstacle mix, and theming.
// Speed/frequency increase gently so the game remains a relaxed river float.
const STAGES = [
  {
    num: 1, name: 'HEADWATERS', enterMsg: null,
    startMile: 0,   endMile: 33,  lanes: 7,
    speed: 1.7,  obsFreq: 0.014, fwFreq: 0.11,
    obsTypes: ['rock','rock','branch','roots','rapids'],
    fwType: 'log',
  },
  {
    num: 2, name: 'UPPER KERN', enterMsg: 'ENTERING UPPER KERN',
    startMile: 33,  endMile: 66,  lanes: 6,
    speed: 1.9,  obsFreq: 0.015, fwFreq: 0.12,
    obsTypes: ['boulder','boulder','wave','kayak_traffic','branch'],
    fwType: 'bridge_low',
  },
  {
    num: 3, name: 'LAKE ISABELLA', enterMsg: 'ENTERING LAKE ISABELLA',
    startMile: 66,  endMile: 99,  lanes: 5,
    speed: 2.05, obsFreq: 0.016, fwFreq: 0.10,
    obsTypes: ['piling','fishing','cooler','wave','boulder'],
    fwType: 'floater',
  },
  {
    num: 4, name: 'KERN CANYON', enterMsg: 'ENTERING KERN CANYON',
    startMile: 99,  endMile: 132, lanes: 4,
    speed: 2.2,  obsFreq: 0.017, fwFreq: 0.12,
    obsTypes: ['rockslide','cone','barrier','boulder','crack'],
    fwType: 'bridge_beam',
  },
  {
    num: 5, name: 'BAKERSFIELD', enterMsg: 'APPROACHING BAKERSFIELD',
    startMile: 132, endMile: 165, lanes: 3,
    speed: 2.3,  obsFreq: 0.015, fwFreq: 0.09,
    obsTypes: ['tumbleweed','sandbar','crack','cone','branch'],
    fwType: 'gate',
    // Lane count narrows two more times within Stage 5
    subNarrow: [
      { atMile: 150, lanes: 2, msg: 'THE RIVER NARROWS', obsFreq: 0.012 },
      { atMile: 160, lanes: 1, msg: 'FINAL STRETCH',     obsFreq: 0.009 },
    ],
  },
];

// ── VISUAL THEMES (one per stage) ────────────────────────────────
// [water edge color, water center color, bank dark, bank light, current alpha, current color]
const BG_THEMES = [
  { we:'#1A56C4', wm:'#3B82F6', bd:'#374151', bl:'#4B5563', ca:0.11, cc:'#BAE6FD', snow:true  }, // S1
  { we:'#1D4ED8', wm:'#2563EB', bd:'#7C2D12', bl:'#9A3412', ca:0.17, cc:'#FED7AA', snow:false }, // S2
  { we:'#1E6CB5', wm:'#38BDF8', bd:'#78716C', bl:'#A8A29E', ca:0.07, cc:'#BAE6FD', snow:false }, // S3
  { we:'#1E3A5F', wm:'#1D4ED8', bd:'#1C1917', bl:'#292524', ca:0.13, cc:'#93C5FD', snow:false }, // S4
  { we:'#1D4ED8', wm:'#60A5FA', bd:'#D97706', bl:'#FBBF24', ca:0.06, cc:'#BAE6FD', snow:false }, // S5
];

// Decor type/color pools per stage for bank decoration
const DECOR_THEMES = [
  { types:['tree','rock'],       hues:['#166534','#15803D'] }, // S1 pine + snow rock
  { types:['rock','rock'],       hues:['#A16207','#78350F'] }, // S2 rust boulders
  { types:['tree','dock'],       hues:['#D97706','#B45309'] }, // S3 cottonwood + dock
  { types:['rock','rock'],       hues:['#44403C','#57534E'] }, // S4 dark cliff
  { types:['cottonwood','rock'], hues:['#A16207','#CA8A04'] }, // S5 cottonwood + sand
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
let journeyComplete = false;
let obstacles       = [];
let bgDecor         = [];
let splashes        = [];

// Stage runtime state (driven by STAGES table)
let currentStageIdx = 0;
let currentLanes    = STAGES[0].lanes;
let currentSpeed    = STAGES[0].speed;
let currentObsFreq  = STAGES[0].obsFreq;
let currentFwFreq   = STAGES[0].fwFreq;
let currentObsTypes = STAGES[0].obsTypes;
let currentFwType   = STAGES[0].fwType;
let transitionMsg   = null; // { text, life, maxLife }
let subNarrowFired  = new Set();

// ── PLAYER ───────────────────────────────────────────────────────
const player = {
  lane: 3, targetLane: 3, x: 0, y: 0,
  isJumping: false, jumpFrame: 0, jumpScale: 1.0, shadowScale: 1.0,
  animFrame: 0, dead: false,
};

// ── LANE GEOMETRY (dynamic — widens banks as lanes decrease) ─────
function bankW() {
  // River visually narrows as lane count drops:
  // 7 lanes → 7% each bank; 1 lane → 31% each bank
  const frac = 0.07 + (7 - currentLanes) * 0.04;
  return Math.floor(canvas.width * frac);
}
function riverW()  { return canvas.width - 2 * bankW(); }
function laneW()   { return riverW() / currentLanes; }
function getLaneX(lane) { return bankW() + (lane + 0.5) * laneW(); }

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
  obstacles = [];
  splashes  = [];
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

// ── BACKGROUND DECOR POOL ────────────────────────────────────────
function initBgDecor() {
  bgDecor = [];
  const dt   = DECOR_THEMES[currentStageIdx];
  const poolH = canvas.height * 2.2;
  const bw   = bankW();
  for (let i = 0; i < 28; i++) {
    const ti = Math.floor(Math.random() * dt.types.length);
    bgDecor.push({
      type: dt.types[ti],
      hue:  dt.hues[ti],
      side: Math.random() < 0.5 ? 'L' : 'R',
      offX: bw * (0.08 + Math.random() * 0.84),
      y:    Math.random() * poolH,
      sz:   5 + Math.random() * 9,
    });
  }
}

// ── DRAW: BACKGROUND ─────────────────────────────────────────────
function drawBackground() {
  const W  = canvas.width;
  const H  = canvas.height;
  const bw = bankW();
  const rw = riverW();
  const th = BG_THEMES[currentStageIdx];

  // Water gradient
  const wg = ctx.createLinearGradient(bw, 0, bw + rw, 0);
  wg.addColorStop(0,    th.we);
  wg.addColorStop(0.5,  th.wm);
  wg.addColorStop(1.0,  th.we);
  ctx.fillStyle = wg;
  ctx.fillRect(bw, 0, rw, H);

  // Stage 5 — dry patches appear as water thins out
  if (currentStageIdx === 4 && currentMile > 148) {
    const dry = Math.min(1, (currentMile - 148) / 17);
    ctx.save();
    ctx.globalAlpha = dry * 0.45;
    ctx.fillStyle   = '#D97706';
    const patchOff  = bgScrollY * 0.7;
    for (let i = 0; i < 9; i++) {
      const px = bw + ((i * 67 + 23) % (rw - 20));
      const py = ((i * 113 + patchOff) % (H - 20));
      ctx.beginPath();
      ctx.ellipse(px, py, 12 + i % 6, 6 + i % 4, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Scrolling current lines
  const lg = 38, lo = bgScrollY % lg;
  ctx.save();
  ctx.globalAlpha = th.ca;
  ctx.strokeStyle = th.cc;
  ctx.lineWidth   = 1;
  for (let y = -lg + lo; y < H + lg; y += lg) {
    ctx.beginPath(); ctx.moveTo(bw, y); ctx.lineTo(bw + rw, y); ctx.stroke();
  }
  ctx.restore();

  // Lane dividers
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#93C5FD';
  ctx.lineWidth   = 1;
  const lw = laneW();
  for (let l = 1; l < currentLanes; l++) {
    const x = bw + l * lw;
    ctx.beginPath(); ctx.moveTo(x, HUD_H); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.restore();

  // Banks
  const lgL = ctx.createLinearGradient(0, 0, bw, 0);
  lgL.addColorStop(0, th.bd); lgL.addColorStop(1, th.bl);
  ctx.fillStyle = lgL;
  ctx.fillRect(0, 0, bw, H);

  const lgR = ctx.createLinearGradient(W - bw, 0, W, 0);
  lgR.addColorStop(0, th.bl); lgR.addColorStop(1, th.bd);
  ctx.fillStyle = lgR;
  ctx.fillRect(W - bw, 0, bw, H);

  // Snow patches (Stage 1 only)
  if (th.snow) {
    ctx.save();
    ctx.fillStyle   = '#EFF6FF';
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 8; i++) {
      const sx = i * 17 % bw, sy = i * 53 % H;
      ctx.fillRect(sx,          sy,      6 + i % 4, 3);
      ctx.fillRect(W - bw + sx, sy + 20, 5 + i % 3, 3);
    }
    ctx.restore();
  }

  // Stage 4 — canyon wall striations
  if (currentStageIdx === 3) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth   = 2;
    for (let i = 0; i < 5; i++) {
      const lx = (i * 9) % bw;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 4, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - bw + lx, 0); ctx.lineTo(W - bw + lx + 4, H); ctx.stroke();
    }
    ctx.restore();
  }

  drawBankDecor();
}

function drawBankDecor() {
  const W    = canvas.width;
  const H    = canvas.height;
  const bw   = bankW();
  const pool = H * 2.2;
  const th   = BG_THEMES[currentStageIdx];

  for (const d of bgDecor) {
    const rawY = (d.y + bgScrollY * 0.9) % pool;
    const sy   = rawY - H * 0.1;
    if (sy < -d.sz * 3 || sy > H + d.sz) continue;
    const sx = d.side === 'L' ? d.offX : W - bw + (bw - d.offX);

    if (d.type === 'tree') {
      // Pine triangle with optional snow cap (Stage 1)
      ctx.fillStyle = d.hue;
      ctx.beginPath();
      ctx.moveTo(sx,              sy - d.sz);
      ctx.lineTo(sx - d.sz * 0.7, sy + d.sz * 0.55);
      ctx.lineTo(sx + d.sz * 0.7, sy + d.sz * 0.55);
      ctx.closePath();
      ctx.fill();
      if (th.snow) {
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
      }

    } else if (d.type === 'cottonwood') {
      // Rounded cottonwood — oval crown (Stage 5 arid)
      ctx.fillStyle = d.hue;
      ctx.beginPath();
      ctx.ellipse(sx, sy, d.sz * 0.8, d.sz * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = th.bd;
      ctx.fillRect(sx - 2, sy + d.sz * 0.55, 4, d.sz * 0.6);

    } else if (d.type === 'dock') {
      // Dock post — dark rectangle (Stage 3 lake)
      ctx.fillStyle = '#44403C';
      ctx.fillRect(sx - 3, sy - d.sz * 0.5, 6, d.sz * 1.2);
      ctx.fillStyle = '#57534E';
      ctx.fillRect(sx - 3, sy - d.sz * 0.5, 6, 3);

    } else {
      // Rock — ellipse
      ctx.fillStyle = d.hue;
      ctx.beginPath();
      ctx.ellipse(sx, sy, d.sz, d.sz * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.fillStyle   = '#EFF6FF';
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(sx, sy - d.sz * 0.12, d.sz * 0.55, d.sz * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── DRAW: OBSTACLES ──────────────────────────────────────────────
function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.resolved && obs.y > player.y) continue;
    obs.fullWidth ? drawFullWidthObs(obs) : drawLaneObs(obs);
  }
}

// ── DRAW: FULL-WIDTH OBSTACLES ───────────────────────────────────
function jumpLabel(obs) {
  if (obs.y > 0 && obs.y < canvas.height * 0.5) {
    ctx.save();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#FDE68A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('JUMP!', canvas.width / 2, obs.y + obs.h / 2);
    ctx.restore();
  }
}

function drawFullWidthObs(obs) {
  switch (obs.type) {
    case 'log':         drawLog(obs);        break;
    case 'bridge_low':  drawBridgeLow(obs);  break;
    case 'floater':     drawFloater(obs);    break;
    case 'bridge_beam': drawBridgeBeam(obs); break;
    case 'gate':        drawGate(obs);       break;
  }
}

function drawLog(obs) {
  const bw = bankW(), rw = riverW();
  ctx.fillStyle = '#78350F';
  ctx.fillRect(bw, obs.y, rw, obs.h);
  ctx.fillStyle = '#92400E';
  const seg = rw / 7;
  for (let i = 1; i < 7; i++) ctx.fillRect(bw + i * seg - 1, obs.y + 3, 2, obs.h - 6);
  ctx.fillStyle = '#A16207';
  ctx.fillRect(bw, obs.y, 7, obs.h); ctx.fillRect(bw + rw - 7, obs.y, 7, obs.h);
  ctx.fillStyle = '#B45309'; ctx.fillRect(bw, obs.y, rw, 3);
  jumpLabel(obs);
}

function drawBridgeLow(obs) {
  const bw = bankW(), rw = riverW();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(bw, obs.y + 5, rw, obs.h + 5);
  ctx.fillStyle = '#9CA3AF';
  ctx.fillRect(bw, obs.y, rw, obs.h);
  ctx.fillStyle = '#6B7280';
  ctx.fillRect(bw, obs.y + obs.h - 3, rw, 3);
  const seg = rw / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.fillStyle = '#6B7280';
    ctx.fillRect(bw + i * seg - 3, obs.y - 5, 6, obs.h + 5);
  }
  jumpLabel(obs);
}

function drawFloater(obs) {
  const bw = bankW(), rw = riverW();
  const count = Math.max(3, Math.floor(rw / 28));
  const sp = rw / count;
  for (let i = 0; i < count; i++) {
    const tx = bw + (i + 0.5) * sp, ty = obs.y + obs.h / 2;
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(tx, ty, 11, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath(); ctx.ellipse(tx, ty, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  jumpLabel(obs);
}

function drawBridgeBeam(obs) {
  const bw = bankW(), rw = riverW();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(bw, obs.y, rw, obs.h);
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(bw, obs.y, rw, 3);
  ctx.fillRect(bw, obs.y + obs.h - 3, rw, 3);
  ctx.fillStyle = '#292524';
  ctx.fillRect(bw, obs.y - 4, 14, obs.h + 4);
  ctx.fillRect(bw + rw - 14, obs.y - 4, 14, obs.h + 4);
  jumpLabel(obs);
}

function drawGate(obs) {
  const bw = bankW(), rw = riverW();
  ctx.fillStyle = '#374151';
  ctx.fillRect(bw, obs.y, rw, obs.h);
  ctx.fillStyle = '#4B5563';
  ctx.fillRect(bw, obs.y, rw, 4);
  ctx.fillRect(bw, obs.y + obs.h - 4, rw, 4);
  const bars = Math.max(4, Math.floor(rw / 16));
  for (let i = 0; i <= bars; i++) {
    ctx.fillStyle = '#6B7280';
    ctx.fillRect(bw + i * (rw / bars) - 2, obs.y, 4, obs.h);
  }
  ctx.fillStyle = 'rgba(161,98,7,0.28)';
  ctx.fillRect(bw, obs.y, rw, 2);
  jumpLabel(obs);
}

// ── DRAW: LANE OBSTACLES ─────────────────────────────────────────
function drawLaneObs(obs) {
  const lw = laneW();
  const cx = getLaneX(obs.lane);
  const cy = obs.y + obs.h / 2;
  const r  = Math.min(lw * 0.34, obs.h * 0.52);

  if (obs.type === 'rock') {
    ctx.fillStyle = '#5D6875';
    ctx.beginPath();
    ctx.moveTo(cx,           cy - r);
    ctx.lineTo(cx + r * 0.9, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.9, cy - r * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.4, cy - r * 0.45);
    ctx.lineTo(cx - r * 0.1, cy - r * 0.1);
    ctx.closePath(); ctx.fill();

  } else if (obs.type === 'branch') {
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#92400E';
    ctx.lineWidth = Math.max(5, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.7); ctx.stroke();
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * r * 0.22, cy + i * r * 0.22);
      ctx.lineTo(cx + i * r * 0.22 + r * 0.32, cy + i * r * 0.22 - r * 0.32);
      ctx.stroke();
    }
    ctx.restore();

  } else if (obs.type === 'roots') {
    ctx.save();
    ctx.strokeStyle = '#78350F'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - r * 0.9, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 0.85, cx + r * 0.5, cy - r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy + r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.35, cx + r * 0.9, cy + r * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.1, cy - r * 0.6);
    ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.5, cx + r * 0.4, cy + r * 0.9); ctx.stroke();
    ctx.restore();

  } else if (obs.type === 'rapids' || obs.type === 'wave') {
    const intensity = obs.type === 'wave' ? 0.88 : 0.72;
    ctx.fillStyle = obs.type === 'wave' ? '#1D4ED8' : '#60A5FA';
    ctx.fillRect(cx - lw * 0.42, obs.y, lw * 0.84, obs.h);
    ctx.save(); ctx.globalAlpha = intensity; ctx.fillStyle = '#EFF6FF';
    const step = obs.type === 'wave' ? 7 : 9;
    for (let wy = obs.y + 2; wy < obs.y + obs.h; wy += step) {
      ctx.beginPath(); ctx.arc(cx - r * 0.3, wy + 4, obs.type === 'wave' ? 5 : 4, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.3, wy + 1, 3, Math.PI, 0); ctx.fill();
      if (obs.type === 'wave') { ctx.beginPath(); ctx.arc(cx, wy + 5, 3, Math.PI, 0); ctx.fill(); }
    }
    ctx.restore();

  } else if (obs.type === 'boulder') {
    ctx.fillStyle = '#7C2D12';
    ctx.beginPath();
    ctx.moveTo(cx,           cy - r * 1.05);
    ctx.lineTo(cx + r,       cy - r * 0.15);
    ctx.lineTo(cx + r * 0.8, cy + r * 0.85);
    ctx.lineTo(cx - r * 0.8, cy + r * 0.85);
    ctx.lineTo(cx - r,       cy - r * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#A16207';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.25, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.45, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.05, cy + r * 0.05);
    ctx.closePath(); ctx.fill();

  } else if (obs.type === 'kayak_traffic') {
    const kw = Math.min(r * 0.7, 8), kh = Math.min(r * 1.3, 16);
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(0, -kh);
    ctx.bezierCurveTo(kw, -kh * 0.6, kw, kh * 0.6, 0, kh);
    ctx.bezierCurveTo(-kw, kh * 0.6, -kw, -kh * 0.6, 0, -kh);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath(); ctx.arc(0, -kh * 0.1, kw * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

  } else if (obs.type === 'piling') {
    ctx.fillStyle = '#44403C';
    ctx.fillRect(cx - r * 0.32, obs.y, r * 0.64, obs.h);
    ctx.fillStyle = '#57534E';
    ctx.fillRect(cx - r * 0.32, obs.y, r * 0.64, 4);
    ctx.save(); ctx.strokeStyle = '#292524'; ctx.lineWidth = 1;
    for (let wy = obs.y + 7; wy < obs.y + obs.h - 2; wy += 5) {
      ctx.beginPath(); ctx.moveTo(cx - r * 0.3, wy); ctx.lineTo(cx + r * 0.3, wy); ctx.stroke();
    }
    ctx.restore();

  } else if (obs.type === 'fishing') {
    ctx.save();
    ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, obs.y);
    ctx.quadraticCurveTo(cx + r * 0.6, cy, cx + r * 0.3, obs.y + obs.h);
    ctx.stroke();
    ctx.strokeStyle = '#6B7280'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + r * 0.3, obs.y + obs.h - 3, 4, -Math.PI * 0.5, Math.PI);
    ctx.stroke();
    ctx.restore();

  } else if (obs.type === 'cooler') {
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(cx - r * 0.7, cy - r * 0.42, r * 1.4, r * 0.84);
    ctx.fillStyle = '#EFF6FF';
    ctx.fillRect(cx - r * 0.7, cy - r * 0.42, r * 1.4, r * 0.2);
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(cx - r * 0.22, cy - r * 0.44, r * 0.44, r * 0.1);

  } else if (obs.type === 'rockslide') {
    const offsets = [[-0.5,-0.22],[0.3,0.1],[-0.1,0.42],[0.55,-0.38]];
    for (const [ox, oy] of offsets) {
      const rs = r * 0.38;
      ctx.fillStyle = '#44403C';
      ctx.beginPath();
      ctx.moveTo(cx+ox*r,         cy+oy*r-rs);
      ctx.lineTo(cx+ox*r+rs*0.8,  cy+oy*r);
      ctx.lineTo(cx+ox*r,         cy+oy*r+rs*0.7);
      ctx.lineTo(cx+ox*r-rs*0.8,  cy+oy*r);
      ctx.closePath(); ctx.fill();
    }

  } else if (obs.type === 'cone') {
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.moveTo(cx,           cy - r * 0.9);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.7);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#EFF6FF';
    ctx.fillRect(cx - r * 0.42, cy + r * 0.08, r * 0.84, r * 0.18);

  } else if (obs.type === 'barrier') {
    ctx.fillStyle = '#D1D5DB';
    ctx.fillRect(cx - r * 0.62, cy - r * 0.5, r * 1.24, r * 1.0);
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy - r * 0.5);
    ctx.lineTo(cx - r * 0.46, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.46, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.62, cy - r * 0.5);
    ctx.closePath(); ctx.fill();

  } else if (obs.type === 'crack') {
    ctx.save();
    ctx.strokeStyle = '#1C1917'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.6);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.3);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.2, cy - r * 0.1);
    ctx.lineTo(cx - r * 0.6, cy + r * 0.45);
    ctx.stroke();
    ctx.restore();

  } else if (obs.type === 'tumbleweed') {
    ctx.save();
    ctx.strokeStyle = '#A16207'; ctx.lineWidth = 1.5;
    ctx.fillStyle   = 'rgba(161,98,7,0.15)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
      ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      ctx.stroke();
    }
    ctx.restore();

  } else if (obs.type === 'sandbar') {
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.ellipse(cx, cy, lw * 0.38, obs.h * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.1, cy - r * 0.12, lw * 0.20, obs.h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── DRAW: SPLASHES ───────────────────────────────────────────────
function spawnSplash(x, y) {
  splashes.push({ x, y, life: 26, maxLife: 26 });
}

function drawSplashes() {
  for (const sp of splashes) {
    const t  = 1 - sp.life / sp.maxLife;
    const r  = 4 + 20 * t;
    const a  = (sp.life / sp.maxLife) * 0.52;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#BAE6FD'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r, r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    if (t < 0.45) {
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r * 0.42, r * 0.42 * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

// ── DRAW: PLAYER (KAYAKER) ───────────────────────────────────────
function drawPlayer() {
  const KW = 12, KH = 28;
  const s  = player.jumpScale;
  const px = player.x, py = player.y;
  const paddleLeft  = (player.animFrame % 60) < 30;
  const paddleAngle = paddleLeft ? -0.30 : 0.30;

  ctx.save();
  const shadowA = player.isJumping ? 0.20 * player.shadowScale : 0.30;
  ctx.globalAlpha = shadowA; ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px, py + KH * 0.28,
    KW * 0.55 * (player.isJumping ? player.shadowScale : 1), KW * 0.18, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();

  ctx.save();
  ctx.translate(px, py); ctx.scale(s, s);

  ctx.fillStyle = '#0B1F3A';
  ctx.beginPath();
  ctx.moveTo(0, -KH / 2);
  ctx.bezierCurveTo( KW/2, -KH*0.32,  KW/2,  KH*0.32, 0,  KH/2);
  ctx.bezierCurveTo(-KW/2,  KH*0.32, -KW/2, -KH*0.32, 0, -KH/2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0, -KH*0.46);
  ctx.bezierCurveTo( KW*0.17, -KH*0.28,  KW*0.17,  KH*0.28, 0,  KH*0.46);
  ctx.bezierCurveTo(-KW*0.17,  KH*0.28, -KW*0.17, -KH*0.28, 0, -KH*0.46);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#2D6A4F';
  ctx.fillRect(-KW*0.07, -KH*0.40, KW*0.14, KH*0.80);

  ctx.fillStyle = '#0F172A';
  ctx.beginPath(); ctx.ellipse(0, KH*0.04, KW*0.30, KH*0.20, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, KH*0.04, KW*0.30, KH*0.20, 0, 0, Math.PI*2); ctx.stroke();

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath(); ctx.arc(0, -KH*0.03, KW*0.20, 0, Math.PI*2); ctx.fill();

  ctx.save(); ctx.rotate(paddleAngle);
  const sh = KW * 0.88;
  ctx.fillStyle = '#92400E'; ctx.fillRect(-sh, -2.5, sh*2, 5);
  ctx.fillStyle = '#78350F';
  ctx.beginPath(); ctx.ellipse(-sh - KW*0.18, 0, KW*0.16, 5.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( sh + KW*0.18, 0, KW*0.16, 5.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#A16207';
  ctx.beginPath(); ctx.ellipse(-sh - KW*0.18, -1.5, KW*0.10, 2.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( sh + KW*0.18, -1.5, KW*0.10, 2.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ── DRAW: HUD ────────────────────────────────────────────────────
function drawHUD() {
  const W   = canvas.width;
  const stg = STAGES[currentStageIdx];

  ctx.fillStyle = 'rgba(11,31,58,0.84)';
  ctx.fillRect(0, 0, W, HUD_H);

  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#F5F0E8';
  ctx.textAlign = 'left';   ctx.fillText(stg.name,                       8,     14);
  ctx.textAlign = 'center'; ctx.fillText('MILE ' + currentMile + ' / 165', W/2, 14);
  ctx.textAlign = 'right';  ctx.fillText('STAGE ' + stg.num + '/5',      W-8,   14);

  ctx.fillStyle = '#C9883A'; ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';  ctx.fillText('SCORE ' + Math.floor(score),     8,   42);
  ctx.textAlign = 'right'; ctx.fillText('BEST '  + Math.floor(highScore), W-8, 42);
}

// ── DRAW: TRANSITION MESSAGE ──────────────────────────────────────
function drawTransitionMsg() {
  if (!transitionMsg) return;
  const t = transitionMsg.life / transitionMsg.maxLife; // 1→0
  let alpha;
  if      (t > 0.73) alpha = (1 - t) / 0.27;
  else if (t > 0.27) alpha = 1.0;
  else               alpha = t / 0.27;

  const W = canvas.width;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle   = 'rgba(11,31,58,0.90)';
  ctx.fillRect(0, canvas.height * 0.42, W, 50);
  ctx.globalAlpha = alpha;
  ctx.font         = '8px "Press Start 2P", monospace';
  ctx.fillStyle    = '#C9883A';
  ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(transitionMsg.text, W / 2, canvas.height * 0.42 + 25);
  ctx.restore();
}

// ── SPAWN OBSTACLES ──────────────────────────────────────────────
const H_OVERRIDES = { rapids:32, wave:30, kayak_traffic:28, sandbar:28, boulder:24, rockslide:26 };

function spawnObstacle() {
  if (Math.random() < currentFwFreq) {
    obstacles.push({ type: currentFwType, fullWidth: true, lane: -1,
      y: -SPAWN_Y_OFFSET, h: 18, resolved: false });
  } else {
    const type = currentObsTypes[Math.floor(Math.random() * currentObsTypes.length)];
    const lane = Math.floor(Math.random() * currentLanes);
    const h    = H_OVERRIDES[type] || 22;
    obstacles.push({ type, fullWidth: false, lane, y: -SPAWN_Y_OFFSET, h, resolved: false });
  }
}

// ── UPDATE ───────────────────────────────────────────────────────
function update() {
  bgScrollY   += currentSpeed;
  distance    += currentSpeed;
  score       += SCORE_PER_FRAME;
  currentMile  = Math.floor(distance / PIXELS_PER_MILE);

  // Journey end
  if (currentMile >= 165) { endRun(true); return; }

  // Stage advance (stages 1-4 boundaries)
  const stg = STAGES[currentStageIdx];
  if (currentMile >= stg.endMile && currentStageIdx < STAGES.length - 1) {
    const next = STAGES[currentStageIdx + 1];
    applyStage(currentStageIdx + 1, next.enterMsg);
    return;
  }

  // Stage 5 sub-narrowings
  if (currentStageIdx === 4 && STAGES[4].subNarrow) {
    for (const sn of STAGES[4].subNarrow) {
      if (currentMile >= sn.atMile && !subNarrowFired.has(sn.atMile)) {
        subNarrowFired.add(sn.atMile);
        setLanes(sn.lanes);
        if (sn.obsFreq !== undefined) currentObsFreq = sn.obsFreq;
        showTransition(sn.msg, 150);
        obstacles = []; splashes = [];
      }
    }
  }

  // Player lerp
  const tx = getLaneX(player.targetLane);
  player.x += (tx - player.x) * 0.28;
  if (Math.abs(player.x - tx) < 0.6) { player.x = tx; player.lane = player.targetLane; }
  player.animFrame++;

  // Jump arc
  if (player.isJumping) {
    player.jumpFrame++;
    const arc          = Math.sin((player.jumpFrame / JUMP_DURATION) * Math.PI);
    player.jumpScale   = 1 + (JUMP_SCALE_PEAK - 1) * arc;
    player.shadowScale = 1 - arc * 0.9;
    if (player.jumpFrame >= JUMP_DURATION) {
      player.isJumping = false; player.jumpFrame = 0;
      player.jumpScale = 1.0;  player.shadowScale = 1.0;
    }
  }

  // Spawn
  framesSinceLast++;
  const minF = Math.ceil(MIN_OBSTACLE_GAP / currentSpeed);
  if (framesSinceLast >= minF && Math.random() < currentObsFreq) {
    spawnObstacle(); framesSinceLast = 0;
  }

  for (const obs of obstacles) obs.y += currentSpeed;
  obstacles = obstacles.filter(o => o.y < canvas.height + 80);

  for (const sp of splashes) sp.life--;
  splashes = splashes.filter(sp => sp.life > 0);

  if (transitionMsg) {
    transitionMsg.life--;
    if (transitionMsg.life <= 0) transitionMsg = null;
  }

  checkCollision();
}

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
  player.dead    = true;
  journeyComplete = complete;
  gameState      = 'gameover';
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
    drawSplashes();
    drawPlayer();
    drawTransitionMsg();
    drawHUD();
  } else if (gameState === 'start')     { drawStartScreen(); }
  else if (gameState === 'howtoplay')   { drawHowToPlay(); }
  else if (gameState === 'gameover')    { drawGameOver(); }
  requestAnimationFrame(gameLoop);
}

// ── START GAME ───────────────────────────────────────────────────
function startGame() {
  score           = 0; distance = 0; currentMile = 0;
  bgScrollY       = 0; framesSinceLast = 0; journeyComplete = false;
  transitionMsg   = null; subNarrowFired = new Set();

  currentStageIdx = 0;
  currentLanes    = STAGES[0].lanes;
  currentSpeed    = STAGES[0].speed;
  currentObsFreq  = STAGES[0].obsFreq;
  currentFwFreq   = STAGES[0].fwFreq;
  currentObsTypes = STAGES[0].obsTypes;
  currentFwType   = STAGES[0].fwType;

  const startLane     = Math.floor(STAGES[0].lanes / 2);
  player.lane         = startLane; player.targetLane = startLane;
  player.x            = getLaneX(startLane);
  player.y            = Math.floor(canvas.height * PLAYER_Y_RATIO);
  player.isJumping    = false; player.jumpFrame = 0;
  player.jumpScale    = 1.0;  player.shadowScale = 1.0;
  player.animFrame    = 0;    player.dead = false;
  obstacles = []; splashes = [];

  initBgDecor();
  gameState = 'playing';
}

// ── SCREEN: START ────────────────────────────────────────────────
function drawStartScreen() {
  const W = canvas.width, H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B1F3A'); bg.addColorStop(0.5, '#0B2D4F'); bg.addColorStop(1, '#1D4ED8');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  drawStartScenery(W, H);

  // Back link
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.5)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('< BACK TO CAMPAIGN', 12, 10);

  // Logo image or fallback text title
  const logoW = Math.min(W * 0.72, 280);
  if (logoLoaded && logoImg.naturalWidth > 0) {
    const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth);
    const lx = (W - logoW) / 2;
    const ly = H * 0.06;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, lx, ly, logoW, logoH);
    ctx.restore();
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C9883A'; ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('KERN',  W/2, H*0.16);
    ctx.fillText('RIVER', W/2, H*0.16 + 28);
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText('RUN',   W/2, H*0.16 + 56);
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#93C5FD';
  ctx.fillText('Can you follow the Kern River', W/2, H * 0.44);
  ctx.fillText('165 miles to Bakersfield?',     W/2, H * 0.44 + 15);

  drawBtn('START RUN',   W/2, H*0.60,      W*0.62, 40, '#2D6A4F', '#F5F0E8');
  drawBtn('HOW TO PLAY', W/2, H*0.60 + 56, W*0.62, 40, '#1E3A5F', '#C9883A');
}

function drawStartScenery(W, H) {
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.moveTo(0,        H*0.78); ctx.lineTo(W*0.12, H*0.57); ctx.lineTo(W*0.28, H*0.70);
  ctx.lineTo(W*0.47,   H*0.50); ctx.lineTo(W*0.65, H*0.62); ctx.lineTo(W*0.80, H*0.53);
  ctx.lineTo(W,        H*0.66); ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();

  ctx.save(); ctx.fillStyle = '#EFF6FF'; ctx.globalAlpha = 0.85;
  for (const [px, py, pw] of [[W*0.47, H*0.50, W*0.09],[W*0.80, H*0.53, W*0.06]]) {
    ctx.beginPath();
    ctx.moveTo(px, py); ctx.lineTo(px-pw, py+pw*0.75); ctx.lineTo(px+pw, py+pw*0.75);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#2563EB';
  ctx.fillRect(W*0.12, H*0.83, W*0.76, H*0.17);
  ctx.fillStyle = '#166534';
  for (const tx of [0.06, 0.2, 0.36, 0.57, 0.73, 0.91]) {
    const x = W*tx, y = H*0.77, sz = 10 + ((tx*100)%5);
    ctx.beginPath();
    ctx.moveTo(x, y-sz); ctx.lineTo(x-sz*0.6, y+sz*0.5); ctx.lineTo(x+sz*0.6, y+sz*0.5);
    ctx.closePath(); ctx.fill();
  }
}

// ── SCREEN: HOW TO PLAY ──────────────────────────────────────────
function drawHowToPlay() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.96)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C9883A'; ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('HOW TO PLAY', W/2, H*0.10);

  const lines = [
    ['Paddle left/right between', '#F5F0E8'],
    ['river lanes to dodge',      '#F5F0E8'],
    ['rocks, branches & more.',   '#F5F0E8'],
    ['', ''],
    ['JUMP over full-width',      '#FDE68A'],
    ['obstacles!',                '#FDE68A'],
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
  ctx.font = '6px "Press Start 2P", monospace';
  lines.forEach(([txt, col], i) => {
    if (!txt) return;
    ctx.fillStyle = col; ctx.fillText(txt, W/2, H*0.21 + i*15);
  });
  drawBtn('GOT IT!', W/2, H*0.91, W*0.58, 40, '#2D6A4F', '#F5F0E8');
}

// ── SCREEN: GAME OVER ────────────────────────────────────────────
function drawGameOver() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(11,31,58,0.92)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (journeyComplete) {
    ctx.fillStyle = '#C9883A'; ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText('JOURNEY',   W/2, H*0.18);
    ctx.fillText('COMPLETE!', W/2, H*0.18 + 20);
    ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#F5F0E8';
    ctx.fillText('Mile 165 — Bakersfield!', W/2, H*0.18 + 50);
    ctx.fillStyle = '#93C5FD';
    ctx.fillText('(Full ending coming soon)', W/2, H*0.18 + 68);
  } else {
    ctx.fillStyle = '#EF4444'; ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText('RUN ENDED', W/2, H*0.22);
    const stg = STAGES[currentStageIdx];
    ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#F5F0E8';
    ctx.fillText('Wiped out on ' + stg.name, W/2, H*0.32);
    ctx.fillText('Mile ' + currentMile + ' / 165',  W/2, H*0.32 + 16);
  }

  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = '#C9883A'; ctx.fillText('SCORE  ' + Math.floor(score),    W/2, H*0.52);
  ctx.fillStyle = '#93C5FD'; ctx.fillText('BEST   ' + Math.floor(highScore), W/2, H*0.52 + 20);

  drawBtn('TRY AGAIN', W/2, H*0.68,      W*0.62, 40, '#2D6A4F', '#F5F0E8');
  drawBtn('MAIN MENU', W/2, H*0.68 + 54, W*0.62, 40, '#1E3A5F', '#C9883A');
}

// ── BUTTON HELPERS ───────────────────────────────────────────────
function drawBtn(label, cx, cy, bw, bh, bg, fg) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(cx-bw/2+3, cy-bh/2+3, bw, bh);
  ctx.fillStyle = bg; ctx.fillRect(cx-bw/2, cy-bh/2, bw, bh);
  ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.strokeRect(cx-bw/2, cy-bh/2, bw, bh);
  ctx.fillStyle = fg; ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}
function hitBtn(mx, my, cx, cy, bw, bh) {
  return mx >= cx-bw/2 && mx <= cx+bw/2 && my >= cy-bh/2 && my <= cy+bh/2;
}
function clientToCanvas(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return [(cx-r.left)*(canvas.width/r.width), (cy-r.top)*(canvas.height/r.height)];
}

// ── INPUT ────────────────────────────────────────────────────────
function doMoveLeft() {
  if (player.targetLane > 0) { spawnSplash(player.x, player.y+8); player.targetLane--; }
}
function doMoveRight() {
  if (player.targetLane < currentLanes - 1) { spawnSplash(player.x, player.y+8); player.targetLane++; }
}
function doJump() {
  if (!player.isJumping && gameState === 'playing') {
    player.isJumping = true; player.jumpFrame = 0;
    player.jumpScale = 1.0; player.shadowScale = 1.0;
  }
}

window.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;
  switch (e.key) {
    case 'ArrowLeft':  case 'a': case 'A': doMoveLeft();  break;
    case 'ArrowRight': case 'd': case 'D': doMoveRight(); break;
    case 'ArrowUp': case 'w': case 'W': case ' ': e.preventDefault(); doJump(); break;
  }
});

let tStartX = 0, tStartY = 0, tStartMs = 0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  tStartX = t.clientX; tStartY = t.clientY; tStartMs = Date.now();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const dx = t.clientX - tStartX, dy = t.clientY - tStartY;
  const dt = Date.now() - tStartMs, mag = Math.hypot(dx, dy);
  if (gameState === 'playing') {
    if      (mag < 22 && dt < 280)                        doJump();
    else if (Math.abs(dx) > Math.abs(dy) && mag > 28)     dx < 0 ? doMoveLeft() : doMoveRight();
    else if (dy < -28)                                     doJump();
  } else {
    const [mx, my] = clientToCanvas(t.clientX, t.clientY); handleTap(mx, my);
  }
}, { passive: false });

canvas.addEventListener('click', e => {
  if (gameState === 'playing') return;
  const [mx, my] = clientToCanvas(e.clientX, e.clientY); handleTap(mx, my);
});

function handleTap(mx, my) {
  const W = canvas.width, H = canvas.height;
  if (gameState === 'start') {
    if (my < 28) { window.location.href = '../'; return; }
    if (hitBtn(mx,my, W/2, H*0.60,      W*0.62, 40)) { startGame(); return; }
    if (hitBtn(mx,my, W/2, H*0.60 + 56, W*0.62, 40)) { gameState = 'howtoplay'; }
  } else if (gameState === 'howtoplay') {
    if (hitBtn(mx,my, W/2, H*0.91, W*0.58, 40)) gameState = 'start';
  } else if (gameState === 'gameover') {
    if (hitBtn(mx,my, W/2, H*0.68,      W*0.62, 40)) { startGame(); return; }
    if (hitBtn(mx,my, W/2, H*0.68 + 54, W*0.62, 40)) gameState = 'start';
  }
}

// ── LOGO PRELOAD ─────────────────────────────────────────────────
const logoImg    = new Image();
let   logoLoaded = false;
logoImg.onload   = () => { logoLoaded = true; };
logoImg.src      = 'assets/kern-river-run-logo.png';

// ── INIT ─────────────────────────────────────────────────────────
resizeCanvas();
player.x = getLaneX(player.targetLane);
player.y = Math.floor(canvas.height * PLAYER_Y_RATIO);

document.fonts.ready.then(() => requestAnimationFrame(gameLoop));
