// ================================================================
// KERN RIVER RUN — game-3d-experiment.js
// Isolated Three.js 3D experiment. Does NOT modify game.js/game-dev.html.
// ================================================================

// ── CONSTANTS ────────────────────────────────────────────────────
const LANE_W         = 2.2;    // 3D units per lane
const SPAWN_Z        = -65;    // items spawn this far ahead
const DESPAWN_Z      = 9;      // items removed after passing player
const JUMP_DUR       = 56;     // frames
const JUMP_H         = 2.6;    // 3D units up
const SPF            = 2;      // score per frame
const MIN_GAP        = 135;    // min obstacle gap (same unit as 2D)
const MI_PER_PX      = 900;     // pixels-equivalent per mile (same as 2D PIXELS_PER_MILE)
const COLL_FREQ      = 0.006;
const SPD_SCALE      = 0.070;  // converts 2D speed to 3D units/frame
const CAM_Y          = 4.8;
const CAM_Z_BK       = 8.5;    // camera behind player
const CAM_LOOK_Z     = -8.0;   // camera looks this far ahead

// ── STAGE DATA ───────────────────────────────────────────────────
const STAGES3 = [
  { num:1, name:'HEADWATERS',    endMile:33,  lanes:7, speed:1.48, obsFreq:0.011, fwFreq:0.11, waterColor:0x1D4ED8, bankColor:0x374151 },
  { num:2, name:'UPPER KERN',    endMile:66,  lanes:6, speed:1.65, obsFreq:0.012, fwFreq:0.12, waterColor:0x1C3A8A, bankColor:0x7C2D12 },
  { num:3, name:'LAKE ISABELLA', endMile:99,  lanes:5, speed:1.78, obsFreq:0.012, fwFreq:0.10, waterColor:0x1E6CB5, bankColor:0x78716C },
  { num:4, name:'KERN CANYON',   endMile:132, lanes:4, speed:1.91, obsFreq:0.013, fwFreq:0.12, waterColor:0x1E3A5F, bankColor:0x1C1917 },
  { num:5, name:'BAKERSFIELD',   endMile:165, lanes:3, speed:2.00, obsFreq:0.012, fwFreq:0.09, waterColor:0x1D4ED8, bankColor:0xD97706,
    subNarrow:[
      { atMile:150, lanes:2, msg:'THE RIVER NARROWS', obsFreq:0.009 },
      { atMile:160, lanes:1, msg:'FINAL STRETCH',     obsFreq:0.007 },
    ]
  },
];

// ── THREE.JS RENDERER + SCENE ────────────────────────────────────
const canvas3d = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x0B2D4F);
scene.fog        = new THREE.Fog(0x0B1F3A, 40, 110);

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 160);

function resizeRenderer() {
  const w = Math.min(window.innerWidth, 430);
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

// ── LIGHTING ─────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x334155, 0.75));
const sun = new THREE.DirectionalLight(0xFBBF24, 0.95);
sun.position.set(-5, 10, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 80;
sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
sun.shadow.camera.right = sun.shadow.camera.top   =  20;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x1E3A5F, 0x2D4A1E, 0.45));

// ── RIVER / WORLD GEOMETRY (rebuilt on stage / lane change) ──────
let riverGroup   = null;
let waterMesh3d  = null;
let flowLines3d  = [];
let horizonGroup = null;

let stageIdx     = 0;
let curLanes     = STAGES3[0].lanes;

function riverWidth()  { return curLanes * LANE_W; }
function laneXPos(l)   { return (l - (curLanes - 1) / 2) * LANE_W; }

function buildWorld() {
  // Dispose previous river group
  if (riverGroup) {
    riverGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    scene.remove(riverGroup);
  }
  flowLines3d.forEach(l => { l.geometry.dispose(); scene.remove(l); });
  flowLines3d = [];
  if (horizonGroup) { scene.remove(horizonGroup); }

  const stg = STAGES3[stageIdx];
  const rw  = riverWidth();
  riverGroup = new THREE.Group();

  // Far ground (bank color fills the world)
  const gndGeo = new THREE.PlaneGeometry(120, 160);
  const gndMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  const gnd = new THREE.Mesh(gndGeo, gndMat);
  gnd.rotation.x = -Math.PI / 2;
  gnd.position.set(0, -0.02, -50);
  gnd.receiveShadow = true;
  riverGroup.add(gnd);

  // River water surface
  const wGeo = new THREE.PlaneGeometry(rw, 150);
  const wMat = new THREE.MeshPhongMaterial({ color: stg.waterColor, shininess: 55, specular: 0x3B82F6 });
  waterMesh3d = new THREE.Mesh(wGeo, wMat);
  waterMesh3d.rotation.x = -Math.PI / 2;
  waterMesh3d.position.set(0, 0.01, -50);
  waterMesh3d.receiveShadow = true;
  riverGroup.add(waterMesh3d);

  // Banks — raised boxes on each side
  const bkW  = 5.0;
  const bkMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  const bkGeo = new THREE.BoxGeometry(bkW, 0.55, 140);
  const bkL = new THREE.Mesh(bkGeo, bkMat); bkL.castShadow = true; bkL.receiveShadow = true;
  bkL.position.set(-(rw / 2 + bkW / 2), 0.27, -50); riverGroup.add(bkL);
  const bkR = new THREE.Mesh(bkGeo, bkMat.clone()); bkR.castShadow = true; bkR.receiveShadow = true;
  bkR.position.set( (rw / 2 + bkW / 2), 0.27, -50); riverGroup.add(bkR);

  // Lane dividers
  const divMat = new THREE.LineBasicMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.20 });
  for (let l = 1; l < curLanes; l++) {
    const x   = -rw / 2 + l * LANE_W;
    const pts = [new THREE.Vector3(x, 0.04, SPAWN_Z - 5), new THREE.Vector3(x, 0.04, DESPAWN_Z)];
    const div = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), divMat);
    riverGroup.add(div);
  }

  // Trees / rocks on banks (simple primitives)
  addBankDecor(riverGroup, rw, stg);

  scene.add(riverGroup);

  // Animated flow lines (outside group so they scroll independently)
  const flMat = new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.18 });
  for (let i = 0; i < 20; i++) {
    const pts = [new THREE.Vector3(-rw / 2 + 0.3, 0.05, 0), new THREE.Vector3(rw / 2 - 0.3, 0.05, 0)];
    const fl  = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), flMat.clone());
    fl.position.z = SPAWN_Z + i * (Math.abs(SPAWN_Z) / 20);
    scene.add(fl);
    flowLines3d.push(fl);
  }

  // Horizon art (mountains / canyon walls)
  horizonGroup = buildHorizonArt(stg);
  scene.add(horizonGroup);
}

function addBankDecor(group, rw, stg) {
  const positions = [-20, -40, -55, -30, -45, -15, -60];
  const treeMat = new THREE.MeshLambertMaterial({ color: stg.num <= 2 ? 0x166534 : stg.num === 3 ? 0xD97706 : 0x44403C });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350F });

  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const xBase = side * (rw / 2 + 1.5 + (i % 3) * 1.8);
    const z     = positions[i];

    if (stg.num === 4) {
      // Canyon stage: tall narrow rock pillars
      const rockGeo = new THREE.BoxGeometry(0.8, 3.5, 0.7);
      const rock    = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x292524 }));
      rock.position.set(xBase, 1.75, z); rock.castShadow = true; group.add(rock);
    } else {
      // Trees: trunk + canopy
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 5), trunkMat);
      trunk.position.set(xBase, 0.5, z); group.add(trunk);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.6, 6), treeMat);
      canopy.position.set(xBase, 1.8, z); canopy.castShadow = true; group.add(canopy);
    }
  }
}

function buildHorizonArt(stg) {
  const grp = new THREE.Group();
  const mtData = [
    { x:-18, h:15, r:8  }, { x:-7,  h:20, r:7  }, { x:2,   h:12, r:6  },
    { x:11,  h:17, r:9  }, { x:20,  h:14, r:7  }, { x:-26, h:10, r:5  },
  ];
  const mtColors = stg.num === 4
    ? [0x1C1917, 0x292524, 0x1C1917]
    : stg.num === 5
    ? [0x92400E, 0xB45309, 0x78350F]
    : [0x1E3A5F, 0x1A3253, 0x172944];

  for (const m of mtData) {
    const geo = new THREE.ConeGeometry(m.r * 0.62, m.h, stg.num === 4 ? 4 : 5);
    const mat = new THREE.MeshLambertMaterial({ color: mtColors[Math.abs(m.x) % mtColors.length] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(m.x, m.h / 2 - 0.3, -90);
    grp.add(mesh);
  }
  return grp;
}

// ── PLAYER MODEL ─────────────────────────────────────────────────
const playerGroup = new THREE.Group();
scene.add(playerGroup);

// Materials
const navyMat  = new THREE.MeshPhongMaterial({ color: 0x0B1F3A, shininess: 50 });
const midNavy  = new THREE.MeshLambertMaterial({ color: 0x1E3A5F });
const greenMat = new THREE.MeshLambertMaterial({ color: 0x2D6A4F });
const goldMat  = new THREE.MeshPhongMaterial({ color: 0xFBBF24, shininess: 40 });
const woodMat  = new THREE.MeshLambertMaterial({ color: 0x92400E });
const darkWood = new THREE.MeshLambertMaterial({ color: 0x78350F });

// Kayak hull
const kayakHull = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.15, 2.0), navyMat.clone());
kayakHull.position.set(0, 0.07, 0); kayakHull.castShadow = true;
playerGroup.add(kayakHull);

// Nose taper (front wedge)
const noseGeo = new THREE.CylinderGeometry(0, 0.3, 0.55, 4);
noseGeo.rotateX(Math.PI / 2);
const nose = new THREE.Mesh(noseGeo, navyMat.clone());
nose.position.set(0, 0.07, -1.27); playerGroup.add(nose);

// Deck stripe
const deckStripe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, 1.75), greenMat);
deckStripe.position.set(0, 0.15, -0.1); playerGroup.add(deckStripe);

// Cockpit rim
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.50), midNavy);
cockpit.position.set(0, 0.18, 0.10); playerGroup.add(cockpit);

// Torso
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.22), navyMat.clone());
torso.position.set(0, 0.40, 0.10); torso.castShadow = true; playerGroup.add(torso);

// Life jacket pockets
const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.14, 0.08), greenMat.clone());
pocket.position.set(0, 0.42, 0.21); playerGroup.add(pocket);

// Head / helmet
const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.21, 0.21), goldMat.clone());
head.position.set(0, 0.68, 0.10); head.castShadow = true; playerGroup.add(head);

// Helmet visor
const visor = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.08, 0.06), midNavy.clone());
visor.position.set(0, 0.64, 0.21); playerGroup.add(visor);

// Arms
const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.28);
const armL = new THREE.Mesh(armGeo, navyMat.clone());
armL.position.set(-0.18, 0.48, 0.10); playerGroup.add(armL);
const armR = new THREE.Mesh(armGeo, navyMat.clone());
armR.position.set( 0.18, 0.48, 0.10); playerGroup.add(armR);

// Paddle group (animated)
const paddleGroup = new THREE.Group();
paddleGroup.position.set(0, 0.52, 0.12);

const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.045, 0.045), woodMat.clone());
paddleGroup.add(shaft);

const bladeGeoP = new THREE.BoxGeometry(0.14, 0.045, 0.33);
const bladeL = new THREE.Mesh(bladeGeoP, darkWood.clone());
bladeL.position.set(-0.94, 0, 0); paddleGroup.add(bladeL);

const bladeR = new THREE.Mesh(bladeGeoP, darkWood.clone());
bladeR.position.set( 0.94, 0, 0); paddleGroup.add(bladeR);

playerGroup.add(paddleGroup);

// Shadow under kayak
const shadowGeo = new THREE.CircleGeometry(0.55, 12);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
playerShadow.rotation.x = -Math.PI / 2;
playerShadow.position.set(0, 0.02, 0);
scene.add(playerShadow);

// Shield ring (torus around player)
const shieldMat3 = new THREE.MeshBasicMaterial({ color: 0xF97316, transparent: true, opacity: 0, depthWrite: false });
const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.70, 0.06, 8, 28), shieldMat3);
shieldRing.rotation.x = Math.PI / 2;
shieldRing.position.set(0, 0.35, 0.1);
playerGroup.add(shieldRing);

// ── OBSTACLE FACTORY ─────────────────────────────────────────────
const OBS_MAT_COLORS = {
  boulder:           0x7C2D12,
  river_wash:        0x38BDF8,
  deadfall_log:      0x44403C,
  capsized_raft:     0x57534E,
  drifting_sailboat: 0x1E3A5F,
  mine_cart:         0x292524,
  shopping_cart:     0x9CA3AF,
  fallen_sequoia:    0x78350F,
  raft_train:        0x92400E,
  pontoon_party:     0x1D4ED8,
  old_mining_bridge: 0x44403C,
  tube_float_parade: 0xF97316,
};

function makeObsMesh(type, fullWidth) {
  const col = OBS_MAT_COLORS[type] || 0x6B7280;

  if (fullWidth) {
    const rw  = riverWidth();
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const geo = new THREE.BoxGeometry(rw + 0.6, 0.38, 0.85);
    const m   = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  }

  if (type === 'river_wash') {
    const mat = new THREE.MeshPhongMaterial({ color: col, transparent: true, opacity: 0.62, shininess: 60 });
    return new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 7), mat);
  }
  if (type === 'boulder') {
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const m   = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), mat);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.castShadow = true;
    return m;
  }
  if (type === 'deadfall_log') {
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const geo = new THREE.CylinderGeometry(0.18, 0.22, LANE_W * 0.92, 6);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
  }

  const mat = new THREE.MeshLambertMaterial({ color: col });
  const m   = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.55, 0.70), mat);
  m.castShadow = true;
  return m;
}

// ── GAME STATE ───────────────────────────────────────────────────
let gameState3   = 'start';
let score3       = 0;
let highScore3   = parseInt(localStorage.getItem('krr3d_hs') || '0', 10);
let distance3    = 0;
let curMile3     = 0;
let curSpeed3    = STAGES3[0].speed;
let curObsFreq3  = STAGES3[0].obsFreq;
let gapFrames3   = 0;       // frames since last obstacle
let subsFired3   = new Set();
let transMsg3    = null;
let frameN       = 0;
let camXSmooth   = 0;

const player3 = {
  lane: 3, targetLane: 3, x: 0,
  isJumping: false, jumpFrame: 0,
  dead: false, hasShield: false, spinoutFrames: 0,
};

let obstacles3    = [];  // { mesh, lane, z, resolved, fullWidth, type }
let collectibles3 = [];  // { mesh, lane, z, collected }

// ── STAGE MANAGEMENT ─────────────────────────────────────────────
function applyStage3(idx, msg) {
  stageIdx    = idx;
  curLanes    = STAGES3[idx].lanes;
  curSpeed3   = STAGES3[idx].speed;
  curObsFreq3 = STAGES3[idx].obsFreq;

  if (player3.targetLane >= curLanes) player3.targetLane = curLanes - 1;
  if (player3.lane       >= curLanes) player3.lane       = curLanes - 1;
  player3.x = laneXPos(player3.targetLane);

  clearActive();
  buildWorld();
  if (msg) flash3(msg, 160);
}

function clearActive() {
  obstacles3.forEach(o => { if (o.mesh) { o.mesh.geometry.dispose(); scene.remove(o.mesh); } });
  collectibles3.forEach(c => { if (c.mesh) { c.mesh.geometry.dispose(); scene.remove(c.mesh); } });
  obstacles3 = []; collectibles3 = [];
}

function flash3(text, life) {
  transMsg3 = { text, life, maxLife: life };
  const el = document.getElementById('transitionMsg3');
  if (el) el.textContent = text;
}

// ── SPAWN ────────────────────────────────────────────────────────
const FW_TYPES3  = ['fallen_sequoia', 'raft_train', 'pontoon_party', 'old_mining_bridge', 'tube_float_parade'];
const LN_TYPES3  = ['boulder', 'boulder', 'river_wash', 'deadfall_log', 'capsized_raft', 'mine_cart', 'shopping_cart', 'drifting_sailboat'];

function spawnObs3() {
  const stg      = STAGES3[stageIdx];
  const fullWidth = Math.random() < stg.fwFreq;
  const type      = fullWidth
    ? FW_TYPES3[Math.floor(Math.random() * FW_TYPES3.length)]
    : LN_TYPES3[Math.floor(Math.random() * LN_TYPES3.length)];
  const lane = fullWidth ? -1 : Math.floor(Math.random() * curLanes);

  const mesh = makeObsMesh(type, fullWidth);
  const xPos = fullWidth ? 0 : laneXPos(lane);
  const yPos = fullWidth ? 0.19 : (type === 'boulder' ? 0.52 : type === 'river_wash' ? 0.52 : 0.37);
  mesh.position.set(xPos, yPos, SPAWN_Z);
  scene.add(mesh);

  obstacles3.push({ mesh, lane, z: SPAWN_Z, resolved: false, fullWidth, type });
}

function spawnColl3() {
  const lane  = Math.floor(Math.random() * curLanes);
  const colors = [0xFBBF24, 0xF97316, 0xA5F3FC, 0xEF4444, 0xC9883A, 0x60A5FA, 0xF59E0B, 0x34D399];
  const col   = colors[Math.floor(Math.random() * colors.length)];
  const mat   = new THREE.MeshPhongMaterial({ color: col, emissive: new THREE.Color(col).multiplyScalar(0.45), shininess: 70, transparent: true, opacity: 0.92 });
  const mesh  = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 7), mat);
  mesh.position.set(laneXPos(lane), 0.55, SPAWN_Z);
  scene.add(mesh);
  collectibles3.push({ mesh, lane, z: SPAWN_Z, collected: false });
}

// ── UPDATE (called only while playing) ───────────────────────────
function update3() {
  frameN++;
  distance3  += curSpeed3;
  score3     += SPF;
  curMile3    = Math.floor(distance3 / MI_PER_PX);  // same 900px/mile as 2D

  if (curMile3 >= 165) { endRun3(true); return; }

  const stg = STAGES3[stageIdx];
  if (curMile3 >= stg.endMile && stageIdx < STAGES3.length - 1) {
    applyStage3(stageIdx + 1, 'ENTERING ' + STAGES3[stageIdx + 1].name); return;
  }

  // Stage 5 sub-narrows
  if (stageIdx === 4 && stg.subNarrow) {
    for (const sn of stg.subNarrow) {
      if (curMile3 >= sn.atMile && !subsFired3.has(sn.atMile)) {
        subsFired3.add(sn.atMile);
        curLanes    = sn.lanes;
        curObsFreq3 = sn.obsFreq;
        if (player3.targetLane >= sn.lanes) player3.targetLane = sn.lanes - 1;
        clearActive(); buildWorld(); flash3(sn.msg, 150);
      }
    }
  }

  // Spinout countdown
  if (player3.spinoutFrames > 0) player3.spinoutFrames--;

  // Smooth player X toward target lane
  const tx = laneXPos(player3.targetLane);
  player3.x += (tx - player3.x) * 0.28;
  if (Math.abs(player3.x - tx) < 0.02) player3.x = tx;

  // Jump arc
  if (player3.isJumping) {
    player3.jumpFrame++;
    if (player3.jumpFrame >= JUMP_DUR) { player3.isJumping = false; player3.jumpFrame = 0; }
  }

  // Spawn obstacles
  gapFrames3++;
  const minF = Math.ceil(MIN_GAP / curSpeed3);
  if (gapFrames3 >= minF && Math.random() < curObsFreq3) { spawnObs3(); gapFrames3 = 0; }

  // Spawn collectibles
  if (Math.random() < COLL_FREQ) spawnColl3();

  // Move obstacles
  const spd = curSpeed3 * SPD_SCALE;
  for (const o of obstacles3) {
    o.z += spd; o.mesh.position.z = o.z;
  }
  obstacles3 = obstacles3.filter(o => {
    if (o.z > DESPAWN_Z) { o.mesh.geometry.dispose(); scene.remove(o.mesh); return false; }
    return true;
  });

  // Move collectibles + bob
  for (const c of collectibles3) {
    c.z += spd; c.mesh.position.z = c.z;
    c.mesh.position.y = 0.55 + Math.sin(frameN * 0.11 + c.lane * 1.3) * 0.14;
    c.mesh.rotation.y += 0.04;
  }
  collectibles3 = collectibles3.filter(c => {
    if (c.collected || c.z > DESPAWN_Z) { c.mesh.geometry.dispose(); scene.remove(c.mesh); return false; }
    return true;
  });

  // Flow lines scroll
  for (const fl of flowLines3d) {
    fl.position.z += spd;
    if (fl.position.z > 6) fl.position.z = SPAWN_Z + 4;
  }

  // Transition flash
  if (transMsg3) {
    transMsg3.life--;
    const el = document.getElementById('transitionMsg3');
    if (el) {
      const t = transMsg3.life / transMsg3.maxLife;
      const a = t > 0.73 ? (1 - t) / 0.27 : t > 0.27 ? 1.0 : t / 0.27;
      el.style.opacity = String(a);
    }
    if (transMsg3.life <= 0) {
      transMsg3 = null;
      const el2 = document.getElementById('transitionMsg3');
      if (el2) el2.style.opacity = '0';
    }
  }

  checkCollisions3();
  checkCollectibles3();
}

// ── COLLISION ────────────────────────────────────────────────────
const COLL_FRONT = -1.4;
const COLL_BACK  =  1.4;

function checkCollisions3() {
  for (const o of obstacles3) {
    if (o.resolved) continue;
    if (o.z < COLL_FRONT || o.z > COLL_BACK) continue;
    o.resolved = true;

    const safe = player3.isJumping || (!o.fullWidth && o.lane !== player3.targetLane);
    if (safe) continue;
    if (player3.hasShield) { player3.hasShield = false; continue; }
    if (o.type === 'river_wash') {
      player3.spinoutFrames = Math.max(player3.spinoutFrames, 90);
    } else {
      endRun3(false); return;
    }
  }
}

function checkCollectibles3() {
  for (const c of collectibles3) {
    if (c.collected) continue;
    if (c.z < COLL_FRONT || c.z > COLL_BACK) continue;
    if (c.lane !== player3.targetLane) continue;
    c.collected = true;
    score3 += 50;
  }
}

// ── VISUAL UPDATE (every frame) ───────────────────────────────────
function updateVisuals3() {
  // Player model follows game-state position
  playerGroup.position.x = player3.x;

  const jumpY = player3.isJumping
    ? JUMP_H * Math.sin((player3.jumpFrame / JUMP_DUR) * Math.PI)
    : 0;
  playerGroup.position.y = jumpY;

  // Shadow shrinks and fades while airborne
  playerShadow.position.x = player3.x;
  const shadowScale = player3.isJumping ? Math.max(0.3, 1 - jumpY * 0.25) : 1;
  playerShadow.scale.set(shadowScale, shadowScale, shadowScale);
  shadowMat.opacity = player3.isJumping ? 0.12 : 0.28;

  // Spinout rotation around Y
  if (player3.spinoutFrames > 0) {
    playerGroup.rotation.y += 0.18;
  } else {
    // Ease back to facing forward (rotation.y → 0)
    playerGroup.rotation.y *= 0.75;
    if (Math.abs(playerGroup.rotation.y) < 0.01) playerGroup.rotation.y = 0;
  }

  // Paddle stroke animation: Z-axis tilt (one blade dips, other rises)
  paddleGroup.rotation.z = Math.sin(frameN * 0.095) * 0.40;

  // Shield ring
  if (player3.hasShield) {
    shieldMat3.opacity = 0.60 + Math.sin(frameN * 0.14) * 0.32;
  } else {
    shieldMat3.opacity = 0;
  }

  // Chase camera: smoothly follows player X, fixed height + distance
  camXSmooth += (player3.x - camXSmooth) * 0.07;
  camera.position.set(camXSmooth, CAM_Y, CAM_Z_BK);
  camera.lookAt(camXSmooth, 0.5, CAM_LOOK_Z);

  // HUD
  if (gameState3 === 'playing') {
    const stg = STAGES3[stageIdx];
    document.getElementById('hud3-stage').textContent    = stg.name;
    document.getElementById('hud3-mile').textContent     = 'MILE ' + curMile3 + ' / 165';
    document.getElementById('hud3-stageNum').textContent = 'STAGE ' + stg.num + '/5';
    document.getElementById('hud3-score').textContent    = 'SCORE ' + Math.floor(score3);
    document.getElementById('hud3-best').textContent     = 'BEST '  + Math.floor(highScore3);
  }
}

// ── END RUN ──────────────────────────────────────────────────────
function endRun3(complete) {
  player3.dead = true;
  if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
  gameState3 = 'gameover';
  showScreen3('gameover', complete);
}

// ── START GAME ───────────────────────────────────────────────────
function startGame3() {
  score3 = 0; distance3 = 0; curMile3 = 0;
  gapFrames3 = 0; frameN = 0; subsFired3 = new Set(); transMsg3 = null;
  stageIdx = 0; curLanes = STAGES3[0].lanes; curSpeed3 = STAGES3[0].speed; curObsFreq3 = STAGES3[0].obsFreq;
  camXSmooth = 0;

  const midLane = Math.floor(STAGES3[0].lanes / 2);
  player3.lane = midLane; player3.targetLane = midLane;
  player3.x = laneXPos(midLane);
  player3.isJumping = false; player3.jumpFrame = 0;
  player3.dead = false; player3.hasShield = false; player3.spinoutFrames = 0;
  playerGroup.rotation.y = 0; playerGroup.position.y = 0;

  clearActive();
  buildWorld();

  const tEl = document.getElementById('transitionMsg3');
  if (tEl) tEl.style.opacity = '0';

  document.getElementById('overlay3').classList.add('hidden');
  document.getElementById('hud3').classList.add('visible');
  gameState3 = 'playing';
}

// ── SCREEN MANAGEMENT ────────────────────────────────────────────
function showScreen3(which, complete) {
  document.getElementById('overlay3').classList.remove('hidden');
  document.querySelectorAll('.screen3').forEach(s => s.classList.remove('visible'));

  if (which === 'start') {
    document.getElementById('screen3-start').classList.add('visible');
    document.getElementById('hud3').classList.remove('visible');

  } else if (which === 'gameover') {
    const scr = document.getElementById('screen3-gameover');
    scr.classList.add('visible');
    scr.querySelector('.go-title3').textContent  = complete ? 'RUN COMPLETE!' : 'RUN ENDED';
    scr.querySelector('.go-stage3').textContent  = STAGES3[stageIdx].name;
    scr.querySelector('.go-mile3').textContent   = 'Mile ' + curMile3 + ' / 165';
    scr.querySelector('.go-score3').textContent  = 'Score: ' + Math.floor(score3);
    scr.querySelector('.go-best3').textContent   = 'Best:  ' + Math.floor(highScore3);

  } else if (which === 'paused') {
    document.getElementById('screen3-paused').classList.add('visible');
  }
}

// ── INPUT ────────────────────────────────────────────────────────
function doLeft3()  { if (player3.spinoutFrames > 0) return; if (player3.targetLane > 0) player3.targetLane--; }
function doRight3() { if (player3.spinoutFrames > 0) return; if (player3.targetLane < curLanes - 1) player3.targetLane++; }
function doJump3()  {
  if (player3.spinoutFrames > 0) return;
  if (!player3.isJumping && gameState3 === 'playing') { player3.isJumping = true; player3.jumpFrame = 0; }
}

window.addEventListener('keydown', e => {
  if (gameState3 === 'playing') {
    switch (e.key) {
      case 'ArrowLeft':  case 'a': case 'A': doLeft3();  break;
      case 'ArrowRight': case 'd': case 'D': doRight3(); break;
      case 'ArrowUp': case 'w': case 'W': case ' ': e.preventDefault(); doJump3(); break;
      case 'Escape': case 'p': case 'P': gameState3 = 'paused'; showScreen3('paused'); break;
    }
  } else if (gameState3 === 'paused') {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      gameState3 = 'playing';
      document.getElementById('overlay3').classList.add('hidden');
    }
  }
});

let tX3 = 0, tY3 = 0, tT3 = 0;
canvas3d.addEventListener('touchstart', e => {
  e.preventDefault(); const t = e.changedTouches[0];
  tX3 = t.clientX; tY3 = t.clientY; tT3 = Date.now();
}, { passive: false });
canvas3d.addEventListener('touchend', e => {
  e.preventDefault();
  if (gameState3 !== 'playing') return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tX3, dy = t.clientY - tY3;
  const mag = Math.hypot(dx, dy), dt = Date.now() - tT3;
  if      (mag < 22 && dt < 280)                  doJump3();
  else if (Math.abs(dx) > Math.abs(dy) && mag > 28) dx < 0 ? doLeft3() : doRight3();
  else if (dy < -28)                               doJump3();
}, { passive: false });

// Button wiring
document.getElementById('btn3-start').addEventListener('click',  startGame3);
document.getElementById('btn3-retry').addEventListener('click',  startGame3);
document.getElementById('btn3-menu').addEventListener('click',   () => showScreen3('start'));
document.getElementById('btn3-resume').addEventListener('click', () => {
  gameState3 = 'playing';
  document.getElementById('overlay3').classList.add('hidden');
});
document.getElementById('btn3-quit').addEventListener('click', () => {
  gameState3 = 'start'; showScreen3('start');
});

// ── GAME LOOP ────────────────────────────────────────────────────
function loop3() {
  requestAnimationFrame(loop3);
  if (gameState3 === 'playing') update3();
  updateVisuals3();
  renderer.render(scene, camera);
}

// ── INIT ─────────────────────────────────────────────────────────
buildWorld();
showScreen3('start');
loop3();
