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
const COLL_FREQ  = 0.006;
const COLL_DRIFT = 0.60;  // collectibles float at 60% of obstacle speed (river-current feel)
const SPD_SCALE = 0.070;
const CAM_Y     = 4.8;
const CAM_Z_BK  = 8.5;
const CAM_LOOK_Z = -8.0;
const WATER_OPACITY = 0.60;   // tune here: 0=invisible 1=solid; 0.60 = clear shallow river

// ── STAGE DATA (full roster matching game.js) ─────────────────────
const STAGES3 = [
  {
    num:1, name:'HEADWATERS', endMile:33, lanes:7, speed:1.48, obsFreq:0.011, fwFreq:0.11,
    waterColor:0x38BDF8, bankColor:0x374151,
    obsTypes:['deadfall_log','deadfall_log','boulder','boulder','river_wash'],
    fwType:'fallen_sequoia', collA:'golden_trout', collB:'mountain_crystal',
    // ── Stage 1 environment config (swap img/colors here for other stages) ──
    backdrop: {
      img:        'sierra-nevada-bg.png.png',
      bankGrass:  0x3A7D44,
      bankEarth:  0x4A3728,
      treeColors: [0x1B5E20, 0x2E7D32, 0x388E3C, 0x4A7C32],
      trunkColor: 0x5D4037,
      // Waterfall overlay: x/z in world coords aligned to right cliff in the image.
      // yTop = world-y of waterfall top; height = fall distance in world units.
      wf: { x: 19.5, yTop: 23.5, height: 8.5, width: 1.2, z: -86.0 },
    },
  },
  {
    num:2, name:'UPPER KERN', endMile:66, lanes:6, speed:1.65, obsFreq:0.012, fwFreq:0.12,
    waterColor:0x0EA5E9, bankColor:0x7C2D12,
    obsTypes:['capsized_raft','capsized_raft','boulder','boulder','river_wash'],
    fwType:'raft_train', collA:'fishing_lure', collB:'golden_eagle_feather',
    backdrop: null,
  },
  {
    num:3, name:'LAKE ISABELLA', endMile:99, lanes:5, speed:1.78, obsFreq:0.012, fwFreq:0.10,
    waterColor:0x0891B2, bankColor:0x78716C,
    obsTypes:['drifting_sailboat','drifting_sailboat','boulder','boulder','river_wash'],
    fwType:'pontoon_party', collA:'beach_ball', collB:'cooler',
    backdrop: null,
  },
  {
    num:4, name:'KERN CANYON', endMile:132, lanes:4, speed:1.91, obsFreq:0.013, fwFreq:0.12,
    waterColor:0x0369A1, bankColor:0x1C1917,
    obsTypes:['mine_cart','mine_cart','boulder','boulder','river_wash'],
    fwType:'old_mining_bridge', collA:'gold_nugget', collB:'treasure_chest',
    backdrop: null,
  },
  {
    num:5, name:'BAKERSFIELD', endMile:165, lanes:3, speed:2.00, obsFreq:0.012, fwFreq:0.09,
    waterColor:0x22D3EE, bankColor:0xD97706,
    obsTypes:['shopping_cart','shopping_cart','boulder','boulder','river_wash'],
    fwType:'tube_float_parade', collA:'fox_theater_ticket', collB:'city_seal_medallion',
    backdrop: null,
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
  // Per-blob shading: top blobs bright white, bottom blobs soft cool-grey.
  // Blobs have y in roughly [-1.2, 1.1]; lerp maps that to [underside, sunlit top].
  var cTopCol = new THREE.Color(0xFFFFFF);
  var cBotCol = new THREE.Color(0xCFDCEB);
  var C_Y_MIN = -1.2;
  var C_Y_RNG =  2.3;

  function makeCloud(blobs) {
    var grp = new THREE.Group();
    for (var bi = 0; bi < blobs.length; bi++) {
      var b   = blobs[bi];
      var t   = Math.max(0, Math.min(1, (b.y - C_Y_MIN) / C_Y_RNG));
      var col = cBotCol.clone().lerp(cTopCol, t);
      var m   = new THREE.Mesh(
        new THREE.SphereGeometry(b.r, 7, 5),
        new THREE.MeshLambertMaterial({ color: col })
      );
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
let backdropMesh = null;
let wfGroup     = null;
let wfStrips    = [];
let bankTrees3   = [];   // scrolling tree sprite pool (not riverGroup children)
let bankSegMats3 = [];   // bank segment texture refs for per-frame scroll
let sparkles3         = [];   // Part 2: water sparkle glints (rebuilt each buildWorld)
let kayakTurnY3       = 0;    // Polish 3: lane-change tilt angle (radians)
let kayakWasSpinning3 = false; // Polish 3: spinout-exit guard for smooth rotation handoff
let splashWasJumping3 = false; // Polish 2: previous-frame jump state for takeoff/landing detection
let paddleSplashPrev3 = 0;     // Refinement 2: previous sin value for paddle stroke zero-crossing detection
let wakeChevronTimer3 = 0;     // Refinement 3: frames since last wake chevron spawn
let turnHoldFrames3   = 0;     // frames remaining in post-snap turn hold
let turnDirSign3      = 0;     // sign of active turn: -1 = nose-right, +1 = nose-left
let kayakTurnVel3     = 0;     // angular velocity for spring-damper easing
let curSpd3           = 0;     // last computed scroll speed (shared with updateVisuals3 for droplet physics)

// ── TEXTURE PRELOAD ───────────────────────────────────────────────
// Warms the cache before the player clicks START so buildStageBackdrop
// can apply the texture immediately (no async flash).
var stageTexCache = {};
new THREE.TextureLoader().load(
  'sierra-nevada-bg.png.png',
  function(tex) {
    console.log('[KRR] Preload OK: sierra-nevada-bg.png.png');
    tex.magFilter    = THREE.NearestFilter;
    tex.minFilter    = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate  = true;
    stageTexCache['s1'] = tex;
    // Patch the start-screen backdrop if it was built before this fired
    if (backdropMesh && backdropMesh.material && !backdropMesh.material.map) {
      backdropMesh.material.map = tex;
      backdropMesh.material.needsUpdate = true;
    }
  },
  undefined,
  function(err) {
    console.error('[KRR] Preload FAILED: sierra-nevada-bg.png.png', err);
  }
);
// Stage 1 pixel-art textures (water, banks, tree sprites, riverbed)
var waterStageTex    = null;
var bankStageTex     = null;
var riverbedStageTex = null;
var riverbedMesh     = null;   // module-level ref for late-patching texture after async load
var riverbedTexRef   = null;   // live texture instance on the riverbed mesh; scrolled each frame
var treeTex = [null, null, null, null];  // pine-tall, broadleaf-tall, round-med, bush-short
var treeTexNames = ['tree-pine-tall.png', 'tree-broadleaf-tall.png', 'tree-round-med.png', 'tree-bush-short.png'];

(function preloadStage1Tex() {
  var loader = new THREE.TextureLoader();

  loader.load('water-stage1.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    waterStageTex = tex;
    if (waterMesh && waterMesh.material && !waterMesh.material.map) {
      waterMesh.material.map = tex; waterMesh.material.needsUpdate = true;
    }
  }, undefined, function(e) { console.error('[KRR] water-stage1.png FAILED', e); });

  loader.load('bank-stage1.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    bankStageTex = tex;
  }, undefined, function(e) { console.error('[KRR] bank-stage1.png FAILED', e); });

  loader.load('riverbed-stage1.png', function(tex) {
    console.log('[KRR] Preload OK: riverbed-stage1.png');
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.repeat.set(6, 24);
    tex.needsUpdate = true;
    riverbedStageTex = tex;
    // Late-patch: if buildWorld already ran before this callback fired, apply texture now
    if (riverbedMesh && riverbedMesh.material && !riverbedMesh.material.map) {
      riverbedMesh.material.map = tex;
      riverbedMesh.material.needsUpdate = true;
      riverbedTexRef = tex;
      console.log('[KRR] Riverbed texture late-patched onto existing mesh');
    }
  }, undefined, function(e) { console.error('[KRR] riverbed-stage1.png FAILED', e); });

  for (var ti = 0; ti < treeTexNames.length; ti++) {
    (function(idx) {
      loader.load(treeTexNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        treeTex[idx] = tex;
      }, undefined, function(e) { console.error('[KRR] ' + treeTexNames[idx] + ' FAILED', e); });
    })(ti);
  }
})();

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
  sparkles3.forEach(function(sp) { sp.geometry.dispose(); sp.material.dispose(); scene.remove(sp); });
  sparkles3 = [];
  bankTrees3.forEach(function(bt) { scene.remove(bt.sprite); if (bt.sprite.material) bt.sprite.material.dispose(); });
  bankTrees3 = [];
  bankSegMats3 = [];
  riverbedMesh   = null;
  riverbedTexRef = null;
  if (horizonGrp)   { scene.remove(horizonGrp); horizonGrp = null; }
  if (backdropMesh) { scene.remove(backdropMesh); backdropMesh.geometry.dispose(); backdropMesh = null; }
  if (wfGroup)      { scene.remove(wfGroup); wfGroup = null; wfStrips = []; }

  const stg = STAGES3[stageIdx];
  const rw  = riverWidth();
  riverGroup = new THREE.Group();

  // Ground -- widened to 200 units so grass fills past screen edges on all sides
  var gndMat;
  if (stg.backdrop && bankStageTex) {
    var gt = bankStageTex.clone(); gt.needsUpdate = true;
    gt.wrapS = THREE.RepeatWrapping; gt.wrapT = THREE.RepeatWrapping;
    gt.magFilter = THREE.NearestFilter; gt.minFilter = THREE.NearestFilter;
    gt.generateMipmaps = false;
    gt.repeat.set(40, 40);
    gndMat = new THREE.MeshLambertMaterial({ map: gt });
  } else {
    gndMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  }
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(200, 170), gndMat);
  gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -0.02, -55); gnd.receiveShadow = true;
  gnd.renderOrder = 0;
  riverGroup.add(gnd);

  // Riverbed -- always created for Stage 1 (backdrop stages) so the mesh exists before
  // the async texture load completes. Fallback color 0xC4A46B (sandy tan) shows if the
  // texture hasn't loaded yet; the load callback late-patches it onto this mesh.
  // y=0.0: above the grass ground (y=-0.02), below the water surface (y=0.15).
  // Width rw+2 gives a 1-unit bleed on each side so no grass shows at the water edges.
  // MeshBasicMaterial: fog-immune so the sandy bed stays visible at far distances.
  riverbedTexRef = null;
  if (stg.backdrop) {
    var rbMat = new THREE.MeshBasicMaterial({ color: 0xC4A46B });
    if (riverbedStageTex) {
      riverbedStageTex.offset.set(0, 0);
      rbMat.map = riverbedStageTex;
      rbMat.needsUpdate = true;
      riverbedTexRef = riverbedStageTex;
    }
    var rbMesh = new THREE.Mesh(new THREE.PlaneGeometry(rw + 2, 155, 1, 1), rbMat);
    rbMesh.rotation.x = -Math.PI / 2;
    rbMesh.position.set(0, 0.0, -55);
    rbMesh.renderOrder = 1;
    riverGroup.add(rbMesh);
    riverbedMesh = rbMesh;
    console.log('[KRR] Riverbed mesh | y=' + rbMesh.position.y + ' renderOrder=' + rbMesh.renderOrder + ' texture=' + (riverbedStageTex ? 'applied' : 'pending'));
  }

  // River surface
  const wMat = new THREE.MeshPhongMaterial({ color: stg.waterColor, shininess: 14, specular: 0x111a22 });
  if (stg.backdrop && waterStageTex) {
    var wt = waterStageTex.clone(); wt.needsUpdate = true;
    wt.wrapS = THREE.RepeatWrapping; wt.wrapT = THREE.RepeatWrapping;
    wt.magFilter = THREE.NearestFilter; wt.minFilter = THREE.NearestFilter;
    wt.generateMipmaps = false;
    // Tile: ~2 repeats wide, ~12 repeats along the 155-unit length
    wt.repeat.set(2, 12);
    wMat.map = wt; wMat.needsUpdate = true;
  }
  // Transparent so the riverbed shows through.
  // y=0.15: a 0.15-unit gap above the riverbed (y=0.0) eliminates z-fighting at all
  // camera distances. The gap is imperceptible at the 15-degree chase-camera angle.
  // depthWrite:false: the transparent water does not write depth, so it cannot occlude
  // the opaque riverbed below it. Opaque obstacles/player (renderOrder 0) write depth
  // and appear above the water (renderOrder 2) without any special ordering needed.
  wMat.transparent = true;
  wMat.opacity     = WATER_OPACITY;
  wMat.depthWrite  = false;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(rw, 155, 12, 32), wMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.15, -55); water.receiveShadow = true;
  water.renderOrder = 2;
  riverGroup.add(water);
  waterMesh = water;
  console.log('[KRR] Water mesh   | y=' + water.position.y + ' renderOrder=' + water.renderOrder + ' (water above riverbed: ' + (water.renderOrder > (riverbedMesh ? riverbedMesh.renderOrder : -1)) + ')');

  // Banks -- segmented curved geometry.
  // Inner edge of every segment stays exactly at side * rw/2 (flush with play area).
  // Outer edge follows a slow sine so the bank appears to meander.
  // Play lanes, water surface, lane dividers, spawns, and collision are all untouched.
  const bkColor   = stg.backdrop ? stg.backdrop.bankGrass : stg.bankColor;
  const bkBaseMat = new THREE.MeshLambertMaterial({ color: bkColor });
  // BANK_AMP raised to 2.8 for more organic outer-edge meander (inner edge invariant unchanged)
  const BANK_W0   = 5.0;
  const BANK_AMP  = 2.8;
  const BANK_FREQ = 0.048;
  const BK_SEG_Z  = 5.5;
  const BK_SEG_N  = 18;
  const BK_Z0     = -70.0;
  for (const bkSide of [-1, 1]) {
    const bkPhase = bkSide === 1 ? 0 : Math.PI * 0.55;
    for (let bkSi = 0; bkSi < BK_SEG_N; bkSi++) {
      const bkZCtr = BK_Z0 + bkSi * BK_SEG_Z + BK_SEG_Z * 0.5;
      let   segW   = BANK_W0 + BANK_AMP * Math.sin(bkZCtr * BANK_FREQ + bkPhase);
      if (segW < 2.2) segW = 2.2;
      // Inner edge invariant: bkXCtr = side*(rw/2 + segW/2) keeps edge exactly at side*rw/2
      const bkXCtr = bkSide * (rw / 2 + segW / 2);
      var bkSegMat;
      if (stg.backdrop && bankStageTex) {
        var bkTex = bankStageTex.clone(); bkTex.needsUpdate = true;
        bkTex.wrapS = THREE.RepeatWrapping; bkTex.wrapT = THREE.RepeatWrapping;
        bkTex.magFilter = THREE.NearestFilter; bkTex.minFilter = THREE.NearestFilter;
        bkTex.generateMipmaps = false;
        bkTex.repeat.set(Math.ceil(segW / 2), 1);
        bkSegMat = new THREE.MeshLambertMaterial({ map: bkTex });
        bankSegMats3.push(bkTex);  // store ref for per-frame scroll
      } else {
        bkSegMat = bkBaseMat.clone();
      }
      const bkSeg  = new THREE.Mesh(
        new THREE.BoxGeometry(segW, 0.60, BK_SEG_Z + 0.25),
        bkSegMat
      );
      bkSeg.position.set(bkXCtr, 0.30, bkZCtr);
      bkSeg.castShadow = true; bkSeg.receiveShadow = true;
      riverGroup.add(bkSeg);
    }
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
  addShoreline3(riverGroup, rw, stg);
  scene.add(riverGroup);
  if (stg.backdrop) { initBankTrees3(rw, stg.backdrop); }

  // Part 1: Current flow streaks -- z-aligned lines above the water surface (y=0.16).
  // Each streak is a short segment at a random x position with a slight downstream drift,
  // giving the surface a sense of flowing current rather than static horizontal bands.
  // renderOrder=3 places them above water (renderOrder=2). depthWrite:false avoids artifacts.
  var flWc = new THREE.Color(stg.waterColor).lerp(new THREE.Color(0xFFFFFF), 0.42);
  var flBaseMat = new THREE.LineBasicMaterial({ color: flWc, transparent: true, opacity: 0.19, depthWrite: false });
  for (var fli = 0; fli < 36; fli++) {
    var flX   = -rw / 2 + 0.5 + Math.random() * (rw - 1.0);
    var flLen = 1.0 + Math.random() * 4.2;
    var flDrift = (Math.random() - 0.5) * 0.36;
    var flLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(flX,           0.16, -flLen * 0.5),
        new THREE.Vector3(flX + flDrift, 0.16,  flLen * 0.5)
      ]),
      flBaseMat.clone()
    );
    flLine.renderOrder = 3;
    flLine.position.z = SPAWN_Z + fli * (Math.abs(SPAWN_Z) / 36);
    scene.add(flLine);
    flowLines3d.push(flLine);
  }

  // Part 2: Water surface sparkle glints -- small bright quads scattered across the water.
  // Each has a unique shimmer phase so they twinkle independently. Scrolled in update3()
  // like the flow lines. renderOrder=3, depthWrite:false, max opacity ~0.30 for subtlety.
  var spkBaseMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false });
  for (var spkI = 0; spkI < 28; spkI++) {
    var spkX = -rw / 2 + 0.5 + Math.random() * (rw - 1.0);
    var spkZ = SPAWN_Z + Math.random() * (Math.abs(SPAWN_Z) + 8);
    var spkMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), spkBaseMat.clone());
    spkMesh.rotation.x = -Math.PI / 2;
    spkMesh.position.set(spkX, 0.16, spkZ);
    spkMesh.renderOrder = 3;
    spkMesh.userData.phase = Math.random() * Math.PI * 2;
    spkMesh.userData.rate  = 0.035 + Math.random() * 0.055;
    spkMesh.userData.peak  = 0.12  + Math.random() * 0.18;
    scene.add(spkMesh);
    sparkles3.push(spkMesh);
  }

  // Use the backdrop image for Stage 1; fall back to procedural cone mountains otherwise
  if (stg.backdrop) {
    buildStageBackdrop(stg);
  } else {
    horizonGrp = buildHorizonArt(stg);
    scene.add(horizonGrp);
  }
}

function addBankDecor(group, rw, stg) {
  var bd = stg.backdrop;

  // Tree z-spread: more positions for Stage 1, fewer for others
  var zPos = bd
    ? [-10, -18, -26, -34, -42, -50, -58, -14, -22, -30, -38, -46, -54, -62]
    : [-15, -28, -42, -55, -33, -18, -50];

  var trunkColor = bd ? bd.trunkColor : 0x78350F;
  var trunkMat   = new THREE.MeshLambertMaterial({ color: trunkColor });

  for (var i = 0; i < zPos.length; i++) {
    var side  = i % 2 === 0 ? -1 : 1;
    var xOff  = (i % 4) * 1.55;
    var xBase = side * (rw / 2 + 1.2 + xOff);
    var z     = zPos[i];

    if (stg.num === 4) {
      // Kern Canyon: dark rock pillars
      var rock = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 4.0, 0.75),
        new THREE.MeshLambertMaterial({ color: 0x292524 })
      );
      rock.position.set(xBase, 2.0, z); rock.castShadow = true; group.add(rock);

    } else if (bd) {
      // Tree sprites are now owned by initBankTrees3 (scrolling pool).

    } else {
      // Generic single-cone tree for stages 2-3 and 5
      var foliageCol = stg.num <= 2 ? 0x166534 : stg.num === 3 ? 0xD97706 : 0x44403C;
      var trk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.20, 1.1, 5), trunkMat);
      trk2.position.set(xBase, 0.55, z); group.add(trk2);
      var can = new THREE.Mesh(
        new THREE.ConeGeometry(0.80, 1.7, 6),
        new THREE.MeshLambertMaterial({ color: foliageCol })
      );
      can.position.set(xBase, 1.95, z); can.castShadow = true; group.add(can);
    }
  }
}

// ── SHORELINE BAND (Polish 4) ─────────────────────────────────────
// Foam strip + scattered rocks at each bank-water boundary inside riverGroup.
// Foam: transparent strip just inside the water edge, renderOrder=3.
// Rocks: small opaque BoxGeometry pebbles at the shoreline, y=0.16 (above water y=0.15).
// Nothing extends more than 0.22 units into the water: no collision impact.
function addShoreline3(rg, rw, stg) {
  for (var shSide = -1; shSide <= 1; shSide += 2) {
    var shX = shSide * rw / 2;

    // Foam/wet-edge strip: 0.28-wide translucent band inside the water at the shore
    var foamMat = new THREE.MeshBasicMaterial({ color: 0xCCEEFF, transparent: true, opacity: 0.20, depthWrite: false });
    var foamMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 150), foamMat);
    foamMesh.rotation.x = -Math.PI / 2;
    foamMesh.position.set(shX - shSide * 0.14, 0.155, -55);
    foamMesh.renderOrder = 3;
    rg.add(foamMesh);

    // Rocks scattered along the shoreline: 20 per side, random size + orientation
    for (var rki = 0; rki < 20; rki++) {
      var rkZ  = -65 + rki * 3.6 + (Math.random() - 0.5) * 2.8;
      var rkX  = shX - shSide * (0.04 + Math.random() * 0.18);
      var rkS  = 0.05 + Math.random() * 0.08;
      var rkV  = Math.floor(Math.random() * 32);
      var rkC  = 0x7A6955 + rkV * 0x010101;
      var rkMt = new THREE.MeshLambertMaterial({ color: rkC });
      var rkG  = new THREE.BoxGeometry(rkS, rkS * 0.55, rkS * (0.75 + Math.random() * 0.5));
      var rkM  = new THREE.Mesh(rkG, rkMt);
      rkM.position.set(rkX, 0.16, rkZ);
      rkM.rotation.y = Math.random() * Math.PI;
      rg.add(rkM);
    }
  }
}

// ── SCROLLING TREE POOL ───────────────────────────────────────────
// Trees for backdrop stages live outside riverGroup so they can scroll
// toward the camera like obstacles/flow-lines and recycle seamlessly.
function makeBankTreeHeight(variety) {
  // Tall varieties about 5-6 units, shorter varieties 3-4 units
  var base = (variety <= 1) ? 5.5 : (variety === 2 ? 4.5 : 3.2);
  return base * (0.78 + Math.random() * 0.44);
}

function makeBankTreeSprite(variety, h) {
  var tex = treeTex[variety];
  var mat;
  if (tex) {
    mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
  } else {
    var fallbackColors = [0x1B5E20, 0x2E7D32, 0x388E3C, 0x4A7C32];
    mat = new THREE.SpriteMaterial({ color: fallbackColors[variety], transparent: true, opacity: 0.85 });
  }
  var spr = new THREE.Sprite(mat);
  spr.center.set(0.5, 0);
  spr.scale.set(h * 0.72, h, 1);
  return spr;
}

function initBankTrees3(rw, bd) {
  var TREE_COUNT = 32;
  for (var ti = 0; ti < TREE_COUNT; ti++) {
    var side    = ti % 2 === 0 ? -1 : 1;
    var variety = Math.floor(Math.random() * 4);
    var xOff    = Math.floor(Math.random() * 4) * 1.8;
    var xBase   = side * (rw / 2 + 1.4 + xOff);
    // Spread evenly across the full visible river length at start
    var zInit   = SPAWN_Z + (ti / TREE_COUNT) * (Math.abs(SPAWN_Z) + 12);
    var h       = makeBankTreeHeight(variety);
    var spr     = makeBankTreeSprite(variety, h);
    spr.position.set(xBase, 0.30, zInit);
    scene.add(spr);
    bankTrees3.push({ sprite: spr, side: side, z: zInit });
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

// ── STAGE BACKDROP + WATERFALL ────────────────────────────────────
// Call this instead of buildHorizonArt when stg.backdrop is set.
// Image plane: 1536x1024 source (3:2). World plane 78x52, center y=26
// so the bottom of the image aligns with ground (y=0) and the top
// reaches y=52 well above the play area. fog:false keeps pixel art crisp.
// To use for a future stage: set stg.backdrop.img + colors in STAGES3.
function buildStageBackdrop(stg) {
  var bd = stg.backdrop;
  if (!bd) return;

  // Backdrop plane - start with sky-blue fallback so any load failure is invisible
  var bdMat = new THREE.MeshBasicMaterial({ color: 0x87CEEB, fog: false });
  backdropMesh = new THREE.Mesh(new THREE.PlaneGeometry(78, 52), bdMat);
  backdropMesh.position.set(0, 26, -88);
  scene.add(backdropMesh);

  // Capture current mesh so the async callback patches the RIGHT instance
  // even if buildWorld() is called again before the load finishes.
  var capMesh = backdropMesh;

  function applyBackdropTex(tex) {
    tex.magFilter    = THREE.NearestFilter;
    tex.minFilter    = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate  = true;
    stageTexCache['s1'] = tex;
    if (capMesh.material) {
      capMesh.material.map   = tex;
      capMesh.material.color.set(0xFFFFFF);
      capMesh.material.needsUpdate = true;
    }
  }

  if (stageTexCache['s1']) {
    // Preload already finished - apply immediately, no async flash
    applyBackdropTex(stageTexCache['s1']);
  } else {
    // Preload not done yet (or failed) - load fresh with error visibility
    new THREE.TextureLoader().load(
      bd.img,
      function(tex) {
        console.log('[KRR] Backdrop texture loaded: ' + bd.img);
        applyBackdropTex(tex);
      },
      undefined,
      function(err) {
        console.error('[KRR] Backdrop texture FAILED to load:', bd.img, err);
      }
    );
  }

  // Animated waterfall strips
  var wf  = bd.wf;
  wfGroup  = new THREE.Group();
  wfStrips = [];
  var N        = 10;
  var stripH   = wf.height / N;
  var wfStripMat = new THREE.MeshBasicMaterial({
    color: 0xC8E8F8, transparent: true, opacity: 0.72, fog: false, depthWrite: false
  });
  for (var wi = 0; wi < N; wi++) {
    var strip = new THREE.Mesh(
      new THREE.PlaneGeometry(wf.width, stripH * 0.60),
      wfStripMat.clone()
    );
    strip.position.set(wf.x, wf.yTop - wi * stripH, wf.z);
    wfGroup.add(strip);
    wfStrips.push(strip);
  }

  // Mist puffs at base of waterfall
  var mistMat = new THREE.MeshBasicMaterial({
    color: 0xE0F4FF, transparent: true, opacity: 0.30, fog: false, depthWrite: false
  });
  for (var mi = 0; mi < 3; mi++) {
    var mist = new THREE.Mesh(
      new THREE.SphereGeometry(0.65 + mi * 0.22, 6, 4),
      mistMat.clone()
    );
    mist.position.set(
      wf.x + (mi - 1) * 0.38,
      wf.yTop - wf.height + 0.45 + mi * 0.18,
      wf.z + 0.12
    );
    wfGroup.add(mist);
  }

  scene.add(wfGroup);
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

// ── WATER LIFE: KAYAK WAKE + OBSTACLE RIPPLES (Part 3) ────────────
// Created once at module level like playerGroup. Positioned each frame in updateVisuals3.
// renderOrder=3 places them above the water surface (renderOrder=2).
// depthWrite:false on all so they do not compete with each other in the depth buffer.

const wakeGroup3 = new THREE.Group();
scene.add(wakeGroup3);

// Animated V-wake: 3 segments per arm (root/mid/tail) with decreasing opacity.
// Vertex x-positions are updated every frame in updateVisuals3 for undulation.
// DynamicDrawUsage hints the GPU driver that these buffers update every frame.
const wakeSegs3 = [];
function initWakeSeg3(sign, t0, t1, baseOp) {
  var pos  = new Float32Array([
    sign * (0.12 + t0 * 1.42), 0, 0.40 + t0 * 2.10,
    sign * (0.12 + t1 * 1.42), 0, 0.40 + t1 * 2.10
  ]);
  var attr = new THREE.BufferAttribute(pos, 3);
  attr.usage = THREE.DynamicDrawUsage;
  var geo  = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  var mat  = new THREE.LineBasicMaterial({ color: 0xC4EEFF, transparent: true, opacity: 0, depthWrite: false });
  var ln   = new THREE.Line(geo, mat);
  ln.renderOrder = 3;
  wakeGroup3.add(ln);
  wakeSegs3.push({ ln: ln, attr: attr, sign: sign, t0: t0, t1: t1, baseOp: baseOp });
}
// Left arm: root (strong) -> mid -> tail (faint)
initWakeSeg3(-1, 0,    0.40, 0.32);
initWakeSeg3(-1, 0.40, 0.72, 0.20);
initWakeSeg3(-1, 0.72, 1.00, 0.10);
// Right arm
initWakeSeg3( 1, 0,    0.40, 0.32);
initWakeSeg3( 1, 0.40, 0.72, 0.20);
initWakeSeg3( 1, 0.72, 1.00, 0.10);

// Bow ripple ring: at the front of the kayak (-z = upstream / into the current)
const bowRipple3 = new THREE.Mesh(
  new THREE.RingGeometry(0.20, 0.32, 14),
  new THREE.MeshBasicMaterial({ color: 0xC4EEFF, transparent: true, opacity: 0, depthWrite: false })
);
bowRipple3.rotation.x = -Math.PI / 2;
bowRipple3.position.set(0, 0, -1.1);
bowRipple3.renderOrder = 3;
wakeGroup3.add(bowRipple3);
const kayakWake3 = { group: wakeGroup3, bow: bowRipple3 };

// Obstacle upstream parting-ripple pool: 10 reusable flat rings.
// Each frame the nearest active obstacles claim rings from the front of the pool.
const obsRipplePool3 = [];
for (var ripI = 0; ripI < 10; ripI++) {
  var ripMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.50, 12),
    new THREE.MeshBasicMaterial({ color: 0xC4EEFF, transparent: true, opacity: 0, depthWrite: false })
  );
  ripMesh.rotation.x = -Math.PI / 2;
  ripMesh.position.set(0, 0.16, -9999);
  ripMesh.renderOrder = 3;
  scene.add(ripMesh);
  obsRipplePool3.push(ripMesh);
}

// Splash pool -- 4 reusable expanding ring meshes for paddle and jump splashes.
// ROOT CAUSE FIX: old rings were RingGeometry(0.05,0.18) at scale 0.25 = 0.09 world diameter = ~5px. Invisible.
// New: outer radius 0.35, bright white, y=0.22 (above water wave peaks), renderOrder=4.
const splashPool3 = [];
for (var spI3 = 0; spI3 < 4; spI3++) {
  var spMesh3 = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.35, 12),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false })
  );
  spMesh3.rotation.x = -Math.PI / 2;
  spMesh3.position.set(0, 0.22, 0);
  spMesh3.renderOrder = 4;
  scene.add(spMesh3);
  splashPool3.push({ mesh: spMesh3, active: false, frame: 0, dur: 20, maxScale: 1.0 });
}

// Moving wake chevrons -- pool of 10 reusable V-shape line groups.
// 3-point arms (tip/mid/end) with DynamicDrawUsage for organic spread variation + sway per chevron.
// Spawn assigns random spread (0.60-1.00) and zTail (0.90-1.30) so no two look identical.
const wakeChevrons3 = [];
for (var wcI = 0; wcI < 10; wcI++) {
  var wcGrp = new THREE.Group();

  var wcPosL = new Float32Array(9);
  var wcAttrL = new THREE.BufferAttribute(wcPosL, 3);
  wcAttrL.usage = THREE.DynamicDrawUsage;
  var wcGeoL = new THREE.BufferGeometry();
  wcGeoL.setAttribute('position', wcAttrL);
  var wcMatL = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false });
  var wcLineL = new THREE.Line(wcGeoL, wcMatL);
  wcLineL.renderOrder = 3;
  wcGrp.add(wcLineL);

  var wcPosR = new Float32Array(9);
  var wcAttrR = new THREE.BufferAttribute(wcPosR, 3);
  wcAttrR.usage = THREE.DynamicDrawUsage;
  var wcGeoR = new THREE.BufferGeometry();
  wcGeoR.setAttribute('position', wcAttrR);
  var wcMatR = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false });
  var wcLineR = new THREE.Line(wcGeoR, wcMatR);
  wcLineR.renderOrder = 3;
  wcGrp.add(wcLineR);

  wcGrp.position.set(0, 0.16, -9999);
  scene.add(wcGrp);
  wakeChevrons3.push({
    grp: wcGrp, attrL: wcAttrL, attrR: wcAttrR,
    active: false, life: 0, maxLife: 45,
    worldX: 0, worldZ: 0,
    spread: 0.85, zTail: 1.10, swayPhase: 0
  });
}

// Water droplet pool -- 60 reusable tiny cubes for fine-spray arcs from paddle strokes and landings.
// Physics: gravity DROPLET_GRAV applied to vy each frame; world-scroll at curSpd3 each frame.
const DROPLET_GRAV = 0.016;
const dropletPool3 = [];
for (var dpI3 = 0; dpI3 < 60; dpI3++) {
  var dpMesh3 = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.10, 0.10),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false })
  );
  dpMesh3.renderOrder = 5;
  dpMesh3.position.set(0, -9999, 0);
  scene.add(dpMesh3);
  dropletPool3.push({ mesh: dpMesh3, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0 });
}

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

// Polish 2: Claim an idle pool slot and start a splash ring animation.
function activateSplash3(x, z, maxScale, dur) {
  for (var asi = 0; asi < splashPool3.length; asi++) {
    if (!splashPool3[asi].active) {
      var sp3 = splashPool3[asi];
      sp3.active = true; sp3.frame = 0;
      sp3.dur = dur; sp3.maxScale = maxScale;
      sp3.mesh.position.set(x, 0.22, z);
      sp3.mesh.scale.set(0.40, 0.40, 1);
      break;
    }
  }
}

// Spawn count water droplets with arcing physics from world position (cx, 0, cz).
// vScale: 1.0 = paddle stroke, 1.4 = jump landing burst.
function activateDroplets3(cx, cz, count, vScale) {
  for (var dpAi = 0; dpAi < count; dpAi++) {
    for (var dpFi = 0; dpFi < dropletPool3.length; dpFi++) {
      if (!dropletPool3[dpFi].active) {
        var dp3 = dropletPool3[dpFi];
        dp3.active  = true;
        dp3.life    = 0;
        dp3.maxLife = 16 + Math.floor(Math.random() * 10);
        dp3.x  = cx + (Math.random() - 0.5) * 0.50;
        dp3.y  = 0.30;
        dp3.z  = cz + (Math.random() - 0.5) * 0.40;
        dp3.vx = (Math.random() - 0.5) * 0.13 * vScale;
        dp3.vy = (0.04 + Math.random() * 0.09) * vScale;
        dp3.vz = (Math.random() - 0.5) * 0.11 * vScale;
        dp3.mesh.material.opacity = 0.75;
        break;
      }
    }
  }
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
  curSpd3 = spd;

  for (const o of obstacles3) {
    o.z += spd; o.mesh.position.z = o.z;
  }
  obstacles3 = obstacles3.filter(o => {
    if (o.z > DESPAWN_Z) { disposeMesh(o.mesh); scene.remove(o.mesh); return false; }
    return true;
  });

  for (const c of collectibles3) {
    c.z += spd * COLL_DRIFT; c.mesh.position.z = c.z;
    c.mesh.position.y = c.baseY + Math.sin(frameN * 0.11 + c.lane * 1.3) * 0.14;
    c.mesh.rotation.y += 0.028;  // gentle rotation
  }
  collectibles3 = collectibles3.filter(c => {
    if (c.collected || c.z > DESPAWN_Z) { disposeMesh(c.mesh); scene.remove(c.mesh); return false; }
    return true;
  });

  // Scroll flow lines (Part 1: current streaks)
  for (const fl of flowLines3d) {
    fl.position.z += spd;
    if (fl.position.z > 6) fl.position.z = SPAWN_Z + 4;
  }

  // Scroll sparkles at the same rate (Part 2: glints travel with the current)
  for (var spkSi = 0; spkSi < sparkles3.length; spkSi++) {
    sparkles3[spkSi].position.z += spd;
    if (sparkles3[spkSi].position.z > 6) sparkles3[spkSi].position.z = SPAWN_Z + 4;
  }

  // Refinement 3: Wake chevron spawn every 6 frames + scroll all active chevrons.
  // Each chevron gets random spread/zTail/swayPhase for organic V-shape variation.
  if (!player3.isJumping) {
    wakeChevronTimer3++;
    if (wakeChevronTimer3 >= 6) {
      wakeChevronTimer3 = 0;
      for (var wcSi = 0; wcSi < wakeChevrons3.length; wcSi++) {
        if (!wakeChevrons3[wcSi].active) {
          var wcNew = wakeChevrons3[wcSi];
          wcNew.active    = true;
          wcNew.life      = 0;
          wcNew.maxLife   = 45;
          wcNew.worldX    = player3.x;
          wcNew.worldZ    = 0.65;
          wcNew.spread    = 0.60 + Math.random() * 0.40;
          wcNew.zTail     = 0.90 + Math.random() * 0.40;
          wcNew.swayPhase = Math.random() * Math.PI * 2;
          break;
        }
      }
    }
  }
  for (var wcUi = 0; wcUi < wakeChevrons3.length; wcUi++) {
    var wcE = wakeChevrons3[wcUi];
    if (!wcE.active) continue;
    wcE.life++;
    wcE.worldZ += spd * 0.5;
    wcE.grp.position.set(wcE.worldX, 0.16, wcE.worldZ);
    if (wcE.life > wcE.maxLife || wcE.worldZ > DESPAWN_Z) {
      wcE.active = false;
    }
  }

  // Scroll bank tree sprites; recycle past-camera trees with new random params
  for (var bti = 0; bti < bankTrees3.length; bti++) {
    var bt3 = bankTrees3[bti];
    bt3.z += spd;
    bt3.sprite.position.z = bt3.z;
    if (bt3.z > DESPAWN_Z + 2) {
      bt3.z = SPAWN_Z - Math.random() * 8;
      var v3    = Math.floor(Math.random() * 4);
      var rw3   = riverWidth();
      var xOff3 = Math.floor(Math.random() * 4) * 1.8;
      bt3.sprite.position.x = bt3.side * (rw3 / 2 + 1.4 + xOff3);
      bt3.sprite.position.z = bt3.z;
      var h3 = makeBankTreeHeight(v3);
      bt3.sprite.scale.set(h3 * 0.72, h3, 1);
      if (treeTex[v3]) {
        bt3.sprite.material.map = treeTex[v3];
        bt3.sprite.material.needsUpdate = true;
      }
    }
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

  // Spinout + lane-change tilt (share rotation.y, handled in three phases).
  // Phase 1: active spinout -- accumulate full rotation, suppress turn.
  // Phase 2: spinout-exit decay -- preserve the original decay feel before handing off.
  // Phase 3: normal paddling -- tilt kayak 45 deg toward target lane, snap back when settled.
  if (player3.spinoutFrames > 0) {
    playerGroup.rotation.y += 0.18;
    kayakWasSpinning3 = true;
    kayakTurnY3 = 0; kayakTurnVel3 = 0;
  } else if (kayakWasSpinning3) {
    playerGroup.rotation.y *= 0.75;
    if (Math.abs(playerGroup.rotation.y) < 0.01) {
      playerGroup.rotation.y = 0;
      kayakWasSpinning3 = false;
    }
  } else {
    var lcTarget3 = laneXPos(player3.targetLane);
    var lcDx3     = lcTarget3 - player3.x;
    // Capture direction and reset hold timer whenever actively moving toward target
    if (Math.abs(lcDx3) > 0.02 && !player3.isJumping) {
      turnDirSign3    = lcDx3 > 0 ? -1 : 1;
      turnHoldFrames3 = 22;
    }
    // Count down hold timer once settled (snapped within 0.02)
    if (Math.abs(lcDx3) <= 0.02 && turnHoldFrames3 > 0) turnHoldFrames3--;
    var lcWant3 = ((Math.abs(lcDx3) > 0.02 || turnHoldFrames3 > 0) && !player3.isJumping)
      ? turnDirSign3 * 0.70
      : 0;
    var turnError3 = lcWant3 - kayakTurnY3;
    kayakTurnVel3 += turnError3 * 0.06;
    kayakTurnVel3 *= 0.80;
    kayakTurnY3   += kayakTurnVel3;
    if (Math.abs(kayakTurnY3) < 0.008) { kayakTurnY3 = 0; kayakTurnVel3 = 0; }
    playerGroup.rotation.y = kayakTurnY3;
  }

  // Paddle animation: Z tilt + subtle X dive
  paddleGroup.rotation.z = Math.sin(frameN * 0.060) * 0.42;
  paddleGroup.rotation.x = Math.cos(frameN * 0.060) * 0.12;

  // Refinement 2: Alternating paddle splashes at blade water entry.
  // rotation.z > 0 (sin positive) = left blade (-x) goes down toward water.
  // Splash spawns at zero-crossing: left when sin crosses 0 going positive; right going negative.
  var pSin3 = Math.sin(frameN * 0.060);
  if (!player3.isJumping && gameState3 === 'playing') {
    if (paddleSplashPrev3 <= 0 && pSin3 > 0) {
      activateSplash3(player3.x - 0.97, 0, 1.2, 16);
      activateDroplets3(player3.x - 0.97, 0, 10, 1.0);
    } else if (paddleSplashPrev3 >= 0 && pSin3 < 0) {
      activateSplash3(player3.x + 0.97, 0, 1.2, 16);
      activateDroplets3(player3.x + 0.97, 0, 10, 1.0);
    }
  }
  paddleSplashPrev3 = pSin3;

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

  // Animate water surface -- three overlapping sine waves traveling downstream (+world z).
  // PlaneGeometry is rotated -PI/2 on X, so local Y maps to world Z.
  // Wave sin(t - localY * k) travels in +localY = +worldZ = downstream direction.
  // wt multiplier 0.013 is roughly 1/3 of the original 0.038 for calm, gently flowing look.
  // Third wave adds a cross-current ripple at a different spatial angle for organic depth.
  if (waterMesh && waterMesh.geometry) {
    var wPos = waterMesh.geometry.attributes.position;
    // Slowed to 0.008 base rate (was 0.013) for calmer motion
    var wt   = frameN * 0.008;
    for (var wvi = 0; wvi < wPos.count; wvi++) {
      var wly = wPos.getY(wvi);
      var wlx = wPos.getX(wvi);
      // Amplitudes halved: 0.045 / 0.018 / 0.010 (was 0.11 / 0.048 / 0.028)
      wPos.setZ(wvi,
        Math.sin(wt        - wly * 0.15 + wlx * 0.20) * 0.045 +
        Math.sin(wt * 1.65 - wly * 0.27)               * 0.018 +
        Math.sin(wt * 0.45 + wly * 0.09 - wlx * 0.26) * 0.010
      );
    }
    wPos.needsUpdate = true;
  }

  // Scroll water texture downstream -- slowed to 0.0008 (was 0.0022) for subtle flow
  if (waterMesh && waterMesh.material && waterMesh.material.map) {
    waterMesh.material.map.offset.y -= 0.0008;
  }

  // Scroll riverbed texture at the same rate so it visually matches the water
  if (riverbedTexRef) {
    riverbedTexRef.offset.y -= 0.0008;
  }

  // Scroll bank segment textures to match the river-forward feel (Part 4)
  for (var bsi = 0; bsi < bankSegMats3.length; bsi++) {
    bankSegMats3[bsi].offset.y -= 0.0005;
  }

  // Drift clouds slowly downstream; loop back to the far end when they pass the threshold.
  for (var ci = 0; ci < clouds3.length; ci++) {
    clouds3[ci].position.z += clouds3[ci].userData.spd;
    if (clouds3[ci].position.z > -38) clouds3[ci].position.z = -96;
  }

  // Scroll waterfall strips downward; each strip loops to the top when it exits the base.
  if (wfStrips.length > 0) {
    var wfBd = STAGES3[stageIdx].backdrop;
    if (wfBd && wfBd.wf) {
      var wfCfg     = wfBd.wf;
      var wfSpacing = wfCfg.height / wfStrips.length;
      for (var wsi = 0; wsi < wfStrips.length; wsi++) {
        wfStrips[wsi].position.y -= 0.055;
        if (wfStrips[wsi].position.y < wfCfg.yTop - wfCfg.height - wfSpacing) {
          wfStrips[wsi].position.y = wfCfg.yTop;
        }
      }
    }
  }

  // Part 2: Sparkle shimmer -- each glint pulses on its own sine phase
  for (var spkVi = 0; spkVi < sparkles3.length; spkVi++) {
    var sp = sparkles3[spkVi];
    var spA = Math.max(0, Math.sin(frameN * sp.userData.rate + sp.userData.phase));
    sp.material.opacity = spA * sp.userData.peak;
  }

  // Polish 1: Animated V-wake -- per-vertex x-offset creates lateral undulation.
  // Wave amplitude grows toward the tail (t), travels downstream via time phase.
  kayakWake3.group.position.set(player3.x, 0.16, 0);
  var wkT3 = frameN * 0.09;
  for (var wsi3 = 0; wsi3 < wakeSegs3.length; wsi3++) {
    var wseg = wakeSegs3[wsi3];
    for (var wvi3 = 0; wvi3 < 2; wvi3++) {
      var wt3  = wvi3 === 0 ? wseg.t0 : wseg.t1;
      var bx3  = wseg.sign * (0.12 + wt3 * 1.42);
      var bz3  = 0.40 + wt3 * 2.10;
      var xW3  = Math.sin(wkT3 - bz3 * 1.6) * 0.15 * wt3;
      wseg.attr.setXYZ(wvi3, bx3 + xW3, 0, bz3);
    }
    wseg.attr.needsUpdate = true;
    wseg.ln.material.opacity = player3.isJumping ? 0 : wseg.baseOp;
  }
  kayakWake3.bow.material.opacity = player3.isJumping ? 0 : Math.max(0, 0.18 + Math.sin(frameN * 0.16) * 0.10);

  // Polish 2: Jump splash -- detect takeoff/landing, activate pool rings
  var jumpingNow3 = player3.isJumping;
  if (jumpingNow3 && !splashWasJumping3) {
    activateSplash3(player3.x, 0, 2.2, 22);
  }
  if (!jumpingNow3 && splashWasJumping3) {
    activateSplash3(player3.x, 0, 2.5, 28);
    activateSplash3(player3.x, 0, 4.0, 36);
    activateDroplets3(player3.x, 0, 18, 1.4);
  }
  splashWasJumping3 = jumpingNow3;
  // Animate active splash rings (expand + fade)
  for (var spAi = 0; spAi < splashPool3.length; spAi++) {
    var spE = splashPool3[spAi];
    if (!spE.active) { spE.mesh.material.opacity = 0; continue; }
    spE.frame++;
    if (spE.frame > spE.dur) { spE.active = false; spE.mesh.material.opacity = 0; continue; }
    var spT = spE.frame / spE.dur;
    spE.mesh.material.opacity = (1 - spT) * 0.88;
    var spSc = 0.40 + spT * spE.maxScale;
    spE.mesh.scale.set(spSc, spSc, 1);
  }

  // Water droplet arc physics -- gravity + world-scroll each frame, fade out on descent.
  for (var dpVi = 0; dpVi < dropletPool3.length; dpVi++) {
    var dpE = dropletPool3[dpVi];
    if (!dpE.active) { dpE.mesh.material.opacity = 0; continue; }
    dpE.life++;
    dpE.vy -= DROPLET_GRAV;
    dpE.x  += dpE.vx;
    dpE.y  += dpE.vy;
    dpE.z  += curSpd3;
    dpE.mesh.position.set(dpE.x, Math.max(0.14, dpE.y), dpE.z);
    if (dpE.y < 0.14 || dpE.life > dpE.maxLife) {
      dpE.active = false;
      dpE.mesh.material.opacity = 0;
    } else {
      var dpFade = 1 - dpE.life / dpE.maxLife;
      dpE.mesh.material.opacity = dpFade * 0.80;
    }
  }

  // Part 3b: Obstacle upstream parting ripples (pool of 10 reusable rings).
  // Rings are assigned each frame to the first N visible active obstacles.
  // Upstream side = negative z from the obstacle (water flows from -z toward +z).
  var ripIdx = 0;
  for (var ri3 = 0; ri3 < obstacles3.length; ri3++) {
    if (ripIdx >= obsRipplePool3.length) break;
    var obs3 = obstacles3[ri3];
    if (!obs3.mesh) continue;
    if (obs3.z < SPAWN_Z + 5 || obs3.z > DESPAWN_Z - 1) continue;
    var ripR = obsRipplePool3[ripIdx++];
    var ripScale = 0.88 + Math.sin(frameN * 0.07 + ri3 * 2.1) * 0.12;
    ripR.position.set(obs3.mesh.position.x, 0.16, obs3.mesh.position.z - 0.65);
    ripR.scale.set(ripScale, ripScale, 1);
    ripR.material.opacity = 0.15 + Math.sin(frameN * 0.11 + ri3 * 1.8) * 0.07;
  }
  // Hide all unused pool slots this frame
  for (; ripIdx < obsRipplePool3.length; ripIdx++) {
    obsRipplePool3[ripIdx].material.opacity = 0;
    obsRipplePool3[ripIdx].position.z = -9999;
  }

  // Refinement 3: Wake chevrons -- curved 3-point arms with organic sway, fade 0.35 to 0.
  // Arms curve outward (mid-x = 60% of spread) giving a rounded-V instead of rigid V.
  for (var wcVi = 0; wcVi < wakeChevrons3.length; wcVi++) {
    var wcV = wakeChevrons3[wcVi];
    if (!wcV.active) {
      wcV.grp.children[0].material.opacity = 0;
      wcV.grp.children[1].material.opacity = 0;
      continue;
    }
    var wcOp = (1 - wcV.life / wcV.maxLife) * 0.55;
    wcV.grp.children[0].material.opacity = wcOp;
    wcV.grp.children[1].material.opacity = wcOp;
    var wcSway = Math.sin(wcV.swayPhase + wcV.life * 0.11) * 0.055;
    var lxMid = -(wcV.spread * 0.60) + wcSway;
    var lxEnd = -(wcV.spread) + wcSway * 0.4;
    var lzMid = wcV.zTail * 0.50;
    var lzEnd = wcV.zTail;
    wcV.attrL.setXYZ(0, 0, 0, 0);
    wcV.attrL.setXYZ(1, lxMid, 0, lzMid);
    wcV.attrL.setXYZ(2, lxEnd, 0, lzEnd);
    wcV.attrL.needsUpdate = true;
    wcV.attrR.setXYZ(0, 0, 0, 0);
    wcV.attrR.setXYZ(1, -lxMid, 0, lzMid);
    wcV.attrR.setXYZ(2, -lxEnd, 0, lzEnd);
    wcV.attrR.needsUpdate = true;
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
  kayakTurnY3 = 0; kayakWasSpinning3 = false; splashWasJumping3 = false;
  paddleSplashPrev3 = 0; wakeChevronTimer3 = 0;
  turnHoldFrames3 = 0; turnDirSign3 = 0; kayakTurnVel3 = 0;
  for (var dpR3 = 0; dpR3 < dropletPool3.length; dpR3++) {
    dropletPool3[dpR3].active = false;
    dropletPool3[dpR3].mesh.material.opacity = 0;
    dropletPool3[dpR3].mesh.position.set(0, -9999, 0);
  }
  for (var wci0 = 0; wci0 < wakeChevrons3.length; wci0++) {
    wakeChevrons3[wci0].active = false;
    wakeChevrons3[wci0].grp.children[0].material.opacity = 0;
    wakeChevrons3[wci0].grp.children[1].material.opacity = 0;
    wakeChevrons3[wci0].grp.position.set(0, 0.16, -9999);
  }

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
