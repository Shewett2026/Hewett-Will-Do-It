// ================================================================
// KERN RIVER RUN - game-3d.js  (Visual Upgrade)
// Isolated Three.js 3D experiment. game-2d-backup.html / game.js untouched.
// ================================================================

// ── CONSTANTS ────────────────────────────────────────────────────
const LANE_W    = 2.2;
const SPAWN_Z   = -65;
const DESPAWN_Z = 9;
const JUMP_DUR  = 56;
const JUMP_H    = 2.6;
const SPF       = 2;
const MIN_GAP   = 135;
const MI_PER_PX = 900;
const COLL_FREQ = 0.006;
const SPD_SCALE = 0.070;
const CAM_Y     = 4.8;
const CAM_Z_BK  = 8.5;
const CAM_LOOK_Z = -8.0;

// ── STAGE DATA (full roster matching game.js) ─────────────────────
const STAGES3 = [
  {
    num:1, name:'HEADWATERS', endMile:33, lanes:7, speed:1.48, obsFreq:0.011, fwFreq:0.11,
    waterColor:0x38BDF8, bankColor:0x374151,
    obsTypes:['deadfall_log','deadfall_log','boulder','boulder','river_wash'],
    fwType:'fallen_sequoia', collA:'golden_trout', collB:'mountain_crystal',
  },
  {
    num:2, name:'UPPER KERN', endMile:66, lanes:6, speed:1.65, obsFreq:0.012, fwFreq:0.12,
    waterColor:0x0EA5E9, bankColor:0x7C2D12,
    obsTypes:['capsized_raft','capsized_raft','boulder','boulder','river_wash'],
    fwType:'raft_train', collA:'fishing_lure', collB:'golden_eagle_feather',
  },
  {
    num:3, name:'LAKE ISABELLA', endMile:99, lanes:5, speed:1.78, obsFreq:0.012, fwFreq:0.10,
    waterColor:0x0891B2, bankColor:0x78716C,
    obsTypes:['drifting_sailboat','drifting_sailboat','boulder','boulder','river_wash'],
    fwType:'pontoon_party', collA:'beach_ball', collB:'cooler',
  },
  {
    num:4, name:'KERN CANYON', endMile:132, lanes:4, speed:1.91, obsFreq:0.013, fwFreq:0.12,
    waterColor:0x0369A1, bankColor:0x1C1917,
    obsTypes:['mine_cart','mine_cart','boulder','boulder','river_wash'],
    fwType:'old_mining_bridge', collA:'gold_nugget', collB:'treasure_chest',
  },
  {
    num:5, name:'BAKERSFIELD', endMile:165, lanes:3, speed:2.00, obsFreq:0.012, fwFreq:0.09,
    waterColor:0x22D3EE, bankColor:0xD97706,
    obsTypes:['shopping_cart','shopping_cart','boulder','boulder','river_wash'],
    fwType:'tube_float_parade', collA:'fox_theater_ticket', collB:'city_seal_medallion',
    subNarrow:[
      { atMile:150, lanes:2, msg:'THE RIVER NARROWS', obsFreq:0.009 },
      { atMile:160, lanes:1, msg:'FINAL STRETCH',     obsFreq:0.007 },
    ],
  },
];

// ── THREE.JS RENDERER + SCENE ────────────────────────────────────
const canvas3d = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog        = new THREE.Fog(0x87CEEB, 60, 135);

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
// Warm bright ambient fill so low-poly shapes read clearly in daylight
scene.add(new THREE.AmbientLight(0xFFF7ED, 1.20));
// Directional sun: warm white, angled from up-left-ahead
const sun = new THREE.DirectionalLight(0xFFFBEB, 2.20);
sun.position.set(-5, 18, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
sun.shadow.camera.left = sun.shadow.camera.bottom = -22;
sun.shadow.camera.right = sun.shadow.camera.top   =  22;
scene.add(sun);
// Hemisphere: sky blue above, warm earth below
scene.add(new THREE.HemisphereLight(0x87CEEB, 0xA3805A, 0.55));
// Rim: subtle blue accent from behind
const rimLight = new THREE.DirectionalLight(0x93C5FD, 0.28);
rimLight.position.set(3, 5, -10);
scene.add(rimLight);

// ── SKY DOME ─────────────────────────────────────────────────────
// Large sphere rendered from the inside; vertex colors fade from
// light sky blue at the horizon up to deep blue at the zenith.
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(140, 20, 10),
  new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
);
(function() {
  var pos  = skyDome.geometry.attributes.position;
  var cols = new Float32Array(pos.count * 3);
  var deep = new THREE.Color(0x1565C0);
  var hor  = new THREE.Color(0x87CEEB);
  for (var si = 0; si < pos.count; si++) {
    var t = Math.max(0, pos.getY(si) / 140);
    var c = hor.clone().lerp(deep, t * t);
    cols[si * 3]     = c.r;
    cols[si * 3 + 1] = c.g;
    cols[si * 3 + 2] = c.b;
  }
  skyDome.geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
})();
scene.add(skyDome);

// ── CLOUDS ───────────────────────────────────────────────────────
// Low-poly puffy white clouds: clusters of overlapping spheres,
// sitting high above the play area, drifting slowly downstream.
const clouds3 = [];
(function() {
  var cMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

  function makeCloud(blobs) {
    var grp = new THREE.Group();
    for (var bi = 0; bi < blobs.length; bi++) {
      var b = blobs[bi];
      var m = new THREE.Mesh(new THREE.SphereGeometry(b.r, 7, 5), cMat);
      m.position.set(b.x, b.y, b.z);
      grp.add(m);
    }
    return grp;
  }

  var s0 = [
    { x:0,    y:0,    z:0,    r:3.5 },
    { x:3.2,  y:-0.7, z:0.4,  r:2.6 },
    { x:-3.0, y:-0.8, z:-0.3, r:2.4 },
    { x:1.5,  y:0.8,  z:1.1,  r:2.8 },
    { x:-1.2, y:0.6,  z:-1.0, r:2.1 },
  ];
  var s1 = [
    { x:0,    y:0,    z:0,   r:2.8 },
    { x:2.7,  y:-0.5, z:0.3, r:2.2 },
    { x:-2.4, y:-0.6, z:0.2, r:2.0 },
    { x:0.9,  y:0.9,  z:0.8, r:2.3 },
  ];
  var s2 = [
    { x:0,    y:0,    z:0,    r:4.2 },
    { x:4.0,  y:-0.8, z:0.6,  r:3.1 },
    { x:-3.7, y:-0.8, z:-0.5, r:2.9 },
    { x:1.8,  y:1.1,  z:1.4,  r:3.3 },
    { x:-1.7, y:0.8,  z:-1.3, r:2.6 },
    { x:5.2,  y:-1.2, z:0.2,  r:2.0 },
  ];

  var placements = [
    { x:-16, y:22, z:-84, s:s0, spd:0.013 },
    { x:  9, y:24, z:-70, s:s1, spd:0.010 },
    { x: 22, y:21, z:-58, s:s2, spd:0.015 },
    { x:-25, y:23, z:-76, s:s1, spd:0.011 },
    { x: 15, y:25, z:-92, s:s0, spd:0.014 },
    { x: -5, y:22, z:-64, s:s2, spd:0.009 },
    { x: 20, y:23, z:-80, s:s1, spd:0.012 },
  ];

  for (var pi = 0; pi < placements.length; pi++) {
    var p  = placements[pi];
    var cl = makeCloud(p.s);
    cl.position.set(p.x, p.y, p.z);
    cl.userData.spd = p.spd;
    scene.add(cl);
    clouds3.push(cl);
  }
})();

// ── WORLD GEOMETRY ───────────────────────────────────────────────
let riverGroup  = null;
let flowLines3d = [];
let horizonGrp  = null;
let waterMesh   = null;
let stageIdx    = 0;
let curLanes    = STAGES3[0].lanes;

function riverWidth()  { return curLanes * LANE_W; }
function laneXPos(l)   { return (l - (curLanes - 1) / 2) * LANE_W; }

function buildWorld() {
  if (riverGroup) {
    waterMesh = null;
    riverGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    scene.remove(riverGroup);
  }
  flowLines3d.forEach(l => { l.geometry.dispose(); scene.remove(l); });
  flowLines3d = [];
  if (horizonGrp) { scene.remove(horizonGrp); }

  const stg = STAGES3[stageIdx];
  const rw  = riverWidth();
  riverGroup = new THREE.Group();

  // Ground
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(130, 170), new THREE.MeshLambertMaterial({ color: stg.bankColor }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -0.02, -55); gnd.receiveShadow = true;
  riverGroup.add(gnd);

  // River surface
  const wMat = new THREE.MeshPhongMaterial({ color: stg.waterColor, shininess: 90, specular: 0x7DD3FC });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(rw, 155, 12, 32), wMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.01, -55); water.receiveShadow = true;
  riverGroup.add(water);
  waterMesh = water;

  // Banks
  const bkW = 5.5;
  const bkMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  const bkGeo = new THREE.BoxGeometry(bkW, 0.60, 145);
  for (const side of [-1, 1]) {
    const bk = new THREE.Mesh(bkGeo, bkMat.clone());
    bk.position.set(side * (rw / 2 + bkW / 2), 0.30, -55);
    bk.castShadow = true; bk.receiveShadow = true;
    riverGroup.add(bk);
  }

  // Lane dividers
  const divMat = new THREE.LineBasicMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.22 });
  for (let l = 1; l < curLanes; l++) {
    const x  = -rw / 2 + l * LANE_W;
    const div = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.04, SPAWN_Z - 5), new THREE.Vector3(x, 0.04, DESPAWN_Z)]),
      divMat
    );
    riverGroup.add(div);
  }

  addBankDecor(riverGroup, rw, stg);
  scene.add(riverGroup);

  // Animated flow lines
  const flMat = new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.16 });
  for (let i = 0; i < 22; i++) {
    const fl = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-rw / 2 + 0.3, 0.05, 0), new THREE.Vector3(rw / 2 - 0.3, 0.05, 0)]),
      flMat.clone()
    );
    fl.position.z = SPAWN_Z + i * (Math.abs(SPAWN_Z) / 22);
    scene.add(fl);
    flowLines3d.push(fl);
  }

  horizonGrp = buildHorizonArt(stg);
  scene.add(horizonGrp);
}

function addBankDecor(group, rw, stg) {
  const zPositions = [-15, -28, -42, -55, -33, -18, -50];
  const foliageCol = stg.num <= 2 ? 0x166534 : stg.num === 3 ? 0xD97706 : 0x44403C;
  const treeMat  = new THREE.MeshLambertMaterial({ color: foliageCol });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350F });

  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const xBase = side * (rw / 2 + 1.4 + (i % 3) * 1.9);
    const z     = zPositions[i];

    if (stg.num === 4) {
      const rock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.0, 0.75), new THREE.MeshLambertMaterial({ color: 0x292524 }));
      rock.position.set(xBase, 2.0, z); rock.castShadow = true; group.add(rock);
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.20, 1.1, 5), trunkMat);
      trunk.position.set(xBase, 0.55, z); group.add(trunk);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.80, 1.7, 6), treeMat);
      canopy.position.set(xBase, 1.95, z); canopy.castShadow = true; group.add(canopy);
    }
  }
}

function buildHorizonArt(stg) {
  const grp = new THREE.Group();
  const mtData = [{ x:-18, h:15, r:8 }, { x:-7, h:20, r:7 }, { x:2, h:12, r:6 }, { x:11, h:17, r:9 }, { x:20, h:14, r:7 }, { x:-26, h:10, r:5 }];
  const mtColors = stg.num === 4 ? [0x1C1917, 0x292524, 0x1C1917] : stg.num === 5 ? [0x92400E, 0xB45309, 0x78350F] : [0x1E3A5F, 0x1A3253, 0x172944];
  for (const m of mtData) {
    const geo = new THREE.ConeGeometry(m.r * 0.62, m.h, stg.num === 4 ? 4 : 5);
    const mat = new THREE.MeshLambertMaterial({ color: mtColors[Math.abs(m.x) % mtColors.length] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(m.x, m.h / 2 - 0.3, -90);
    grp.add(mesh);
  }
  return grp;
}

// ── KAYAK HULL GEOMETRY (custom hex-prism with pointed bow/stern) ─
function buildKayakHullGeo() {
  const bw = 0.28, bh = 0.14, ms = 0.55, bl = 1.0;
  // 12 vertices: top hexagon (0-5) + bottom hexagon (6-11)
  // bow tip = index 0/6; stern tip = index 3/9
  const v = new Float32Array([
     0,  bh, -bl,   bw, bh, -ms,   bw, bh,  ms,   0,  bh,  bl,  -bw, bh,  ms,  -bw, bh, -ms,
     0,   0, -bl,   bw,  0, -ms,   bw,  0,  ms,   0,   0,  bl,  -bw,  0,  ms,  -bw,  0, -ms,
  ]);
  const idx = [
    // Top (CCW from above → normals up)
    0, 5, 4,  0, 4, 3,  0, 3, 2,  0, 2, 1,
    // Bottom (CW from above → normals down)
    6, 7, 8,  6, 8, 9,  6, 9, 10, 6, 10, 11,
    // Sides (CCW from outside)
    0, 1, 7,  0, 7, 6,   1, 2, 8,  1, 8, 7,   2, 3, 9,  2, 9, 8,
    3, 4, 10, 3, 10, 9,  4, 5, 11, 4, 11, 10,  5, 0, 6,  5, 6, 11,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ── PLAYER MODEL ─────────────────────────────────────────────────
const playerGroup = new THREE.Group();
scene.add(playerGroup);

// Materials (MeshStandardMaterial for PBR shading)
const kNavy  = new THREE.MeshStandardMaterial({ color: 0x0B1F3A, roughness: 0.65, metalness: 0.15 });
const kGold  = new THREE.MeshStandardMaterial({ color: 0xC9883A, roughness: 0.30, metalness: 0.60 });
const kGreen = new THREE.MeshStandardMaterial({ color: 0x2D6A4F, roughness: 0.80, metalness: 0.05 });
const kMid   = new THREE.MeshStandardMaterial({ color: 0x1E3A5F, roughness: 0.70, metalness: 0.10 });
const kWood  = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.90, metalness: 0.00 });
const kDark  = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.90, metalness: 0.00 });

// Kayak hull (improved custom geometry)
const hullMesh = new THREE.Mesh(buildKayakHullGeo(), kNavy.clone());
hullMesh.castShadow = true;
playerGroup.add(hullMesh);

// Deck stripe (green center line)
const deckStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.80), kGreen.clone());
deckStripe.position.set(0, 0.15, 0);
playerGroup.add(deckStripe);

// Cockpit rim (raised ring around cockpit opening)
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.52), kMid.clone());
cockpit.position.set(0, 0.17, 0.08);
playerGroup.add(cockpit);

// Torso / life-jacket (green over navy base)
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.38, 0.24), kGreen.clone());
torso.position.set(0, 0.42, 0.08); torso.castShadow = true;
playerGroup.add(torso);

// Torso front panel (navy)
const torsoFront = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.04), kNavy.clone());
torsoFront.position.set(0, 0.44, -0.08);
playerGroup.add(torsoFront);

// Head / helmet (gold)
const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.22), kGold.clone());
head.position.set(0, 0.72, 0.08); head.castShadow = true;
playerGroup.add(head);

// Helmet visor (dark, facing camera side = back of head toward z+)
const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.09, 0.05), kMid.clone());
visor.position.set(0, 0.68, 0.185);
playerGroup.add(visor);

// Face indicator: small bright panel on front face of helmet (z- = facing forward)
const faceMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.5, metalness: 0.0, emissive: 0x786014, emissiveIntensity: 0.4 });
const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.03), faceMat);
facePlate.position.set(0, 0.70, -0.09);
playerGroup.add(facePlate);

// Arms
const armGeo = new THREE.BoxGeometry(0.08, 0.09, 0.30);
for (const sx of [-0.20, 0.20]) {
  const arm = new THREE.Mesh(armGeo, kNavy.clone());
  arm.position.set(sx, 0.50, 0.08);
  playerGroup.add(arm);
}

// Paddle group (animated)
const paddleGroup = new THREE.Group();
paddleGroup.position.set(0, 0.54, 0.10);

const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.048, 0.048), kWood.clone());
paddleGroup.add(shaft);

const bladeGeo = new THREE.BoxGeometry(0.15, 0.048, 0.36);
for (const bx of [-0.97, 0.97]) {
  const blade = new THREE.Mesh(bladeGeo, kDark.clone());
  blade.position.x = bx;
  paddleGroup.add(blade);
}

playerGroup.add(paddleGroup);

// Blob shadow on water surface
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), shadowMat);
playerShadow.rotation.x = -Math.PI / 2;
playerShadow.position.set(0, 0.02, 0);
scene.add(playerShadow);

// Shield ring (animated torus)
const shieldMat3 = new THREE.MeshBasicMaterial({ color: 0xF97316, transparent: true, opacity: 0, depthWrite: false });
const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.065, 8, 28), shieldMat3);
shieldRing.rotation.x = Math.PI / 2;
shieldRing.position.set(0, 0.36, 0.08);
playerGroup.add(shieldRing);

// ── MESH DISPOSAL HELPER ─────────────────────────────────────────
function disposeMesh(m) {
  if (!m) return;
  m.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(mt => mt.dispose());
    }
  });
}

// ── COLLECTIBLE FACTORY ───────────────────────────────────────────
function makeCollMesh3(type) {
  let grp, mesh;

  switch (type) {
    case 'poppy': {
      grp = new THREE.Group();
      const pMat = new THREE.MeshPhongMaterial({ color: 0xF97316, emissive: 0xEA580C, emissiveIntensity: 0.60, shininess: 60 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.085, 4, 8), pMat);
      ring.rotation.x = Math.PI / 2; grp.add(ring);
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 4), new THREE.MeshPhongMaterial({ color: 0xFBBF24, emissive: 0xF59E0B, emissiveIntensity: 0.55, shininess: 80 }));
      grp.add(center);
      return grp;
    }
    case 'golden_trout': {
      grp = new THREE.Group();
      const fMat = new THREE.MeshPhongMaterial({ color: 0xFBBF24, emissive: 0xD97706, emissiveIntensity: 0.45, shininess: 75 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 5), fMat);
      body.scale.set(1.65, 0.62, 0.85); grp.add(body);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.13), new THREE.MeshPhongMaterial({ color: 0xF59E0B, emissive: 0xD97706, emissiveIntensity: 0.35, shininess: 60 }));
      tail.position.set(0.30, 0, 0); tail.rotation.z = Math.PI / 4; grp.add(tail);
      return grp;
    }
    case 'mountain_crystal': {
      grp = new THREE.Group();
      const cMat = () => new THREE.MeshPhongMaterial({ color: 0xA5F3FC, emissive: 0x38BDF8, emissiveIntensity: 0.75, transparent: true, opacity: 0.88, shininess: 130 });
      const top  = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.30, 5), cMat());
      top.position.y = 0.15; grp.add(top);
      const bot  = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.20, 5), cMat());
      bot.rotation.x = Math.PI; bot.position.y = -0.10; grp.add(bot);
      return grp;
    }
    case 'fishing_lure': {
      grp = new THREE.Group();
      const lMat = new THREE.MeshPhongMaterial({ color: 0xEF4444, emissive: 0xDC2626, emissiveIntensity: 0.50, shininess: 80 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), lMat);
      body.scale.set(0.75, 1.48, 0.75); grp.add(body);
      const hMat = new THREE.MeshPhongMaterial({ color: 0xD1D5DB, shininess: 110 });
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 4, 6, Math.PI * 1.5), hMat);
      hook.rotation.x = Math.PI / 2; hook.position.y = -0.23; grp.add(hook);
      return grp;
    }
    case 'golden_eagle_feather': {
      const fMat = new THREE.MeshPhongMaterial({ color: 0xC9883A, emissive: 0xB45309, emissiveIntensity: 0.45, shininess: 55 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.010, 0.46, 4), fMat);
      return mesh;
    }
    case 'beach_ball': {
      grp = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 7), new THREE.MeshPhongMaterial({ color: 0x60A5FA, emissive: 0x1D4ED8, emissiveIntensity: 0.25, shininess: 95 }));
      grp.add(sphere);
      const s1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 4, 10), new THREE.MeshPhongMaterial({ color: 0xEF4444, emissive: 0xDC2626, emissiveIntensity: 0.30 }));
      s1.rotation.x = Math.PI / 5; grp.add(s1);
      const s2 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 4, 10), new THREE.MeshPhongMaterial({ color: 0xFDE68A, emissive: 0xFBBF24, emissiveIntensity: 0.30 }));
      s2.rotation.x = -Math.PI / 5; grp.add(s2);
      return grp;
    }
    case 'cooler': {
      grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.23, 0.24), new THREE.MeshPhongMaterial({ color: 0x1D4ED8, emissive: 0x1E3A5F, emissiveIntensity: 0.20, shininess: 55 }));
      grp.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.25), new THREE.MeshPhongMaterial({ color: 0xEFF6FF, emissive: 0x93C5FD, emissiveIntensity: 0.22, shininess: 65 }));
      lid.position.y = 0.15; grp.add(lid);
      return grp;
    }
    case 'gold_nugget': {
      const nMat = new THREE.MeshPhongMaterial({ color: 0xFBBF24, emissive: 0xD97706, emissiveIntensity: 0.60, shininess: 85 });
      mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.20, 0), nMat);
      mesh.scale.set(1.2, 0.80, 1.0);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      return mesh;
    }
    case 'treasure_chest': {
      grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.25), new THREE.MeshPhongMaterial({ color: 0x92400E, emissive: 0x78350F, emissiveIntensity: 0.18, shininess: 42 }));
      grp.add(body);
      // Arched lid via half-cylinder
      const lidGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.36, 6, 1, false, 0, Math.PI);
      lidGeo.rotateZ(Math.PI / 2);
      const lid = new THREE.Mesh(lidGeo, new THREE.MeshPhongMaterial({ color: 0xB45309, emissive: 0x92400E, emissiveIntensity: 0.18, shininess: 50 }));
      lid.position.y = 0.17; grp.add(lid);
      // Gold clasp
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), new THREE.MeshPhongMaterial({ color: 0xFBBF24, emissive: 0xD97706, emissiveIntensity: 0.55, shininess: 90 }));
      clasp.position.set(0, 0.01, 0.14); grp.add(clasp);
      return grp;
    }
    case 'fox_theater_ticket': {
      const tMat = new THREE.MeshPhongMaterial({ color: 0x7C3AED, emissive: 0x6D28D9, emissiveIntensity: 0.55, shininess: 75 });
      return new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.05), tMat);
    }
    case 'city_seal_medallion': {
      grp = new THREE.Group();
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.055, 12), new THREE.MeshPhongMaterial({ color: 0xC9883A, emissive: 0xB45309, emissiveIntensity: 0.50, shininess: 95 }));
      coin.rotation.x = Math.PI / 2; grp.add(coin);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.065, 12), new THREE.MeshPhongMaterial({ color: 0x1D4ED8, emissive: 0x1E3A5F, emissiveIntensity: 0.30, shininess: 80 }));
      inner.rotation.x = Math.PI / 2; grp.add(inner);
      return grp;
    }
    default: {
      return new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), new THREE.MeshPhongMaterial({ color: 0xFBBF24, emissive: 0xD97706, emissiveIntensity: 0.50, shininess: 70 }));
    }
  }
}

// ── OBSTACLE FACTORY ─────────────────────────────────────────────
const OBS_MAT_COL = {
  boulder:0x7C2D12, river_wash:0x38BDF8, deadfall_log:0x44403C,
  capsized_raft:0x57534E, drifting_sailboat:0x1E3A5F, mine_cart:0x292524,
  shopping_cart:0x9CA3AF, fallen_sequoia:0x78350F, raft_train:0x92400E,
  pontoon_party:0x1D4ED8, old_mining_bridge:0x44403C, tube_float_parade:0xF97316,
};

function makeObsMesh(type, fullWidth) {
  const col = OBS_MAT_COL[type] || 0x6B7280;
  const lm  = c => new THREE.MeshLambertMaterial({ color: c });

  if (fullWidth) {
    const rw  = riverWidth();
    const grp = new THREE.Group();

    if (type === 'fallen_sequoia') {
      const logGeo = new THREE.CylinderGeometry(0.30, 0.38, rw + 1.4, 6);
      logGeo.rotateZ(Math.PI / 2);
      const log = new THREE.Mesh(logGeo, lm(0x78350F));
      log.position.y = 0.34; grp.add(log);
      // Highlight stripe
      const topGeo = new THREE.CylinderGeometry(0.31, 0.31, rw + 1.4, 6);
      topGeo.rotateZ(Math.PI / 2);
      const top = new THREE.Mesh(topGeo, lm(0x92400E));
      top.position.set(0, 0.60, 0); top.scale.y = 0.18; grp.add(top);
      // End rings
      for (const sx of [-(rw / 2 + 0.55), rw / 2 + 0.55]) {
        const endGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 6);
        const end = new THREE.Mesh(endGeo, lm(0x5C2002));
        end.rotation.z = Math.PI / 2; end.position.set(sx, 0.34, 0); grp.add(end);
      }

    } else if (type === 'raft_train') {
      const raftW = rw * 0.28;
      for (let i = 0; i < 3; i++) {
        const rx = -rw * 0.29 + i * rw * 0.29;
        const raft = new THREE.Mesh(new THREE.BoxGeometry(raftW - 0.12, 0.12, 0.72), lm(0x92400E));
        raft.position.set(rx, 0.06, 0); grp.add(raft);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(raftW - 0.14, 0.04, 0.70), lm(0xB45309));
        deck.position.set(rx, 0.14, 0); grp.add(deck);
        if (i < 2) {
          const ropeGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.22, 4);
          ropeGeo.rotateZ(Math.PI / 2);
          const rope = new THREE.Mesh(ropeGeo, lm(0x78350F));
          rope.position.set(rx + raftW * 0.5 + 0.11, 0.06, 0); grp.add(rope);
        }
      }

    } else if (type === 'pontoon_party') {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.9, 0.12, 0.82), lm(0x1D4ED8));
      plat.position.y = 0.06; grp.add(plat);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.9, 0.04, 0.82), lm(0xEFF6FF));
      deck.position.y = 0.14; grp.add(deck);
      const bColors = [0xF97316, 0xFBBF24, 0x34D399, 0xF472B6];
      const spacing = rw / 3.5;
      for (let i = 0; i < 4; i++) {
        const bx = -rw * 0.33 + i * spacing;
        const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.19, 6, 5), lm(bColors[i]));
        balloon.position.set(bx, 0.52, 0); grp.add(balloon);
        const str = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.22, 0.022), lm(0x9CA3AF));
        str.position.set(bx, 0.29, 0); grp.add(str);
      }

    } else if (type === 'old_mining_bridge') {
      const main = new THREE.Mesh(new THREE.BoxGeometry(rw + 1.3, 0.16, 0.58), lm(0x44403C));
      main.position.y = 0.42; grp.add(main);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rw + 1.3, 0.08, 0.08), lm(0x78350F));
      rail.position.y = 0.54; grp.add(rail);
      for (const sx of [-(rw / 2 + 0.52), rw / 2 + 0.52]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.72, 0.19), lm(0x292524));
        post.position.set(sx, 0.36, 0); grp.add(post);
      }
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(rw + 1.3, 0.07, 0.07), lm(0x1C1917));
      crossbar.position.y = 0.11; grp.add(crossbar);

    } else if (type === 'tube_float_parade') {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.7, 0.08, 0.58), lm(0x1E3A5F));
      plat.position.y = 0.04; grp.add(plat);
      const tColors = [0xF97316, 0x3B82F6, 0xF472B6, 0x34D399];
      const n = Math.min(4, curLanes);
      for (let i = 0; i < n; i++) {
        const tx = -rw * 0.36 + i * (rw * 0.72 / Math.max(1, n - 1));
        const tube = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.095, 5, 10), lm(tColors[i % 4]));
        tube.rotation.x = Math.PI / 2; tube.position.set(tx, 0.38, 0); grp.add(tube);
        const person = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 4), lm(0xFBBF24));
        person.position.set(tx, 0.58, 0); grp.add(person);
      }

    } else {
      // Generic full-width
      const m = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.6, 0.38, 0.85), lm(col));
      m.position.y = 0.19; grp.add(m);
    }
    return grp;
  }

  // ── Lane obstacles ─────────────────────────────────────────────
  if (type === 'river_wash') {
    const grp = new THREE.Group();
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.42, shininess: 80 });
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 7), sphereMat));
    const sColors = [0x38BDF8, 0x7DD3FC, 0xBAE6FD];
    for (let i = 0; i < 3; i++) {
      const tMat = new THREE.MeshBasicMaterial({ color: sColors[i], transparent: true, opacity: 0.72 - i * 0.18 });
      const tor  = new THREE.Mesh(new THREE.TorusGeometry(0.28 + i * 0.11, 0.038, 4, 8), tMat);
      tor.rotation.x = i * Math.PI / 3 + 0.5;
      tor.rotation.y = i * Math.PI / 4;
      grp.add(tor);
    }
    return grp;
  }
  if (type === 'boulder') {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), lm(0x7C2D12));
    m.rotation.y = Math.random() * Math.PI * 2;
    m.rotation.z = (Math.random() - 0.5) * 0.5;
    m.castShadow = true; return m;
  }
  if (type === 'deadfall_log') {
    const grp = new THREE.Group();
    const logGeo = new THREE.CylinderGeometry(0.20, 0.24, LANE_W * 0.92, 6);
    logGeo.rotateZ(Math.PI / 2);
    const log = new THREE.Mesh(logGeo, lm(0x44403C));
    log.position.y = 0.22; log.castShadow = true; grp.add(log);
    const endGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.065, 6);
    const end = new THREE.Mesh(endGeo, lm(0x292524));
    end.rotation.z = Math.PI / 2; end.position.set(-LANE_W * 0.46 - 0.01, 0.22, 0);
    grp.add(end);
    return grp;
  }
  if (type === 'capsized_raft') {
    const grp = new THREE.Group();
    const raft = new THREE.Mesh(new THREE.BoxGeometry(LANE_W * 0.84, 0.10, 0.66), lm(0x57534E));
    raft.position.y = 0.05; grp.add(raft);
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.68), lm(0x292524));
      plank.position.set(i * LANE_W * 0.22, 0.10, 0); grp.add(plank);
    }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.23, 5), lm(0x92400E));
    drum.position.set(LANE_W * 0.28, 0.14, -0.18); grp.add(drum);
    return grp;
  }
  if (type === 'drifting_sailboat') {
    const grp = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.27, 0.90), lm(0x1E3A5F));
    hull.position.y = 0.135; grp.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.055, 0.92), lm(0xEFF6FF));
    deck.position.y = 0.30; grp.add(deck);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 4), lm(0x57534E));
    mast.position.set(0, 0.72, 0.08); grp.add(mast);
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.50, 0.030), lm(0xF5F0E8));
    sail.position.set(0.20, 0.58, 0.08); grp.add(sail);
    return grp;
  }
  if (type === 'mine_cart') {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.44, 0.54), lm(0x1C1917));
    body.position.y = 0.38; grp.add(body);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.065, 0.55), lm(0x292524));
    rim.position.y = 0.63; grp.add(rim);
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = lm(0x44403C);
    for (const wx of [-0.29, 0.29]) {
      for (const wz of [-0.22, 0.22]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.12, wz); grp.add(w);
      }
    }
    return grp;
  }
  if (type === 'shopping_cart') {
    const grp = new THREE.Group();
    const wireMat = lm(0x9CA3AF);
    const cW = 0.52, cH = 0.38, cD = 0.46;
    // Front / back walls
    for (const tz of [cD / 2, -cD / 2]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, 0.038), wireMat.clone());
      wall.position.set(0, cH / 2 + 0.10, tz); grp.add(wall);
    }
    // Side walls
    for (const tx of [cW / 2, -cW / 2]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.038, cH, cD), wireMat.clone());
      wall.position.set(tx, cH / 2 + 0.10, 0); grp.add(wall);
    }
    // Handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.06, 0.06), wireMat.clone());
    handle.position.set(0, cH + 0.21, cD * 0.32); grp.add(handle);
    // Wheels
    const wh = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 5);
    wh.rotateZ(Math.PI / 2);
    const wlMat = lm(0x6B7280);
    for (const wx of [-0.18, 0.18]) {
      for (const wz of [-0.16, 0.16]) {
        const w = new THREE.Mesh(wh, wlMat); w.position.set(wx, 0.09, wz); grp.add(w);
      }
    }
    return grp;
  }

  // Default box
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.72), lm(col));
  m.castShadow = true; return m;
}

// ── GAME STATE ───────────────────────────────────────────────────
let gameState3  = 'start';
let score3      = 0;
let highScore3  = parseInt(localStorage.getItem('krr3d_hs') || '0', 10);
let distance3   = 0;
let curMile3    = 0;
let curSpeed3   = STAGES3[0].speed;
let curObsFreq3 = STAGES3[0].obsFreq;
let gapFrames3  = 0;
let subsFired3  = new Set();
let transMsg3   = null;
let frameN      = 0;
let camXSmooth  = 0;
let endingSpeedMult = 1.0;

const player3 = {
  lane: 3, targetLane: 3, x: 0,
  isJumping: false, jumpFrame: 0,
  dead: false, hasShield: false, spinoutFrames: 0,
};

let obstacles3    = [];
let collectibles3 = [];

// ── STAGE MANAGEMENT ─────────────────────────────────────────────
function applyStage3(idx, msg) {
  stageIdx    = idx;
  curLanes    = STAGES3[idx].lanes;
  curSpeed3   = STAGES3[idx].speed;
  curObsFreq3 = STAGES3[idx].obsFreq;
  endingSpeedMult = 1.0;

  if (player3.targetLane >= curLanes) player3.targetLane = curLanes - 1;
  if (player3.lane       >= curLanes) player3.lane       = curLanes - 1;
  player3.x = laneXPos(player3.targetLane);
  clearActive(); buildWorld();
  if (msg) flash3(msg, 160);
}

function clearActive() {
  obstacles3.forEach(o    => { if (o.mesh)   { disposeMesh(o.mesh);   scene.remove(o.mesh);   } });
  collectibles3.forEach(c => { if (c.mesh)   { disposeMesh(c.mesh);   scene.remove(c.mesh);   } });
  obstacles3 = []; collectibles3 = [];
}

function flash3(text, life) {
  transMsg3 = { text, life, maxLife: life };
  const el = document.getElementById('transitionMsg3');
  if (el) el.textContent = text;
}

// ── COLLECTIBLE TYPE PICKER (stage-specific) ──────────────────────
function pickCollType3() {
  const stg = STAGES3[stageIdx];
  const r   = Math.random();
  if (r < 0.12) return 'poppy';
  if (r < 0.22) return stg.collB;
  return stg.collA;
}

// ── SPAWN ─────────────────────────────────────────────────────────
function spawnObs3() {
  const stg     = STAGES3[stageIdx];
  const isFw    = Math.random() < stg.fwFreq;
  const type    = isFw
    ? stg.fwType
    : stg.obsTypes[Math.floor(Math.random() * stg.obsTypes.length)];
  const lane    = isFw ? -1 : Math.floor(Math.random() * curLanes);
  const mesh    = makeObsMesh(type, isFw);

  const xPos = isFw ? 0 : laneXPos(lane);
  let yPos;
  if (isFw)                       yPos = 0;
  else if (type === 'boulder')    yPos = 0.52;
  else if (type === 'river_wash') yPos = 0.52;
  else                            yPos = 0;

  mesh.position.set(xPos, yPos, SPAWN_Z);
  mesh.traverse(c => { if (c.isMesh) c.castShadow = true; });
  scene.add(mesh);
  obstacles3.push({ mesh, lane, z: SPAWN_Z, resolved: false, fullWidth: isFw, type });
}

function spawnColl3() {
  const lane = Math.floor(Math.random() * curLanes);
  const type = pickCollType3();
  const mesh = makeCollMesh3(type);
  mesh.position.set(laneXPos(lane), 0.55, SPAWN_Z);
  scene.add(mesh);
  collectibles3.push({ mesh, lane, z: SPAWN_Z, collected: false, type, baseY: 0.55 });
}

// ── UPDATE ────────────────────────────────────────────────────────
function update3() {
  frameN++;

  // Gradual slowdown approaching the end
  if (curMile3 >= 163) {
    const t = Math.min(1, (curMile3 - 163) / 2);
    endingSpeedMult = Math.max(0.15, 1 - t * 0.85);
  }

  const effectiveSpeed = curSpeed3 * endingSpeedMult;
  distance3 += effectiveSpeed;
  score3    += SPF;
  curMile3   = Math.floor(distance3 / MI_PER_PX);

  if (curMile3 >= 165) { startEnding3(); return; }

  // Stage advance
  const stg = STAGES3[stageIdx];
  if (curMile3 >= stg.endMile && stageIdx < STAGES3.length - 1) {
    applyStage3(stageIdx + 1, 'ENTERING ' + STAGES3[stageIdx + 1].name); return;
  }
  // Stage-5 sub-narrows
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

  if (player3.spinoutFrames > 0) player3.spinoutFrames--;

  // Smooth player X
  const tx = laneXPos(player3.targetLane);
  player3.x += (tx - player3.x) * 0.28;
  if (Math.abs(player3.x - tx) < 0.02) player3.x = tx;

  // Jump arc
  if (player3.isJumping) {
    player3.jumpFrame++;
    if (player3.jumpFrame >= JUMP_DUR) { player3.isJumping = false; player3.jumpFrame = 0; }
  }

  // Spawn
  gapFrames3++;
  const minF = Math.ceil(MIN_GAP / curSpeed3);
  if (gapFrames3 >= minF && Math.random() < curObsFreq3 * endingSpeedMult) { spawnObs3(); gapFrames3 = 0; }
  if (Math.random() < COLL_FREQ) spawnColl3();

  // Move items
  const spd = effectiveSpeed * SPD_SCALE;

  for (const o of obstacles3) {
    o.z += spd; o.mesh.position.z = o.z;
  }
  obstacles3 = obstacles3.filter(o => {
    if (o.z > DESPAWN_Z) { disposeMesh(o.mesh); scene.remove(o.mesh); return false; }
    return true;
  });

  for (const c of collectibles3) {
    c.z += spd; c.mesh.position.z = c.z;
    c.mesh.position.y = c.baseY + Math.sin(frameN * 0.11 + c.lane * 1.3) * 0.14;
    c.mesh.rotation.y += 0.028;  // gentle rotation
  }
  collectibles3 = collectibles3.filter(c => {
    if (c.collected || c.z > DESPAWN_Z) { disposeMesh(c.mesh); scene.remove(c.mesh); return false; }
    return true;
  });

  // Scroll flow lines
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

// ── COLLISION ─────────────────────────────────────────────────────
const COLL_FRONT = -1.5;
const COLL_BACK  =  1.5;

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
      endRun3(false);
    }
  }
}

function checkCollectibles3() {
  for (const c of collectibles3) {
    if (c.collected) continue;
    if (c.z < COLL_FRONT || c.z > COLL_BACK) continue;
    if (c.lane !== player3.targetLane) continue;
    c.collected = true;
    if (c.type === 'poppy') {
      player3.hasShield = true;
    } else {
      score3 += (c.type === 'mountain_crystal' || c.type === 'treasure_chest') ? 150 : 50;
    }
  }
}

// ── VISUAL UPDATE (every frame) ────────────────────────────────────
function updateVisuals3() {
  playerGroup.position.x = player3.x;

  const jumpY = player3.isJumping
    ? JUMP_H * Math.sin((player3.jumpFrame / JUMP_DUR) * Math.PI)
    : 0;
  playerGroup.position.y = jumpY;

  playerShadow.position.x = player3.x;
  const sScale = player3.isJumping ? Math.max(0.3, 1 - jumpY * 0.22) : 1;
  playerShadow.scale.set(sScale, sScale, sScale);
  shadowMat.opacity = player3.isJumping ? 0.10 : 0.28;

  // Spinout
  if (player3.spinoutFrames > 0) {
    playerGroup.rotation.y += 0.18;
  } else {
    playerGroup.rotation.y *= 0.75;
    if (Math.abs(playerGroup.rotation.y) < 0.01) playerGroup.rotation.y = 0;
  }

  // Paddle animation: Z tilt + subtle X dive
  paddleGroup.rotation.z = Math.sin(frameN * 0.095) * 0.42;
  paddleGroup.rotation.x = Math.cos(frameN * 0.095) * 0.12;

  // Shield ring pulse
  shieldMat3.opacity = player3.hasShield
    ? 0.60 + Math.sin(frameN * 0.14) * 0.32
    : 0;

  // Chase camera
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

  // Animate water surface -- two overlapping sine waves traveling downstream (+world z).
  // PlaneGeometry is rotated -PI/2 on X, so local Y maps to world Z.
  // Wave sin(t - localY * k) travels in +localY = +worldZ = downstream direction.
  if (waterMesh && waterMesh.geometry) {
    var wPos = waterMesh.geometry.attributes.position;
    var wt   = frameN * 0.038;
    for (var wvi = 0; wvi < wPos.count; wvi++) {
      var wly = wPos.getY(wvi);
      var wlx = wPos.getX(wvi);
      wPos.setZ(wvi,
        Math.sin(wt - wly * 0.15 + wlx * 0.20) * 0.10 +
        Math.sin(wt * 1.65 - wly * 0.27) * 0.045
      );
    }
    wPos.needsUpdate = true;
  }

  // Drift clouds slowly downstream; loop back to the far end when they pass the threshold.
  for (var ci = 0; ci < clouds3.length; ci++) {
    clouds3[ci].position.z += clouds3[ci].userData.spd;
    if (clouds3[ci].position.z > -38) clouds3[ci].position.z = -96;
  }
}

// ── ENDING SEQUENCE ────────────────────────────────────────────────
function startEnding3() {
  if (gameState3 === 'ending1' || gameState3 === 'ending2') return;
  if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
  gameState3 = 'ending1';
  document.getElementById('hud3').classList.remove('visible');
  showScreen3('ending1');
}

// ── END RUN ─────────────────────────────────────────────────────────
function endRun3(complete) {
  if (gameState3 === 'gameover' || gameState3 === 'ending1' || gameState3 === 'ending2') return;
  player3.dead = true;
  if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
  gameState3 = 'gameover';
  showScreen3('gameover', complete);
}

// ── START GAME ───────────────────────────────────────────────────────
function startGame3() {
  score3 = 0; distance3 = 0; curMile3 = 0;
  gapFrames3 = 0; frameN = 0; subsFired3 = new Set(); transMsg3 = null;
  stageIdx = 0; curLanes = STAGES3[0].lanes; curSpeed3 = STAGES3[0].speed;
  curObsFreq3 = STAGES3[0].obsFreq; endingSpeedMult = 1.0;
  camXSmooth = 0;

  const mid = Math.floor(STAGES3[0].lanes / 2);
  player3.lane = mid; player3.targetLane = mid;
  player3.x    = laneXPos(mid);
  player3.isJumping = false; player3.jumpFrame  = 0;
  player3.dead      = false; player3.hasShield  = false; player3.spinoutFrames = 0;
  playerGroup.rotation.y = 0; playerGroup.position.y = 0;

  clearActive(); buildWorld();

  const tEl = document.getElementById('transitionMsg3');
  if (tEl) { tEl.textContent = ''; tEl.style.opacity = '0'; }

  document.getElementById('overlay3').classList.add('hidden');
  document.getElementById('hud3').classList.add('visible');
  gameState3 = 'playing';
}

// ── SCREEN MANAGEMENT ────────────────────────────────────────────────
function showScreen3(which, _complete) {
  document.getElementById('overlay3').classList.remove('hidden');
  document.querySelectorAll('.screen3').forEach(s => s.classList.remove('visible'));

  if (which === 'start') {
    document.getElementById('screen3-start').classList.add('visible');
    document.getElementById('hud3').classList.remove('visible');

  } else if (which === 'gameover') {
    const scr = document.getElementById('screen3-gameover');
    scr.classList.add('visible');
    scr.querySelector('.go-title3').textContent = 'RUN ENDED';
    scr.querySelector('.go-stage3').textContent = STAGES3[stageIdx].name;
    scr.querySelector('.go-mile3').textContent  = 'Mile ' + curMile3 + ' / 165';
    scr.querySelector('.go-score3').textContent = 'Score: ' + Math.floor(score3);
    scr.querySelector('.go-best3').textContent  = 'Best:  ' + Math.floor(highScore3);

  } else if (which === 'paused') {
    document.getElementById('screen3-paused').classList.add('visible');

  } else if (which === 'ending1') {
    document.getElementById('screen3-ending1').classList.add('visible');

  } else if (which === 'ending2') {
    const scr2 = document.getElementById('screen3-ending2');
    scr2.classList.add('visible');
    scr2.querySelector('.go-score3-final').textContent = 'FINAL SCORE: ' + Math.floor(score3);
    scr2.querySelector('.go-best3-final').textContent  = 'BEST: ' + Math.floor(highScore3);
  }
}

// ── INPUT ──────────────────────────────────────────────────────────
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
      case 'Escape': case 'p': case 'P':
        gameState3 = 'paused';
        showScreen3('paused');
        break;
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
  e.preventDefault();
  const t = e.changedTouches[0]; tX3 = t.clientX; tY3 = t.clientY; tT3 = Date.now();
}, { passive: false });
canvas3d.addEventListener('touchend', e => {
  e.preventDefault();
  if (gameState3 !== 'playing') return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tX3, dy = t.clientY - tY3;
  const mag = Math.hypot(dx, dy), dt = Date.now() - tT3;
  if      (mag < 22 && dt < 280)                    doJump3();
  else if (Math.abs(dx) > Math.abs(dy) && mag > 28) dx < 0 ? doLeft3() : doRight3();
  else if (dy < -28)                                doJump3();
}, { passive: false });

// ── BUTTON WIRING ─────────────────────────────────────────────────
document.getElementById('btn3-start').addEventListener('click', startGame3);
document.getElementById('btn3-retry').addEventListener('click', startGame3);
document.getElementById('btn3-menu').addEventListener('click', () => showScreen3('start'));
document.getElementById('btn3-resume').addEventListener('click', () => {
  gameState3 = 'playing';
  document.getElementById('overlay3').classList.add('hidden');
});
document.getElementById('btn3-quit').addEventListener('click', () => {
  gameState3 = 'start'; showScreen3('start');
});
document.getElementById('btn3-pause').addEventListener('click', () => {
  if (gameState3 === 'playing') { gameState3 = 'paused'; showScreen3('paused'); }
});
document.getElementById('btn3-ending1-continue').addEventListener('click', () => {
  gameState3 = 'ending2'; showScreen3('ending2');
});
document.getElementById('btn3-learn').addEventListener('click', () => {
  window.location.href = '../';
});
document.getElementById('btn3-campaign').addEventListener('click', () => {
  window.location.href = '../';
});
document.getElementById('btn3-playagain').addEventListener('click', startGame3);

// ── GAME LOOP ──────────────────────────────────────────────────────
function loop3() {
  requestAnimationFrame(loop3);
  if (gameState3 === 'playing') update3();
  updateVisuals3();
  renderer.render(scene, camera);
}

// ── INIT ──────────────────────────────────────────────────────────
buildWorld();
showScreen3('start');
loop3();
