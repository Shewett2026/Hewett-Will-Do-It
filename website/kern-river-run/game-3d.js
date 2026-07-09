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
const SPD_SCALE = 0.060;
const CAM_Y     = 4.8;
const CAM_Z_BK  = 8.5;
const CAM_LOOK_Z = -8.0;
const WATER_OPACITY = 0.60;   // tune here: 0=invisible 1=solid; 0.60 = clear shallow river

// ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
const DEV_STAGE_JUMP = true;  // flip to false or delete this whole block to disable
// ===== END TEMP DEV STAGE JUMP =====


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
    waterColor:0x185761, bankColor:0x7C2D12,
    obsTypes:['capsized_raft','capsized_raft','boulder','boulder','river_wash'],
    fwType:'raft_train', collA:'fishing_lure', collB:'golden_eagle_feather',
    backdrop: {
      img:        'stage2-bg.png',
      bankGrass:  0x7A6E5C,
      bankEarth:  0x6B3A1E,
      treeColors: [0x4A6728, 0x5C7A1E, 0x3D5C1A, 0x6B7A2E],
      trunkColor: 0x7A4A28,
      wf:         null,
    },
  },
  {
    num:3, name:'LAKE ISABELLA', endMile:99, lanes:5, speed:1.78, obsFreq:0.012, fwFreq:0.10,
    waterColor:0x2878B8, bankColor:0x4A7D32,
    obsTypes:['drifting_sailboat','drifting_sailboat','boulder','boulder','river_wash'],
    fwType:'pontoon_party', collA:'beach_ball', collB:'cooler',
    backdrop: {
      img:        'lake-isabella-green-bg.png',
      bankGrass:  0x5A9040,
      bankEarth:  0x3A5C1E,
      treeColors: [0x1B5E20, 0x2E7D32, 0x388E3C, 0x4A7C32],
      trunkColor: 0x5D4037,
      wf:         null,
    },
  },
  {
    num:4, name:'KERN CANYON', endMile:132, lanes:4, speed:1.91, obsFreq:0.013, fwFreq:0.12,
    waterColor:0x0B4F6C, bankColor:0x1C1917,
    obsTypes:['mine_cart','mine_cart','boulder','boulder','river_wash'],
    fwType:'old_mining_bridge', collA:'gold_nugget', collB:'treasure_chest',
    backdrop: {
      img:        'kern-canyon-bg.png',
      bankGrass:  0x5C5248,
      bankEarth:  0x3E3530,
      treeColors: [0x3E3530, 0x4A4440, 0x3E3530, 0x4A4440],
      trunkColor: 0x2E2A28,
      wf:         null,
    },
  },
  {
    num:5, name:'BAKERSFIELD', endMile:165, lanes:3, speed:2.00, obsFreq:0.012, fwFreq:0.09,
    waterColor:0x3E5560, bankColor:0xD97706,
    obsTypes:['boulder','boulder','boulder','fallen_log','fallen_log','shopping_cart','river_wash'],
    fwType:'tube_float_parade', collA:'fox_theater_ticket', collB:'city_seal_medallion',
    backdrop: {
      img:        'bakersfield-terminus-bg.png',
      bankGrass:  0x8A7D5E,
      bankEarth:  0x5A5040,
      treeColors: [0x6B6A4A, 0x5C5A3E, 0x6B6A4A, 0x5C5A3E],
      trunkColor: 0x3A342A,
      wf:         null,
    },
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
// Pixel-art billboard sprites. Each of 7 instances independently picks one of
// 3 cloud textures at random. Spawn positions, drift speed, per-stage visibility
// counts, and per-stage y-lift offsets are unchanged.
var cloudTex      = [null, null, null];
var cloudTexNames = ['cloud-1.png', 'cloud-2.png', 'cloud-3.png'];

(function preloadCloudTex() {
  var loader = new THREE.TextureLoader();
  for (var ci = 0; ci < cloudTexNames.length; ci++) {
    (function(idx) {
      loader.load(cloudTexNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        cloudTex[idx] = tex;
        console.log('[KRR CLOUD TEX] loaded cloud-' + (idx + 1) + '.png naturalW=' +
          (tex.image ? tex.image.naturalWidth : '?') + ' naturalH=' +
          (tex.image ? tex.image.naturalHeight : '?'));
        // Late-patch any sprite created before this texture finished loading
        for (var ci2 = 0; ci2 < clouds3.length; ci2++) {
          if (clouds3[ci2].userData.cloudTexIdx === idx) {
            clouds3[ci2].material.map = tex;
            clouds3[ci2].material.needsUpdate = true;
          }
        }
      }, undefined, function(e) { console.error('[KRR] cloud-' + (idx + 1) + '.png FAILED', e); });
    })(ci);
  }
})();

var CLOUD_BASE_W    = 20;
var CLOUD_BASE_H    = 12;
var CLOUD_START_SCALE = 0.80;
var CLOUD_END_SCALE   = 1.15;

const clouds3 = [];
(function() {
  function makeCloudSprite() {
    var texIdx = Math.floor(Math.random() * 3);
    var tex    = cloudTex[texIdx];
    var mat    = new THREE.SpriteMaterial({
      map:         tex || null,
      color:       tex ? 0xFFFFFF : 0xEEEEEE,
      transparent: true,
      alphaTest:   0.05,
    });
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0.5);
    spr.scale.set(CLOUD_BASE_W, CLOUD_BASE_H, 1);
    spr.userData.cloudTexIdx = texIdx;
    return spr;
  }

  var placements = [
    { x:-16, y:22, z:-84, spd:0.013 },
    { x:  9, y:24, z:-70, spd:0.010 },
    { x: 22, y:21, z:-58, spd:0.015 },
    { x:-25, y:23, z:-76, spd:0.011 },
    { x: 15, y:25, z:-92, spd:0.014 },
    { x: -5, y:22, z:-64, spd:0.009 },
    { x: 20, y:23, z:-80, spd:0.012 },
  ];
  console.log('[KRR CLOUD SIZE] baseW=' + CLOUD_BASE_W + ' baseH=' + CLOUD_BASE_H);

  for (var pi = 0; pi < placements.length; pi++) {
    var p  = placements[pi];
    var cl = makeCloudSprite();
    cl.position.set(p.x, p.y, p.z);
    cl.userData.spd   = p.spd;
    cl.userData.baseY = p.y;
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
let stageBackdropMesh = null;   // Stage 5 persistent backdrop handle (framing tuner)
let wfGroup     = null;
let wfStrips    = [];
let bankTrees3   = [];   // scrolling tree sprite pool (not riverGroup children)
let bankBoulders3 = [];  // scrolling bank boulder sprite pool (stages 2-4, decoration only)
let bankHouses3   = [];  // scrolling lake-house sprite pool (Stage 3 only)
let canyonWalls4  = [];  // scrolling canyon-wall boulder sprite pool (Stage 4 only)
let canyonFill4   = [];  // opaque rock wall mesh refs (Stage 4 only); lives inside riverGroup
let rockWallMats4 = [];  // rock wall texture refs for per-frame UV scroll (Stage 4 only)
let bankSegMats3  = [];   // bank segment texture refs for per-frame scroll (Stage 1)
let grassBankMats3 = [];  // Stage 3 grass texture refs for per-frame scroll (ground + bank segs)
let floorMats4    = [];  // Stage 4 pebble floor texture refs for per-frame scroll
let swampBankMats5 = []; // Stage 5 bank seg texture clones for per-frame UV scroll
var s5GndScrollTex = null; // Stage 5 ground plane scroll clone; re-acquired each buildWorld
let bankStumps5    = [];  // Stage 5 tree-stump sprite pool
let bankFarms5     = [];  // Stage 5 farm-house sprite pool (farm-house-1 and farm-house-2)
let bankFishing5   = [];  // Stage 5 fishing-supplies sprite pool
let bankCars5      = [];  // Stage 5 broken-down-car sprite pool
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
    stageTexCache['sierra-nevada-bg.png.png'] = tex;
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
var waterStageTex2   = null;
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

  loader.load('water-stage2.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.repeat.set(20, 16);
    tex.needsUpdate = true;
    waterStageTex2 = tex;
    // Late-patch: apply if Stage 2 water mesh already built before this callback fired
    if (waterMesh && waterMesh.material && stageIdx === 1 && !waterMesh.material.map) {
      waterMesh.material.color.setHex(0xFFEDF2);
      waterMesh.material.map = tex;
      waterMesh.material.needsUpdate = true;
      console.log('[KRR] Stage 2 water (late-patch) | TEX_AVG #155660 | TARGET #16505B | TINT_COMPUTED 0xFFEDF2');
    }
  }, undefined, function(e) { console.error('[KRR] water-stage2.png FAILED', e); });

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

// ── BOULDER TEXTURE PRELOAD ──────────────────────────────────────────
// Bank decoration (stages 2-4): boulder-1, 4, 6, 7, 8 (bulky/rounded shapes)
// Obstacle in-river (all stages): boulder-2, 3, 5 (more dramatic/blocky shapes)
var bankBoulderTex      = [null, null, null, null, null];
var bankBoulderTexNames = ['boulder-1.png', 'boulder-4.png', 'boulder-6.png', 'boulder-7.png', 'boulder-8.png'];
var boulderObsTex      = [null, null, null];
var boulderObsTexNames = ['boulder-2.png', 'boulder-3.png', 'boulder-5.png'];

(function preloadBoulderTex() {
  var loader = new THREE.TextureLoader();
  for (var bai = 0; bai < bankBoulderTexNames.length; bai++) {
    (function(idx) {
      loader.load(bankBoulderTexNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        bankBoulderTex[idx] = tex;
      }, undefined, function(e) { console.error('[KRR] ' + bankBoulderTexNames[idx] + ' FAILED', e); });
    })(bai);
  }
  for (var boi = 0; boi < boulderObsTexNames.length; boi++) {
    (function(idx) {
      loader.load(boulderObsTexNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        boulderObsTex[idx] = tex;
      }, undefined, function(e) { console.error('[KRR] ' + boulderObsTexNames[idx] + ' FAILED', e); });
    })(boi);
  }
})();

// Stage 3 grass texture for bank ground and bank-box surfaces
var GRASS3_REPEAT       = 12;    // tiles across the 200-unit ground plane; tune for pixel scale
var GRASS3_SCROLL_MULT  = 1.0;   // scale the grass scroll rate; 1.0 = same as Stage 1 bank segs
var grassStage3Tex = null;
(function preloadGrass3Tex() {
  new THREE.TextureLoader().load('grass-stage3.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    grassStage3Tex = tex;
    console.log('[KRR] grass-stage3.png loaded');
  }, undefined, function(e) { console.error('[KRR] grass-stage3.png FAILED', e); });
})();

// Stage 5 terrain bank ground texture (dry-swamp-terrain.png left on disk but no longer referenced for Stage 5)
var swampTerrainTex = null;
(function preloadSwampTerrain5() {
  new THREE.TextureLoader().load('new-stage-5-terrain-blur.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    swampTerrainTex = tex;
    console.log('[KRR] stage5 terrain loaded: new-stage-5-terrain-blur.png');
  }, undefined, function(e) { console.error('[KRR] new-stage-5-terrain-blur.png FAILED', e); });
})();

// Stage 3 lake-house landmark sprites
var lakeHouseTex      = [null, null, null];
var lakeHouseTexNames = ['lake-house-1.png', 'lake-house-2.png', 'lake-house-3.png'];

(function preloadLakeHouseTex() {
  var loader = new THREE.TextureLoader();
  for (var lhi = 0; lhi < lakeHouseTexNames.length; lhi++) {
    (function(idx) {
      loader.load(lakeHouseTexNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        lakeHouseTex[idx] = tex;
        console.log('[KRR] lake-house-' + (idx + 1) + '.png loaded naturalW=' +
          (tex.image ? tex.image.naturalWidth : '?') + ' naturalH=' +
          (tex.image ? tex.image.naturalHeight : '?'));
        // Late-patch aspect ratio for any house sprite created before this texture finished loading
        if (tex.image && tex.image.naturalHeight > 0) {
          var natAsp = tex.image.naturalWidth / tex.image.naturalHeight;
          for (var hpi = 0; hpi < bankHouses3.length; hpi++) {
            if (bankHouses3[hpi].texIdx === idx) {
              bankHouses3[hpi].sprite.scale.set(STAGE3_HOUSE_SCALE * natAsp, STAGE3_HOUSE_SCALE, 1);
            }
          }
        }
      }, undefined, function(e) { console.error('[KRR] lake-house-' + (idx + 1) + '.png FAILED', e); });
    })(lhi);
  }
})();

// Stage 5 bank decoration textures
var stumpTex5   = null;
var farmTex5    = [null, null];   // index 0 = farm-house-1, index 1 = farm-house-2
var fishingTex5 = null;
var carTex5     = null;

(function() {
  var ldr = new THREE.TextureLoader();
  ldr.load('tree-stump.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    stumpTex5 = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] tree-stump ' + natW + 'x' + natH + ' -> world ' + (S5_STUMP_SCALE * natW / natH).toFixed(2) + 'x' + S5_STUMP_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankStumps5.length; i++) {
        bankStumps5[i].sprite.material.map = tex; bankStumps5[i].sprite.material.needsUpdate = true;
        bankStumps5[i].sprite.scale.set(S5_STUMP_SCALE * asp, S5_STUMP_SCALE, 1);
      }
    }
  }, undefined, function(e) { console.error('[KRR] tree-stump.png FAILED', e); });
  ldr.load('farm-house-1.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    farmTex5[0] = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] farm-house-1 ' + natW + 'x' + natH + ' -> world ' + (S5_FARMHOUSE_SCALE * natW / natH).toFixed(2) + 'x' + S5_FARMHOUSE_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFarms5.length; i++) {
        if (bankFarms5[i].texIdx === 0) {
          bankFarms5[i].sprite.material.map = tex; bankFarms5[i].sprite.material.needsUpdate = true;
          bankFarms5[i].sprite.scale.set(S5_FARMHOUSE_SCALE * asp, S5_FARMHOUSE_SCALE, 1);
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] farm-house-1.png FAILED', e); });
  ldr.load('farm-house-2.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    farmTex5[1] = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] farm-house-2 ' + natW + 'x' + natH + ' -> world ' + (S5_FARMHOUSE_SCALE * natW / natH).toFixed(2) + 'x' + S5_FARMHOUSE_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFarms5.length; i++) {
        if (bankFarms5[i].texIdx === 1) {
          bankFarms5[i].sprite.material.map = tex; bankFarms5[i].sprite.material.needsUpdate = true;
          bankFarms5[i].sprite.scale.set(S5_FARMHOUSE_SCALE * asp, S5_FARMHOUSE_SCALE, 1);
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] farm-house-2.png FAILED', e); });
  ldr.load('fishing-supplies.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    fishingTex5 = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] fishing-supplies ' + natW + 'x' + natH + ' -> world ' + (S5_FISHING_SCALE * natW / natH).toFixed(2) + 'x' + S5_FISHING_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFishing5.length; i++) {
        bankFishing5[i].sprite.material.map = tex; bankFishing5[i].sprite.material.needsUpdate = true;
        bankFishing5[i].sprite.scale.set(S5_FISHING_SCALE * asp, S5_FISHING_SCALE, 1);
      }
    }
  }, undefined, function(e) { console.error('[KRR] fishing-supplies.png FAILED', e); });
  ldr.load('broken-down-car.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    carTex5 = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] broken-down-car ' + natW + 'x' + natH + ' -> world ' + (S5_CAR_SCALE * natW / natH).toFixed(2) + 'x' + S5_CAR_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankCars5.length; i++) {
        bankCars5[i].sprite.material.map = tex; bankCars5[i].sprite.material.needsUpdate = true;
        bankCars5[i].sprite.scale.set(S5_CAR_SCALE * asp, S5_CAR_SCALE, 1);
      }
    }
  }, undefined, function(e) { console.error('[KRR] broken-down-car.png FAILED', e); });
})();

// Stage 5 in-water obstacle textures (shopping cart art)
var cartTex5Obs    = [null, null];  // index 0 = shopping-cart-3.png, index 1 = shopping-cart-4.png
var cartTex5ObsAsp = [1.0, 1.0];   // cached aspect ratios; updated on texture load; defaults to 1.0
var cartTex5ObsLogged = false;      // fire sizing log once on first load

(function() {
  var ldr = new THREE.TextureLoader();
  var cartNames = ['shopping-cart-3.png', 'shopping-cart-4.png'];
  for (var cti = 0; cti < cartNames.length; cti++) {
    (function(idx) {
      ldr.load(cartNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        cartTex5Obs[idx] = tex;
        if (tex.image && tex.image.naturalHeight > 0) {
          var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
          cartTex5ObsAsp[idx] = natW / natH;
          if (!cartTex5ObsLogged) {
            cartTex5ObsLogged = true;
            var wH = 1.40;
            console.log('[KRR S5OBS] shopping-cart ' + natW + 'x' + natH + ' -> world ' + (wH * cartTex5ObsAsp[idx]).toFixed(2) + 'x' + wH.toFixed(2) + ' seatY=' + S5_CART_SEAT_Y);
          }
        }
      }, undefined, function(e) { console.error('[KRR] ' + cartNames[idx] + ' FAILED', e); });
    })(cti);
  }
})();

// Stage 5 in-water obstacle textures (fallen log art)
var fallenLogTex5      = [null, null];  // index 0 = fallen-log-1.png roots-left, index 1 = fallen-log-2.png roots-right
var fallenLogTex5Asp   = [1.0, 1.0];   // cached aspect ratios; updated on texture load; defaults to 1.0
var fallenLogTex5Logged = false;        // fire sizing log once on first load
var fallenLogAlt5      = 0;            // toggles 0/1 per fallen_log spawn to alternate art/gap side

(function() {
  var ldr = new THREE.TextureLoader();
  var logNames = ['fallen-log-1.png', 'fallen-log-2.png'];
  for (var lgi = 0; lgi < logNames.length; lgi++) {
    (function(idx) {
      ldr.load(logNames[idx], function(tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        fallenLogTex5[idx] = tex;
        if (tex.image && tex.image.naturalHeight > 0) {
          var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
          fallenLogTex5Asp[idx] = natW / natH;
          if (!fallenLogTex5Logged) {
            fallenLogTex5Logged = true;
            var wW = 2 * LANE_W;
            console.log('[KRR S5LOG] fallen-log ' + natW + 'x' + natH + ' -> world ' + wW.toFixed(2) + 'x' + (wW / fallenLogTex5Asp[idx]).toFixed(2));
          }
        }
      }, undefined, function(e) { console.error('[KRR] ' + logNames[idx] + ' FAILED', e); });
    })(lgi);
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
  bankBoulders3.forEach(function(bb) { scene.remove(bb.sprite); if (bb.sprite.material) bb.sprite.material.dispose(); });
  bankBoulders3 = [];
  bankHouses3.forEach(function(bh) { scene.remove(bh.sprite); if (bh.sprite.material) bh.sprite.material.dispose(); });
  bankHouses3 = [];
  bankStumps5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankStumps5 = [];
  bankFarms5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankFarms5 = [];
  bankFishing5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankFishing5 = [];
  bankCars5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankCars5 = [];
  canyonWalls4.forEach(function(cw) { scene.remove(cw.sprite); if (cw.sprite.material) cw.sprite.material.dispose(); });
  canyonWalls4 = [];
  canyonFill4.forEach(function(m) { if (m.parent) m.parent.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
  canyonFill4 = [];
  rockWallMats4 = [];
  bankSegMats3  = [];
  grassBankMats3 = [];
  floorMats4    = [];
  swampBankMats5 = [];
  s5GndScrollTex = null;
  riverbedMesh   = null;
  riverbedTexRef = null;
  if (horizonGrp)   { scene.remove(horizonGrp); horizonGrp = null; }
  // Stage 5 backdrop persists through sub-narrow rebuilds; only tear down on actual stage change
  if (backdropMesh && !(stageIdx === 4 && stageBackdropMesh !== null)) { scene.remove(backdropMesh); backdropMesh.geometry.dispose(); backdropMesh = null; stageBackdropMesh = null; }
  if (wfGroup)      { scene.remove(wfGroup); wfGroup = null; wfStrips = []; }

  const stg = STAGES3[stageIdx];
  // Per-stage sky: Stage 5 gets a dusty haze tone; all others restore the standard sky blue
  scene.background.set(stg.num === 5 ? 0x9FB0B8 : 0x87CEEB);
  // Stage 5: extend far clip so deep terrain planes reach the backdrop bottom; restore for other stages
  camera.far = (stg.num === 5) ? 350 : 160;
  camera.updateProjectionMatrix();
  const rw  = riverWidth();
  riverGroup = new THREE.Group();

  // Ground -- widened to 200 units so grass fills past screen edges on all sides
  var gndMat;
  if (stg.num === 1 && bankStageTex) {
    // Stage 1: pixel-art grass texture, no tint
    var gt = bankStageTex.clone(); gt.needsUpdate = true;
    gt.wrapS = THREE.RepeatWrapping; gt.wrapT = THREE.RepeatWrapping;
    gt.magFilter = THREE.NearestFilter; gt.minFilter = THREE.NearestFilter;
    gt.generateMipmaps = false;
    gt.repeat.set(40, 40);
    gndMat = new THREE.MeshLambertMaterial({ map: gt });
  } else if (stg.num === 2 && riverbedStageTex) {
    // Stage 2 wide water: BasicMaterial (no lighting) so pebble shows true color through water
    var gt2 = riverbedStageTex.clone(); gt2.needsUpdate = true;
    gt2.repeat.set(40, 40);
    gndMat = new THREE.MeshBasicMaterial({ color: 0xA0988A, map: gt2 });
  } else if (stg.num === 3) {
    // Stage 3 lake: BasicMaterial (no Lambert blow-out); grass texture if loaded, solid fallback
    if (grassStage3Tex) {
      var gt3 = grassStage3Tex.clone(); gt3.needsUpdate = true;
      gt3.repeat.set(GRASS3_REPEAT, GRASS3_REPEAT);
      gndMat = new THREE.MeshBasicMaterial({ map: gt3 });
      grassBankMats3.push(gt3);
    } else {
      gndMat = new THREE.MeshBasicMaterial({ color: stg.bankColor });
    }
  } else if (stg.num === 4) {
    // Stage 4 (Kern Canyon): pebble texture on dry canyon bank ground.
    // BasicMaterial so the texture renders at exact color without Lambert blow-out.
    // Tinted by WALL4_FLOOR_TINT (default white = no change); darken to taste.
    if (riverbedStageTex) {
      var gt4 = riverbedStageTex.clone(); gt4.needsUpdate = true;
      gt4.wrapS = THREE.RepeatWrapping; gt4.wrapT = THREE.RepeatWrapping;
      gt4.magFilter = THREE.NearestFilter; gt4.minFilter = THREE.NearestFilter;
      gt4.generateMipmaps = false;
      gt4.repeat.set(WALL4_FLOOR_REPEAT, WALL4_FLOOR_REPEAT);
      gndMat = new THREE.MeshBasicMaterial({ color: WALL4_FLOOR_TINT, map: gt4 });
      floorMats4.push(gt4);
    } else {
      gndMat = new THREE.MeshBasicMaterial({ color: stg.bankColor });
    }
  } else if (stg.num === 5) {
    // Stage 5: dedicated scrolling clone so auto-scroll and [/] seat tuner don't fight over the same offset.y
    if (swampTerrainTex) {
      var gndTex5 = swampTerrainTex.clone(); gndTex5.needsUpdate = true;
      gndTex5.wrapS = THREE.RepeatWrapping; gndTex5.wrapT = THREE.RepeatWrapping;
      gndTex5.magFilter = THREE.NearestFilter; gndTex5.minFilter = THREE.NearestFilter;
      gndTex5.generateMipmaps = false;
      gndTex5.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y);
      gndMat = new THREE.MeshBasicMaterial({ map: gndTex5 });
      s5GndScrollTex = gndTex5;
    } else {
      gndMat = new THREE.MeshBasicMaterial({ color: stg.backdrop ? stg.backdrop.bankGrass : stg.bankColor });
      s5GndScrollTex = null;
    }
  } else {
    gndMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  }
  var gndZ = (stg.num === 5) ? 600 : 170;
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(200, gndZ), gndMat);
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
    var rbDepth = (stg.num === 5) ? 600 : 155;
    var rbMesh = new THREE.Mesh(new THREE.PlaneGeometry(rw + 2, rbDepth, 1, 1), rbMat);
    rbMesh.rotation.x = -Math.PI / 2;
    rbMesh.position.set(0, 0.0, -55);
    rbMesh.renderOrder = 1;
    riverGroup.add(rbMesh);
    riverbedMesh = rbMesh;
    console.log('[KRR] Riverbed mesh | y=' + rbMesh.position.y + ' renderOrder=' + rbMesh.renderOrder + ' texture=' + (riverbedStageTex ? 'applied' : 'pending'));
  }

  // River surface. Stage 2 uses MeshBasicMaterial so the sampled backdrop color
  // renders at exactly the specified hex without the scene lights amplifying it.
  // All other stages use MeshPhongMaterial for shininess and specular glints.
  var wMat;
  if (stg.num === 2) {
    wMat = new THREE.MeshBasicMaterial({ color: stg.waterColor });
    if (waterStageTex2) {
      waterStageTex2.offset.set(0, 0);
      // TEX_AVG #155660 (R=21 G=86 B=96) | TARGET #16505B (R=22 G=80 B=91)
      // tint = target/tex_avg per channel, clamped to 255
      // R: floor(22/21*255)=255 | G: floor(80/86*255)=237 | B: floor(91/96*255)=242
      wMat.color.setHex(0xFFEDF2);
      wMat.map = waterStageTex2;
      wMat.needsUpdate = true;
      console.log('[KRR] Stage 2 water | TEX_AVG #155660 | TARGET #16505B | TINT_COMPUTED 0xFFEDF2');
    }
  } else if (stg.num === 3) {
    // Stage 3 (Lake Isabella): lighting-free flat color so the lake reads true-hued
    // without the scene lights blowing out the blue channels (same reason as Stage 2).
    wMat = new THREE.MeshBasicMaterial({ color: stg.waterColor });
  } else if (stg.num === 4) {
    // Stage 4 (Kern Canyon): BasicMaterial so the deep-blue canyon water renders at exact hex
    // under the heavily shadowed canyon. Lambert/Phong would blow out the mid-dark blue.
    wMat = new THREE.MeshBasicMaterial({ color: stg.waterColor });
  } else if (stg.num === 5) {
    // Stage 5 (Bakersfield Terminus): BasicMaterial for lighting-free tunable murky tone
    wMat = new THREE.MeshBasicMaterial({ color: stg.waterColor });
  } else {
    wMat = new THREE.MeshPhongMaterial({ color: stg.waterColor, shininess: 14, specular: 0x111a22 });
    if (stg.num === 1 && waterStageTex) {
      var wt = waterStageTex.clone(); wt.needsUpdate = true;
      wt.wrapS = THREE.RepeatWrapping; wt.wrapT = THREE.RepeatWrapping;
      wt.magFilter = THREE.NearestFilter; wt.minFilter = THREE.NearestFilter;
      wt.generateMipmaps = false;
      // Tile: ~2 repeats wide, ~12 repeats along the 155-unit length
      wt.repeat.set(2, 12);
      wMat.map = wt; wMat.needsUpdate = true;
    }
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
  var waterPW = (stg.num === 2) ? 200 : rw;
  var waterPX = (stg.num === 2) ? 8   : 12;
  var waterDepth = (stg.num === 5) ? 600 : 155;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(waterPW, waterDepth, waterPX, 32), wMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.15, -55); water.receiveShadow = true;
  water.renderOrder = 2;
  riverGroup.add(water);
  waterMesh = water;
  console.log('[KRR] Water mesh   | y=' + water.position.y + ' renderOrder=' + water.renderOrder + ' (water above riverbed: ' + (water.renderOrder > (riverbedMesh ? riverbedMesh.renderOrder : -1)) + ')');

  // Banks -- segmented curved geometry. Stage 2 skips banks entirely (wide-water design).
  // Inner edge of every segment stays exactly at side * rw/2 (flush with play area).
  // Outer edge follows a slow sine so the bank appears to meander.
  // Play lanes, water surface, lane dividers, spawns, and collision are all untouched.
  if (stg.num !== 2) {
    const bkColor   = stg.backdrop ? stg.backdrop.bankGrass : stg.bankColor;
    // Stage 3 + 4: BasicMaterial so rocky/grass bank color renders at exact hex without Lambert blow-out
    const bkBaseMat = (stg.num === 3 || stg.num === 4)
      ? new THREE.MeshBasicMaterial({ color: bkColor })
      : new THREE.MeshLambertMaterial({ color: bkColor });
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
        if (stg.num === 1 && bankStageTex) {
          // Stage 1: pixel-art grass texture
          var bkTex = bankStageTex.clone(); bkTex.needsUpdate = true;
          bkTex.wrapS = THREE.RepeatWrapping; bkTex.wrapT = THREE.RepeatWrapping;
          bkTex.magFilter = THREE.NearestFilter; bkTex.minFilter = THREE.NearestFilter;
          bkTex.generateMipmaps = false;
          bkTex.repeat.set(Math.ceil(segW / 2), 1);
          bkSegMat = new THREE.MeshLambertMaterial({ map: bkTex });
          bankSegMats3.push(bkTex);
        } else if (stg.num === 3 && grassStage3Tex) {
          // Stage 3: same grass texture, BasicMaterial so lighting does not blow it out
          var bkTex3 = grassStage3Tex.clone(); bkTex3.needsUpdate = true;
          bkTex3.wrapS = THREE.RepeatWrapping; bkTex3.wrapT = THREE.RepeatWrapping;
          bkTex3.magFilter = THREE.NearestFilter; bkTex3.minFilter = THREE.NearestFilter;
          bkTex3.generateMipmaps = false;
          bkTex3.repeat.set(Math.ceil(segW / 2), 1);
          bkSegMat = new THREE.MeshBasicMaterial({ map: bkTex3 });
          grassBankMats3.push(bkTex3);
        } else if (stg.num === 4 && riverbedStageTex) {
          // Stage 4: pebble texture on bank box-segments; BasicMaterial for exact-color render
          var bkTex4 = riverbedStageTex.clone(); bkTex4.needsUpdate = true;
          bkTex4.wrapS = THREE.RepeatWrapping; bkTex4.wrapT = THREE.RepeatWrapping;
          bkTex4.magFilter = THREE.NearestFilter; bkTex4.minFilter = THREE.NearestFilter;
          bkTex4.generateMipmaps = false;
          bkTex4.repeat.set(Math.ceil(segW / 2), 1);
          bkSegMat = new THREE.MeshBasicMaterial({ color: WALL4_FLOOR_TINT, map: bkTex4 });
          floorMats4.push(bkTex4);
        } else if (stg.num === 5 && swampTerrainTex) {
          // Stage 5: per-segment clone so UV scroll is visible (same approach as Stages 1/3/4)
          var bkTex5 = swampTerrainTex.clone(); bkTex5.needsUpdate = true;
          bkTex5.wrapS = THREE.RepeatWrapping; bkTex5.wrapT = THREE.RepeatWrapping;
          bkTex5.magFilter = THREE.NearestFilter; bkTex5.minFilter = THREE.NearestFilter;
          bkTex5.generateMipmaps = false;
          bkTex5.repeat.set(Math.ceil(segW / 2), 1);
          bkSegMat = new THREE.MeshBasicMaterial({ map: bkTex5 });
          swampBankMats5.push(bkTex5);
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
  if (stg.backdrop && stg.num === 1) { initBankTrees3(rw, stg.backdrop); }
  if (stg.backdrop && stg.num === 5) { initBankTrees3(rw, stg.backdrop, 16); }
  if (stg.backdrop && stg.num === 3) { initBankTrees3(rw, stg.backdrop, STAGE3_TREE_COUNT); }
  if (stg.num === 2) { initStage2RockyShores(rw); }
  else if (stg.num === 3) { initBankBoulders3(rw, STAGE3_BOULDER_COUNT); initBankHouses3(rw); }
  if (stg.num === 5) { initBankDecor5(rw); }
  else if (stg.num === 4) {
    initCanyonWalls4(rw);
    addCanyonBackfill4(riverGroup, rw);
    console.log('[KRR S4 AUDIT] wallBoulders=' + canyonWalls4.length + ' otherBankBoulders=' + bankBoulders3.length);
  }

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
      // Kern Canyon bank decor is handled by initCanyonWalls4; no static pillars here.

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
var SHORE3_EDGE_COLOR   = 0x607848;  // Stage 3: damp green-brown bank edge (shows through water)
var SHORE3_FOAM_COLOR   = 0xA8C490;  // Stage 3: muted green-tinted wet shoreline (no bright curb)
var SHORE3_FOAM_OPACITY = 0.12;      // Stage 3: near-invisible foam so edge reads as natural lake
var SHORE4_EDGE_COLOR   = 0x3A3028;  // Stage 4: damp dark-rock channel edge
var SHORE4_FOAM_COLOR   = 0x5C504A;  // Stage 4: muted stone-brown wet edge (no bright curb)
var SHORE4_FOAM_OPACITY = 0.10;      // Stage 4: near-invisible so edge reads as bare wet rock
var SHORE5_EDGE_COLOR   = 0x7E6A46;  // Stage 5: muted dry-earth channel edge
var SHORE5_FOAM_COLOR   = 0x8A8578;  // Stage 5: dusty stone-brown wet edge (no bright curb)
var SHORE5_FOAM_OPACITY = 0.12;      // Stage 5: near-invisible so edge reads as dry rocky bed
var S5_BD_SCALE = 0.86; // Stage 5 backdrop initial scale (TEMP framing tuner; bake before launch)
var S5_BD_Y    = -3.0;  // Stage 5 backdrop Y offset from default y=26 (TEMP framing tuner)
var S5_TERR_REPEAT_X = 12;   // Stage 5 swamp terrain X repeat (TEMP tuner; bake before launch)
var S5_TERR_REPEAT_Y = 12;   // Stage 5 swamp terrain Y repeat
var S5_TERR_SCROLL   = 1.0;  // Stage 5 swamp terrain scroll multiplier
var S5_TERR_Y        = 0.0;  // Stage 5 swamp terrain UV seat (phase offset)
// Stage 5 bank decoration spawn frequencies (relative to the halved tree pool of 16)
// pool count = Math.max(1, Math.round(freq * 16)); tune by screenshot
var S5_FREQ_TREE_STUMP   = 0.60;   // semi-frequent ground clutter
var S5_FREQ_FARMHOUSE    = 0.35;   // less common; farm-house-1 and farm-house-2 share this
var S5_FREQ_FISHING      = 0.15;   // rare
var S5_FREQ_BROKEN_CAR   = 0.08;   // rarest
// Stage 5 bank decoration sprite heights (world units); aspect width computed from image
var S5_STUMP_SCALE     = 2.5;
var S5_FARMHOUSE_SCALE = 11.9;
var S5_FARMHOUSE_SEAT_Y = -3.00; // bottom anchor Y; large negative corrects ~27% bottom padding in farm-house art; tune with , / . keys
var S5_FISHING_SCALE   = 3.50;  // 2.0 base x 2.5 x 0.7
var S5_CAR_SCALE       = 2.0;
var S5_CART_SEAT_Y     = -0.20;  // bottom anchor Y; sinks lower ~third of cart below water surface (y=0.15)
var S5_LOG_SEAT_Y      = -2.70;  // bottom anchor Y; corrects ~47-50% transparent bottom padding in fallen-log art; tune with ; / ' keys
// Stage 4 backdrop horizontal alignment: shifts the painted river left/right to match the gameplay channel.
// Positive = image shifts left (see more of right side); negative = shifts right.
// Gameplay channel center is always world x=0; adjust until painted river matches at horizon.
var STAGE4_BD_SHIFT_X = 0.0;
function addShoreline3(rg, rw, stg) {
  if (stg.num === 2) return;
  for (var shSide = -1; shSide <= 1; shSide += 2) {
    var shX = shSide * rw / 2;

    // Sandy/rocky shallows strip: horizontal plane just below the water surface (y=0.02),
    // 1.0 unit wide along each bank edge. Shows through the 60%-opaque water.
    // Stage 2: pebble texture tinted grey-stone for rocky gravel shallows.
    // Other stages: solid sandy tan.
    var sandyMat;
    if (stg.num === 2 && riverbedStageTex) {
      var sTex = riverbedStageTex.clone(); sTex.needsUpdate = true;
      sTex.repeat.set(1, 20);
      sandyMat = new THREE.MeshLambertMaterial({ color: 0xA0988A, map: sTex });
    } else {
      var sandyColor = (stg.num === 3) ? SHORE3_EDGE_COLOR : (stg.num === 4) ? SHORE4_EDGE_COLOR : (stg.num === 5) ? SHORE5_EDGE_COLOR : (stg.num === 2) ? 0x8E8070 : 0xC4A46B;
      sandyMat = new THREE.MeshBasicMaterial({ color: sandyColor });
    }
    var sandyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 155), sandyMat);
    sandyMesh.rotation.x = -Math.PI / 2;
    sandyMesh.position.set(shX - shSide * 0.5, 0.02, -55);
    sandyMesh.renderOrder = 1;
    rg.add(sandyMesh);

    // Foam/wet-edge strip: Stage 3 uses muted lake color at near-zero opacity (no hard curb line)
    var foamColor   = (stg.num === 3) ? SHORE3_FOAM_COLOR   : (stg.num === 4) ? SHORE4_FOAM_COLOR   : (stg.num === 5) ? SHORE5_FOAM_COLOR   : 0xCCEEFF;
    var foamOpacity = (stg.num === 3) ? SHORE3_FOAM_OPACITY : (stg.num === 4) ? SHORE4_FOAM_OPACITY : (stg.num === 5) ? SHORE5_FOAM_OPACITY : 0.45;
    var foamMat = new THREE.MeshBasicMaterial({ color: foamColor, transparent: true, opacity: foamOpacity, depthWrite: false });
    var foamMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 150), foamMat);
    foamMesh.rotation.x = -Math.PI / 2;
    foamMesh.position.set(shX - shSide * 0.275, 0.155, -55);
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

var STAGE3_TREE_COUNT    = 21;   // tune to thin or thicken Stage 3 bank trees
var STAGE3_BOULDER_COUNT = 11;   // sparser than trees by design; tune separately

function initBankTrees3(rw, bd, count) {
  var TREE_COUNT = (count !== undefined) ? count : 32;
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

// Scatter decorative boulder sprites along both banks for stages 2-4.
// 14 sprites per stage call, evenly seeded, recycled in update3().
// Sizes vary 0.7-1.8 world units tall with slight width variation.
// center.y=0 anchors the sprite bottom at y=0 (ground level).
function initBankBoulders3(rw, count) {
  var BOULDER_COUNT = (count !== undefined) ? count : 22;
  for (var bi = 0; bi < BOULDER_COUNT; bi++) {
    var side   = bi % 2 === 0 ? -1 : 1;
    var texIdx = Math.floor(Math.random() * bankBoulderTex.length);
    var xOff   = Math.floor(Math.random() * 4) * 1.6 + 0.3;
    var xBase  = side * (rw / 2 + 1.0 + xOff);
    var zInit  = SPAWN_Z + (bi / BOULDER_COUNT) * (Math.abs(SPAWN_Z) + 12);
    var bH     = 1.2 + Math.random() * 1.6;
    var bW     = bH * (0.85 + Math.random() * 0.70);
    var tex    = bankBoulderTex[texIdx];
    var mat;
    if (tex) {
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
    } else {
      mat = new THREE.SpriteMaterial({ color: 0x7C6050, transparent: true, opacity: 0.85 });
    }
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);
    spr.scale.set(bW, bH, 1);
    spr.position.set(xBase, 0, zInit);
    scene.add(spr);
    bankBoulders3.push({ sprite: spr, side: side, z: zInit });
  }
}

// Stage 4 (Kern Canyon) only: build rising boulder-slope walls on both sides of the
// center channel. Rows step outward from the play edge, each row higher and taller
// than the last, reading as a rock slope rising from the canyon floor.
// All sprites are outside +/-E (the channel edge), no collision impact.
// Entries go into canyonWalls4 (not bankBoulders3) so Stage 3 is untouched.
function initCanyonWalls4(rw) {
  var E       = rw / 2;  // half-width of navigable channel; 4.4 for Stage 4 (4 lanes x 2.2)
  var minAbs  = E + WALL4_INNER_GAP;  // channel guard: |posX| must be >= this
  var zSpan   = Math.abs(SPAWN_Z) + 12;
  // dy per dx along slope surface: rakes from (E, -0.5) at waterline to (E+WIDTH, ROCK_TOP) at top
  var slopeK  = (WALL4_ROCK_TOP + 0.5) / WALL4_ROCK_WIDTH;
  var N_BANDS = 8;  // renderOrder bands: inner = higher order (drawn on top of outer)
  var rotMult = Math.PI / 180;
  console.log('[KRR WALL4 INIT] count=' + WALL4_COUNT + ' coverX=' + WALL4_COVER_X +
    ' rockTop=' + WALL4_ROCK_TOP + ' scaleBase=' + WALL4_SCALE_BASE + ' E=' + E);
  for (var side = -1; side <= 1; side += 2) {
    for (var ci = 0; ci < WALL4_COUNT; ci++) {
      // scatter randomly across full slope: random dx in [INNER_GAP, COVER_X]
      var dx     = WALL4_INNER_GAP + Math.random() * (WALL4_COVER_X - WALL4_INNER_GAP);
      var ySlope = -0.5 + dx * slopeK;  // slope-surface Y at this dx
      var yPos   = ySlope + (Math.random() - 0.5) * 2.0 * WALL4_Y_JITTER;
      var xPos   = side * (E + dx);
      if (side > 0 && xPos <  minAbs) xPos =  minAbs;
      if (side < 0 && xPos > -minAbs) xPos = -minAbs;
      var zInit  = SPAWN_Z + Math.random() * zSpan;
      var texIdx = Math.floor(Math.random() * bankBoulderTex.length);
      var tex    = bankBoulderTex[texIdx];
      var mat;
      if (tex) {
        mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
      } else {
        mat = new THREE.SpriteMaterial({ color: 0x6A5A4A, transparent: true, opacity: 0.88 });
      }
      mat.rotation = (Math.random() - 0.5) * 2.0 * WALL4_ROT_RANGE * rotMult;
      var tv = 1.0 - Math.random() * WALL4_TINT_JITTER;
      mat.color.setRGB(tv, tv, tv);
      var spr     = new THREE.Sprite(mat);
      spr.center.set(0.5, 0);  // bottom-anchor: base sits on slope surface
      // random size across spread band; depth-taper multiplier applied per-frame
      var baseH   = WALL4_SCALE_BASE * (1.0 - WALL4_SCALE_SPREAD * 0.5 + Math.random() * WALL4_SCALE_SPREAD);
      var wFactor = 0.80 + Math.random() * 0.65;
      var flipX   = Math.random() < 0.5 ? 1 : -1;
      var t4      = Math.max(0, Math.min(1, (zInit - SPAWN_Z) / (DESPAWN_Z - SPAWN_Z)));
      var ds4     = WALL4_FAR_SCALE + t4 * (WALL4_NEAR_SCALE - WALL4_FAR_SCALE);
      var bH      = baseH * WALL4_SCALE_MULT * ds4;
      spr.scale.set(bH * wFactor * flipX, bH, 1);
      spr.position.set(xPos, yPos, zInit);
      // inner boulders (small dx) render on top of outer (large dx)
      var band       = Math.min(N_BANDS - 1, Math.floor(dx / WALL4_COVER_X * N_BANDS));
      spr.renderOrder = N_BANDS - band;
      scene.add(spr);
      canyonWalls4.push({
        sprite:  spr,
        side:    side,
        z:       zInit,
        dx:      dx,     // outward offset from E; re-rolled on recycle
        baseH:   baseH,
        wFactor: wFactor,
        flipX:   flipX,
        texIdx:  texIdx,
        eVal:    E,      // channel half-width at spawn; used for recycle x-position
        minAbs:  minAbs, // channel guard minimum |posX|
      });
    }
  }
}

// ===== TEMP WALL4 SIZE TUNER helper (REMOVE BEFORE LAUNCH) =====
function rebuildCanyonWalls4() {
  for (var ri = 0; ri < canyonWalls4.length; ri++) {
    scene.remove(canyonWalls4[ri].sprite);
    canyonWalls4[ri].sprite.material.dispose();
    canyonWalls4[ri].sprite.geometry.dispose();
  }
  canyonWalls4 = [];
  initCanyonWalls4(riverWidth());
  console.log('[KRR WALL4 SIZE] nearScale=' + WALL4_NEAR_SCALE.toFixed(2) + ' scaleBase=' + WALL4_SCALE_BASE.toFixed(1));
}
// ===== END TEMP WALL4 SIZE TUNER helper =====

// ===== TEMP WALL4 COVER helper (REMOVE BEFORE LAUNCH) =====
// Rebuilds both the rock-wall quad geometry (needed when WALL4_ROCK_TOP changes)
// and all boulder sprites (needed when WALL4_COUNT, WALL4_COVER_X, or WALL4_ROCK_TOP change)
function rebuildCanyonFull4() {
  for (var ri = 0; ri < canyonWalls4.length; ri++) {
    scene.remove(canyonWalls4[ri].sprite);
    canyonWalls4[ri].sprite.material.dispose();
    canyonWalls4[ri].sprite.geometry.dispose();
  }
  canyonWalls4 = [];
  for (var qi = 0; qi < canyonFill4.length; qi++) {
    riverGroup.remove(canyonFill4[qi]);
    canyonFill4[qi].material.dispose();
    canyonFill4[qi].geometry.dispose();
  }
  canyonFill4 = [];
  rockWallMats4 = [];
  var rw4 = riverWidth();
  addCanyonBackfill4(riverGroup, rw4);
  initCanyonWalls4(rw4);
  console.log('[KRR WALL4 COVER] count=' + WALL4_COUNT + ' coverX=' + WALL4_COVER_X.toFixed(1) + ' rockTop=' + WALL4_ROCK_TOP.toFixed(1));
}
// ===== END TEMP WALL4 COVER helper =====

// Stage 4: continuous textured rock-wall quad per side.
// Geometry: a quad raking from (E, yBot) at the channel edge up-and-outward to (E+WIDTH, TOP).
// Spans the full stage length in Z so no backdrop shows through boulder sprite gaps.
// Mirror-identical left/right. renderOrder=0 draws before boulders (1-5); Z-depth keeps it behind backdrop.
function addCanyonBackfill4(rg, rw) {
  var E      = rw / 2;                      // channel half-width (4.4 for Stage 4)
  var W      = WALL4_ROCK_WIDTH;            // outward X extent
  var H      = WALL4_ROCK_TOP;             // top-edge height -- clears frame at all depths
  var yBot   = -0.5;                        // bottom tucked below ground plane
  var z_near = DESPAWN_Z - 1;              // front end just ahead of camera (CAM_Z_BK=8.5)
  var z_far  = SPAWN_Z   - 5;             // back end past spawn
  console.log('[KRR WALL4 ROCK] E=' + E.toFixed(1) + ' W=' + W + ' H=' + H + ' z=' + z_far + '->' + z_near + ' tint=0x' + WALL4_ROCK_TINT.toString(16));
  for (var side = -1; side <= 1; side += 2) {
    var xInner = side * E;                   // channel edge
    var xOuter = side * (E + W);             // outer top edge
    // 4-vertex quad; U axis along Z (stage length), V axis along slope (bottom to top).
    // winding: viewed from channel interior, front face is visible (DoubleSide also used as safety).
    var pos = new Float32Array([
      xInner, yBot, z_far,    // 0 bottom-far
      xInner, yBot, z_near,   // 1 bottom-near
      xOuter, H,    z_near,   // 2 top-near
      xOuter, H,    z_far,    // 3 top-far
    ]);
    var uv = new Float32Array([
      0, 0,   // 0
      1, 0,   // 1
      1, 1,   // 2
      0, 1,   // 3
    ]);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uv,  2));
    geo.setIndex([0, 1, 2,  0, 2, 3]);
    var tex = null;
    if (riverbedStageTex) {
      tex = riverbedStageTex.clone();
      tex.needsUpdate    = true;
      tex.wrapS          = THREE.RepeatWrapping;
      tex.wrapT          = THREE.RepeatWrapping;
      tex.magFilter      = THREE.NearestFilter;
      tex.minFilter      = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.repeat.set(WALL4_ROCK_RPT_U, WALL4_ROCK_RPT_V);
    }
    var mat = new THREE.MeshBasicMaterial({
      color:      WALL4_ROCK_TINT,
      map:        tex || null,
      side:       THREE.DoubleSide,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 0;  // draws before boulders (renderOrder 1-5); Z-depth puts it in front of backdrop
    canyonFill4.push(mesh);
    if (tex) rockWallMats4.push(tex);
    rg.add(mesh);
  }
}


var STAGE3_HOUSE_COUNT = 4;    // sparse landmark count; tune by eye (3-6 feels right)
var STAGE3_HOUSE_SCALE = 8;    // sprite height in world units; tune by eye

// Stage 4 canyon wall boulder constants -- all cosmetic, outside play lane, no collision
// Boulders scatter-fill the FULL slope surface (not row-based); see initCanyonWalls4
var WALL4_COUNT        = 350;  // boulder sprites per side; crank to pack slope (TEMP COVER tuner: z/x)
var WALL4_COVER_X      = 18;   // outward X extent boulders reach (0..WALL4_ROCK_WIDTH) (TEMP COVER tuner: c/f)
var WALL4_INNER_GAP    = 0.2;  // x-gap from play edge E to innermost boulder; channel-clamp guard
var WALL4_SCALE_BASE   = 2.6;  // median boulder height world units (TEMP SIZE tuner: b/v)
var WALL4_SCALE_SPREAD = 0.6;  // random size band: baseH = SCALE_BASE * (1-SPREAD/2 .. 1+SPREAD/2)
var WALL4_Y_JITTER     = 0.4;  // +/- y deviation of boulder base from slope surface (world units)
var WALL4_SCALE_MULT   = 1.2;  // global per-boulder size multiplier on top of SCALE_BASE
var WALL4_ROT_RANGE    = 40;   // max rotation jitter degrees; 40 for wide silhouette chaos (was 30)
var WALL4_TINT_JITTER  = 0.35; // max brightness reduction; reads as individual rock faces
// depth taper: near boulders tall, far short so backdrop shows over horizon
var WALL4_NEAR_SCALE   = 1.15; // height mult at near (camera) end (TEMP SIZE tuner: n/m)
var WALL4_FAR_SCALE    = 0.45; // height multiplier at far (backdrop) end
// Floor (pebble riverbed)
var WALL4_FLOOR_REPEAT      = 40;
var WALL4_FLOOR_TINT        = 0xFFFFFF;
var WALL4_FLOOR_SCROLL_MULT = 1.0;
// Opaque rock wall seal behind boulders -- quad per side raking from channel edge up and out
var WALL4_ROCK_WIDTH   = 20;         // outward X extent of rock wall quad from channel edge (world units)
var WALL4_ROCK_TOP     = 18;         // wall top height; was 24 (PART C reduction) (TEMP COVER tuner: h/j)
var WALL4_ROCK_TINT    = 0x7A6850;  // darker warm canyon rock
var WALL4_ROCK_RPT_U   = 5;         // texture tiles along stage length
var WALL4_ROCK_RPT_V   = 3;         // texture tiles along slope height
var WALL4_ROCK_SCROLL_MULT = 1.0;   // multiply rock-wall scroll rate vs world speed
// Legacy slope constants -- not used; retained for reference
var WALL4_FILL_COLOR        = 0x3A3028;
var WALL4_FILL_H_FAR        = -0.5;
var WALL4_FILL_SLOPE_INNER  = 0.0;
var WALL4_FILL_SLOPE_OUTER  = 3.0;

function initBankHouses3(rw) {
  for (var hi = 0; hi < STAGE3_HOUSE_COUNT; hi++) {
    var side   = hi % 2 === 0 ? -1 : 1;
    var texIdx = Math.floor(Math.random() * lakeHouseTex.length);
    var xOff   = 2.0 + Math.random() * 4.0;    // set back 2-6 units behind the tree line
    var xBase  = side * (rw / 2 + 4.0 + xOff); // minimum 4 units outside the play lane
    var zInit  = SPAWN_Z + (hi / STAGE3_HOUSE_COUNT) * (Math.abs(SPAWN_Z) + 12);
    var tex    = lakeHouseTex[texIdx];
    var mat;
    if (tex) {
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
    } else {
      mat = new THREE.SpriteMaterial({ color: 0xC8A870, transparent: true, opacity: 0.90 });
    }
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);    // bottom-anchored: same as trees and boulders
    var hAspInit = (tex && tex.image && tex.image.naturalHeight > 0)
      ? tex.image.naturalWidth / tex.image.naturalHeight
      : 1.0;   // square fallback; late-patch corrects it once texture loads
    spr.scale.set(STAGE3_HOUSE_SCALE * hAspInit, STAGE3_HOUSE_SCALE, 1);
    spr.position.set(xBase, 0, zInit);
    scene.add(spr);
    bankHouses3.push({ sprite: spr, side: side, z: zInit, texIdx: texIdx });
  }
}

// Stage 5 bank decoration: tree stumps, farm houses, fishing supplies, broken-down cars.
// All bottom-anchored (center.y=0), aspect-correct from naturalWidth/naturalHeight,
// scattered on the banks (either side, outside the play channel), scrolling as a pool.
// Pool count = Math.max(1, Math.round(S5_FREQ_* * 16)) where 16 is the halved tree pool.
function initBankDecor5(rw) {
  var S5_POOL_BASE = 16;
  var stumpCount = Math.max(1, Math.round(S5_FREQ_TREE_STUMP   * S5_POOL_BASE));  // ~10
  var farmCount  = Math.max(1, Math.round(S5_FREQ_FARMHOUSE    * S5_POOL_BASE));  // ~6
  var fishCount  = Math.max(1, Math.round(S5_FREQ_FISHING      * S5_POOL_BASE));  // ~2
  var carCount   = Math.max(1, Math.round(S5_FREQ_BROKEN_CAR   * S5_POOL_BASE));  // ~1
  var zSpan = Math.abs(SPAWN_Z) + 12;

  function makeDecorSpr(tex, fallbackCol) {
    var mat = tex
      ? new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
      : new THREE.SpriteMaterial({ color: fallbackCol, transparent: true, opacity: 0.90 });
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);
    return spr;
  }
  function groundClutterX(rw5, side5) {
    return side5 * (rw5 / 2 + 1.2 + Math.random() * 3.0);
  }
  function setbackX(rw5, side5) {
    return side5 * (rw5 / 2 + 4.0 + 2.0 + Math.random() * 4.0);
  }

  // Tree stumps (ground clutter, close to bank)
  for (var si = 0; si < stumpCount; si++) {
    var sSide = si % 2 === 0 ? -1 : 1;
    var sTex  = stumpTex5;
    var sAsp  = (sTex && sTex.image && sTex.image.naturalHeight > 0)
      ? sTex.image.naturalWidth / sTex.image.naturalHeight : 1.0;
    var sspr  = makeDecorSpr(sTex, 0x5A4A30);
    sspr.scale.set(S5_STUMP_SCALE * sAsp, S5_STUMP_SCALE, 1);
    var sX = groundClutterX(rw, sSide);
    var sZ = SPAWN_Z + (si / stumpCount) * zSpan;
    sspr.position.set(sX, 0, sZ);
    scene.add(sspr);
    bankStumps5.push({ sprite: sspr, side: sSide, z: sZ });
  }

  // Farm houses (largest, set back from water, alternating farm-house-1 and farm-house-2)
  for (var fi = 0; fi < farmCount; fi++) {
    var fSide  = fi % 2 === 0 ? -1 : 1;
    var fTexI  = fi % 2;
    var fTex   = farmTex5[fTexI];
    var fAsp   = (fTex && fTex.image && fTex.image.naturalHeight > 0)
      ? fTex.image.naturalWidth / fTex.image.naturalHeight : 1.0;
    var fspr   = makeDecorSpr(fTex, 0xC8A870);
    fspr.scale.set(S5_FARMHOUSE_SCALE * fAsp, S5_FARMHOUSE_SCALE, 1);
    var fX = setbackX(rw, fSide);
    var fZ = SPAWN_Z + (fi / farmCount) * zSpan;
    fspr.position.set(fX, S5_FARMHOUSE_SEAT_Y, fZ);
    scene.add(fspr);
    bankFarms5.push({ sprite: fspr, side: fSide, z: fZ, texIdx: fTexI });
  }

  // Fishing supplies (ground clutter, close to bank)
  for (var fsi = 0; fsi < fishCount; fsi++) {
    var fsSide = fsi % 2 === 0 ? -1 : 1;
    var fsTex  = fishingTex5;
    var fsAsp  = (fsTex && fsTex.image && fsTex.image.naturalHeight > 0)
      ? fsTex.image.naturalWidth / fsTex.image.naturalHeight : 1.0;
    var fsspr  = makeDecorSpr(fsTex, 0x8A7A60);
    fsspr.scale.set(S5_FISHING_SCALE * fsAsp, S5_FISHING_SCALE, 1);
    var fsX = groundClutterX(rw, fsSide);
    var fsZ = SPAWN_Z + (fsi / fishCount) * zSpan;
    fsspr.position.set(fsX, 0, fsZ);
    scene.add(fsspr);
    bankFishing5.push({ sprite: fsspr, side: fsSide, z: fsZ });
  }

  // Broken-down cars (ground clutter, close to bank)
  for (var ci = 0; ci < carCount; ci++) {
    var cSide = ci % 2 === 0 ? -1 : 1;
    var cTex  = carTex5;
    var cAsp  = (cTex && cTex.image && cTex.image.naturalHeight > 0)
      ? cTex.image.naturalWidth / cTex.image.naturalHeight : 1.0;
    var cspr  = makeDecorSpr(cTex, 0x6A5A4A);
    cspr.scale.set(S5_CAR_SCALE * cAsp, S5_CAR_SCALE, 1);
    var cX = groundClutterX(rw, cSide);
    var cZ = SPAWN_Z + (ci / Math.max(carCount, 1)) * zSpan;
    cspr.position.set(cX, 0, cZ);
    scene.add(cspr);
    bankCars5.push({ sprite: cspr, side: cSide, z: cZ });
  }
}

// Stage 2 (Upper Kern) only: dense boulder shoreline using bankBoulderTex sprites.
// Rocks cluster right at the water edge (xOff 0.15-3.05 from bank inner edge), much
// larger than standard bank boulders (1.8-4.4 tall), and randomly horizontally flipped
// so no two boulders look identical. Entries go into bankBoulders3 so the existing
// update3() recycle loop drives them automatically.
function initStage2RockyShores(rw) {
  // 50 perimeter boulders: clustered at the channel boundary, submerged in water.
  // 70 field boulders: scattered across the full non-playable side water, varied sizes.
  // All use the same bankBoulders3 pool and recycle loop. No collision on any of these.
  var PERIM_COUNT = 50;
  var FIELD_COUNT = 70;
  var TOTAL       = PERIM_COUNT + FIELD_COUNT;
  for (var ri = 0; ri < TOTAL; ri++) {
    var side    = ri % 2 === 0 ? -1 : 1;
    var texIdx  = Math.floor(Math.random() * bankBoulderTex.length);
    var isPerim = ri < PERIM_COUNT;
    var xOff, bH, bY;
    if (isPerim) {
      xOff = Math.random() * 1.0;
      bH   = 2.2 + Math.random() * 2.4;
      bY   = -0.5 - Math.random() * 0.7;
    } else {
      xOff = 1.3 + Math.random() * 11.5;
      bH   = 0.8 + Math.random() * 3.0;
      bY   = -0.15 - Math.random() * 1.1;
    }
    var xBase  = side * (rw / 2 + xOff);
    var zInit  = SPAWN_Z + (ri / TOTAL) * (Math.abs(SPAWN_Z) + 12) + (Math.random() - 0.5) * 1.8;
    var bW     = bH * (0.75 + Math.random() * 0.85);
    var flipX  = Math.random() < 0.5 ? -1 : 1;
    var tex    = bankBoulderTex[texIdx];
    var mat;
    if (tex) {
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
    } else {
      mat = new THREE.SpriteMaterial({ color: 0x8A7060, transparent: true, opacity: 0.90 });
    }
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);
    spr.scale.set(bW * flipX, bH, 1);
    spr.position.set(xBase, bY, zInit);
    scene.add(spr);
    bankBoulders3.push({ sprite: spr, side: side, z: zInit, spread: isPerim ? 'perimeter' : 'field' });
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
var ZOOM3 = 1.08;  // Stage 3 UV zoom: show 1/ZOOM3 of image, centered horizontally
function buildStageBackdrop(stg) {
  var bd = stg.backdrop;
  if (!bd) return;
  // Stage 5: backdrop persists through sub-narrows; skip rebuild if already built
  if (stg.num === 5 && stageBackdropMesh !== null) return;

  // Backdrop plane - start with sky-blue fallback so any load failure is invisible
  var bdMat = new THREE.MeshBasicMaterial({ color: 0x87CEEB, fog: false });
  backdropMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 52), bdMat);
  backdropMesh.position.set(0, 26, -88);
  scene.add(backdropMesh);

  // Stages 2 and 3: shift backdrop center down 3 units so the bottom edge (y=-3) overlaps
  // below the water surface (y=0.15), closing the clear-color seam at the horizon.
  // Stage 1 position is untouched (remains y=26 from the position.set call above).
  if (stg.num === 2 || stg.num === 3 || stg.num === 4) {
    backdropMesh.position.y = 23;
  }

  // Stage 5: apply framing constants and record persistent handle for tuner + persistence guard
  if (stg.num === 5) {
    backdropMesh.scale.multiplyScalar(S5_BD_SCALE);
    backdropMesh.position.y += S5_BD_Y;
    stageBackdropMesh = backdropMesh;
  }

  // Capture current mesh so the async callback patches the RIGHT instance
  // even if buildWorld() is called again before the load finishes.
  var capMesh = backdropMesh;

  function applyBackdropTex(tex) {
    tex.magFilter    = THREE.NearestFilter;
    tex.minFilter    = THREE.NearestFilter;
    tex.generateMipmaps = false;
    // Stage 2: clamp + bottom-row trim only
    if (stg.num === 2) {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      var trimN = 6;
      var trimH = (tex.image && tex.image.naturalHeight) ? tex.image.naturalHeight : 1024;
      tex.offset.set(0, trimN / trimH);
      tex.repeat.set(1, (trimH - trimN) / trimH);
      console.log('[KRR BG TRIM] naturalHeight=' + trimH + ' N=' + trimN + ' offset.y=' + (trimN / trimH).toFixed(6) + ' repeat.y=' + ((trimH - trimN) / trimH).toFixed(6));
    } else if (stg.num === 3) {
      // Stage 3: clamp + bottom-row trim composed with ZOOM3 centered UV crop.
      // Vertical: anchor at bottom (horizon stays), crop from top by ZOOM3.
      // Horizontal: centered. One UV write; no stacking.
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      var trimN3 = 6;
      var trimH3 = (tex.image && tex.image.naturalHeight) ? tex.image.naturalHeight : 1024;
      var s3OffX = (1 - 1 / ZOOM3) / 2;
      var s3RepX = 1 / ZOOM3;
      var s3OffY = trimN3 / trimH3;
      var s3RepY = (trimH3 - trimN3) / trimH3 / ZOOM3;
      tex.offset.set(s3OffX, s3OffY);
      tex.repeat.set(s3RepX, s3RepY);
      console.log('[KRR BG ZOOM S3] ZOOM3=' + ZOOM3 + ' final offset=(' + s3OffX.toFixed(4) + ',' + s3OffY.toFixed(4) + ') repeat=(' + s3RepX.toFixed(4) + ',' + s3RepY.toFixed(4) + ')');
    } else if (stg.num === 4) {
      // Stage 4 (Kern Canyon): clamp + bottom-row trim N=6, full-width (no zoom)
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      var trimN4 = 6;
      var trimH4 = (tex.image && tex.image.naturalHeight) ? tex.image.naturalHeight : 1024;
      tex.offset.set(STAGE4_BD_SHIFT_X, trimN4 / trimH4);
      tex.repeat.set(1, (trimH4 - trimN4) / trimH4);
      console.log('[KRR BG TRIM S4] shiftX=' + STAGE4_BD_SHIFT_X + ' N=6 offset.y=' + (trimN4 / trimH4).toFixed(6) + ' repeat.y=' + ((trimH4 - trimN4) / trimH4).toFixed(6));
    } else if (stg.num === 5) {
      // Stage 5 (Bakersfield Terminus): clamp + N=6 bottom trim, no X shift
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      var trimN5 = 6;
      var natH5 = (tex.image && tex.image.naturalHeight) ? tex.image.naturalHeight : 1024;
      var natW5 = (tex.image && tex.image.naturalWidth)  ? tex.image.naturalWidth  : 1536;
      tex.offset.set(0, trimN5 / natH5);
      tex.repeat.set(1, (natH5 - trimN5) / natH5);
      console.log('[KRR BG TRIM S5] natW=' + natW5 + ' natH=' + natH5 + ' N=6 offset.y=' + (trimN5 / natH5).toFixed(6) + ' repeat.y=' + ((natH5 - trimN5) / natH5).toFixed(6));
    }
    tex.needsUpdate  = true;
    stageTexCache[bd.img] = tex;
    if (capMesh.material) {
      capMesh.material.map   = tex;
      capMesh.material.color.set(0xFFFFFF);
      capMesh.material.needsUpdate = true;
    }
  }

  if (stageTexCache[bd.img]) {
    // Preload already finished - apply immediately, no async flash
    applyBackdropTex(stageTexCache[bd.img]);
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

  // Animated waterfall strips (only when this stage has a waterfall defined)
  if (bd.wf) {
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
    // scale(1.60, 1.60): ~73% of lane width (LANE_W=2.2), visually fills the lane.
    // center(0.5, 0): bottom-anchored so yPos=0.08 puts the base just at the waterline.
    // Collision is single-lane/z-range -- unchanged in checkCollisions3().
    // renderOrder=3 renders above water (renderOrder=2).
    var bIdx = Math.floor(Math.random() * boulderObsTex.length);
    var bTex = boulderObsTex[bIdx];
    var bMat;
    if (bTex) {
      bMat = new THREE.SpriteMaterial({ map: bTex, transparent: true, alphaTest: 0.05 });
    } else {
      bMat = new THREE.SpriteMaterial({ color: 0x7C2D12, transparent: true, opacity: 0.90 });
    }
    var bSpr = new THREE.Sprite(bMat);
    bSpr.center.set(0.5, 0);
    bSpr.scale.set(1.60, 1.60, 1);
    bSpr.renderOrder = 3;
    return bSpr;
  }
  if (type === 'boulder_wide') {
    // 2-lane boulder: sprite spans two adjacent lanes (~LANE_W*1.85 wide, 1.9 tall).
    // center(0.5, 0): bottom-anchored at yPos=0.08 so base sits at the waterline.
    // Collision handled by lane + lane2 check in checkCollisions3().
    // renderOrder=3 renders above water.
    var bwIdx = Math.floor(Math.random() * boulderObsTex.length);
    var bwTex = boulderObsTex[bwIdx];
    var bwMat;
    if (bwTex) {
      bwMat = new THREE.SpriteMaterial({ map: bwTex, transparent: true, alphaTest: 0.05 });
    } else {
      bwMat = new THREE.SpriteMaterial({ color: 0x7C2D12, transparent: true, opacity: 0.90 });
    }
    var bwSpr = new THREE.Sprite(bwMat);
    bwSpr.center.set(0.5, 0);
    bwSpr.scale.set(LANE_W * 1.85, 1.9, 1);
    bwSpr.renderOrder = 3;
    return bwSpr;
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
    var cIdx = Math.floor(Math.random() * cartTex5Obs.length);
    var cTex = cartTex5Obs[cIdx];
    var cMat;
    if (cTex) {
      cMat = new THREE.SpriteMaterial({ map: cTex, transparent: true, alphaTest: 0.05 });
    } else {
      cMat = new THREE.SpriteMaterial({ color: 0x9CA3AF, transparent: true, opacity: 0.90 });
    }
    var cSpr = new THREE.Sprite(cMat);
    cSpr.center.set(0.5, 0);
    var cH5 = 1.82;
    cSpr.scale.set(cH5 * cartTex5ObsAsp[cIdx], cH5, 1);
    cSpr.renderOrder = 3;
    return cSpr;
  }
  if (type === 'fallen_log') {
    // Sprite spans (curLanes-1) lanes; gap lane is one edge lane.
    // Width forced to the blocked span; height derived from cached aspect ratio.
    // fallenLogAlt5 was already incremented by spawnObs3 before this call.
    var lgIdx = fallenLogAlt5 % 2;
    var lgTex = fallenLogTex5[lgIdx];
    var lgMat;
    if (lgTex) {
      lgMat = new THREE.SpriteMaterial({ map: lgTex, transparent: true, alphaTest: 0.05 });
    } else {
      lgMat = new THREE.SpriteMaterial({ color: 0x78350F, transparent: true, opacity: 0.90 });
    }
    var lgSpr = new THREE.Sprite(lgMat);
    lgSpr.center.set(0.5, 0);
    var lgW = (curLanes - 1) * LANE_W;
    var lgH = (fallenLogTex5Asp[lgIdx] > 0) ? (lgW / fallenLogTex5Asp[lgIdx]) : 1.4;
    lgSpr.scale.set(lgW, lgH, 1);
    lgSpr.renderOrder = 3;
    return lgSpr;
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

  // Per-stage cloud count: Stage 2 shows 2 of 7. All others show all 7.
  var STAGE2_CLOUD_VIS = 2;
  for (var ci2 = 0; ci2 < clouds3.length; ci2++) {
    clouds3[ci2].visible = (idx !== 1) || (ci2 < STAGE2_CLOUD_VIS);
  }

  // Stages 2 and 3: lift clouds 4 units so they clear the backdrop scenery.
  // Stage 1 unchanged (offset 0). Log first and last y so eye-tuning is easy.
  var CLOUD_Y_LIFT = (idx === 1 || idx === 2) ? 4 : 0;
  for (var ci3 = 0; ci3 < clouds3.length; ci3++) {
    clouds3[ci3].position.y = clouds3[ci3].userData.baseY + CLOUD_Y_LIFT;
  }
  console.log('[KRR CLOUD Y] stageIdx=' + idx + ' lift=' + CLOUD_Y_LIFT +
    ' sample y=' + clouds3[0].position.y + '..' + clouds3[clouds3.length - 1].position.y +
    ' (base range 21-25)');

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
  const stg  = STAGES3[stageIdx];
  const isFw = Math.random() < stg.fwFreq;
  const type = isFw
    ? stg.fwType
    : stg.obsTypes[Math.floor(Math.random() * stg.obsTypes.length)];

  // Upgrade single boulder to 2-lane boulder 35% of the time when 3+ lanes exist.
  // Fairness guard: boulder_wide requires curLanes >= 3 so at least 1 lane stays open.
  var actualType = type;
  if (!isFw && type === 'boulder' && curLanes >= 3 && Math.random() < 0.35) {
    actualType = 'boulder_wide';
  }
  // Suppress fallen_log at narrows (< 3 lanes) -- auto-fires at mile 150 and 160; fall back to boulder.
  if (!isFw && actualType === 'fallen_log' && curLanes < 3) {
    actualType = 'boulder';
  }

  var lane, lane2, xPos, gapLane;
  if (isFw) {
    lane  = -1;
    lane2 = undefined;
    xPos  = 0;
  } else if (actualType === 'boulder_wide') {
    // Pick a random pair of adjacent lanes; guaranteed < curLanes so 1+ lane stays free.
    lane  = Math.floor(Math.random() * (curLanes - 1));
    lane2 = lane + 1;
    xPos  = (laneXPos(lane) + laneXPos(lane2)) / 2;
  } else if (actualType === 'fallen_log') {
    // Alternate roots-left / roots-right art; gap follows the heavy end (roots side is blocked).
    // lgIdx=0 (fallen-log-1.png, roots-left): gap = rightmost lane (curLanes-1)
    // lgIdx=1 (fallen-log-2.png, roots-right): gap = leftmost lane (0)
    fallenLogAlt5++;
    var lgIdx5 = fallenLogAlt5 % 2;
    gapLane = (lgIdx5 === 0) ? (curLanes - 1) : 0;
    if (gapLane === 0) {
      // gap on left: blocked lanes 1..curLanes-1
      xPos = (laneXPos(1) + laneXPos(curLanes - 1)) / 2;
    } else {
      // gap on right: blocked lanes 0..curLanes-2
      xPos = (laneXPos(0) + laneXPos(curLanes - 2)) / 2;
    }
    lane  = gapLane;
    lane2 = undefined;
  } else {
    lane  = Math.floor(Math.random() * curLanes);
    lane2 = undefined;
    xPos  = laneXPos(lane);
  }

  const mesh = makeObsMesh(actualType, isFw);

  let yPos;
  if (isFw)                               yPos = 0;
  else if (actualType === 'boulder')      yPos = 0.08;
  else if (actualType === 'boulder_wide') yPos = 0.08;
  else if (actualType === 'river_wash')   yPos = 0.52;
  else if (actualType === 'shopping_cart') yPos = S5_CART_SEAT_Y;
  else if (actualType === 'fallen_log')   yPos = S5_LOG_SEAT_Y;
  else                                    yPos = 0;

  mesh.position.set(xPos, yPos, SPAWN_Z);
  mesh.traverse(c => { if (c.isMesh) c.castShadow = true; });
  scene.add(mesh);
  obstacles3.push({ mesh, lane, z: SPAWN_Z, resolved: false, fullWidth: isFw, type: actualType, lane2, gapLane });
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

  // Scroll bank boulder sprites (stages 2-4); recycle with new random size + texture
  for (var bbi = 0; bbi < bankBoulders3.length; bbi++) {
    var bb3 = bankBoulders3[bbi];
    bb3.z += spd;
    bb3.sprite.position.z = bb3.z;
    if (bb3.z > DESPAWN_Z + 2) {
      bb3.z = SPAWN_Z - Math.random() * 8;
      var bbTexIdx = Math.floor(Math.random() * bankBoulderTex.length);
      var bbRw     = riverWidth();
      var bbXOff, bbH, bbW, bbXPos;
      if (stageIdx === 1) {
        var bbFlip = Math.random() < 0.5 ? -1 : 1;
        if (bb3.spread === 'perimeter') {
          // Perimeter: tight cluster at channel boundary, substantially submerged
          bbXOff = Math.random() * 1.0;
          bbH    = 2.2 + Math.random() * 2.4;
          bbW    = bbH * (0.75 + Math.random() * 0.85);
          bbXPos = bb3.side * (bbRw / 2 + bbXOff);
          bb3.sprite.scale.set(bbW * bbFlip, bbH, 1);
          bb3.sprite.position.y = -0.5 - Math.random() * 0.7;
        } else {
          // Field: scattered across non-playable side water, varied size and submersion
          bbXOff = 1.3 + Math.random() * 11.5;
          bbH    = 0.8 + Math.random() * 3.0;
          bbW    = bbH * (0.75 + Math.random() * 0.85);
          bbXPos = bb3.side * (bbRw / 2 + bbXOff);
          bb3.sprite.scale.set(bbW * bbFlip, bbH, 1);
          bb3.sprite.position.y = -0.15 - Math.random() * 1.1;
        }
      } else {
        // Stages 3-4: normal bank boulder spread
        bbXOff = Math.floor(Math.random() * 4) * 1.6 + 0.3;
        bbH    = 1.2 + Math.random() * 1.6;
        bbW    = bbH * (0.85 + Math.random() * 0.70);
        bbXPos = bb3.side * (bbRw / 2 + 1.0 + bbXOff);
        bb3.sprite.scale.set(bbW, bbH, 1);
      }
      bb3.sprite.position.x = bbXPos;
      bb3.sprite.position.z = bb3.z;
      if (bankBoulderTex[bbTexIdx]) {
        bb3.sprite.material.map = bankBoulderTex[bbTexIdx];
        bb3.sprite.material.needsUpdate = true;
      }
    }
  }

  // Scroll Stage 4 canyon wall boulders; size is updated per-frame for smooth depth taper (funnel)
  for (var cwi = 0; cwi < canyonWalls4.length; cwi++) {
    var cw = canyonWalls4[cwi];
    cw.z += spd;
    if (cw.z > DESPAWN_Z + 2) {
      // recycle: reset z and re-randomize across full slope surface
      cw.z = SPAWN_Z - Math.random() * 8;
      var cwDx     = WALL4_INNER_GAP + Math.random() * (WALL4_COVER_X - WALL4_INNER_GAP);
      var cwYSlope = -0.5 + cwDx * ((WALL4_ROCK_TOP + 0.5) / WALL4_ROCK_WIDTH);
      var cwYPos   = cwYSlope + (Math.random() - 0.5) * 2.0 * WALL4_Y_JITTER;
      var cwXPos   = cw.side * (cw.eVal + cwDx);
      if (cw.side > 0 && cwXPos <  cw.minAbs) cwXPos =  cw.minAbs;
      if (cw.side < 0 && cwXPos > -cw.minAbs) cwXPos = -cw.minAbs;
      var cwBand   = Math.min(7, Math.floor(cwDx / WALL4_COVER_X * 8));
      cw.sprite.renderOrder = 8 - cwBand;
      cw.sprite.position.x = cwXPos;
      cw.sprite.position.y = cwYPos;
      cw.baseH   = WALL4_SCALE_BASE * (1.0 - WALL4_SCALE_SPREAD * 0.5 + Math.random() * WALL4_SCALE_SPREAD);
      cw.wFactor = 0.80 + Math.random() * 0.65;
      cw.flipX   = Math.random() < 0.5 ? 1 : -1;
      var cwRot  = (Math.random() - 0.5) * 2.0 * WALL4_ROT_RANGE * (Math.PI / 180);
      var cwTv   = 1.0 - Math.random() * WALL4_TINT_JITTER;
      var cwTexIdx = Math.floor(Math.random() * bankBoulderTex.length);
      cw.sprite.material.rotation = cwRot;
      cw.sprite.material.color.setRGB(cwTv, cwTv, cwTv);
      if (bankBoulderTex[cwTexIdx]) {
        cw.sprite.material.map = bankBoulderTex[cwTexIdx];
        cw.sprite.material.needsUpdate = true;
      }
    }
    // per-frame: depth taper (t=0 far/short, t=1 near/tall) applied every frame so funnel is smooth
    cw.sprite.position.z = cw.z;
    var cwT  = Math.max(0, Math.min(1, (cw.z - SPAWN_Z) / (DESPAWN_Z - SPAWN_Z)));
    var cwDs = WALL4_FAR_SCALE + cwT * (WALL4_NEAR_SCALE - WALL4_FAR_SCALE);
    var cwH  = cw.baseH * WALL4_SCALE_MULT * cwDs;
    cw.sprite.scale.set(cwH * cw.wFactor * cw.flipX, cwH, 1);
  }

  // Scroll lake-house sprites (Stage 3 only); recycle with randomized x-offset and texture
  for (var hsi = 0; hsi < bankHouses3.length; hsi++) {
    var hse = bankHouses3[hsi];
    hse.z += spd;
    hse.sprite.position.z = hse.z;
    if (hse.z > DESPAWN_Z + 2) {
      hse.z = SPAWN_Z - Math.random() * 12;
      var hsRw  = riverWidth();
      var hsOff = 2.0 + Math.random() * 4.0;
      hse.sprite.position.x = hse.side * (hsRw / 2 + 4.0 + hsOff);
      hse.sprite.position.z = hse.z;
      var hTexIdx = Math.floor(Math.random() * lakeHouseTex.length);
      hse.texIdx = hTexIdx;
      if (lakeHouseTex[hTexIdx]) {
        hse.sprite.material.map = lakeHouseTex[hTexIdx];
        hse.sprite.material.needsUpdate = true;
        var hRecycleAsp = (lakeHouseTex[hTexIdx].image && lakeHouseTex[hTexIdx].image.naturalHeight > 0)
          ? lakeHouseTex[hTexIdx].image.naturalWidth / lakeHouseTex[hTexIdx].image.naturalHeight
          : 1.0;
        hse.sprite.scale.set(STAGE3_HOUSE_SCALE * hRecycleAsp, STAGE3_HOUSE_SCALE, 1);
      }
    }
  }

  // Stage 5 bank decor: scroll and recycle stumps, farm houses, fishing supplies, cars
  var d5rw = riverWidth();
  for (var st5i = 0; st5i < bankStumps5.length; st5i++) {
    var st5 = bankStumps5[st5i];
    st5.z += spd; st5.sprite.position.z = st5.z;
    if (st5.z > DESPAWN_Z + 2) {
      st5.z = SPAWN_Z - Math.random() * 8;
      st5.sprite.position.x = st5.side * (d5rw / 2 + 1.2 + Math.random() * 3.0);
      st5.sprite.position.z = st5.z;
      if (stumpTex5) {
        st5.sprite.material.map = stumpTex5; st5.sprite.material.needsUpdate = true;
        var stAsp = (stumpTex5.image && stumpTex5.image.naturalHeight > 0)
          ? stumpTex5.image.naturalWidth / stumpTex5.image.naturalHeight : 1.0;
        st5.sprite.scale.set(S5_STUMP_SCALE * stAsp, S5_STUMP_SCALE, 1);
      }
    }
  }
  for (var fm5i = 0; fm5i < bankFarms5.length; fm5i++) {
    var fm5 = bankFarms5[fm5i];
    fm5.z += spd; fm5.sprite.position.z = fm5.z;
    if (fm5.z > DESPAWN_Z + 2) {
      fm5.z = SPAWN_Z - Math.random() * 12;
      fm5.sprite.position.x = fm5.side * (d5rw / 2 + 4.0 + 2.0 + Math.random() * 4.0);
      fm5.sprite.position.z = fm5.z;
      var fmTexI = Math.floor(Math.random() * 2);
      fm5.texIdx = fmTexI;
      var fmTex5 = farmTex5[fmTexI];
      if (fmTex5) {
        fm5.sprite.material.map = fmTex5; fm5.sprite.material.needsUpdate = true;
        var fmAsp = (fmTex5.image && fmTex5.image.naturalHeight > 0)
          ? fmTex5.image.naturalWidth / fmTex5.image.naturalHeight : 1.0;
        fm5.sprite.scale.set(S5_FARMHOUSE_SCALE * fmAsp, S5_FARMHOUSE_SCALE, 1);
      }
    }
  }
  for (var fs5i = 0; fs5i < bankFishing5.length; fs5i++) {
    var fs5 = bankFishing5[fs5i];
    fs5.z += spd; fs5.sprite.position.z = fs5.z;
    if (fs5.z > DESPAWN_Z + 2) {
      fs5.z = SPAWN_Z - Math.random() * 8;
      fs5.sprite.position.x = fs5.side * (d5rw / 2 + 1.2 + Math.random() * 3.0);
      fs5.sprite.position.z = fs5.z;
      if (fishingTex5) {
        fs5.sprite.material.map = fishingTex5; fs5.sprite.material.needsUpdate = true;
        var fsAsp5 = (fishingTex5.image && fishingTex5.image.naturalHeight > 0)
          ? fishingTex5.image.naturalWidth / fishingTex5.image.naturalHeight : 1.0;
        fs5.sprite.scale.set(S5_FISHING_SCALE * fsAsp5, S5_FISHING_SCALE, 1);
      }
    }
  }
  for (var cr5i = 0; cr5i < bankCars5.length; cr5i++) {
    var cr5 = bankCars5[cr5i];
    cr5.z += spd; cr5.sprite.position.z = cr5.z;
    if (cr5.z > DESPAWN_Z + 2) {
      cr5.z = SPAWN_Z - Math.random() * 8;
      cr5.sprite.position.x = cr5.side * (d5rw / 2 + 1.2 + Math.random() * 3.0);
      cr5.sprite.position.z = cr5.z;
      if (carTex5) {
        cr5.sprite.material.map = carTex5; cr5.sprite.material.needsUpdate = true;
        var crAsp5 = (carTex5.image && carTex5.image.naturalHeight > 0)
          ? carTex5.image.naturalWidth / carTex5.image.naturalHeight : 1.0;
        cr5.sprite.scale.set(S5_CAR_SCALE * crAsp5, S5_CAR_SCALE, 1);
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
    // fallen_log: safe only in gapLane; instant game-over on any blocked lane.
    if (o.type === 'fallen_log') {
      if (!player3.isJumping && player3.targetLane !== o.gapLane) {
        if (player3.hasShield) { player3.hasShield = false; continue; }
        endRun3(false);
      }
      continue;
    }
    // lane2 is set on boulder_wide: hit if player is in lane OR lane2.
    const inHitLane = (o.lane === player3.targetLane) ||
                      (o.lane2 !== undefined && o.lane2 === player3.targetLane);
    const safe = player3.isJumping || (!o.fullWidth && !inHitLane);
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

  // Scroll Stage 3 grass textures (ground plane + bank segments) toward the player
  for (var gbi = 0; gbi < grassBankMats3.length; gbi++) {
    grassBankMats3[gbi].offset.y -= 0.0005 * GRASS3_SCROLL_MULT;
  }

  // Stage 5: scroll bank segment clones (same mechanism as Stages 1/3/4; master-only was imperceptibly slow)
  for (var s5i = 0; s5i < swampBankMats5.length; s5i++) {
    swampBankMats5[s5i].offset.y -= 0.0005 * S5_TERR_SCROLL;
    if (s5i === 0 && stageIdx === 4 && frameN % 60 === 0) {
      console.log('[KRR TERRDBG] bankOffY=' + swampBankMats5[0].offset.y.toFixed(4) + ' gndOffY=' + (s5GndScrollTex ? s5GndScrollTex.offset.y.toFixed(4) : 'null') + ' scroll=' + S5_TERR_SCROLL + ' world=' + curSpd3.toFixed(4));
    }
  }
  // Stage 5: scroll the ground plane's dedicated clone at the same rate as bank segment clones
  if (stageIdx === 4 && s5GndScrollTex) {
    s5GndScrollTex.offset.y -= 0.0005 * S5_TERR_SCROLL;
  }

  // Scroll Stage 4 pebble floor textures toward player, tied to curSpd3 so they match world movement.
  // Ground plane is PlaneGeometry(200,170); after rotation UV-V maps to 170 world-Z units.
  // UV delta = spd * repeat / plane_z_extent = curSpd3 * WALL4_FLOOR_REPEAT / 170
  if (floorMats4.length > 0) {
    var floorDelta = curSpd3 * WALL4_FLOOR_REPEAT / 170 * WALL4_FLOOR_SCROLL_MULT;
    for (var f4i = 0; f4i < floorMats4.length; f4i++) {
      floorMats4[f4i].offset.y -= floorDelta;
    }
  }

  // Scroll Stage 4 rock wall textures along U (Z axis) to match boulder/world movement.
  // Wall quad spans z_far to z_near (74 world units). UV delta = curSpd3 * RPT_U / z_extent.
  if (rockWallMats4.length > 0) {
    var rwDelta = curSpd3 * WALL4_ROCK_RPT_U / 74 * WALL4_ROCK_SCROLL_MULT;
    for (var rw4i = 0; rw4i < rockWallMats4.length; rw4i++) {
      rockWallMats4[rw4i].offset.x += rwDelta;
    }
  }

  // Drift clouds slowly downstream; loop back to the far end when they pass the threshold.
  // Scale grows from CLOUD_START_SCALE to CLOUD_END_SCALE as z travels -96 -> -38.
  for (var ci = 0; ci < clouds3.length; ci++) {
    clouds3[ci].position.z += clouds3[ci].userData.spd;
    if (clouds3[ci].position.z > -38) clouds3[ci].position.z = -96;
    var ct = (clouds3[ci].position.z + 96) / 58;
    ct = Math.max(0, Math.min(1, ct));
    ct = ct * ct * (3 - 2 * ct);
    var cMult = CLOUD_START_SCALE + (CLOUD_END_SCALE - CLOUD_START_SCALE) * ct;
    clouds3[ci].scale.set(CLOUD_BASE_W * cMult, CLOUD_BASE_H * cMult, 1);
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

// ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
// Jump the player to any stage's start mile for fast local testing.
// Stage start miles: 1=0, 2=33, 3=66, 4=99, 5=132.
// To remove: delete this block, the DEV_STAGE_JUMP const above, the
// key handler addition below, and the #dev-stage-label in game-dev.html.
function devJumpToStage(idx) {
  var startMile = (idx === 0) ? 0 : STAGES3[idx - 1].endMile;
  distance3  = startMile * MI_PER_PX;
  subsFired3 = new Set();
  applyStage3(idx, 'DEV: ' + STAGES3[idx].name);
}
// ===== END TEMP DEV STAGE JUMP =====

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
    // ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
    if (DEV_STAGE_JUMP && e.key >= '1' && e.key <= '5') {
      devJumpToStage(parseInt(e.key, 10) - 1);
    }
    // ===== END TEMP DEV STAGE JUMP =====
    // ===== TEMP STAGE5 WATER TUNER (REMOVE BEFORE LAUNCH) =====
    // z/x = R -/+, c/v = G -/+, b/n = B -/+ (live water color; Stage 5 only)
    if (stageIdx === 4 && waterMesh && waterMesh.material && waterMesh.material.color) {
      var wc = waterMesh.material.color;
      var step = 0.02;
      if (e.key === 'z') { wc.r = Math.max(0, wc.r - step); }
      if (e.key === 'x') { wc.r = Math.min(1, wc.r + step); }
      if (e.key === 'c') { wc.g = Math.max(0, wc.g - step); }
      if (e.key === 'v') { wc.g = Math.min(1, wc.g + step); }
      if (e.key === 'b') { wc.b = Math.max(0, wc.b - step); }
      if (e.key === 'n') { wc.b = Math.min(1, wc.b + step); }
      if ('zxcvbn'.indexOf(e.key) !== -1) {
        console.log('[KRR WATER5] hex=0x' + wc.getHexString() + ' r=' + wc.r.toFixed(3) + ' g=' + wc.g.toFixed(3) + ' b=' + wc.b.toFixed(3));
      }
    }
    // ===== END TEMP STAGE5 WATER TUNER =====

    // ===== TEMP STAGE5 BACKDROP FRAMING TUNER (REMOVE BEFORE LAUNCH) =====
    // o/p = zoom out/in (scale); k/i = plane down/up
    if (stageIdx === 4 && stageBackdropMesh) {
      if (e.key === 'o') { S5_BD_SCALE = Math.max(0.40, S5_BD_SCALE - 0.02); stageBackdropMesh.scale.setScalar(S5_BD_SCALE); }
      if (e.key === 'p') { S5_BD_SCALE = Math.min(2.00, S5_BD_SCALE + 0.02); stageBackdropMesh.scale.setScalar(S5_BD_SCALE); }
      if (e.key === 'k') { S5_BD_Y -= 0.5; stageBackdropMesh.position.y -= 0.5; }
      if (e.key === 'i') { S5_BD_Y += 0.5; stageBackdropMesh.position.y += 0.5; }
      if ('opki'.indexOf(e.key) !== -1) {
        console.log('[KRR BD5] scale=' + S5_BD_SCALE.toFixed(3) + ' yOff=' + S5_BD_Y.toFixed(2));
      }
    }
    // ===== END TEMP STAGE5 BACKDROP FRAMING TUNER =====

    // ===== TEMP STAGE5 TERRAIN TUNER (REMOVE BEFORE LAUNCH) =====
    // t/g = repeatX -/+ ; y/h = repeatY -/+ ; u/j = scroll -/+ ; [ / ] = seatY down/up ; m = toggle width mirror
    // T = master (source for future bank clones); G = ground plane clone (live visible surface)
    if (stageIdx === 4 && swampTerrainTex) {
      var T = swampTerrainTex;
      var G = s5GndScrollTex;
      if (e.key === 't') { S5_TERR_REPEAT_X = Math.max(0.25, +(S5_TERR_REPEAT_X - 0.25).toFixed(2)); T.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); if (G) { G.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); G.needsUpdate = true; } }
      if (e.key === 'g') { S5_TERR_REPEAT_X = +(S5_TERR_REPEAT_X + 0.25).toFixed(2); T.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); if (G) { G.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); G.needsUpdate = true; } }
      if (e.key === 'y') { S5_TERR_REPEAT_Y = Math.max(0.25, +(S5_TERR_REPEAT_Y - 0.25).toFixed(2)); T.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); if (G) { G.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); G.needsUpdate = true; } }
      if (e.key === 'h') { S5_TERR_REPEAT_Y = +(S5_TERR_REPEAT_Y + 0.25).toFixed(2); T.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); if (G) { G.repeat.set(S5_TERR_REPEAT_X, S5_TERR_REPEAT_Y); G.needsUpdate = true; } }
      if (e.key === 'u') { S5_TERR_SCROLL = Math.max(0, +(S5_TERR_SCROLL - 0.1).toFixed(2)); }
      if (e.key === 'j') { S5_TERR_SCROLL = +(S5_TERR_SCROLL + 0.1).toFixed(2); }
      if (e.key === '[') { S5_TERR_Y -= 0.2; T.offset.y -= 0.2; if (G) G.offset.y -= 0.2; }
      if (e.key === ']') { S5_TERR_Y += 0.2; T.offset.y += 0.2; if (G) G.offset.y += 0.2; }
      if (e.key === 'm') { T.wrapS = (T.wrapS === THREE.MirroredRepeatWrapping) ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping; T.needsUpdate = true; if (G) { G.wrapS = T.wrapS; G.needsUpdate = true; } }
      if ('tgyhuj[]m'.indexOf(e.key) !== -1) {
        console.log('[KRR TERR5] repX=' + S5_TERR_REPEAT_X + ' repY=' + S5_TERR_REPEAT_Y + ' scroll=' + S5_TERR_SCROLL + ' seatY=' + S5_TERR_Y.toFixed(2) + ' wrapS=' + (T.wrapS === THREE.MirroredRepeatWrapping ? 'mirror' : 'repeat'));
      }
    }
    // ===== END TEMP STAGE5 TERRAIN TUNER =====

    // ===== TEMP STAGE5 FARMHOUSE SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // , = seat down (more negative, lower into ground) ; . = seat up
    if (stageIdx === 4) {
      var fsmoved = false;
      if (e.key === ',') { S5_FARMHOUSE_SEAT_Y -= 0.05; fsmoved = true; }
      if (e.key === '.') { S5_FARMHOUSE_SEAT_Y += 0.05; fsmoved = true; }
      if (fsmoved) {
        for (var fsti = 0; fsti < bankFarms5.length; fsti++) {
          bankFarms5[fsti].sprite.position.y = S5_FARMHOUSE_SEAT_Y;
        }
        console.log('[KRR FARMSEAT] y=' + S5_FARMHOUSE_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP STAGE5 FARMHOUSE SEAT TUNER =====

    // ===== TEMP STAGE5 LOG SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // ; = logs down (more negative, lower toward channel) ; ' = logs up
    if (stageIdx === 4) {
      var lgsm = false;
      if (e.key === ';') { S5_LOG_SEAT_Y -= 0.03; lgsm = true; }
      if (e.key === "'") { S5_LOG_SEAT_Y += 0.03; lgsm = true; }
      if (lgsm) {
        for (var lgsi = 0; lgsi < obstacles3.length; lgsi++) {
          if (obstacles3[lgsi].type === 'fallen_log') {
            obstacles3[lgsi].mesh.position.y = S5_LOG_SEAT_Y;
          }
        }
        console.log('[KRR LOGSEAT] y=' + S5_LOG_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP STAGE5 LOG SEAT TUNER =====

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
