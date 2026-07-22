// ================================================================
// KERN RIVER RUN - game-3d.js  (Visual Upgrade)
// Isolated Three.js 3D experiment. game-2d-backup.html / game.js untouched.
// ================================================================

// ── CONSTANTS ────────────────────────────────────────────────────
const LANE_W    = 2.2;
const SPAWN_Z   = -65;
const DESPAWN_Z = 9;
// Bank segment chain geometry -- must match buildWorld() values; used in per-frame scroll loop.
const BK_SEG_Z  = 5.5;  // world-Z depth of one segment (box depth = BK_SEG_Z + 0.25)
const BK_SEG_N  = 18;   // segments per side; chain length = BK_SEG_N * BK_SEG_Z = 99
const BANK_W0   = 5.0;  // base segment width for meander sine
const BANK_AMP  = 2.8;  // meander amplitude
const BANK_FREQ = 0.048; // meander spatial frequency (radians per world unit)
var JUMP_DURATION    = 120;  // frames airborne at 60fps (~2.0 sec); +20% for trick breathing room
var JUMP_HEIGHT      = 3.36; // world units at apex; +20% (was 2.8)
var JUMP_ARC_FLATTEN = 0.60; // exponent < 1 broadens the sin peak into a hang plateau; 1.0 = pure sine
// Jump body animation (layered on torso rotation, not the arc itself)
var JUMP_CROUCH_AMOUNT = 0.18; // rad: torso leans forward at liftoff anticipation
var JUMP_LIFT_AMOUNT   = 0.14; // rad: torso arches back during the push off
var JUMP_LAND_SQUASH   = 0.12; // rad: torso compresses forward on re-entry
// Boat pitch through the jump (rotation.x on playerGroup; positive = nose up)
var JUMP_PITCH_UP   = 0.25;  // rad nose-up on launch (peak at t=0.25)
var JUMP_PITCH_DOWN = -0.18; // rad nose-down on re-entry (peak at t=0.95; negative = nose down)
// Tail whip: steering-driven yaw+roll kick, unwinds to 0 before landing
var JUMP_WHIP_YAW  = 0.35;  // rad: tail swings out in the steering direction
var JUMP_WHIP_ROLL = 0.20;  // rad: roll lean into the whip (heels toward the kick)
// Air trick (second spacebar press while airborne)
var _airTrick          = false;
var _airTrickStartFrame = 0;
var _airTrickType      = '';   // 'roll' | 'flip' | 'spin'
var _airTrickDir       = 1;
// Trick + spin scoring
var TRICK_BONUS    = 500;   // points for a flair trick (roll / flip / spin)
var SPIN_PTS_DEG   = 2;     // points per degree of total air-spin on landing (DARING only)
var SPIN_MIN_DEG   = 30;    // minimum degrees before any spin bonus is awarded
// Air-spin: held A/D during jump accumulates yaw; landing snaps to forward or backward.
var AIR_YAW_RATE = 0.05;    // rad/frame while steer key held airborne
var _airYaw      = 0;       // yaw accumulated this jump (resolved at landing)
var _baseFacingY = 0;       // persistent boat-base facing: 0 = forward, Math.PI = backward
var _reversed    = false;   // true = facing backward; steering is inverted
var _settleYawFrom = 0;     // rotation.y captured at the moment of landing
var _settleYawT    = 1.0;   // settle progress: 1.0 = done (not settling)
// Water re-entry splash constants
var SPLASH_COUNT    = 28;   // droplets on landing
var SPLASH_SPREAD   = 1.8;  // X offset (world units) for port/starboard hull rings
var SPLASH_SIZE     = 5.5;  // max ring scale on landing
var SPLASH_LIFETIME = 42;   // ring expand duration (frames)
const SPF             = 2; // kept for reference; no longer drives score3
var ORANGE_VALUE      = [100, 150, 200, 300, 500]; // pts per orange, stage index 0-4; edit array to tune
var ORANGE_FLIGHT_MS  = 350;  // ms for collected orange to arc into basket; < / > to tune
var SWELL_ORANGE_LOSS = 2; // oranges stolen per river_wash hit; Shift+Z/X to tune
var POPUP_FONT_PX = 32;   // score-popup canvas font size (px); Shift+F6/F7 to tune
var POPUP_RISE    = 0.80; // world units popup rises over lifetime; Shift+F8/F9 to tune
// ── Basket position / appearance (all in playerGroup local space)
var BASKET_X       = 0.00;  // X offset in playerGroup; Shift+&/* to tune
var BASKET_Y       = 0.41;  // Y center; basket bottom = Y-0.11, stern deck = BOAT_WALL_H+GUNWALE_H = 0.30; Shift+!/@ to tune
var BASKET_Z       = 0.82;  // Z offset stern-ward (hull inner half-width ~0.35 here); Shift+#/$ to tune
var BASKET_SCALE   = 1.00;  // uniform scale of basket group; Shift+%/^ to tune
var BASKET_MAX_VIS = 24;    // max oranges shown (pool has 24 stacking slots); Shift+(/): to tune
var BASKET_HEAP_Y  = 0.00;  // Y offset of orange pile sub-group; { / } (Shift+[/]) keys to tune
var BASKET_SPREAD  = 1.00;  // x/z scale of orange pile group; < / > to tune
const MIN_GAP   = 135;
const MI_PER_PX = 900;
const COLL_FREQ  = 0.006;
const COLL_DRIFT = 0.60;  // collectibles float at 60% of obstacle speed (river-current feel)
const SPD_SCALE = 0.060;
const CAM_Y     = 4.8;
const CAM_Z_BK  = 8.5;
const CAM_LOOK_Z = -8.0;
const WATER_OPACITY = 0.60;   // tune here: 0=invisible 1=solid; 0.60 = clear shallow river
var NARROW_MILES = 1.5;        // miles over which sub-narrow squeeze animates (Shift+F7/F8 to tune)
// ── CLOUD SHADOW / CREPUSCULAR RAY CONSTANTS ─────────────────────
var CLOUD_SHADOW_OPACITY     = 0.26;  // shadow blob max opacity; Ctrl+Shift+1/2 (-/+0.02); was 0.40 (−35%)
var CLOUD_SHADOW_SIZE        = 24;    // shadow base width wu — SUNNY stages; Alt+q/w (-/+10)
var CLOUD_SHADOW_SIZE_STORM  = 45;    // shadow size for canyon stages 3+4; Ctrl+Alt+1/2 (-/+10)
var CLOUD_DRIFT_SPEED        = 0.80;  // wu/s ambient drift, independent of terrain; Ctrl+Shift+5/6
var CLOUD_SHADOW_COUNT       = 4;     // shadow blob pool count (page reload to change)
var CLOUD_FADEIN_MS          = 3000;  // ms to fade in when spawning (was 5000)
var CLOUD_DESPAWN_Z          = 28;    // world Z past camera where shadows recycle; Ctrl+Alt+3/4
var CLOUD_FADEOUT_Z          = 3;     // world Z at which shadow begins fading out; Ctrl+Alt+5/6
var RAY_SHAFT_OPACITY    = 0.12;  // sun shaft opacity; Alt+e/r (-/+0.01)
var RAY_POOL_OPACITY     = 0.10;  // ground pool opacity; Alt+a/s (-/+0.01)
var RAY_SHAFT_W          = 10;    // shaft sprite width wu; Alt+z/x (-/+1)
var RAY_SHAFT_H          = 48;    // shaft sprite height wu; Alt+c/v (-/+5)
var RAY_TILT             = 0.22;  // shaft screen-space tilt rad; Alt+d/f (-/+0.02)
var RAY_COUNT            = 2;     // shaft+pool pair count (page reload to change)
// ── WILDLIFE CONSTANTS ────────────────────────────────────────────
var FISH_FREQ_MIN  = 5;    // LOUD (prod: 20) — seconds min between fish sightings; Ctrl+Shift+7/8
var FISH_FREQ_MAX  = 5;    // LOUD (prod: 48)
var FISH_OPACITY   = 0.80; // LOUD (prod: 0.45) — kept for compat; 3D fish ignore this
var BIRD_FREQ_MIN  = 10;   // LOUD (prod: 35) — seconds min between bird crossings; Ctrl+-/=
var BIRD_FREQ_MAX  = 10;   // LOUD (prod: 80)
var BIRD_SPEED     = 4.5;  // wu/s horizontal crossing speed; Ctrl+Shift+M/N
var BIRD_SCALE     = 2.2;  // overall 3D bird scale wu; tunable
var BIRD_FLAP_FREQ = 3.8;  // wing-flap cycles/sec; Ctrl+Shift+N/B
var BIRD_FLAP_AMP  = 0.90; // wing rotation amplitude radians
var BIRD_CURVE_AMP = 3.5;  // max Z-offset during curved crossing wu
var BIRD_CURVE_RATE= 0.10; // Hz of Z arc oscillation
var FISH_SCALE          = 1.5;   // LOUD (prod: 1.0) overall trout scale; Ctrl+Shift+G/H
var FISH_SWIM_SPEED     = 0.50;  // Z-drift wu/s (slowed for linger); Ctrl+Shift+J/K
var FISH_HOLD_MS        = 45000; // ms fish stay visible per sighting; Ctrl+Shift+L/;
var FISH_UNDULATION_AMP = 1.0;   // body-wave X amplitude multiplier
var FISH_WEAVE_AMT      = 1.0;   // S-weave X deviation multiplier; Ctrl+Shift+B/V
var FISH_SCHOOL_SIZE    = 3;     // fish per sighting (1–3); page reload to change
var FISH_ANIM_FPS       = 8;    // sprite swim-frame rate (cycles through 3 frames)
var FISH_SPRITE_W       = 0.42; // sprite plane width wu (fish cross-section at scale 1)
var FISH_SPRITE_L       = 1.2;  // sprite plane length wu (nose to tail at scale 1)

// ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
const DEV_STAGE_JUMP = true;  // flip to false or delete this whole block to disable
// ===== END TEMP DEV STAGE JUMP =====


// ── STAGE DATA (full roster matching game.js) ─────────────────────
const STAGES3 = [
  {
    num:1, name:'HEADWATERS', endMile:33, lanes:7, speed:1.48, obsFreq:0.011, fwFreq:0.11,
    waterColor:0x38BDF8, bankColor:0x374151,
    obsTypes:['boulder','boulder','boulder','river_wash'],
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
    obsTypes:['boulder','boulder','river_wash'],
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
    obsTypes:['boulder','boulder','boulder','river_wash'],
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
    obsTypes:['boulder','boulder','river_wash'],
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
    num:5, name:'BAKERSFIELD', endMile:165, lanes:3, speed:2.00, obsFreq:0.012, fwFreq:0,
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

// Shadow blob + crepuscular ray textures
(function() {
  var ldr = new THREE.TextureLoader();
  for (var csi = 0; csi < 3; csi++) {
    (function(idx) {
      ldr.load('cloud-shadow-' + idx + '.png?v=2', function(tex) {
        tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        _shadowTexArr[idx] = tex;
        console.log('[KRR CREP] cloud-shadow-' + idx + '.png loaded');
        for (var pi = 0; pi < _shadowPatches.length; pi++) {
          if (_shadowPatches[pi].texIdx === idx && !_shadowPatches[pi].mat.map) {
            _shadowPatches[pi].mat.map = tex; _shadowPatches[pi].mat.color.setHex(0xFFFFFF);
            _shadowPatches[pi].mat.needsUpdate = true;
          }
        }
      }, undefined, function(e) { console.error('[KRR] cloud-shadow-' + idx + '.png FAILED', e); });
    })(csi);
  }
  ldr.load('sun-ray.png?v=2', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    _sunRayTex = tex;
    console.log('[KRR CREP] sun-ray.png loaded');
    for (var ri = 0; ri < _rayPairs.length; ri++) {
      if (!_rayPairs[ri].shaftMat.map) { _rayPairs[ri].shaftMat.map = tex; _rayPairs[ri].shaftMat.needsUpdate = true; }
    }
  }, undefined, function(e) { console.error('[KRR] sun-ray.png FAILED', e); });
  ldr.load('sun-pool.png', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    _sunPoolTex = tex;
    console.log('[KRR CREP] sun-pool.png loaded');
    for (var ri = 0; ri < _rayPairs.length; ri++) {
      if (!_rayPairs[ri].poolMat.map) { _rayPairs[ri].poolMat.map = tex; _rayPairs[ri].poolMat.needsUpdate = true; }
    }
  }, undefined, function(e) { console.error('[KRR] sun-pool.png FAILED', e); });
})();

// Water FX textures: ripple ring, bubble cluster, current streak
var fxRippleTex  = null;
var fxBubbleTex  = null;
var fxCurrentTex = null;
(function() {
  var ldr = new THREE.TextureLoader();
  ldr.load('fx-ripple.png', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    fxRippleTex = tex;
  }, undefined, function(e) { console.warn('[KRR WFX] fx-ripple.png failed', e); });
  ldr.load('fx-bubble.png?v=3', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    fxBubbleTex = tex;
  }, undefined, function(e) { console.warn('[KRR WFX] fx-bubble.png failed', e); });
  ldr.load('fx-current.png', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    fxCurrentTex = tex;
  }, undefined, function(e) { console.warn('[KRR WFX] fx-current.png failed', e); });
})();

// Trout sprite swim frames (top-down PNG art, 3 frames: trout-0/1/2.png)
(function() {
  var ldr = new THREE.TextureLoader();
  for (var fi = 0; fi < 3; fi++) {
    (function(idx) {
      ldr.load('trout-' + idx + '.png', function(tex) {
        tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false; tex.needsUpdate = true;
        _fishSpriteTex[idx] = tex;
        console.log('[KRR TROUT] trout-' + idx + '.png loaded');
        // Apply frame-0 texture to any already-built school meshes
        if (idx === 0 && _school && _school.length > 0) {
          _school.forEach(function(sf) {
            var pm = sf.group.userData.planeMat;
            if (pm && !pm.map) { pm.map = tex; pm.needsUpdate = true; }
          });
        }
      }, undefined, function(err) { console.error('[KRR] trout-' + idx + '.png FAILED', err); });
    })(fi);
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
// Crepuscular ray system (replaces old circle-gradient patches)
var _shadowPatches  = [];   // { mesh, mat, texIdx, vxDir, vzDir, spawnMs }
var _rayPairs       = [];   // { shaft, shaftMat, pool, poolMat, vxDir, vzDir, x, z, spawnMs }
var _shadowTexArr   = [null, null, null];  // cloud-shadow-0/1/2.png
var _sunRayTex      = null;   // sun-ray.png
var _sunPoolTex     = null;   // sun-pool.png
var _cloudInitDone  = false;  // guard — initCloudPatches() runs exactly once
var _cloudLastMs    = 0;      // wall-clock ms at last update
// Fish school (FISH_SCHOOL_SIZE 3D trout per sighting)
var _fishSpriteTex = [null, null, null]; // trout-0/1/2.png swim frames (loaded async)
var _school       = [];     // [{ group, phaseOff, dX, dZ }]
var _troutGroup   = null;   // backward-compat: lead fish group
var _troutBodyGeo = null;   // lead fish body geometry (compat)
var _troutOrigPos = null;   // lead fish rest-pose (compat)
var _troutPhase   = 0;      // undulation phase accumulator (rad)
var _troutWeavePh = 0;      // S-weave path phase accumulator (rad)
var _fishState    = 'idle'; // 'idle' | 'hold' | 'out'
var _fishNextMs   = 0;
var _fishStartMs  = 0;
var _fishHoldMs   = 0;
var _fishBaseX    = 0;
var _fishBaseZ    = 0;
var _fishDriftZ   = 0;
// Birds (pair per crossing) — 3D procedural geometry
var _birdGroup1  = null;   // lead bird 3D group
var _birdGroup2  = null;   // follow bird 3D group
var _birdFlapOff2 = 0;     // wing-phase offset for 2nd bird (keeps wings unsynchronised)
var _birdState   = 'idle'; // 'idle' | 'crossing'
var _birdNextMs  = 0;
var _birdX       = 0;      // current world X (lead)
var _birdX2      = 0;      // current world X (follow)
var _birdVx      = 0;      // X velocity (wu/s)
var _birdY       = 0;
var _birdY2      = 0;
var _birdZ       = 0;
var _birdExitX   = 0;
var obsGlbCache = {};           // path -> null (loading) | THREE.Group (ready); populated by _preloadObsGlb
let wfGroup     = null;
let wfStrips    = [];
let bankTrees3      = [];  // scrolling tree sprite pool (not riverGroup children)
let bankBoulders3   = [];  // scrolling bank boulder sprite pool (stages 2-4, decoration only)
let bankCattails3   = [];  // scrolling cattail sprites (flat list; for teardown)
var _cattailGroups  = [];  // group objects (anchor Z + member list); used for scroll/recycle
let bankBillboards3 = [];  // scrolling billboard sprite pool (stages 1,3,5)
var _lastBillboardIdx      = -1;  // last texture index used; avoid back-to-back repeats on recycle
var _lastBillboardDespawnT =  0;  // wall-clock ms when any billboard last left the view (for cadence log)
let bankSegs3    = [];   // { mesh, side, segW } -- all bank-segment meshes from latest buildWorld
let groundChain3 = [];   // { mesh, z } -- far-ground tile chain; shares bank-seg scroll clock
let bankAprons3  = [];   // { mesh, side } -- sloped apron meshes that join bank to water edge
let laneDivs3    = [];   // { line, idx } -- lane divider Lines; each has its own cloned material
var bankPoppies3   = [];  // scrolling bank poppy sprite pool (all stages; scrolls at full spd)
// hat poppy / bloom travel vars (replace _activePopBloom + shieldRing)
var _poppyPickSt        = 0;    // Date.now() when reach started; 0 = idle
var _poppyPickPp        = null; // pool entry being picked
var _poppyPickSide      = 0;    // -1 or +1
var _poppyContactFired  = false;// true once contact effect (swap tex, bloom) has fired
var _poppyBloomSpr      = null; // single travelling bloom sprite (detach -> retract -> seat)
var _poppyBloomCPos     = { x: 0, y: 0, z: 0 }; // world pos at moment of contact
var _hatPoppySpr        = null; // persistent bloom sprite parented to hat position
var _hatKnockSt         = 0;   // Date.now() when shield-knock-off started; 0 = idle
var _hatKnockVel        = { x: 0, y: 0 };        // screen drift of knocked-off flower
var _poppyShieldWas     = false; // previous-frame hasShield (for edge detection)
var _diagS3HouseDone    = false; // one-shot diag for stage-3 lake-house y; remove after reading
var _diagS5FarmDone     = false; // one-shot diag for stage-5 farm-house y; remove after reading
let bankHouses3   = [];  // scrolling lake-house sprite pool (Stage 3 only)
let canyonWalls4  = [];  // scrolling canyon-wall boulder sprite pool (Stage 4 only)
let shoreScatter4 = [];  // small pebble + decor sprites on Stage-4 shore band (no collision)
let canyonFill4     = [];  // mesh refs for disposal (Stage 4 canyon fill pool)
let canyonFillSegs4 = [];  // { mesh, z } z-scroll pool (Stage 4 canyon fill segments)
let rockWallMats4   = [];  // retained for compat; no longer populated (UV scroll removed)
let bankSegMats3  = [];   // bank segment texture refs for per-frame scroll (Stage 1)
let bankGrassMats1 = []; // { mat, segW } refs for Stage 1 grass live-repeat tuner
let grassBankMats3 = [];  // Stage 3 grass texture refs for per-frame scroll (ground + bank segs)
let floorMats4    = [];  // Stage 4 pebble floor texture refs for per-frame scroll
var s5GndScrollTex = null; // Stage 5 ground plane scroll clone; re-acquired each buildWorld
var gndPlaneTex    = null; // current ground plane texture (any stage); updated by Ctrl+[/] density tuner
var gndPlaneMat    = null; // current ground plane material (any stage); updated by BANK_BRIGHT_MULT tuner
let bankStumps5    = [];  // Stage 5 tree-stump sprite pool
let bankFarms5     = [];  // Stage 5 farm-house sprite pool (farm-house-1 and farm-house-2)
let bankFishing5   = [];  // Stage 5 fishing-supplies sprite pool
let bankGrassTufts1    = []; // Stage 1 grass tuft scatter pool (far ground)
let bankGrassTufts1Top = []; // Stage 1 grass tuft scatter pool (bank top surface)
let bankGrassTufts3    = []; // Stage 3 grass tuft scatter pool (far ground)
let bankGrassTufts3Top = []; // Stage 3 grass tuft scatter pool (bank top surface)
let bankGrassTufts5    = []; // Stage 5 grass tuft scatter pool (far ground)
let bankGrassTufts5Top = []; // Stage 5 grass tuft scatter pool (bank top surface)
let wfxPool = [];             // Water FX sprite pool (ripple/bubble/current, all stages)
var _wfxRippleTimer  = 0;    // frames until next ripple spawn
var _wfxBubbleTimer  = 0;    // frames until next bubble spawn
var _wfxCurrentTimer = 0;    // frames until next current-line spawn
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
var bankGrassTex     = null;  // bank-stage1-grass.png: seamless 1024x1024 photo grass
var GROUND_TEX_WORLD = 4.0;   // world units per texture tile (all bank/apron stages); tuner: Ctrl+[ / Ctrl+]
var BANK_BRIGHT_MULT = 1.0;   // ground material color multiplier (0=black, 1=unmodified); tuner: Ctrl+Shift+[/]
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

  loader.load('bank-stage1-grass.png', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    bankGrassTex = tex;
    console.log('[KRR] bank-stage1-grass.png OK');
  }, undefined, function(e) { console.error('[KRR] bank-stage1-grass.png FAILED', e); });

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
        tex._padFrac = _computePadFrac(tex);
        _recordPadFrac(treeTexNames[idx], tex._padFrac);
        for (var _tpf = 0; _tpf < bankTrees3.length; _tpf++) {
          if (bankTrees3[_tpf].sprite.material.map === tex) {
            bankTrees3[_tpf].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
          }
        }
      }, undefined, function(e) { console.error('[KRR] ' + treeTexNames[idx] + ' FAILED', e); });
    })(ti);
  }
})();

// ── ORANGE COLLECTIBLE TEXTURE PRELOAD ───────────────────────────────────
var orangeCollTex = null; // orange.png sprite; used by makeCollMesh3('orange') for unlit true-color render
(function() {
  new THREE.TextureLoader().load('orange.png?v=13', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    orangeCollTex = tex;
    // Late-patch any already-spawned orange collectibles (texture race)
    collectibles3.forEach(function(c) {
      if (c.type === 'orange' && c.mesh && c.mesh.material) {
        c.mesh.material.map = tex;
        c.mesh.material.color.setHex(0xFFFFFF);
        c.mesh.material.needsUpdate = true;
      }
    });
  }, undefined, function(e) { console.error('[KRR] orange.png FAILED', e); });
})();

// ── ORANGE-IN-BASKET TEXTURE ─────────────────────────────────────────
// orange-collected.png: illustrated flat orange art with clean transparent edge.
// Used for basket pile sprites so dark-side-of-sphere never reads as mud.
var orangeInBasketTex = null;
(function() {
  new THREE.TextureLoader().load('orange-collected.png?v=13', function(tex) {
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    orangeInBasketTex = tex;
    // Late-patch sprites already built before texture loaded
    _basketOranges.forEach(function(bo) {
      if (bo.mesh && bo.mesh.material) {
        bo.mesh.material.map = tex;
        bo.mesh.material.color.setHex(0xFFFFFF);
        bo.mesh.material.needsUpdate = true;
      }
    });
    console.log('[KRR] orange-collected.png OK (basket pile)');
  }, undefined, function(e) { console.error('[KRR] orange-collected.png FAILED', e); });
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

// ── CATTAIL TEXTURES ──────────────────────────────────────────────────────
var cattailTex = [null, null];  // cattail-1, cattail-2
(function preloadCattailTex() {
  var loader = new THREE.TextureLoader();
  ['cattail-1.png?v=1', 'cattail-2.png?v=1'].forEach(function(name, idx) {
    loader.load(name, function(tex) {
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false; tex.needsUpdate = true;
      cattailTex[idx] = tex;
    }, undefined, function(e) { console.error('[KRR] ' + name + ' FAILED', e); });
  });
})();

// ── ALPHA-BOTTOM PADDING HELPER ──────────────────────────────────────────
// Reads a loaded THREE.Texture into a canvas and returns the fraction of the
// image height that is fully transparent at the bottom.  Caller sets:
//   spr.center.set(0.5, padFrac)
// which shifts the Three.js sprite anchor up to the opaque base, so seating
// the sprite at DECOR_SEAT_GND puts the VISIBLE art on the ground -- no
// per-sprite hardcoded constants needed.
function _computePadFrac(tex) {
  var img = tex && tex.image;
  if (!img || !img.width || !img.height) return 0;
  var w = img.width, h = img.height;
  try {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var px = ctx.getImageData(0, 0, w, h).data;
    // canvas y=0 is the image TOP; y=h-1 is the image BOTTOM.
    // Scan upward from bottom row to find the first row with any opaque pixel.
    for (var row = h - 1; row >= 0; row--) {
      for (var col = 0; col < w; col++) {
        if (px[(row * w + col) * 4 + 3] > 10) {
          // rows row+1 … h-1 are all transparent = empty bottom padding
          return ((h - 1) - row) / h;
        }
      }
    }
  } catch (e) { /* cross-origin or other canvas error — fall back to 0 */ }
  return 0;
}

// Apply threshold + DECOR_SINK_TRIM to raw padFrac before setting sprite.center.y.
// Sprites with near-zero padding (pf <= 0.02) get no offset; otherwise subtract trim so
// we can nudge all anchors up slightly if the alpha scan reads a touch high.
function _effectivePadFrac(pf) {
  return (pf > 0.02) ? Math.max(0, pf - DECOR_SINK_TRIM) : 0;
}

// Re-apply center.y to all live bank-decor sprites after DECOR_SINK_TRIM changes at runtime.
function _applyAllDecorCenters() {
  function _reCenter(arr) {
    arr.forEach(function(o) {
      if (o.sprite && o.sprite.material && o.sprite.material.map) {
        o.sprite.center.set(0.5, _effectivePadFrac(o.sprite.material.map._padFrac || 0));
      }
    });
  }
  _reCenter(bankTrees3);
  _reCenter(bankBillboards3);
  _reCenter(bankHouses3);
  _reCenter(bankStumps5);
  _reCenter(bankFarms5);
  _reCenter(bankFishing5);
}

// Consolidated padFrac report: each decor texture loader calls _recordPadFrac(name, val).
// After the last texture fires, a 1.5s debounce prints one summary line.
var _padFracLog   = {};
var _padFracTimer = null;
function _recordPadFrac(name, val) {
  _padFracLog[name] = val.toFixed(3);
  clearTimeout(_padFracTimer);
  _padFracTimer = setTimeout(function() {
    var parts = Object.keys(_padFracLog).map(function(k) { return k + ':' + _padFracLog[k]; });
    console.log('[KRR padFrac] ' + parts.join(' | '));
  }, 1500);
}

// ── BILLBOARD TEXTURE PRELOAD ─────────────────────────────────────────────
// Three roadside sign PNGs, bottom-anchored (posts + grass base).
// Natural aspect ratios (W/H): billboard-1=1.689, billboard-2=1.458, billboard-3=1.484
var billboardTex   = [null, null, null];
var billboardNatAR = [512/303, 512/351, 512/345];
(function preloadBillboardTex() {
  var _bbl = new THREE.TextureLoader();
  ['billboard-1.png', 'billboard-2.png', 'billboard-3.png'].forEach(function(name, idx) {
    _bbl.load(name, function(tex) {
      // Anisotropy applied at sprite-creation time via renderer (module-level).
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      billboardTex[idx] = tex;
      tex._padFrac = _computePadFrac(tex);
      _recordPadFrac(name, tex._padFrac);
      for (var _bbpf = 0; _bbpf < bankBillboards3.length; _bbpf++) {
        if (bankBillboards3[_bbpf].texIdx === idx) {
          bankBillboards3[_bbpf].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
        }
      }
    }, undefined, function(e) { console.error('[KRR] ' + name + ' FAILED', e); });
  });
})();

// Stage 3 grass texture for bank ground and bank-box surfaces
var grassStage3Tex = null;
(function preloadGrass3Tex() {
  new THREE.TextureLoader().load('grass-stage3.png?v=2', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    grassStage3Tex = tex;
    console.log('[KRR] grass-stage3.png loaded');
  }, undefined, function(e) { console.error('[KRR] grass-stage3.png FAILED', e); });
})();

// Stage 5 terrain textures:
//   swampTerrainTex = new-stage-5-terrain-blur.png  (blurred scroll tex; retained for far ground plane UV scroll)
//   marshTerrainTex = bank-stage5-marsh.png          (bright marsh art; used for close bank segs / aprons / ground plane)
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
var marshTerrainTex = null;
(function() {
  new THREE.TextureLoader().load('bank-stage5-marsh.png?v=18', function(tex) {
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    marshTerrainTex = tex;
    console.log('[KRR] bank-stage5-marsh.png OK');
  }, undefined, function(e) { console.error('[KRR] bank-stage5-marsh.png FAILED', e); });
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
        // Late-patch aspect ratio and anchor for sprites built before this texture loaded
        tex._padFrac = _computePadFrac(tex);
        _recordPadFrac('lake-house-' + (idx + 1) + '.png', tex._padFrac);
        if (tex.image && tex.image.naturalHeight > 0) {
          var natAsp = tex.image.naturalWidth / tex.image.naturalHeight;
          for (var hpi = 0; hpi < bankHouses3.length; hpi++) {
            if (bankHouses3[hpi].texIdx === idx) {
              bankHouses3[hpi].sprite.scale.set(STAGE3_HOUSE_SCALE * natAsp, STAGE3_HOUSE_SCALE, 1);
              bankHouses3[hpi].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
            }
          }
        }
      }, undefined, function(e) { console.error('[KRR] lake-house-' + (idx + 1) + '.png FAILED', e); });
    })(lhi);
  }
})();

// Stage 5 bank decoration textures
var stumpTex5    = null;
var farmTex5     = [null, null];   // index 0 = farm-house-1, index 1 = farm-house-2
var fishingTex5  = null;
var grassTuftTex1 = null;
var grassTuftTex3 = null;
var grassTuftTex5 = null;
var GRASS_TEX_BY_STAGE = { 1: null, 3: null, 5: null };

(function() {
  var ldr = new THREE.TextureLoader();
  ldr.load('tree-stump.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    stumpTex5 = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('tree-stump.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] tree-stump ' + natW + 'x' + natH + ' -> world ' + (S5_STUMP_SCALE * natW / natH).toFixed(2) + 'x' + S5_STUMP_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankStumps5.length; i++) {
        bankStumps5[i].sprite.material.map = tex; bankStumps5[i].sprite.material.needsUpdate = true;
        bankStumps5[i].sprite.scale.set(S5_STUMP_SCALE * asp, S5_STUMP_SCALE, 1);
        bankStumps5[i].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
      }
    }
  }, undefined, function(e) { console.error('[KRR] tree-stump.png FAILED', e); });
  ldr.load('farm-house-1.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    farmTex5[0] = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('farm-house-1.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] farm-house-1 ' + natW + 'x' + natH + ' -> world ' + (S5_FARMHOUSE_SCALE * natW / natH).toFixed(2) + 'x' + S5_FARMHOUSE_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFarms5.length; i++) {
        if (bankFarms5[i].texIdx === 0) {
          bankFarms5[i].sprite.material.map = tex; bankFarms5[i].sprite.material.needsUpdate = true;
          bankFarms5[i].sprite.scale.set(S5_FARMHOUSE_SCALE * asp, S5_FARMHOUSE_SCALE, 1);
          bankFarms5[i].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] farm-house-1.png FAILED', e); });
  ldr.load('farm-house-2.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    farmTex5[1] = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('farm-house-2.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] farm-house-2 ' + natW + 'x' + natH + ' -> world ' + (S5_FARMHOUSE_SCALE * natW / natH).toFixed(2) + 'x' + S5_FARMHOUSE_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFarms5.length; i++) {
        if (bankFarms5[i].texIdx === 1) {
          bankFarms5[i].sprite.material.map = tex; bankFarms5[i].sprite.material.needsUpdate = true;
          bankFarms5[i].sprite.scale.set(S5_FARMHOUSE_SCALE * asp, S5_FARMHOUSE_SCALE, 1);
          bankFarms5[i].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] farm-house-2.png FAILED', e); });
  ldr.load('fishing-supplies.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    fishingTex5 = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('fishing-supplies.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] fishing-supplies ' + natW + 'x' + natH + ' -> world ' + (S5_FISHING_SCALE * natW / natH).toFixed(2) + 'x' + S5_FISHING_SCALE.toFixed(2));
      var asp = natW / natH;
      for (var i = 0; i < bankFishing5.length; i++) {
        bankFishing5[i].sprite.material.map = tex; bankFishing5[i].sprite.material.needsUpdate = true;
        bankFishing5[i].sprite.scale.set(S5_FISHING_SCALE * asp, S5_FISHING_SCALE, 1);
        bankFishing5[i].sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
      }
    }
  }, undefined, function(e) { console.error('[KRR] fishing-supplies.png FAILED', e); });
})();

// Stage 5 grass tuft scatter decor
(function() {
  new THREE.TextureLoader().load('grass-stage5.png?v=18', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    grassTuftTex5 = tex;
    GRASS_TEX_BY_STAGE[5] = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('grass-stage5.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      console.log('[KRR S5DECO] grass-stage5 ' + natW + 'x' + natH + ' -> world w=' + S5_GRASS_W.toFixed(2) + ' h=' + (S5_GRASS_W * 0.621).toFixed(3) + ' (h/w=0.621)');
      for (var i = 0; i < bankGrassTufts5.length; i++) {
        var bgt = bankGrassTufts5[i];
        bgt.sprite.material.map = tex; bgt.sprite.material.needsUpdate = true;
        var gScl = bgt.scaleMult;
        bgt.sprite.scale.set(S5_GRASS_W * gScl, S5_GRASS_W * 0.621 * gScl, 1);
        bgt.sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
      }
    }
  }, undefined, function(e) { console.error('[KRR] grass-stage5.png FAILED', e); });
})();

// Stage 1 grass tuft scatter texture (Headwaters bank)
(function() {
  new THREE.TextureLoader().load('grass-stage1.png?v=2', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    grassTuftTex1 = tex;
    GRASS_TEX_BY_STAGE[1] = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('grass-stage1.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW1 = tex.image.naturalWidth, natH1 = tex.image.naturalHeight;
      var natAR1 = natH1 / natW1;
      console.log('[KRR S1DECO] grass-stage1 ' + natW1 + 'x' + natH1 + ' ar=' + natAR1.toFixed(3));
      var _s1Pools = [bankGrassTufts1, bankGrassTufts1Top];
      for (var _pi = 0; _pi < _s1Pools.length; _pi++) {
        var _pool1 = _s1Pools[_pi];
        for (var i = 0; i < _pool1.length; i++) {
          var bgt1 = _pool1[i];
          bgt1.ar = natAR1;
          bgt1.sprite.material.map = tex; bgt1.sprite.material.needsUpdate = true;
          bgt1.sprite.scale.set(S5_GRASS_W * bgt1.scaleMult, S5_GRASS_W * natAR1 * bgt1.scaleMult, 1);
          bgt1.sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] grass-stage1.png FAILED', e); });
})();

// Stage 3 grass tuft scatter texture (Lake Isabella bank)
(function() {
  new THREE.TextureLoader().load('grass-stage3-tuft.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    grassTuftTex3 = tex;
    GRASS_TEX_BY_STAGE[3] = tex;
    tex._padFrac = _computePadFrac(tex);
    _recordPadFrac('grass-stage3-tuft.png', tex._padFrac);
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW3 = tex.image.naturalWidth, natH3 = tex.image.naturalHeight;
      var natAR3 = natH3 / natW3;
      console.log('[KRR S3DECO] grass-stage3-tuft ' + natW3 + 'x' + natH3 + ' ar=' + natAR3.toFixed(3));
      var _s3Pools = [bankGrassTufts3, bankGrassTufts3Top];
      for (var _pi3 = 0; _pi3 < _s3Pools.length; _pi3++) {
        var _pool3 = _s3Pools[_pi3];
        for (var i3 = 0; i3 < _pool3.length; i3++) {
          var bgt3 = _pool3[i3];
          bgt3.ar = natAR3;
          bgt3.sprite.material.map = tex; bgt3.sprite.material.needsUpdate = true;
          bgt3.sprite.scale.set(S5_GRASS_W * bgt3.scaleMult, S5_GRASS_W * natAR3 * bgt3.scaleMult, 1);
          bgt3.sprite.center.set(0.5, _effectivePadFrac(tex._padFrac));
        }
      }
    }
  }, undefined, function(e) { console.error('[KRR] grass-stage3-tuft.png FAILED', e); });
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

// Stage 2 raft_train fwType sprite (tubing-obstacle-2.png)
var raftTrainTex    = null;  // loaded async; null until load callback fires
var raftTrainAsp    = 1.0;   // cached aspect ratio; updated on load; default 1.0
var raftTrainLogged = false; // fire sizing log once on first load

(function() {
  new THREE.TextureLoader().load('tubing-obstacle-2.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    raftTrainTex = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      raftTrainAsp = natW / natH;
      if (!raftTrainLogged) {
        raftTrainLogged = true;
        var rtLogW = 6 * LANE_W;
        var rtLogH = rtLogW / raftTrainAsp;
        console.log('[KRR FW2] tubing-obstacle-2 ' + natW + 'x' + natH + ' -> world ' + rtLogW.toFixed(2) + 'x' + rtLogH.toFixed(2) + ' seatY=' + FW2_SEAT_Y);
      }
    }
  }, undefined, function(e) { console.error('[KRR] tubing-obstacle-2.png FAILED', e); });
})();

// Stage 4 old_mining_bridge fwType sprite (tubing-obstacle-1.png)
var tubeRaftTex    = null;  // loaded async; null until load callback fires
var tubeRaftAsp    = 0.773; // tubing-obstacle-1.png is 1545x1999 portrait; seeded like bridge1Asp
var tubeRaftLogged = false; // fire sizing log once on first load

(function() {
  new THREE.TextureLoader().load('tubing-obstacle-1.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    tubeRaftTex = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      tubeRaftAsp = natW / natH;
      if (!tubeRaftLogged) {
        tubeRaftLogged = true;
        var tr4LogW = 4 * LANE_W;
        var tr4LogH = tr4LogW / tubeRaftAsp;
        console.log('[KRR FW4] tubing-obstacle-1 ' + natW + 'x' + natH + ' -> world ' + tr4LogW.toFixed(2) + 'x' + tr4LogH.toFixed(2) + ' seatY=' + FW4_SEAT_Y);
      }
    }
  }, undefined, function(e) { console.error('[KRR] tubing-obstacle-1.png FAILED', e); });
})();

// Stage 1 fallen_sequoia fwType sprite (long-bridge-1.png)
var bridge1Tex    = null;  // loaded async; null until load callback fires
var bridge1Asp    = 0.773; // long-bridge-1.png is 1545x1999 portrait; callback confirms
var bridge1Logged = false; // fire sizing log once on first load

(function() {
  new THREE.TextureLoader().load('long-bridge-1.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    bridge1Tex = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      bridge1Asp = natW / natH;
      if (!bridge1Logged) {
        bridge1Logged = true;
        var br1LogW = 7 * LANE_W;
        var br1LogH = br1LogW / bridge1Asp;
        console.log('[KRR FW1] long-bridge-1 ' + natW + 'x' + natH + ' -> world ' + br1LogW.toFixed(2) + 'x' + br1LogH.toFixed(2) + ' seatY=' + FW1_SEAT_Y);
      }
    }
  }, undefined, function(e) { console.error('[KRR] long-bridge-1.png FAILED', e); });
})();

// Stage 3 pontoon_party fwType sprite (long-bridge-2.png)
var bridge2Tex    = null;  // loaded async; null until load callback fires
var bridge2Asp    = 0.773; // long-bridge-2.png is 1545x1999 portrait; seeded so pre-load spawns use correct height
var bridge2Logged = false; // fire sizing log once on first load

(function() {
  new THREE.TextureLoader().load('long-bridge-2.png', function(tex) {
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    bridge2Tex = tex;
    if (tex.image && tex.image.naturalHeight > 0) {
      var natW = tex.image.naturalWidth, natH = tex.image.naturalHeight;
      bridge2Asp = natW / natH;
      if (!bridge2Logged) {
        bridge2Logged = true;
        var br2LogW = 5 * LANE_W;
        var br2LogH = br2LogW / bridge2Asp;
        console.log('[KRR FW3] long-bridge-2 ' + natW + 'x' + natH + ' -> world ' + br2LogW.toFixed(2) + 'x' + br2LogH.toFixed(2) + ' seatY=' + FW3_SEAT_Y);
      }
    }
  }, undefined, function(e) { console.error('[KRR] long-bridge-2.png FAILED', e); });
})();

// river_wash visual constants -- tune live with 0 / - / =
var RW_ARMS        = 3;            // spiral arm count (fewer = looser swirl)
var RW_TURNS       = 1.2;          // arm wraps from center to rim
var RW_CORE_ALPHA  = 0.55;         // translucent core (water shows through); was 0.95
var RW_RIM_ALPHA   = 0.0;          // opacity at outer edge (fully transparent)
var RW_BLUR_PX     = 6;            // canvas blur on arms (soft foamy look)
var RW_CORE_FRAC   = 0.35;         // radius fraction that stays at full RW_CORE_ALPHA
var RW_SPIRAL_SIZE = LANE_W * 1.2; // disc diameter in world units (~2.64)
var RW_SPIN_SPEED  = 0.07;         // radians per frame (fast churn)
var RW_SWIRL_R     = 200;          // swirl base red   (pale blue-white churned water)
var RW_SWIRL_G     = 225;          // swirl base green
var RW_SWIRL_B     = 240;          // swirl base blue
var RW_SWIRL_BRIGHT = 0;           // brightness offset added to all channels (tuner param 7, range -50..50)
var RW_FLECK_COUNT = 40;           // baked fleck count; orbit with disc rotation
var RW_FLECK_MAX_R = 1.6;          // max fleck radius in canvas pixels (min 0.5)
var RW_FLECK_ALPHA = 0.7;          // fleck opacity
var rwTunerParam   = 0;            // cycles: 0=arms 1=turns 2=coreAlpha 3=blur 4=spin 5=size 6=flecks 7=bright

// canvas + context kept module-level so buildRwSpiral() can redraw on tuner change
var rwSpiralCv  = document.createElement('canvas');
rwSpiralCv.width = 256; rwSpiralCv.height = 256;
var rwSpiralCtx = rwSpiralCv.getContext('2d');
var rwSpiralTex = null;  // assigned on first buildRwSpiral(); all instances share it

function buildRwSpiral() {
  var sz = 256, half = 128;
  rwSpiralCtx.clearRect(0, 0, sz, sz);
  // Resolve color channels with brightness offset
  var rr = Math.max(0, Math.min(255, RW_SWIRL_R + RW_SWIRL_BRIGHT));
  var rg = Math.max(0, Math.min(255, RW_SWIRL_G + RW_SWIRL_BRIGHT));
  var rb = Math.max(0, Math.min(255, RW_SWIRL_B + RW_SWIRL_BRIGHT));
  var colBase = 'rgba(' + rr + ', ' + rg + ', ' + rb + ', ';
  // Step 1: radial gradient base -- translucent funnel core, dissolves to transparent rim
  rwSpiralCtx.filter = 'none';
  var grad = rwSpiralCtx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0,            colBase + RW_CORE_ALPHA + ')');
  grad.addColorStop(RW_CORE_FRAC, colBase + RW_CORE_ALPHA + ')');
  grad.addColorStop(1,            colBase + RW_RIM_ALPHA  + ')');
  rwSpiralCtx.fillStyle = grad;
  rwSpiralCtx.fillRect(0, 0, sz, sz);
  // Step 2: blurred spiral arms -- soft watery swirl strokes over the gradient
  rwSpiralCtx.filter = 'blur(' + RW_BLUR_PX + 'px)';
  var outerR = half * 0.88;
  var innerR = half * 0.04;
  var armAlpha = Math.min(1, RW_CORE_ALPHA + 0.20).toFixed(2);
  for (var arm = 0; arm < RW_ARMS; arm++) {
    var startAngle = (arm / RW_ARMS) * Math.PI * 2;
    rwSpiralCtx.beginPath();
    for (var s = 0; s <= 160; s++) {
      var t = s / 160;
      var angle = startAngle + t * RW_TURNS * Math.PI * 2;
      var r = innerR + t * (outerR - innerR);
      var px = half + r * Math.cos(angle);
      var py = half + r * Math.sin(angle);
      if (s === 0) { rwSpiralCtx.moveTo(px, py); } else { rwSpiralCtx.lineTo(px, py); }
    }
    rwSpiralCtx.strokeStyle = colBase + armAlpha + ')';
    rwSpiralCtx.lineWidth = 9;
    rwSpiralCtx.stroke();
  }
  rwSpiralCtx.filter = 'none';
  // Step 3: baked flecks -- tiny bright dots scattered in mid-radius band, orbit with disc
  var fMinR = half * 0.22;
  var fMaxR = half * 0.82;
  var fr = Math.min(255, rr + 30);
  var fg = Math.min(255, rg + 20);
  var fb = Math.min(255, rb + 15);
  for (var f = 0; f < RW_FLECK_COUNT; f++) {
    var fAngle = Math.random() * Math.PI * 2;
    var fR = fMinR + Math.random() * (fMaxR - fMinR);
    var fPx = half + fR * Math.cos(fAngle);
    var fPy = half + fR * Math.sin(fAngle);
    var fRadius = 0.5 + Math.random() * (RW_FLECK_MAX_R - 0.5);
    rwSpiralCtx.beginPath();
    rwSpiralCtx.arc(fPx, fPy, fRadius, 0, Math.PI * 2);
    rwSpiralCtx.fillStyle = 'rgba(' + fr + ', ' + fg + ', ' + fb + ', ' + RW_FLECK_ALPHA + ')';
    rwSpiralCtx.fill();
  }
  if (!rwSpiralTex) {
    rwSpiralTex = new THREE.CanvasTexture(rwSpiralCv);
    rwSpiralTex.magFilter = THREE.LinearFilter;
    rwSpiralTex.minFilter = THREE.LinearFilter;
  }
  rwSpiralTex.needsUpdate = true;
}

buildRwSpiral();

let stageIdx    = 0;
let curLanes    = STAGES3[0].lanes;
let rwCur       = curLanes * LANE_W;   // live river width; set in lockstep with curLanes

function riverWidth()  { return rwCur; }
function laneXPos(l)   { const lw = rwCur / curLanes; return (l - (curLanes - 1) / 2) * lw; }

// Sync water/banks/dividers to rwCur without a full buildWorld rebuild.
// Called once at the end of buildWorld and every frame in update3.
function applyRiverWidth() {
  // Water: scale.x to match rwCur (skip Stage 2 -- its water is hardcoded 200 wide)
  if (waterMesh && waterMesh.userData.builtRw && STAGES3[stageIdx].num !== 2) {
    waterMesh.scale.x = rwCur / waterMesh.userData.builtRw;
  }
  // Bank segments: inner edge at rwCur/2 + SHORE_W (apron fills the gap)
  for (var _bsi = 0; _bsi < bankSegs3.length; _bsi++) {
    var _bs = bankSegs3[_bsi];
    _bs.mesh.position.x = _bs.side * (rwCur / 2 + SHORE_W + _bs.segW / 2);
  }
  // Aprons: toe stays exactly at the water edge
  for (var _api = 0; _api < bankAprons3.length; _api++) {
    bankAprons3[_api].mesh.position.x = bankAprons3[_api].side * (rwCur / 2);
  }
  // Lane dividers: handled separately during narrowing (see per-frame narrow block in update3)
  if (!narrowing) {
    var _ldw = rwCur / curLanes;
    for (var _ldi = 0; _ldi < laneDivs3.length; _ldi++) {
      laneDivs3[_ldi].line.position.x = -rwCur / 2 + laneDivs3[_ldi].idx * _ldw;
    }
  }
}

// Tear down and recreate only the lane-divider Lines, leaving everything else untouched.
// Called once when a sub-narrow squeeze completes (t=1) to install the new divider count.
function rebuildDividers3() {
  for (var _rdi = 0; _rdi < laneDivs3.length; _rdi++) {
    var _rd = laneDivs3[_rdi];
    if (_rd.line.material) _rd.line.material.dispose();
    _rd.line.geometry.dispose();
    riverGroup.remove(_rd.line);
  }
  laneDivs3 = [];
  var _rdBase = new THREE.LineBasicMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.22 });
  for (var _rl = 1; _rl < curLanes; _rl++) {
    var _rdiv = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.04, SPAWN_Z - 5),
        new THREE.Vector3(0, 0.04, DESPAWN_Z)
      ]),
      _rdBase.clone()
    );
    riverGroup.add(_rdiv);
    laneDivs3.push({ line: _rdiv, idx: _rl });
  }
  applyRiverWidth();
}

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
  bankBillboards3.forEach(function(bb) { scene.remove(bb.sprite); if (bb.sprite.material) bb.sprite.material.dispose(); });
  bankBillboards3 = [];
  _lastBillboardIdx = -1;
  _lastBillboardDespawnT = 0;
  bankSegs3    = [];
  groundChain3 = [];
  bankAprons3 = [];   // geometries disposed by riverGroup traverse above
  laneDivs3   = [];
  bankPoppies3.forEach(function(pp) {
    scene.remove(pp.sprite);
    if (pp.sprite.material) pp.sprite.material.dispose();
    if (pp.glow) { scene.remove(pp.glow); if (pp.glow.material) pp.glow.material.dispose(); }
  });
  bankPoppies3 = [];
  if (_poppyBloomSpr) { scene.remove(_poppyBloomSpr); _poppyBloomSpr.material.dispose(); _poppyBloomSpr = null; }
  // Preserve the worn hat flower across stage changes; only destroy it if the shield is not active
  if (_hatPoppySpr && !player3.hasShield) { if (_hatPoppySpr.parent) _hatPoppySpr.parent.remove(_hatPoppySpr); _hatPoppySpr.material.dispose(); _hatPoppySpr = null; }
  _poppyPickSt = 0; _poppyPickPp = null; _hatKnockSt = 0; _poppyShieldWas = false;
  bankHouses3.forEach(function(bh) { scene.remove(bh.sprite); if (bh.sprite.material) bh.sprite.material.dispose(); });
  bankHouses3 = [];
  bankStumps5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankStumps5 = [];
  bankFarms5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankFarms5 = [];
  bankFishing5.forEach(function(b5) { scene.remove(b5.sprite); if (b5.sprite.material) b5.sprite.material.dispose(); });
  bankFishing5 = [];
  bankGrassTufts1.forEach(function(bg1) { scene.remove(bg1.sprite); if (bg1.sprite.material) bg1.sprite.material.dispose(); });
  bankGrassTufts1 = [];
  bankGrassTufts1Top.forEach(function(bt1) { scene.remove(bt1.sprite); if (bt1.sprite.material) bt1.sprite.material.dispose(); });
  bankGrassTufts1Top = [];
  bankGrassTufts3.forEach(function(bg3) { scene.remove(bg3.sprite); if (bg3.sprite.material) bg3.sprite.material.dispose(); });
  bankGrassTufts3 = [];
  bankGrassTufts3Top.forEach(function(bt3) { scene.remove(bt3.sprite); if (bt3.sprite.material) bt3.sprite.material.dispose(); });
  bankGrassTufts3Top = [];
  bankGrassTufts5.forEach(function(bg5) { scene.remove(bg5.sprite); if (bg5.sprite.material) bg5.sprite.material.dispose(); });
  bankGrassTufts5 = [];
  bankGrassTufts5Top.forEach(function(bt5) { scene.remove(bt5.sprite); if (bt5.sprite.material) bt5.sprite.material.dispose(); });
  bankGrassTufts5Top = [];
  canyonWalls4.forEach(function(cw) { scene.remove(cw.sprite); if (cw.sprite.material) cw.sprite.material.dispose(); });
  canyonWalls4 = [];
  shoreScatter4.forEach(function(ss) { scene.remove(ss.sprite); if (ss.sprite.material) ss.sprite.material.dispose(); });
  shoreScatter4 = [];
  bankCattails3.forEach(function(ct) { scene.remove(ct.sprite); if (ct.sprite.material) ct.sprite.material.dispose(); });
  bankCattails3 = [];
  _cattailGroups = [];
  // Dispose shared canyon fill material once, then free per-segment geometries
  if (canyonFillSegs4.length > 0 && canyonFillSegs4[0].mesh.material) {
    var _cfmD = canyonFillSegs4[0].mesh.material;
    if (_cfmD.map) _cfmD.map.dispose();
    _cfmD.dispose();
  }
  canyonFillSegs4.forEach(function(s) { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); s.mesh.geometry.dispose(); });
  canyonFillSegs4 = [];
  canyonFill4 = [];
  rockWallMats4 = [];
  bankSegMats3  = [];
  bankGrassMats1 = [];
  grassBankMats3 = [];
  floorMats4    = [];
  s5GndScrollTex = null;
  gndPlaneTex    = null;
  gndPlaneMat    = null;
  riverbedMesh   = null;
  riverbedTexRef = null;
  if (horizonGrp)   { scene.remove(horizonGrp); horizonGrp = null; }
  // Stage 5 backdrop persists through sub-narrow rebuilds; only tear down on actual stage change
  if (backdropMesh && !(stageIdx === 4 && stageBackdropMesh !== null)) { scene.remove(backdropMesh); backdropMesh.geometry.dispose(); backdropMesh = null; stageBackdropMesh = null; }
  if (wfGroup)      { scene.remove(wfGroup); wfGroup = null; wfStrips = []; }
  teardownWaterFX();

  const stg = STAGES3[stageIdx];
  // Per-stage sky: Stage 5 gets a dusty haze tone; all others restore the standard sky blue
  scene.background.set(stg.num === 5 ? 0x9FB0B8 : 0x87CEEB);
  // Stage 5: extend far clip so deep terrain planes reach the backdrop bottom; restore for other stages
  camera.far = (stg.num === 5) ? 350 : 160;
  camera.updateProjectionMatrix();
  const rw  = riverWidth();
  riverGroup = new THREE.Group();

  var gndW = 200;
  var gndZ = (stg.num === 5) ? 600 : 170;
  var _maxAniso = renderer.capabilities.getMaxAnisotropy();
  // Ground -- widened to 200 units so grass fills past screen edges on all sides
  var gndMat;
  gndPlaneTex = null;
  gndPlaneMat = null;
  if (stg.num === 1 && bankGrassTex) {
    // Stage 1: same seamless photo grass as bank segments so ground reads as one continuous surface
    var gt = bankGrassTex.clone(); gt.needsUpdate = true;
    gt.wrapS = THREE.RepeatWrapping; gt.wrapT = THREE.RepeatWrapping;
    gt.magFilter = THREE.LinearFilter; gt.minFilter = THREE.LinearMipmapLinearFilter;
    gt.generateMipmaps = true; gt.anisotropy = _maxAniso;
    gt.repeat.set(gndW / GROUND_TEX_WORLD, gndZ / GROUND_TEX_WORLD);
    gndMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: gt });
    gndPlaneTex = gt; gndPlaneMat = gndMat;
  } else if (stg.num === 2 && riverbedStageTex) {
    // Stage 2 wide water: BasicMaterial (no lighting) so pebble shows true color through water
    var gt2 = riverbedStageTex.clone(); gt2.needsUpdate = true;
    gt2.wrapS = THREE.RepeatWrapping; gt2.wrapT = THREE.RepeatWrapping;
    gt2.magFilter = THREE.LinearFilter; gt2.minFilter = THREE.LinearMipmapLinearFilter;
    gt2.generateMipmaps = true; gt2.anisotropy = _maxAniso;
    gt2.repeat.set(gndW / GROUND_TEX_WORLD, gndZ / GROUND_TEX_WORLD);
    gndMat = new THREE.MeshBasicMaterial({ color: 0xA0988A, map: gt2 });
    gndPlaneTex = gt2;
  } else if (stg.num === 3) {
    // Stage 3 lake: BasicMaterial (no Lambert blow-out); grass texture if loaded, solid fallback
    if (grassStage3Tex) {
      var gt3 = grassStage3Tex.clone(); gt3.needsUpdate = true;
      gt3.wrapS = THREE.RepeatWrapping; gt3.wrapT = THREE.RepeatWrapping;
      gt3.magFilter = THREE.LinearFilter; gt3.minFilter = THREE.LinearMipmapLinearFilter;
      gt3.generateMipmaps = true; gt3.anisotropy = _maxAniso;
      gt3.repeat.set(gndW / GROUND_TEX_WORLD, gndZ / GROUND_TEX_WORLD);
      gndMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: gt3 });
      grassBankMats3.push(gt3);
      gndPlaneTex = gt3; gndPlaneMat = gndMat;
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
      gt4.magFilter = THREE.LinearFilter; gt4.minFilter = THREE.LinearMipmapLinearFilter;
      gt4.generateMipmaps = true; gt4.anisotropy = _maxAniso;
      gt4.repeat.set(gndW / GROUND_TEX_WORLD, gndZ / GROUND_TEX_WORLD);
      gndMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WALL4_FLOOR_TINT).multiplyScalar(BANK_BRIGHT_MULT), map: gt4 });
      floorMats4.push(gt4);
      gndPlaneTex = gt4; gndPlaneMat = gndMat;
    } else {
      gndMat = new THREE.MeshBasicMaterial({ color: stg.bankColor });
    }
  } else if (stg.num === 5) {
    // Stage 5: dedicated scrolling clone so auto-scroll does not fight with offset.y
    if (marshTerrainTex) {
      var gndTex5 = marshTerrainTex.clone(); gndTex5.needsUpdate = true;
      gndTex5.wrapS = THREE.RepeatWrapping; gndTex5.wrapT = THREE.RepeatWrapping;
      gndTex5.magFilter = THREE.LinearFilter; gndTex5.minFilter = THREE.LinearMipmapLinearFilter;
      gndTex5.generateMipmaps = true; gndTex5.anisotropy = _maxAniso;
      gndTex5.repeat.set(gndW / GROUND_TEX_WORLD, gndZ / GROUND_TEX_WORLD);
      gndMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: gndTex5 });
      s5GndScrollTex = gndTex5;
      gndPlaneTex = gndTex5; gndPlaneMat = gndMat;
    } else {
      gndMat = new THREE.MeshBasicMaterial({ color: stg.backdrop ? stg.backdrop.bankGrass : stg.bankColor });
      s5GndScrollTex = null;
    }
  } else {
    gndMat = new THREE.MeshLambertMaterial({ color: stg.bankColor });
  }
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(gndW, gndZ), gndMat);
  gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -0.02, -55); gnd.receiveShadow = true;
  gnd.renderOrder = 0;
  if (stg.num !== 5) {
    riverGroup.add(gnd);
  } else {
    // Stage 5 STEP 2: chain tiles cover the full ground; static far plane is redundant.
    // Null refs so tuners don't write to an out-of-scene object.
    gndPlaneTex = null; gndPlaneMat = null;
  }

  // ── Ground chain: BK_SEG_N geometric tiles sharing the bank-seg scroll clock ──────────────
  groundChain3 = [];
  (function _buildGndChain() {
    var _tileD    = BK_SEG_Z + 0.25;   // 5.75 wu — same depth+overlap as bank segs
    var _gcSrcTex = null;
    if      (stg.num === 1 && bankGrassTex)     _gcSrcTex = bankGrassTex;
    else if (stg.num === 2 && riverbedStageTex) _gcSrcTex = riverbedStageTex;
    else if (stg.num === 3 && grassStage3Tex)   _gcSrcTex = grassStage3Tex;
    else if (stg.num === 4 && riverbedStageTex) _gcSrcTex = riverbedStageTex;
    else if (stg.num === 5 && marshTerrainTex)  _gcSrcTex = marshTerrainTex;
    var _gcMat;
    if (_gcSrcTex) {
      var _gcT = _gcSrcTex.clone(); _gcT.needsUpdate = true;
      _gcT.wrapS = THREE.RepeatWrapping; _gcT.wrapT = THREE.RepeatWrapping;
      _gcT.magFilter = THREE.LinearFilter; _gcT.minFilter = THREE.LinearMipmapLinearFilter;
      _gcT.generateMipmaps = true; _gcT.anisotropy = _maxAniso;
      _gcT.repeat.set(gndW / GROUND_TEX_WORLD, _tileD / GROUND_TEX_WORLD);
      if (stg.num === 1) {
        _gcMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: _gcT });
      } else if (stg.num === 2) {
        _gcMat = new THREE.MeshBasicMaterial({ color: 0xA0988A, map: _gcT });
      } else if (stg.num === 4) {
        _gcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WALL4_FLOOR_TINT).multiplyScalar(BANK_BRIGHT_MULT), map: _gcT });
      } else {
        _gcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: _gcT });
      }
    } else {
      _gcMat = gndMat.clone();
    }
    var _gcGeo = new THREE.PlaneGeometry(gndW, _tileD);
    for (var _gi = 0; _gi < BK_SEG_N; _gi++) {
      var _gz = -70.0 + _gi * BK_SEG_Z + BK_SEG_Z * 0.5;
      var _gm = new THREE.Mesh(_gcGeo, _gcMat);
      _gm.rotation.x = -Math.PI / 2;
      _gm.position.set(0, -0.02, _gz);
      _gm.renderOrder = 0;
      _gm.receiveShadow = true;
      riverGroup.add(_gm);
      groundChain3.push({ mesh: _gm, z: _gz });
    }
    console.log('[KRR] groundChain3 built: ' + groundChain3.length + ' tiles, tileD=' + _tileD + ', stage=' + stg.num);
  })();

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
  water.userData.builtRw = rw;
  console.log('[KRR] Water mesh   | y=' + water.position.y + ' renderOrder=' + water.renderOrder + ' (water above riverbed: ' + (water.renderOrder > (riverbedMesh ? riverbedMesh.renderOrder : -1)) + ')');

  // Banks -- segmented curved geometry. Stage 2 skips banks entirely (wide-water design).
  // Inner edge of every segment stays exactly at side * rw/2 (flush with play area).
  // Outer edge follows a slow sine so the bank appears to meander.
  // Play lanes, water surface, lane dividers, spawns, and collision are all untouched.
  if (stg.num !== 2) {
    const bkColor   = stg.backdrop ? stg.backdrop.bankGrass : stg.bankColor;
    if (stg.num === 1) {
      console.log('[KRR S1 BANK] bkColor=#' + bkColor.toString(16).padStart(6, '0') + ' bankGrassTex=' + (bankGrassTex ? 'loaded' : 'MISSING'));
      console.log('[KRR] maxAnisotropy=' + renderer.capabilities.getMaxAnisotropy());
    }
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

    // Apron slope hypotenuse -- constant for this build (depends only on SHORE_W and heights).
    // One shared material so all aprons in this stage get the same texel density.
    var _apronDepth = BK_SEG_Z + 0.25;
    var _slopeLen   = Math.hypot(SHORE_W, 0.60 - SHORE_TOE_Y);
    var _apronMat;
    if (stg.num === 1 && bankGrassTex) {
      var _aTex = bankGrassTex.clone(); _aTex.needsUpdate = true;
      _aTex.wrapS = THREE.RepeatWrapping; _aTex.wrapT = THREE.RepeatWrapping;
      _aTex.magFilter = THREE.LinearFilter; _aTex.minFilter = THREE.LinearMipmapLinearFilter;
      _aTex.generateMipmaps = true; _aTex.anisotropy = _maxAniso;
      _aTex.repeat.set(_slopeLen / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
      _apronMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: _aTex });
    } else if (stg.num === 3 && grassStage3Tex) {
      var _aTex3 = grassStage3Tex.clone(); _aTex3.needsUpdate = true;
      _aTex3.wrapS = THREE.RepeatWrapping; _aTex3.wrapT = THREE.RepeatWrapping;
      _aTex3.magFilter = THREE.LinearFilter; _aTex3.minFilter = THREE.LinearMipmapLinearFilter;
      _aTex3.generateMipmaps = true; _aTex3.anisotropy = _maxAniso;
      _aTex3.repeat.set(_slopeLen / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
      _apronMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: _aTex3 });
    } else if (stg.num === 4 && riverbedStageTex) {
      var _aTex4 = riverbedStageTex.clone(); _aTex4.needsUpdate = true;
      _aTex4.wrapS = THREE.RepeatWrapping; _aTex4.wrapT = THREE.RepeatWrapping;
      _aTex4.magFilter = THREE.LinearFilter; _aTex4.minFilter = THREE.LinearMipmapLinearFilter;
      _aTex4.generateMipmaps = true; _aTex4.anisotropy = _maxAniso;
      _aTex4.repeat.set(_slopeLen / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
      _apronMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WALL4_FLOOR_TINT).multiplyScalar(BANK_BRIGHT_MULT), map: _aTex4 });
    } else if (stg.num === 5 && marshTerrainTex) {
      var _aTex5 = marshTerrainTex.clone(); _aTex5.needsUpdate = true;
      _aTex5.wrapS = THREE.RepeatWrapping; _aTex5.wrapT = THREE.RepeatWrapping;
      _aTex5.magFilter = THREE.LinearFilter; _aTex5.minFilter = THREE.LinearMipmapLinearFilter;
      _aTex5.generateMipmaps = true; _aTex5.anisotropy = _maxAniso;
      _aTex5.repeat.set(_slopeLen / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
      _apronMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: _aTex5 });
    } else {
      _apronMat = bkBaseMat.clone();
    }

    for (const bkSide of [-1, 1]) {
      const bkPhase = bkSide === 1 ? 0 : Math.PI * 0.55;
      for (let bkSi = 0; bkSi < BK_SEG_N; bkSi++) {
        const bkZCtr = BK_Z0 + bkSi * BK_SEG_Z + BK_SEG_Z * 0.5;
        let   segW   = BANK_W0 + BANK_AMP * Math.sin(bkZCtr * BANK_FREQ + bkPhase);
        if (segW < 2.2) segW = 2.2;
        // Bank pushed out by SHORE_W; apron fills the gap from rw/2 to rw/2+SHORE_W
        const bkXCtr = bkSide * (rw / 2 + SHORE_W + segW / 2);
        var bkSegMat;
        // Per-segment texture clone; repeat derived from real world size for constant texel density.
        var bkSegMat;
        if (stg.num === 1 && bankGrassTex) {
          var bkTex = bankGrassTex.clone(); bkTex.needsUpdate = true;
          bkTex.wrapS = THREE.RepeatWrapping; bkTex.wrapT = THREE.RepeatWrapping;
          bkTex.magFilter = THREE.LinearFilter; bkTex.minFilter = THREE.LinearMipmapLinearFilter;
          bkTex.generateMipmaps = true; bkTex.anisotropy = _maxAniso;
          bkTex.repeat.set(segW / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
          bkSegMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: bkTex });
        } else if (stg.num === 3 && grassStage3Tex) {
          var bkTex3 = grassStage3Tex.clone(); bkTex3.needsUpdate = true;
          bkTex3.wrapS = THREE.RepeatWrapping; bkTex3.wrapT = THREE.RepeatWrapping;
          bkTex3.magFilter = THREE.LinearFilter; bkTex3.minFilter = THREE.LinearMipmapLinearFilter;
          bkTex3.generateMipmaps = true; bkTex3.anisotropy = _maxAniso;
          bkTex3.repeat.set(segW / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
          bkSegMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: bkTex3 });
        } else if (stg.num === 4 && riverbedStageTex) {
          var bkTex4 = riverbedStageTex.clone(); bkTex4.needsUpdate = true;
          bkTex4.wrapS = THREE.RepeatWrapping; bkTex4.wrapT = THREE.RepeatWrapping;
          bkTex4.magFilter = THREE.LinearFilter; bkTex4.minFilter = THREE.LinearMipmapLinearFilter;
          bkTex4.generateMipmaps = true; bkTex4.anisotropy = _maxAniso;
          bkTex4.repeat.set(segW / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
          bkSegMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WALL4_FLOOR_TINT).multiplyScalar(BANK_BRIGHT_MULT), map: bkTex4 });
        } else if (stg.num === 5 && marshTerrainTex) {
          var bkTex5 = marshTerrainTex.clone(); bkTex5.needsUpdate = true;
          bkTex5.wrapS = THREE.RepeatWrapping; bkTex5.wrapT = THREE.RepeatWrapping;
          bkTex5.magFilter = THREE.LinearFilter; bkTex5.minFilter = THREE.LinearMipmapLinearFilter;
          bkTex5.generateMipmaps = true; bkTex5.anisotropy = _maxAniso;
          bkTex5.repeat.set(segW / GROUND_TEX_WORLD, _apronDepth / GROUND_TEX_WORLD);
          bkSegMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(BANK_BRIGHT_MULT), map: bkTex5 });
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
        // Store z and bkPhase so the per-frame scroll loop can recycle and re-meander.
        // Apron reference filled in below after _shM is created.
        var _bsEntry = { mesh: bkSeg, apron: null, side: bkSide, segW: segW, z: bkZCtr, bkPhase: bkPhase };
        bankSegs3.push(_bsEntry);

        // Sloped apron: build per-side so each has correct winding without scale.x=-1 inversion.
        // outerX = bkSide * SHORE_W: right bank goes +x, left bank goes -x.
        // Winding chosen so computeVertexNormals() produces normal pointing UP and toward water center.
        //   right (bkSide=+1): [0,1,2,1,3,2] → normal (-0.53, +0.85, 0) toward -x and up
        //   left  (bkSide=-1): [0,2,1,1,2,3] → normal (+0.53, +0.85, 0) toward +x and up
        var _shHZ    = _apronDepth / 2;
        var _shOuter = bkSide * SHORE_W;
        var _shV = new Float32Array([
          0,         SHORE_TOE_Y, _shHZ,
          _shOuter,  0.60,        _shHZ,
          0,         SHORE_TOE_Y, -_shHZ,
          _shOuter,  0.60,        -_shHZ
        ]);
        var _shUV = new Float32Array([0, 1,  1, 1,  0, 0,  1, 0]);
        var _shG = new THREE.BufferGeometry();
        _shG.setAttribute('position', new THREE.BufferAttribute(_shV, 3));
        _shG.setAttribute('uv',       new THREE.BufferAttribute(_shUV, 2));
        _shG.setIndex(bkSide > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3]);
        _shG.computeVertexNormals();
        var _shM = new THREE.Mesh(_shG, _apronMat);
        _shM.position.set(bkSide * (rw / 2), 0, bkZCtr);
        _shM.receiveShadow = true;
        riverGroup.add(_shM);
        bankAprons3.push({ mesh: _shM, side: bkSide });
        _bsEntry.apron = _shM; // link apron into seg entry for z-scroll
      }
    }
  }

  // Lane dividers -- geometry built at x=0; position.x set by applyRiverWidth()
  const divMatBase = new THREE.LineBasicMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.22 });
  for (let l = 1; l < curLanes; l++) {
    const div = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.04, SPAWN_Z - 5), new THREE.Vector3(0, 0.04, DESPAWN_Z)]),
      divMatBase.clone()
    );
    riverGroup.add(div);
    laneDivs3.push({ line: div, idx: l });
  }

  addBankDecor(riverGroup, rw, stg);
  addShoreline3(riverGroup, rw, stg);
  scene.add(riverGroup);
  if (stg.backdrop && stg.num === 1) { initBankTrees3(rw, stg.backdrop, STAGE1_TREE_COUNT); }
  if (stg.backdrop && stg.num === 5) { initBankTrees3(rw, stg.backdrop, S5_TREE_COUNT); initBankBoulders3(rw, S5_BOULDER_COUNT); }
  if (stg.backdrop && stg.num === 3) { initBankTrees3(rw, stg.backdrop, STAGE3_TREE_COUNT); }
  if (stg.num === 2) { initStage2RockyShores(rw); }
  else if (stg.num === 3) {
    initBankBoulders3(rw, STAGE3_BOULDER_COUNT); initBankHouses3(rw);
    _initFarGroundGrass(rw, grassTuftTex3, bankGrassTufts3, S1_GRASS_POOL);
    _initBankTopGrass(rw, grassTuftTex3, bankGrassTufts3Top, S1_GRASS_BANK_POOL);
  }
  if (stg.num === 5) { initBankDecor5(rw); }
  if (stg.num === 1) {
    initBankBoulders3(rw, STAGE1_BOULDER_COUNT);
    _initFarGroundGrass(rw, grassTuftTex1, bankGrassTufts1, S1_GRASS_POOL);
    _initBankTopGrass(rw, grassTuftTex1, bankGrassTufts1Top, S1_GRASS_BANK_POOL);
    var _s1gl = bankGrassTufts1.filter(function(g) { return g.side === -1; }).length;
    var _s1gr = bankGrassTufts1.length - _s1gl;
    var _s1bl = bankGrassTufts1Top.filter(function(g) { return g.side === -1; }).length;
    var _s1br = bankGrassTufts1Top.length - _s1bl;
    console.log('[KRR S1GRASS] far-ground=' + bankGrassTufts1.length + ' (L=' + _s1gl + ' R=' + _s1gr + ')' +
      '  bank-top=' + bankGrassTufts1Top.length + ' (L=' + _s1bl + ' R=' + _s1br + ')');
  }
  else if (stg.num === 4) {
    initCanyonWalls4(rw);
    initCanyonFillPool4(riverGroup, rw);
    initShoreScatter4(rw);
    console.log('[KRR S4 AUDIT] wallBoulders=' + canyonWalls4.length + ' otherBankBoulders=' + bankBoulders3.length + ' shoreScatter=' + shoreScatter4.length);
  }
  // No poppies in Stage 2 (stageIdx 1) or Stage 4 (stageIdx 3) -- water-heavy stages
  if (stageIdx !== 1 && stageIdx !== 3) { initBankPoppies3(rw); }
  if (BILLBOARD_STAGES.indexOf(STAGES3[stageIdx].num) !== -1) { initBankBillboards3(rw); }
  if (stageIdx !== 1) { initBankCattails3(rw); }  // stages 1,3,4,5; skip stage 2
  applyRiverWidth();
  initWaterFX();

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
var SHORE_SPECKS  = false;  // set true to restore static pebbles at water edge (all stages except 2)
var SHORE_W       = 0.8;    // horizontal run of slope apron (tune Ctrl+Shift+F1/F2)
var SHORE_TOE_Y   = 0.10;   // y where apron meets the water (water surface at 0.15); tune Ctrl+Shift+F3/F4
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
var S5_TERR_SCROLL   = 1.0;  // Stage 5 swamp terrain scroll multiplier
// Stage 5 bank decoration pool sizes (module-level; tunable live via Ctrl+F7-F12)
var S5_POOL_BASE     = 6;   // decor pool multiplier (Ctrl+F11/F12 to tune; was 8)
var S5_TREE_COUNT    = 25;  // bank tree count for stage 5 only (Ctrl+F9/F10; was 24 → +5%)
var S5_BOULDER_COUNT = 12;  // bank boulder count for stage 5 only (Ctrl+F7/F8; was 11 → +5%)
// Stage 5 bank decoration spawn frequencies (relative to S5_POOL_BASE)
// pool count = Math.max(1, Math.round(freq * S5_POOL_BASE))
var S5_FREQ_TREE_STUMP   = 0.60;   // semi-frequent ground clutter
var S5_FREQ_FARMHOUSE    = 0.35;   // less common; farm-house-1 and farm-house-2 share this
var S5_FREQ_FISHING      = 0.15;   // rare
// Stage 5 xOff spread: random in [S5_XOFF_MIN, S5_XOFF_MIN + S5_XOFF_RANGE] wu past bank apron.
// Bank segs reach ~8 wu past the apron at max width, so MIN=5 still clips wide segs but spreads
// the field. Tune with Ctrl+Shift+F7/F8 (min) and Ctrl+Shift+F9/F10 (range).
var S5_XOFF_MIN      = 5.0;   // nearest spawn wu past bank inner edge; Ctrl+Shift+F7/F8
var S5_XOFF_RANGE    = 22.0;  // random band width (5–27 wu from apron); Ctrl+Shift+F9/F10
var FLAT_XOFF_MIN    = 2.0;   // xOff min wu past bank apron for stages 1 & 3; Ctrl+Shift+F5/F6
var FLAT_XOFF_RANGE  = 20.0;  // random band width for stages 1 & 3 (2–22 wu); Ctrl+Shift+F11/F12
// Stage 5 bank decoration sprite heights (world units); aspect width computed from image
var S5_STUMP_SCALE     = 2.5;
var S5_FARMHOUSE_SCALE = 11.9;
var GROUND_PLANE_Y     = -0.02; // far ground plane surface Y; matches gnd.position.y in buildWorld
var DECOR_SEAT_GND     = -0.02; // seat Y for all far-ground decor (houses, stumps, fishing, trees, boulders); [ / ] to tune
var DECOR_SINK_TRIM    = 0.03;  // subtracted from padFrac to lift slightly-buried sprites; Ctrl+,/. to tune (-/+0.005)
var S5_FARMHOUSE_SEAT_Y = -3.23; // bottom anchor Y; seats building base at GROUND_PLANE_Y (-0.02) accounting for ~27% art padding (0.27*11.9=3.21); set by DECOR_SEAT_GND - 3.21 in per-frame loop
var BANK_BLDG_SEAT_Y   = 0.60;  // bank top Y reference (bank box height=0.60, center 0.30); reserved for decor that sits ON the bank, not the far ground
var S5_FISHING_SCALE   = 3.50;  // 2.0 base x 2.5 x 0.7
var S5_GRASS_W        = 0.69;  // grass tuft width wu; Alt+7/8 to tune (-/+0.05); was 0.60 (+15%)
var S5_GRASS_POOL     = 189;   // ground scatter pool count; was 180 (+5%)
var S5_GRASS_BANK_POOL = 63;   // bank-top scatter pool count; was 60 (+5%)
var S1_GRASS_POOL      = 137;  // stage 1 far-ground scatter (also used by stage 3); was 130 (+5%)
var S1_GRASS_BANK_POOL = 17;   // stage 1 bank-top (also used by stage 3); was 16 (+5%)
var S5_GRASS_XBAND    = 8.0;   // scatter band width wu from bank apron edge; Alt+9/0 to tune
var S5_BANK_SEAT_Y    = 0.62;  // Y for sprites on bank-top surface (bank segs at y=0.30 + half-h=0.30)
var S5_CART_SEAT_Y     = -0.20;  // bottom anchor Y; sinks lower ~third of cart below water surface (y=0.15)
var S5_LOG_SEAT_Y      = -2.70;  // bottom anchor Y; corrects ~47-50% transparent bottom padding in fallen-log art; tune with ; / ' keys
var OBS_CUTOFF_MILE = 161.5; // no new obstacles spawn at or past this mile
// Stage 5 cinematic ending constants (tunable)
var ENDING_DECEL_START    = 161.5; // mile where cosine decel curve begins (was 158; halved 7-mile ramp to 3.5)
var ENDING_STOP_MILE      = 165;   // cosine curve endpoint (boat approaches zero speed)
var ENDING_STOP_THRESH    = 0.02;  // beaching fires when speedMult drops below this
var ENDING_WATER_START    = 161;   // mile where water starts receding (safely after last narrow at 160)
var ENDING_WATER_GONE     = 164;   // mile where water is fully receded
var ENDING_PAUSE_MS       = 3000;  // dead pause after boat beaches (ms)
var ENDING_FADE_DUR_MS    = 1500;  // "Victory?" fade-in duration (ms)
var VICTORY_FONT_PX       = 44;    // "Victory?" letter size in px; live-tune with F2/F3
var ENDING_MSG_FADE_MS    = 2500;  // final message fade-in duration (ms); tune with Shift+F2/F3
var ENDING_FORLORN_MS     = 6000;  // silence on beached kayaker before story viewer opens; Alt+1/2
var STORY_TURN_MS         = 400;   // comic page-turn duration in ms; Alt+3/4
// ── TITLE CARD TIMING (all stages + dramatic Victory? ending) ──────
var TITLE_ENTER_MS  = 500;   // standard enter animation duration ms; Shift+T/G to tune
var TITLE_HOLD_MS   = 1500;  // stage card hold duration ms; Shift+Y/H to tune
var TITLE_SHRINK_MS = 700;   // shrink-to-top animation duration ms
var TITLE_FONT_PX   = 28;    // large font size during enter/hold; Shift+U/J to tune
var TITLE_HALO_BLUR = 12;    // px, dark halo blur behind title text; { / } to tune live
var TITLE_HALO_OP   = 0.65;  // 0-1, dark halo opacity; _ / + to tune live
// Sync halo values to CSS custom properties so live DOM title elements repaint on tuner change:
document.documentElement.style.setProperty('--krr-halo-blur', TITLE_HALO_BLUR + 'px');
document.documentElement.style.setProperty('--krr-halo-op', String(TITLE_HALO_OP));
var STAGE_LABEL_PX      = 9;  // HUD stage name font size px; Shift+F4/F5 to tune
var HUD_ORANGE_ICON_PX  = 14; // HUD orange icon size (px); Shift+B/M to tune
var HUD_ORANGE_COUNT_PX = 10; // HUD orange count font size (px); Shift+S/N to tune
var HUD_FONT_SCALE      = 1.0; // group scale multiplier applied to all HUD text; Ctrl+, / Ctrl+. to tune
// Apply group scale to all HUD text elements; called once on init and on tuner keypress.
function _applyHudFontScale() {
  var _hs = HUD_FONT_SCALE;
  var _h3 = document.getElementById('hud3');         if (_h3) _h3.style.height = Math.round(62 * _hs) + 'px';
  var _mi = document.getElementById('hud3-mile');    if (_mi) _mi.style.fontSize = Math.round(7 * _hs) + 'px';
  var _sn = document.getElementById('hud3-stageNum');if (_sn) _sn.style.fontSize = Math.round(7 * _hs) + 'px';
  var _sc = document.getElementById('hud3-score');   if (_sc) _sc.style.fontSize = Math.round(12 * _hs) + 'px';
  var _be = document.getElementById('hud3-best');    if (_be) _be.style.fontSize = Math.round(8 * _hs) + 'px';
  var _oc = document.getElementById('hud3-orange-count'); if (_oc) _oc.style.fontSize = Math.round(10 * _hs) + 'px';
  var _oi = document.getElementById('hud3-orange-icon');  if (_oi) { _oi.style.width = Math.round(14 * _hs) + 'px'; _oi.style.height = Math.round(14 * _hs) + 'px'; }
  var _mc = document.querySelectorAll('.hud3-micro'); for (var _mi2 = 0; _mi2 < _mc.length; _mi2++) _mc[_mi2].style.fontSize = Math.round(5 * _hs) + 'px';
  console.log('[KRR HUD] HUD_FONT_SCALE=' + HUD_FONT_SCALE.toFixed(2));
}
_applyHudFontScale(); // set initial sizes from JS (overrides CSS base)
// ── OBSTACLE GLB CONSTANTS ──────────────────────────────────────────
// OBS_GLB_BRIGHT: color multiplier for MeshBasicMaterial (1.0 = full brightness).
// <NAME>_SCALE: applied on top of auto-fit scale (rw / rawW for full-width, LANE_W / rawW for cart).
// <NAME>_ROT_Y: radians; rotate if model faces a different axis.
// <NAME>_SEAT_Y: Y of GLB clone inside its group (0 = base sits on water at group origin).
// fallen_log note: world Y = S5_LOG_SEAT_Y + (LOG5_SEAT_Y - S5_LOG_SEAT_Y) = LOG5_SEAT_Y.
var OBS_GLB_BRIGHT    = 1.0;
var BRIDGE1_SCALE  = 1.0;  var BRIDGE1_ROT_Y  = 0;  var BRIDGE1_SEAT_Y  = 0.0;
var RAFTERS2_SCALE = 0.90; var RAFTERS2_ROT_Y = 0;  var RAFTERS2_SEAT_Y = 0.0;
var BRIDGE3_SCALE  = 1.0;  var BRIDGE3_ROT_Y  = 0;  var BRIDGE3_SEAT_Y  = 0.0;
var TUBERS4_SCALE  = 1.0;  var TUBERS4_ROT_Y  = 0;  var TUBERS4_SEAT_Y  = 0.0;
var LOG5_SCALE     = 1.0;  var LOG5_ROT_Y     = 0;  var LOG5_SEAT_Y     = 0.0;
var CART5_SCALE    = 0.35; var CART5_ROT_Y    = 0;  var CART5_SEAT_Y    = 0.0;
var _bridge1GlbLogged = false;  var _rafters2GlbLogged = false;
var _bridge3GlbLogged = false;  var _tubers4GlbLogged  = false;
var _log5GlbLogged    = false;  var _cart5GlbLogged    = false;
var BOULDER_GLB_FILES  = ['boulder-2-lit.glb', 'boulder-3-lit.glb', 'boulder-5-lit.glb'];
var BOULDER_GLB_SCALE  = [1.00, 1.25, 1.00];  // per-model tweak on top of lane fit; tune with F9/F10
var BOULDER_GLB_SEAT_Y = 0.02;                 // clone local Y inside group; tune with F7/F8
var _boulderTunerSel   = 0;                    // active index for F9/F10 scale tuner (F6 cycles)
// Poppy bank constants
var POPPY_BANK_OFF   = 0.95;  // distance from water edge to tuft anchor; tune F11/F12
var POPPY_GAP_MIN    = 150;   // minimum z-gap between poppies on recycle
var POPPY_GAP_RANGE  = 150;   // extra random gap range
var POPPY_W          = 2.2;   // sprite width; height = 0.53*W; tune Shift+F11/F12
var POPPY_SEAT_Y     = 0.52;  // y at sprite base (center(0.5,0)); tune Shift+F9/F10
var POPPY_GLOW_SCALE = 1.4;   // glow blob scale multiplier (relative to POPPY_W)
var POPPY_LEAN_ANG   = 0.38;  // max torso lean (rad) toward bank at contact
// ── pick-up timing (ms) ──────────────────────────────────────────────
var POPPY_PULL_MS    = 1200;  // total motion duration                   Ctrl+F1/F2
var POPPY_REACH_MS   = 450;   // contact fires this many ms after reach start  Ctrl+F3/F4
var POPPY_RETRACT_MS = 550;   // retract duration after contact          Ctrl+F5/F6
var POPPY_SEAT_MS    = 200;   // bloom-to-hat seat duration after retract
// ── zazz ─────────────────────────────────────────────────────────────
var POPPY_SWAY_AMP   = 0.06;  // sprite sway amplitude (rad); Ctrl+Shift+S/D to tune
var POPPY_SWAY_SPD   = 0.025; // sway phase per frame
// ── hat poppy (shield indicator) ─────────────────────────────────────
// poppy-hat.png: 256x317 bloom-on-stub, stem tip at bottom edge (v=1).
// Anchored by stem tip (center.set(0.41, 0.0)); bloom nods above placement point.
// Parented to glbTorsoGroup so it leans with the entire upper body.
// Position is in waist-group-local (GLB-native) space:
//   local.x = POPPY_HAT_MX, local.y = POPPY_HAT_MY - TORSO_HINGE_Y, local.z = POPPY_HAT_MZ - TORSO_HINGE_Z
// Hat spans y 0.73..0.93 in model space; band at y~0.73, front-left: x~+0.08, z~+0.20.
var POPPY_HAT_MY     = 0.75;  // band height in GLB-native Y; Ctrl+Shift+Y/U
var POPPY_HAT_MZ     = 0.20;  // forward offset (GLB +Z = toward camera); Ctrl+Shift+I/O
var POPPY_HAT_MX     = 0.08;  // left offset (GLB +X = character left); Ctrl+Shift+G/J
var POPPY_HAT_SCALE  = 0.32;   // model-local size; world size = SCALE * KAYAKER_SCALE(1.31) ~0.42; Ctrl+Shift+K/L
var POPPY_PICK_SIZE  = 0.6;    // world-space start size of traveling bloom (scene-parented sprite)
console.log('[KRR HAT] POPPY_HAT_SCALE=' + POPPY_HAT_SCALE + ' POPPY_PICK_SIZE=' + POPPY_PICK_SIZE);
var POPPY_HAT_TILT   = 0.22;  // rest lean angle (radians, CCW = outward); Ctrl+Shift+C/V
var POPPY_HAT_SWAY_K = 0.40;  // multiplier: kayakTurnY3 -> extra tilt; Ctrl+Shift+N/M
// Torso hinge pivot in GLB-native space (before KAYAKER_SCALE=1.31 and rotY=PI).
// world_y = TORSO_HINGE_Y * 1.31 ~ 0.30;  world_z = -TORSO_HINGE_Z * 1.31 ~ 0.16
// Torso bbox (world): y 0.11..0.59  z 0.00..0.33; waist ~ world (0, 0.30, 0.16).
var TORSO_HINGE_Y    = 0.229;  // Ctrl+Shift+F7/F8 +/-0.01
var TORSO_HINGE_Z    = -0.122; // Ctrl+Shift+F9/F10 +/-0.01 (negative = GLB forward)
// ── reach detection window ───────────────────────────────────────────
var POPPY_REACH_Z    = -7.0;  // z where reach starts (early -- well before player-level)
// ===== TEMP DEV ENDING-JUMP (REMOVE BEFORE LAUNCH) =====
var ENDING_TEST_MILE = 155;
// ===== END TEMP DEV ENDING-JUMP =====
var FW2_SEAT_Y         = -7.50;  // Stage 2 raft_train sprite y-offset within group; corrects ~44% transparent bottom padding in tubing-obstacle-2.png; tune with f / r keys
var FW4_SEAT_Y         = -4.55;  // Stage 4 old_mining_bridge donut-raft y-offset; asp=0.773, tr4H=11.38, seat=-(11.38*0.40); tune with l / s keys
var FW1_SEAT_Y         = -8.55;  // Stage 1 fallen_sequoia bridge y-offset; piling legs dip ~0.58 below waterline; tune with 6 / 7 keys
var FW3_WIDTH_MULT     = 1.40;   // Stage 3 bridge scale: width multiplier (baked; no free keys for live tuner)
var FW3_HEIGHT_MULT    = 1.15;   // Stage 3 bridge scale: height multiplier (independent of width)
var FW3_SEAT_Y         = -7.13;  // Stage 3 bridge y-offset; recomputed to keep piling base at y=-0.58 after height scale; tune with 8 / 9 keys
var FW_HULL_H    = 0.50;      // hull strip height (Y) under raft waterline; tune with e/q in Stage 2
var FW_HULL_D    = 0.5;       // hull strip depth (Z) hint of thickness
var FW_HULL_TINT = 0x4A3A2C; // dark muted hull shadow
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

    // Rocks scattered along the shoreline (disabled by default; set SHORE_SPECKS=true to restore)
    if (SHORE_SPECKS) {
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
  spr.center.set(0.5, _effectivePadFrac(tex && tex._padFrac !== undefined ? tex._padFrac : 0));
  spr.scale.set(h * 0.72, h, 1);
  return spr;
}

var STAGE1_TREE_COUNT    = 67;   // bank tree pool for stage 1; was 64 (+5%)
var STAGE1_BOULDER_COUNT = 13;   // bank boulder pool for stage 1; was 12 (+5%)
var STAGE3_TREE_COUNT    = 44;   // bank tree pool for stage 3; was 42 (+5%)
var TREE_XOFF_BIAS       = 0.50; // exponent for tree xOff: 0.5=strongly outward, 1.0=uniform; Ctrl+Shift+B/H
var STAGE3_BOULDER_COUNT = 12;   // bank boulder pool for stage 3; was 11 (+5%)
var CATTAIL_GROUPS_PER_SIDE = 6;  // group slots per bank side (tune to adjust density)

// ── BILLBOARD CONSTANTS ───────────────────────────────────────────────────
var BILLBOARD_SCALE     = 3.5;   // world-unit height of sign; Shift+C/F to tune (-/+0.25)
var BILLBOARD_GAP_MIN   = 270;   // min wu per-sprite gap; pool=3 so any-billboard cadence ≈ gap/3; Shift+Q/E (-/+5)
var BILLBOARD_GAP_RANGE = 60;    // random extra (per-sprite 270–330 wu → any-billboard ~30-37s at 3 wu/s)
var BILLBOARD_STAGES    = [1, 3, 5]; // stg.num values where billboards spawn; edit directly to change

function initBankTrees3(rw, bd, count) {
  var TREE_COUNT = (count !== undefined) ? count : 32;
  for (var ti = 0; ti < TREE_COUNT; ti++) {
    var side    = ti % 2 === 0 ? -1 : 1;
    var variety = Math.floor(Math.random() * 4);
    var xOff;
    if (stageIdx === 0 || stageIdx === 2) xOff = FLAT_XOFF_MIN + FLAT_XOFF_RANGE * Math.pow(Math.random(), TREE_XOFF_BIAS);
    else if (stageIdx === 4) xOff = S5_XOFF_MIN + S5_XOFF_RANGE * Math.pow(Math.random(), TREE_XOFF_BIAS);
    else xOff = 1.4 + Math.floor(Math.random() * 4) * 1.8;
    var xBase   = side * (rw / 2 + SHORE_W + xOff);
    // Spread evenly across the full visible river length at start
    var zInit   = SPAWN_Z + (ti / TREE_COUNT) * (Math.abs(SPAWN_Z) + 12);
    var h       = makeBankTreeHeight(variety);
    var spr     = makeBankTreeSprite(variety, h);
    spr.position.set(xBase, DECOR_SEAT_GND, zInit);
    scene.add(spr);
    bankTrees3.push({ sprite: spr, side: side, z: zInit, xOff: xOff });
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
    var xOff;
    if (stageIdx === 2) xOff = FLAT_XOFF_MIN + Math.random() * FLAT_XOFF_RANGE;
    else if (stageIdx === 4) xOff = S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE;
    else xOff = 1.0 + Math.floor(Math.random() * 4) * 1.6 + 0.3;
    var xBase  = side * (rw / 2 + SHORE_W + xOff);
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
    spr.position.set(xBase, DECOR_SEAT_GND, zInit);
    scene.add(spr);
    bankBoulders3.push({ sprite: spr, side: side, z: zInit, xOff: xOff, shoreW: SHORE_W });
  }
}

// ── SCROLLING CATTAIL POOL (GROUP-BASED) ──────────────────────────────────
// Groups: SINGLE (1 plant), STRETCH (4–7 in a Z-line), CONGREGATION (5–9 cluster).
// bankCattails3 = flat list of all sprites for teardown.
// _cattailGroups = group objects for per-frame scroll/recycle.

function _ctMkCattail(rw, side, anchorZ, dz, xOff, members) {
  var vIdx = Math.floor(Math.random() * 2);
  var tex  = cattailTex[vIdx];
  var cH   = 0.85 + Math.random() * 0.85;
  var cAR  = tex && tex.image && tex.image.naturalHeight > 0
    ? tex.image.naturalWidth / tex.image.naturalHeight : 0.38;
  var mat  = new THREE.SpriteMaterial({ map: tex || null, transparent: true, alphaTest: 0.06, depthWrite: false });
  var spr  = new THREE.Sprite(mat);
  spr.center.set(0.5, 0);
  spr.scale.set(cH * cAR, cH, 1);
  spr.position.set(side * (rw / 2 + xOff), DECOR_SEAT_GND, anchorZ + dz);
  scene.add(spr);
  members.push({ sprite: spr, dx: xOff, dz: dz, isGrass: false, varIdx: vIdx });
}

function _ctMkGrass(rw, side, anchorZ, dz, xOff, members, texPool) {
  var tex    = texPool.length > 0 ? texPool[Math.floor(Math.random() * texPool.length)] : null;
  var natAR  = tex && tex.image && tex.image.naturalHeight > 0
    ? tex.image.naturalHeight / tex.image.naturalWidth : 0.621;
  var scl    = 0.65 + Math.random() * 0.35;
  var padFrac = tex && tex._padFrac !== undefined ? tex._padFrac : 0;
  var mat    = tex
    ? new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
    : new THREE.SpriteMaterial({ color: 0x7A9A60, transparent: true, opacity: 0.85 });
  var spr    = new THREE.Sprite(mat);
  spr.scale.set(S5_GRASS_W * scl, S5_GRASS_W * natAR * scl, 1);
  spr.center.set(0.5, _effectivePadFrac(padFrac));
  spr.position.set(side * (rw / 2 + xOff), DECOR_SEAT_GND, anchorZ + dz);
  scene.add(spr);
  members.push({ sprite: spr, dx: xOff, dz: dz, isGrass: true });
}

function initBankCattails3(rw) {
  _cattailGroups = [];
  var zSpan = Math.abs(SPAWN_Z) + DESPAWN_Z;  // full visible Z range

  // Grass textures to supplement each stretch / congregation
  var _gTexPool;
  if      (stageIdx === 0) _gTexPool = grassTuftTex1 ? [grassTuftTex1] : [];
  else if (stageIdx === 2) _gTexPool = grassTuftTex3 ? [grassTuftTex3] : [];
  else if (stageIdx === 3) _gTexPool = [grassTuftTex1, grassTuftTex3, grassTuftTex5].filter(Boolean);
  else if (stageIdx === 4) _gTexPool = grassTuftTex5 ? [grassTuftTex5] : [];
  else _gTexPool = [];

  [-1, 1].forEach(function(bankSide) {
    for (var gi = 0; gi < CATTAIL_GROUPS_PER_SIDE; gi++) {
      // Stagger group anchors across Z, with random jitter inside each slot
      var anchorZ = SPAWN_Z + (gi + 0.25 + Math.random() * 0.55) * (zSpan / CATTAIL_GROUPS_PER_SIDE);

      var typeRoll = Math.random();
      var gType = typeRoll < 0.40 ? 'SINGLE' : typeRoll < 0.70 ? 'STRETCH' : 'CONGREGATION';
      var members = [];

      if (gType === 'SINGLE') {
        var _xo = 0.08 + Math.random() * 0.42;
        _ctMkCattail(rw, bankSide, anchorZ, 0, _xo, members);

      } else if (gType === 'STRETCH') {
        var _cnt     = 4 + Math.floor(Math.random() * 4);   // 4–7 plants
        var _spacing = 0.48 + Math.random() * 0.42;          // Z gap between plants
        var _baseX   = 0.06 + Math.random() * 0.32;
        for (var si = 0; si < _cnt; si++) {
          var _dz = (si - (_cnt - 1) / 2) * _spacing;
          var _dx = Math.max(0.05, _baseX + (Math.random() - 0.5) * 0.12);
          _ctMkCattail(rw, bankSide, anchorZ, _dz, _dx, members);
        }
        // 2–4 grass sprites scattered around the stretch
        var _gCnt = 2 + Math.floor(Math.random() * 3);
        for (var gsi = 0; gsi < _gCnt; gsi++) {
          var _gdz = (Math.random() - 0.5) * _cnt * _spacing * 1.5;
          var _gdx = SHORE_W * 0.15 + Math.random() * (SHORE_W * 0.80);
          _ctMkGrass(rw, bankSide, anchorZ, _gdz, _gdx, members, _gTexPool);
        }

      } else {  // CONGREGATION
        var _cnt  = 5 + Math.floor(Math.random() * 5);   // 5–9 plants
        var _baseX = 0.10 + Math.random() * 0.32;
        for (var ci = 0; ci < _cnt; ci++) {
          var _dz = (Math.random() - 0.5) * 2.0;
          var _dx = Math.max(0.05, _baseX + (Math.random() - 0.5) * 0.28);
          _ctMkCattail(rw, bankSide, anchorZ, _dz, _dx, members);
        }
        // 2–4 grass sprites around the cluster
        var _gCnt = 2 + Math.floor(Math.random() * 3);
        for (var gci = 0; gci < _gCnt; gci++) {
          var _gdz = (Math.random() - 0.5) * 3.2;
          var _gdx = SHORE_W * 0.15 + Math.random() * (SHORE_W * 0.80);
          _ctMkGrass(rw, bankSide, anchorZ, _gdz, _gdx, members, _gTexPool);
        }
      }

      // maxDz = furthest-downstream member offset (triggers recycle when past DESPAWN)
      var maxDz = 0;
      for (var mi = 0; mi < members.length; mi++) {
        if (members[mi].dz > maxDz) maxDz = members[mi].dz;
      }

      _cattailGroups.push({ side: bankSide, z: anchorZ, type: gType, members: members, maxDz: maxDz });
      for (var ti = 0; ti < members.length; ti++) { bankCattails3.push(members[ti]); }
    }
  });
}

// ── SCROLLING BILLBOARD POOL ──────────────────────────────────────────────
// Rare roadside signs on stages 1, 3, 5. Pool of 3 sprites (staggered so at most
// one is visible at a time). Gap-based rarity like poppies; texture cycles to
// avoid back-to-back repeats. Bottom-anchored, anisotropy-filtered.
function initBankBillboards3(rw) {
  var POOL = 3;
  var _maxA = renderer.capabilities.getMaxAnisotropy();
  for (var bbi = 0; bbi < POOL; bbi++) {
    var bbSide  = (bbi % 2 === 0) ? -1 : 1;
    var bbTIdx  = bbi % 3;
    var bbAR    = billboardNatAR[bbTIdx];
    var bbH     = BILLBOARD_SCALE;
    var bbTex   = billboardTex[bbTIdx];
    var bbMat   = new THREE.SpriteMaterial({
      map: bbTex || null, transparent: true, alphaTest: 0.05, depthWrite: false
    });
    if (bbTex) { bbTex.anisotropy = _maxA; bbTex.needsUpdate = true; }
    var bbSpr   = new THREE.Sprite(bbMat);
    bbSpr.center.set(0.5, _effectivePadFrac(bbTex && bbTex._padFrac !== undefined ? bbTex._padFrac : 0));
    bbSpr.scale.set(bbH * bbAR, bbH, 1);
    var bbXOff  = 2.5 + Math.random() * 2.0;  // world units past bank-top edge
    var bbXBase = bbSide * (rw / 2 + SHORE_W + bbXOff);
    // Stagger widely so sprites don't all arrive at once
    var bbZ     = SPAWN_Z - (BILLBOARD_GAP_MIN + Math.random() * BILLBOARD_GAP_RANGE) * (bbi + 1);
    bbSpr.position.set(bbXBase, DECOR_SEAT_GND, bbZ);
    scene.add(bbSpr);
    bankBillboards3.push({ sprite: bbSpr, side: bbSide, z: bbZ, xOff: bbXOff, texIdx: bbTIdx });
  }
  var _bbZs = bankBillboards3.map(function(b) { return b.z.toFixed(1); }).join(', ');
  console.log('[KRR BILLBOARD INIT] ' + bankBillboards3.length + ' sprites, z=[' + _bbZs + '] gap_min=' + BILLBOARD_GAP_MIN + ' window=[' + SPAWN_Z + ',' + DESPAWN_Z + ']');
}

function initBankPoppies3(rw) {
  var POOL = 3;
  for (var pi = 0; pi < POOL; pi++) {
    var side  = (pi % 2 === 0) ? -1 : 1;
    var tuftU = side === -1 ? 0.16 : 0.81;
    var bloomU = side === -1 ? 0.80 : 0.19;
    var tex   = side === -1 ? _poppyTexL : _poppyTexR;
    var mat   = new THREE.SpriteMaterial({ map: tex || null, transparent: true, depthWrite: false });
    var spr   = new THREE.Sprite(mat);
    spr.renderOrder = 5;
    spr.center.set(0.5, 0);
    spr.scale.set(POPPY_W, 0.7305 * POPPY_W, 1);
    // tuftX: the real-world x of the tuft anchor (no SHORE_W -- POPPY_BANK_OFF is absolute from water edge)
    var tuftX = side * (rw / 2 + POPPY_BANK_OFF);
    var zInit = SPAWN_Z - (POPPY_GAP_MIN + Math.random() * POPPY_GAP_RANGE) * (pi + 1);
    spr.position.set(tuftX + (0.5 - tuftU) * POPPY_W, POPPY_SEAT_Y, zInit);
    scene.add(spr);
    // Glow sprite: centered on the bloom, additive blending, pulses each frame
    var bloomX = tuftX + (bloomU - tuftU) * POPPY_W;
    var bloomY = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W;
    var glowMat = new THREE.SpriteMaterial({
      map: _poppyGlowTex || null, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.40
    });
    var glowSpr = new THREE.Sprite(glowMat);
    glowSpr.center.set(0.5, 0.5);
    glowSpr.scale.setScalar(POPPY_GLOW_SCALE * POPPY_W);
    glowSpr.renderOrder = 4;
    glowSpr.position.set(bloomX, bloomY, zInit);
    scene.add(glowSpr);
    bankPoppies3.push({
      sprite: spr, glow: glowSpr, side: side, z: zInit,
      picked: false, claimed: false, tuftU: tuftU, bloomU: bloomU,
      glowFlareSt: 0,
      swayPhase: Math.random() * Math.PI * 2, // per-poppy sway phase offset
      recoilSt: 0, recoilDir: 1               // recoil wobble after bloom detach
    });
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
  if (canyonFillSegs4.length > 0 && canyonFillSegs4[0].mesh.material) {
    var _rfMat = canyonFillSegs4[0].mesh.material;
    if (_rfMat.map) _rfMat.map.dispose();
    _rfMat.dispose();
  }
  canyonFillSegs4.forEach(function(s) { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); s.mesh.geometry.dispose(); });
  canyonFillSegs4 = [];
  canyonFill4 = [];
  rockWallMats4 = [];
  var rw4 = riverWidth();
  initCanyonFillPool4(riverGroup, rw4);
  initCanyonWalls4(rw4);
  console.log('[KRR WALL4 COVER] count=' + WALL4_COUNT + ' coverX=' + WALL4_COVER_X.toFixed(1) + ' rockTop=' + WALL4_ROCK_TOP.toFixed(1));
}
// ===== END TEMP WALL4 COVER helper =====

// Stage 4: z-scrolling rock-wall segment pool. BK_SEG_N sloped quads per side recycle like
// bank segments so the texture moves with the world instead of via UV offset animation.
// Each segment is a trapezoid: inner-bottom at (E, yBot) raking to outer-top at (E+W, H).
function initCanyonFillPool4(rg, rw) {
  var E    = rw / 2;
  var W    = WALL4_ROCK_WIDTH;
  var H    = WALL4_ROCK_TOP;
  var yBot = -0.5;
  var halfZ = (BK_SEG_Z + 0.25) / 2;
  var z0   = SPAWN_Z - 5;  // same starting Z as bank segs (BK_Z0)
  console.log('[KRR CANYON FILL POOL] N=' + BK_SEG_N + 'x2 segs E=' + E.toFixed(1) + ' W=' + W + ' H=' + H + ' tint=0x' + WALL4_ROCK_TINT.toString(16));
  // One shared texture + material for all segments; texture repeat per segment
  var cfTex = null;
  if (riverbedStageTex) {
    cfTex = riverbedStageTex.clone();
    cfTex.needsUpdate = true;
    cfTex.wrapS = THREE.RepeatWrapping; cfTex.wrapT = THREE.RepeatWrapping;
    cfTex.magFilter = THREE.NearestFilter; cfTex.minFilter = THREE.NearestFilter;
    cfTex.generateMipmaps = false;
    // U repeat per segment = total_tiles / N so density matches the old single quad
    cfTex.repeat.set(WALL4_ROCK_RPT_U / BK_SEG_N, WALL4_ROCK_RPT_V);
  }
  var cfMat = new THREE.MeshBasicMaterial({ color: WALL4_ROCK_TINT, map: cfTex || null, side: THREE.DoubleSide });
  for (var cfSide = -1; cfSide <= 1; cfSide += 2) {
    var xInner = cfSide * E;
    var xOuter = cfSide * (E + W);
    for (var cfSi = 0; cfSi < BK_SEG_N; cfSi++) {
      var zCtr = z0 + cfSi * BK_SEG_Z + BK_SEG_Z * 0.5;
      // Segment-local Z: -halfZ = back edge (far from camera), +halfZ = front edge (near)
      var pos = new Float32Array([
        xInner, yBot, -halfZ,  // 0 bottom-back
        xInner, yBot, +halfZ,  // 1 bottom-front
        xOuter, H,   +halfZ,   // 2 top-front
        xOuter, H,   -halfZ,   // 3 top-back
      ]);
      var uv = new Float32Array([0, 0,  1, 0,  1, 1,  0, 1]);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv',       new THREE.BufferAttribute(uv,  2));
      geo.setIndex([0, 1, 2,  0, 2, 3]);
      var mesh = new THREE.Mesh(geo, cfMat);
      mesh.renderOrder = 0;
      mesh.position.z = zCtr;
      rg.add(mesh);
      canyonFill4.push(mesh);
      canyonFillSegs4.push({ mesh: mesh, z: zCtr });
    }
  }
}


// Stage 4 shore scatter: small pebble sprites on the flat strip between water edge and canyon wall.
// X band: E + SHORE4_X_MIN .. E + SHORE4_X_MAX, well outside the play lane (WALL4_INNER_GAP=1.8).
// No collision — purely decorative. Reuses bankBoulderTex at greatly reduced scale.
function initShoreScatter4(rw) {
  var E     = rw / 2;
  var zSpan = Math.abs(SPAWN_Z) + 12;
  for (var si = 0; si < SHORE4_COUNT * 2; si++) {
    var side   = si < SHORE4_COUNT ? -1 : 1;
    var dx     = SHORE4_X_MIN + Math.random() * (SHORE4_X_MAX - SHORE4_X_MIN);
    var xPos   = side * (E + dx);
    var zInit  = SPAWN_Z + Math.random() * zSpan;
    var texIdx = Math.floor(Math.random() * bankBoulderTex.length);
    var tex    = bankBoulderTex[texIdx];
    var mat    = tex
      ? new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.10 })
      : new THREE.SpriteMaterial({ color: 0x7A6A58, transparent: true, opacity: 0.85 });
    // subtle tint variation so pebbles don't look uniform
    var tv = 0.72 + Math.random() * 0.28;
    mat.color.setRGB(tv, tv, tv);
    var flipX  = Math.random() < 0.5 ? 1 : -1;
    var h      = SHORE4_SCALE_MIN + Math.random() * (SHORE4_SCALE_MAX - SHORE4_SCALE_MIN);
    var wf     = 0.75 + Math.random() * 0.70; // wider or more squarish pebbles
    var spr    = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);  // base-anchored; sits on the shore surface
    spr.scale.set(h * wf * flipX, h, 1);
    spr.position.set(xPos, -0.12, zInit); // slightly below 0 so base kisses the pebble-floor
    spr.renderOrder = 2;
    scene.add(spr);
    shoreScatter4.push({ sprite: spr, side: side, dx: dx, z: zInit, h: h, wf: wf, flipX: flipX });
  }
}

var STAGE3_HOUSE_COUNT = 4;    // sparse landmark count; tune by eye (3-6 feels right)
var STAGE3_HOUSE_SCALE = 8;    // sprite height in world units; tune by eye

// Stage 4 canyon wall boulder constants -- all cosmetic, outside play lane, no collision
// Boulders scatter-fill the FULL slope surface (not row-based); see initCanyonWalls4
var WALL4_COUNT        = 350;  // boulder sprites per side; crank to pack slope (TEMP COVER tuner: z/x)
var WALL4_COVER_X      = 18;   // outward X extent boulders reach (0..WALL4_ROCK_WIDTH) (TEMP COVER tuner: c/f)
var WALL4_INNER_GAP    = 1.8;  // x-gap from play edge E to innermost boulder; channel-clamp guard
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
var WALL4_FLOOR_TINT        = 0xFFFFFF;
var WALL4_FLOOR_SCROLL_MULT = 1.0;
// Opaque rock wall seal behind boulders -- quad per side raking from channel edge up and out
var WALL4_ROCK_WIDTH   = 20;         // outward X extent of rock wall quad from channel edge (world units)
var WALL4_ROCK_TOP     = 18;         // wall top height; was 24 (PART C reduction) (TEMP COVER tuner: h/j)
var WALL4_ROCK_TINT    = 0x7A6850;  // darker warm canyon rock
var WALL4_ROCK_RPT_U   = 5;         // texture tiles along stage length
var WALL4_ROCK_RPT_V   = 3;         // texture tiles along slope height
var WALL4_ROCK_SCROLL_MULT = 1.0;   // multiply rock-wall scroll rate vs world speed
// Shore scatter (small pebbles on the flat strip between water and canyon wall)
var SHORE4_COUNT      = 80;   // pebble sprites per side
var SHORE4_SCALE_MIN  = 0.18; // minimum pebble height (world units)
var SHORE4_SCALE_MAX  = 0.45; // maximum pebble height
var SHORE4_X_MIN      = 0.05; // inward margin from play edge E (stays outside lane)
var SHORE4_X_MAX      = 1.35; // outward limit (WALL4_INNER_GAP=1.8 minus a small safety margin)
// Legacy slope constants -- not used; retained for reference
var WALL4_FILL_COLOR        = 0x3A3028;
var WALL4_FILL_H_FAR        = -0.5;
var WALL4_FILL_SLOPE_INNER  = 0.0;
var WALL4_FILL_SLOPE_OUTER  = 3.0;

function initBankHouses3(rw) {
  for (var hi = 0; hi < STAGE3_HOUSE_COUNT; hi++) {
    var side   = hi % 2 === 0 ? -1 : 1;
    var texIdx = Math.floor(Math.random() * lakeHouseTex.length);
    var xOff   = FLAT_XOFF_MIN + Math.random() * FLAT_XOFF_RANGE;
    var xBase  = side * (rw / 2 + xOff);
    var zInit  = SPAWN_Z + (hi / STAGE3_HOUSE_COUNT) * (Math.abs(SPAWN_Z) + 12);
    var tex    = lakeHouseTex[texIdx];
    var mat;
    if (tex) {
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
    } else {
      mat = new THREE.SpriteMaterial({ color: 0xC8A870, transparent: true, opacity: 0.90 });
    }
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, _effectivePadFrac(tex && tex._padFrac !== undefined ? tex._padFrac : 0));
    var hAspInit = (tex && tex.image && tex.image.naturalHeight > 0)
      ? tex.image.naturalWidth / tex.image.naturalHeight
      : 1.0;   // square fallback; late-patch corrects it once texture loads
    spr.scale.set(STAGE3_HOUSE_SCALE * hAspInit, STAGE3_HOUSE_SCALE, 1);
    spr.position.set(xBase, DECOR_SEAT_GND, zInit);
    scene.add(spr);
    bankHouses3.push({ sprite: spr, side: side, z: zInit, texIdx: texIdx, xOff: xOff });
  }
}

// Shared far-ground grass scatter — used by any stage in GRASS_TEX_BY_STAGE.
// Stores natural aspect ratio (ar = h/w) in each pool entry so the recycle
// loop can restore correct proportions per stage.
function _initFarGroundGrass(rw, stageTex, pool, count) {
  var zSpan = Math.abs(SPAWN_Z) + DESPAWN_Z; // -65 to +9: full visible range, none past despawn
  var natAR = (stageTex && stageTex.image && stageTex.image.naturalHeight > 0)
    ? stageTex.image.naturalHeight / stageTex.image.naturalWidth
    : 0.621; // fallback (stage-5 ratio) until texture loads
  for (var gti = 0; gti < count; gti++) {
    var gtSide = Math.random() < 0.5 ? -1 : 1;
    var gtMult = 0.85 + Math.random() * 0.30;
    var gtMat  = stageTex
      ? new THREE.SpriteMaterial({ map: stageTex, transparent: true, alphaTest: 0.08 })
      : new THREE.SpriteMaterial({ color: 0x7A9A60, transparent: true, opacity: 0.90 });
    var gtspr  = new THREE.Sprite(gtMat);
    gtspr.scale.set(S5_GRASS_W * gtMult, S5_GRASS_W * natAR * gtMult, 1);
    var gtXOff = 0.5 + Math.random() * S5_GRASS_XBAND;
    var gtX    = gtSide * (rw / 2 + SHORE_W + gtXOff);
    var gtZ    = SPAWN_Z + ((gti + Math.random()) / count) * zSpan;
    gtspr.position.set(gtX, DECOR_SEAT_GND, gtZ);
    gtspr.center.set(0.5, _effectivePadFrac(stageTex && stageTex._padFrac !== undefined ? stageTex._padFrac : 0));
    scene.add(gtspr);
    pool.push({ sprite: gtspr, side: gtSide, z: gtZ, xOff: gtXOff, scaleMult: gtMult, ar: natAR });
  }
}

// Shared bank-top grass scatter — narrow strip right beside the water.
// X is within the bank width: SHORE_W to SHORE_W+3.5 wu from river edge, Y = S5_BANK_SEAT_Y.
function _initBankTopGrass(rw, stageTex, pool, count) {
  var zSpan  = Math.abs(SPAWN_Z) + DESPAWN_Z; // -65 to +9: covers full visible range at start
  var padFrac = stageTex && stageTex._padFrac !== undefined ? stageTex._padFrac : 0;
  var natAR   = (stageTex && stageTex.image && stageTex.image.naturalHeight > 0)
    ? stageTex.image.naturalHeight / stageTex.image.naturalWidth
    : 0.621;
  for (var bti = 0; bti < count; bti++) {
    var btSide = Math.random() < 0.5 ? -1 : 1;
    var btMult = 0.70 + Math.random() * 0.25;
    var btMat  = stageTex
      ? new THREE.SpriteMaterial({ map: stageTex, transparent: true, alphaTest: 0.08 })
      : new THREE.SpriteMaterial({ color: 0x7A9A60, transparent: true, opacity: 0.90 });
    var btspr  = new THREE.Sprite(btMat);
    btspr.scale.set(S5_GRASS_W * btMult, S5_GRASS_W * natAR * btMult, 1);
    btspr.center.set(0.5, _effectivePadFrac(padFrac));
    var btXOff = SHORE_W + 0.15 + Math.random() * 3.2;
    var btX    = btSide * (rw / 2 + btXOff);
    var btZ    = SPAWN_Z + ((bti + Math.random()) / count) * zSpan;
    btspr.position.set(btX, S5_BANK_SEAT_Y, btZ);
    scene.add(btspr);
    pool.push({ sprite: btspr, side: btSide, z: btZ, xOff: btXOff, scaleMult: btMult, ar: natAR });
  }
}

// ── WATER FX SYSTEM ──────────────────────────────────────────────────────────
// Pooled ambient water-surface effects (ripple, bubble, current streak).
// Active on all stages; sprites sit at y=0.16 (just above water surface at y=0.15).
// renderOrder 2.2 floats above water (2) without z-fighting.

function teardownWaterFX() {
  for (var _wi = 0; _wi < wfxPool.length; _wi++) {
    var _wf = wfxPool[_wi];
    if (_wf.sprite.parent) scene.remove(_wf.sprite);
    _wf.mat.dispose();
  }
  wfxPool = [];
  _wfxRippleTimer = 0; _wfxBubbleTimer = 0; _wfxCurrentTimer = 0;
}

function initWaterFX() {
  teardownWaterFX();
  var _types = [
    { type: 'ripple',  tex: fxRippleTex,  n: 8 },
    { type: 'bubble',  tex: fxBubbleTex,  n: 4 },
    { type: 'current', tex: fxCurrentTex, n: 8 },
  ];
  for (var _ti = 0; _ti < _types.length; _ti++) {
    var _td = _types[_ti];
    for (var _si = 0; _si < _td.n; _si++) {
      var _wmat = new THREE.SpriteMaterial({
        map: _td.tex || null, transparent: true, depthWrite: false, opacity: 0,
      });
      var _wspr = new THREE.Sprite(_wmat);
      _wspr.renderOrder = 2.2;
      _wspr.visible = false;
      _wspr.position.set(0, 0.16, -100);
      scene.add(_wspr);
      wfxPool.push({ sprite: _wspr, mat: _wmat, type: _td.type, active: false, age: 0, life: 1, z: -100, extraSpd: 0, startSc: 0.3, startOp: 0.35, riseFrames: 48 });
    }
  }
  _wfxRippleTimer  = 10 + Math.floor(Math.random() * 40);
  _wfxBubbleTimer  = 20 + Math.floor(Math.random() * 60);
  _wfxCurrentTimer = 30 + Math.floor(Math.random() * 80);
}

function _activateWFX(type) {
  for (var _ai = 0; _ai < wfxPool.length; _ai++) {
    var _af = wfxPool[_ai];
    if (_af.type !== type || _af.active) continue;
    var _ax = (Math.random() - 0.5) * (rwCur - 0.6);
    var _az = -30 + Math.random() * 33;
    _af.z = _az; _af.age = 0; _af.active = true; _af.sprite.visible = true; _af.extraSpd = 0;
    if (type === 'ripple') {
      _af.life = 96; _af.startSc = 0.3; _af.startOp = 0.35;
      _af.mat.opacity = 0; _af.sprite.scale.set(0.3, 0.3, 1);
      _af.sprite.position.set(_ax, 0.16, _az);
    } else if (type === 'bubble') {
      // Rise phase: 48 frames from y=0.04 to y=0.16; pop phase: 8 frames
      _af.life = 56; _af.riseFrames = 48;
      _af.mat.opacity = 0; _af.sprite.scale.set(0.15, 0.15, 1);
      _af.sprite.position.set(_ax, 0.04, _az);
    } else {
      _af.life = 132;
      _af.mat.opacity = 0; _af.sprite.scale.set(1.6, 0.25, 1);
      _af.sprite.position.set(_ax, 0.16, _az);
    }
    return;
  }
}

function _triggerPopRipple(x, z) {
  for (var _pri = 0; _pri < wfxPool.length; _pri++) {
    var _pr = wfxPool[_pri];
    if (_pr.type !== 'ripple' || _pr.active) continue;
    _pr.z = z; _pr.age = 0; _pr.life = 72; _pr.extraSpd = 0;
    _pr.startSc = 0.1; _pr.startOp = 0.22;
    _pr.active = true; _pr.sprite.visible = true;
    _pr.mat.opacity = 0; _pr.sprite.scale.set(0.1, 0.1, 1);
    _pr.sprite.position.set(x, 0.16, z);
    return;
  }
}

function updateWaterFX(spd) {
  if (!wfxPool.length) return;
  _wfxRippleTimer--;
  if (_wfxRippleTimer <= 0) {
    _activateWFX('ripple');
    _wfxRippleTimer = 42 + Math.floor(Math.random() * 42);
  }
  _wfxBubbleTimer--;
  if (_wfxBubbleTimer <= 0) {
    _activateWFX('bubble');
    _wfxBubbleTimer = 240 + Math.floor(Math.random() * 240); // 4-8s rare
  }
  _wfxCurrentTimer--;
  if (_wfxCurrentTimer <= 0) {
    _activateWFX('current');
    _wfxCurrentTimer = 90 + Math.floor(Math.random() * 90);
  }
  for (var _ui = 0; _ui < wfxPool.length; _ui++) {
    var _uf = wfxPool[_ui];
    if (!_uf.active) continue;
    _uf.age++;
    var _ut = _uf.age / _uf.life;
    _uf.z += spd + _uf.extraSpd;
    _uf.sprite.position.z = _uf.z;
    if (_uf.type === 'ripple') {
      // Expand from startSc to 1.4wu; fade startOp → 0
      var _usc = _uf.startSc + _ut * (1.4 - _uf.startSc);
      _uf.sprite.scale.set(_usc, _usc, 1);
      _uf.mat.opacity = _uf.startOp * (1 - _ut);
    } else if (_uf.type === 'bubble') {
      var _rf = _uf.riseFrames;
      if (_uf.age <= _rf) {
        // Rise phase: drift upward 0.04→0.16, grow 0.15→0.30wu, fade in then hold
        var _bt = _uf.age / _rf;
        _uf.sprite.position.y = 0.04 + _bt * 0.12;
        var _bsc = 0.15 + _bt * 0.15;
        _uf.sprite.scale.set(_bsc, _bsc, 1);
        _uf.mat.opacity = _bt < 0.25 ? (_bt / 0.25) * 0.45 : 0.45;
        // Trigger pop ripple on the first frame the bubble reaches the surface
        if (_uf.age === _rf) {
          _triggerPopRipple(_uf.sprite.position.x, _uf.z);
        }
      } else {
        // Pop phase: scale-up 0.30→0.39wu, fast fade
        var _pt = (_uf.age - _rf) / (_uf.life - _rf);
        _uf.sprite.position.y = 0.16;
        var _psc = 0.30 + _pt * 0.09;
        _uf.sprite.scale.set(_psc, _psc, 1);
        _uf.mat.opacity = 0.45 * (1 - _pt);
      }
    } else {
      _uf.mat.opacity = _ut < 0.5 ? _ut / 0.5 * 0.3 : (1 - _ut) / 0.5 * 0.3;
    }
    if (_uf.age >= _uf.life || _uf.z > DESPAWN_Z) {
      _uf.active = false; _uf.sprite.visible = false; _uf.mat.opacity = 0;
    }
  }
}

// Stage 5 bank decoration: tree stumps, farm houses, fishing supplies.
// All bottom-anchored (center.y=0), aspect-correct from naturalWidth/naturalHeight,
// scattered on the banks (either side, outside the play channel), scrolling as a pool.
// Pool counts driven by module-level S5_POOL_BASE (tunable via Ctrl+F11/F12).
function initBankDecor5(rw) {
  var stumpCount = Math.max(1, Math.round(S5_FREQ_TREE_STUMP   * S5_POOL_BASE));
  var farmCount  = Math.max(1, Math.round(S5_FREQ_FARMHOUSE    * S5_POOL_BASE));
  var fishCount  = Math.max(1, Math.round(S5_FREQ_FISHING      * S5_POOL_BASE));
  var zSpan = Math.abs(SPAWN_Z) + 12;

  function makeDecorSpr(tex, fallbackCol) {
    var mat = tex
      ? new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
      : new THREE.SpriteMaterial({ color: fallbackCol, transparent: true, opacity: 0.90 });
    var spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0);
    return spr;
  }
  // All stage-5 decor uses the same wide random band: S5_XOFF_MIN..S5_XOFF_MIN+S5_XOFF_RANGE wu
  // past the bank apron, so sprites scatter across the flat ground instead of lining the bank.
  function groundClutterXOff() { return S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE; }
  function groundClutterX(rw5, side5, off) { return side5 * (rw5 / 2 + SHORE_W + off); }
  function setbackXOff() { return S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE; }
  function setbackX(rw5, side5, off) { return side5 * (rw5 / 2 + SHORE_W + off); }

  // Tree stumps (ground clutter, close to bank)
  for (var si = 0; si < stumpCount; si++) {
    var sSide = si % 2 === 0 ? -1 : 1;
    var sTex  = stumpTex5;
    var sAsp  = (sTex && sTex.image && sTex.image.naturalHeight > 0)
      ? sTex.image.naturalWidth / sTex.image.naturalHeight : 1.0;
    var sspr  = makeDecorSpr(sTex, 0x5A4A30);
    sspr.scale.set(S5_STUMP_SCALE * sAsp, S5_STUMP_SCALE, 1);
    var sXOff = groundClutterXOff();
    var sX = groundClutterX(rw, sSide, sXOff);
    var sZ = SPAWN_Z + (si / stumpCount) * zSpan;
    sspr.position.set(sX, DECOR_SEAT_GND, sZ);
    sspr.center.set(0.5, _effectivePadFrac(sTex && sTex._padFrac !== undefined ? sTex._padFrac : 0));
    scene.add(sspr);
    bankStumps5.push({ sprite: sspr, side: sSide, z: sZ, xOff: sXOff });
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
    var fXOff = setbackXOff();
    var fX = setbackX(rw, fSide, fXOff);
    var fZ = SPAWN_Z + (fi / farmCount) * zSpan;
    fspr.position.set(fX, DECOR_SEAT_GND, fZ);
    fspr.center.set(0.5, _effectivePadFrac(fTex && fTex._padFrac !== undefined ? fTex._padFrac : 0));
    scene.add(fspr);
    bankFarms5.push({ sprite: fspr, side: fSide, z: fZ, texIdx: fTexI, xOff: fXOff });
  }

  // Fishing supplies (ground clutter, close to bank)
  for (var fsi = 0; fsi < fishCount; fsi++) {
    var fsSide = fsi % 2 === 0 ? -1 : 1;
    var fsTex  = fishingTex5;
    var fsAsp  = (fsTex && fsTex.image && fsTex.image.naturalHeight > 0)
      ? fsTex.image.naturalWidth / fsTex.image.naturalHeight : 1.0;
    var fsspr  = makeDecorSpr(fsTex, 0x8A7A60);
    fsspr.scale.set(S5_FISHING_SCALE * fsAsp, S5_FISHING_SCALE, 1);
    var fsXOff = groundClutterXOff();
    var fsX = groundClutterX(rw, fsSide, fsXOff);
    var fsZ = SPAWN_Z + (fsi / fishCount) * zSpan;
    fsspr.position.set(fsX, DECOR_SEAT_GND, fsZ);
    fsspr.center.set(0.5, _effectivePadFrac(fsTex && fsTex._padFrac !== undefined ? fsTex._padFrac : 0));
    scene.add(fsspr);
    bankFishing5.push({ sprite: fsspr, side: fsSide, z: fsZ, xOff: fsXOff });
  }

  // Grass tufts (far ground): shared helper handles scatter for both stage 1 and stage 5
  _initFarGroundGrass(rw, grassTuftTex5, bankGrassTufts5, S5_GRASS_POOL);

  // Grass tufts (bank top): shared helper, stage 5 texture
  _initBankTopGrass(rw, grassTuftTex5, bankGrassTufts5Top, S5_GRASS_BANK_POOL);

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
    bankBoulders3.push({ sprite: spr, side: side, z: zInit, spread: isPerim ? 'perimeter' : 'field', xOff: xOff, shoreW: 0 });
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

  // Re-seat the worn hat flower if the player carries a shield into this stage
  if (player3.hasShield) { _ensureHatPoppy3(_poppyPickSide); }
}

// ── CREPUSCULAR RAY SYSTEM ────────────────────────────────────────
// Shadow blobs: large irregular horizontal planes using cloud-shadow-0/1/2.png.
//   Non-uniform scale + random yaw so no two look alike. Slow ambient drift,
//   independent of terrain. Spawned far back (Z~-110) and faded in over
//   CLOUD_FADEIN_MS so they drift into view without popping.
// Crepuscular rays: angled Sprite shaft (sun-ray.png, additive) + horizontal
//   ground pool (sun-pool.png, additive). Tilted via material.rotation to read
//   as light slanting through a cloud gap.

function initCloudPatches() {
  if (_cloudInitDone) return;
  _cloudInitDone = true;

  var xSpan = 45;   // half-width of spawn X zone (wu)
  // Spawn just beyond the backdrop (Z=-88) so shadows drift IN smoothly.
  // vzDir is high (8-16 wu/s) so they cross the terrain in 5-10 s rather than minutes.
  var zFar  = -100;
  var now   = Date.now();

  // -- Shadow blobs --
  for (var si = 0; si < CLOUD_SHADOW_COUNT; si++) {
    var texIdx = si % 3;
    var tex    = _shadowTexArr[texIdx];
    var mat    = new THREE.MeshBasicMaterial({
      map:         tex || null,
      color:       tex ? 0xFFFFFF : 0x101520,
      transparent: true,
      opacity:     0,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
      depthTest:   false
    });
    // Non-uniform scale: X and Z sized independently (0.7-1.6× base)
    var bW = CLOUD_SHADOW_SIZE * (0.7 + Math.random() * 0.9);
    var bH = CLOUD_SHADOW_SIZE * (0.7 + Math.random() * 0.9);
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(bW, bH), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2; // random yaw; rotation.z = world Y after x-rot
    var staggerZ = zFar - si * 8; // tighter stagger so they arrive within seconds of each other
    var spawnX   = (Math.random() - 0.5) * xSpan * 2;
    mesh.position.set(spawnX, 0.08, staggerZ);
    mesh.renderOrder = 2.5;
    scene.add(mesh);
    // vzDir = wu/s (before CLOUD_DRIFT_SPEED multiplier); 8-16 wu/s so terrain coverage in ~5-12 s
    var vzD = 8 + Math.random() * 8;
    _shadowPatches.push({
      mesh:    mesh,
      mat:     mat,
      texIdx:  texIdx,
      bW:      bW, bH: bH,
      vxDir:   (Math.random() - 0.5) * 0.8,  // mild lateral drift
      vzDir:   vzD,
      spawnMs: now  // start fading in from zero
    });
    // NDC frustum check at shadow Y=0.08, spawnZ
    var _sYv = (0.08 - 4.8) * 0.967 + (staggerZ - 8.5) * (-0.252);
    var _sZn = (0.08 - 4.8) * 0.252 + (8.5 - staggerZ) * 0.967;
    var _sYc = _sZn > 0.1 ? (1.3032 * _sYv / _sZn) : 99;
    console.log('[CREP SHADOW ' + si + '] pos=(' + spawnX.toFixed(1) + ',' + staggerZ.toFixed(0) + ')'
      + ' size=' + bW.toFixed(0) + 'x' + bH.toFixed(0)
      + ' vzDir=' + vzD.toFixed(1) + 'wu/s inScene=' + (mesh.parent !== null)
      + ' hasMap=' + (!!tex) + ' NDC_yc=' + _sYc.toFixed(3) + ' (|<1|=in frustum)');
  }

  // -- Crepuscular ray pairs (shaft sprite + ground pool) --
  for (var ri = 0; ri < RAY_COUNT; ri++) {
    var tilt   = RAY_TILT * (Math.random() < 0.5 ? 1 : -1);
    var shaftMat = new THREE.SpriteMaterial({
      map:         _sunRayTex || null,
      color:       _sunRayTex ? 0xFFFFFF : 0xFFEE88,
      transparent: true,
      opacity:     0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      rotation:    tilt
    });
    var shaft = new THREE.Sprite(shaftMat);
    shaft.scale.set(RAY_SHAFT_W, RAY_SHAFT_H, 1);
    shaft.renderOrder = 2.3;

    var poolMat = new THREE.MeshBasicMaterial({
      map:         _sunPoolTex || null,
      color:       _sunPoolTex ? 0xFFFFFF : 0xFFCC44,
      transparent: true,
      opacity:     0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      depthTest:   false
    });
    var poolW = RAY_SHAFT_W * 2.2, poolD = RAY_SHAFT_W * 1.8;
    var pool  = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.renderOrder = 2.3;

    var rx = (Math.random() - 0.5) * xSpan * 2;
    var rz = zFar - ri * 15;
    var shaftY = RAY_SHAFT_H * 0.28;
    shaft.position.set(rx, shaftY, rz);
    pool.position.set(rx + Math.sin(tilt) * RAY_SHAFT_H * 0.35, 0.12, rz + RAY_SHAFT_H * 0.15);
    scene.add(shaft);
    scene.add(pool);

    var rzVz = 8 + Math.random() * 8;
    _rayPairs.push({
      shaft: shaft, shaftMat: shaftMat,
      pool:  pool,  poolMat:  poolMat,
      tilt:  tilt,
      vxDir: (Math.random() - 0.5) * 0.6,
      vzDir: rzVz,
      x: rx, z: rz,
      spawnMs: now
    });
    // NDC frustum check at shaft mid-height
    var _rYv = (shaftY - 4.8) * 0.967 + (rz - 8.5) * (-0.252);
    var _rZn = (shaftY - 4.8) * 0.252 + (8.5 - rz) * 0.967;
    var _rYc = _rZn > 0.1 ? (1.3032 * _rYv / _rZn) : 99;
    console.log('[CREP RAY ' + ri + '] pos=(' + rx.toFixed(1) + ',' + rz.toFixed(0) + ')'
      + ' shaftY=' + shaftY.toFixed(1) + ' tilt=' + tilt.toFixed(2)
      + ' vzDir=' + rzVz.toFixed(1) + 'wu/s inScene=' + (shaft.parent !== null)
      + ' hasRayTex=' + (!!_sunRayTex) + ' hasPoolTex=' + (!!_sunPoolTex)
      + ' NDC_yc=' + _rYc.toFixed(3) + ' (|<1|=in frustum)');
  }

  console.log('[KRR CREP] init done: ' + CLOUD_SHADOW_COUNT + ' shadows + ' + RAY_COUNT + ' rays | zFar=' + zFar);
}

function _updateCloudPatches() {
  if (!_cloudInitDone) return;
  var now = Date.now();
  var dt  = _cloudLastMs > 0 ? (now - _cloudLastMs) / 1000 : 0;
  _cloudLastMs = now;
  if (dt > 0.25) dt = 0.25;

  var xBound = 55;   // half-width; covers full scene width
  var zFar   = -110;
  var zNear  = CLOUD_DESPAWN_Z; // recycle after fully exiting camera view

  // -- Shadow blobs --
  for (var si = 0; si < _shadowPatches.length; si++) {
    var sp = _shadowPatches[si];
    // Drift independently — NO terrain lock, pure ambient wind
    sp.mesh.position.x += sp.vxDir * CLOUD_DRIFT_SPEED * dt;
    sp.mesh.position.z += sp.vzDir * CLOUD_DRIFT_SPEED * dt;

    // X wrap (reappear from other side)
    if (sp.mesh.position.x >  xBound) sp.mesh.position.x = -xBound;
    if (sp.mesh.position.x < -xBound) sp.mesh.position.x =  xBound;

    // Z recycle: reset far back; pick size based on current stage (canyon = stormier)
    if (sp.mesh.position.z > zNear) {
      var _newSz = (stageIdx === 2 || stageIdx === 3) ? CLOUD_SHADOW_SIZE_STORM : CLOUD_SHADOW_SIZE;
      sp.bW = _newSz * (0.7 + Math.random() * 0.9);
      sp.bH = _newSz * (0.7 + Math.random() * 0.9);
      sp.mesh.geometry.dispose();
      sp.mesh.geometry = new THREE.PlaneGeometry(sp.bW, sp.bH);
      sp.mesh.rotation.z = Math.random() * Math.PI * 2;
      sp.mesh.position.z = zFar - Math.random() * 20;
      sp.mesh.position.x = (Math.random() - 0.5) * xBound * 2;
      sp.spawnMs = now;
      sp.mat.opacity = 0;
    }

    // Opacity: fade-in from spawn × fade-out as shadow approaches camera
    var elapsed  = now - sp.spawnMs;
    var fadeIn   = Math.min(1, elapsed / CLOUD_FADEIN_MS);
    var _zPast   = sp.mesh.position.z - CLOUD_FADEOUT_Z; // positive = past fade-out start
    var fadeOut  = _zPast > 0 ? Math.max(0, 1 - _zPast / 8) : 1;
    sp.mat.opacity = CLOUD_SHADOW_OPACITY * fadeIn * fadeOut;

    // Late-patch texture if it loaded after init
    if (_shadowTexArr[sp.texIdx] && !sp.mat.map) {
      sp.mat.map = _shadowTexArr[sp.texIdx];
      sp.mat.color.setHex(0xFFFFFF);
      sp.mat.needsUpdate = true;
    }
    if (_ambientTick % 120 === 0) {
      var _lp = sp.mesh.position;
      console.log('[CREP LIVE] shadow[' + si + '] pos=(' + _lp.x.toFixed(1) + ',' + _lp.z.toFixed(1) + ') op=' + sp.mat.opacity.toFixed(2) + ' hasMap=' + (sp.mat.map !== null));
    }
  }

  // -- Crepuscular rays --
  for (var ri = 0; ri < _rayPairs.length; ri++) {
    var rp = _rayPairs[ri];
    rp.x += rp.vxDir * CLOUD_DRIFT_SPEED * dt;
    rp.z += rp.vzDir * CLOUD_DRIFT_SPEED * dt;

    // Recycle
    if (rp.z > zNear || rp.x > xBound || rp.x < -xBound) {
      rp.x = (Math.random() - 0.5) * xBound * 2;
      rp.z = zFar - Math.random() * 20;
      rp.spawnMs = now;
      rp.shaftMat.opacity = rp.poolMat.opacity = 0;
    }

    // Update positions (shaft center in sky, pool on ground offset by tilt)
    var tiltOffset = Math.sin(rp.tilt) * RAY_SHAFT_H * 0.35;
    rp.shaft.position.set(rp.x, RAY_SHAFT_H * 0.28, rp.z);
    rp.pool.position.set(rp.x + tiltOffset, 0.12, rp.z + RAY_SHAFT_H * 0.15);

    // Fade in from spawn
    var rElapsed = now - rp.spawnMs;
    var fadeT    = Math.min(1, rElapsed / CLOUD_FADEIN_MS);
    rp.shaftMat.opacity = RAY_SHAFT_OPACITY * fadeT;
    rp.poolMat.opacity  = RAY_POOL_OPACITY  * fadeT;

    // Live-tilt update (from tuner)
    rp.shaftMat.rotation = rp.tilt;

    // Late-patch textures
    if (_sunRayTex  && !rp.shaftMat.map) { rp.shaftMat.map = _sunRayTex;  rp.shaftMat.needsUpdate = true; }
    if (_sunPoolTex && !rp.poolMat.map)  { rp.poolMat.map  = _sunPoolTex; rp.poolMat.needsUpdate  = true; }
  }
}

// ── WILDLIFE: FISH + BIRD ────────────────────────────────────────
// Fish: Sprite at Y=-0.25 (below water at Y=0), renderOrder=1.5.
//   Water (renderOrder 2, opacity 0.60 NormalBlend) renders on top,
//   tinting the fish shape as if seen through water.
// Bird: Sprite at Y=18-22, Z=-45 to -65. Crosses screen horizontally.
//   Positioned in front of the backdrop (Z=-88) in 3D space; no special
//   renderOrder needed — perspective depth handles layering.

// Sprite-plane trout: flat PlaneGeometry facing up, textured from trout-0/1/2.png.
// Keeps the full group-rotation motion system (weave, heading, banking) intact.
// rotation.x = PI/2 on the plane maps local +Y → world +Z so nose follows group.rotation.y.
function _buildTroutMesh() {
  var group = new THREE.Group();

  var mat = new THREE.MeshBasicMaterial({
    map:         _fishSpriteTex[0] || null,
    color:       0xFFFFFF,
    transparent: true,
    alphaTest:   0.06,
    side:        THREE.DoubleSide,
    depthWrite:  false
  });
  var plane = new THREE.Mesh(
    new THREE.PlaneGeometry(FISH_SPRITE_W, FISH_SPRITE_L),
    mat
  );
  plane.rotation.x = Math.PI / 2; // lie flat in XZ plane, face up
  plane.renderOrder = 1.5;
  group.add(plane);

  // userData contract expected by the update loop
  group.userData.planeMat  = mat;
  group.userData.planeMesh = plane;
  group.userData.bodyGeo   = null; // signals sprite mode — undulation loop is no-op
  group.userData.origPos   = null;
  group.userData.N         = 0;
  group.userData.S         = 0;

  console.log('[TROUT SPRITE] built — tex0=' + (!!_fishSpriteTex[0]) + ' w=' + FISH_SPRITE_W + ' l=' + FISH_SPRITE_L);
  return group;
}

// Builds a 3-piece procedural bird:
//   body (elongated box along local +Z / flight axis)
//   left & right wing groups (hinge at body edge; rotate.z to flap)
//   tail delta
// All parts MeshBasicMaterial dark silhouette — reads as bird even at altitude.
function _buildBirdMesh() {
  var g   = new THREE.Group();
  var mat = new THREE.MeshBasicMaterial({ color: 0x0D0D1E, side: THREE.DoubleSide });

  // Body: local +Z = forward (heading direction)
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.46), mat);
  body.renderOrder = 10;
  g.add(body);

  // Wing factory: side = -1 (left) or +1 (right)
  function _makeWing(side) {
    var hinge = new THREE.Group();
    hinge.position.set(side * 0.055, 0, 0); // hinge at body edge
    var s = side;
    // Swept-back quad: root near body, tip angled behind
    var wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
       0,       0,  0.13,   // root-front
       0,       0, -0.15,   // root-back
      s * 0.60, 0,  0.04,   // tip-front
      s * 0.54, 0, -0.24,   // tip-back (swept rearward)
    ]), 3));
    // Double-sided winding so the wing reads from above and below
    wGeo.setIndex([0,1,2, 1,3,2, 0,2,1, 1,2,3]);
    wGeo.computeVertexNormals();
    var wm = new THREE.Mesh(wGeo, mat);
    wm.renderOrder = 10;
    hinge.add(wm);
    g.add(hinge);
    return hinge;
  }
  g.userData.leftWing  = _makeWing(-1);
  g.userData.rightWing = _makeWing(1);

  // Tail: small delta behind body
  var tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
     0,    0, -0.23,
    -0.13, 0, -0.41,
     0.13, 0, -0.41,
  ]), 3));
  tGeo.setIndex([0,1,2, 0,2,1]);
  tGeo.computeVertexNormals();
  var tail = new THREE.Mesh(tGeo, mat);
  tail.renderOrder = 10;
  g.add(tail);

  return g;
}

function _initWildlife() {
  // Build fish school (FISH_SCHOOL_SIZE separate 3D trout meshes)
  _school = [];
  for (var fsi = 0; fsi < FISH_SCHOOL_SIZE; fsi++) {
    var fg = _buildTroutMesh();
    fg.renderOrder = 1.5;
    fg.visible = false;
    fg.scale.setScalar(FISH_SCALE);
    scene.add(fg);
    _school.push({ group: fg, phaseOff: fsi * 0.80, dX: 0, dZ: 0 });
  }
  // Backward-compat handles pointing to lead fish
  _troutGroup   = _school[0].group;
  _troutBodyGeo = _troutGroup.userData.bodyGeo;
  _troutOrigPos = _troutGroup.userData.origPos;
  console.log('[TROUT] school=' + FISH_SCHOOL_SIZE + ' fish, lead rings=' + _troutGroup.userData.N);

  // Birds: pair of 3D procedural groups (body + flapping wings + tail)
  _birdGroup1 = _buildBirdMesh();
  _birdGroup1.scale.setScalar(BIRD_SCALE);
  _birdGroup1.visible = false;
  _birdGroup1.renderOrder = 10;
  scene.add(_birdGroup1);

  _birdGroup2 = _buildBirdMesh();
  _birdGroup2.scale.setScalar(BIRD_SCALE * 0.85);
  _birdGroup2.visible = false;
  _birdGroup2.renderOrder = 10;
  scene.add(_birdGroup2);

  _birdFlapOff2 = Math.PI * (0.4 + Math.random() * 0.6);

  console.log('[BIRD INIT] 3D group1 inScene=' + (_birdGroup1.parent !== null)
    + ' group2 inScene=' + (_birdGroup2.parent !== null) + ' scale=' + BIRD_SCALE);

  var now = Date.now();
  _fishNextMs = now + (FISH_FREQ_MIN + Math.random() * (FISH_FREQ_MAX - FISH_FREQ_MIN)) * 1000;
  _birdNextMs = now + BIRD_FREQ_MIN * 1000;
  console.log('[KRR WILDLIFE] school=' + FISH_SCHOOL_SIZE + ' fish + bird pair ready');
}

var _wildlifeLastMs = 0;

function _updateWildlife() {
  if (!_troutGroup) return;
  var now = Date.now();
  var dt  = _wildlifeLastMs > 0 ? (now - _wildlifeLastMs) / 1000 : 0;
  _wildlifeLastMs = now;
  if (dt > 0.25) dt = 0.25;

  // ── 3D RAINBOW TROUT SCHOOL ──────────────────────────────────────
  if (_fishState === 'idle') {
    if (now >= _fishNextMs) {
      _fishState    = 'hold';
      _fishStartMs  = now;
      _fishHoldMs   = FISH_HOLD_MS;
      _fishBaseX    = (Math.random() - 0.5) * 1.6;
      _fishBaseZ    = -10;
      _fishDriftZ   = (Math.random() < 0.5 ? 1 : -1) * FISH_SWIM_SPEED;
      _troutPhase   = 0;
      _troutWeavePh = 0;
      // Set per-fish offsets and scales; lead fish (index 0) stays at center
      for (var _sfi = 0; _sfi < _school.length; _sfi++) {
        var _sf = _school[_sfi];
        _sf.dX = (_sfi === 0) ? 0 : (Math.random() - 0.5) * 2.0;
        _sf.dZ = (_sfi === 0) ? 0 : (Math.random() - 0.5) * 3.0;
        _sf.group.scale.setScalar(FISH_SCALE * (0.85 + Math.random() * 0.25));
        _sf.group.position.set(_fishBaseX + _sf.dX, -0.18, _fishBaseZ + _sf.dZ);
        _sf.group.visible = true;
      }
      console.log('[AMBIENT TROUT] school spawn x=' + _fishBaseX.toFixed(2) + ' y=-0.18 z=' + _fishBaseZ
        + ' vz=' + _fishDriftZ.toFixed(2) + ' count=' + _school.length
        + ' inScene=' + (_troutGroup.parent !== null));
    }
  } else if (_fishState === 'hold') {
    _troutPhase   += dt * FISH_SWIM_SPEED * 2.5;
    _troutWeavePh += dt * 0.70;

    var _wAmp = 1.2 * FISH_WEAVE_AMT;
    var _wX   = _fishBaseX + Math.sin(_troutWeavePh) * _wAmp;
    var _wDX  = Math.cos(_troutWeavePh) * _wAmp * 0.70;
    var _tEl  = (now - _fishStartMs) / 1000;
    var _tZ   = _fishBaseZ + _fishDriftZ * _tEl;

    // Animate each school member
    for (var _sfi = 0; _sfi < _school.length; _sfi++) {
      var _sf  = _school[_sfi];
      var _sfg = _sf.group;
      _sfg.position.set(_wX + _sf.dX, -0.18, _tZ + _sf.dZ);
      _sfg.rotation.y = Math.atan2(_wDX, _fishDriftZ);
      _sfg.rotation.z = -Math.atan2(_wDX, Math.abs(_fishDriftZ) + 0.5) * 0.55;

      var _sfPhase = _troutPhase + _sf.phaseOff;
      var _sfPg    = _sfg.userData;

      // Sprite mode: cycle swim frames; skip mesh undulation (bodyGeo is null)
      if (_sfPg.planeMat) {
        var _frame = Math.floor(Math.abs(_sfPhase) * FISH_ANIM_FPS) % 3;
        var _ftex  = _fishSpriteTex[_frame];
        if (_ftex && _sfPg.planeMat.map !== _ftex) {
          _sfPg.planeMat.map = _ftex;
          _sfPg.planeMat.needsUpdate = true;
        }
      }

      // 3D mesh mode (bodyGeo present): apply vertex undulation
      if (_sfPg.bodyGeo && _sfPg.bodyGeo.attributes && _sfPg.bodyGeo.attributes.position) {
        var _sfArr = _sfPg.bodyGeo.attributes.position.array;
        var _sfOri = _sfPg.origPos;
        var _sfN   = _sfPg.N, _sfS = _sfPg.S;
        for (var _pi = 0; _pi < _sfN; _pi++) {
          var _pt  = _pi / (_sfN - 1);
          var _pa  = Math.pow(_pt, 1.8) * 0.18 * FISH_UNDULATION_AMP;
          var _pxO = Math.sin(_pt * 3.0 * Math.PI - _sfPhase) * _pa;
          for (var _pj = 0; _pj < _sfS; _pj++) {
            var _pvi = (_pi * _sfS + _pj) * 3;
            _sfArr[_pvi]     = _sfOri[_pvi]     + _pxO;
            _sfArr[_pvi + 1] = _sfOri[_pvi + 1];
            _sfArr[_pvi + 2] = _sfOri[_pvi + 2];
          }
        }
        _sfPg.bodyGeo.attributes.position.needsUpdate = true;
      }
    }

    var _tExit = (_fishDriftZ > 0 && _tZ > DESPAWN_Z - 2)
              || (_fishDriftZ < 0 && _tZ < SPAWN_Z + 10)
              || ((now - _fishStartMs) >= _fishHoldMs);
    if (_tExit) { _fishState = 'out'; }
  } else if (_fishState === 'out') {
    _fishState = 'idle';
    for (var _sfi = 0; _sfi < _school.length; _sfi++) { _school[_sfi].group.visible = false; }
    _fishNextMs = now + FISH_FREQ_MIN * 1000;
  }

  // ── BIRDS (pair crossing) — 3D flapping geometry ──────────────────
  // Frustum: camera (0,4.8,8.5), Y=8-13, Z=-40 to -55 → NDC yc ≈ 0.35-0.60 ✓
  if (_birdState === 'idle') {
    if (now >= _birdNextMs && _birdGroup1) {
      _birdVx    = (Math.random() < 0.5 ? 1 : -1) * (BIRD_SPEED + Math.random() * 1.5);
      _birdX     = _birdVx > 0 ? -28 : 28;
      _birdExitX = _birdVx > 0 ?  28 : -28;
      _birdY     = 8 + Math.random() * 5;
      _birdZ     = -40 - Math.random() * 15;
      _birdX2    = _birdX + (Math.random() - 0.5) * 4;
      _birdY2    = _birdY + (Math.random() - 0.5) * 2.0;
      _birdFlapOff2 = Math.PI * (0.4 + Math.random() * 0.6); // unsynchronised wings

      _birdGroup1.position.set(_birdX, _birdY, _birdZ);
      _birdGroup2.position.set(_birdX2, _birdY2, _birdZ + (Math.random() - 0.5) * 6);
      _birdGroup1.visible = _birdGroup2.visible = true;
      _birdState = 'crossing';

      // Frustum diagnostic
      var _bYv = (_birdY - 4.8) * 0.967 + (_birdZ - 8.5) * (-0.252);
      var _bZn = (_birdY - 4.8) * 0.252 + (8.5 - _birdZ) * 0.967;
      var _bYc = _bZn > 0.1 ? (1.3032 * _bYv / _bZn) : 99;
      console.log('[BIRD SPAWN 3D] x=' + _birdX.toFixed(1) + ' y=' + _birdY.toFixed(1) + ' z=' + _birdZ.toFixed(1)
        + ' vx=' + _birdVx.toFixed(1)
        + ' | g1 inScene=' + (_birdGroup1.parent !== null) + ' visible=' + _birdGroup1.visible
        + ' | NDC yc=' + _bYc.toFixed(3) + ' (|yc|<1=in frustum)');
    }
  } else if (_birdState === 'crossing') {
    if (!_birdGroup1) { _birdState = 'idle'; return; }
    _birdX  += _birdVx * dt;
    _birdX2 += _birdVx * dt;

    // Curved path: gentle Z arc on a slow sine so they don't fly in a ruler-straight line
    var _bCurveZ = Math.sin(now * 0.001 * BIRD_CURVE_RATE * Math.PI * 2) * BIRD_CURVE_AMP;
    var _bCurveDZ = Math.cos(now * 0.001 * BIRD_CURVE_RATE * Math.PI * 2) * BIRD_CURVE_AMP
                    * (BIRD_CURVE_RATE * Math.PI * 2);  // dZ/dt for banking

    _birdGroup1.position.set(_birdX,  _birdY,  _birdZ  + _bCurveZ);
    _birdGroup2.position.set(_birdX2, _birdY2, _birdZ  + _bCurveZ + (_birdX2 - _birdX) * 0.08);

    // Wing flap: rotate.z in local hinge space → tips go up/down
    var _flapT = now * 0.001 * BIRD_FLAP_FREQ * Math.PI * 2;
    var _flap1 = Math.sin(_flapT) * BIRD_FLAP_AMP;
    var _flap2 = Math.sin(_flapT + _birdFlapOff2) * BIRD_FLAP_AMP;

    [[_birdGroup1, _flap1], [_birdGroup2, _flap2]].forEach(function(pair) {
      var bg = pair[0], fv = pair[1];
      if (!bg || !bg.userData) return;
      // Left wing up, right wing mirrors — classic flap
      if (bg.userData.leftWing)  bg.userData.leftWing.rotation.z  =  fv;
      if (bg.userData.rightWing) bg.userData.rightWing.rotation.z = -fv;
      // Face heading direction: local +Z = forward → yaw so local Z aligns with velocity
      bg.rotation.y = _birdVx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      // Bank into the Z-curve: roll toward inside of arc
      bg.rotation.z = (_birdVx > 0 ? 1 : -1) * _bCurveDZ * 0.04;
    });

    var pastExit = _birdVx > 0 ? (_birdX >= _birdExitX) : (_birdX <= _birdExitX);
    if (pastExit) {
      _birdGroup1.visible = _birdGroup2.visible = false;
      _birdState = 'idle';
      _birdNextMs = now + (BIRD_FREQ_MIN + Math.random() * (BIRD_FREQ_MAX - BIRD_FREQ_MIN)) * 1000;
    }
  }
}

// ── KAYAK HULL GEOMETRY (custom hex-prism with pointed bow/stern) ─
// ================================================================
// ROWBOAT + RURAL GUIDE  --  all materials MeshBasicMaterial
// so colors render true under bright scene lighting.
// Tune by changing the grouped constants below.
// ================================================================

// helper: one-call MeshBasicMaterial shorthand
function bm(c) { return new THREE.MeshBasicMaterial({ color: c }); }

// -- BOAT DIMENSIONS -------------------------------------
var BOAT_WIDTH    = 0.85;   // outer beam (X)
var BOAT_LENGTH   = 2.50;   // bow-to-stern (Z)
var BOAT_WALL_H   = 0.26;   // side wall height (Y)
var BOAT_FLOOR_Y  = 0.04;   // interior floor Y
var GUNWALE_H     = 0.04;   // raised rim height above wall top
var BOAT_SHOULDER = 0.76;   // z offset of widest beam point

// -- BOAT COLORS -----------------------------------------
var BOAT_WOOD      = 0x6B4A2E;   // hull planks (Basic: renders exact RGB)
var BOAT_WOOD_DARK = 0x4E3620;   // gunwale rim
var BOAT_FLOOR_COL = 0x5A3D24;   // interior floor

// -- ROWER BASE Y (bottom of torso, sits at gunwale level) ---
var ROWER_Y = 0.30;

// -- TORSO -----------------------------------------------
var TORSO_W = 0.34;   // width (X)
var TORSO_H = 0.36;   // height (Y)
var TORSO_D = 0.26;   // depth (Z)
var TORSO_Y = ROWER_Y + TORSO_H / 2;   // torso center Y = 0.48

// -- HEAD ------------------------------------------------
var HEAD_S = 0.22;   // head cube side length
var HEAD_Y = ROWER_Y + TORSO_H + HEAD_S / 2;   // head center Y = 0.77

// -- HAT -------------------------------------------------
var HAT_BRIM_W  = 0.84;   // brim box width and depth
var HAT_BRIM_H  = 0.04;   // brim thickness (Y)
var HAT_BAND_H  = 0.03;   // band strip height
var HAT_CROWN_W = 0.24;   // crown width and depth
var HAT_CROWN_H = 0.14;   // crown height
var HAT_Y = ROWER_Y + TORSO_H + HEAD_S + HAT_BRIM_H / 2;   // brim center Y = 0.90

// -- BEARD -----------------------------------------------
var BEARD_W = 0.18;   // width (X)
var BEARD_H = 0.14;   // height (Y)
var BEARD_D = 0.06;   // depth proud of face (-Z face)

// -- OVERALL STRAPS (camera-visible back face of torso) --
var STRAP_W = 0.05;   // strap box width (X)
var STRAP_H = 0.22;   // strap box height (Y)
var STRAP_X = 0.07;   // strap X offset from center

// -- PADDLE ----------------------------------------------
var PADDLE_Y       = 0.50;   // paddleGroup world Y
var PADDLE_SHAFT_L = 1.90;   // shaft length (X)
var PADDLE_BLADE_W = 0.13;   // blade width (X)
var PADDLE_BLADE_D = 0.38;   // blade face length (Z)
var PADDLE_BLADE_H = 0.05;   // blade thickness (Y)
var PADDLE_BLADE_X = 0.97;   // blade center X offset

// -- ARMS ------------------------------------------------
var ARM_REACH_X = 0.60;   // forearm box half-span along X
var ARM_Y       = 0.52;   // forearm center Y

// ================================================================

// open-top rowboat hull: 12-vertex hex prism, top face omitted
// so the interior floor is visible through the open deck
function buildOpenHullGeo() {
  var bw = BOAT_WIDTH / 2;
  var bh = BOAT_WALL_H;
  var ms = BOAT_SHOULDER;
  var bl = BOAT_LENGTH / 2;
  // vertices 0-5 = top ring, 6-11 = bottom ring; bow = 0/6 (-Z), stern = 3/9 (+Z)
  var v = new Float32Array([
     0, bh, -bl,   bw, bh, -ms,   bw, bh,  ms,   0, bh,  bl,  -bw, bh,  ms,  -bw, bh, -ms,
     0,  0, -bl,   bw,  0, -ms,   bw,  0,  ms,   0,  0,  bl,  -bw,  0,  ms,  -bw,  0, -ms
  ]);
  var idx = [
    // bottom (keel)
    6, 7, 8,  6, 8, 9,  6, 9, 10, 6, 10, 11,
    // six side panels - no top face, deck stays open
    0, 1, 7,  0, 7, 6,   1, 2, 8,  1, 8, 7,   2, 3, 9,  2, 9, 8,
    3, 4, 10, 3, 10, 9,  4, 5, 11, 4, 11, 10,  5, 0, 6,  5, 6, 11
  ];
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// -- PLAYER MODEL ----------------------------------------------------
const playerGroup = new THREE.Group();
scene.add(playerGroup);

// Legacy Standard materials kept as declarations (no longer drive the player model).
const kNavy  = new THREE.MeshStandardMaterial({ color: 0x0B1F3A, roughness: 0.65, metalness: 0.15 });
const kGold  = new THREE.MeshStandardMaterial({ color: 0xC9883A, roughness: 0.30, metalness: 0.60 });
const kGreen = new THREE.MeshStandardMaterial({ color: 0x2D6A4F, roughness: 0.80, metalness: 0.05 });
const kMid   = new THREE.MeshStandardMaterial({ color: 0x1E3A5F, roughness: 0.70, metalness: 0.10 });
const kWood  = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.90, metalness: 0.00 });
const kDark  = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.90, metalness: 0.00 });

// ---- BOAT -----------------------------------------------

// Open-top hull shell (deck face removed; floor visible from camera above)
const hullMesh = new THREE.Mesh(buildOpenHullGeo(), bm(BOAT_WOOD));
playerGroup.add(hullMesh);

// Interior floor (visible through open deck from chase camera angle)
const boatFloor = new THREE.Mesh(
  new THREE.BoxGeometry(BOAT_WIDTH * 0.70, 0.03, BOAT_LENGTH * 0.66),
  bm(BOAT_FLOOR_COL)
);
boatFloor.position.set(0, BOAT_FLOOR_Y, 0);
playerGroup.add(boatFloor);

// Port and starboard gunwale strips
var gwThick = 0.065;
var gwY     = BOAT_WALL_H + GUNWALE_H * 0.5;
for (var gsi = -1; gsi <= 1; gsi += 2) {
  var gwMesh = new THREE.Mesh(
    new THREE.BoxGeometry(gwThick, GUNWALE_H, BOAT_LENGTH * 0.80),
    bm(BOAT_WOOD_DARK)
  );
  gwMesh.position.set(gsi * (BOAT_WIDTH / 2 - gwThick * 0.5), gwY, 0);
  playerGroup.add(gwMesh);
}

// Stern (aft) gunwale cap - camera-facing rim across back of boat
var sternCap = new THREE.Mesh(
  new THREE.BoxGeometry(BOAT_WIDTH * 0.60, GUNWALE_H, gwThick),
  bm(BOAT_WOOD_DARK)
);
sternCap.position.set(0, gwY, BOAT_LENGTH / 2 - gwThick * 0.5);
playerGroup.add(sternCap);

// Rowing thwart / seat board (deckStripe name kept for compatibility)
const deckStripe = new THREE.Mesh(
  new THREE.BoxGeometry(BOAT_WIDTH * 0.72, 0.03, 0.12),
  bm(BOAT_WOOD)
);
deckStripe.position.set(0, ROWER_Y - 0.01, 0.10);
playerGroup.add(deckStripe);

// Invisible cockpit stub kept so no downstream reference breaks
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), bm(0x000000));
cockpit.visible = false;
playerGroup.add(cockpit);

// ---- ROWER BODY -----------------------------------------

// Denim legs/lap inside hull (overalls color below gunwale)
var legsBlock = new THREE.Mesh(
  new THREE.BoxGeometry(0.30, 0.20, 0.22),
  bm(0x35506B)
);
legsBlock.position.set(0, ROWER_Y - 0.10, 0);
playerGroup.add(legsBlock);

// Torso - red buffalo-plaid flannel shirt
const torso = new THREE.Mesh(
  new THREE.BoxGeometry(TORSO_W, TORSO_H, TORSO_D),
  bm(0xB0322A)
);
torso.position.set(0, TORSO_Y, 0);
playerGroup.add(torso);

// Plaid accent - horizontal stripe on back face (+Z, camera side)
var plaidH = new THREE.Mesh(
  new THREE.BoxGeometry(TORSO_W, 0.04, 0.03),
  bm(0x7A1F1A)
);
plaidH.position.set(0, TORSO_Y + 0.04, TORSO_D / 2 + 0.01);
playerGroup.add(plaidH);

// Plaid accent - vertical stripe on back face
var plaidV = new THREE.Mesh(
  new THREE.BoxGeometry(0.04, TORSO_H - 0.04, 0.03),
  bm(0x7A1F1A)
);
plaidV.position.set(0, TORSO_Y, TORSO_D / 2 + 0.01);
playerGroup.add(plaidV);

// Overalls bib (front chest, -Z face, visible at yaw turns)
var bib = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.20, 0.03),
  bm(0x35506B)
);
bib.position.set(0, TORSO_Y + 0.06, -(TORSO_D / 2 + 0.01));
playerGroup.add(bib);

// Overall straps on back (+Z, camera side) and brass clips at top
for (var osi = -1; osi <= 1; osi += 2) {
  var strap = new THREE.Mesh(
    new THREE.BoxGeometry(STRAP_W, STRAP_H, 0.03),
    bm(0x274058)
  );
  strap.position.set(osi * STRAP_X, TORSO_Y + TORSO_H / 2 - STRAP_H / 2 + 0.02, TORSO_D / 2 + 0.01);
  playerGroup.add(strap);
  var clip = new THREE.Mesh(
    new THREE.BoxGeometry(STRAP_W + 0.01, 0.04, 0.03),
    bm(0xC9A24B)
  );
  clip.position.set(osi * STRAP_X, TORSO_Y + TORSO_H / 2 + 0.01, TORSO_D / 2 + 0.01);
  playerGroup.add(clip);
}

// Shoulder blocks (flannel red, at top corners of torso)
for (var shi = -1; shi <= 1; shi += 2) {
  var shldr = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, TORSO_D + 0.02),
    bm(0xB0322A)
  );
  shldr.position.set(shi * (TORSO_W / 2 + 0.04), TORSO_Y + TORSO_H / 2 - 0.04, 0);
  playerGroup.add(shldr);
}

// Forearms (flannel red) reaching out along X to paddle grips + skin hands
for (var fai = -1; fai <= 1; fai += 2) {
  var forearm = new THREE.Mesh(
    new THREE.BoxGeometry(ARM_REACH_X, 0.07, 0.08),
    bm(0xB0322A)
  );
  forearm.position.set(fai * (TORSO_W / 2 + ARM_REACH_X / 2 + 0.04), ARM_Y, 0);
  playerGroup.add(forearm);
  var hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.07, 0.09),
    bm(0xE8B98A)
  );
  hand.position.set(fai * PADDLE_BLADE_X, ARM_Y, 0);
  playerGroup.add(hand);
}

// ---- HEAD + HAIR + BEARD + HAT --------------------------

// Head (skin)
const head = new THREE.Mesh(
  new THREE.BoxGeometry(HEAD_S, HEAD_S, HEAD_S),
  bm(0xE8B98A)
);
head.position.set(0, HEAD_Y, 0);
playerGroup.add(head);

// Gray hair on back of head (+Z face, camera side)
var hairBack = new THREE.Mesh(
  new THREE.BoxGeometry(HEAD_S, 0.10, 0.04),
  bm(0xC8C4BC)
);
hairBack.position.set(0, HEAD_Y + 0.02, HEAD_S / 2 + 0.01);
playerGroup.add(hairBack);

// Gray temples and sideburns (left and right)
for (var hsi = -1; hsi <= 1; hsi += 2) {
  var hairSide = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.10, HEAD_S - 0.02),
    bm(0xC8C4BC)
  );
  hairSide.position.set(hsi * (HEAD_S / 2 + 0.01), HEAD_Y + 0.01, 0);
  playerGroup.add(hairSide);
}

// Beard (bushy block on -Z face = upriver / forward direction)
var beard = new THREE.Mesh(
  new THREE.BoxGeometry(BEARD_W, BEARD_H, BEARD_D),
  bm(0xC8C4BC)
);
beard.position.set(0, HEAD_Y - HEAD_S * 0.20, -(HEAD_S / 2 + BEARD_D / 2 - 0.01));
playerGroup.add(beard);

// Beard shadow - darker underside gives chin depth
var beardShadow = new THREE.Mesh(
  new THREE.BoxGeometry(BEARD_W - 0.02, 0.05, BEARD_D - 0.01),
  bm(0x9A968E)
);
beardShadow.position.set(0, HEAD_Y - HEAD_S * 0.20 - BEARD_H / 2 + 0.02, -(HEAD_S / 2 + BEARD_D / 2));
playerGroup.add(beardShadow);

// Straw hat brim (wide flat box sitting over the head)
var hatBrim = new THREE.Mesh(
  new THREE.BoxGeometry(HAT_BRIM_W, HAT_BRIM_H, HAT_BRIM_W),
  bm(0xC9A24B)
);
hatBrim.position.set(0, HAT_Y, 0);
playerGroup.add(hatBrim);

// Hat band (dark strip at base of crown)
var hatBand = new THREE.Mesh(
  new THREE.BoxGeometry(HAT_CROWN_W + 0.02, HAT_BAND_H, HAT_CROWN_W + 0.02),
  bm(0x8B6B2E)
);
hatBand.position.set(0, HAT_Y + HAT_BRIM_H / 2 + HAT_BAND_H / 2, 0);
playerGroup.add(hatBand);

// Hat crown (tall center block above band)
var hatCrown = new THREE.Mesh(
  new THREE.BoxGeometry(HAT_CROWN_W, HAT_CROWN_H, HAT_CROWN_W),
  bm(0xC9A24B)
);
hatCrown.position.set(0, HAT_Y + HAT_BRIM_H / 2 + HAT_BAND_H + HAT_CROWN_H / 2, 0);
playerGroup.add(hatCrown);

// ---- PADDLE GROUP (name must stay 'paddleGroup' - rotation animated in updateVisuals3) ----
const paddleGroup = new THREE.Group();
paddleGroup.position.set(0, PADDLE_Y, 0);

// Shaft (wooden dowel across X axis)
var shaft = new THREE.Mesh(
  new THREE.BoxGeometry(PADDLE_SHAFT_L, 0.04, 0.04),
  bm(0x8B5E34)
);
paddleGroup.add(shaft);

// Blades at each end of shaft
for (var pbi = -1; pbi <= 1; pbi += 2) {
  var blade = new THREE.Mesh(
    new THREE.BoxGeometry(PADDLE_BLADE_W, PADDLE_BLADE_H, PADDLE_BLADE_D),
    bm(0x6B4A2E)
  );
  blade.position.x = pbi * PADDLE_BLADE_X;
  paddleGroup.add(blade);
}

playerGroup.add(paddleGroup);

// Blob shadow on water surface
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), shadowMat);
playerShadow.rotation.x = -Math.PI / 2;
playerShadow.position.set(0, 0.02, 0);
scene.add(playerShadow);

// ================================================================
// KAYAKER GLB MODEL LOADER
// Loads kayaker.glb (Rodin shaded export, baked emissive texture).
// While loading, the hand-built box model above remains visible as
// the fallback. On success, playerGroup.clear() removes all
// hand-built children and the GLB scene is swapped in.
// On error, the fallback stays rendered - player is never invisible.
// ================================================================

var KAYAKER_SCALE  = 1.31;    // was 1.14 (~1.53 wide); 1.34 * 1.31 = ~1.76 world units
var KAYAKER_ROT_Y  = Math.PI; // 180 deg: bow points -Z (away from camera), we see rower's back
var KAYAKER_Y      = 0;       // Y nudge from waterline; 0 = hull bottom sits on Y=0
var KAYAKER_BRIGHT = 1.0;     // true baked colors; multiply above 1.0 if too dark in game

// Paddle stroke animation constants (tunable)
var STROKE_RATE = 0.8;    // phase radians added per unit of curSpd3 (scales with boat speed)
var STROKE_DIP  = 0.35;   // radians - alternating blade dip amplitude (main L/R motion)
var STROKE_PULL = 0.12;   // radians - fore/aft rock amplitude (secondary)
var TORSO_ROCK  = 0.08;   // radians - counter-phase torso lean amplitude

// Arm shoulder-pivot constants (GLB-native space, same frame as TORSO_HINGE_*)
// Shoulder pivot at top of arm bbox; converted to world via * KAYAKER_SCALE / rotY=PI
var ARM_HINGE_Y   = 0.55;   // shoulder height in GLB-native Y; tuner: Ctrl+Shift+Q/W
var ARM_HINGE_Z   = 0.22;   // shoulder depth in GLB-native Z; tuner: Ctrl+Shift+E/R
var ARM_R_HINGE_X = 0.15;   // right arm GLB-native X (ARM L mirrors to -X)
var ARM_REACH_ANG = 0.55;   // radians; outward+down reach angle; tuner: Ctrl+Shift+A/Z

// GLB paddle animation state -- null until GLB loads (null = fallback box model is active)
var _glbModel            = null;  // top-level GLB scene node (child of playerGroup); set on load
var glbPaddleGroup       = null;
var glbTorsoNode         = null; // the actual torso Mesh from the GLB
var glbTorsoGroup        = null; // empty Group at waist pivot; child of torsoNode.parent
var glbArmRNode          = null; // GLB-native +X arm mesh
var glbArmRGroup         = null; // shoulder hinge Group for right arm (child of waist group)
var glbArmLNode          = null; // GLB-native -X arm mesh
var glbArmLGroup         = null; // shoulder hinge Group for left arm (child of waist group)
var _ubNodes             = [];   // direct mesh children of waist group; repositioned on hinge tuner change
var _paddlePivot         = new THREE.Vector3(); // shaft bbox center in model space; saved for re-hinging
var strokePhase          = 0;
var glbTorsoSquashFrames = 0;  // counts down from 8 on landing; drives JUMP_LAND_SQUASH decay
var _strokeDbgTick = 0;  // throttle for per-frame stroke log
// ===== TEMP DIAG: black-patch isolation =====
var _kayakerMeshes  = [];   // all mesh nodes from GLB; populated on load
var _kayakerHideIdx = -1;   // index of currently hidden mesh (-1 = all visible); Ctrl+Shift+H steps
var _breathFrozen   = false; // Ctrl+Shift+B: hold torso at max-forward rotation to freeze the artifact
// ===== END TEMP DIAG =====

if (typeof THREE.GLTFLoader === 'undefined') {
  console.warn('[kayaker] THREE.GLTFLoader not found - keeping hand-built fallback.');
} else {
  var _kLoader = new THREE.GLTFLoader();
  _kLoader.load(
    'kayaker-bright.glb',
    function(gltf) {
      playerGroup.clear();
      var model = gltf.scene;

      // A1: Log ALL scene nodes so real importer names are visible in console.
      model.traverse(function(n) {
        console.log('[KRR GLB NODE]', n.name, n.type, n.isMesh ? 'MESH' : '');
      });

      // Convert all mesh materials to MeshBasicMaterial and collect meshes.
      // GLB baked shading lives in emissiveMap (baseColor black, emissiveFactor white).
      // Transferring emissiveMap -> map renders baked colors with no scene-light contribution.
      var _allMeshes = [];
      model.traverse(function(node) {
        if (!node.isMesh) return;
        _allMeshes.push(node);
        var m = node.material;
        // Capture source-material facts BEFORE overwriting
        var _srcMapType = m.emissiveMap ? 'emissiveMap' : (m.map ? 'map' : 'null');
        var _srcTransp  = m.transparent || false;
        var _srcAlpha   = m.alphaTest   || 0;
        node.material = new THREE.MeshBasicMaterial({
          map:         m.emissiveMap || m.map || null,
          transparent: m.transparent || false,
          alphaTest:   m.alphaTest   || 0,
          side:        THREE.DoubleSide  // always DoubleSide; FrontSide (=0) is not undefined so the old guard always chose FrontSide, causing back-face culling when the torso rocked
        });
        node.material.color.setScalar(KAYAKER_BRIGHT);
        // ===== TEMP DIAG: full mesh report for black-patch diagnosis =====
        var _vtx  = (node.geometry && node.geometry.attributes.position) ? node.geometry.attributes.position.count : -1;
        var _dbb  = new THREE.Box3().setFromObject(node);
        var _dmn  = _dbb.min, _dmx = _dbb.max;
        var _dnm  = node.material;
        console.log('[KRR MESH DIAG]' +
          ' name="' + node.name + '"' +
          ' verts=' + _vtx +
          ' mat=' + _dnm.constructor.name +
          ' srcMap=' + _srcMapType +
          ' map=' + (_dnm.map ? 'SET' : 'null') +
          ' color=#' + _dnm.color.getHexString() +
          ' side=' + _dnm.side +        // 0=Front 1=Back 2=Double
          ' depthWrite=' + _dnm.depthWrite +
          ' transparent=' + _dnm.transparent +
          ' alphaTest=' + _srcAlpha +
          ' renderOrder=' + node.renderOrder +
          ' bbox=[' + _dmn.x.toFixed(3) + ',' + _dmn.y.toFixed(3) + ',' + _dmn.z.toFixed(3) +
          ']→[' + _dmx.x.toFixed(3) + ',' + _dmx.y.toFixed(3) + ',' + _dmx.z.toFixed(3) + ']');
        // ===== END TEMP DIAG =====
      });
      // Store for Ctrl+Shift+H mesh-isolation key
      _kayakerMeshes = _allMeshes.slice();

      // A3: Robust mesh identification by geometry (names are unreliable after import).
      // Shaft: largest X span where Y and Z are both < 15% of X (very thin rod).
      // Blades: of non-shaft nodes, the two with most extreme bbox center-X.
      // Hull: of remaining body nodes, the one with lowest min-Y (sits on water, must not lean).
      // Upper body: everything except hull; all go into the waist hinge group.
      // Arms: upper-body nodes whose bbox center-X is > 0.08 (right) or < -0.08 (left).
      var _bbCache = _allMeshes.map(function(n) {
        var bb = new THREE.Box3().setFromObject(n);
        var sz = new THREE.Vector3(); bb.getSize(sz);
        var ct = new THREE.Vector3(); bb.getCenter(ct);
        return { mesh: n, sz: sz, cx: ct.x, miny: bb.min.y };
      });

      var _shaftE = null;
      _bbCache.forEach(function(e) {
        if (e.sz.x > 0 && e.sz.y / e.sz.x < 0.15 && e.sz.z / e.sz.x < 0.15) {
          if (!_shaftE || e.sz.x > _shaftE.sz.x) _shaftE = e;
        }
      });

      var _noShaft = _bbCache.filter(function(e) { return e !== _shaftE; });
      _noShaft.sort(function(a, b) { return a.cx - b.cx; });
      var _bladeLe = _noShaft.length > 0 ? _noShaft[0] : null;
      var _bladeRe = _noShaft.length > 1 ? _noShaft[_noShaft.length - 1] : null;

      // Non-paddle body nodes sorted by Y-span descending
      var _rest = _noShaft.filter(function(e) { return e !== _bladeLe && e !== _bladeRe; });
      _rest.sort(function(a, b) { return b.sz.y - a.sz.y; });

      // Hull = lowest min-Y (the only node that starts near y=0; must not rotate)
      var _hullE = _rest.reduce(function(best, e) {
        return (!best || e.miny < best.miny) ? e : best;
      }, null);

      // Upper body = all body nodes except hull
      var _upperBodyEntries = _rest.filter(function(e) { return e !== _hullE; });

      // Torso sentinel: kept as non-null indicator that GLB loaded (animation code checks it)
      glbTorsoNode = _upperBodyEntries.length > 0 ? _upperBodyEntries[0].mesh : null;

      // Arms identified by bbox center-X; only arms have |cx| > ~0.08 among body nodes
      glbArmRNode = null; glbArmLNode = null;
      _upperBodyEntries.forEach(function(e) {
        if      (e.cx >  0.08) glbArmRNode = e.mesh;
        else if (e.cx < -0.08) glbArmLNode = e.mesh;
      });

      var _nL = _bladeLe ? _bladeLe.mesh : null;
      var _nR = _bladeRe ? _bladeRe.mesh : null;
      var _nS = _shaftE  ? _shaftE.mesh  : null;

      console.log('[KRR BODY] hull='  + (_hullE ? _hullE.mesh.name : 'NOT_FOUND') +
        ' torso=' + (glbTorsoNode ? glbTorsoNode.name : 'NOT_FOUND') +
        ' armR='  + (glbArmRNode ? glbArmRNode.name : 'NOT_FOUND') +
        ' armL='  + (glbArmLNode ? glbArmLNode.name : 'NOT_FOUND') +
        ' ubCount=' + _upperBodyEntries.length);
      console.log('[KRR PADDLE] shaft=' + (_nS ? _nS.name : 'NOT_FOUND') +
        ' bladeL=' + (_nL ? _nL.name : 'NOT_FOUND') +
        ' bladeR=' + (_nR ? _nR.name : 'NOT_FOUND'));

      if (_nL && _nR && _nS) {
        var _shaftBB = new THREE.Box3().setFromObject(_nS);
        _shaftBB.getCenter(_paddlePivot); // save module-level for _applyTorsoHinge
        glbPaddleGroup = new THREE.Group();
        glbPaddleGroup.position.copy(_paddlePivot);
        var _pParent = _nS.parent;
        var _antiPiv = _paddlePivot.clone().negate();
        [_nL, _nR, _nS].forEach(function(n) {
          _pParent.remove(n);
          n.position.copy(_antiPiv);
          glbPaddleGroup.add(n);
        });
        _pParent.add(glbPaddleGroup);
        console.log('[KRR PADDLE] groupChildren=' + glbPaddleGroup.children.length +
          ' pivot=' + _paddlePivot.x.toFixed(3) + ',' + _paddlePivot.y.toFixed(3) + ',' + _paddlePivot.z.toFixed(3));
      } else {
        console.warn('[KRR PADDLE] geometry identification failed - glbPaddleGroup stays null');
      }

      model.scale.setScalar(KAYAKER_SCALE);
      model.rotation.y = KAYAKER_ROT_Y;
      model.position.y = KAYAKER_Y;

      playerGroup.add(model);
      _glbModel = model;  // save for wipeout ejection animation
      console.log('[kayaker] kayaker-bright.glb loaded. scale=' + KAYAKER_SCALE +
        ' rotY=' + KAYAKER_ROT_Y + ' paddle=' + (glbPaddleGroup ? 'OK' : 'null'));

      // Waist hinge group: all upper-body nodes (torso/head/hat/arms + paddle) become children.
      // Every GLB node has an identity transform, so its model-space position is (0,0,0).
      // The group sits at the waist pivot; each child is offset by -pivot so it appears
      // at its original place. Rotating the group pivots the whole upper body as one unit.
      if (glbTorsoNode) {
        var _tParent = glbTorsoNode.parent; // model scene root (same for all sibling nodes)
        glbTorsoGroup = new THREE.Group();
        glbTorsoGroup.position.set(0, TORSO_HINGE_Y, TORSO_HINGE_Z);
        _tParent.add(glbTorsoGroup);

        // Non-arm upper-body nodes go directly into the waist group
        _upperBodyEntries.forEach(function(e) {
          var n = e.mesh;
          if (n === glbArmRNode || n === glbArmLNode) return; // arms handled below
          _tParent.remove(n);
          n.position.set(0, -TORSO_HINGE_Y, -TORSO_HINGE_Z);
          glbTorsoGroup.add(n);
          _ubNodes.push(n); // tracked so _applyTorsoHinge can re-offset on tuner change
        });

        // Paddle group moves into the waist group; adjust from model-root-local to waist-local
        if (glbPaddleGroup) {
          _tParent.remove(glbPaddleGroup);
          glbPaddleGroup.position.set(
            _paddlePivot.x,
            _paddlePivot.y - TORSO_HINGE_Y,
            _paddlePivot.z - TORSO_HINGE_Z
          );
          glbTorsoGroup.add(glbPaddleGroup);
        }

        // Arm sub-groups NESTED INSIDE the waist group.
        // armGroup.position is in waist-local space = shoulder_model - waist_pivot.
        // armNode.position cancels both levels: n.pos = -shoulder_model.
        if (glbArmRNode) {
          glbArmRGroup = new THREE.Group();
          glbArmRGroup.position.set( ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
          glbArmRNode.parent.remove(glbArmRNode);
          glbArmRNode.position.set(-ARM_R_HINGE_X, -ARM_HINGE_Y, -ARM_HINGE_Z);
          glbArmRGroup.add(glbArmRNode);
          glbTorsoGroup.add(glbArmRGroup);
        }
        if (glbArmLNode) {
          glbArmLGroup = new THREE.Group();
          glbArmLGroup.position.set(-ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
          glbArmLNode.parent.remove(glbArmLNode);
          glbArmLNode.position.set( ARM_R_HINGE_X, -ARM_HINGE_Y, -ARM_HINGE_Z);
          glbArmLGroup.add(glbArmLNode);
          glbTorsoGroup.add(glbArmLGroup);
        }

        model.updateMatrixWorld(true);
        var _tWP = new THREE.Vector3();
        glbTorsoGroup.getWorldPosition(_tWP);
        console.log('[KRR HINGE] waist world=(' + _tWP.x.toFixed(3) + ',' + _tWP.y.toFixed(3) + ',' + _tWP.z.toFixed(3) + ')' +
          ' armR=' + (glbArmRGroup ? 'OK' : 'null') + ' armL=' + (glbArmLGroup ? 'OK' : 'null') +
          ' ubNodes=' + _ubNodes.length);
      }
      // playerGroup.clear() removed the shield and initial basket; re-attach both now.
      if (_shieldGroup) playerGroup.add(_shieldGroup);
      _buildBasket3();
    },
    undefined,
    function(err) {
      // Load failed: hand-built model is still in playerGroup - no action needed.
      console.warn('[kayaker] GLB load failed. Hand-built fallback active.', err);
    }
  );
}

// ── OBSTACLE GLB CACHE ───────────────────────────────────────────────
// Pre-loads all obstacle GLBs at script start. Materials are converted to
// MeshBasicMaterial so baked emissive textures render at full brightness
// (no lighting washout from the ambient + sun lights in the scene).
// makeObsMesh() clones from cache; sprite/geometry fallback used until loaded.
function _preloadObsGlb(path) {
  if (obsGlbCache.hasOwnProperty(path)) return;
  obsGlbCache[path] = null; // null = loading in progress
  if (typeof THREE.GLTFLoader === 'undefined') return;
  var _ol = new THREE.GLTFLoader();
  _ol.load(path, function(gltf) {
    var mdl = gltf.scene;
    var _rbb = new THREE.Box3().setFromObject(mdl);
    var _rsz = new THREE.Vector3(); _rbb.getSize(_rsz);
    mdl.traverse(function(nd) {
      if (!nd.isMesh) return;
      var om = nd.material;
      nd.material = new THREE.MeshBasicMaterial({
        map:         om.emissiveMap || om.map || null,
        transparent: om.transparent || false,
        alphaTest:   om.alphaTest   || 0,
        side:        THREE.DoubleSide
      });
      nd.material.color.setScalar(OBS_GLB_BRIGHT);
    });
    mdl.userData.rawW = _rsz.x;
    mdl.userData.rawH = _rsz.y;
    mdl.userData.rawD = _rsz.z;
    obsGlbCache[path] = mdl;
    console.log('[KRR OBSGLB] ' + path + ' ready  rawW=' + _rsz.x.toFixed(3) + ' rawH=' + _rsz.y.toFixed(3) + ' rawD=' + _rsz.z.toFixed(3));
  }, undefined, function(err) {
    console.error('[KRR OBSGLB] load failed: ' + path, err);
  });
}
function _cloneObsGlb(path) {
  var c = obsGlbCache[path];
  return c ? c.clone(true) : null;
}
_preloadObsGlb('stage-1-bridge-lit.glb');
_preloadObsGlb('stage-2-rafters-lit.glb');
_preloadObsGlb('stage-3-bridge-lit.glb');
_preloadObsGlb('stage-4-tubers-lit.glb');
_preloadObsGlb('stage-5-log-lit.glb');
_preloadObsGlb('stage-5-cart-lit.glb');
_preloadObsGlb('boulder-2-lit.glb');
_preloadObsGlb('boulder-3-lit.glb');
_preloadObsGlb('boulder-5-lit.glb');

// ── POPPY BANK TEXTURES ──────────────────────────────────────────
var _poppyTexL  = null, _poppyTexLP = null, _poppyTexLB = null;
var _poppyTexR  = null, _poppyTexRP = null, _poppyTexRB = null;
var _poppyGlowTex = null;
var _hatFlowerTex = null;  // poppy-hat.png: stem-stub bloom worn in hat band
(function() {
  var _pldr = new THREE.TextureLoader();
  function _pLoad(name, cb) {
    _pldr.load(name, function(t) {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      cb(t);
    });
  }
  _pLoad('poppy-leftbank.png?v=17',          function(t) { _poppyTexL  = t; });
  _pLoad('poppy-leftbank-picked.png?v=17',  function(t) { _poppyTexLP = t; });
  _pLoad('poppy-leftbank-bloom.png?v=17',   function(t) { _poppyTexLB = t; });
  _pLoad('poppy-rightbank.png?v=17',        function(t) { _poppyTexR  = t; });
  _pLoad('poppy-rightbank-picked.png?v=17', function(t) { _poppyTexRP = t; });
  _pLoad('poppy-rightbank-bloom.png?v=17',  function(t) { _poppyTexRB = t; });
  _pLoad('poppy-glow.png',                   function(t) { _poppyGlowTex = t; });
  // Hat flower uses LinearFilter for smooth scaling (not pixel art)
  new THREE.TextureLoader().load('poppy-hat.png?v=17', function(t) {
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    _hatFlowerTex = t;
    console.log('[KRR] poppy-hat.png OK');
  }, undefined, function(e) { console.error('[KRR] poppy-hat.png FAILED', e); });
})();

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
    new THREE.RingGeometry(0.32, 0.52, 12),
    new THREE.MeshBasicMaterial({ color: 0xC4EEFF, transparent: true, opacity: 0, depthWrite: false })
  );
  ripMesh.rotation.x = -Math.PI / 2;
  ripMesh.position.set(0, 0.16, -9999);
  ripMesh.renderOrder = 3;
  scene.add(ripMesh);
  obsRipplePool3.push(ripMesh);
}

// Obstacle upstream foam-crescent pool: thin elongated rings in foam-white,
// scaled wide×flat to read as a bow-wave arc at each boulder's upstream face.
const obsFoamPool3 = [];
for (var foamI = 0; foamI < 10; foamI++) {
  var foamMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.20, 0.30, 10),
    new THREE.MeshBasicMaterial({ color: 0xEEF8FF, transparent: true, opacity: 0, depthWrite: false })
  );
  foamMesh.rotation.x = -Math.PI / 2;
  foamMesh.position.set(0, 0.17, -9999);
  foamMesh.renderOrder = 3;
  scene.add(foamMesh);
  obsFoamPool3.push(foamMesh);
}

// Splash pool -- 8 reusable expanding ring meshes (4 normal + 4 for crash-impact burst).
// ROOT CAUSE FIX: old rings were RingGeometry(0.05,0.18) at scale 0.25 = 0.09 world diameter = ~5px. Invisible.
// New: outer radius 0.35, bright white, y=0.22 (above water wave peaks), renderOrder=4.
const splashPool3 = [];
for (var spI3 = 0; spI3 < 8; spI3++) {
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

// ── SHIELD BUBBLE ──────────────────────────────────────────────────────────
// Boat bounds in playerGroup space: x ±0.425, z ±1.25, y 0..0.60.
// Paddler top: world y ~0.90. Ellipsoid centered at y=0.45 encloses both.
// Two nested shells: overlap concentrates opacity at grazing angle -> rim-bright look.
// renderOrder=4 (above water=2); depthTest=true so opaque boat body clips the interior.
var SHIELD_COLOR       = 0xF9A03C; // poppy-orange tint of the bubble; edit to change hue
var SHIELD_INNER_OP    = 0.04;   // inner ellipsoid base opacity; Shift+I/K to tune
var SHIELD_OUTER_OP    = 0.08;   // outer ellipsoid base opacity; Shift+O/L to tune
var SHIELD_RADIUS_MULT = 1.0;    // overall scale multiplier; Shift+R/V to tune
var SHIELD_SHIMMER_A   = 0.015;  // shimmer amplitude (adds to/from base opacity)
var SHIELD_SHIMMER_F   = 0.018;  // shimmer frequency (rad/frame)
var SHIELD_HUE_SPEED   = 0.0025; // hue units/frame for iridescent cycle (~6.7s full cycle at 60fps); ~ / | to tune

// ── SHIELD SHARD CONSTANTS ──────────────────────────────────────────────────
var SHARD_COUNT    = 10;    // shards per burst (pool holds 12); Ctrl+Shift+J/L to tune
var SHARD_SPEED    = 0.038; // initial outward speed wu/frame; Ctrl+Shift+Y/U to tune
var SHARD_DURATION = 600;   // ms for full arc + fade; Ctrl+Shift+T/P to tune
var SHARD_GRAVITY  = 0.003; // gravity per frame (wu/frame²)

var _shieldGroup  = null;  // Group parent for both shells; child of playerGroup
var _shieldInner  = null;  // smaller ellipsoid (~0.55 x, 0.50 y, 1.35 z)
var _shieldOuter  = null;  // larger ellipsoid (~0.62 x, 0.57 y, 1.43 z)
var _shieldBurstSt = 0;    // Date.now() when burst started; 0 = idle

(function() {
  var _sg = new THREE.SphereGeometry(1, 28, 18);
  var _iMat = new THREE.MeshBasicMaterial({
    color: SHIELD_COLOR, transparent: true, opacity: SHIELD_INNER_OP,
    depthWrite: false, side: THREE.DoubleSide
  });
  var _oMat = new THREE.MeshBasicMaterial({
    color: SHIELD_COLOR, transparent: true, opacity: SHIELD_OUTER_OP,
    depthWrite: false, side: THREE.DoubleSide
  });
  _shieldGroup = new THREE.Group();
  _shieldGroup.position.set(0, 0.45, 0);

  _shieldInner = new THREE.Mesh(_sg, _iMat);
  _shieldInner.scale.set(0.55, 0.50, 1.35);
  _shieldInner.renderOrder = 4;

  _shieldOuter = new THREE.Mesh(_sg, _oMat);
  _shieldOuter.scale.set(0.62, 0.57, 1.43);
  _shieldOuter.renderOrder = 4;

  _shieldGroup.add(_shieldInner, _shieldOuter);
  _shieldGroup.visible = false;
  playerGroup.add(_shieldGroup);
})();

// ── SHIELD SHARD POOL ────────────────────────────────────────────────────────
// 12 pre-built triangle meshes in scene space; reused each burst, never allocated per-hit.
var _shardPool = []; // [{mesh, active, vx,vy,vz, sx,sy,sz, startT}]
(function() {
  var _geo = new THREE.BufferGeometry();
  // Elongated shard: tall sliver so it reads as a glass chip even when edge-on
  var _v = new Float32Array([0, 0.40, 0,  -0.16, -0.25, 0,  0.19, -0.20, 0]);
  _geo.setAttribute('position', new THREE.BufferAttribute(_v, 3));
  _geo.computeVertexNormals();
  for (var _si = 0; _si < 12; _si++) {
    var _mat = new THREE.MeshBasicMaterial({
      color: SHIELD_COLOR, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
    });
    var _m = new THREE.Mesh(_geo, _mat);
    _m.visible = false; _m.renderOrder = 5;
    scene.add(_m);
    _shardPool.push({ mesh: _m, active: false, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, startT: 0 });
  }
})();

function _launchShieldShards() {
  if (_shardPool.length === 0) return;
  // Sample bubble hue at the moment of break so shards match the shimmer colour
  var _bHue = (frameN * SHIELD_HUE_SPEED) % 1.0;
  var _swp  = new THREE.Vector3();
  playerGroup.getWorldPosition(_swp);
  _swp.y += 0.45; // _shieldGroup.position.y
  var _n = Math.min(SHARD_COUNT, _shardPool.length);
  for (var _i = 0; _i < _shardPool.length; _i++) { _shardPool[_i].active = false; _shardPool[_i].mesh.visible = false; }
  for (var _j = 0; _j < _n; _j++) {
    var _sd  = _shardPool[_j];
    var _ang = (_j / _n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    var _spd = SHARD_SPEED * (0.7 + Math.random() * 0.6);
    _sd.vx = Math.cos(_ang) * _spd;
    _sd.vy = 0.012 + Math.random() * 0.018; // initial upward burst
    _sd.vz = Math.sin(_ang) * _spd * 0.5;   // shallow depth scatter
    _sd.sx = (Math.random() - 0.5) * 0.28;
    _sd.sy = (Math.random() - 0.5) * 0.28;
    _sd.sz = (Math.random() - 0.5) * 0.35;
    _sd.startT = Date.now();
    _sd.mesh.position.set(
      _swp.x + Math.cos(_ang) * 0.72,
      _swp.y + (Math.random() - 0.5) * 0.50,
      _swp.z + Math.sin(_ang) * 0.72
    );
    _sd.mesh.rotation.set(
      Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2
    );
    _sd.mesh.material.color.setHSL((_bHue + _j * 0.09) % 1.0, 0.90, 0.75);
    _sd.mesh.material.opacity = 1.0;
    _sd.mesh.visible = true; _sd.active = true;
  }
  console.log('[KRR] shield shards launched, n=' + _n + ', pos=' + _swp.x.toFixed(2) + ',' + _swp.y.toFixed(2) + ',' + _swp.z.toFixed(2));
}

// ── STERN BASKET ─────────────────────────────────────────────────
// Declared here (before _buildBasket3 is called) so assignments survive execution order.
var _basketGroup        = null; // Group parent for basket + orange pool; child of playerGroup
var _orangePileGroup    = null; // sub-group holding orange + rim meshes; Y-shifted by BASKET_HEAP_Y
var _basketOranges      = [];   // [{mesh, rim, popStartT}] fixed pool of orange sphere meshes
var _basketPrevOranges  = -1;   // last seen player3.oranges (for re-sync on reset)

// Build (or rebuild after GLB clear) the wicker basket + orange sphere pool
// as direct children of playerGroup. Called once for the fallback hand-built
// model and again inside the GLB success callback after playerGroup.clear().
function _buildBasket3() {
  // Dispose previous build (happens when GLB load clears playerGroup)
  if (_basketGroup) {
    if (_basketGroup.parent) _basketGroup.parent.remove(_basketGroup);
    _basketGroup.traverse(function(c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material && !Array.isArray(c.material)) c.material.dispose();
    });
    _basketGroup = null;
    _orangePileGroup = null;
  }
  _basketOranges = []; // always reset before building pool (handles first call too)

  var _bg = new THREE.Group();
  _bg.position.set(BASKET_X, BASKET_Y, BASKET_Z);
  _bg.scale.setScalar(BASKET_SCALE);

  // Body: open-ended tapered cylinder (radiusTop wider = basket splay)
  var _cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.20, 0.22, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xC79A5B, side: THREE.DoubleSide })
  );
  _bg.add(_cyl);

  // Wicker rings: thin horizontal torus at 3 heights along the body
  // Ring radius interpolates from 0.20 (bottom Y=-0.11) to 0.26 (top Y=+0.11)
  var _ringYs = [-0.06, 0.01, 0.07];
  for (var _ri = 0; _ri < _ringYs.length; _ri++) {
    var _ry  = _ringYs[_ri];
    var _rr  = 0.20 + (_ry + 0.11) / 0.22 * 0.06;
    var _rm  = new THREE.Mesh(
      new THREE.TorusGeometry(_rr, 0.009, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0x9A7235 })
    );
    _rm.rotation.x = Math.PI / 2; // TorusGeometry lies in XY; rotate to XZ (horizontal)
    _rm.position.y = _ry;
    _bg.add(_rm);
  }

  // Rim: thicker darker torus at top edge
  var _rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.018, 8, 18),
    new THREE.MeshBasicMaterial({ color: 0x5E3A14 })
  );
  _rim.rotation.x = Math.PI / 2;
  _rim.position.y = 0.11;
  _bg.add(_rim);

  // Orange pile: 24 camera-facing sprites — wide oval base, narrowing upward.
  // Wider in x than z so it reads as a generous catch, not a tall narrow stack.
  // Layer 0 (11): wide oval perimeter (10, 36° steps, xr=0.17 zr=0.08) + center fill.
  // Layer 1 (9):  mid oval (8, 45° steps, xr=0.115 zr=0.055) + center fill.
  // Layer 2 (3):  upper trio (120° apart, xr=0.065 zr=0.030).
  // Layer 3 (1):  top single.
  var _sp = [
    // Layer 0 — wide oval base (10) + center fill (1) = 11
    [ 0.170, -0.056,  0.000], [ 0.137, -0.058,  0.047], [ 0.053, -0.055,  0.076],
    [-0.053, -0.059,  0.076], [-0.137, -0.056,  0.047], [-0.170, -0.054,  0.000],
    [-0.137, -0.058, -0.047], [-0.053, -0.055, -0.076], [ 0.053, -0.059, -0.076],
    [ 0.137, -0.056, -0.047],
    [ 0.000, -0.056,  0.000],
    // Layer 1 — mid oval (8) + center fill (1) = 9
    [ 0.115,  0.040,  0.000], [ 0.081,  0.038,  0.039], [ 0.000,  0.042,  0.055],
    [-0.081,  0.040,  0.039], [-0.115,  0.038,  0.000], [-0.081,  0.042, -0.039],
    [ 0.000,  0.040, -0.055], [ 0.081,  0.039, -0.039],
    [ 0.000,  0.042,  0.000],
    // Layer 2 — upper trio (3)
    [ 0.065,  0.110,  0.000], [-0.033,  0.112,  0.026], [-0.033,  0.110, -0.026],
    // Layer 3 — top single (1)
    [ 0.000,  0.165,  0.000],
  ];
  // Orange pile sub-group so BASKET_HEAP_Y and BASKET_SPREAD tuners work live
  var _pileGrp = new THREE.Group();
  _pileGrp.position.y = BASKET_HEAP_Y;
  _pileGrp.scale.x = BASKET_SPREAD;
  _pileGrp.scale.z = BASKET_SPREAD;
  _bg.add(_pileGrp);
  _orangePileGroup = _pileGrp;
  var _oBscale = 0.13; // sprite display size in world units (≈ old sphere diameter 0.11 + margin)
  var _oSpriteMat = new THREE.SpriteMaterial({
    map: orangeInBasketTex || null,
    color: orangeInBasketTex ? 0xFFFFFF : 0xF08A1E,
    transparent: true, alphaTest: 0.05
  });
  for (var _oi = 0; _oi < _sp.length; _oi++) {
    var _oSpr = new THREE.Sprite(_oSpriteMat.clone()); // clone so pop-in can tint independently
    _oSpr.position.set(_sp[_oi][0], _sp[_oi][1], _sp[_oi][2]);
    _oSpr.scale.set(_oBscale, _oBscale, 1);
    _oSpr.visible = false;
    _pileGrp.add(_oSpr);
    _basketOranges.push({ mesh: _oSpr, rim: null, popStartT: 0, baseScale: _oBscale });
  }

  playerGroup.add(_bg);
  _basketGroup = _bg;
  _basketPrevOranges = -1; // force re-sync on next update
  var _sternDeckY = BOAT_WALL_H + GUNWALE_H; // = 0.30 in playerGroup space
  console.log('[KRR BASKET] sternDeckY=' + _sternDeckY.toFixed(2) + ' basketBottom=' + (BASKET_Y - 0.11).toFixed(2) + ' x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' scale=' + BASKET_SCALE);
}

// Per-frame: show/hide orange spheres to match player3.oranges; pop-in newest one.
function _updateBasketOranges3() {
  if (!_basketGroup) return;
  var _vis = Math.min(player3.oranges, BASKET_MAX_VIS, _basketOranges.length);
  var _now = Date.now();
  for (var _bi = 0; _bi < _basketOranges.length; _bi++) {
    var _bo = _basketOranges[_bi];
    if (_bi < _vis) {
      if (!_bo.mesh.visible) {
        _bo.mesh.visible = true;
        if (_bo.rim) _bo.rim.visible = true;
        _bo.popStartT = _now;
      }
      var _bpEl = _bo.popStartT > 0 ? (_now - _bo.popStartT) : 200;
      var _bbs  = _bo.baseScale !== undefined ? _bo.baseScale : 1;
      if (_bpEl < 200) {
        var _bpt = _bpEl / 200;
        var _bscale = 1 - (1 - _bpt) * (1 - _bpt); // ease-out quad 0->1
        _bo.mesh.scale.set(_bbs * _bscale, _bbs * _bscale, 1);
        if (_bo.rim) _bo.rim.scale.setScalar(_bscale);
      } else {
        _bo.mesh.scale.set(_bbs, _bbs, 1);
        if (_bo.rim) _bo.rim.scale.setScalar(1);
      }
    } else {
      if (_bo.mesh.visible) _bo.mesh.visible = false;
      if (_bo.rim && _bo.rim.visible) _bo.rim.visible = false;
    }
  }
}

// Initial basket build for fallback hand-built model (re-built in GLB callback after clear).
_buildBasket3();

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
    case 'orange': {
      // SpriteMaterial: unlit, shows orange.png exactly as-painted with no light tinting.
      // MeshPhongMaterial was here before -- the 2.2x warm directional saturated R+G and made it look yellow.
      var _oSpMat = new THREE.SpriteMaterial({
        map:         orangeCollTex || null,
        color:       orangeCollTex ? 0xFFFFFF : 0xF97316,  // white = no tint; fallback solid if tex not loaded
        transparent: true,
        alphaTest:   0.05
      });
      var _oSpr = new THREE.Sprite(_oSpMat);
      _oSpr.scale.set(0.45, 0.45, 1);
      return _oSpr;
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
      var _br1c = _cloneObsGlb('stage-1-bridge-lit.glb');
      if (_br1c) {
        var _br1raw = obsGlbCache['stage-1-bridge-lit.glb'].userData.rawW;
        var _br1s = ((_br1raw > 0.01) ? (rw / _br1raw) : 1) * BRIDGE1_SCALE;
        _br1c.scale.setScalar(_br1s);
        _br1c.rotation.y = BRIDGE1_ROT_Y;
        _br1c.position.y = BRIDGE1_SEAT_Y;
        grp.add(_br1c);
        if (!_bridge1GlbLogged) {
          _bridge1GlbLogged = true;
          var _br1bb = new THREE.Box3().setFromObject(grp); var _br1sz = new THREE.Vector3(); _br1bb.getSize(_br1sz);
          console.log('[KRR OBSGLB] stage-1-bridge world W=' + _br1sz.x.toFixed(3) + ' H=' + _br1sz.y.toFixed(3) + ' D=' + _br1sz.z.toFixed(3) + ' scale=' + _br1s.toFixed(4) + ' seatY=' + BRIDGE1_SEAT_Y);
        }
      } else {
        // Sprite fallback until GLB loads
        if (bridge1Tex) {
          var br1W = rw;
          var br1H = br1W / bridge1Asp;
          var br1Geo = new THREE.PlaneGeometry(br1W, br1H);
          br1Geo.translate(0, br1H / 2, 0);
          var br1Mat = new THREE.MeshBasicMaterial({ map: bridge1Tex, transparent: true, alphaTest: 0.05, depthWrite: false });
          var br1Plane = new THREE.Mesh(br1Geo, br1Mat);
          br1Plane.position.y = FW1_SEAT_Y;
          br1Plane.renderOrder = 3;
          grp.userData.bridgeSpriteMesh = br1Plane;
          grp.add(br1Plane);
        } else {
          const logGeo = new THREE.CylinderGeometry(0.30, 0.38, rw + 1.4, 6);
          logGeo.rotateZ(Math.PI / 2);
          const log = new THREE.Mesh(logGeo, lm(0x78350F));
          log.position.y = 0.34; grp.add(log);
          const topGeo = new THREE.CylinderGeometry(0.31, 0.31, rw + 1.4, 6);
          topGeo.rotateZ(Math.PI / 2);
          const top = new THREE.Mesh(topGeo, lm(0x92400E));
          top.position.set(0, 0.60, 0); top.scale.y = 0.18; grp.add(top);
          for (const sx of [-(rw / 2 + 0.55), rw / 2 + 0.55]) {
            const endGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 6);
            const end = new THREE.Mesh(endGeo, lm(0x5C2002));
            end.rotation.z = Math.PI / 2; end.position.set(sx, 0.34, 0); grp.add(end);
          }
        }
      }

    } else if (type === 'raft_train') {
      var _rt2c = _cloneObsGlb('stage-2-rafters-lit.glb');
      if (_rt2c) {
        var _rt2raw = obsGlbCache['stage-2-rafters-lit.glb'].userData.rawW;
        var _rt2s = ((_rt2raw > 0.01) ? (rw / _rt2raw) : 1) * RAFTERS2_SCALE;
        _rt2c.scale.setScalar(_rt2s);
        _rt2c.rotation.y = RAFTERS2_ROT_Y;
        _rt2c.position.y = RAFTERS2_SEAT_Y;
        grp.add(_rt2c);
        if (!_rafters2GlbLogged) {
          _rafters2GlbLogged = true;
          var _rt2bb = new THREE.Box3().setFromObject(grp); var _rt2sz = new THREE.Vector3(); _rt2bb.getSize(_rt2sz);
          console.log('[KRR OBSGLB] stage-2-rafters world W=' + _rt2sz.x.toFixed(3) + ' H=' + _rt2sz.y.toFixed(3) + ' D=' + _rt2sz.z.toFixed(3) + ' scale=' + _rt2s.toFixed(4) + ' seatY=' + RAFTERS2_SEAT_Y);
        }
      } else {
        // Sprite fallback until GLB loads
        if (raftTrainTex) {
          var rtW = rw;
          var rtH = rtW / raftTrainAsp;
          var rtGeo = new THREE.PlaneGeometry(rtW, rtH);
          rtGeo.translate(0, rtH / 2, 0);
          var rtMat = new THREE.MeshBasicMaterial({ map: raftTrainTex, transparent: true, alphaTest: 0.05, depthWrite: false });
          var rtPlane = new THREE.Mesh(rtGeo, rtMat);
          rtPlane.position.y = FW2_SEAT_Y;
          rtPlane.renderOrder = 3;
          var rtHullBaseOff = rtH * 0.44;
          var rtHullGeo = new THREE.BoxGeometry(rtW * 0.9, FW_HULL_H, FW_HULL_D);
          var rtHullMat = new THREE.MeshBasicMaterial({ color: FW_HULL_TINT });
          var rtHull = new THREE.Mesh(rtHullGeo, rtHullMat);
          rtHull.position.set(0, FW2_SEAT_Y + rtHullBaseOff - FW_HULL_H / 2, -FW_HULL_D / 2);
          rtHull.renderOrder = 2;
          grp.userData.raftSpriteGroup = true;
          grp.userData.raftSpriteMesh  = rtPlane;
          grp.userData.raftHullMesh    = rtHull;
          grp.userData.raftHullBaseOff = rtHullBaseOff;
          grp.add(rtHull);
          grp.add(rtPlane);
        } else {
          var raftWf = rw * 0.28;
          for (var rfi = 0; rfi < 3; rfi++) {
            var rxf = -rw * 0.29 + rfi * rw * 0.29;
            var raftf = new THREE.Mesh(new THREE.BoxGeometry(raftWf - 0.12, 0.12, 0.72), lm(0x92400E));
            raftf.position.set(rxf, 0.06, 0); grp.add(raftf);
            var deckf = new THREE.Mesh(new THREE.BoxGeometry(raftWf - 0.14, 0.04, 0.70), lm(0xB45309));
            deckf.position.set(rxf, 0.14, 0); grp.add(deckf);
            if (rfi < 2) {
              var ropeGf = new THREE.CylinderGeometry(0.026, 0.026, 0.22, 4);
              ropeGf.rotateZ(Math.PI / 2);
              var ropef = new THREE.Mesh(ropeGf, lm(0x78350F));
              ropef.position.set(rxf + raftWf * 0.5 + 0.11, 0.06, 0); grp.add(ropef);
            }
          }
        }
      }

    } else if (type === 'pontoon_party') {
      var _br3c = _cloneObsGlb('stage-3-bridge-lit.glb');
      if (_br3c) {
        var _br3raw = obsGlbCache['stage-3-bridge-lit.glb'].userData.rawW;
        var _br3s = ((_br3raw > 0.01) ? (rw / _br3raw) : 1) * BRIDGE3_SCALE;
        _br3c.scale.setScalar(_br3s);
        _br3c.rotation.y = BRIDGE3_ROT_Y;
        _br3c.position.y = BRIDGE3_SEAT_Y;
        grp.add(_br3c);
        if (!_bridge3GlbLogged) {
          _bridge3GlbLogged = true;
          var _br3bb = new THREE.Box3().setFromObject(grp); var _br3sz = new THREE.Vector3(); _br3bb.getSize(_br3sz);
          console.log('[KRR OBSGLB] stage-3-bridge world W=' + _br3sz.x.toFixed(3) + ' H=' + _br3sz.y.toFixed(3) + ' D=' + _br3sz.z.toFixed(3) + ' scale=' + _br3s.toFixed(4) + ' seatY=' + BRIDGE3_SEAT_Y);
        }
      } else {
        // Sprite fallback until GLB loads
        if (bridge2Tex) {
          var br2W = rw * FW3_WIDTH_MULT;
          var br2H = (rw / bridge2Asp) * FW3_HEIGHT_MULT;
          var br2Geo = new THREE.PlaneGeometry(br2W, br2H);
          br2Geo.translate(0, br2H / 2, 0);
          var br2Mat = new THREE.MeshBasicMaterial({ map: bridge2Tex, transparent: true, alphaTest: 0.05, depthWrite: false });
          var br2Plane = new THREE.Mesh(br2Geo, br2Mat);
          br2Plane.position.y = FW3_SEAT_Y;
          br2Plane.renderOrder = 3;
          grp.userData.bridgeSpriteMesh3 = br2Plane;
          grp.add(br2Plane);
        } else {
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
        }
      }

    } else if (type === 'old_mining_bridge') {
      var _tb4c = _cloneObsGlb('stage-4-tubers-lit.glb');
      if (_tb4c) {
        var _tb4raw = obsGlbCache['stage-4-tubers-lit.glb'].userData.rawW;
        var _tb4s = ((_tb4raw > 0.01) ? (rw / _tb4raw) : 1) * TUBERS4_SCALE;
        _tb4c.scale.setScalar(_tb4s);
        _tb4c.rotation.y = TUBERS4_ROT_Y;
        _tb4c.position.y = TUBERS4_SEAT_Y;
        grp.add(_tb4c);
        if (!_tubers4GlbLogged) {
          _tubers4GlbLogged = true;
          var _tb4bb = new THREE.Box3().setFromObject(grp); var _tb4sz = new THREE.Vector3(); _tb4bb.getSize(_tb4sz);
          console.log('[KRR OBSGLB] stage-4-tubers world W=' + _tb4sz.x.toFixed(3) + ' H=' + _tb4sz.y.toFixed(3) + ' D=' + _tb4sz.z.toFixed(3) + ' scale=' + _tb4s.toFixed(4) + ' seatY=' + TUBERS4_SEAT_Y);
        }
      } else {
        // Sprite fallback until GLB loads
        if (tubeRaftTex) {
          var tr4W = rw;
          var tr4H = tr4W / tubeRaftAsp;
          var tr4Geo = new THREE.PlaneGeometry(tr4W, tr4H);
          tr4Geo.translate(0, tr4H / 2, 0);
          var tr4Mat = new THREE.MeshBasicMaterial({ map: tubeRaftTex, transparent: true, alphaTest: 0.05, depthWrite: false });
          var tr4Plane = new THREE.Mesh(tr4Geo, tr4Mat);
          tr4Plane.position.y = FW4_SEAT_Y;
          tr4Plane.renderOrder = 3;
          grp.userData.mineSpriteMesh = tr4Plane;
          grp.add(tr4Plane);
        } else {
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
        }
      }

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
    var rwGrp = new THREE.Group();
    var rwGeo = new THREE.CircleGeometry(RW_SPIRAL_SIZE / 2, 48);
    var rwMat = new THREE.MeshBasicMaterial({ map: rwSpiralTex, transparent: true, depthWrite: false });
    var rwDisc = new THREE.Mesh(rwGeo, rwMat);
    rwDisc.rotation.x = -Math.PI / 2;  // lie flat, normal +Y (matches water plane orientation)
    rwDisc.renderOrder = 3;             // above water (renderOrder 2), same layer as other obstacles
    rwGrp.userData.spiralDisc = rwDisc;
    rwGrp.add(rwDisc);
    return rwGrp;
  }
  if (type === 'boulder') {
    // GLB first (BOULDER_GLB_FILES); sprite fallback until cache is populated.
    // scale = (LANE_W / rawW) * BOULDER_GLB_SCALE[i] fits the model to one lane.
    // Collision is single-lane/z-range -- unchanged in checkCollisions3().
    var bGlbI     = Math.floor(Math.random() * BOULDER_GLB_FILES.length);
    var bGlbPath  = BOULDER_GLB_FILES[bGlbI];
    var bGlbClone = _cloneObsGlb(bGlbPath);
    if (bGlbClone) {
      var bGlbRaw = obsGlbCache[bGlbPath].userData.rawW;
      var bGlbS   = (bGlbRaw > 0.01 ? (LANE_W / bGlbRaw) : 1) * BOULDER_GLB_SCALE[bGlbI];
      bGlbClone.scale.setScalar(bGlbS);
      bGlbClone.rotation.y = Math.random() * Math.PI * 2;
      bGlbClone.position.y = BOULDER_GLB_SEAT_Y;
      var bGlbGrp = new THREE.Group();
      bGlbGrp.userData.isBoulderGlb  = true;
      bGlbGrp.userData.boulderGlbIdx = bGlbI;
      bGlbGrp.userData.boulderGlbRaw = bGlbRaw;
      bGlbGrp.userData.boulderLanes  = 1;
      bGlbGrp.add(bGlbClone);
      return bGlbGrp;
    }
    // Sprite fallback while GLBs are still loading
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
    // GLB first; sprite fallback until cache is populated.
    // scale = ((LANE_W * 2) / rawW) * BOULDER_GLB_SCALE[i] fits the model to two lanes.
    // Collision handled by lane + lane2 check in checkCollisions3().
    var bwGlbI     = Math.floor(Math.random() * BOULDER_GLB_FILES.length);
    var bwGlbPath  = BOULDER_GLB_FILES[bwGlbI];
    var bwGlbClone = _cloneObsGlb(bwGlbPath);
    if (bwGlbClone) {
      var bwGlbRaw = obsGlbCache[bwGlbPath].userData.rawW;
      var bwGlbS   = (bwGlbRaw > 0.01 ? ((LANE_W * 2) / bwGlbRaw) : 1) * BOULDER_GLB_SCALE[bwGlbI];
      bwGlbClone.scale.setScalar(bwGlbS);
      bwGlbClone.rotation.y = Math.random() * Math.PI * 2;
      bwGlbClone.position.y = BOULDER_GLB_SEAT_Y;
      var bwGlbGrp = new THREE.Group();
      bwGlbGrp.userData.isBoulderGlb  = true;
      bwGlbGrp.userData.boulderGlbIdx = bwGlbI;
      bwGlbGrp.userData.boulderGlbRaw = bwGlbRaw;
      bwGlbGrp.userData.boulderLanes  = 2;
      bwGlbGrp.add(bwGlbClone);
      return bwGlbGrp;
    }
    // Sprite fallback while GLBs are still loading
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
    var _ct5c = _cloneObsGlb('stage-5-cart-lit.glb');
    if (_ct5c) {
      var _ct5grp = new THREE.Group();
      var _ct5raw = obsGlbCache['stage-5-cart-lit.glb'].userData.rawW;
      var _ct5s = ((_ct5raw > 0.01) ? (LANE_W / _ct5raw) : 1) * CART5_SCALE;
      _ct5c.scale.setScalar(_ct5s);
      // Per-spawn random orientation: each cart faces a different direction.
      // CART5_ROT_Y is a global bias (default 0); Math.random() adds per-instance variation.
      _ct5c.rotation.y = CART5_ROT_Y + Math.random() * Math.PI * 2;
      // Small random tilt so they look haphazardly dumped rather than neatly placed.
      _ct5c.rotation.z = (Math.random() - 0.5) * 0.4;
      _ct5c.position.y = CART5_SEAT_Y;
      _ct5grp.add(_ct5c);
      if (!_cart5GlbLogged) {
        _cart5GlbLogged = true;
        var _ct5bb = new THREE.Box3().setFromObject(_ct5grp); var _ct5sz = new THREE.Vector3(); _ct5bb.getSize(_ct5sz);
        console.log('[KRR OBSGLB] stage-5-cart world W=' + _ct5sz.x.toFixed(3) + ' H=' + _ct5sz.y.toFixed(3) + ' D=' + _ct5sz.z.toFixed(3) + ' scale=' + _ct5s.toFixed(4) + ' seatY=' + CART5_SEAT_Y + ' groupY=S5_CART_SEAT_Y=' + S5_CART_SEAT_Y);
      }
      return _ct5grp;
    }
    // Sprite fallback until GLB loads
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
    // fallenLogAlt5 already incremented by spawnObs3 before this call.
    var lgIdx = fallenLogAlt5 % 2; // 0 = gap-right (default), 1 = gap-left (mirror X)
    var _lg5c = _cloneObsGlb('stage-5-log-lit.glb');
    if (_lg5c) {
      var _lg5grp = new THREE.Group();
      var lgTargetW = (curLanes - 1) * LANE_W;
      var _lg5raw = obsGlbCache['stage-5-log-lit.glb'].userData.rawW;
      var _lg5s = ((_lg5raw > 0.01) ? (lgTargetW / _lg5raw) : 1) * LOG5_SCALE;
      _lg5c.scale.setScalar(_lg5s);
      // Mirror X for gap-left: roots face right when scale.x is negated.
      if (lgIdx === 1) _lg5c.scale.x = -_lg5s;
      _lg5c.rotation.y = LOG5_ROT_Y;
      // spawnObs3 places this group at S5_LOG_SEAT_Y. Compensate so the
      // model base lands at LOG5_SEAT_Y (default 0.0 = on the water surface).
      _lg5c.position.y = LOG5_SEAT_Y - S5_LOG_SEAT_Y;
      _lg5grp.add(_lg5c);
      if (!_log5GlbLogged) {
        _log5GlbLogged = true;
        var _lg5bb = new THREE.Box3().setFromObject(_lg5grp); var _lg5sz = new THREE.Vector3(); _lg5bb.getSize(_lg5sz);
        console.log('[KRR OBSGLB] stage-5-log world W=' + _lg5sz.x.toFixed(3) + ' H=' + _lg5sz.y.toFixed(3) + ' D=' + _lg5sz.z.toFixed(3) + ' scale=' + _lg5s.toFixed(4) + ' mirror=' + (lgIdx === 1) + ' worldY=' + LOG5_SEAT_Y);
      }
      return _lg5grp;
    }
    // Sprite fallback until GLB loads
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

// ── PLAY MODE ────────────────────────────────────────────────────
// 'classic': snap-to-lane (original)  |  'daring': free analogue steering
var playMode3 = null;  // set by card selection each visit; null = no mode chosen yet

// Daring free-steering state (unused in classic; never touch classic paths)
var _daringVx       = 0;      // current horizontal steering velocity (wu/frame)
var _daringSteerL   = false;  // is left key/touch held right now
var _daringSteerR   = false;  // is right key/touch held right now
var DARING_ACCEL    = 0.0165; // wu/frame² acceleration while key held (0.022 × 0.75)
var DARING_FRICTION = 0.86;   // velocity multiplier per frame (1=no friction, 0=instant stop)
var DARING_MAX_SPD  = 0.12;   // max steering speed (wu/frame) (0.16 × 0.75)
var KAYAK_HALF_W    = 0.35;   // margin from river edge to kayak center (world units)
var _daringRoll3    = 0;      // current hull bank angle (rotation.z), spring-driven
var _daringRollVel3 = 0;      // roll spring velocity
var DARING_YAW_MAX  = 0.75;   // rad: nose-lead yaw at full steer
var DARING_ROLL_MAX = 0.52;   // rad: hull banking lean at full steer
// One-time migration: clear stored best when scoring scale changes (KRR_SCORE_VER bump).
// Old scale (~200k) is now unreachable on the new scale (~22k), so we wipe once and re-save.
const KRR_SCORE_VER = 2;
if (parseInt(localStorage.getItem('krr3d_hs_ver') || '0', 10) < KRR_SCORE_VER) {
  localStorage.removeItem('krr3d_hs');
  localStorage.setItem('krr3d_hs_ver', String(KRR_SCORE_VER));
}
let highScore3 = parseInt(localStorage.getItem('krr3d_hs') || '0', 10);
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
var endingBeachStartMs   = 0;     // Date.now() when beaching phase started
var endingCinematicFired = false; // prevents double-trigger of ending dialog
var _forlornStartMs      = 0;     // Date.now() when forlorn state began; 0 = inactive
var _forlornTipDone      = false;
var _qmarkSpr            = null;  // question-mark sprite above beached kayaker (forlorn beat)
var WIPEOUT_MS           = 1750;  // ms wipeout plays before game-over screen
var _wipeoutStartMs      = 0;     // Date.now() when wipeout began; 0 = inactive
var _wipeoutSplashFired  = false; // prevents double-splash
var _wipeoutKayakerVy    = 0;     // per-frame vertical velocity of ejected GLB model
var _wipeoutKayakerVx    = 0;     // per-frame lateral drift
var _wipeoutKayakerVz    = 0;     // per-frame forward/back velocity (endo variant)
var _wipeoutDir          = 1;     // +1/-1: direction kayaker ejects (and hull capsizes toward)
var _wipeoutVariant      = 'capsize'; // chosen per crash: 'capsize','endo','spin-flip','float-away'
var _wipeoutMag          = 1.0;   // random magnitude 0.85–1.15; makes each crash feel different
var _wipeoutFloating     = false; // float-away: true once kayaker has landed and is bobbing
var _wipeoutFloatBaseY   = 0.10; // water surface Y for float-away bob
var _wipeoutFloatPhase   = 0;    // frame counter driving the bob sin
var _wipeoutGlbInScene   = false; // true once _glbModel is reparented to scene for world-space float
var _wipeoutPreImpactSpd = 0;     // curSpd3 at moment of impact; eased to zero during wipeout animation
var _wipeoutOranges      = [];   // [{mesh,vx,vy,vz,driftVx,driftVz,rotSpd,landed,floatBaseY,phase}]
var _storyPanel          = 0;     // current panel index 0-6
var _storyTurning        = false; // page-turn animation in progress — block input
var _storyFromMenu       = false; // true when opened from menu button (not post-game)
var _storyPreloaded      = false;
var victoryEl3           = null;  // alias for _titleCardEl; kept so legacy cleanup sites still compile
var _victoryCancelFn     = null;  // alias for _titleCancelFn; kept for legacy cleanup sites
var _titleCardEl         = null;  // active title card div (stage card or ending)
var _titleCancelFn       = null;  // abort the active card's rAF loop
var _titleCardSuppressSpawn = false; // true during enter+hold to give the player a breather
// (reach / contact vars now live near module declarations, see _poppyPickSt block above)

var narrowing        = false;    // true while a sub-narrow squeeze is animating
var narrowFromRw     = 0;        // rwCur at the moment narrowing began
var narrowToRw       = 0;        // target rwCur (= narrowToLanes * LANE_W)
var narrowStartMile  = 0;        // curMile3 when narrowing began
var narrowToLanes    = 0;        // lane count after the squeeze
var narrowToObsFreq  = 0;        // obsFreq to apply after the squeeze
var narrowFromLanes  = 0;        // curLanes at the moment narrowing began

const player3 = {
  lane: 3, targetLane: 3, x: 0,
  isJumping: false, jumpFrame: 0,
  dead: false, hasShield: false, spinoutFrames: 0,
  oranges: 0,
};

let obstacles3    = [];
let collectibles3 = [];
var _scorePopups        = []; // [{spr,tex,startY,startT}] active floating "+N" sprites
var _swellOrangeSprites = []; // [{mesh,vx,vy,vz,rotSpd,startT}] tumbling theft oranges
var _orangeFlights      = []; // [{mesh,sx,sy,sz,px,py,pz,value,startT}] oranges arcing to basket

// ── STAGE MANAGEMENT ─────────────────────────────────────────────
function applyStage3(idx, msg) {
  narrowing   = false;
  stageIdx    = idx;
  curLanes    = STAGES3[idx].lanes;
  rwCur       = curLanes * LANE_W;
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
  // Stage title card: shows name + mile, suppresses obstacle spawning during enter+hold.
  // Sub-narrows do NOT go through applyStage3 -- they call flash3 directly -- so no guard needed.
  showTitleCard({
    title:    STAGES3[idx].name,
    subtitle: 'MILE ' + Math.floor(curMile3),
    holdMs:   TITLE_HOLD_MS,
    onComplete: function() {}
  });
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
  return 'orange'; // all collectibles are now oranges; old stage collA/collB kept in STAGES3 for reference
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
  else if (actualType === 'river_wash')   yPos = 0.16;  // flat on water (water Y=0.15, +0.01 clears depth)
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

  // Stage 5 cinematic deceleration: cosine ease from ENDING_DECEL_START down to ~0
  if (stageIdx === 4 && curMile3 >= ENDING_DECEL_START) {
    var _edT = Math.min(1, (curMile3 - ENDING_DECEL_START) / (ENDING_STOP_MILE - ENDING_DECEL_START));
    endingSpeedMult = (1 + Math.cos(_edT * Math.PI)) / 2;
    if (endingSpeedMult < ENDING_STOP_THRESH) {
      endingSpeedMult = 0;
      curSpd3 = 0;
      if (gameState3 === 'playing') {
        if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
        gameState3 = 'beaching';
        endingBeachStartMs   = Date.now();
        endingCinematicFired = false;
        document.getElementById('hud3').classList.remove('visible');
      }
      return;
    }
  }

  const effectiveSpeed = curSpeed3 * endingSpeedMult;
  distance3 += effectiveSpeed;
  score3    += (effectiveSpeed / MI_PER_PX) * 100 * (_reversed ? 2 : 1); // 100 pts/mile; 2x while reversed
  curMile3   = Math.floor(distance3 / MI_PER_PX);

  if (curMile3 >= 165) { startEnding3(); return; }

  // Stage advance
  const stg = STAGES3[stageIdx];
  if (curMile3 >= stg.endMile && stageIdx < STAGES3.length - 1) {
    applyStage3(stageIdx + 1, 'ENTERING ' + STAGES3[stageIdx + 1].name); return;
  }
  // Stage-5 sub-narrows: trigger the animated squeeze (no buildWorld)
  if (stageIdx === 4 && stg.subNarrow && !narrowing) {
    for (const sn of stg.subNarrow) {
      if (curMile3 >= sn.atMile && !subsFired3.has(sn.atMile)) {
        subsFired3.add(sn.atMile);
        narrowing        = true;
        narrowStartMile  = curMile3;
        narrowFromRw     = rwCur;
        narrowToRw       = sn.lanes * LANE_W;
        narrowToLanes    = sn.lanes;
        narrowToObsFreq  = sn.obsFreq;
        narrowFromLanes  = curLanes;
        flash3(sn.msg, 150);
      }
    }
  }

  // Animated narrow: lerp rwCur, apply river geometry, merge dividers
  if (narrowing) {
    var _nt = Math.min(1, (curMile3 - narrowStartMile) / NARROW_MILES);
    var _ne = (1 - Math.cos(_nt * Math.PI)) / 2;
    rwCur = narrowFromRw + (narrowToRw - narrowFromRw) * _ne;
    applyRiverWidth();  // water + bank segs; divider block skipped while narrowing
    // Divider position and opacity -- handled explicitly here
    var _nFrLw = narrowFromRw / narrowFromLanes;
    for (var _ndi = 0; _ndi < laneDivs3.length; _ndi++) {
      var _nd   = laneDivs3[_ndi];
      var _xS   = -narrowFromRw / 2 + _nd.idx * _nFrLw;
      var _xT, _hasCP;
      if (narrowToLanes <= 1) {
        // 2->1: single divider stays at 0, just fades
        _xT = _xS;
        _hasCP = false;
      } else {
        _hasCP = (_nd.idx < narrowToLanes);
        var _nToLw = narrowToRw / narrowToLanes;
        // counterpart lerps to its exact new position; orphan converges on the nearest boundary
        _xT = -narrowToRw / 2 + Math.min(_nd.idx, narrowToLanes - 1) * _nToLw;
      }
      _nd.line.position.x        = _xS + (_xT - _xS) * _ne;
      _nd.line.material.opacity  = _hasCP ? 0.22 : 0.22 * (1 - _ne);
    }
    if (_nt >= 1) {
      // Width arrived -- commit lane count, remap player, swap dividers
      var _prevLanes = narrowFromLanes;
      curLanes    = narrowToLanes;
      curObsFreq3 = narrowToObsFreq;
      // Preserve normalised position across the channel
      var _pNorm = (_prevLanes > 1) ? (player3.targetLane / (_prevLanes - 1)) : 0;
      player3.targetLane = Math.round(_pNorm * Math.max(curLanes - 1, 0));
      player3.targetLane = Math.max(0, Math.min(curLanes - 1, player3.targetLane));
      if (player3.lane > curLanes - 1) player3.lane = curLanes - 1;
      rebuildDividers3();  // invisible: dividers are already at their final positions
      narrowing = false;
    }
  }

  if (player3.spinoutFrames > 0) player3.spinoutFrames--;

  // Player X: classic snap-to-lane or daring free steer
  if (playMode3 === 'daring') {
    // Apply accel from held keys (suppressed during spinout and during jump — jump uses airYaw).
    if (player3.spinoutFrames <= 0 && !player3.isJumping) {
      if (_reversed) {
        if (_daringSteerL) _daringVx += DARING_ACCEL;
        if (_daringSteerR) _daringVx -= DARING_ACCEL;
      } else {
        if (_daringSteerL) _daringVx -= DARING_ACCEL;
        if (_daringSteerR) _daringVx += DARING_ACCEL;
      }
    }
    if (!player3.isJumping) _daringVx *= DARING_FRICTION;  // coast in the air
    if (Math.abs(_daringVx) < 0.0005) _daringVx = 0;
    player3.x += _daringVx;
    // Clamp to river (tracks rwCur narrowing automatically)
    var _halfRiv = rwCur / 2 - KAYAK_HALF_W;
    player3.x = Math.max(-_halfRiv, Math.min(_halfRiv, player3.x));
    // Bridge: set targetLane = nearest lane so checkCollisions3 keeps working unchanged
    var _lw3 = rwCur / curLanes;
    var _nearL = Math.round(player3.x / _lw3 + (curLanes - 1) / 2);
    player3.targetLane = Math.max(0, Math.min(curLanes - 1, _nearL));
  } else {
    // Classic: smooth slide toward target lane
    const tx = laneXPos(player3.targetLane);
    player3.x += (tx - player3.x) * 0.28;
    if (Math.abs(player3.x - tx) < 0.02) player3.x = tx;
  }

  // Jump arc
  if (player3.isJumping) {
    // Air-spin: DARING only — held steer keys spin the boat instead of steering X.
    if (gameState3 === 'playing' && playMode3 === 'daring') {
      if (_daringSteerL) _airYaw -= AIR_YAW_RATE;
      if (_daringSteerR) _airYaw += AIR_YAW_RATE;
    }
    player3.jumpFrame++;
    if (player3.jumpFrame >= JUMP_DURATION) {
      player3.isJumping = false; player3.jumpFrame = 0; _airTrick = false;
      _sfxPlay('splash');
      if (playMode3 === 'daring') {
        // Spin bonus: award points for total degrees spun this jump
        var _spinDeg = Math.abs(_airYaw) * (180 / Math.PI);
        if (_spinDeg >= SPIN_MIN_DEG) {
          var _spinPts = Math.round(_spinDeg * SPIN_PTS_DEG) * (_reversed ? 2 : 1);
          score3 += _spinPts;
          _spawnScorePopup3(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z,
                            '+' + _spinPts + ' SPIN!' + (_reversed ? ' ×2' : ''));
        }
        // Nearest-facing snap: normalize the boat's actual visual angle to (-PI, PI],
        // then pick forward/backward based on which it's closer to.
        _settleYawFrom = _baseFacingY + _airYaw;  // visual angle on the last air frame
        _settleYawT    = 0;                        // kick off the eased settle
        var _finalFacing = _settleYawFrom % (Math.PI * 2);
        if (_finalFacing >  Math.PI)  _finalFacing -= Math.PI * 2;
        if (_finalFacing <= -Math.PI) _finalFacing += Math.PI * 2;
        if (Math.abs(_finalFacing) <= Math.PI / 2) {
          _reversed = false; _baseFacingY = 0;        // closer to forward
        } else {
          _reversed = true;  _baseFacingY = Math.PI;  // closer to backward
        }
      }
      _airYaw = 0;
      kayakTurnY3 = 0; kayakTurnVel3 = 0;
      _daringRoll3 = 0; _daringRollVel3 = 0;
    }
  }

  // Spawn (obstacle spawns suppressed during animated narrow; collectibles continue)
  gapFrames3++;
  const minF = Math.ceil(MIN_GAP / curSpeed3);
  if (!narrowing && !_titleCardSuppressSpawn && curMile3 < OBS_CUTOFF_MILE && gapFrames3 >= minF && Math.random() < curObsFreq3 * endingSpeedMult) { spawnObs3(); gapFrames3 = 0; }
  if (Math.random() < COLL_FREQ) spawnColl3();

  // Move items
  const spd = effectiveSpeed * SPD_SCALE;
  curSpd3 = spd;
  applyRiverWidth();

  for (const o of obstacles3) {
    o.z += spd; o.mesh.position.z = o.z;
    // Per-frame x from lane so future rwCur changes reflow obstacles automatically
    if (o.fullWidth) {
      o.mesh.position.x = 0;
    } else if (o.lane2 !== undefined) {
      o.mesh.position.x = (laneXPos(o.lane) + laneXPos(o.lane2)) / 2;
    } else if (o.type === 'fallen_log') {
      o.mesh.position.x = o.gapLane === 0
        ? (laneXPos(1) + laneXPos(curLanes - 1)) / 2
        : (laneXPos(0) + laneXPos(curLanes - 2)) / 2;
    } else {
      o.mesh.position.x = laneXPos(o.lane);
    }
    if (o.type === 'river_wash') { o.mesh.rotation.y += RW_SPIN_SPEED; }
  }
  obstacles3 = obstacles3.filter(o => {
    if (o.z > DESPAWN_Z) { disposeMesh(o.mesh); scene.remove(o.mesh); return false; }
    return true;
  });

  for (const c of collectibles3) {
    if (c.collected) continue; // in-flight or just collected; skip position update
    c.z += spd * COLL_DRIFT; c.mesh.position.z = c.z;
    c.mesh.position.x = laneXPos(c.lane);
    c.mesh.position.y = c.baseY + Math.sin(frameN * 0.11 + c.lane * 1.3) * 0.14;
    c.mesh.rotation.y += 0.028;  // gentle rotation
  }
  collectibles3 = collectibles3.filter(c => {
    if (c._inFlight) { return false; } // mesh handed off to _orangeFlights; no disposal
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

  // Scroll bank segment meshes at world speed, same clock as trees (no UV offset)
  for (var bsi3 = 0; bsi3 < bankSegs3.length; bsi3++) {
    var _bs3 = bankSegs3[bsi3];
    _bs3.z += spd;
    if (_bs3.z > DESPAWN_Z + BK_SEG_Z / 2) {
      _bs3.z -= BK_SEG_N * BK_SEG_Z;
      var _newSegW = BANK_W0 + BANK_AMP * Math.sin(_bs3.z * BANK_FREQ + _bs3.bkPhase);
      if (_newSegW < 2.2) _newSegW = 2.2;
      if (Math.abs(_newSegW - _bs3.segW) > 0.05) {
        _bs3.mesh.geometry.dispose();
        _bs3.mesh.geometry = new THREE.BoxGeometry(_newSegW, 0.60, BK_SEG_Z + 0.25);
        _bs3.segW = _newSegW;
      }
      // Always update repeat so texel density stays constant at the new segW
      if (_bs3.mesh.material && _bs3.mesh.material.map) {
        _bs3.mesh.material.map.repeat.set(_bs3.segW / GROUND_TEX_WORLD, (BK_SEG_Z + 0.25) / GROUND_TEX_WORLD);
        _bs3.mesh.material.map.needsUpdate = true;
      }
      _bs3.mesh.position.x = _bs3.side * (rwCur / 2 + SHORE_W + _bs3.segW / 2);
    }
    _bs3.mesh.position.z = _bs3.z;
    if (_bs3.apron) _bs3.apron.position.z = _bs3.z;
  }

  // Ground chain: same clock as bank segs — no UV scroll
  for (var gci3 = 0; gci3 < groundChain3.length; gci3++) {
    var _gc3 = groundChain3[gci3];
    _gc3.z += spd;
    if (_gc3.z > DESPAWN_Z + BK_SEG_Z / 2) {
      _gc3.z -= BK_SEG_N * BK_SEG_Z;
    }
    _gc3.mesh.position.z = _gc3.z;
  }

  // Stage 4 canyon fill: z-scroll segments like bank segs, no UV animation
  for (var cfs_i = 0; cfs_i < canyonFillSegs4.length; cfs_i++) {
    var _cfs = canyonFillSegs4[cfs_i];
    _cfs.z += spd;
    if (_cfs.z > DESPAWN_Z + BK_SEG_Z / 2) {
      _cfs.z -= BK_SEG_N * BK_SEG_Z;
    }
    _cfs.mesh.position.z = _cfs.z;
  }

  // Scroll bank tree sprites; recycle past-camera trees with new random params
  for (var bti = 0; bti < bankTrees3.length; bti++) {
    var bt3 = bankTrees3[bti];
    bt3.z += spd;
    bt3.sprite.position.z = bt3.z;
    bt3.sprite.position.x = bt3.side * (rwCur / 2 + SHORE_W + bt3.xOff);
    bt3.sprite.position.y = DECOR_SEAT_GND;
    if (bt3.z > DESPAWN_Z + 2) {
      bt3.z = SPAWN_Z - Math.random() * 8;
      var v3    = Math.floor(Math.random() * 4);
      if (stageIdx === 0 || stageIdx === 2) bt3.xOff = FLAT_XOFF_MIN + FLAT_XOFF_RANGE * Math.pow(Math.random(), TREE_XOFF_BIAS);
      else if (stageIdx === 4) bt3.xOff = S5_XOFF_MIN + S5_XOFF_RANGE * Math.pow(Math.random(), TREE_XOFF_BIAS);
      else bt3.xOff = 1.4 + Math.floor(Math.random() * 4) * 1.8;
      bt3.sprite.position.x = bt3.side * (rwCur / 2 + SHORE_W + bt3.xOff);
      bt3.sprite.position.z = bt3.z;
      var h3 = makeBankTreeHeight(v3);
      bt3.sprite.scale.set(h3 * 0.72, h3, 1);
      if (treeTex[v3]) {
        bt3.sprite.material.map = treeTex[v3];
        bt3.sprite.material.needsUpdate = true;
        bt3.sprite.center.set(0.5, _effectivePadFrac(treeTex[v3]._padFrac || 0));
      }
    }
  }

  // Scroll billboard sprites: rare gap-based recycle, cycle texture to avoid back-to-back repeats
  for (var bbbd = 0; bbbd < bankBillboards3.length; bbbd++) {
    var bbd = bankBillboards3[bbbd];
    bbd.z += spd;
    bbd.sprite.position.z = bbd.z;
    bbd.sprite.position.x = bbd.side * (rwCur / 2 + SHORE_W + bbd.xOff);
    bbd.sprite.position.y = DECOR_SEAT_GND;
    if (bbd.z > DESPAWN_Z + 2) {
      // Choose next texture index, skipping the last used to avoid repeats
      var _nIdx = (bbd.texIdx + 1) % 3;
      if (_nIdx === _lastBillboardIdx) _nIdx = (_nIdx + 1) % 3;
      _lastBillboardIdx = _nIdx;
      bbd.texIdx = _nIdx;
      var _bbH  = BILLBOARD_SCALE;
      var _bbAR = billboardNatAR[_nIdx];
      bbd.sprite.scale.set(_bbH * _bbAR, _bbH, 1);
      if (billboardTex[_nIdx]) {
        bbd.sprite.material.map = billboardTex[_nIdx];
        bbd.sprite.material.needsUpdate = true;
        bbd.sprite.center.set(0.5, _effectivePadFrac(billboardTex[_nIdx]._padFrac || 0));
      }
      bbd.xOff  = 2.5 + Math.random() * 2.0;
      bbd.side  = (Math.random() < 0.5) ? -1 : 1;
      var _bbGap = BILLBOARD_GAP_MIN + Math.random() * BILLBOARD_GAP_RANGE;
      bbd.z     = SPAWN_Z - _bbGap;
      bbd.sprite.position.set(bbd.side * (rwCur / 2 + SHORE_W + bbd.xOff), DECOR_SEAT_GND, bbd.z);
      var _bbNow = Date.now();
      var _bbCadence = _lastBillboardDespawnT > 0 ? ((_bbNow - _lastBillboardDespawnT) / 1000).toFixed(1) + 's' : 'first';
      _lastBillboardDespawnT = _bbNow;
      var _bbNextSec = spd > 0 ? (_bbGap / (spd * 60)).toFixed(1) : '?';
      console.log('[KRR BILLBOARD] cadence=' + _bbCadence + ' gap=' + _bbGap.toFixed(0) + 'wu spd=' + (spd * 60).toFixed(2) + 'wu/s next-this-sprite=~' + _bbNextSec + 's');
    }
  }

  // Scroll bank boulder sprites (stages 2-4); recycle with new random size + texture
  for (var bbi = 0; bbi < bankBoulders3.length; bbi++) {
    var bb3 = bankBoulders3[bbi];
    bb3.z += spd;
    bb3.sprite.position.z = bb3.z;
    var _bbSW = (bb3.shoreW !== undefined) ? bb3.shoreW : SHORE_W;
    bb3.sprite.position.x = bb3.side * (rwCur / 2 + _bbSW + bb3.xOff);
    if (stageIdx !== 1) bb3.sprite.position.y = DECOR_SEAT_GND; // stage 2 boulders have intentional negative Y (submerged); leave those alone
    if (bb3.z > DESPAWN_Z + 2) {
      bb3.z = SPAWN_Z - Math.random() * 8;
      var bbTexIdx = Math.floor(Math.random() * bankBoulderTex.length);
      var bbXOff, bbH, bbW;
      if (stageIdx === 1) {
        var bbFlip = Math.random() < 0.5 ? -1 : 1;
        if (bb3.spread === 'perimeter') {
          bbXOff = Math.random() * 1.0;
          bbH    = 2.2 + Math.random() * 2.4;
          bbW    = bbH * (0.75 + Math.random() * 0.85);
          bb3.sprite.scale.set(bbW * bbFlip, bbH, 1);
          bb3.sprite.position.y = -0.5 - Math.random() * 0.7;
        } else {
          bbXOff = 1.3 + Math.random() * 11.5;
          bbH    = 0.8 + Math.random() * 3.0;
          bbW    = bbH * (0.75 + Math.random() * 0.85);
          bb3.sprite.scale.set(bbW * bbFlip, bbH, 1);
          bb3.sprite.position.y = -0.15 - Math.random() * 1.1;
        }
      } else {
        // Stages 3-4: wide spread on stage 3, narrow stepped on stage 4
        if (stageIdx === 2) bbXOff = FLAT_XOFF_MIN + Math.random() * FLAT_XOFF_RANGE;
        else bbXOff = 1.0 + Math.floor(Math.random() * 4) * 1.6 + 0.3;
        bbH    = 1.2 + Math.random() * 1.6;
        bbW    = bbH * (0.85 + Math.random() * 0.70);
        bb3.sprite.scale.set(bbW, bbH, 1);
      }
      bb3.xOff = bbXOff;
      bb3.sprite.position.x = bb3.side * (rwCur / 2 + _bbSW + bb3.xOff);
      bb3.sprite.position.z = bb3.z;
      if (bankBoulderTex[bbTexIdx]) {
        bb3.sprite.material.map = bankBoulderTex[bbTexIdx];
        bb3.sprite.material.needsUpdate = true;
      }
    }
  }

  // Scroll bank poppy sprites; recycle with rarity gap and random side
  for (var ppi = 0; ppi < bankPoppies3.length; ppi++) {
    var pp3 = bankPoppies3[ppi];
    pp3.z += spd;
    if (pp3.z > DESPAWN_Z + 2) {
      // Recycle: pick new side, reset all state, restore rest texture and glow
      pp3.picked      = false;
      pp3.claimed     = false;
      pp3.glowFlareSt = 0;
      pp3.recoilSt    = 0;
      pp3.side   = (Math.random() < 0.5) ? -1 : 1;
      pp3.tuftU  = pp3.side === -1 ? 0.16 : 0.81;
      pp3.bloomU = pp3.side === -1 ? 0.80 : 0.19;
      pp3.z      = SPAWN_Z - (POPPY_GAP_MIN + Math.random() * POPPY_GAP_RANGE);
      pp3.sprite.renderOrder = 5;
      pp3.sprite.center.set(0.5, 0);
      pp3.sprite.scale.set(POPPY_W, 0.7305 * POPPY_W, 1);
      pp3.sprite.material.rotation = 0;
      var ppRestTex = pp3.side === -1 ? _poppyTexL : _poppyTexR;
      if (ppRestTex) { pp3.sprite.material.map = ppRestTex; pp3.sprite.material.needsUpdate = true; }
      if (pp3.glow) { pp3.glow.renderOrder = 4; pp3.glow.material.opacity = 0.40; pp3.glow.scale.setScalar(POPPY_GLOW_SCALE * POPPY_W); }
    }
    // Position sprite: place center(0.5,0) so tuft anchor lands at tuftX
    var _ppTX = pp3.side * (rwCur / 2 + POPPY_BANK_OFF);
    // Sway: unpicked poppies sway on slow sine with per-poppy phase offset
    if (!pp3.picked) {
      pp3.sprite.material.rotation = POPPY_SWAY_AMP * Math.sin(frameN * POPPY_SWAY_SPD + pp3.swayPhase);
    }
    // Recoil: springy wobble on picked stem after bloom detaches (~300ms, 3 oscillations)
    if (pp3.recoilSt > 0) {
      var _rcT = Math.min(1, (Date.now() - pp3.recoilSt) / 300);
      pp3.sprite.material.rotation = pp3.recoilDir * 0.22 * Math.sin(_rcT * Math.PI * 3) * (1 - _rcT);
      if (_rcT >= 1) { pp3.recoilSt = 0; pp3.sprite.material.rotation = 0; }
    }
    pp3.sprite.position.set(_ppTX + (0.5 - pp3.tuftU) * POPPY_W, POPPY_SEAT_Y, pp3.z);
    // Glow: pulse when live; flare burst on pickup; hidden once flare ends
    if (pp3.glow) {
      if (pp3.picked && pp3.glowFlareSt > 0) {
        var _ft = Math.min(1, (Date.now() - pp3.glowFlareSt) / 300);
        var _fSc = (POPPY_GLOW_SCALE + (2.0 - POPPY_GLOW_SCALE) * Math.sin(_ft * Math.PI)) * POPPY_W;
        pp3.glow.scale.setScalar(_fSc);
        pp3.glow.material.opacity = 0.9 * Math.sin(_ft * Math.PI);
        pp3.glow.position.z = pp3.z;
        if (_ft >= 1) { pp3.glow.material.opacity = 0; pp3.glowFlareSt = 0; }
      } else if (!pp3.picked) {
        var _ppBX = _ppTX + (pp3.bloomU - pp3.tuftU) * POPPY_W;
        // Bloom bobs slightly out of phase with stem sway (as if weight on end)
        var _ppBY = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W
                  + Math.sin(frameN * POPPY_SWAY_SPD * 1.3 + pp3.swayPhase + 0.7) * 0.05;
        pp3.glow.position.set(_ppBX, _ppBY, pp3.z);
        pp3.glow.scale.setScalar(POPPY_GLOW_SCALE * POPPY_W);
        pp3.glow.material.opacity = 0.40 + Math.sin(frameN * 0.07 + pp3.swayPhase) * 0.25;
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

  // Scroll Stage 4 shore pebbles; simple x-fixed scroll, re-roll dx + tex on recycle
  for (var ssi = 0; ssi < shoreScatter4.length; ssi++) {
    var ss = shoreScatter4[ssi];
    ss.z += spd;
    ss.sprite.position.z = ss.z;
    if (ss.z > DESPAWN_Z + 2) {
      ss.z = SPAWN_Z - Math.random() * 8;
      ss.dx = SHORE4_X_MIN + Math.random() * (SHORE4_X_MAX - SHORE4_X_MIN);
      ss.sprite.position.x = ss.side * (rwCur / 2 + ss.dx);
      ss.sprite.position.z = ss.z;
      var ssTexIdx = Math.floor(Math.random() * bankBoulderTex.length);
      if (bankBoulderTex[ssTexIdx]) {
        ss.sprite.material.map = bankBoulderTex[ssTexIdx];
        ss.sprite.material.needsUpdate = true;
      }
      ss.h   = SHORE4_SCALE_MIN + Math.random() * (SHORE4_SCALE_MAX - SHORE4_SCALE_MIN);
      ss.wf  = 0.75 + Math.random() * 0.70;
      ss.flipX = Math.random() < 0.5 ? 1 : -1;
      var ssTv = 0.72 + Math.random() * 0.28;
      ss.sprite.material.color.setRGB(ssTv, ssTv, ssTv);
      ss.sprite.scale.set(ss.h * ss.wf * ss.flipX, ss.h, 1);
    }
  }

  // Scroll cattail groups; each group's anchor advances, all members offset from it
  for (var _cgi = 0; _cgi < _cattailGroups.length; _cgi++) {
    var _cg = _cattailGroups[_cgi];
    _cg.z += spd;
    // Recycle entire group when its last member clears DESPAWN
    if (_cg.z + _cg.maxDz > DESPAWN_Z + 2) {
      _cg.z = SPAWN_Z - 5 - Math.random() * 18;
      // Re-roll cattail texture variants on each pass for variety
      for (var _cr = 0; _cr < _cg.members.length; _cr++) {
        var _crm = _cg.members[_cr];
        if (!_crm.isGrass) {
          _crm.varIdx = Math.floor(Math.random() * 2);
          var _crTex = cattailTex[_crm.varIdx];
          if (_crTex) {
            var _crH  = 0.85 + Math.random() * 0.85;
            var _crAR = _crTex.image && _crTex.image.naturalHeight > 0
              ? _crTex.image.naturalWidth / _crTex.image.naturalHeight : 0.38;
            _crm.sprite.scale.set(_crH * _crAR, _crH, 1);
            _crm.sprite.material.map = _crTex;
            _crm.sprite.material.needsUpdate = true;
          }
        }
      }
    }
    // Update every member's world position from group anchor
    for (var _cmi = 0; _cmi < _cg.members.length; _cmi++) {
      var _cmb = _cg.members[_cmi];
      _cmb.sprite.position.z = _cg.z + _cmb.dz;
      _cmb.sprite.position.x = _cg.side * (rwCur / 2 + _cmb.dx);
      _cmb.sprite.position.y = DECOR_SEAT_GND;
    }
  }

  // Scroll lake-house sprites (Stage 3 only); recycle with randomized x-offset and texture
  for (var hsi = 0; hsi < bankHouses3.length; hsi++) {
    var hse = bankHouses3[hsi];
    hse.z += spd;
    hse.sprite.position.z = hse.z;
    hse.sprite.position.x = hse.side * (rwCur / 2 + SHORE_W + hse.xOff);
    hse.sprite.position.y = DECOR_SEAT_GND;
    if (!_diagS3HouseDone && hse.z > -5 && hse.z < 5) {
      var _gcUnder = groundChain3.length ? groundChain3[0].mesh.position.y : 'no-chain';
      var _s3wp = new THREE.Vector3(); hse.sprite.getWorldPosition(_s3wp);
      console.log('[DIAG S3-HOUSE] sprite.position.y=' + hse.sprite.position.y.toFixed(4)
        + ' worldY=' + _s3wp.y.toFixed(4)
        + ' scale.y=' + hse.sprite.scale.y.toFixed(3)
        + ' groundChain[0].y=' + _gcUnder
        + ' x=' + hse.sprite.position.x.toFixed(2)
        + ' | if house floats, visible-base = pos.y + (padFrac * scale.y)');
      _diagS3HouseDone = true;
    }
    if (hse.z > DESPAWN_Z + 2) {
      hse.z = SPAWN_Z - Math.random() * 12;
      hse.xOff = FLAT_XOFF_MIN + Math.random() * FLAT_XOFF_RANGE;
      hse.sprite.position.x = hse.side * (rwCur / 2 + SHORE_W + hse.xOff);
      hse.sprite.position.z = hse.z;
      var hTexIdx = Math.floor(Math.random() * lakeHouseTex.length);
      hse.texIdx = hTexIdx;
      if (lakeHouseTex[hTexIdx]) {
        var _hrt = lakeHouseTex[hTexIdx];
        hse.sprite.material.map = _hrt;
        hse.sprite.material.needsUpdate = true;
        var hRecycleAsp = (_hrt.image && _hrt.image.naturalHeight > 0)
          ? _hrt.image.naturalWidth / _hrt.image.naturalHeight : 1.0;
        hse.sprite.scale.set(STAGE3_HOUSE_SCALE * hRecycleAsp, STAGE3_HOUSE_SCALE, 1);
        hse.sprite.center.set(0.5, _effectivePadFrac(_hrt._padFrac || 0));
      }
    }
  }

  // Stage 5 bank decor: scroll and recycle stumps, farm houses, fishing supplies, cars
  for (var st5i = 0; st5i < bankStumps5.length; st5i++) {
    var st5 = bankStumps5[st5i];
    st5.z += spd; st5.sprite.position.z = st5.z;
    st5.sprite.position.x = st5.side * (rwCur / 2 + SHORE_W + st5.xOff);
    st5.sprite.position.y = DECOR_SEAT_GND;
    if (st5.z > DESPAWN_Z + 2) {
      st5.z = SPAWN_Z - Math.random() * 8;
      st5.xOff = S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE;
      st5.sprite.position.x = st5.side * (rwCur / 2 + SHORE_W + st5.xOff);
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
    fm5.sprite.position.x = fm5.side * (rwCur / 2 + SHORE_W + fm5.xOff);
    fm5.sprite.position.y = DECOR_SEAT_GND;
    if (!_diagS5FarmDone && fm5.z > -5 && fm5.z < 5) {
      var _s5wp = new THREE.Vector3(); fm5.sprite.getWorldPosition(_s5wp);
      console.log('[DIAG S5-FARM] sprite.position.y=' + fm5.sprite.position.y.toFixed(4)
        + ' worldY=' + _s5wp.y.toFixed(4)
        + ' scale.y=' + fm5.sprite.scale.y.toFixed(3)
        + ' offset_applied=' + (DECOR_SEAT_GND - 3.21).toFixed(4)
        + ' groundChain[0].y=' + (groundChain3.length ? groundChain3[0].mesh.position.y : 'no-chain')
        + ' | visible-base=pos.y+(padFrac*' + fm5.sprite.scale.y.toFixed(2) + ')');
      _diagS5FarmDone = true;
    }
    if (fm5.z > DESPAWN_Z + 2) {
      fm5.z = SPAWN_Z - Math.random() * 12;
      fm5.xOff = S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE;
      fm5.sprite.position.x = fm5.side * (rwCur / 2 + SHORE_W + fm5.xOff);
      fm5.sprite.position.z = fm5.z;
      var fmTexI = Math.floor(Math.random() * 2);
      fm5.texIdx = fmTexI;
      var fmTex5 = farmTex5[fmTexI];
      if (fmTex5) {
        fm5.sprite.material.map = fmTex5; fm5.sprite.material.needsUpdate = true;
        var fmAsp = (fmTex5.image && fmTex5.image.naturalHeight > 0)
          ? fmTex5.image.naturalWidth / fmTex5.image.naturalHeight : 1.0;
        fm5.sprite.scale.set(S5_FARMHOUSE_SCALE * fmAsp, S5_FARMHOUSE_SCALE, 1);
        fm5.sprite.center.set(0.5, _effectivePadFrac(fmTex5._padFrac || 0));
      }
    }
  }
  for (var fs5i = 0; fs5i < bankFishing5.length; fs5i++) {
    var fs5 = bankFishing5[fs5i];
    fs5.z += spd; fs5.sprite.position.z = fs5.z;
    fs5.sprite.position.x = fs5.side * (rwCur / 2 + SHORE_W + fs5.xOff);
    fs5.sprite.position.y = DECOR_SEAT_GND;
    if (fs5.z > DESPAWN_Z + 2) {
      fs5.z = SPAWN_Z - Math.random() * 8;
      fs5.xOff = S5_XOFF_MIN + Math.random() * S5_XOFF_RANGE;
      fs5.sprite.position.x = fs5.side * (rwCur / 2 + SHORE_W + fs5.xOff);
      fs5.sprite.position.z = fs5.z;
      if (fishingTex5) {
        fs5.sprite.material.map = fishingTex5; fs5.sprite.material.needsUpdate = true;
        var fsAsp5 = (fishingTex5.image && fishingTex5.image.naturalHeight > 0)
          ? fishingTex5.image.naturalWidth / fishingTex5.image.naturalHeight : 1.0;
        fs5.sprite.scale.set(S5_FISHING_SCALE * fsAsp5, S5_FISHING_SCALE, 1);
      }
    }
  }
  for (var gt5i = 0; gt5i < bankGrassTufts5.length; gt5i++) {
    var gt5 = bankGrassTufts5[gt5i];
    gt5.z += spd; gt5.sprite.position.z = gt5.z;
    gt5.sprite.position.x = gt5.side * (rwCur / 2 + SHORE_W + gt5.xOff);
    gt5.sprite.position.y = DECOR_SEAT_GND;
    if (gt5.z > DESPAWN_Z + 2) {
      gt5.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts5.length);
      gt5.side = Math.random() < 0.5 ? -1 : 1;
      gt5.xOff = 0.5 + Math.random() * S5_GRASS_XBAND;
      gt5.scaleMult = 0.85 + Math.random() * 0.30;
      gt5.sprite.position.x = gt5.side * (rwCur / 2 + SHORE_W + gt5.xOff);
      gt5.sprite.position.z = gt5.z;
      if (grassTuftTex5) {
        gt5.sprite.material.map = grassTuftTex5; gt5.sprite.material.needsUpdate = true;
        gt5.sprite.scale.set(S5_GRASS_W * gt5.scaleMult, S5_GRASS_W * 0.621 * gt5.scaleMult, 1);
        gt5.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex5._padFrac || 0));
      }
    }
  }
  // Stage 1 far-ground grass: same scroll/recycle pattern as stage 5
  for (var gt1i = 0; gt1i < bankGrassTufts1.length; gt1i++) {
    var gt1 = bankGrassTufts1[gt1i];
    gt1.z += spd; gt1.sprite.position.z = gt1.z;
    gt1.sprite.position.x = gt1.side * (rwCur / 2 + SHORE_W + gt1.xOff);
    gt1.sprite.position.y = DECOR_SEAT_GND;
    if (gt1.z > DESPAWN_Z + 2) {
      gt1.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts1.length);
      gt1.side = Math.random() < 0.5 ? -1 : 1;
      gt1.xOff = 0.5 + Math.random() * S5_GRASS_XBAND;
      gt1.scaleMult = 0.85 + Math.random() * 0.30;
      gt1.sprite.position.x = gt1.side * (rwCur / 2 + SHORE_W + gt1.xOff);
      gt1.sprite.position.z = gt1.z;
      if (grassTuftTex1) {
        gt1.ar = grassTuftTex1._padFrac !== undefined
          ? grassTuftTex1.image.naturalHeight / grassTuftTex1.image.naturalWidth
          : gt1.ar;
        gt1.sprite.material.map = grassTuftTex1; gt1.sprite.material.needsUpdate = true;
        gt1.sprite.scale.set(S5_GRASS_W * gt1.scaleMult, S5_GRASS_W * (gt1.ar || 0.621) * gt1.scaleMult, 1);
        gt1.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex1._padFrac || 0));
      }
    }
  }
  // Stage 1 bank-top grass: tufts seated on raised bank surface (headwaters)
  for (var bt1i = 0; bt1i < bankGrassTufts1Top.length; bt1i++) {
    var bt1 = bankGrassTufts1Top[bt1i];
    bt1.z += spd; bt1.sprite.position.z = bt1.z;
    bt1.sprite.position.x = bt1.side * (rwCur / 2 + bt1.xOff);
    bt1.sprite.position.y = S5_BANK_SEAT_Y;
    if (bt1.z > DESPAWN_Z + 2) {
      bt1.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts1Top.length);
      bt1.side = Math.random() < 0.5 ? -1 : 1;
      bt1.xOff = SHORE_W + 0.15 + Math.random() * 3.2;
      bt1.scaleMult = 0.70 + Math.random() * 0.25;
      bt1.sprite.position.x = bt1.side * (rwCur / 2 + bt1.xOff);
      bt1.sprite.position.z = bt1.z;
      if (grassTuftTex1) {
        bt1.ar = grassTuftTex1._padFrac !== undefined
          ? grassTuftTex1.image.naturalHeight / grassTuftTex1.image.naturalWidth
          : bt1.ar;
        bt1.sprite.material.map = grassTuftTex1; bt1.sprite.material.needsUpdate = true;
        bt1.sprite.scale.set(S5_GRASS_W * bt1.scaleMult, S5_GRASS_W * (bt1.ar || 0.644) * bt1.scaleMult, 1);
        bt1.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex1._padFrac || 0));
      }
    }
  }
  // Stage 3 far-ground grass
  for (var gt3i = 0; gt3i < bankGrassTufts3.length; gt3i++) {
    var gt3 = bankGrassTufts3[gt3i];
    gt3.z += spd; gt3.sprite.position.z = gt3.z;
    gt3.sprite.position.x = gt3.side * (rwCur / 2 + SHORE_W + gt3.xOff);
    gt3.sprite.position.y = DECOR_SEAT_GND;
    if (gt3.z > DESPAWN_Z + 2) {
      gt3.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts3.length);
      gt3.side = Math.random() < 0.5 ? -1 : 1;
      gt3.xOff = 0.5 + Math.random() * S5_GRASS_XBAND;
      gt3.scaleMult = 0.85 + Math.random() * 0.30;
      gt3.sprite.position.x = gt3.side * (rwCur / 2 + SHORE_W + gt3.xOff);
      gt3.sprite.position.z = gt3.z;
      if (grassTuftTex3) {
        gt3.ar = grassTuftTex3._padFrac !== undefined
          ? grassTuftTex3.image.naturalHeight / grassTuftTex3.image.naturalWidth
          : gt3.ar;
        gt3.sprite.material.map = grassTuftTex3; gt3.sprite.material.needsUpdate = true;
        gt3.sprite.scale.set(S5_GRASS_W * gt3.scaleMult, S5_GRASS_W * (gt3.ar || 0.644) * gt3.scaleMult, 1);
        gt3.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex3._padFrac || 0));
      }
    }
  }
  // Stage 3 bank-top grass
  for (var bt3i = 0; bt3i < bankGrassTufts3Top.length; bt3i++) {
    var bt3 = bankGrassTufts3Top[bt3i];
    bt3.z += spd; bt3.sprite.position.z = bt3.z;
    bt3.sprite.position.x = bt3.side * (rwCur / 2 + bt3.xOff);
    bt3.sprite.position.y = S5_BANK_SEAT_Y;
    if (bt3.z > DESPAWN_Z + 2) {
      bt3.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts3Top.length);
      bt3.side = Math.random() < 0.5 ? -1 : 1;
      bt3.xOff = SHORE_W + 0.15 + Math.random() * 3.2;
      bt3.scaleMult = 0.70 + Math.random() * 0.25;
      bt3.sprite.position.x = bt3.side * (rwCur / 2 + bt3.xOff);
      bt3.sprite.position.z = bt3.z;
      if (grassTuftTex3) {
        bt3.ar = grassTuftTex3._padFrac !== undefined
          ? grassTuftTex3.image.naturalHeight / grassTuftTex3.image.naturalWidth
          : bt3.ar;
        bt3.sprite.material.map = grassTuftTex3; bt3.sprite.material.needsUpdate = true;
        bt3.sprite.scale.set(S5_GRASS_W * bt3.scaleMult, S5_GRASS_W * (bt3.ar || 0.644) * bt3.scaleMult, 1);
        bt3.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex3._padFrac || 0));
      }
    }
  }
  // Stage 5 bank-top grass: same pool pattern but seated on raised bank surface
  for (var bt5i = 0; bt5i < bankGrassTufts5Top.length; bt5i++) {
    var bt5 = bankGrassTufts5Top[bt5i];
    bt5.z += spd; bt5.sprite.position.z = bt5.z;
    bt5.sprite.position.x = bt5.side * (rwCur / 2 + bt5.xOff);
    bt5.sprite.position.y = S5_BANK_SEAT_Y;
    if (bt5.z > DESPAWN_Z + 2) {
      bt5.z = SPAWN_Z - Math.random() * (74 / bankGrassTufts5Top.length);
      bt5.side = Math.random() < 0.5 ? -1 : 1;
      bt5.xOff = SHORE_W + 0.15 + Math.random() * 3.2;
      bt5.scaleMult = 0.70 + Math.random() * 0.25;
      bt5.sprite.position.x = bt5.side * (rwCur / 2 + bt5.xOff);
      bt5.sprite.position.z = bt5.z;
      if (grassTuftTex5) {
        bt5.sprite.material.map = grassTuftTex5; bt5.sprite.material.needsUpdate = true;
        bt5.sprite.scale.set(S5_GRASS_W * bt5.scaleMult, S5_GRASS_W * 0.621 * bt5.scaleMult, 1);
        bt5.sprite.center.set(0.5, _effectivePadFrac(grassTuftTex5._padFrac || 0));
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

  updateWaterFX(spd);
  checkCollisions3();
  checkCollectibles3();
  checkBankPoppies3();
}

// ── COLLISION ─────────────────────────────────────────────────────
const COLL_FRONT = -1.5;
const COLL_BACK  =  1.5;

function checkCollisions3() {
  if (gameState3 !== 'playing') return;  // wipeout/gameover: no re-trigger
  for (const o of obstacles3) {
    if (o.resolved) continue;
    if (o.z < COLL_FRONT || o.z > COLL_BACK) continue;
    o.resolved = true;
    // ── DARING: true X-overlap collision (classic lane-index stays byte-for-byte below) ──
    if (playMode3 === 'daring') {
      var _px3c = player3.x;
      var _lw3c = rwCur / curLanes;
      var _hit3c = false;
      if (o.fullWidth) {
        _hit3c = !player3.isJumping;
      } else if (o.type === 'fallen_log') {
        if (!player3.isJumping) {
          _hit3c = Math.abs(_px3c - laneXPos(o.gapLane)) > _lw3c / 2 - KAYAK_HALF_W;
        }
      } else if (!player3.isJumping) {
        var _obc3c = (o.type === 'boulder_wide')
          ? (laneXPos(o.lane) + laneXPos(o.lane2)) / 2
          : laneXPos(o.lane);
        var _obh3c = (o.type === 'boulder_wide') ? _lw3c * 0.925
                   : (o.type === 'river_wash')   ? _lw3c * 0.60
                   : _lw3c * 0.45;
        _hit3c = Math.abs(_px3c - _obc3c) < KAYAK_HALF_W + _obh3c;
      }
      if (!_hit3c) continue;
    } else {
      // ── CLASSIC: original lane-index logic, untouched ──────────────────────
      // fallen_log: safe only in gapLane; instant wipeout on any blocked lane.
      if (o.type === 'fallen_log') {
        if (!player3.isJumping && player3.targetLane !== o.gapLane) {
          if (player3.hasShield) { player3.hasShield = false; continue; }
          // relX: which side of the log the player ran into
          triggerWipeout(0, laneXPos(player3.targetLane) - laneXPos(o.gapLane));
        }
        continue;
      }
      // lane2 is set on boulder_wide: hit if player is in lane OR lane2.
      const inHitLane = (o.lane === player3.targetLane) ||
                        (o.lane2 !== undefined && o.lane2 === player3.targetLane);
      const safe = player3.isJumping || (!o.fullWidth && !inHitLane);
      if (safe) continue;
    }
    // ── Shared consequences (reached by both modes on a confirmed hit) ────────
    if (player3.hasShield) { player3.hasShield = false; continue; }
    if (o.type === 'river_wash') {
      player3.spinoutFrames = Math.max(player3.spinoutFrames, 90);
      // Swell theft: knock a few oranges out of the box (score already banked)
      var _lost = Math.min(player3.oranges, SWELL_ORANGE_LOSS);
      if (_lost > 0) {
        player3.oranges -= _lost;
        // Fling from basket world position
        var _bkwp = new THREE.Vector3();
        if (_basketGroup) { _basketGroup.getWorldPosition(_bkwp); }
        else { _bkwp.set(player3.x, 0.28, playerGroup.position.z + 0.82); }
        for (var _lfi = 0; _lfi < _lost; _lfi++) {
          var _omsh = new THREE.Mesh(
            new THREE.SphereGeometry(0.10, 6, 5),
            new THREE.MeshBasicMaterial({ color: 0xF97316, transparent: true, opacity: 1 })
          );
          _omsh.position.set(
            _bkwp.x + (Math.random() - 0.5) * 0.30,
            _bkwp.y + 0.08 + Math.random() * 0.12,
            _bkwp.z + (Math.random() - 0.5) * 0.30
          );
          scene.add(_omsh);
          _swellOrangeSprites.push({
            mesh: _omsh,
            vx: (Math.random() - 0.5) * 0.07,
            vy: 0.05 + Math.random() * 0.04,
            vz: 0.06 + Math.random() * 0.04,
            rotSpd: (Math.random() - 0.5) * 0.25,
            startT: Date.now()
          });
        }
      }
      // DARING only: swell spins you around — flip facing direction
      if (playMode3 === 'daring') {
        _reversed    = !_reversed;
        _baseFacingY = _reversed ? Math.PI : 0;
        // Let the spinout animation drive the visible spin; settle will land on new facing
        _settleYawT = 1.0;  // cancel any prior settle so spinout decay takes over cleanly
      }
    } else {
      // Compute obstacle center X for context-aware wipeout direction/variant
      var _hitObsX;
      if (o.fullWidth) {
        _hitObsX = player3.x;         // full-width: centered hit → relX ≈ 0
      } else if (o.lane2 !== undefined) {
        _hitObsX = (laneXPos(o.lane) + laneXPos(o.lane2)) / 2;
      } else {
        _hitObsX = laneXPos(o.lane);
      }
      var _hitPx = (playMode3 === 'daring') ? player3.x : laneXPos(player3.targetLane);
      var _hitLv = (playMode3 === 'daring') ? _daringVx : 0;
      triggerWipeout(_hitLv, _hitPx - _hitObsX);
    }
  }
}

function _spawnScorePopup3(wx, wy, wz, text) {
  var _cv = document.createElement('canvas');
  var _cvH = 80;
  var _font = POPUP_FONT_PX + 'px "Press Start 2P", monospace';
  // Measure text width before committing canvas size to avoid clipping.
  _cv.width = 512; _cv.height = _cvH;  // scratch size just for measureText
  var _ctx = _cv.getContext('2d');
  _ctx.font = _font;
  var _pad = Math.round(POPUP_FONT_PX * 1.0);
  var _cvW = Math.ceil(_ctx.measureText(text).width) + _pad * 2;
  _cvW = Math.max(_cvW, 64);           // minimum width
  _cv.width = _cvW;                    // resize to exact fit; clears canvas
  _ctx.font = _font;                   // re-apply after resize (canvas reset)
  _ctx.lineJoin = 'round';
  _ctx.lineWidth = Math.round(POPUP_FONT_PX * 0.25);
  _ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  _ctx.textAlign = 'center';
  _ctx.textBaseline = 'middle';
  _ctx.strokeText(text, _cvW / 2, _cvH / 2);
  _ctx.fillStyle = '#F97316';
  _ctx.fillText(text, _cvW / 2, _cvH / 2);
  var _tex = new THREE.CanvasTexture(_cv);
  var _mat = new THREE.SpriteMaterial({ map: _tex, transparent: true, depthTest: false });
  var _spr = new THREE.Sprite(_mat);
  var _bh = POPUP_FONT_PX * 0.022;    // world height; 32px -> 0.70
  var _bw = _bh * (_cvW / _cvH);      // AR from actual canvas size
  // stacking: bump spawn Y up if another active popup is within 0.45 world units
  var _spawnY = wy + 0.3;
  for (var _sc = 0; _sc < _scorePopups.length; _sc++) {
    if (Math.abs(_scorePopups[_sc].spr.position.y - _spawnY) < 0.45) _spawnY += 0.45;
  }
  _spr.scale.set(_bw * 1.3, _bh * 1.3, 1); // start punched out at 1.3x
  _spr.position.set(wx, _spawnY, wz);
  _spr.renderOrder = 20;
  scene.add(_spr);
  _scorePopups.push({ spr: _spr, tex: _tex, startY: _spawnY, startT: Date.now(), bw: _bw, bh: _bh });
}

function checkCollectibles3() {
  for (const c of collectibles3) {
    if (c.collected) continue;
    if (c.z < COLL_FRONT || c.z > COLL_BACK) continue;
    if (playMode3 === 'daring') {
      if (Math.abs(player3.x - c.mesh.position.x) >= KAYAK_HALF_W + 0.25) continue;
    } else {
      if (c.lane !== player3.targetLane) continue;
    }
    c.collected = true;
    c._inFlight = true;
    _sfxPlay('collect');
    var _ov = ORANGE_VALUE[stageIdx] !== undefined ? ORANGE_VALUE[stageIdx] : 100;
    if (c.mesh) {
      var _px = c.mesh.position.x, _py = c.mesh.position.y, _pz = c.mesh.position.z;
      _orangeFlights.push({ mesh: c.mesh, sx: _px, sy: _py, sz: _pz, px: _px, py: _py, pz: _pz, value: _ov, startT: Date.now() });
    }
  }
}

function checkBankPoppies3() {
  // CONTACT: fires once when elapsed >= POPPY_REACH_MS
  if (_poppyPickSt > 0 && _poppyPickPp && !_poppyContactFired) {
    if ((Date.now() - _poppyPickSt) >= POPPY_REACH_MS) {
      _poppyContactFired = true;
      var _ppA = _poppyPickPp;
      _ppA.picked = true;
      // Replace existing hat poppy if player already has shield (will re-seat new one)
      if (_hatPoppySpr) { _hatPoppySpr.visible = false; }
      player3.hasShield = true;
      _sfxPlay('shield');
      // Swap to picked texture
      var _ptex = _ppA.side === -1 ? _poppyTexLP : _poppyTexRP;
      if (_ptex) { _ppA.sprite.material.map = _ptex; _ppA.sprite.material.needsUpdate = true; }
      // Stem recoil: springy wobble as if weight was pulled off
      _ppA.recoilSt  = Date.now();
      _ppA.recoilDir = -_ppA.side; // recoils toward water
      // Capture bloom world position for travelling sprite
      var _bTX = _ppA.side * (rwCur / 2 + POPPY_BANK_OFF);
      var _bxC = _bTX + (_ppA.bloomU - _ppA.tuftU) * POPPY_W;
      var _byC = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W;
      _poppyBloomCPos.x = _bxC;
      _poppyBloomCPos.y = _byC;
      _poppyBloomCPos.z = _ppA.z;
      // Create travelling bloom sprite
      var _btex = _ppA.side === -1 ? _poppyTexLB : _poppyTexRB;
      if (_btex) {
        var _bMat = new THREE.SpriteMaterial({ map: _btex, transparent: true, opacity: 1, depthWrite: false });
        _poppyBloomSpr = new THREE.Sprite(_bMat);
        _poppyBloomSpr.renderOrder = 6;
        _poppyBloomSpr.center.set(0.5, 0);
        var _bSc = POPPY_PICK_SIZE;
        _poppyBloomSpr.scale.set(_bSc, 0.53 * _bSc, 1);
        _poppyBloomSpr.position.set(_bxC, _byC, _ppA.z);
        scene.add(_poppyBloomSpr);
      }
      // Glow flare burst
      _ppA.glowFlareSt = Date.now();
    }
  }

  // Reach detection: player enters edge lane while poppy is in approach window
  if (_poppyPickSt > 0) return; // already picking one
  for (var _bpi = 0; _bpi < bankPoppies3.length; _bpi++) {
    var _pp = bankPoppies3[_bpi];
    if (_pp.picked || _pp.claimed) continue;
    if (_pp.z < POPPY_REACH_Z) continue;
    if (_pp.z > COLL_BACK) continue;
    var _edgeLane = _pp.side === -1 ? 0 : curLanes - 1;
    if (player3.targetLane !== _edgeLane) continue;
    _pp.claimed        = true;
    _poppyPickSide     = _pp.side;
    _poppyPickSt       = Date.now();
    _poppyPickPp       = _pp;
    _poppyContactFired = false;
    break;
  }
}

// Re-apply TORSO_HINGE_Y/Z after a tuner change; called live so the model stays in place.
function _applyTorsoHinge() {
  if (!glbTorsoGroup) return;
  glbTorsoGroup.position.set(0, TORSO_HINGE_Y, TORSO_HINGE_Z);
  // Re-offset all direct mesh children (torso/head/hat; not arm groups or paddle group)
  _ubNodes.forEach(function(n) { n.position.set(0, -TORSO_HINGE_Y, -TORSO_HINGE_Z); });
  // Paddle group: position in waist-local = pivot_model - waist_pivot
  if (glbPaddleGroup) glbPaddleGroup.position.set(_paddlePivot.x, _paddlePivot.y - TORSO_HINGE_Y, _paddlePivot.z - TORSO_HINGE_Z);
  // Arm groups: position in waist-local = shoulder_model - waist_pivot
  if (glbArmRGroup) glbArmRGroup.position.set( ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
  if (glbArmLGroup) glbArmLGroup.position.set(-ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
  if (_hatPoppySpr && _hatPoppySpr.parent === glbTorsoGroup) {
    _hatPoppySpr.position.set(POPPY_HAT_MX, POPPY_HAT_MY - TORSO_HINGE_Y, POPPY_HAT_MZ - TORSO_HINGE_Z);
  }
  console.log('[KRR HINGE] Y=' + TORSO_HINGE_Y.toFixed(3) + ' Z=' + TORSO_HINGE_Z.toFixed(3) +
    ' world_y~' + (TORSO_HINGE_Y * KAYAKER_SCALE).toFixed(3));
}

function _applyArmHinge() {
  // Arm groups live INSIDE the waist group; their position is shoulder_model - waist_pivot
  if (glbArmRGroup && glbArmRNode) {
    glbArmRGroup.position.set( ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
    glbArmRNode.position.set(-ARM_R_HINGE_X, -ARM_HINGE_Y, -ARM_HINGE_Z);
  }
  if (glbArmLGroup && glbArmLNode) {
    glbArmLGroup.position.set(-ARM_R_HINGE_X, ARM_HINGE_Y - TORSO_HINGE_Y, ARM_HINGE_Z - TORSO_HINGE_Z);
    glbArmLNode.position.set( ARM_R_HINGE_X, -ARM_HINGE_Y, -ARM_HINGE_Z);
  }
  console.log('[KRR ARM HINGE] X=' + ARM_R_HINGE_X.toFixed(3) + ' Y=' + ARM_HINGE_Y.toFixed(3) + ' Z=' + ARM_HINGE_Z.toFixed(3));
}

// Create (or re-seat) the hat poppy sprite.
// Uses poppy-hat.png (256x317, stem-tip anchor at bottom).
// Parented to glbTorsoGroup so it leans with the full upper body.
function _ensureHatPoppy3(side) {
  var _useGroup = !!glbTorsoGroup;
  var _hatParent = _useGroup ? glbTorsoGroup : scene;
  if (!_hatPoppySpr) {
    var _hm = new THREE.SpriteMaterial({
      map: _hatFlowerTex || null,
      transparent: true, opacity: 1, depthWrite: false
    });
    _hatPoppySpr = new THREE.Sprite(_hm);
    _hatPoppySpr.renderOrder = 6;
    _hatPoppySpr.center.set(0.41, 0.0); // stem tip anchors the placement point
    _hatParent.add(_hatPoppySpr);
  } else {
    _hatPoppySpr.material.opacity = 1;
    if (_hatFlowerTex && _hatPoppySpr.material.map !== _hatFlowerTex) {
      _hatPoppySpr.material.map = _hatFlowerTex; _hatPoppySpr.material.needsUpdate = true;
    }
    // Re-parent if detached during knock-off
    if (_hatPoppySpr.parent !== _hatParent) {
      if (_hatPoppySpr.parent) _hatPoppySpr.parent.remove(_hatPoppySpr);
      _hatParent.add(_hatPoppySpr);
    }
  }
  // 256x317 aspect: height = 1.24 * width -> scale.x = _hs / 1.24
  // POPPY_HAT_SCALE is direct model-local size; world size = POPPY_HAT_SCALE * KAYAKER_SCALE
  var _hs = POPPY_HAT_SCALE;
  _hatPoppySpr.scale.set(_hs / 1.24, _hs, 1);
  if (_useGroup) {
    // Position in waist-group-local space = model-local position minus waist pivot
    _hatPoppySpr.position.set(POPPY_HAT_MX, POPPY_HAT_MY - TORSO_HINGE_Y, POPPY_HAT_MZ - TORSO_HINGE_Z);
  } else {
    // World-space fallback (GLB not loaded)
    _hatPoppySpr.position.set(player3.x - POPPY_HAT_MX * KAYAKER_SCALE, POPPY_HAT_MY * KAYAKER_SCALE, -POPPY_HAT_MZ * KAYAKER_SCALE);
  }
  _hatPoppySpr.material.rotation = POPPY_HAT_TILT;
  _hatPoppySpr.visible = true;
}

// ── VISUAL UPDATE (every frame) ────────────────────────────────────
var _ambientTick = 0;
function updateVisuals3() {
  // Cloud shadow patches drift independently (wall-clock) — freeze during forlorn so
  // nothing slides across the ground while the kayaker lies still.
  if (gameState3 !== 'forlorn') _updateCloudPatches();
  // Fish and birds also wall-clock driven — freeze position during forlorn.
  if (gameState3 !== 'forlorn') _updateWildlife();
  _ambientTick++;
  if (_ambientTick % 120 === 0) {
    var _cv = _shadowPatches.filter(function(c) { return c.mesh.visible; }).length;
    console.log('[AMBIENT] tick=' + _ambientTick + ' shadow_vis=' + _cv + '/' + _shadowPatches.length + ' rays=' + _rayPairs.length + ' fish=' + _fishState + ' bird=' + _birdState);
  }

  // ── FORLORN TIP-OVER (beached kayaker slowly falls sideways) ──────
  if (gameState3 === 'forlorn' && _forlornStartMs > 0) {
    var _fEl = Date.now() - _forlornStartMs;
    var _fT  = Math.min(1, _fEl / 2500);
    playerGroup.rotation.z = -(1 - Math.pow(1 - _fT, 3)) * 1.25; // cubic ease-out tip
    // Animate qmark: gentle bob (y) + wiggle (material.rotation) above the kayaker
    if (_qmarkSpr) {
      var _qNow = Date.now();
      _qmarkSpr.position.set(
        playerGroup.position.x + 0.2,
        playerGroup.position.y + 1.6 + Math.sin(_qNow * 0.0035) * 0.07,
        playerGroup.position.z
      );
      _qmarkSpr.material.rotation = Math.sin(_qNow * 0.0055) * 0.22;
    }
    if (_fEl >= ENDING_FORLORN_MS) {
      _forlornStartMs = 0; // prevent re-trigger
      if (_qmarkSpr) { scene.remove(_qmarkSpr); _qmarkSpr.material.dispose(); _qmarkSpr = null; }
      _openStoryViewer(false);
    }
  }

  // ── WIPEOUT CAPSIZE ANIMATION ───────────────────────────────────
  if (gameState3 === 'wipeout' && _wipeoutStartMs > 0) {
    var _wEl = Date.now() - _wipeoutStartMs;

    // Ease world scroll to rest over 300ms — no jarring freeze at impact
    var _wSpdT  = Math.min(1, _wEl / 300);
    curSpd3 = _wipeoutPreImpactSpd * (1 - _wSpdT * _wSpdT * (3 - 2 * _wSpdT));

    // Hull capsize: smootherstep over 800ms — slow onset so boat flows from motion into capsize
    var _wCapT    = Math.min(1, _wEl / 800);
    var _wCapEase = _wCapT * _wCapT * (3 - 2 * _wCapT);

    // Ejection onset: 0→1 over 250ms — lateral/tumble ease in, no explosive pop
    var _wOnsetT = Math.min(1, _wEl / 250);
    var _wOnset  = _wOnsetT * _wOnsetT * (3 - 2 * _wOnsetT);

    // ── Hull motion per variant ──────────────────────────────────
    if (_wipeoutVariant === 'endo') {
      // Nose-dive pitch: bow buries, stern flies up
      playerGroup.rotation.x = _wCapEase * 1.40 * _wipeoutMag;
      playerGroup.rotation.z = _wipeoutDir * _wCapEase * 0.25;
    } else if (_wipeoutVariant === 'spin-flip') {
      // Side roll + continuous yaw spin
      playerGroup.rotation.z  = _wipeoutDir * _wCapEase * 1.35 * _wipeoutMag;
      playerGroup.rotation.y += _wipeoutDir * 0.075 * _wOnset;  // additive spin eases in
      playerGroup.rotation.x  = _wCapEase * 0.10;
    } else if (_wipeoutVariant === 'float-away') {
      // Gentle partial tip — hull stays semi-upright
      playerGroup.rotation.z = _wipeoutDir * _wCapEase * 0.55 * _wipeoutMag;
      playerGroup.rotation.x = _wCapEase * 0.08;
    } else { // capsize (left or right)
      playerGroup.rotation.z = _wipeoutDir * _wCapEase * 1.35 * _wipeoutMag;
      playerGroup.rotation.x = _wCapEase * 0.12;
    }

    // ── Kayaker ejection ─────────────────────────────────────────
    if (_glbModel) {
      var _wGrav = (_wipeoutVariant === 'float-away') ? 0.0025 : 0.0042;

      if (_wipeoutFloating) {
        // ALL variants: world-space bob (_glbModel reparented to scene at landing)
        _wipeoutFloatPhase++;
        _glbModel.position.y  = _wipeoutFloatBaseY + 0.018 * Math.sin(_wipeoutFloatPhase * 0.055);
        _glbModel.position.x += _wipeoutKayakerVx; _wipeoutKayakerVx *= 0.96;
        _glbModel.position.z += 0.004 + _wipeoutKayakerVz; _wipeoutKayakerVz *= 0.94; // downstream drift
        _glbModel.rotation.z += _wipeoutDir * 0.002;  // lazy settle roll
        // Clamp X in world space
        var _wFltXLim = rwCur / 2 + 2.0;
        if (Math.abs(_glbModel.position.x) > _wFltXLim) {
          _glbModel.position.x = Math.sign(_glbModel.position.x) * _wFltXLim;
          _wipeoutKayakerVx = 0;
        }
      } else {
        // In-flight: Y full physics (keeps landing timing reliable); X/Z ease in over 250ms
        _wipeoutKayakerVy    -= _wGrav;
        _glbModel.position.y += _wipeoutKayakerVy;
        _glbModel.position.x += _wipeoutKayakerVx * _wOnset;
        _glbModel.position.z += _wipeoutKayakerVz * _wOnset;
        // Y ceiling: modest arc, no stratosphere
        if (_glbModel.position.y > 2.5) { _glbModel.position.y = 2.5; _wipeoutKayakerVy = 0; }
        // X clamp: stay within 2wu of river banks during flight
        var _wFlyWX = playerGroup.position.x + _glbModel.position.x;
        var _wFlyXLim = rwCur / 2 + 2.0;
        if (Math.abs(_wFlyWX) > _wFlyXLim) {
          _glbModel.position.x = Math.sign(_wFlyWX) * _wFlyXLim - playerGroup.position.x;
          _wipeoutKayakerVx = 0;
        }

        // Per-variant tumble — all ramped by onset smootherstep; no snap at start
        if (_wipeoutVariant === 'endo') {
          _glbModel.rotation.x -= 0.055 * _wOnset;
          _glbModel.rotation.z += _wipeoutDir * 0.02 * _wOnset;
        } else if (_wipeoutVariant === 'spin-flip') {
          _glbModel.rotation.z += _wipeoutDir * 0.095 * _wOnset;
          _glbModel.rotation.x -= 0.045 * _wOnset;
          _glbModel.rotation.y += 0.06 * _wOnset;
        } else if (_wipeoutVariant === 'float-away') {
          _glbModel.rotation.z += _wipeoutDir * 0.025 * _wOnset;
          _glbModel.rotation.x -= 0.018 * _wOnset;
        } else { // capsize
          _glbModel.rotation.z += _wipeoutDir * 0.070 * _wOnset;
          _glbModel.rotation.x -= 0.038 * _wOnset;
        }

        // Landing detection — ALL variants settle on the surface
        if (!_wipeoutSplashFired && _glbModel.position.y < 0.14 && _wEl > 250) {
          _wipeoutSplashFired = true;
          _sfxPlay('splash');
          // Capture world position/orientation before reparenting
          var _wldLandPos  = new THREE.Vector3();
          var _wldLandQuat = new THREE.Quaternion();
          _glbModel.getWorldPosition(_wldLandPos);
          _glbModel.getWorldQuaternion(_wldLandQuat);
          // Reparent to scene so float Y is in world space, not rotated-parent space
          playerGroup.remove(_glbModel);
          scene.add(_glbModel);
          _glbModel.position.set(_wldLandPos.x, 0.12, _wldLandPos.z);
          _glbModel.quaternion.copy(_wldLandQuat);
          _wipeoutGlbInScene = true;
          // Landing splash at world X
          var _wpx = _wldLandPos.x;
          activateSplash3(_wpx, 0, 2.4, 30);
          activateSplash3(_wpx + _wipeoutDir * 0.55, 0, 1.5, 22);
          _triggerPopRipple(_wpx, 0);
          // Switch to float mode — Y is now in world space, always at waterline
          _wipeoutFloating   = true;
          _wipeoutFloatBaseY = 0.12;
          _wipeoutKayakerVy  = 0;
          _wipeoutKayakerVx *= 0.25;
          _wipeoutKayakerVz *= 0.25;
        }
      }
    }

    // ── Spilled oranges: arc → land → float ──────────────────────
    for (var _woi = 0; _woi < _wipeoutOranges.length; _woi++) {
      var _wo = _wipeoutOranges[_woi];
      if (!_wo.landed) {
        _wo.vy -= (_wo.grav !== undefined ? _wo.grav : 0.0030);
        if (_wo.friction) _wo.vx *= _wo.friction;
        _wo.mesh.position.x += _wo.vx;
        _wo.mesh.position.y += _wo.vy;
        _wo.mesh.position.z += _wo.vz + curSpd3;  // curSpd3 — never bare spd
        _wo.mesh.rotation.x += _wo.rotSpd;
        // Scale-punch animation (pop oranges only; scaleT undefined on normal oranges)
        if (_wo.scaleT !== undefined && _wo.scaleT <= _wo.scaleRise + _wo.scaleFall) {
          _wo.scaleT++;
          var _ss;
          if (_wo.scaleT <= _wo.scaleRise) {
            _ss = _wo.scaleStart + (_wo.scalePk - _wo.scaleStart) * (_wo.scaleT / _wo.scaleRise);
          } else {
            var _sfT = (_wo.scaleT - _wo.scaleRise) / _wo.scaleFall;
            _ss = _wo.scalePk + (1.0 - _wo.scalePk) * (_sfT * _sfT);  // ease back to 1.0
          }
          _wo.mesh.scale.setScalar(_ss);
        }
        if (_wo.mesh.position.y < 0.10 && _wo.vy < 0) {
          _wo.landed      = true;
          _wo.mesh.position.y = 0.10;
          if (_wo.scaleT !== undefined) _wo.mesh.scale.setScalar(1.0);  // snap to final size
          activateSplash3(_wo.mesh.position.x, _wo.mesh.position.z, 0.45, 12);
        }
      } else {
        _wo.phase += 0.038;
        _wo.mesh.position.y  = _wo.floatBaseY + 0.015 * Math.sin(_wo.phase);
        _wo.mesh.position.x += _wo.driftVx;
        _wo.mesh.position.z += _wo.driftVz + curSpd3;  // scroll with the river + small downstream bias
        _wo.mesh.rotation.y += 0.018;
      }
    }

    if (_wEl >= WIPEOUT_MS) {
      _wipeoutStartMs = 0;
      endRun3(false);
    }
  }

  if (gameState3 !== 'wipeout') playerGroup.position.x = player3.x;

  // Flattened arc: Math.pow(..., JUMP_ARC_FLATTEN < 1) broadens the plateau so the boat
  // hangs at moderate height instead of peaking sharply and diving back down immediately.
  const jumpY = player3.isJumping
    ? JUMP_HEIGHT * Math.pow(Math.sin((player3.jumpFrame / JUMP_DURATION) * Math.PI), JUMP_ARC_FLATTEN)
    : 0;
  playerGroup.position.y = jumpY;

  playerShadow.position.x = player3.x;
  const sScale = player3.isJumping ? Math.max(0.3, 1 - jumpY * 0.22) : 1;
  playerShadow.scale.set(sScale, sScale, sScale);
  shadowMat.opacity = player3.isJumping ? 0.10 : 0.28;

  // Spinout + lane-change tilt (share rotation.y). Wipeout block owns rotation.y during wipeout.
  if (gameState3 !== 'wipeout' && player3.spinoutFrames > 0) {
    playerGroup.rotation.y += 0.18;
    kayakWasSpinning3 = true;
    kayakTurnY3 = 0; kayakTurnVel3 = 0;
    _daringRoll3 = 0; _daringRollVel3 = 0;
  } else if (gameState3 !== 'wipeout' && kayakWasSpinning3) {
    playerGroup.rotation.y = _baseFacingY + (playerGroup.rotation.y - _baseFacingY) * 0.75;
    if (Math.abs(playerGroup.rotation.y - _baseFacingY) < 0.01) {
      playerGroup.rotation.y = _baseFacingY;
      kayakWasSpinning3 = false;
    }
  } else if (gameState3 !== 'wipeout') {
    if (playMode3 === 'daring') {
      // DARING: fully owns rotation.y (nose-lead yaw) and rotation.z (banking roll).
      var _steerInput3 = (_daringSteerR ? 1 : 0) - (_daringSteerL ? 1 : 0);
      var _dYawBlend   = Math.max(-1, Math.min(1,
        _steerInput3 * 0.55 + (_daringVx / DARING_MAX_SPD) * 0.45));
      if (_steerInput3 !== 0) turnDirSign3 = -_steerInput3;  // keep jump whip working
      // Yaw: purely velocity-driven — leads into the turn, eases back to straight as vx decays
      var _dYawWant   = -Math.max(-1, Math.min(1, _daringVx / DARING_MAX_SPD)) * DARING_YAW_MAX;
      var _dYawErr    = _dYawWant - kayakTurnY3;
      kayakTurnVel3  += _dYawErr * 0.15;
      kayakTurnVel3  *= 0.72;
      kayakTurnY3    += kayakTurnVel3;
      if (Math.abs(kayakTurnY3) < 0.008) { kayakTurnY3 = 0; kayakTurnVel3 = 0; }
      playerGroup.rotation.y = _baseFacingY + kayakTurnY3;
      // Roll spring — same blend signal, hull banks into the turn
      var _dRollWant  = -_dYawBlend * DARING_ROLL_MAX;
      var _dRollErr   = _dRollWant - _daringRoll3;
      _daringRollVel3 += _dRollErr * 0.12;
      _daringRollVel3 *= 0.76;
      _daringRoll3    += _daringRollVel3;
      if (Math.abs(_daringRoll3) < 0.005) { _daringRoll3 = 0; _daringRollVel3 = 0; }
      playerGroup.rotation.z = _daringRoll3;
    } else {
      // CLASSIC: lane-change tilt — 100% original code, untouched
      var lcTarget3 = laneXPos(player3.targetLane);
      var lcDx3     = lcTarget3 - player3.x;
      if (Math.abs(lcDx3) > 0.02 && !player3.isJumping) {
        turnDirSign3    = lcDx3 > 0 ? -1 : 1;
        turnHoldFrames3 = 22;
      }
      if (Math.abs(lcDx3) <= 0.02 && turnHoldFrames3 > 0) turnHoldFrames3--;
      var lcWant3 = ((Math.abs(lcDx3) > 0.02 || turnHoldFrames3 > 0) && !player3.isJumping)
        ? turnDirSign3 * 0.70
        : 0;
      var turnError3 = lcWant3 - kayakTurnY3;
      kayakTurnVel3 += turnError3 * 0.06;
      kayakTurnVel3 *= 0.80;
      kayakTurnY3   += kayakTurnVel3;
      if (Math.abs(kayakTurnY3) < 0.008) { kayakTurnY3 = 0; kayakTurnVel3 = 0; }
      playerGroup.rotation.y = _baseFacingY + kayakTurnY3;
    }
  }

  // Jump pitch (rotation.x) + air-yaw (rotation.y) replaces tail whip.
  // Both live entirely on playerGroup, additive on top of kayakTurnY3.
  // Both unwind to exactly 0 before landing so there is no residual rotation.
  if (player3.isJumping) {
    var _jvt = player3.jumpFrame / JUMP_DURATION;

    if (_airTrick) {
      // ── Air trick: full rotation that lands exactly level ─────────────────
      // trickT maps remaining jump duration to [0, 1]; smootherstep eases it.
      var _tRemain = JUMP_DURATION - _airTrickStartFrame;
      var _trickT  = _tRemain > 0
        ? Math.min(1, (player3.jumpFrame - _airTrickStartFrame) / _tRemain)
        : 1;
      var _ease = _trickT * _trickT * _trickT * (6 * _trickT * _trickT - 15 * _trickT + 10);
      var _full = Math.PI * 2 * _ease;
      // Zero all axes first, then set the trick axis — avoids stale pitch/whip bleed.
      playerGroup.rotation.x = 0;
      playerGroup.rotation.y = _baseFacingY + kayakTurnY3;  // base + steering yaw
      playerGroup.rotation.z = 0;
      if (_airTrickType === 'roll')      { playerGroup.rotation.z = _airTrickDir * _full; }
      else if (_airTrickType === 'flip') { playerGroup.rotation.x = -_full; }
      else                               { playerGroup.rotation.y = _baseFacingY + _airTrickDir * _full; }
      if (_trickT >= 1) {
        _airTrick = false;
        playerGroup.rotation.x = 0;
        playerGroup.rotation.z = 0;
      }
    } else {
      // ── Normal jump: pitch; then DARING air-yaw or CLASSIC tail whip ──────
      // Pitch: nose up on launch, level at apex, nose down into re-entry.
      var _jPitch;
      if (_jvt < 0.25) {
        _jPitch = JUMP_PITCH_UP   * Math.sin((_jvt / 0.25) * (Math.PI / 2));
      } else if (_jvt < 0.55) {
        _jPitch = JUMP_PITCH_UP   * Math.cos(((_jvt - 0.25) / 0.30) * (Math.PI / 2));
      } else if (_jvt < 0.95) {
        _jPitch = JUMP_PITCH_DOWN * Math.sin(((_jvt - 0.55) / 0.40) * (Math.PI / 2));
      } else {
        _jPitch = JUMP_PITCH_DOWN * Math.cos(((_jvt - 0.95) / 0.05) * (Math.PI / 2));
      }
      playerGroup.rotation.x = _jPitch;
      if (playMode3 === 'daring') {
        // Air-yaw: show accumulated spin relative to base; no tail-whip roll.
        playerGroup.rotation.y = _baseFacingY + _airYaw;
        playerGroup.rotation.z = 0;
      } else {
        // Classic: original tail whip (yaw + roll kick, unwinds to 0 before landing).
        var _whipDir = turnDirSign3;
        var _wCurve;
        if (_jvt < 0.12) {
          _wCurve = _jvt / 0.12;
        } else if (_jvt < 0.55) {
          _wCurve = 1.0;
        } else if (_jvt < 0.95) {
          _wCurve = (0.95 - _jvt) / 0.40;
        } else {
          _wCurve = 0;  // hard zero before landing: boat is straight at impact
        }
        playerGroup.rotation.y += -_whipDir * JUMP_WHIP_YAW  * _wCurve;
        playerGroup.rotation.z  =  _whipDir * JUMP_WHIP_ROLL * _wCurve;
      }
    }
  } else {
    // Not jumping: clear any in-flight trick, then restore level attitude.
    if (_airTrick) {
      _airTrick = false;
      playerGroup.rotation.x = 0;
      playerGroup.rotation.z = 0;
    }
    if (gameState3 !== 'wipeout') playerGroup.rotation.x = 0;
    if (gameState3 !== 'forlorn' && gameState3 !== 'wipeout' && playMode3 !== 'daring') playerGroup.rotation.z = 0;
  }

  // Post-landing settle (DARING): smoothly eases rotation.y from the final air angle to base.
  if (playMode3 === 'daring' && !player3.isJumping && _settleYawT < 1.0 && gameState3 !== 'wipeout') {
    _settleYawT = Math.min(1.0, _settleYawT + 0.10);
    var _sEase = _settleYawT * _settleYawT * (3 - 2 * _settleYawT);  // smoothstep
    playerGroup.rotation.y = _settleYawFrom + (_baseFacingY - _settleYawFrom) * _sEase;
  }

  // Paddle stroke: only runs when GLB is loaded (glbPaddleGroup != null).
  // Phase accumulates proportional to curSpd3 so rowing rate tracks boat speed.
  if (glbPaddleGroup) {
    strokePhase += STROKE_RATE * curSpd3;
    glbPaddleGroup.rotation.z = Math.sin(strokePhase) * STROKE_DIP;
    glbPaddleGroup.rotation.x = Math.cos(strokePhase) * STROKE_PULL;
    _strokeDbgTick++;
    if (_strokeDbgTick % 60 === 1) {
      console.log('[KRR STROKE] phase=' + strokePhase.toFixed(2) +
        ' curSpd3=' + curSpd3.toFixed(4) +
        ' rotZ=' + glbPaddleGroup.rotation.z.toFixed(3) +
        ' children=' + glbPaddleGroup.children.length);
    }
    if (glbTorsoNode) {
      // Base rowing rock (counter-phase lean; speed-coupled via strokePhase)
      var _tRock = -Math.sin(strokePhase) * TORSO_ROCK;
      // Jump phase-driven body animation layered on top
      if (player3.isJumping) {
        var _jt = player3.jumpFrame / JUMP_DURATION;
        var _jOff = 0;
        if (_jt < 0.08) {
          // Anticipation: quick forward dip as legs compress for liftoff
          _jOff = -JUMP_CROUCH_AMOUNT * Math.sin((_jt / 0.08) * Math.PI);
        } else if (_jt < 0.35) {
          // Lift: torso arches back as boat leaves water
          _jOff = JUMP_LIFT_AMOUNT * Math.sin(((_jt - 0.08) / 0.27) * (Math.PI * 0.5));
        } else if (_jt < 0.80) {
          // Hang: hold slight back lean at arc apex
          _jOff = JUMP_LIFT_AMOUNT * 0.5;
        } else {
          // Pre-landing: return torso to neutral before impact
          _jOff = JUMP_LIFT_AMOUNT * 0.5 * (1 - ((_jt - 0.80) / 0.20));
        }
        _tRock += _jOff;
      }
      // Landing squash: decays over 8 frames after re-entry, set by splash block below
      if (glbTorsoSquashFrames > 0) {
        glbTorsoSquashFrames--;
        _tRock += -JUMP_LAND_SQUASH * (glbTorsoSquashFrames / 7.0);
      }
      if (!_breathFrozen) {
        (glbTorsoGroup || glbTorsoNode).rotation.x = _tRock;
      }
    }
  }

  // Hat poppy idle: pinned in hat band -- no bob. Sway reacts to boat yaw.
  if (_hatPoppySpr && _hatPoppySpr.visible && _poppyPickSt === 0 && _hatKnockSt === 0) {
    _hatPoppySpr.material.rotation = POPPY_HAT_TILT + kayakTurnY3 * POPPY_HAT_SWAY_K;
  }

  // Knocked-off flower: sprite was detached to scene on knock-off start; spins and fades
  if (_hatKnockSt > 0) {
    var _knT = Math.min(1, (Date.now() - _hatKnockSt) / 800);
    if (_hatPoppySpr) {
      _hatPoppySpr.position.x += _hatKnockVel.x;
      _hatPoppySpr.position.y += _hatKnockVel.y;
      _hatPoppySpr.position.z += 0.14;
      _hatPoppySpr.material.rotation += 0.18;
      _hatPoppySpr.material.opacity = 1 - _knT;
    }
    if (_knT >= 1) {
      if (_hatPoppySpr) {
        if (_hatPoppySpr.parent) _hatPoppySpr.parent.remove(_hatPoppySpr);
        _hatPoppySpr.material.opacity = 1;
        _hatPoppySpr.material.rotation = POPPY_HAT_TILT;
      }
      _hatKnockSt = 0;
    }
  }

  // Shield-loss edge detection: detach hat flower from hinge group and throw it
  if (_poppyShieldWas && !player3.hasShield && _hatKnockSt === 0) {
    if (_hatPoppySpr && _hatPoppySpr.visible) {
      var _kwp = new THREE.Vector3();
      _hatPoppySpr.getWorldPosition(_kwp);
      if (_hatPoppySpr.parent) _hatPoppySpr.parent.remove(_hatPoppySpr);
      _hatPoppySpr.position.copy(_kwp);
      scene.add(_hatPoppySpr);
      _hatKnockSt   = Date.now();
      _hatKnockVel.x = _poppyPickSide * 0.04 + (Math.random() - 0.5) * 0.03;
      _hatKnockVel.y = 0.06 + Math.random() * 0.04;
    }
    _shieldBurstSt = Date.now(); // trigger bubble burst regardless of hat state
    _launchShieldShards();       // fragment the bubble into iridescent shards
  }
  _poppyShieldWas = player3.hasShield;

  // ── Shield bubble: shimmer while active; flare + scale-out burst on loss ──
  if (_shieldGroup) {
    if (_shieldBurstSt > 0) {
      var _bEl = Date.now() - _shieldBurstSt;
      _shieldGroup.visible = true;
      if (_bEl < 100) {
        // Flare: keep scale, ramp opacity up 4x
        var _flT = _bEl / 100;
        _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT);
        _shieldInner.material.opacity = SHIELD_INNER_OP * (1 + _flT * 3);
        _shieldOuter.material.opacity = SHIELD_OUTER_OP * (1 + _flT * 3);
      } else if (_bEl < 400) {
        // Burst: scale up 1->1.3, opacity fall to 0
        var _brT = (_bEl - 100) / 300;
        var _brE = 1 - (1 - _brT) * (1 - _brT); // ease-out quad
        _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT * (1 + 0.30 * _brE));
        _shieldInner.material.opacity = SHIELD_INNER_OP * 4 * (1 - _brT);
        _shieldOuter.material.opacity = SHIELD_OUTER_OP * 4 * (1 - _brT);
      } else {
        // Done: hide and reset
        _shieldBurstSt = 0;
        _shieldGroup.visible = false;
        _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT);
        _shieldInner.material.opacity = SHIELD_INNER_OP;
        _shieldOuter.material.opacity = SHIELD_OUTER_OP;
      }
    } else if (player3.hasShield) {
      _shieldGroup.visible = true;
      _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT);
      // Slow iridescent hue cycle: inner and outer offset 0.10 apart for rim interference shimmer
      var _hue  = (frameN * SHIELD_HUE_SPEED) % 1.0;
      var _shim = Math.sin(frameN * SHIELD_SHIMMER_F) * SHIELD_SHIMMER_A;
      _shieldInner.material.color.setHSL(_hue, 0.85, 0.70);
      _shieldOuter.material.color.setHSL((_hue + 0.10) % 1.0, 0.90, 0.75);
      _shieldInner.material.opacity = Math.max(0, SHIELD_INNER_OP + _shim * 0.5);
      _shieldOuter.material.opacity = Math.max(0, SHIELD_OUTER_OP + _shim);
    } else {
      _shieldGroup.visible = false;
    }
  }

  // ── Shield shards: arc outward, tumble, gravity-fall, fade ──
  for (var _sfi = 0; _sfi < _shardPool.length; _sfi++) {
    var _sf = _shardPool[_sfi];
    if (!_sf.active) continue;
    var _sfEl = Date.now() - _sf.startT;
    if (_sfEl >= SHARD_DURATION) { _sf.active = false; _sf.mesh.visible = false; continue; }
    var _sfT = _sfEl / SHARD_DURATION;
    _sf.vy -= SHARD_GRAVITY;
    _sf.mesh.position.x += _sf.vx;
    _sf.mesh.position.y += _sf.vy;
    _sf.mesh.position.z += _sf.vz;
    _sf.mesh.rotation.x += _sf.sx;
    _sf.mesh.rotation.y += _sf.sy;
    _sf.mesh.rotation.z += _sf.sz;
    // Hold full opacity for first 30% of life then ease to 0
    _sf.mesh.material.opacity = 1.0 * (_sfT < 0.30 ? 1.0 : (1 - (_sfT - 0.30) / 0.70));
  }

  // Bank poppy pick: ms-based reach → retract → seat (POPPY_PULL_MS total)
  if (_poppyPickSt > 0 && _poppyPickPp) {
    if (player3.isJumping || player3.spinoutFrames > 0) {
      // Cancel: clean up bloom sprite, reset state
      if (_poppyBloomSpr) { scene.remove(_poppyBloomSpr); _poppyBloomSpr.material.dispose(); _poppyBloomSpr = null; }
      _poppyPickSt = 0; _poppyPickPp = null;
      (glbTorsoGroup || glbTorsoNode).rotation.z = 0;
      if (glbArmRGroup) glbArmRGroup.rotation.z = 0;
      if (glbArmLGroup) glbArmLGroup.rotation.z = 0;
    } else {
      var _pxNow = Date.now();
      var _pxEl  = _pxNow - _poppyPickSt;
      // Lean arc: ramp up to contact, ramp back down over retract
      var _leanFrac;
      if (_pxEl <= POPPY_REACH_MS) {
        _leanFrac = _pxEl / POPPY_REACH_MS;
      } else {
        _leanFrac = 1 - Math.min(1, (_pxEl - POPPY_REACH_MS) / POPPY_RETRACT_MS);
      }
      var _rAng = POPPY_LEAN_ANG * Math.sin(_leanFrac * Math.PI / 2);
      (glbTorsoGroup || glbTorsoNode).rotation.z = _poppyPickSide * _rAng;
      // Arm reach: the arm on the flower-side swings outward+down toward bank
      // _poppyPickSide=1 (right bank, world +X): ARM L group is GLB -X which maps to world +X
      // _poppyPickSide=-1 (left bank, world -X): ARM R group is GLB +X which maps to world -X
      var _reachArm   = (_poppyPickSide === 1) ? glbArmLGroup : glbArmRGroup;
      var _restArm    = (_poppyPickSide === 1) ? glbArmRGroup : glbArmLGroup;
      var _armSweep   = ARM_REACH_ANG * Math.sin(_leanFrac * Math.PI / 2);
      if (_reachArm) _reachArm.rotation.z = _poppyPickSide * -_armSweep;
      if (_restArm)  _restArm.rotation.z  = 0;
      playerGroup.position.x += _poppyPickSide * 0.12 * Math.sin(_leanFrac * Math.PI / 2);
      if (glbPaddleGroup) glbPaddleGroup.rotation.z += _poppyPickSide * -0.22 * Math.sin(_leanFrac * Math.PI / 2);

      // Bloom sprite travel: RETRACT then SEAT
      // Hat world position: model-space (MX, MY, MZ) → world via scale and rotY=PI
      var _hatWX = player3.x - POPPY_HAT_MX * KAYAKER_SCALE;
      var _hatWY = playerGroup.position.y + POPPY_HAT_MY * KAYAKER_SCALE;
      var _hatWZ = -POPPY_HAT_MZ * KAYAKER_SCALE;
      if (_poppyContactFired && _poppyBloomSpr) {
        var _handX = _hatWX;
        var _handY = _hatWY - 0.48;
        if (_pxEl < POPPY_REACH_MS + POPPY_RETRACT_MS) {
          // RETRACT: bloom flies from bank to chest
          var _retT = (_pxEl - POPPY_REACH_MS) / POPPY_RETRACT_MS;
          var _eR = _retT < 0.5 ? 2*_retT*_retT : 1 - Math.pow(-2*_retT+2, 2)/2;
          _poppyBloomSpr.position.x = _poppyBloomCPos.x + (_handX - _poppyBloomCPos.x) * _eR;
          _poppyBloomSpr.position.y = _poppyBloomCPos.y + (_handY - _poppyBloomCPos.y) * _eR;
          _poppyBloomSpr.position.z = _poppyBloomCPos.z + (_hatWZ - _poppyBloomCPos.z) * _eR;
        } else {
          // SEAT: bloom rises from chest to hat, scaling down
          var _stEl = _pxEl - POPPY_REACH_MS - POPPY_RETRACT_MS;
          var _stT  = Math.min(1, _stEl / POPPY_SEAT_MS);
          var _eS   = _stT < 0.5 ? 2*_stT*_stT : 1 - Math.pow(-2*_stT+2, 2)/2;
          _poppyBloomSpr.position.x = _handX + (_hatWX - _handX) * _eS;
          _poppyBloomSpr.position.y = _handY + (_hatWY - _handY) * _eS;
          _poppyBloomSpr.position.z = _hatWZ;
          // Ease from world pickup size down to world hat size so the seated sprite appears seamlessly
          var _bSc = POPPY_PICK_SIZE + (POPPY_HAT_SCALE * KAYAKER_SCALE - POPPY_PICK_SIZE) * _eS;
          _poppyBloomSpr.scale.set(_bSc, 0.53 * _bSc, 1);
          if (_stT >= 1.0) {
            scene.remove(_poppyBloomSpr);
            _poppyBloomSpr.material.dispose();
            _poppyBloomSpr = null;
            _ensureHatPoppy3(_poppyPickSide);
            _poppyPickSt = 0;
            _poppyPickPp = null;
          }
        }
      } else if (_pxEl >= POPPY_PULL_MS) {
        // Safety fallback: animation window expired
        _poppyPickSt = 0; _poppyPickPp = null;
      }
    }
  } else if (_poppyPickSt === 0) {
    (glbTorsoGroup || glbTorsoNode).rotation.z = 0;
    if (glbArmRGroup) glbArmRGroup.rotation.z = 0;
    if (glbArmLGroup) glbArmLGroup.rotation.z = 0;
  }

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

  // Shield indicator: hat poppy sprite (see _hatPoppySpr block above; no torus ring)

  // Chase camera
  camXSmooth += (player3.x - camXSmooth) * 0.07;
  camera.position.set(camXSmooth, CAM_Y, CAM_Z_BK);
  camera.lookAt(camXSmooth, 0.5, CAM_LOOK_Z);

  // HUD
  if (gameState3 === 'playing') {
    const stg = STAGES3[stageIdx];
    document.getElementById('hud3-stage').textContent    = stg.name;
    document.getElementById('hud3-mile').textContent     = 'MILE ' + curMile3 + ' / 165';
    document.getElementById('hud3-progress-fill').style.width = Math.min(100, (curMile3 / 165) * 100) + '%';
    document.getElementById('hud3-stageNum').textContent = 'STAGE ' + stg.num + '/5';
    document.getElementById('hud3-score').textContent        = Math.floor(score3);
    document.getElementById('hud3-best').textContent         = Math.floor(highScore3);
    document.getElementById('hud3-orange-count').textContent = player3.oranges;
  }

  // Animate water surface -- three overlapping sine waves traveling downstream (+world z).
  // PlaneGeometry is rotated -PI/2 on X, so local Y maps to world Z.
  // Wave sin(t - localY * k) travels in +localY = +worldZ = downstream direction.
  // wt multiplier 0.013 is roughly 1/3 of the original 0.038 for calm, gently flowing look.
  // Third wave adds a cross-current ripple at a different spatial angle for organic depth.
  // Frozen during forlorn/beaching: still water is the emotional beat.
  if (waterMesh && waterMesh.geometry && gameState3 === 'playing') {
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

  // Scroll water + riverbed textures proportional to curSpd3 so they decelerate in lockstep
  // with the world during the ending. Constant 0.0067 UV/wu gives ~0.0008/frame at stage-5
  // full speed (curSpd3 = 2.00 × 0.060 = 0.12); scales naturally across all stage speeds.
  // Stop entirely during beaching/forlorn — stillness is the emotional beat.
  if (gameState3 === 'playing') {
    var _wScroll = curSpd3 * 0.0067;
    if (waterMesh && waterMesh.material && waterMesh.material.map) {
      waterMesh.material.map.offset.y -= _wScroll;
    }
    if (riverbedTexRef) {
      riverbedTexRef.offset.y -= _wScroll;
    }
  }

  // Far-plane UV scroll removed: all stages now use the geometric ground chain (groundChain3)
  // which scrolls with the bank-seg clock. No offset.y animation needed on any far plane.

  // Stage 5 water recede: shrink waterMesh.scale.x to 0 over miles ENDING_WATER_START -> ENDING_WATER_GONE.
  // Starts at mile 161 (safely after the last sub-narrow at 160 which resets waterMesh).
  // Does not alter curLanes, collision geometry, or any gameplay state.
  if (stageIdx === 4 && waterMesh && curMile3 >= ENDING_WATER_START) {
    var _wt = Math.min(1, (curMile3 - ENDING_WATER_START) / (ENDING_WATER_GONE - ENDING_WATER_START));
    waterMesh.scale.x = Math.max(0, 1 - _wt);
    if (waterMesh.material) {
      waterMesh.material.opacity = WATER_OPACITY * Math.max(0, 1 - _wt * 0.6);
    }
  }

  // Stage 5 beaching cinematic: 3s dead pause then Victory title card.
  // Runs in updateVisuals3 every frame so it advances even though update3 has stopped.
  if (gameState3 === 'beaching') {
    var _elapsed = Date.now() - endingBeachStartMs;
    if (!endingCinematicFired && _elapsed >= ENDING_PAUSE_MS) {
      endingCinematicFired = true;
      showTitleCard({ title: 'Victory?', subtitle: '', holdMs: 1900, dramatic: true, onComplete: function() { startEnding3(); } });
    }
  }

  // Scroll Stage 4 pebble floor textures toward player, tied to curSpd3 so they match world movement.
  // With repeat.y = gndZ / GROUND_TEX_WORLD on a gndZ-deep plane, 1 world unit = 1/GROUND_TEX_WORLD UV.
  if (floorMats4.length > 0 && gameState3 === 'playing') {
    var floorDelta = curSpd3 / GROUND_TEX_WORLD * WALL4_FLOOR_SCROLL_MULT;
    for (var f4i = 0; f4i < floorMats4.length; f4i++) {
      floorMats4[f4i].offset.y -= floorDelta;
    }
  }

  // Stage 4 rock wall: z-scrolled via canyonFillSegs4 pool above; no UV animation here.

  // Drift backdrop clouds only while playing — freeze during beaching/forlorn for stillness.
  // Scale grows from CLOUD_START_SCALE to CLOUD_END_SCALE as z travels -96 -> -38.
  if (gameState3 === 'playing') for (var ci = 0; ci < clouds3.length; ci++) {
    clouds3[ci].position.z += clouds3[ci].userData.spd;
    if (clouds3[ci].position.z > -38) clouds3[ci].position.z = -96;
    var ct = (clouds3[ci].position.z + 96) / 58;
    ct = Math.max(0, Math.min(1, ct));
    ct = ct * ct * (3 - 2 * ct);
    var cMult = CLOUD_START_SCALE + (CLOUD_END_SCALE - CLOUD_START_SCALE) * ct;
    clouds3[ci].scale.set(CLOUD_BASE_W * cMult, CLOUD_BASE_H * cMult, 1);
  }

  // Scroll waterfall strips downward; each strip loops to the top when it exits the base.
  if (wfStrips.length > 0 && gameState3 === 'playing') {
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
    // Takeoff: ring burst at hull (slightly bigger than old 2.2/22)
    activateSplash3(player3.x, 0, 3.2, 26);
  }
  if (!jumpingNow3 && splashWasJumping3) {
    // Re-entry: center ring + port/starboard hull rings scaled to the bigger GLB boat
    activateSplash3(player3.x,                       0, SPLASH_SIZE,            SPLASH_LIFETIME);
    activateSplash3(player3.x - SPLASH_SPREAD * 0.5, 0, SPLASH_SIZE * 0.68,     SPLASH_LIFETIME - 8);
    activateSplash3(player3.x + SPLASH_SPREAD * 0.5, 0, SPLASH_SIZE * 0.68,     SPLASH_LIFETIME - 8);
    activateDroplets3(player3.x, 0, SPLASH_COUNT, 2.0);
    // Trigger landing squash on the rower's torso
    glbTorsoSquashFrames = 8;
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

  // Part 3b: Obstacle upstream parting ripples + foam crescents.
  // Rings are assigned each frame to the first N visible active obstacles.
  // Upstream side = negative z from the obstacle (water flows from -z toward +z).
  var ripIdx = 0;
  for (var ri3 = 0; ri3 < obstacles3.length; ri3++) {
    if (ripIdx >= obsRipplePool3.length) break;
    var obs3 = obstacles3[ri3];
    if (!obs3.mesh) continue;
    if (obs3.z < SPAWN_Z + 5 || obs3.z > DESPAWN_Z - 1) continue;
    // Distance fade: obstacles close to camera (high z) show full effect; far ones fade
    var _distT = Math.max(0, Math.min(1, (obs3.z + 30) / 33));
    // Parting ring: pulsing scale, brighter than before
    var ripR = obsRipplePool3[ripIdx];
    var ripScale = 1.05 + Math.sin(frameN * 0.07 + ri3 * 2.1) * 0.15;
    ripR.position.set(obs3.mesh.position.x, 0.16, obs3.mesh.position.z - 0.65);
    ripR.scale.set(ripScale, ripScale, 1);
    ripR.material.opacity = _distT * (0.28 + Math.sin(frameN * 0.11 + ri3 * 1.8) * 0.09);
    // Foam crescent: wide×flat ring right at the upstream face, fades with distance
    var foamR = obsFoamPool3[ripIdx];
    var foamScX = 1.55 + Math.sin(frameN * 0.08 + ri3 * 1.3) * 0.08;
    foamR.position.set(obs3.mesh.position.x, 0.17, obs3.mesh.position.z - 0.42);
    foamR.scale.set(foamScX, 0.55, 1); // wide in X, compressed in Z = crescent shape
    foamR.material.opacity = _distT * (0.22 + Math.sin(frameN * 0.10 + ri3 * 2.7) * 0.06);
    ripIdx++;
  }
  // Hide all unused pool slots this frame
  for (; ripIdx < obsRipplePool3.length; ripIdx++) {
    obsRipplePool3[ripIdx].material.opacity = 0;
    obsRipplePool3[ripIdx].position.z = -9999;
    obsFoamPool3[ripIdx].material.opacity = 0;
    obsFoamPool3[ripIdx].position.z = -9999;
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

  // ── Basket orange fill: sync visible count and pop-in newest orange
  _updateBasketOranges3();

  // ── Score popups: scale punch (1.3->1.0 in first 100ms), rise, hold, late fade
  if (_scorePopups.length > 0) {
    var _spNow = Date.now();
    var _PTOT = 800, _PPUN = 100, _PFD = 0.67;
    for (var _spi = _scorePopups.length - 1; _spi >= 0; _spi--) {
      var _spe = _scorePopups[_spi];
      var _spFrac = Math.min(1, (_spNow - _spe.startT) / _PTOT);
      _spe.spr.position.y = _spe.startY + _spFrac * POPUP_RISE;
      var _spMs = _spFrac * _PTOT;
      if (_spMs < _PPUN) {
        var _pt = _spMs / _PPUN;
        var _sc = 1.3 - 0.3 * (1 - (1 - _pt) * (1 - _pt)); // ease-out quad 1.3->1.0
        _spe.spr.scale.set(_spe.bw * _sc, _spe.bh * _sc, 1);
      } else {
        _spe.spr.scale.set(_spe.bw, _spe.bh, 1);
      }
      _spe.spr.material.opacity = _spFrac > _PFD ? 1 - (_spFrac - _PFD) / (1 - _PFD) : 1;
      if (_spFrac >= 1) {
        scene.remove(_spe.spr);
        _spe.spr.material.dispose();
        _spe.tex.dispose();
        _scorePopups.splice(_spi, 1);
      }
    }
  }

  // ── Swell-theft orange sprites: tumble toward camera and fade over 800ms
  if (_swellOrangeSprites.length > 0) {
    var _soNow = Date.now();
    for (var _soi = _swellOrangeSprites.length - 1; _soi >= 0; _soi--) {
      var _soe = _swellOrangeSprites[_soi];
      var _soFrac = Math.min(1, (_soNow - _soe.startT) / 800);
      _soe.mesh.position.x += _soe.vx;
      _soe.mesh.position.y += _soe.vy;
      _soe.mesh.position.z += _soe.vz;
      _soe.vy -= 0.003; // light gravity
      _soe.mesh.rotation.x += _soe.rotSpd;
      _soe.mesh.rotation.z += _soe.rotSpd * 0.7;
      _soe.mesh.material.opacity = 1 - _soFrac;
      if (_soFrac >= 1) {
        scene.remove(_soe.mesh);
        _soe.mesh.material.dispose();
        _soe.mesh.geometry.dispose();
        _swellOrangeSprites.splice(_soi, 1);
      }
    }
  }

  // ── Flying oranges: arc from pickup point into basket on collection
  if (_orangeFlights.length > 0) {
    var _ofNow = Date.now();
    var _bkwp2 = new THREE.Vector3();
    if (_basketGroup) { _basketGroup.getWorldPosition(_bkwp2); }
    else { _bkwp2.set(player3.x, BASKET_Y, playerGroup.position.z + BASKET_Z); }
    for (var _ofi = _orangeFlights.length - 1; _ofi >= 0; _ofi--) {
      var _of = _orangeFlights[_ofi];
      var _ofT = Math.min(1, (_ofNow - _of.startT) / ORANGE_FLIGHT_MS);
      var _ofE = _ofT * _ofT * (3 - 2 * _ofT); // smoothstep ease
      _of.mesh.position.x = _of.sx + (_bkwp2.x - _of.sx) * _ofE;
      _of.mesh.position.z = _of.sz + (_bkwp2.z - _of.sz) * _ofE;
      _of.mesh.position.y = (_of.sy + (_bkwp2.y - _of.sy) * _ofE) + Math.sin(_ofT * Math.PI) * 0.30;
      _of.mesh.scale.setScalar(1.0 + (0.29 - 1.0) * _ofT); // shrink toward basket-orange size
      if (_ofT >= 1) {
        player3.oranges++;
        _runOranges++;
        var _ofScore = _of.value * (_reversed ? 2 : 1);
        score3 += _ofScore;
        _spawnScorePopup3(_of.px, _of.py, _of.pz, '+' + _ofScore + (_reversed ? ' ×2' : ''));
        scene.remove(_of.mesh);
        disposeMesh(_of.mesh);
        _orangeFlights.splice(_ofi, 1);
      }
    }
  }
}

// ── SHARED TITLE CARD ────────────────────────────────────────────────
// showTitleCard({ title, subtitle, holdMs, onComplete, dramatic })
//
// Standard path (stage announcements):
//   ENTER (~TITLE_ENTER_MS): title + subtitle fade/scale in, centred mid-screen.
//   HOLD  (holdMs ms):       static. Obstacle spawning is suppressed.
//   SHRINK (~TITLE_SHRINK_MS): card flies up to the top of the screen and
//                              scales down to a compact strip. onComplete fires.
//
// Dramatic path (ending only, dramatic:true):
//   ENTER: per-letter V-i-c-t-o-r-y...? reveal (existing tuned timing).
//   HOLD:  holdMs ms of dead air after "?" lands.
//   EXIT:  2.4s collective blur-out, then onComplete.
//   (No shrink-to-top on the ending -- it fades to black and yields to the
//    Kern River message screen.)
//
// Tuner keys: Shift+T/G = TITLE_ENTER_MS +/-100; Shift+Y/H = TITLE_HOLD_MS +/-250;
//             Shift+U/J = TITLE_FONT_PX +/-2
function showTitleCard(opts) {
  var holdMs   = (opts.holdMs != null) ? opts.holdMs : TITLE_HOLD_MS;
  var dramatic = !!opts.dramatic;
  var onDone   = opts.onComplete || function() {};

  // Tear down any existing card (stage or ending)
  if (_titleCancelFn) { _titleCancelFn(); _titleCancelFn = null; }
  if (_titleCardEl && _titleCardEl.parentNode) { _titleCardEl.parentNode.removeChild(_titleCardEl); }

  var card = document.createElement('div');
  card.id = 'krr-title-card';
  card.style.cssText = 'position:fixed;inset:0;z-index:50;pointer-events:none;overflow:hidden;';
  document.body.appendChild(card);
  _titleCardEl = card;
  // Legacy aliases so startGame3 cleanup still works without changes
  victoryEl3 = card;

  var cancelled = false;
  function _cancel() { cancelled = true; _titleCardSuppressSpawn = false; }
  _titleCancelFn = _cancel;
  _victoryCancelFn = _cancel;

  // ── DRAMATIC PATH (Victory? per-letter reveal) ──────────────────
  if (dramatic) {
    _titleCardSuppressSpawn = false; // game is stopped during ending; no spawn concern

    var veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;background:#0B1F3A;opacity:0;';
    card.appendChild(veil);

    var row = document.createElement('div');
    row.style.cssText = 'position:absolute;left:50%;top:50%;' +
      'transform:translate(-50%,-50%);display:flex;align-items:baseline;';
    card.appendChild(row);

    var lChars = ['V','i','c','t','o','r','y','?'];
    var spans = [];
    for (var li = 0; li < lChars.length; li++) {
      var sp = document.createElement('span');
      sp.textContent = lChars[li];
      sp.style.cssText = 'font-family:"Press Start 2P",monospace;' +
        'font-size:' + VICTORY_FONT_PX + 'px;color:#C9883A;' +
        '-webkit-text-stroke:0.8px rgba(255,245,220,0.45);' +
        'display:inline-block;opacity:0;filter:blur(10px);transform:scale(1.18);' +
        'text-shadow:' +
          '0 0 2px rgba(255,245,220,0.50),' +
          '0 0 var(--krr-halo-blur) rgba(0,0,0,var(--krr-halo-op)),' +
          '0 2px 5px rgba(0,0,0,0.55),' +
          '0 0 24px rgba(201,136,58,0.65);';
      row.appendChild(sp);
      spans.push(sp);
    }

    // Timeline: V i c t o r y spaced 550ms apart starting at 1200ms; 2s gap; ?
    var STARTS        = [1200, 1750, 2300, 2850, 3400, 3950, 4500, 7600];
    var LETTER_DUR    = 1100;
    var VEIL_PEAK_MS  = 1600;
    var VEIL_MAX      = 0.74;
    var LETTER_DONE   = 7600 + LETTER_DUR;          // ? fully landed = 8700ms
    var FADEOUT_START = LETTER_DONE + holdMs;        // dead air after ? = 10600ms
    var FADEOUT_DUR   = 2400;
    var CARD_DONE_MS  = FADEOUT_START + FADEOUT_DUR; // 13000ms

    var dStartMs = Date.now();
    function tickDramatic() {
      if (cancelled) return;
      var el = Date.now() - dStartMs;
      var veilBase  = Math.min(VEIL_MAX, (el / VEIL_PEAK_MS) * VEIL_MAX);
      var fadeFrac  = el >= FADEOUT_START ? Math.min(1, (el - FADEOUT_START) / FADEOUT_DUR) : 0;
      veil.style.opacity = String(+(veilBase * (1 - fadeFrac)).toFixed(4));
      for (var i = 0; i < 8; i++) {
        var s = STARTS[i]; var spn = spans[i];
        if (el < s) {
          spn.style.opacity = '0'; spn.style.filter = 'blur(10px)'; spn.style.transform = 'scale(1.18)';
        } else {
          var t = (el - s) / LETTER_DUR;
          if (t < 1) {
            var ease = t * t * (3 - 2 * t);
            spn.style.opacity   = String(+(ease * (1 - fadeFrac)).toFixed(4));
            spn.style.filter    = 'blur(' + (10 * (1 - ease)).toFixed(1) + 'px)';
            spn.style.transform = 'scale(' + (1.18 - 0.18 * ease).toFixed(4) + ')';
          } else {
            spn.style.opacity   = String(+(1 - fadeFrac).toFixed(4));
            spn.style.filter    = 'blur(' + (fadeFrac * 6).toFixed(1) + 'px)';
            spn.style.transform = 'scale(1)';
          }
        }
      }
      if (el >= CARD_DONE_MS) {
        cancelled = true;
        if (card.parentNode) card.parentNode.removeChild(card);
        _titleCardEl = null; victoryEl3 = null; _titleCancelFn = null; _victoryCancelFn = null;
        onDone();
        return;
      }
      requestAnimationFrame(tickDramatic);
    }
    requestAnimationFrame(tickDramatic);
    return;
  }

  // ── STANDARD PATH (stage announcements: enter → hold → shrink to top) ──
  _titleCardSuppressSpawn = true;

  var inner = document.createElement('div');
  inner.style.cssText = 'position:absolute;left:50%;top:42%;' +
    'transform:translate(-50%,-50%) scale(1);text-align:center;white-space:nowrap;';
  card.appendChild(inner);

  var titleEl = document.createElement('div');
  titleEl.textContent = opts.title || '';
  titleEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:' + TITLE_FONT_PX + 'px;' +
    'color:#C9883A;-webkit-text-stroke:0.8px rgba(255,245,220,0.45);' +
    'text-shadow:' +
      '0 0 2px rgba(255,245,220,0.50),' +
      '0 0 var(--krr-halo-blur) rgba(0,0,0,var(--krr-halo-op)),' +
      '0 2px 5px rgba(0,0,0,0.55),' +
      '0 0 20px rgba(201,136,58,0.65);' +
    'opacity:0;filter:blur(10px);transform:scale(1.15);display:block;';
  inner.appendChild(titleEl);

  var subEl = null;
  if (opts.subtitle) {
    subEl = document.createElement('div');
    subEl.textContent = opts.subtitle;
    subEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:9px;' +
      'color:#F5F0E8;margin-top:10px;opacity:0;filter:blur(8px);' +
      'transform:scale(1.08);display:block;';
    inner.appendChild(subEl);
  }

  var sStartMs  = Date.now();
  var ENTER_MS  = TITLE_ENTER_MS;
  var HOLD_END  = ENTER_MS + holdMs;
  var DONE_MS   = HOLD_END + TITLE_SHRINK_MS;
  var spawnReleased = false;
  var _shrinkTargetTop = null; // measured lazily at start of SHRINK phase

  function tickStandard() {
    if (cancelled) return;
    var el = Date.now() - sStartMs;

    if (el < ENTER_MS) {
      // ENTER: fade/bloom in
      var t = el / ENTER_MS;
      var ease = t * t * (3 - 2 * t);
      inner.style.opacity = String(+ease.toFixed(4));
      titleEl.style.opacity = String(+ease.toFixed(4));
      titleEl.style.filter = 'blur(' + (10 * (1 - ease)).toFixed(1) + 'px)';
      titleEl.style.transform = 'scale(' + (1.15 - 0.15 * ease).toFixed(4) + ')';
      if (subEl) {
        subEl.style.opacity = String(+(ease * 0.90).toFixed(4));
        subEl.style.filter = 'blur(' + (8 * (1 - ease)).toFixed(1) + 'px)';
        subEl.style.transform = 'scale(' + (1.08 - 0.08 * ease).toFixed(4) + ')';
      }
    } else if (el < HOLD_END) {
      // HOLD: fully visible
      titleEl.style.opacity = '1'; titleEl.style.filter = 'blur(0)'; titleEl.style.transform = 'scale(1)';
      if (subEl) { subEl.style.opacity = '0.90'; subEl.style.filter = 'blur(0)'; subEl.style.transform = 'scale(1)'; }
      inner.style.opacity = '1';
    } else if (el < DONE_MS) {
      // SHRINK: fly up to top-center stage label
      if (!spawnReleased) { _titleCardSuppressSpawn = false; spawnReleased = true; }
      // Measure target once at the first SHRINK frame (HUD is guaranteed visible by now)
      if (_shrinkTargetTop === null) {
        var _stEl = document.getElementById('hud3-stage');
        var _inH  = inner.getBoundingClientRect().height;
        _shrinkTargetTop = 6; // fallback if HUD not visible
        if (_stEl) {
          var _stR = _stEl.getBoundingClientRect();
          if (_stR.width > 0) _shrinkTargetTop = _stR.top + _stR.height / 2 - _inH / 2;
        }
      }
      var t2 = (el - HOLD_END) / TITLE_SHRINK_MS;
      var ease2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2;
      var targetSc = Math.max(0.20, STAGE_LABEL_PX / TITLE_FONT_PX);
      var topPx  = window.innerHeight * 0.42 * (1 - ease2) + _shrinkTargetTop * ease2;
      var tyPct  = -50 * (1 - ease2);
      var sc     = 1 - (1 - targetSc) * ease2;
      inner.style.top = topPx.toFixed(1) + 'px';
      inner.style.transform = 'translate(-50%,' + tyPct.toFixed(1) + '%) scale(' + sc.toFixed(4) + ')';
      inner.style.opacity = String((1 - 0.25 * ease2).toFixed(4));
    } else {
      // Done
      cancelled = true;
      _titleCardSuppressSpawn = false;
      if (card.parentNode) card.parentNode.removeChild(card);
      _titleCardEl = null; victoryEl3 = null; _titleCancelFn = null; _victoryCancelFn = null;
      onDone();
      return;
    }
    requestAnimationFrame(tickStandard);
  }
  requestAnimationFrame(tickStandard);
}

// ── STORY VIEWER ────────────────────────────────────────────────────
var _STORY_FILES = [
  'story-0-opening.jpg', 'story-1.jpg?v=2', 'story-2.jpg?v=2', 'story-3.jpg?v=2',
  'story-4.jpg?v=2',     'story-5.jpg?v=2', 'story-6-final.jpg'
];

function _updateStoryUI() {
  var n = _STORY_FILES.length;
  document.getElementById('story-progress').textContent = (_storyPanel + 1) + ' / ' + n;
  var isLast = (_storyPanel === n - 1);
  document.getElementById('story-back').style.display   = _storyPanel === 0 ? 'none' : '';
  document.getElementById('story-next').style.display   = isLast ? 'none' : '';
  document.getElementById('story-done').style.display   = isLast ? ''     : 'none';
  document.getElementById('story-replay').style.display = isLast ? ''     : 'none';
}

function _storyGoTo(idx, isNext) {
  if (_storyTurning || idx < 0 || idx >= _STORY_FILES.length) return;
  _storyTurning = true;
  _storyPanel   = idx;
  var flip = document.getElementById('story-flip');
  var half = Math.max(80, Math.round(STORY_TURN_MS / 2));
  var dir  = isNext ? -90 : 90;
  // Phase 1: swing the current panel away (edge-on at 90°)
  flip.style.transition = 'transform ' + half + 'ms ease-in';
  flip.style.transform  = 'rotateY(' + dir + 'deg)';
  setTimeout(function() {
    // Panel is edge-on: swap the image, jump to mirror angle, then swing back
    document.getElementById('story-img').src = _STORY_FILES[idx];
    flip.style.transition = 'none';
    flip.style.transform  = 'rotateY(' + (-dir) + 'deg)';
    flip.getBoundingClientRect();                              // force reflow before re-enabling transition
    flip.style.transition = 'transform ' + half + 'ms ease-out';
    flip.style.transform  = 'rotateY(0deg)';
    setTimeout(function() { _storyTurning = false; _updateStoryUI(); }, half);
  }, half);
}

function _openStoryViewer(fromMenu) {
  _storyFromMenu = fromMenu;
  _storyPanel    = 0;
  _storyTurning  = false;
  // Preload all panels into browser cache so turns don't stall
  if (!_storyPreloaded) {
    _storyPreloaded = true;
    for (var _si = 0; _si < _STORY_FILES.length; _si++) {
      var _sImg = new Image(); _sImg.src = _STORY_FILES[_si];
    }
  }
  var sv   = document.getElementById('story-viewer');
  var flip = document.getElementById('story-flip');
  flip.style.transition = 'none';
  flip.style.transform  = 'rotateY(0deg)';
  document.getElementById('story-img').src = _STORY_FILES[0];
  _updateStoryUI();
  // Make visible but transparent, then fade in
  sv.classList.add('sv-visible');
  sv.style.transition    = 'none';
  sv.style.opacity       = '0';
  sv.style.pointerEvents = 'none';
  sv.getBoundingClientRect();                                  // force reflow
  sv.style.transition    = 'opacity 1.2s ease-in';
  sv.style.opacity       = '1';
  sv.style.pointerEvents = 'auto';
}

function _closeStoryViewer() {
  var sv = document.getElementById('story-viewer');
  sv.style.transition    = 'opacity 0.4s ease-out';
  sv.style.opacity       = '0';
  sv.style.pointerEvents = 'none';
  playerGroup.rotation.z = 0;
  if (_storyFromMenu) {
    gameState3 = 'start';
    setTimeout(function() { sv.classList.remove('sv-visible'); showScreen3('start'); }, 450);
  } else {
    gameState3 = 'ending1';
    setTimeout(function() { sv.classList.remove('sv-visible'); showScreen3('ending1'); }, 450);
  }
}

function _initStoryViewer() {
  document.getElementById('story-next').addEventListener('click', function() {
    if (!_storyTurning && _storyPanel < _STORY_FILES.length - 1) _storyGoTo(_storyPanel + 1, true);
  });
  document.getElementById('story-back').addEventListener('click', function() {
    if (!_storyTurning && _storyPanel > 0) _storyGoTo(_storyPanel - 1, false);
  });
  document.getElementById('story-done').addEventListener('click', _closeStoryViewer);
  document.getElementById('story-replay').addEventListener('click', function() {
    if (!_storyTurning) _storyGoTo(0, false);
  });
  document.getElementById('sv-zone-right').addEventListener('click', function() {
    if (!_storyTurning && _storyPanel < _STORY_FILES.length - 1) _storyGoTo(_storyPanel + 1, true);
  });
  document.getElementById('sv-zone-left').addEventListener('click', function() {
    if (!_storyTurning && _storyPanel > 0) _storyGoTo(_storyPanel - 1, false);
  });
  document.getElementById('btn3-story').addEventListener('click', function() {
    document.getElementById('overlay3').classList.add('hidden');
    _openStoryViewer(true);
  });
}

// ── ENDING SEQUENCE ────────────────────────────────────────────────
function startEnding3() {
  if (gameState3 === 'ending1' || gameState3 === 'ending2' || gameState3 === 'forlorn') return;
  if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
  document.getElementById('hud3').classList.remove('visible');
  // Hard-zero speed so all scroll code that reads curSpd3 stops immediately,
  // regardless of which path (decel-beach or direct mile-165) landed here.
  curSpd3 = 0;
  endingSpeedMult = 0;
  _forlornStartMs = Date.now();
  _forlornTipDone = false;
  gameState3 = 'forlorn';
  // Spawn question-mark sprite above the kayaker for the forlorn beat
  new THREE.TextureLoader().load('qmark.png?v=1', function(tex) {
    if (gameState3 !== 'forlorn' || !_forlornStartMs) return;  // story already opened
    var _qMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    _qmarkSpr = new THREE.Sprite(_qMat);
    _qmarkSpr.renderOrder = 25;
    var _qW = 0.55;
    _qmarkSpr.scale.set(_qW, _qW * (tex.image.height / tex.image.width), 1);
    _qmarkSpr.position.set(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z);
    scene.add(_qmarkSpr);
  });
}

// ── WIPEOUT ──────────────────────────────────────────────────────────
// Scripted capsize + kayaker ejection. Plays for WIPEOUT_MS then calls endRun3(false).
// lateralVx: player lateral velocity at impact (Daring: _daringVx, Classic: 0)
// relX: player X minus obstacle center X (positive = player right of obstacle)
function triggerWipeout(lateralVx, relX) {
  if (gameState3 !== 'playing') return;
  lateralVx = lateralVx || 0;
  relX      = relX      || 0;

  gameState3            = 'wipeout';
  _sfxPlay('crash');
  _wipeoutStartMs       = Date.now();
  _wipeoutSplashFired   = false;
  _wipeoutFloating      = false;
  _wipeoutFloatPhase    = 0;
  _wipeoutGlbInScene    = false;
  player3.dead          = true;
  player3.isJumping     = false;
  player3.spinoutFrames = 0;
  _wipeoutPreImpactSpd  = curSpd3;  // ease to rest in animation block; don't hard-freeze
  endingSpeedMult       = 0;

  // ── Direction from hit geometry (eject away from clipped side) ───
  var _absRelX = Math.abs(relX);
  var _absLatV = Math.abs(lateralVx);
  if (_absRelX > 0.08) {
    _wipeoutDir = (relX > 0) ? 1 : -1;   // player right of obstacle → eject right
  } else if (_absLatV > 0.008) {
    _wipeoutDir = (lateralVx > 0) ? 1 : -1;  // eject in direction of travel
  } else {
    _wipeoutDir = (Math.random() < 0.5) ? 1 : -1;
  }

  // ── Magnitude scales with impact speed ───────────────────────────
  _wipeoutMag = Math.min(1.15, 0.82 + _absLatV * 8.0 + _absRelX * 0.4 + Math.random() * 0.18);

  // ── Variant from hit type ─────────────────────────────────────────
  var _laneW = rwCur / curLanes;
  if (_absLatV < 0.012 && _absRelX < _laneW * 0.28) {
    // Head-on: nearly centered, low lateral → nose-dive forward
    _wipeoutVariant = 'endo';
  } else if (_absLatV > 0.028 || _absRelX > _laneW * 0.42) {
    // Hard side hit: fast lateral or off-center → capsize or spin-flip
    _wipeoutVariant = (Math.random() < 0.55) ? 'capsize' : 'spin-flip';
  } else {
    // Mixed: moderate context → weighted random
    var _vr = Math.random();
    _wipeoutVariant = _vr < 0.40 ? 'capsize' : _vr < 0.70 ? 'endo' : 'spin-flip';
  }
  // Float-away: 12% override (slow comedic tumble regardless of hit type)
  if (Math.random() < 0.12) _wipeoutVariant = 'float-away';

  // ── Per-variant ejection velocities (Vy ~50% of old values) ─────
  if (_wipeoutVariant === 'endo') {
    _wipeoutKayakerVy = 0.026 * _wipeoutMag;
    _wipeoutKayakerVx = (Math.random() - 0.5) * 0.012;
    _wipeoutKayakerVz = -0.050 * _wipeoutMag;  // thrown forward (upstream toward camera)
  } else if (_wipeoutVariant === 'spin-flip') {
    _wipeoutKayakerVy = 0.040 * _wipeoutMag;
    _wipeoutKayakerVx = _wipeoutDir * 0.028 * _wipeoutMag;
    _wipeoutKayakerVz = (Math.random() - 0.5) * 0.016;
  } else if (_wipeoutVariant === 'float-away') {
    _wipeoutKayakerVy = 0.020 * _wipeoutMag;
    _wipeoutKayakerVx = _wipeoutDir * 0.014;
    _wipeoutKayakerVz = 0.018;  // gentle downstream drift
  } else { // capsize
    _wipeoutKayakerVy = 0.033 * _wipeoutMag;
    _wipeoutKayakerVx = _wipeoutDir * 0.020 * _wipeoutMag;
    _wipeoutKayakerVz = 0;
  }

  // ── Crash impact: big water-explosion splash at the collision point ─
  var _ix = player3.x, _iz = playerGroup.position.z;
  activateSplash3(_ix,                       _iz,       5.5, 36);  // massive central burst
  activateSplash3(_ix - 0.90,               _iz + 0.5, 3.2, 30);  // left wing
  activateSplash3(_ix + 0.90,               _iz - 0.5, 3.0, 28);  // right wing
  activateSplash3(_ix + _wipeoutDir * 0.45, _iz + 1.0, 2.2, 22);  // directional spray
  activateSplash3(_ix + _wipeoutDir * 0.20, _iz - 0.3, 1.4, 16);  // inner foam puff
  activateSplash3(_ix - _wipeoutDir * 0.30, _iz + 0.2, 1.2, 14);  // counter-spray
  activateDroplets3(_ix, _iz, 20, 2.8);                           // primary arc burst
  activateDroplets3(_ix + _wipeoutDir * 0.5, _iz + 0.4, 10, 2.0); // secondary spray offset

  // ── Orange spill: eject all basket oranges into scene ──────────────
  // Get basket world position; spawn physics oranges from it, empty the basket.
  var _spillCount = Math.min(player3.oranges, BASKET_MAX_VIS);
  if (_spillCount > 0 && _basketGroup) {
    var _bwp = new THREE.Vector3();
    _basketGroup.getWorldPosition(_bwp);
    var _oGeo = new THREE.SphereGeometry(0.10, 6, 4);
    for (var _si = 0; _si < _spillCount; _si++) {
      var _oMat = new THREE.MeshBasicMaterial({ color: 0xF97316 });
      var _oMsh = new THREE.Mesh(_oGeo, _oMat);
      // start at basket, random spread within the pile
      _oMsh.position.set(
        _bwp.x + (Math.random() - 0.5) * 0.25,
        _bwp.y + Math.random() * 0.15,
        _bwp.z + (Math.random() - 0.5) * 0.20
      );
      scene.add(_oMsh);
      var _oSpd = 0.022 + Math.random() * 0.030;
      var _oAng = Math.random() * Math.PI * 2;
      _wipeoutOranges.push({
        mesh:       _oMsh,
        vx:         Math.cos(_oAng) * _oSpd * 0.8,
        vy:         0.045 + Math.random() * 0.055,  // upward burst
        vz:         -(0.015 + Math.random() * 0.025),  // downstream toss (up-screen, toward SPAWN_Z)
        driftVx:    (Math.random() - 0.5) * 0.004,  // gentle surface drift
        driftVz:    -(0.006 + Math.random() * 0.004),  // downstream float (up-screen, toward SPAWN_Z)
        rotSpd:     (Math.random() - 0.5) * 0.18,
        landed:     false,
        floatBaseY: 0.12,
        phase:      Math.random() * Math.PI * 2,
      });
    }

    // ── Pop burst: snappy arcade eruption at the moment of impact ─────
    var POP_COUNT       = 10;    // extra oranges in the burst (on top of basket spill)
    var POP_SPD_MIN     = 0.08;  // min radial x/z burst speed (wu/frame)
    var POP_SPD_MAX     = 0.18;  // max radial x/z burst speed
    var POP_VY_MIN      = 0.10;  // min upward pop velocity
    var POP_VY_MAX      = 0.20;  // max upward pop velocity
    var POP_GRAV        = 0.012; // per-frame gravity — 4× normal; keeps arcs snappy not floaty
    var POP_FRICTION    = 0.90;  // radial drag per frame so they fan out not fly off-screen
    var POP_SCALE_START = 0.15;  // spawn scale (tiny 'just launched' look)
    var POP_SCALE_PEAK  = 1.70;  // oversized peak; eye-catching against busy background
    var POP_SCALE_RISE  = 2;     // frames to pop from start to peak
    var POP_SCALE_FALL  = 10;    // frames to ease from peak back to 1.0
    for (var _pi = 0; _pi < POP_COUNT; _pi++) {
      var _pMat = new THREE.MeshBasicMaterial({ color: 0xF97316 });
      var _pMsh = new THREE.Mesh(_oGeo, _pMat);  // reuse same geometry as spill
      _pMsh.position.set(
        _bwp.x + (Math.random() - 0.5) * 0.20,
        _bwp.y + Math.random() * 0.22,
        _bwp.z + (Math.random() - 0.5) * 0.15
      );
      _pMsh.scale.setScalar(POP_SCALE_START);
      scene.add(_pMsh);
      var _pAng = Math.random() * Math.PI * 2;
      var _pSpd = POP_SPD_MIN + Math.random() * (POP_SPD_MAX - POP_SPD_MIN);
      var _pVy  = POP_VY_MIN  + Math.random() * (POP_VY_MAX  - POP_VY_MIN);
      _wipeoutOranges.push({
        mesh:       _pMsh,
        vx:         Math.cos(_pAng) * _pSpd,
        vy:         _pVy,
        vz:         -(0.020 + Math.random() * 0.030),  // downstream (negative z, up-screen)
        driftVx:    (Math.random() - 0.5) * 0.004,
        driftVz:    -(0.006 + Math.random() * 0.004),  // downstream float (negative z)
        rotSpd:     (Math.random() - 0.5) * 0.30,
        landed:     false,
        floatBaseY: 0.12,
        phase:      Math.random() * Math.PI * 2,
        grav:       POP_GRAV,
        friction:   POP_FRICTION,
        scaleT:     0,
        scaleStart: POP_SCALE_START,
        scalePk:    POP_SCALE_PEAK,
        scaleRise:  POP_SCALE_RISE,
        scaleFall:  POP_SCALE_FALL,
      });
    }
  }
  player3.oranges = 0;  // empties the basket visually on next _updateBasketOranges3 call

  if (_titleCancelFn) { _titleCancelFn(); _titleCancelFn = null; }
  if (_titleCardEl && _titleCardEl.parentNode) { _titleCardEl.parentNode.removeChild(_titleCardEl); _titleCardEl = null; }
  _titleCardSuppressSpawn = false;
  document.getElementById('hud3').classList.remove('visible');
  console.log('[KRR WIPEOUT] variant=' + _wipeoutVariant + ' mag=' + _wipeoutMag.toFixed(2) + ' oranges=' + _spillCount);
}

// ── END RUN ─────────────────────────────────────────────────────────
function endRun3(complete) {
  if (gameState3 === 'gameover' || gameState3 === 'ending1' || gameState3 === 'ending2' || gameState3 === 'beaching' || gameState3 === 'forlorn') return;
  player3.dead = true;
  // Tear down any active stage/ending title card so it doesn't sit above the game-over overlay
  if (_titleCancelFn) { _titleCancelFn(); _titleCancelFn = null; }
  if (_titleCardEl && _titleCardEl.parentNode) { _titleCardEl.parentNode.removeChild(_titleCardEl); _titleCardEl = null; }
  _titleCardSuppressSpawn = false;
  if (score3 > highScore3) { highScore3 = Math.floor(score3); localStorage.setItem('krr3d_hs', highScore3); }
  gameState3 = 'gameover';
  showScreen3('gameover', complete);
}

// ── START GAME ───────────────────────────────────────────────────────
function startGame3() {
  score3 = 0; distance3 = 0; curMile3 = 0; _runOranges = 0;
  _airTrick = false; _airTrickStartFrame = 0; _airTrickType = ''; _airTrickDir = 1;
  _airYaw = 0; _baseFacingY = 0; _reversed = false; _settleYawFrom = 0; _settleYawT = 1.0;
  gapFrames3 = 0; frameN = 0; subsFired3 = new Set(); transMsg3 = null;
  stageIdx = 0; curLanes = STAGES3[0].lanes; rwCur = curLanes * LANE_W; curSpeed3 = STAGES3[0].speed;
  curObsFreq3 = STAGES3[0].obsFreq; endingSpeedMult = 1.0;
  endingBeachStartMs     = 0;
  endingCinematicFired   = false;
  glbTorsoSquashFrames   = 0;
  if (_titleCancelFn) { _titleCancelFn(); _titleCancelFn = null; }
  if (_titleCardEl && _titleCardEl.parentNode) { _titleCardEl.parentNode.removeChild(_titleCardEl); _titleCardEl = null; }
  _titleCardSuppressSpawn = false;
  victoryEl3 = null; _victoryCancelFn = null;
  _poppyPickSt = 0; _poppyPickPp = null; _poppyContactFired = false;
  if (_poppyBloomSpr) { scene.remove(_poppyBloomSpr); _poppyBloomSpr.material.dispose(); _poppyBloomSpr = null; }
  if (_hatPoppySpr)   { _hatPoppySpr.visible = false; }
  _hatKnockSt = 0; _poppyShieldWas = false;
  if (_shieldGroup) { _shieldGroup.visible = false; _shieldGroup.scale.setScalar(1); }
  _shieldBurstSt = 0;
  for (var _sr = 0; _sr < _shardPool.length; _sr++) { _shardPool[_sr].active = false; _shardPool[_sr].mesh.visible = false; }
  narrowing = false;
  camXSmooth = 0;

  const mid = Math.floor(STAGES3[0].lanes / 2);
  player3.lane = mid; player3.targetLane = mid;
  player3.x    = laneXPos(mid);
  player3.isJumping = false; player3.jumpFrame  = 0;
  player3.dead      = false; player3.hasShield  = false; player3.spinoutFrames = 0;
  player3.oranges   = 0;
  for (var _psr = 0; _psr < _scorePopups.length; _psr++) { scene.remove(_scorePopups[_psr].spr); _scorePopups[_psr].spr.material.dispose(); _scorePopups[_psr].tex.dispose(); }
  _scorePopups = [];
  for (var _sor = 0; _sor < _swellOrangeSprites.length; _sor++) { scene.remove(_swellOrangeSprites[_sor].mesh); }
  _swellOrangeSprites = [];
  for (var _ofR = 0; _ofR < _orangeFlights.length; _ofR++) { scene.remove(_orangeFlights[_ofR].mesh); disposeMesh(_orangeFlights[_ofR].mesh); }
  _orangeFlights = [];
  _basketPrevOranges = -1; // force basket re-sync on next frame
  playerGroup.rotation.set(0, 0, 0); playerGroup.position.y = 0;
  _wipeoutStartMs = 0; _wipeoutSplashFired = false; _wipeoutFloating = false; _wipeoutPreImpactSpd = 0;
  if (_wipeoutGlbInScene && _glbModel) {
    scene.remove(_glbModel);
    playerGroup.add(_glbModel);
    _wipeoutGlbInScene = false;
  }
  if (_wipeoutOranges.length > 0) {
    // All oranges share one geometry — dispose it once, then dispose per-mesh materials.
    _wipeoutOranges[0].mesh.geometry.dispose();
    for (var _wor = 0; _wor < _wipeoutOranges.length; _wor++) {
      scene.remove(_wipeoutOranges[_wor].mesh);
      _wipeoutOranges[_wor].mesh.material.dispose();
    }
    _wipeoutOranges = [];
  }
  if (_glbModel) { _glbModel.position.set(0, KAYAKER_Y, 0); _glbModel.rotation.set(0, KAYAKER_ROT_Y, 0); }
  kayakTurnY3 = 0; kayakWasSpinning3 = false; splashWasJumping3 = false;
  paddleSplashPrev3 = 0; wakeChevronTimer3 = 0;
  turnHoldFrames3 = 0; turnDirSign3 = 0; kayakTurnVel3 = 0;
  _daringVx = 0; _daringSteerL = false; _daringSteerR = false;
  _daringRoll3 = 0; _daringRollVel3 = 0;
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

  // Stage 1 title card on game start (subsequent stages are triggered via applyStage3)
  showTitleCard({
    title:    STAGES3[0].name,
    subtitle: 'MILE 0',
    holdMs:   TITLE_HOLD_MS,
    onComplete: function() {}
  });
}

// ── SCREEN MANAGEMENT ────────────────────────────────────────────────
function showScreen3(which, _complete) {
  document.getElementById('overlay3').classList.remove('hidden');
  document.querySelectorAll('.screen3').forEach(s => s.classList.remove('visible'));

  if (which === 'start') {
    document.getElementById('screen3-start').classList.add('visible');
    document.getElementById('hud3').classList.remove('visible');
    playMode3 = null; _updateModeToggleLabel();

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

  } else if (which === 'nameentry') {
    document.getElementById('screen3-nameentry').classList.add('visible');
    document.getElementById('nameentry-score').textContent = 'SCORE: ' + Math.floor(score3);
    var _ni = document.getElementById('sb3-name-input');
    _ni.value = '';
    setTimeout(function() { _ni.focus(); }, 120);

  } else if (which === 'scoreboard') {
    document.getElementById('screen3-scoreboard').classList.add('visible');
  }
}

// ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
// Jump the player to any stage's start mile for fast local testing.
// Stage start miles: 1=0, 2=33, 3=66, 4=99, 5=132.
// To remove: delete this block, the DEV_STAGE_JUMP const above, the
// key handler addition below, and the #dev-stage-label in index.html.
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
  if (!player3.isJumping && gameState3 === 'playing') {
    player3.isJumping = true; player3.jumpFrame = 0;
    _sfxPlay('jump');
  }
  // Second space in the air: no-op (trick is now S / ArrowDown via doTrick3)
}
function doTrick3() {
  if (!player3.isJumping || _airTrick || gameState3 !== 'playing') return;
  if (player3.jumpFrame >= JUMP_DURATION * 0.6) return;
  _airTrick           = true;
  _sfxPlay('trick');
  _airTrickStartFrame = player3.jumpFrame;
  _airTrickDir        = (Math.random() < 0.5 ? 1 : -1);
  var _tTypes = ['roll', 'flip', 'spin'];
  _airTrickType = _tTypes[Math.floor(Math.random() * _tTypes.length)];
  var _tNames = { roll: 'BARREL ROLL!', flip: 'FRONT FLIP!', spin: 'SPIN!' };
  var _trickScore = TRICK_BONUS * (_reversed ? 2 : 1);
  _spawnScorePopup3(playerGroup.position.x, playerGroup.position.y + 1.2, playerGroup.position.z,
                    _tNames[_airTrickType] + (_reversed ? ' ×2' : ''));
  score3 += _trickScore;
}

window.addEventListener('keydown', e => {
  // Story viewer keyboard nav — intercepts before any game input
  if (document.getElementById('story-viewer').classList.contains('sv-visible')) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!_storyTurning && _storyPanel < _STORY_FILES.length - 1) _storyGoTo(_storyPanel + 1, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!_storyTurning && _storyPanel > 0) _storyGoTo(_storyPanel - 1, false);
    } else if ((e.key === 'Enter' || e.key === 'Escape') && _storyPanel === _STORY_FILES.length - 1) {
      _closeStoryViewer();
    }
    return;
  }

  if (gameState3 === 'playing') {
    if (playMode3 === 'daring') {
      // Daring: track held keys for continuous acceleration; jump/pause unchanged
      switch (e.key) {
        case 'ArrowLeft':  case 'a': case 'A': _daringSteerL = true;  break;
        case 'ArrowRight': case 'd': case 'D': _daringSteerR = true;  break;
        case 'ArrowUp': case 'w': case 'W': case ' ': e.preventDefault(); doJump3(); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); doTrick3(); break;
        case 'Escape': case 'p': case 'P': gameState3 = 'paused'; showScreen3('paused'); break;
      }
    } else {
      switch (e.key) {
        case 'ArrowLeft':  case 'a': case 'A': doLeft3();  break;
        case 'ArrowRight': case 'd': case 'D': doRight3(); break;
        case 'ArrowUp': case 'w': case 'W': case ' ': e.preventDefault(); doJump3(); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); doTrick3(); break;
        case 'Escape': case 'p': case 'P':
          gameState3 = 'paused';
          showScreen3('paused');
          break;
      }
    }
    // ===== TEMP DEV STAGE JUMP (REMOVE BEFORE LAUNCH) =====
    if (DEV_STAGE_JUMP && e.key >= '1' && e.key <= '5') {
      devJumpToStage(parseInt(e.key, 10) - 1);
    }
    // ===== END TEMP DEV STAGE JUMP =====
    // ===== TEMP DEV ENDING-JUMP (REMOVE BEFORE LAUNCH) =====
    // Backtick: jump to ENDING_TEST_MILE in Stage 5 to test the cinematic decel + beaching.
    // Key audit: all a-z/0-9 are taken. Backtick (e.key='`') is genuinely free.
    if (e.key === '`') {
      distance3  = ENDING_TEST_MILE * MI_PER_PX;
      subsFired3 = new Set();
      applyStage3(4, 'DEV: ENDING TEST (mile ' + ENDING_TEST_MILE + ')');
    }
    // ===== END TEMP DEV ENDING-JUMP =====
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


    // ===== DECOR GROUND SEAT FINE-TUNER (, / . keys, finer step than [ / ]) =====
    // , = lower -0.01  . = raise +0.01  applies to all far-ground decor via DECOR_SEAT_GND
    {
      var fsmoved = false;
      if (e.key === ',') { DECOR_SEAT_GND = +(DECOR_SEAT_GND - 0.01).toFixed(3); fsmoved = true; }
      if (e.key === '.') { DECOR_SEAT_GND = +(DECOR_SEAT_GND + 0.01).toFixed(3); fsmoved = true; }
      if (fsmoved) { console.log('[KRR DECORSEAT] DECOR_SEAT_GND=' + DECOR_SEAT_GND.toFixed(3) + ' farmhouse_base=' + (DECOR_SEAT_GND - 3.21).toFixed(3)); }
    }
    // ===== END DECOR GROUND SEAT FINE-TUNER =====

    // ===== DECOR GROUND SEAT TUNER (all far-ground decor: houses, stumps, fishing, trees, boulders) =====
    // [ = lower -0.02  ] = raise +0.02   applies live via per-frame Y writes; farmhouse tracks as DECOR_SEAT_GND - 3.21
    {
      var _bbm = false;
      if (e.key === '[' && !e.ctrlKey) { DECOR_SEAT_GND = +(DECOR_SEAT_GND - 0.02).toFixed(3); _bbm = true; }
      if (e.key === ']' && !e.ctrlKey) { DECOR_SEAT_GND = +(DECOR_SEAT_GND + 0.02).toFixed(3); _bbm = true; }
      if (_bbm) { console.log('[KRR DECORSEAT] DECOR_SEAT_GND=' + DECOR_SEAT_GND.toFixed(3) + ' farmhouse_base=' + (DECOR_SEAT_GND - 3.21).toFixed(3)); }
    }
    // ===== END DECOR GROUND SEAT TUNER =====

    // ===== DECOR_SINK_TRIM TUNER (Ctrl+, / Ctrl+.) =====
    // Subtracts from padFrac to lift sprites that the alpha scan anchors a touch too low.
    // Ctrl+, = trim -0.005 (lift anchors)   Ctrl+. = trim +0.005 (sink anchors)
    if (e.ctrlKey && !e.shiftKey && e.key === ',') { e.preventDefault(); DECOR_SINK_TRIM = +(DECOR_SINK_TRIM - 0.005).toFixed(3); _applyAllDecorCenters(); console.log('[KRR SINKTRIM] DECOR_SINK_TRIM=' + DECOR_SINK_TRIM); }
    if (e.ctrlKey && !e.shiftKey && e.key === '.') { e.preventDefault(); DECOR_SINK_TRIM = +(DECOR_SINK_TRIM + 0.005).toFixed(3); _applyAllDecorCenters(); console.log('[KRR SINKTRIM] DECOR_SINK_TRIM=' + DECOR_SINK_TRIM); }
    // ===== END DECOR_SINK_TRIM TUNER =====

    // ===== ORANGE FLIGHT DURATION TUNER =====
    // < (Shift+,) = shorter -25ms   > (Shift+.) = longer +25ms
    {
      var _ofm = false;
      if (e.key === '<') { ORANGE_FLIGHT_MS = Math.max(100, ORANGE_FLIGHT_MS - 25); _ofm = true; }
      if (e.key === '>') { ORANGE_FLIGHT_MS = Math.min(1000, ORANGE_FLIGHT_MS + 25); _ofm = true; }
      if (_ofm) { console.log('[KRR OFLT] ORANGE_FLIGHT_MS=' + ORANGE_FLIGHT_MS); }
    }
    // ===== END ORANGE FLIGHT DURATION TUNER =====

    // ===== TITLE CARD HALO TUNER =====
    // { (Shift+[) = halo blur -1px   } (Shift+]) = halo blur +1px
    // _ (Shift+-)  = halo opacity -0.05   + (Shift+=) = halo opacity +0.05
    // Changes are live: active title card letters repaint immediately.
    {
      var _thm = false;
      if (e.key === '{') { TITLE_HALO_BLUR = Math.max(0, TITLE_HALO_BLUR - 1); _thm = true; }
      if (e.key === '}') { TITLE_HALO_BLUR = Math.min(40, TITLE_HALO_BLUR + 1); _thm = true; }
      if (e.key === '_') { TITLE_HALO_OP = Math.max(0, +(TITLE_HALO_OP - 0.05).toFixed(2)); _thm = true; }
      if (e.key === '+') { TITLE_HALO_OP = Math.min(1, +(TITLE_HALO_OP + 0.05).toFixed(2)); _thm = true; }
      if (_thm) {
        document.documentElement.style.setProperty('--krr-halo-blur', TITLE_HALO_BLUR + 'px');
        document.documentElement.style.setProperty('--krr-halo-op', String(TITLE_HALO_OP));
        console.log('[KRR HALO] TITLE_HALO_BLUR=' + TITLE_HALO_BLUR + ' TITLE_HALO_OP=' + TITLE_HALO_OP.toFixed(2));
      }
    }
    // ===== END TITLE CARD HALO TUNER =====

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

    // ===== TEMP FW2 RAFT SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // f = raft down (more negative) ; r = raft up
    if (stageIdx === 1) {
      var fw2m = false;
      if (e.key === 'f') { FW2_SEAT_Y -= 0.25; fw2m = true; }
      if (e.key === 'r') { FW2_SEAT_Y += 0.25; fw2m = true; }
      if (fw2m) {
        for (var fw2i = 0; fw2i < obstacles3.length; fw2i++) {
          var fw2o = obstacles3[fw2i];
          if (fw2o.type === 'raft_train' && fw2o.fullWidth && fw2o.mesh.userData.raftSpriteMesh) {
            fw2o.mesh.userData.raftSpriteMesh.position.y = FW2_SEAT_Y;
            if (fw2o.mesh.userData.raftHullMesh && fw2o.mesh.userData.raftHullBaseOff !== undefined) {
              fw2o.mesh.userData.raftHullMesh.position.y = FW2_SEAT_Y + fw2o.mesh.userData.raftHullBaseOff - FW_HULL_H / 2;
            }
          }
        }
        console.log('[KRR FW2SEAT] y=' + FW2_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP FW2 RAFT SEAT TUNER =====

    // ===== TEMP HULL HEIGHT TUNER (REMOVE BEFORE LAUNCH) =====
    // e = hull thinner (-0.05) ; q = hull thicker (+0.05) (Stage 2 only)
    if (stageIdx === 1) {
      var fwhm = false;
      if (e.key === 'e') { FW_HULL_H = Math.max(0.02, +(FW_HULL_H - 0.05).toFixed(2)); fwhm = true; }
      if (e.key === 'q') { FW_HULL_H = +(FW_HULL_H + 0.05).toFixed(2); fwhm = true; }
      if (fwhm) {
        for (var fwhi = 0; fwhi < obstacles3.length; fwhi++) {
          var fwho = obstacles3[fwhi];
          if (fwho.type === 'raft_train' && fwho.fullWidth && fwho.mesh.userData.raftHullMesh) {
            var rtHullM = fwho.mesh.userData.raftHullMesh;
            rtHullM.geometry.dispose();
            rtHullM.geometry = new THREE.BoxGeometry(riverWidth() * 0.9, FW_HULL_H, FW_HULL_D);
            rtHullM.position.y = FW2_SEAT_Y + fwho.mesh.userData.raftHullBaseOff - FW_HULL_H / 2;
          }
        }
        console.log('[KRR HULL] h=' + FW_HULL_H.toFixed(2) + ' d=' + FW_HULL_D.toFixed(2));
      }
    }
    // ===== END TEMP HULL HEIGHT TUNER =====

    // ===== TEMP FW4 DONUT-RAFT SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // l = raft down (-0.25) ; s = raft up (+0.25) (Stage 4 only)
    if (stageIdx === 3) {
      var fw4m = false;
      if (e.key === 'l') { FW4_SEAT_Y -= 0.25; fw4m = true; }
      if (e.key === 's') { FW4_SEAT_Y += 0.25; fw4m = true; }
      if (fw4m) {
        for (var fw4i = 0; fw4i < obstacles3.length; fw4i++) {
          var fw4o = obstacles3[fw4i];
          if (fw4o.type === 'old_mining_bridge' && fw4o.fullWidth && fw4o.mesh.userData.mineSpriteMesh) {
            fw4o.mesh.userData.mineSpriteMesh.position.y = FW4_SEAT_Y;
          }
        }
        console.log('[KRR FW4SEAT] y=' + FW4_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP FW4 DONUT-RAFT SEAT TUNER =====

    // ===== TEMP FW3 BRIDGE SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // 8 = bridge down (-0.25) ; 9 = bridge up (+0.25) (Stage 3 only)
    if (stageIdx === 2) {
      var fw3m = false;
      if (e.key === '8') { FW3_SEAT_Y -= 0.25; fw3m = true; }
      if (e.key === '9') { FW3_SEAT_Y += 0.25; fw3m = true; }
      if (fw3m) {
        for (var fw3i = 0; fw3i < obstacles3.length; fw3i++) {
          var fw3o = obstacles3[fw3i];
          if (fw3o.type === 'pontoon_party' && fw3o.fullWidth && fw3o.mesh.userData.bridgeSpriteMesh3) {
            fw3o.mesh.userData.bridgeSpriteMesh3.position.y = FW3_SEAT_Y;
          }
        }
        console.log('[KRR FW3SEAT] y=' + FW3_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP FW3 BRIDGE SEAT TUNER =====

    // ===== TEMP FW1 BRIDGE SEAT TUNER (REMOVE BEFORE LAUNCH) =====
    // 6 = bridge down (-0.25) ; 7 = bridge up (+0.25) (Stage 1 only)
    if (stageIdx === 0) {
      var fw1m = false;
      if (e.key === '6') { FW1_SEAT_Y -= 0.25; fw1m = true; }
      if (e.key === '7') { FW1_SEAT_Y += 0.25; fw1m = true; }
      if (fw1m) {
        for (var fw1i = 0; fw1i < obstacles3.length; fw1i++) {
          var fw1o = obstacles3[fw1i];
          if (fw1o.type === 'fallen_sequoia' && fw1o.fullWidth && fw1o.mesh.userData.bridgeSpriteMesh) {
            fw1o.mesh.userData.bridgeSpriteMesh.position.y = FW1_SEAT_Y;
          }
        }
        console.log('[KRR FW1SEAT] y=' + FW1_SEAT_Y.toFixed(2));
      }
    }
    // ===== END TEMP FW1 BRIDGE SEAT TUNER =====

    // ===== TEMP RIVER_WASH VISUAL TUNER (REMOVE BEFORE LAUNCH) =====
    // 0 = cycle param | - = decrease | = = increase (ungated, works in all stages)
    // params: 0=arms  1=turns  2=coreAlpha  3=blur  4=spin  5=size
    {
      var rwTuned = false;
      if (e.key === '0') { rwTunerParam = (rwTunerParam + 1) % 8; rwTuned = true; }
      if (e.key === '-' || e.key === '=') {
        var rwDelta = (e.key === '=') ? 1 : -1;
        if (rwTunerParam === 0) { RW_ARMS         = Math.max(1, RW_ARMS + rwDelta); }
        if (rwTunerParam === 1) { RW_TURNS        = Math.max(0.2, +(RW_TURNS + rwDelta * 0.1).toFixed(2)); }
        if (rwTunerParam === 2) { RW_CORE_ALPHA   = Math.min(1, Math.max(0, +(RW_CORE_ALPHA + rwDelta * 0.05).toFixed(2))); }
        if (rwTunerParam === 3) { RW_BLUR_PX      = Math.max(0, RW_BLUR_PX + rwDelta); }
        if (rwTunerParam === 4) { RW_SPIN_SPEED   = Math.max(0, +(RW_SPIN_SPEED + rwDelta * 0.01).toFixed(3)); }
        if (rwTunerParam === 5) { RW_SPIRAL_SIZE  = Math.max(0.5, +(RW_SPIRAL_SIZE + rwDelta * 0.1).toFixed(2)); }
        if (rwTunerParam === 6) { RW_FLECK_COUNT  = Math.max(0, RW_FLECK_COUNT + rwDelta * 5); }
        if (rwTunerParam === 7) { RW_SWIRL_BRIGHT = Math.max(-50, Math.min(50, RW_SWIRL_BRIGHT + rwDelta * 5)); }
        rwTuned = true;
      }
      if (rwTuned) {
        buildRwSpiral();
        if (rwTunerParam === 5) {
          for (var rwti = 0; rwti < obstacles3.length; rwti++) {
            var rwto = obstacles3[rwti];
            if (rwto.type === 'river_wash' && rwto.mesh.userData.spiralDisc) {
              rwto.mesh.userData.spiralDisc.geometry.dispose();
              rwto.mesh.userData.spiralDisc.geometry = new THREE.CircleGeometry(RW_SPIRAL_SIZE / 2, 48);
            }
          }
        }
        console.log('[KRR RWASH] param=' + ['arms','turns','coreA','blur','spin','size','flecks','bright'][rwTunerParam] + ' arms=' + RW_ARMS + ' turns=' + RW_TURNS.toFixed(2) + ' coreA=' + RW_CORE_ALPHA.toFixed(2) + ' blur=' + RW_BLUR_PX + ' spin=' + RW_SPIN_SPEED.toFixed(3) + ' size=' + RW_SPIRAL_SIZE.toFixed(2) + ' flecks=' + RW_FLECK_COUNT + ' bright=' + RW_SWIRL_BRIGHT);
      }
    }
    // ===== END TEMP RIVER_WASH VISUAL TUNER =====

    // ===== TEMP BOULDER GLB TUNER (REMOVE BEFORE LAUNCH) =====
    // F6 = cycle selected model (0=dome boulder-2, 1=slab boulder-3, 2=tall boulder-5)
    // F7 = BOULDER_GLB_SEAT_Y -0.02 (global) ; F8 = +0.02
    // F9 = BOULDER_GLB_SCALE[sel] -0.05 ; F10 = +0.05
    // Updates all live GLB boulders immediately; new spawns also use the updated values.
    {
      var bldChanged = false;
      if (e.key === 'F6') {
        e.preventDefault();
        _boulderTunerSel = (_boulderTunerSel + 1) % 3;
        console.log('[KRR BOULDER] sel=' + _boulderTunerSel + ' (0=dome,1=slab,2=tall) seatY=' + BOULDER_GLB_SEAT_Y.toFixed(3) + ' scale=[' + BOULDER_GLB_SCALE.map(function(v) { return v.toFixed(3); }).join(',') + ']');
      }
      if (e.key === 'F7' && !e.ctrlKey)  { e.preventDefault(); BOULDER_GLB_SEAT_Y = +(BOULDER_GLB_SEAT_Y - 0.02).toFixed(3); bldChanged = true; }
      if (e.key === 'F8' && !e.ctrlKey)  { e.preventDefault(); BOULDER_GLB_SEAT_Y = +(BOULDER_GLB_SEAT_Y + 0.02).toFixed(3); bldChanged = true; }
      if (e.key === 'F9'  && !e.shiftKey) { e.preventDefault(); BOULDER_GLB_SCALE[_boulderTunerSel] = Math.max(0.10, +(BOULDER_GLB_SCALE[_boulderTunerSel] - 0.05).toFixed(3)); bldChanged = true; }
      if (e.key === 'F10' && !e.shiftKey) { e.preventDefault(); BOULDER_GLB_SCALE[_boulderTunerSel] = +(BOULDER_GLB_SCALE[_boulderTunerSel] + 0.05).toFixed(3); bldChanged = true; }
      if (bldChanged) {
        for (var bli = 0; bli < obstacles3.length; bli++) {
          var blo = obstacles3[bli];
          if ((blo.type === 'boulder' || blo.type === 'boulder_wide') && blo.mesh.userData.isBoulderGlb) {
            var bGlbIdx2 = blo.mesh.userData.boulderGlbIdx;
            var bGlbRaw2 = blo.mesh.userData.boulderGlbRaw;
            var bLns2    = blo.mesh.userData.boulderLanes;
            var bNewS2   = (bGlbRaw2 > 0.01 ? ((LANE_W * bLns2) / bGlbRaw2) : 1) * BOULDER_GLB_SCALE[bGlbIdx2];
            blo.mesh.children[0].scale.setScalar(bNewS2);
            blo.mesh.children[0].position.y = BOULDER_GLB_SEAT_Y;
          }
        }
        console.log('[KRR BOULDER] sel=' + _boulderTunerSel + ' seatY=' + BOULDER_GLB_SEAT_Y.toFixed(3) + ' scale=[' + BOULDER_GLB_SCALE.map(function(v) { return v.toFixed(3); }).join(',') + ']');
      }
    }
    // ===== END TEMP BOULDER GLB TUNER =====

    // ===== TEMP DEV POPPY TUNER =====
    // F11/F12 = POPPY_BANK_OFF -/+   Shift+F11/F12 = POPPY_W -/+   Ctrl+Shift+F11/F12 = POPPY_GLOW_SCALE -/+
    {
      var _ppChanged = false;
      if (e.key === 'F11' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPPY_BANK_OFF = Math.max(0.10, +(POPPY_BANK_OFF - 0.05).toFixed(2)); _ppChanged = true; }
      if (e.key === 'F12' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPPY_BANK_OFF = +(POPPY_BANK_OFF + 0.05).toFixed(2); _ppChanged = true; }
      if (e.key === 'F11' &&  e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPPY_W = Math.max(0.30, +(POPPY_W - 0.10).toFixed(2)); _ppChanged = true; }
      if (e.key === 'F12' &&  e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPPY_W = +(POPPY_W + 0.10).toFixed(2); _ppChanged = true; }
      if (e.key === 'F11' &&  e.shiftKey &&  e.ctrlKey) { e.preventDefault(); POPPY_GLOW_SCALE = Math.max(0.10, +(POPPY_GLOW_SCALE - 0.10).toFixed(2)); _ppChanged = true; }
      if (e.key === 'F12' &&  e.shiftKey &&  e.ctrlKey) { e.preventDefault(); POPPY_GLOW_SCALE = +(POPPY_GLOW_SCALE + 0.10).toFixed(2); _ppChanged = true; }
      if (_ppChanged) {
        var _ppRw = riverWidth();
        for (var _ppti = 0; _ppti < bankPoppies3.length; _ppti++) {
          var _ppt = bankPoppies3[_ppti];
          var _pptTX = _ppt.side * (_ppRw / 2 + POPPY_BANK_OFF);
          _ppt.sprite.position.x = _pptTX + (0.5 - _ppt.tuftU) * POPPY_W;
          _ppt.sprite.position.y = POPPY_SEAT_Y;
          _ppt.sprite.scale.set(POPPY_W, 0.7305 * POPPY_W, 1);
          if (_ppt.glow && !_ppt.picked) {
            var _pptBX = _pptTX + (_ppt.bloomU - _ppt.tuftU) * POPPY_W;
            var _pptBY = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W;
            _ppt.glow.position.set(_pptBX, _pptBY, _ppt.z);
            _ppt.glow.scale.setScalar(POPPY_GLOW_SCALE * POPPY_W);
          }
        }
        // Log bloom reach from water center for left bank (tuftU=0.16, bloomU=0.80)
        var _ppBXSamp = _ppRw / 2 + POPPY_BANK_OFF + (0.80 - 0.16) * POPPY_W;
        var _ppBloomReach = _ppBXSamp - _ppRw / 2;
        console.log('[KRR POPPY] bankOff=' + POPPY_BANK_OFF.toFixed(2) + ' W=' + POPPY_W.toFixed(2) + ' seatY=' + POPPY_SEAT_Y.toFixed(2) + ' glow=' + POPPY_GLOW_SCALE.toFixed(2) + ' bloomReach=' + _ppBloomReach.toFixed(3));
      }
    }
    // Shift+F9 = POPPY_SEAT_Y -0.05   Shift+F10 = POPPY_SEAT_Y +0.05
    if (e.key === 'F9' && e.shiftKey) {
      e.preventDefault();
      POPPY_SEAT_Y = Math.max(0, +(POPPY_SEAT_Y - 0.05).toFixed(2));
      for (var _syti = 0; _syti < bankPoppies3.length; _syti++) {
        bankPoppies3[_syti].sprite.position.y = POPPY_SEAT_Y;
        if (bankPoppies3[_syti].glow && !bankPoppies3[_syti].picked) bankPoppies3[_syti].glow.position.y = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W;
      }
      console.log('[KRR POPPY] seatY=' + POPPY_SEAT_Y.toFixed(2));
    }
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      POPPY_SEAT_Y = +(POPPY_SEAT_Y + 0.05).toFixed(2);
      for (var _syti2 = 0; _syti2 < bankPoppies3.length; _syti2++) {
        bankPoppies3[_syti2].sprite.position.y = POPPY_SEAT_Y;
        if (bankPoppies3[_syti2].glow && !bankPoppies3[_syti2].picked) bankPoppies3[_syti2].glow.position.y = POPPY_SEAT_Y + 0.86 * 0.7305 * POPPY_W;
      }
      console.log('[KRR POPPY] seatY=' + POPPY_SEAT_Y.toFixed(2));
    }
    // ===== END TEMP DEV POPPY TUNER =====

    // ===== TEMP NARROW_MILES TUNER =====
    // Shift+F7 = NARROW_MILES -0.5   Shift+F8 = NARROW_MILES +0.5
    if (e.key === 'F7' && e.shiftKey) { e.preventDefault(); NARROW_MILES = Math.max(0.5, +(NARROW_MILES - 0.5).toFixed(1)); console.log('[KRR NARROW] NARROW_MILES=' + NARROW_MILES.toFixed(1)); }
    if (e.key === 'F8' && e.shiftKey) { e.preventDefault(); NARROW_MILES = +(NARROW_MILES + 0.5).toFixed(1); console.log('[KRR NARROW] NARROW_MILES=' + NARROW_MILES.toFixed(1)); }
    // ===== END TEMP NARROW_MILES TUNER =====

    // ===== TEMP S5 DENSITY TUNER =====
    // Ctrl+F7/F8 = S5_BOULDER_COUNT -1/+1   Ctrl+F9/F10 = S5_TREE_COUNT -1/+1   Ctrl+F11/F12 = S5_POOL_BASE -1/+1
    if (e.key === 'F7' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_BOULDER_COUNT = Math.max(0, S5_BOULDER_COUNT - 1); console.log('[KRR S5] S5_BOULDER_COUNT=' + S5_BOULDER_COUNT); }
    if (e.key === 'F8' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_BOULDER_COUNT++; console.log('[KRR S5] S5_BOULDER_COUNT=' + S5_BOULDER_COUNT); }
    if (e.key === 'F9' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_TREE_COUNT = Math.max(0, S5_TREE_COUNT - 1); console.log('[KRR S5] S5_TREE_COUNT=' + S5_TREE_COUNT); }
    if (e.key === 'F10' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_TREE_COUNT++; console.log('[KRR S5] S5_TREE_COUNT=' + S5_TREE_COUNT); }
    if (e.key === 'F11' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_POOL_BASE = Math.max(1, S5_POOL_BASE - 1); console.log('[KRR S5] S5_POOL_BASE=' + S5_POOL_BASE); }
    if (e.key === 'F12' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_POOL_BASE++; console.log('[KRR S5] S5_POOL_BASE=' + S5_POOL_BASE); }
    // Ctrl+Shift+A/Z = S5_XOFF_MIN -/+0.5   Ctrl+Shift+P/Q = S5_XOFF_RANGE -/+2
    if (e.key === 'a' && e.ctrlKey && e.shiftKey) { e.preventDefault(); S5_XOFF_MIN = Math.max(0, +(S5_XOFF_MIN - 0.5).toFixed(1)); console.log('[KRR S5 XOFF] MIN=' + S5_XOFF_MIN + ' RANGE=' + S5_XOFF_RANGE + ' → ' + S5_XOFF_MIN + '..' + (S5_XOFF_MIN + S5_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'z' && e.ctrlKey && e.shiftKey) { e.preventDefault(); S5_XOFF_MIN = +(S5_XOFF_MIN + 0.5).toFixed(1); console.log('[KRR S5 XOFF] MIN=' + S5_XOFF_MIN + ' RANGE=' + S5_XOFF_RANGE + ' → ' + S5_XOFF_MIN + '..' + (S5_XOFF_MIN + S5_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'p' && e.ctrlKey && e.shiftKey) { e.preventDefault(); S5_XOFF_RANGE = Math.max(1, +(S5_XOFF_RANGE - 2.0).toFixed(1)); console.log('[KRR S5 XOFF] MIN=' + S5_XOFF_MIN + ' RANGE=' + S5_XOFF_RANGE + ' → ' + S5_XOFF_MIN + '..' + (S5_XOFF_MIN + S5_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'q' && e.ctrlKey && e.shiftKey) { e.preventDefault(); S5_XOFF_RANGE = +(S5_XOFF_RANGE + 2.0).toFixed(1); console.log('[KRR S5 XOFF] MIN=' + S5_XOFF_MIN + ' RANGE=' + S5_XOFF_RANGE + ' → ' + S5_XOFF_MIN + '..' + (S5_XOFF_MIN + S5_XOFF_RANGE).toFixed(1) + 'wu'); }
    // Ctrl+Shift+E/R = FLAT_XOFF_MIN -/+0.5   Ctrl+Shift+W/X = FLAT_XOFF_RANGE -/+2  (stages 1 & 3)
    if (e.key === 'e' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FLAT_XOFF_MIN = Math.max(0, +(FLAT_XOFF_MIN - 0.5).toFixed(1)); console.log('[KRR FLAT XOFF] MIN=' + FLAT_XOFF_MIN + ' RANGE=' + FLAT_XOFF_RANGE + ' → ' + FLAT_XOFF_MIN + '..' + (FLAT_XOFF_MIN + FLAT_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'r' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FLAT_XOFF_MIN = +(FLAT_XOFF_MIN + 0.5).toFixed(1); console.log('[KRR FLAT XOFF] MIN=' + FLAT_XOFF_MIN + ' RANGE=' + FLAT_XOFF_RANGE + ' → ' + FLAT_XOFF_MIN + '..' + (FLAT_XOFF_MIN + FLAT_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'w' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FLAT_XOFF_RANGE = Math.max(1, +(FLAT_XOFF_RANGE - 2.0).toFixed(1)); console.log('[KRR FLAT XOFF] MIN=' + FLAT_XOFF_MIN + ' RANGE=' + FLAT_XOFF_RANGE + ' → ' + FLAT_XOFF_MIN + '..' + (FLAT_XOFF_MIN + FLAT_XOFF_RANGE).toFixed(1) + 'wu'); }
    if (e.key === 'x' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FLAT_XOFF_RANGE = +(FLAT_XOFF_RANGE + 2.0).toFixed(1); console.log('[KRR FLAT XOFF] MIN=' + FLAT_XOFF_MIN + ' RANGE=' + FLAT_XOFF_RANGE + ' → ' + FLAT_XOFF_MIN + '..' + (FLAT_XOFF_MIN + FLAT_XOFF_RANGE).toFixed(1) + 'wu'); }
    // Ctrl+Shift+B/H = TREE_XOFF_BIAS -/+0.05 (B=more outward skew, H=more uniform; live — affects recycle)
    if (e.key === 'b' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TREE_XOFF_BIAS = Math.max(0.05, +(TREE_XOFF_BIAS - 0.05).toFixed(2)); console.log('[KRR TREE BIAS] TREE_XOFF_BIAS=' + TREE_XOFF_BIAS + ' (~' + Math.round((1 - Math.pow(0.5, TREE_XOFF_BIAS)) * 100) + '% in outer half)'); }
    if (e.key === 'h' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TREE_XOFF_BIAS = Math.min(2.00, +(TREE_XOFF_BIAS + 0.05).toFixed(2)); console.log('[KRR TREE BIAS] TREE_XOFF_BIAS=' + TREE_XOFF_BIAS + ' (~' + Math.round((1 - Math.pow(0.5, TREE_XOFF_BIAS)) * 100) + '% in outer half)'); }
    // ===== END TEMP S5 DENSITY TUNER =====

    // ===== TEMP SHORE APRON TUNER =====
    // Ctrl+Shift+F1/F2 = SHORE_W -/+0.1   Ctrl+Shift+F3/F4 = SHORE_TOE_Y -/+0.05
    if (e.key === 'F1' && e.ctrlKey && e.shiftKey) { e.preventDefault(); SHORE_W = Math.max(0.1, +(SHORE_W - 0.1).toFixed(2)); console.log('[KRR SHORE] SHORE_W=' + SHORE_W.toFixed(2) + ' SHORE_TOE_Y=' + SHORE_TOE_Y.toFixed(2)); }
    if (e.key === 'F2' && e.ctrlKey && e.shiftKey) { e.preventDefault(); SHORE_W = +(SHORE_W + 0.1).toFixed(2); console.log('[KRR SHORE] SHORE_W=' + SHORE_W.toFixed(2) + ' SHORE_TOE_Y=' + SHORE_TOE_Y.toFixed(2)); }
    if (e.key === 'F3' && e.ctrlKey && e.shiftKey) { e.preventDefault(); SHORE_TOE_Y = Math.max(0, +(SHORE_TOE_Y - 0.05).toFixed(2)); console.log('[KRR SHORE] SHORE_W=' + SHORE_W.toFixed(2) + ' SHORE_TOE_Y=' + SHORE_TOE_Y.toFixed(2)); }
    if (e.key === 'F4' && e.ctrlKey && e.shiftKey) { e.preventDefault(); SHORE_TOE_Y = +(SHORE_TOE_Y + 0.05).toFixed(2); console.log('[KRR SHORE] SHORE_W=' + SHORE_W.toFixed(2) + ' SHORE_TOE_Y=' + SHORE_TOE_Y.toFixed(2)); }
    // Note: tuning SHORE_W or SHORE_TOE_Y takes effect on the next buildWorld() call (stage enter or DEV jump)
    // ===== END TEMP SHORE APRON TUNER =====

    // ===== TEMP POPPY PICK TIMING TUNER =====
    // Ctrl+F1/F2 = POPPY_PULL_MS -/+50   Ctrl+F3/F4 = POPPY_REACH_MS -/+25   Ctrl+F5/F6 = POPPY_RETRACT_MS -/+25
    if (e.key === 'F1' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_PULL_MS = Math.max(400, POPPY_PULL_MS - 50); console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    if (e.key === 'F2' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_PULL_MS += 50; console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    if (e.key === 'F3' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_REACH_MS = Math.max(100, POPPY_REACH_MS - 25); console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    if (e.key === 'F4' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_REACH_MS = Math.min(900, POPPY_REACH_MS + 25); console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    if (e.key === 'F5' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_RETRACT_MS = Math.max(100, POPPY_RETRACT_MS - 25); console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    if (e.key === 'F6' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); POPPY_RETRACT_MS += 25; console.log('[KRR POPPY TIMING] PULL=' + POPPY_PULL_MS + ' REACH=' + POPPY_REACH_MS + ' RETRACT=' + POPPY_RETRACT_MS); }
    // ===== END TEMP POPPY PICK TIMING TUNER =====

    // ===== TEMP POPPY HAT POSITION TUNER (model-space coords) =====
    // Ctrl+Shift+Y/U = MY -/+0.02  I/O = MZ -/+0.02  G/J = MX -/+0.02  K/L = SCALE -/+0.02
    // Ctrl+Shift+C/V = TILT -/+0.02  N/M = SWAY_K -/+0.05
    var _hatTunerLog = function() { console.log('[KRR HAT] MX=' + POPPY_HAT_MX.toFixed(3) + ' MY=' + POPPY_HAT_MY.toFixed(3) + ' MZ=' + POPPY_HAT_MZ.toFixed(3) + ' SCALE=' + POPPY_HAT_SCALE.toFixed(2) + ' TILT=' + POPPY_HAT_TILT.toFixed(3) + ' SWAY_K=' + POPPY_HAT_SWAY_K.toFixed(3)); };
    var _hatTunerApply = function() {
      if (_hatPoppySpr) {
        if (glbTorsoGroup && _hatPoppySpr.parent === glbTorsoGroup) {
          _hatPoppySpr.position.set(POPPY_HAT_MX, POPPY_HAT_MY - TORSO_HINGE_Y, POPPY_HAT_MZ - TORSO_HINGE_Z);
        }
        var _hs2 = POPPY_HAT_SCALE; _hatPoppySpr.scale.set(_hs2 / 1.24, _hs2, 1);
      }
    };
    if (e.key === 'y' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MY = +(POPPY_HAT_MY - 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'u' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MY = +(POPPY_HAT_MY + 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'i' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MZ = +(POPPY_HAT_MZ - 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'o' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MZ = +(POPPY_HAT_MZ + 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'g' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MX = +(POPPY_HAT_MX - 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'j' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_MX = +(POPPY_HAT_MX + 0.02).toFixed(3); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'k' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_SCALE = Math.max(0.05, +(POPPY_HAT_SCALE - 0.02).toFixed(2)); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'l' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_SCALE = +(POPPY_HAT_SCALE + 0.02).toFixed(2); _hatTunerApply(); _hatTunerLog(); }
    if (e.key === 'c' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_TILT = +(POPPY_HAT_TILT - 0.02).toFixed(3); _hatTunerLog(); }
    if (e.key === 'v' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_TILT = +(POPPY_HAT_TILT + 0.02).toFixed(3); _hatTunerLog(); }
    if (e.key === 'n' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_SWAY_K = +(POPPY_HAT_SWAY_K - 0.05).toFixed(3); _hatTunerLog(); }
    if (e.key === 'm' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_HAT_SWAY_K = +(POPPY_HAT_SWAY_K + 0.05).toFixed(3); _hatTunerLog(); }
    // ===== END TEMP POPPY HAT POSITION TUNER =====

    // ===== TEMP TORSO HINGE TUNER =====
    // Ctrl+Shift+F7/F8 = TORSO_HINGE_Y -/+0.01   Ctrl+Shift+F9/F10 = TORSO_HINGE_Z -/+0.01
    if (e.key === 'F7' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TORSO_HINGE_Y = +(TORSO_HINGE_Y - 0.01).toFixed(3); _applyTorsoHinge(); }
    if (e.key === 'F8' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TORSO_HINGE_Y = +(TORSO_HINGE_Y + 0.01).toFixed(3); _applyTorsoHinge(); }
    if (e.key === 'F9' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TORSO_HINGE_Z = +(TORSO_HINGE_Z - 0.01).toFixed(3); _applyTorsoHinge(); }
    if (e.key === 'F10' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TORSO_HINGE_Z = +(TORSO_HINGE_Z + 0.01).toFixed(3); _applyTorsoHinge(); }
    // ===== END TEMP TORSO HINGE TUNER =====

    // ===== TEMP POPPY SWAY TUNER =====
    // Ctrl+Shift+S/D = POPPY_SWAY_AMP -/+0.01   Ctrl+Shift+F5/F6 = POPPY_SWAY_SPD -/+0.002
    if (e.key === 's' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_SWAY_AMP = Math.max(0, +(POPPY_SWAY_AMP - 0.01).toFixed(3)); console.log('[KRR SWAY] AMP=' + POPPY_SWAY_AMP.toFixed(3) + ' SPD=' + POPPY_SWAY_SPD.toFixed(4)); }
    if (e.key === 'd' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_SWAY_AMP = +(POPPY_SWAY_AMP + 0.01).toFixed(3); console.log('[KRR SWAY] AMP=' + POPPY_SWAY_AMP.toFixed(3) + ' SPD=' + POPPY_SWAY_SPD.toFixed(4)); }
    if (e.key === 'F5' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_SWAY_SPD = Math.max(0, +(POPPY_SWAY_SPD - 0.002).toFixed(4)); console.log('[KRR SWAY] AMP=' + POPPY_SWAY_AMP.toFixed(3) + ' SPD=' + POPPY_SWAY_SPD.toFixed(4)); }
    if (e.key === 'F6' && e.ctrlKey && e.shiftKey) { e.preventDefault(); POPPY_SWAY_SPD = +(POPPY_SWAY_SPD + 0.002).toFixed(4); console.log('[KRR SWAY] AMP=' + POPPY_SWAY_AMP.toFixed(3) + ' SPD=' + POPPY_SWAY_SPD.toFixed(4)); }
    // ===== END TEMP POPPY SWAY TUNER =====

    // ===== GROUND TEXEL DENSITY TUNER =====
    // Ctrl+[ / Ctrl+] = GROUND_TEX_WORLD -/+0.25 (world units per tile; smaller = denser)
    // Updates all bank segments (each has own tex) and all aprons (share one tex per stage).
    if (e.key === '[' && e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      GROUND_TEX_WORLD = Math.max(0.25, +(GROUND_TEX_WORLD - 0.25).toFixed(2));
      var _gSlope = Math.hypot(SHORE_W, 0.60 - SHORE_TOE_Y);
      bankSegs3.forEach(function(bs) {
        if (bs.mesh.material && bs.mesh.material.map) {
          bs.mesh.material.map.repeat.set(bs.segW / GROUND_TEX_WORLD, (BK_SEG_Z + 0.25) / GROUND_TEX_WORLD);
          bs.mesh.material.map.needsUpdate = true;
        }
        if (bs.apron && bs.apron.material && bs.apron.material.map) {
          bs.apron.material.map.repeat.set(_gSlope / GROUND_TEX_WORLD, (BK_SEG_Z + 0.25) / GROUND_TEX_WORLD);
          bs.apron.material.map.needsUpdate = true;
        }
      });
      if (gndPlaneTex) {
        var _gZ = (stageIdx === 4) ? 600 : 170;
        gndPlaneTex.repeat.set(200 / GROUND_TEX_WORLD, _gZ / GROUND_TEX_WORLD);
        gndPlaneTex.needsUpdate = true;
      }
      console.log('[KRR GROUND] GROUND_TEX_WORLD=' + GROUND_TEX_WORLD.toFixed(2));
    }
    if (e.key === ']' && e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      GROUND_TEX_WORLD = +(GROUND_TEX_WORLD + 0.25).toFixed(2);
      var _gSlope2 = Math.hypot(SHORE_W, 0.60 - SHORE_TOE_Y);
      bankSegs3.forEach(function(bs) {
        if (bs.mesh.material && bs.mesh.material.map) {
          bs.mesh.material.map.repeat.set(bs.segW / GROUND_TEX_WORLD, (BK_SEG_Z + 0.25) / GROUND_TEX_WORLD);
          bs.mesh.material.map.needsUpdate = true;
        }
        if (bs.apron && bs.apron.material && bs.apron.material.map) {
          bs.apron.material.map.repeat.set(_gSlope2 / GROUND_TEX_WORLD, (BK_SEG_Z + 0.25) / GROUND_TEX_WORLD);
          bs.apron.material.map.needsUpdate = true;
        }
      });
      if (gndPlaneTex) {
        var _gZ2 = (stageIdx === 4) ? 600 : 170;
        gndPlaneTex.repeat.set(200 / GROUND_TEX_WORLD, _gZ2 / GROUND_TEX_WORLD);
        gndPlaneTex.needsUpdate = true;
      }
      console.log('[KRR GROUND] GROUND_TEX_WORLD=' + GROUND_TEX_WORLD.toFixed(2));
    }
    // ===== END GROUND TEXEL DENSITY TUNER =====

    // ===== BANK BRIGHTNESS TUNER =====
    // Ctrl+Shift+[ / ] = BANK_BRIGHT_MULT -/+0.05
    if (e.key === '[' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      BANK_BRIGHT_MULT = Math.max(0, +(BANK_BRIGHT_MULT - 0.05).toFixed(2));
      bankSegs3.forEach(function(bs) {
        if (bs.mesh.material) bs.mesh.material.color.setScalar(BANK_BRIGHT_MULT);
        if (bs.apron && bs.apron.material) bs.apron.material.color.setScalar(BANK_BRIGHT_MULT);
      });
      if (gndPlaneMat) gndPlaneMat.color.setScalar(BANK_BRIGHT_MULT);
      console.log('[KRR BRIGHT] BANK_BRIGHT_MULT=' + BANK_BRIGHT_MULT.toFixed(2));
    }
    if (e.key === ']' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      BANK_BRIGHT_MULT = Math.min(2, +(BANK_BRIGHT_MULT + 0.05).toFixed(2));
      bankSegs3.forEach(function(bs) {
        if (bs.mesh.material) bs.mesh.material.color.setScalar(BANK_BRIGHT_MULT);
        if (bs.apron && bs.apron.material) bs.apron.material.color.setScalar(BANK_BRIGHT_MULT);
      });
      if (gndPlaneMat) gndPlaneMat.color.setScalar(BANK_BRIGHT_MULT);
      console.log('[KRR BRIGHT] BANK_BRIGHT_MULT=' + BANK_BRIGHT_MULT.toFixed(2));
    }
    // ===== END BANK BRIGHTNESS TUNER =====

    // ===== ARM HINGE + REACH TUNER =====
    // Ctrl+Shift+Q/W = ARM_HINGE_Y -/+0.01
    // Ctrl+Shift+E/R = ARM_HINGE_Z -/+0.01
    // Ctrl+Shift+A/Z = ARM_REACH_ANG -/+0.05
    if (e.key === 'q' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_HINGE_Y = Math.max(0, +(ARM_HINGE_Y - 0.01).toFixed(3)); _applyArmHinge(); }
    if (e.key === 'w' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_HINGE_Y = +(ARM_HINGE_Y + 0.01).toFixed(3); _applyArmHinge(); }
    if (e.key === 'e' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_HINGE_Z = Math.max(0, +(ARM_HINGE_Z - 0.01).toFixed(3)); _applyArmHinge(); }
    if (e.key === 'r' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_HINGE_Z = +(ARM_HINGE_Z + 0.01).toFixed(3); _applyArmHinge(); }
    if (e.key === 'a' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_REACH_ANG = Math.max(0, +(ARM_REACH_ANG - 0.05).toFixed(2)); console.log('[KRR ARM] reach=' + ARM_REACH_ANG.toFixed(2)); }
    if (e.key === 'z' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ARM_REACH_ANG = +(ARM_REACH_ANG + 0.05).toFixed(2); console.log('[KRR ARM] reach=' + ARM_REACH_ANG.toFixed(2)); }
    // ===== END ARM HINGE + REACH TUNER =====

  } else if (gameState3 === 'paused') {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      gameState3 = 'playing';
      document.getElementById('overlay3').classList.add('hidden');
    }
  }

  // ===== TEMP VICTORY CARD DEV KEYS (REMOVE BEFORE LAUNCH) =====
  // F4 (no shift) = replay card from zero; F2/F3 (no shift) = font size; Shift+F2/F3 = fade duration
  if (e.key === 'F4' && !e.shiftKey) {
    e.preventDefault();
    if (_victoryCancelFn) { _victoryCancelFn(); _victoryCancelFn = null; }
    showTitleCard({ title: 'Victory?', subtitle: '', holdMs: 1900, dramatic: true, onComplete: function() { console.log('[KRR VICTORY] dev replay complete'); } });
  }
  if ((e.key === 'F2' || e.key === 'F3') && !e.shiftKey) {
    e.preventDefault();
    VICTORY_FONT_PX = (e.key === 'F2') ? Math.max(12, VICTORY_FONT_PX - 2) : VICTORY_FONT_PX + 2;
    var _vc = document.getElementById('krr-victory-card');
    if (_vc) {
      var _vcSpans = _vc.querySelectorAll('span');
      for (var _vsi = 0; _vsi < _vcSpans.length; _vsi++) {
        _vcSpans[_vsi].style.fontSize = VICTORY_FONT_PX + 'px';
      }
    }
    console.log('[KRR VICTORY] fontPx=' + VICTORY_FONT_PX);
  }
  if (e.key === 'F2' && e.shiftKey) { e.preventDefault(); ENDING_MSG_FADE_MS = Math.max(100, ENDING_MSG_FADE_MS - 500); console.log('[KRR ENDING] ENDING_MSG_FADE_MS=' + ENDING_MSG_FADE_MS); }
  if (e.key === 'F3' && e.shiftKey) { e.preventDefault(); ENDING_MSG_FADE_MS += 500; console.log('[KRR ENDING] ENDING_MSG_FADE_MS=' + ENDING_MSG_FADE_MS); }
  // ===== END TEMP VICTORY CARD DEV KEYS =====

  // ===== TITLE CARD TIMING TUNER =====
  // Shift+T/G = TITLE_ENTER_MS -/+100  Shift+Y/H = TITLE_HOLD_MS -/+250  Shift+U/J = TITLE_FONT_PX -/+2
  if (e.key === 'T' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_ENTER_MS = Math.max(100, TITLE_ENTER_MS - 100); console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  if (e.key === 'G' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_ENTER_MS += 100; console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  if (e.key === 'Y' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_HOLD_MS = Math.max(250, TITLE_HOLD_MS - 250); console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  if (e.key === 'H' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_HOLD_MS += 250; console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  if (e.key === 'U' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_FONT_PX = Math.max(12, TITLE_FONT_PX - 2); console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  if (e.key === 'J' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); TITLE_FONT_PX += 2; console.log('[KRR TITLE] ENTER=' + TITLE_ENTER_MS + ' HOLD=' + TITLE_HOLD_MS + ' FONT=' + TITLE_FONT_PX); }
  // ===== END TITLE CARD TIMING TUNER =====

  // ===== STAGE LABEL FONT TUNER =====
  // Shift+F4 = STAGE_LABEL_PX -1;  Shift+F5 = STAGE_LABEL_PX +1
  if (e.key === 'F4' && e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    STAGE_LABEL_PX = Math.max(6, STAGE_LABEL_PX - 1);
    var _slE = document.getElementById('hud3-stage');
    if (_slE) _slE.style.fontSize = STAGE_LABEL_PX + 'px';
    console.log('[KRR HUD] STAGE_LABEL_PX=' + STAGE_LABEL_PX);
  }
  if (e.key === 'F5' && e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    STAGE_LABEL_PX = Math.min(18, STAGE_LABEL_PX + 1);
    var _slE2 = document.getElementById('hud3-stage');
    if (_slE2) _slE2.style.fontSize = STAGE_LABEL_PX + 'px';
    console.log('[KRR HUD] STAGE_LABEL_PX=' + STAGE_LABEL_PX);
  }
  // ===== END STAGE LABEL FONT TUNER =====

  // ===== HUD ORANGE DISPLAY TUNER =====
  // Shift+B/M = HUD_ORANGE_ICON_PX -/+1   Shift+S/N = HUD_ORANGE_COUNT_PX -/+1
  if (e.key === 'B' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); HUD_ORANGE_ICON_PX = Math.max(6, HUD_ORANGE_ICON_PX - 1); var _ico = document.getElementById('hud3-orange-icon'); if (_ico) { _ico.style.width = HUD_ORANGE_ICON_PX + 'px'; _ico.style.height = HUD_ORANGE_ICON_PX + 'px'; } console.log('[KRR HUD] icon=' + HUD_ORANGE_ICON_PX + ' count=' + HUD_ORANGE_COUNT_PX); }
  if (e.key === 'M' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); HUD_ORANGE_ICON_PX += 1; var _ico2 = document.getElementById('hud3-orange-icon'); if (_ico2) { _ico2.style.width = HUD_ORANGE_ICON_PX + 'px'; _ico2.style.height = HUD_ORANGE_ICON_PX + 'px'; } console.log('[KRR HUD] icon=' + HUD_ORANGE_ICON_PX + ' count=' + HUD_ORANGE_COUNT_PX); }
  if (e.key === 'S' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); HUD_ORANGE_COUNT_PX = Math.max(5, HUD_ORANGE_COUNT_PX - 1); var _cnt = document.getElementById('hud3-orange-count'); if (_cnt) _cnt.style.fontSize = HUD_ORANGE_COUNT_PX + 'px'; console.log('[KRR HUD] icon=' + HUD_ORANGE_ICON_PX + ' count=' + HUD_ORANGE_COUNT_PX); }
  if (e.key === 'N' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); HUD_ORANGE_COUNT_PX += 1; var _cnt2 = document.getElementById('hud3-orange-count'); if (_cnt2) _cnt2.style.fontSize = HUD_ORANGE_COUNT_PX + 'px'; console.log('[KRR HUD] icon=' + HUD_ORANGE_ICON_PX + ' count=' + HUD_ORANGE_COUNT_PX); }
  // ===== END HUD ORANGE DISPLAY TUNER =====

  // ===== HUD FONT SCALE TUNER =====
  // Ctrl+, = scale -0.10   Ctrl+. = scale +0.10  (applies all HUD text proportionally)
  if (e.key === ',' && e.ctrlKey) { e.preventDefault(); HUD_FONT_SCALE = Math.max(0.5, +(HUD_FONT_SCALE - 0.10).toFixed(2)); _applyHudFontScale(); }
  if (e.key === '.' && e.ctrlKey) { e.preventDefault(); HUD_FONT_SCALE = Math.min(2.0, +(HUD_FONT_SCALE + 0.10).toFixed(2)); _applyHudFontScale(); }
  // ===== END HUD FONT SCALE TUNER =====

  // ===== SHIELD BUBBLE TUNER =====
  // Shift+I/K = SHIELD_INNER_OP -/+0.01   Shift+O/L = SHIELD_OUTER_OP -/+0.01   Shift+R/V = SHIELD_RADIUS_MULT -/+0.05
  if (e.key === 'I' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_INNER_OP = Math.max(0, +(SHIELD_INNER_OP - 0.01).toFixed(3)); if (_shieldInner) _shieldInner.material.opacity = SHIELD_INNER_OP; console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  if (e.key === 'K' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_INNER_OP = +(SHIELD_INNER_OP + 0.01).toFixed(3); if (_shieldInner) _shieldInner.material.opacity = SHIELD_INNER_OP; console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  if (e.key === 'O' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_OUTER_OP = Math.max(0, +(SHIELD_OUTER_OP - 0.01).toFixed(3)); if (_shieldOuter) _shieldOuter.material.opacity = SHIELD_OUTER_OP; console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  if (e.key === 'L' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_OUTER_OP = +(SHIELD_OUTER_OP + 0.01).toFixed(3); if (_shieldOuter) _shieldOuter.material.opacity = SHIELD_OUTER_OP; console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  if (e.key === 'R' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_RADIUS_MULT = Math.max(0.3, +(SHIELD_RADIUS_MULT - 0.05).toFixed(2)); if (_shieldGroup && !_shieldBurstSt) _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT); console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  if (e.key === 'V' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SHIELD_RADIUS_MULT = +(SHIELD_RADIUS_MULT + 0.05).toFixed(2); if (_shieldGroup && !_shieldBurstSt) _shieldGroup.scale.setScalar(SHIELD_RADIUS_MULT); console.log('[KRR SHIELD] inner=' + SHIELD_INNER_OP + ' outer=' + SHIELD_OUTER_OP + ' r=' + SHIELD_RADIUS_MULT); }
  // ===== END SHIELD BUBBLE TUNER =====

  // ===== SHIELD HUE CYCLE SPEED TUNER =====
  // ~ (Shift+`) = slower -0.0005   | (Shift+\) = faster +0.0005
  if (e.key === '~') { SHIELD_HUE_SPEED = Math.max(0, +(SHIELD_HUE_SPEED - 0.0005).toFixed(4)); console.log('[KRR SHIELD] hueSpd=' + SHIELD_HUE_SPEED.toFixed(4) + ' (~' + (SHIELD_HUE_SPEED > 0 ? (1 / (SHIELD_HUE_SPEED * 60)).toFixed(1) : 'inf') + 's/cycle)'); }
  if (e.key === '|') { SHIELD_HUE_SPEED = +(SHIELD_HUE_SPEED + 0.0005).toFixed(4); console.log('[KRR SHIELD] hueSpd=' + SHIELD_HUE_SPEED.toFixed(4) + ' (~' + (1 / (SHIELD_HUE_SPEED * 60)).toFixed(1) + 's/cycle)'); }
  // ===== END SHIELD HUE CYCLE SPEED TUNER =====

  // ===== SWELL ORANGE LOSS TUNER =====
  // Shift+Z/X = SWELL_ORANGE_LOSS -/+1
  if (e.key === 'Z' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SWELL_ORANGE_LOSS = Math.max(0, SWELL_ORANGE_LOSS - 1); console.log('[KRR ORANGE] SWELL_LOSS=' + SWELL_ORANGE_LOSS); }
  if (e.key === 'X' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); SWELL_ORANGE_LOSS++;                                    console.log('[KRR ORANGE] SWELL_LOSS=' + SWELL_ORANGE_LOSS); }
  // ===== END SWELL ORANGE LOSS TUNER =====

  // ===== BILLBOARD TUNER =====
  // Shift+C/F = BILLBOARD_SCALE -/+0.25   Shift+Q/E = BILLBOARD_GAP_MIN -/+5
  if (e.key === 'C' && e.shiftKey && !e.ctrlKey) {
    e.preventDefault(); BILLBOARD_SCALE = Math.max(0.5, +(BILLBOARD_SCALE - 0.25).toFixed(2));
    bankBillboards3.forEach(function(b) { var h=BILLBOARD_SCALE; b.sprite.scale.set(h*billboardNatAR[b.texIdx],h,1); });
    console.log('[KRR BILLBOARD] scale=' + BILLBOARD_SCALE + ' gap=' + BILLBOARD_GAP_MIN);
  }
  if (e.key === 'F' && e.shiftKey && !e.ctrlKey) {
    e.preventDefault(); BILLBOARD_SCALE = +(BILLBOARD_SCALE + 0.25).toFixed(2);
    bankBillboards3.forEach(function(b) { var h=BILLBOARD_SCALE; b.sprite.scale.set(h*billboardNatAR[b.texIdx],h,1); });
    console.log('[KRR BILLBOARD] scale=' + BILLBOARD_SCALE + ' gap=' + BILLBOARD_GAP_MIN);
  }
  if (e.key === 'Q' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); BILLBOARD_GAP_MIN = Math.max(10, BILLBOARD_GAP_MIN - 5); console.log('[KRR BILLBOARD] scale=' + BILLBOARD_SCALE + ' gap_min=' + BILLBOARD_GAP_MIN); }
  if (e.key === 'E' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); BILLBOARD_GAP_MIN += 5; console.log('[KRR BILLBOARD] scale=' + BILLBOARD_SCALE + ' gap_min=' + BILLBOARD_GAP_MIN); }
  // ===== END BILLBOARD TUNER =====

  // ===== CREPUSCULAR RAY / CLOUD SHADOW TUNER =====
  // Ctrl+Shift+1/2 = CLOUD_SHADOW_OPACITY -/+0.02
  // Ctrl+Shift+3/4 = CLOUD_SHADOW_SIZE    -/+10 wu  (takes effect on next buildWorld/reload)
  // Ctrl+Shift+5/6 = CLOUD_DRIFT_SPEED    -/+0.05 wu/s (live)
  // Alt+q/w = CLOUD_SHADOW_SIZE -10/+10   Alt+e/r = RAY_SHAFT_OPACITY -0.01/+0.01
  // Alt+a/s = RAY_POOL_OPACITY -0.01/+0.01   Alt+d/f = RAY_TILT -0.02/+0.02 (live on next drift tick)
  // Alt+z/x = RAY_SHAFT_W -1/+1   Alt+c/v = RAY_SHAFT_H -5/+5
  if (e.key === '1' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_OPACITY = Math.max(0, +(CLOUD_SHADOW_OPACITY - 0.02).toFixed(3)); console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  if (e.key === '2' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_OPACITY = Math.min(0.9, +(CLOUD_SHADOW_OPACITY + 0.02).toFixed(3)); console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  if (e.key === '3' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE = Math.max(10, CLOUD_SHADOW_SIZE - 10); console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  if (e.key === '4' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE += 10; console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  if (e.key === '5' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_DRIFT_SPEED = Math.max(0, +(CLOUD_DRIFT_SPEED - 0.05).toFixed(2)); console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  if (e.key === '6' && e.ctrlKey && e.shiftKey) { e.preventDefault(); CLOUD_DRIFT_SPEED = +(CLOUD_DRIFT_SPEED + 0.05).toFixed(2); console.log('[KRR CREP] shadowOp=' + CLOUD_SHADOW_OPACITY + ' size=' + CLOUD_SHADOW_SIZE + ' drift=' + CLOUD_DRIFT_SPEED); }
  // Ctrl+Shift+7/8 = FISH_OPACITY -/+0.05   Ctrl+Shift+9/0 = FISH_FREQ_MIN ±5s
  if (e.key === '7' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_OPACITY = Math.max(0, +(FISH_OPACITY - 0.05).toFixed(2)); console.log('[KRR WILDLIFE] fish_op=' + FISH_OPACITY + ' fish_freq=' + FISH_FREQ_MIN + '-' + FISH_FREQ_MAX + 's bird_freq=' + BIRD_FREQ_MIN + '-' + BIRD_FREQ_MAX + 's'); }
  if (e.key === '8' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_OPACITY = Math.min(1, +(FISH_OPACITY + 0.05).toFixed(2)); console.log('[KRR WILDLIFE] fish_op=' + FISH_OPACITY + ' fish_freq=' + FISH_FREQ_MIN + '-' + FISH_FREQ_MAX + 's bird_freq=' + BIRD_FREQ_MIN + '-' + BIRD_FREQ_MAX + 's'); }
  if (e.key === '9' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_FREQ_MIN = Math.max(5, FISH_FREQ_MIN - 5); FISH_FREQ_MAX = Math.max(FISH_FREQ_MIN + 10, FISH_FREQ_MAX - 5); console.log('[KRR WILDLIFE] fish_op=' + FISH_OPACITY + ' fish_freq=' + FISH_FREQ_MIN + '-' + FISH_FREQ_MAX + 's'); }
  if (e.key === '0' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_FREQ_MIN += 5; FISH_FREQ_MAX += 5; console.log('[KRR WILDLIFE] fish_op=' + FISH_OPACITY + ' fish_freq=' + FISH_FREQ_MIN + '-' + FISH_FREQ_MAX + 's'); }
  // Ctrl+- / Ctrl+= = BIRD_FREQ_MIN ±5s (no shift needed)
  if (e.key === '-' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); BIRD_FREQ_MIN = Math.max(10, BIRD_FREQ_MIN - 5); BIRD_FREQ_MAX = Math.max(BIRD_FREQ_MIN + 15, BIRD_FREQ_MAX - 5); console.log('[KRR WILDLIFE] bird_freq=' + BIRD_FREQ_MIN + '-' + BIRD_FREQ_MAX + 's'); }
  if (e.key === '=' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); BIRD_FREQ_MIN += 5; BIRD_FREQ_MAX += 5; console.log('[KRR WILDLIFE] bird_freq=' + BIRD_FREQ_MIN + '-' + BIRD_FREQ_MAX + 's'); }
  // Ctrl+Shift+M/N = BIRD_OPACITY -/+0.05
  if (e.key === 'M' && e.ctrlKey && e.shiftKey) { e.preventDefault(); BIRD_OPACITY = Math.max(0, +(BIRD_OPACITY - 0.05).toFixed(2)); console.log('[KRR WILDLIFE] bird_op=' + BIRD_OPACITY); }
  if (e.key === 'N' && e.ctrlKey && e.shiftKey) { e.preventDefault(); BIRD_OPACITY = Math.min(1, +(BIRD_OPACITY + 0.05).toFixed(2)); console.log('[KRR WILDLIFE] bird_op=' + BIRD_OPACITY); }
  // Ctrl+Shift+G/H = FISH_SCALE -/+0.1   Ctrl+Shift+J/K = FISH_SWIM_SPEED -/+0.25
  if (e.key === 'G' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_SCALE = Math.max(0.1, +(FISH_SCALE - 0.10).toFixed(2)); if (_troutGroup) _troutGroup.scale.setScalar(FISH_SCALE); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if (e.key === 'H' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_SCALE = +(FISH_SCALE + 0.10).toFixed(2);                if (_troutGroup) _troutGroup.scale.setScalar(FISH_SCALE); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if (e.key === 'J' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_SWIM_SPEED = Math.max(0.25, +(FISH_SWIM_SPEED - 0.25).toFixed(2)); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if (e.key === 'K' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_SWIM_SPEED = +(FISH_SWIM_SPEED + 0.25).toFixed(2);           console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  // Ctrl+Shift+L/; = FISH_UNDULATION_AMP -/+0.1   Ctrl+Shift+B/V = FISH_WEAVE_AMT -/+0.1
  if (e.key === 'L' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_UNDULATION_AMP = Math.max(0, +(FISH_UNDULATION_AMP - 0.10).toFixed(2)); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if ((e.key === ';' || e.key === ':') && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_UNDULATION_AMP = +(FISH_UNDULATION_AMP + 0.10).toFixed(2); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if (e.key === 'B' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_WEAVE_AMT = Math.max(0, +(FISH_WEAVE_AMT - 0.10).toFixed(2)); console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  if (e.key === 'V' && e.ctrlKey && e.shiftKey) { e.preventDefault(); FISH_WEAVE_AMT = +(FISH_WEAVE_AMT + 0.10).toFixed(2);           console.log('[KRR TROUT] scale=' + FISH_SCALE + ' speed=' + FISH_SWIM_SPEED + ' undulation=' + FISH_UNDULATION_AMP + ' weave=' + FISH_WEAVE_AMT); }
  // ===== END CLOUD SHADOW TUNER =====

  // ===== STORY / ENDING TUNER =====
  // Alt+1/2 = ENDING_FORLORN_MS -/+500ms   Alt+3/4 = STORY_TURN_MS -/+50ms
  if (e.key === '1' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); ENDING_FORLORN_MS = Math.max(1000, ENDING_FORLORN_MS - 500); console.log('[KRR STORY] forlorn_ms=' + ENDING_FORLORN_MS + ' turn_ms=' + STORY_TURN_MS); }
  if (e.key === '2' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); ENDING_FORLORN_MS += 500; console.log('[KRR STORY] forlorn_ms=' + ENDING_FORLORN_MS + ' turn_ms=' + STORY_TURN_MS); }
  if (e.key === '3' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); STORY_TURN_MS = Math.max(100, STORY_TURN_MS - 50); console.log('[KRR STORY] forlorn_ms=' + ENDING_FORLORN_MS + ' turn_ms=' + STORY_TURN_MS); }
  if (e.key === '4' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); STORY_TURN_MS = Math.min(1200, STORY_TURN_MS + 50); console.log('[KRR STORY] forlorn_ms=' + ENDING_FORLORN_MS + ' turn_ms=' + STORY_TURN_MS); }
  // ===== END STORY / ENDING TUNER =====

  // ===== CREPUSCULAR RAY DETAIL TUNER (Alt+letter) =====
  // Alt+q/w = CLOUD_SHADOW_SIZE -10/+10   Alt+e/r = RAY_SHAFT_OPACITY -/+0.01
  // Alt+a/s = RAY_POOL_OPACITY  -/+0.01   Alt+d/f = RAY_TILT -/+0.02 (live)
  // Alt+z/x = RAY_SHAFT_W -/+1            Alt+c/v = RAY_SHAFT_H -/+5
  if (e.key === 'q' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE = Math.max(10, CLOUD_SHADOW_SIZE - 10); console.log('[KRR CREP] size=' + CLOUD_SHADOW_SIZE); }
  if (e.key === 'w' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE += 10; console.log('[KRR CREP] size=' + CLOUD_SHADOW_SIZE); }
  if (e.key === 'e' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_OPACITY = Math.max(0, +(RAY_SHAFT_OPACITY - 0.01).toFixed(3)); console.log('[KRR CREP] shaftOp=' + RAY_SHAFT_OPACITY + ' poolOp=' + RAY_POOL_OPACITY + ' tilt=' + RAY_TILT.toFixed(2) + ' w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'r' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_OPACITY = Math.min(1, +(RAY_SHAFT_OPACITY + 0.01).toFixed(3)); console.log('[KRR CREP] shaftOp=' + RAY_SHAFT_OPACITY + ' poolOp=' + RAY_POOL_OPACITY + ' tilt=' + RAY_TILT.toFixed(2) + ' w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'a' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_POOL_OPACITY = Math.max(0, +(RAY_POOL_OPACITY - 0.01).toFixed(3)); console.log('[KRR CREP] shaftOp=' + RAY_SHAFT_OPACITY + ' poolOp=' + RAY_POOL_OPACITY + ' tilt=' + RAY_TILT.toFixed(2) + ' w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 's' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_POOL_OPACITY = Math.min(1, +(RAY_POOL_OPACITY + 0.01).toFixed(3)); console.log('[KRR CREP] shaftOp=' + RAY_SHAFT_OPACITY + ' poolOp=' + RAY_POOL_OPACITY + ' tilt=' + RAY_TILT.toFixed(2) + ' w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'd' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_TILT = Math.max(0, +(RAY_TILT - 0.02).toFixed(3)); for (var _rt = 0; _rt < _rayPairs.length; _rt++) { _rayPairs[_rt].tilt = RAY_TILT * Math.sign(_rayPairs[_rt].tilt || 1); } console.log('[KRR CREP] tilt=' + RAY_TILT.toFixed(3)); }
  if (e.key === 'f' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_TILT = +(RAY_TILT + 0.02).toFixed(3); for (var _rt = 0; _rt < _rayPairs.length; _rt++) { _rayPairs[_rt].tilt = RAY_TILT * Math.sign(_rayPairs[_rt].tilt || 1); } console.log('[KRR CREP] tilt=' + RAY_TILT.toFixed(3)); }
  if (e.key === 'z' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_W = Math.max(1, RAY_SHAFT_W - 1); for (var _rw = 0; _rw < _rayPairs.length; _rw++) { _rayPairs[_rw].shaft.scale.x = RAY_SHAFT_W; } console.log('[KRR CREP] w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'x' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_W++; for (var _rw = 0; _rw < _rayPairs.length; _rw++) { _rayPairs[_rw].shaft.scale.x = RAY_SHAFT_W; } console.log('[KRR CREP] w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'c' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_H = Math.max(5, RAY_SHAFT_H - 5); for (var _rh = 0; _rh < _rayPairs.length; _rh++) { _rayPairs[_rh].shaft.scale.y = RAY_SHAFT_H; } console.log('[KRR CREP] w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  if (e.key === 'v' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); RAY_SHAFT_H += 5; for (var _rh = 0; _rh < _rayPairs.length; _rh++) { _rayPairs[_rh].shaft.scale.y = RAY_SHAFT_H; } console.log('[KRR CREP] w=' + RAY_SHAFT_W + ' h=' + RAY_SHAFT_H); }
  // Ctrl+Alt+1/2 = CLOUD_SHADOW_SIZE_STORM -/+10   Ctrl+Alt+3/4 = CLOUD_DESPAWN_Z -/+2
  // Ctrl+Alt+5/6 = CLOUD_FADEOUT_Z -/+1   (storm size applies to stageIdx 2+3 on shadow recycle)
  if (e.key === '1' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE_STORM = Math.max(10, CLOUD_SHADOW_SIZE_STORM - 10); console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  if (e.key === '2' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_SHADOW_SIZE_STORM += 10; console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  if (e.key === '3' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_DESPAWN_Z = Math.max(10, CLOUD_DESPAWN_Z - 2); console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  if (e.key === '4' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_DESPAWN_Z += 2; console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  if (e.key === '5' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_FADEOUT_Z = Math.max(-10, CLOUD_FADEOUT_Z - 1); console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  if (e.key === '6' && e.ctrlKey && e.altKey && !e.shiftKey) { e.preventDefault(); CLOUD_FADEOUT_Z += 1; console.log('[KRR CREP STORM] storm_sz=' + CLOUD_SHADOW_SIZE_STORM + ' despawn_z=' + CLOUD_DESPAWN_Z + ' fadeout_z=' + CLOUD_FADEOUT_Z); }
  // ===== END CREPUSCULAR RAY DETAIL TUNER =====

  // ===== TEMP GRASS TUFT TUNER (Stage 5) =====
  // Alt+5/6 = S5_GRASS_POOL -1/+1   Alt+7/8 = S5_GRASS_W -/+0.05   Alt+9/0 = S5_GRASS_XBAND -/+0.5
  // Pool count change takes effect on next buildWorld() (stage enter or DEV jump)
  if (e.key === '5' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_POOL = Math.max(1, S5_GRASS_POOL - 1); console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  if (e.key === '6' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_POOL++; console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  if (e.key === '7' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_W = Math.max(0.10, +(S5_GRASS_W - 0.05).toFixed(2)); console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  if (e.key === '8' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_W = +(S5_GRASS_W + 0.05).toFixed(2); console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  if (e.key === '9' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_XBAND = Math.max(0.5, +(S5_GRASS_XBAND - 0.5).toFixed(1)); console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  if (e.key === '0' && e.altKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); S5_GRASS_XBAND = +(S5_GRASS_XBAND + 0.5).toFixed(1); console.log('[KRR GRASS5] pool=' + S5_GRASS_POOL + ' w=' + S5_GRASS_W.toFixed(2) + ' xband=' + S5_GRASS_XBAND.toFixed(1)); }
  // ===== END GRASS TUFT TUNER =====

  // ===== SCORE POPUP TUNER =====
  // Shift+F6/F7 = POPUP_FONT_PX -/+2   Shift+F8/F9 = POPUP_RISE -/+0.10
  if (e.key === 'F6' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPUP_FONT_PX = Math.max(10, POPUP_FONT_PX - 2); console.log('[KRR POPUP] font=' + POPUP_FONT_PX + ' rise=' + POPUP_RISE); }
  if (e.key === 'F7' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPUP_FONT_PX += 2; console.log('[KRR POPUP] font=' + POPUP_FONT_PX + ' rise=' + POPUP_RISE); }
  if (e.key === 'F8' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPUP_RISE = Math.max(0.20, +(POPUP_RISE - 0.10).toFixed(2)); console.log('[KRR POPUP] font=' + POPUP_FONT_PX + ' rise=' + POPUP_RISE); }
  if (e.key === 'F9' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); POPUP_RISE = +(POPUP_RISE + 0.10).toFixed(2); console.log('[KRR POPUP] font=' + POPUP_FONT_PX + ' rise=' + POPUP_RISE); }
  // ===== END SCORE POPUP TUNER =====

  // ===== BASKET POSITION / SCALE TUNER =====
  // Shift+!/@ = BASKET_Y -/+0.02   Shift+#/$ = BASKET_Z -/+0.02
  // Shift+%/^ = BASKET_SCALE -/+0.05   Shift+&/* = BASKET_X -/+0.02
  // Shift+(/) = BASKET_MAX_VIS -/+1   { / } = BASKET_HEAP_Y -/+0.01   Ctrl+</> = BASKET_SPREAD -/+0.05
  if (e.key === '!' && e.shiftKey) { e.preventDefault(); BASKET_Y = +(BASKET_Y - 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.y = BASKET_Y; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '@' && e.shiftKey) { e.preventDefault(); BASKET_Y = +(BASKET_Y + 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.y = BASKET_Y; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '#' && e.shiftKey) { e.preventDefault(); BASKET_Z = +(BASKET_Z - 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.z = BASKET_Z; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '$' && e.shiftKey) { e.preventDefault(); BASKET_Z = +(BASKET_Z + 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.z = BASKET_Z; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '%' && e.shiftKey) { e.preventDefault(); BASKET_SCALE = Math.max(0.20, +(BASKET_SCALE - 0.05).toFixed(2)); if (_basketGroup) _basketGroup.scale.setScalar(BASKET_SCALE); console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '^' && e.shiftKey) { e.preventDefault(); BASKET_SCALE = +(BASKET_SCALE + 0.05).toFixed(2); if (_basketGroup) _basketGroup.scale.setScalar(BASKET_SCALE); console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '&' && e.shiftKey) { e.preventDefault(); BASKET_X = +(BASKET_X - 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.x = BASKET_X; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '*' && e.shiftKey) { e.preventDefault(); BASKET_X = +(BASKET_X + 0.02).toFixed(3); if (_basketGroup) _basketGroup.position.x = BASKET_X; console.log('[KRR BASKET] x=' + BASKET_X + ' y=' + BASKET_Y + ' z=' + BASKET_Z + ' sc=' + BASKET_SCALE); }
  if (e.key === '(' && e.shiftKey) { e.preventDefault(); BASKET_MAX_VIS = Math.max(1, BASKET_MAX_VIS - 1); console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  if (e.key === ')' && e.shiftKey) { e.preventDefault(); BASKET_MAX_VIS = Math.min(_basketOranges.length, BASKET_MAX_VIS + 1); console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  if (e.key === '{') { e.preventDefault(); BASKET_HEAP_Y = +(BASKET_HEAP_Y - 0.01).toFixed(3); if (_orangePileGroup) _orangePileGroup.position.y = BASKET_HEAP_Y; console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  if (e.key === '}') { e.preventDefault(); BASKET_HEAP_Y = +(BASKET_HEAP_Y + 0.01).toFixed(3); if (_orangePileGroup) _orangePileGroup.position.y = BASKET_HEAP_Y; console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  if (e.ctrlKey && e.key === '<') { e.preventDefault(); BASKET_SPREAD = Math.max(0.3, +(BASKET_SPREAD - 0.05).toFixed(2)); if (_orangePileGroup) { _orangePileGroup.scale.x = BASKET_SPREAD; _orangePileGroup.scale.z = BASKET_SPREAD; } console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  if (e.ctrlKey && e.key === '>') { e.preventDefault(); BASKET_SPREAD = +(BASKET_SPREAD + 0.05).toFixed(2); if (_orangePileGroup) { _orangePileGroup.scale.x = BASKET_SPREAD; _orangePileGroup.scale.z = BASKET_SPREAD; } console.log('[KRR BASKET] MAX_VIS=' + BASKET_MAX_VIS + ' HEAP_Y=' + BASKET_HEAP_Y + ' SPREAD=' + BASKET_SPREAD); }
  // ===== END BASKET TUNER =====

  // ===== SHARD TUNER =====
  // Ctrl+Shift+J/L = SHARD_COUNT -1/+1   Ctrl+Shift+Y/U = SHARD_SPEED -/+0.005   Ctrl+Shift+T/P = SHARD_DURATION -/+50ms
  if (e.key === 'J' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_COUNT = Math.max(1, SHARD_COUNT - 1); console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  if (e.key === 'L' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_COUNT = Math.min(12, SHARD_COUNT + 1); console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  if (e.key === 'Y' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_SPEED = Math.max(0.005, +(SHARD_SPEED - 0.005).toFixed(3)); console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  if (e.key === 'U' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_SPEED = +(SHARD_SPEED + 0.005).toFixed(3); console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  if (e.key === 'T' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_DURATION = Math.max(100, SHARD_DURATION - 50); console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  if (e.key === 'P' && e.shiftKey && e.ctrlKey) { e.preventDefault(); SHARD_DURATION += 50; console.log('[KRR SHARD] count=' + SHARD_COUNT + ' spd=' + SHARD_SPEED + ' dur=' + SHARD_DURATION); }
  // ===== END SHARD TUNER =====

  // ===== TEMP DIAG: black-patch mesh isolation + breath freeze =====
  // Ctrl+Shift+H: step through GLB meshes, hiding one at a time by elimination
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'H') {
    e.preventDefault();
    if (_kayakerMeshes.length === 0) { console.log('[KRR DIAG] GLB not yet loaded'); return; }
    // Restore the previously hidden mesh (if any)
    if (_kayakerHideIdx >= 0 && _kayakerHideIdx < _kayakerMeshes.length) {
      _kayakerMeshes[_kayakerHideIdx].visible = true;
    }
    // Advance: -1 means all visible; indices 0..N-1 each hide one mesh
    _kayakerHideIdx = (_kayakerHideIdx + 1 >= _kayakerMeshes.length) ? -1 : _kayakerHideIdx + 1;
    if (_kayakerHideIdx === -1) {
      console.log('[KRR DIAG] All ' + _kayakerMeshes.length + ' meshes visible');
    } else {
      _kayakerMeshes[_kayakerHideIdx].visible = false;
      var _hm = _kayakerMeshes[_kayakerHideIdx];
      console.log('[KRR DIAG] Hiding ' + _kayakerHideIdx + '/' + (_kayakerMeshes.length - 1) + ': "' + _hm.name + '"' +
        ' map=' + (_hm.material.map ? 'SET' : 'null') + ' color=#' + _hm.material.color.getHexString());
    }
  }
  // Ctrl+Shift+B: toggle torso freeze at maximum-forward rotation (holds black patch still)
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'B') {
    e.preventDefault();
    _breathFrozen = !_breathFrozen;
    var _tgFrz = glbTorsoGroup || glbTorsoNode;
    if (_breathFrozen && _tgFrz) {
      _tgFrz.rotation.x = -TORSO_ROCK;  // pin at peak forward lean (sin=1 peak)
    }
    console.log('[KRR DIAG] breathFrozen=' + _breathFrozen +
      (_tgFrz ? ' hinge.rx=' + _tgFrz.rotation.x.toFixed(3) : ' (torso not found)'));
  }
  // ===== END TEMP DIAG =====
});

// Keyup: release daring steer flags (harmless in classic since flags are never read there)
window.addEventListener('keyup', e => {
  switch (e.key) {
    case 'ArrowLeft':  case 'a': case 'A': _daringSteerL = false; break;
    case 'ArrowRight': case 'd': case 'D': _daringSteerR = false; break;
  }
});

// ── TOUCH CONTROLS ─────────────────────────────────────────────────
// Tune these if feel needs adjustment on different devices
var TOUCH_FLICK_MS   = 300;  // max ms a gesture can take and still count as a flick/swipe
var TOUCH_SWIPE_DIST = 28;   // min px travel for any gesture to register
var TOUCH_DRAG_DEAD  = 15;   // px from start before daring live-steer engages (joystick deadzone)

var _tX0 = 0, _tY0 = 0, _tT0 = 0;  // gesture start coords + timestamp
var _tDown = false;                  // true while finger is on canvas

canvas3d.addEventListener('touchstart', function(e) {
  e.preventDefault();
  var t = e.changedTouches[0];
  _tX0 = t.clientX; _tY0 = t.clientY; _tT0 = Date.now();
  _tDown = true;
}, { passive: false });

// DARING only: live horizontal drag steers on the ground and air-spins while jumping.
// Uses total displacement from start (centered-joystick feel), not per-event delta.
canvas3d.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if (!_tDown || gameState3 !== 'playing' || playMode3 !== 'daring') return;
  var dx = e.changedTouches[0].clientX - _tX0;
  if      (dx >  TOUCH_DRAG_DEAD) { _daringSteerL = false; _daringSteerR = true;  }
  else if (dx < -TOUCH_DRAG_DEAD) { _daringSteerL = true;  _daringSteerR = false; }
  else                             { _daringSteerL = false; _daringSteerR = false; }
}, { passive: false });

canvas3d.addEventListener('touchend', function(e) {
  e.preventDefault();
  _tDown = false;
  if (gameState3 !== 'playing') return;
  var t   = e.changedTouches[0];
  var dx  = t.clientX - _tX0;
  var dy  = t.clientY - _tY0;
  var dt  = Date.now() - _tT0;
  var mag = Math.hypot(dx, dy);

  if (playMode3 === 'daring') {
    // Always clear live steer when finger lifts
    _daringSteerL = false; _daringSteerR = false;

    // Slow drags: physics already applied via touchmove; nothing extra on lift
    if (dt >= TOUCH_FLICK_MS || mag < TOUCH_SWIPE_DIST) return;

    // Flick: classify by which components are present
    var _th  = TOUCH_SWIPE_DIST * 0.55;  // per-axis threshold (55% of total so diagonals count)
    var hasU = dy < -_th;
    var hasD = dy >  _th;
    var hasL = dx < -_th;
    var hasR = dx >  _th;

    if (hasU) {
      // Upward flick (pure or diagonal) → jump; diagonal adds a launch-direction impulse
      if (hasL) _daringVx -= DARING_MAX_SPD * 0.5;
      if (hasR) _daringVx += DARING_MAX_SPD * 0.5;
      doJump3();
    } else if (hasD && player3.isJumping) {
      // Downward flick while airborne → flair trick
      doTrick3();
    }
    // Pure horizontal quick-flick: touchmove already built _daringVx; no extra impulse needed

  } else {
    // CLASSIC — discrete swipes only; no live-drag state, no reversing, no spinning
    if (mag < TOUCH_SWIPE_DIST) return;

    if (Math.abs(dy) > Math.abs(dx)) {
      // Vertical dominant
      if (dy < 0)                 doJump3();   // up → jump (also works mid-air for lane changes via separate left/right swipes)
      else if (player3.isJumping) doTrick3();  // down while airborne → trick; on ground does nothing
    } else {
      // Horizontal dominant — works on ground AND mid-air in classic (mid-air lane changes)
      if (dx < 0) doLeft3();
      else        doRight3();
    }
  }
}, { passive: false });

canvas3d.addEventListener('touchcancel', function(e) {
  // Finger interrupted (notification, call, etc.) — clean up steer state
  _tDown = false;
  _daringSteerL = false; _daringSteerR = false;
}, { passive: false });

// ── CONTROLS3 SCREEN HELPERS ──────────────────────────────────────
var _isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
document.getElementById('controls3-img').src =
  _isTouch ? 'controls-mobile.png?v=1' : 'controls-desktop.png?v=1';

function _controls3KeyHandler() {
  _hideControls3();
  document.getElementById('notice3').classList.add('visible');
}
function _showControls3() {
  document.getElementById('controls3').classList.add('visible');
  document.addEventListener('keydown', _controls3KeyHandler);
}
function _hideControls3() {
  document.getElementById('controls3').classList.remove('visible');
  document.removeEventListener('keydown', _controls3KeyHandler);
}
document.getElementById('controls3').addEventListener('click', function() {
  _hideControls3();
  document.getElementById('notice3').classList.add('visible');
});

// ── SCOREBOARD ────────────────────────────────────────────────────
var _scoreboardOpener = 'mainmenu'; // 'mainmenu' | 'pause' | 'win'
var _runOranges       = 0;          // total oranges collected this run (not current basket)

function _closeScoreboard3() {
  if (_scoreboardOpener === 'pause') {
    showScreen3('paused');
  } else if (_scoreboardOpener === 'win') {
    gameState3 = 'ending2'; showScreen3('ending2');
  } else {
    showScreen3('start');
  }
}

function _renderScoreboard3(rows, ownRank) {
  var container = document.getElementById('sb3-rows');
  var empty     = document.getElementById('sb3-empty');
  container.innerHTML = '';
  container.scrollTop = 0;
  if (!rows || rows.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  for (var i = 0; i < rows.length; i++) {
    var r   = rows[i];
    var row = document.createElement('div');
    row.className = 'sb3-row' + (ownRank && (i + 1) === ownRank ? ' sb3-own' : '');
    var rank  = document.createElement('span'); rank.className  = 'sb3-cell sb3-rank';  rank.textContent = '#' + (i + 1);
    var name  = document.createElement('span'); name.className  = 'sb3-cell sb3-name';  name.textContent = (r.name || '???').toUpperCase();
    var score = document.createElement('span'); score.className = 'sb3-cell sb3-score'; score.textContent = String(r.score || 0);
    var orng  = document.createElement('span'); orng.className  = 'sb3-cell sb3-orng';  orng.textContent = String(r.oranges || 0);
    row.appendChild(rank); row.appendChild(name); row.appendChild(score); row.appendChild(orng);
    container.appendChild(row);
  }
  // Scroll own row into view when returning after a win submit
  if (ownRank) {
    var ownRow = container.querySelector('.sb3-own');
    if (ownRow) setTimeout(function() { ownRow.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
  }
}

function openScoreboard3(opener) {
  _scoreboardOpener = opener || 'mainmenu';
  document.getElementById('sb3-rows').innerHTML = '';
  document.getElementById('sb3-empty').style.display = 'none';
  showScreen3('scoreboard');
  fetch('/.netlify/functions/scores')
    .then(function(res) { return res.ok ? res.json() : Promise.reject(res.status); })
    .then(function(data) { _renderScoreboard3(Array.isArray(data) ? data : [], null); })
    .catch(function()   { _renderScoreboard3([], null); });
}

// Click anywhere outside the row list to close; scrolling rows should not dismiss it
document.getElementById('screen3-scoreboard').addEventListener('click', function(e) {
  if (e.target.closest && e.target.closest('#sb3-rows')) return;
  _closeScoreboard3();
});

// ── BUTTON WIRING ─────────────────────────────────────────────────
document.getElementById('btn3-start').addEventListener('click', function() {
  if (playMode3 === null) { _nudgeModeCards(); return; }
  document.getElementById('overlay3').classList.add('hidden');
  _showControls3();
});
document.getElementById('btn3-ready').addEventListener('click', function() {
  document.getElementById('notice3').classList.remove('visible');
  startGame3();
});
document.getElementById('btn3-retry').addEventListener('click', startGame3);
document.getElementById('btn3-menu').addEventListener('click', () => showScreen3('start'));
document.getElementById('btn3-resume').addEventListener('click', () => {
  gameState3 = 'playing';
  document.getElementById('overlay3').classList.add('hidden');
});
document.getElementById('btn3-quit').addEventListener('click', () => {
  gameState3 = 'start'; showScreen3('start');
});
document.getElementById('btn3-scoreboard').addEventListener('click', function(e) {
  e.stopPropagation();
  openScoreboard3('pause');
});
document.getElementById('btn3-sb-mainmenu').addEventListener('click', function(e) {
  e.stopPropagation();
  openScoreboard3('mainmenu');
});

// ── MODE CARD PICKER ──────────────────────────────────────────────
function _updateModeToggleLabel() {
  var elC = document.getElementById('mode-card-classic');
  var elD = document.getElementById('mode-card-daring');
  if (!elC || !elD) return;
  elC.classList.toggle('selected', playMode3 === 'classic');
  elD.classList.toggle('selected', playMode3 === 'daring');
}
function _nudgeModeCards() {
  var cards = [document.getElementById('mode-card-classic'), document.getElementById('mode-card-daring')];
  var hdr   = document.getElementById('mode-picker-header');
  cards.forEach(function(el) { el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); });
  if (hdr) { hdr.classList.remove('flash'); void hdr.offsetWidth; hdr.classList.add('flash'); }
  setTimeout(function() {
    cards.forEach(function(el) { el.classList.remove('nudge'); });
    if (hdr) hdr.classList.remove('flash');
  }, 600);
}
document.getElementById('mode-card-classic').addEventListener('click', function(e) {
  e.stopPropagation();
  playMode3 = 'classic';
  localStorage.setItem('krr3d_mode', playMode3);
  _updateModeToggleLabel();
});
document.getElementById('mode-card-daring').addEventListener('click', function(e) {
  e.stopPropagation();
  playMode3 = 'daring';
  localStorage.setItem('krr3d_mode', playMode3);
  _updateModeToggleLabel();
});
_updateModeToggleLabel();
document.getElementById('btn3-pause').addEventListener('click', () => {
  if (gameState3 === 'playing') { gameState3 = 'paused'; showScreen3('paused'); }
});
document.getElementById('btn3-ending1-continue').addEventListener('click', () => {
  showScreen3('nameentry');
});

document.getElementById('btn3-nameentry-submit').addEventListener('click', function() {
  var name = document.getElementById('sb3-name-input').value.trim().toUpperCase();
  if (!name) { document.getElementById('sb3-name-input').focus(); return; }
  var btn = this;
  btn.disabled = true; btn.textContent = '...';
  fetch('/.netlify/functions/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, score: Math.floor(score3), oranges: _runOranges })
  })
  .then(function(res) { return res.ok ? res.json() : Promise.reject(res.status); })
  .then(function(data) {
    btn.disabled = false; btn.textContent = 'SUBMIT';
    _scoreboardOpener = 'win';
    document.getElementById('sb3-rows').innerHTML = '';
    document.getElementById('sb3-empty').style.display = 'none';
    showScreen3('scoreboard');
    _renderScoreboard3(Array.isArray(data.top) ? data.top : [], data.rank || null);
  })
  .catch(function() {
    btn.disabled = false; btn.textContent = 'SUBMIT';
    openScoreboard3('win');
  });
});

document.getElementById('btn3-nameentry-skip').addEventListener('click', function() {
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
var _loopLastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
var _loopAcc   = 0;
const SIM_STEP_MS   = 1000 / 60;  // one sim tick = 1/60 s (matches how the game was tuned)
const SIM_MAX_STEPS = 5;           // cap catch-up so a slow frame can't spiral

// FPS meter — hidden unless ?fps=1 in URL or 'F' key pressed
var _fpsShow   = /[?&]fps=1/.test(location.search);
var _fpsFrames = 0;
var _fpsT0     = _loopLastT;
var _fpsSteps  = 0;
var _fpsEl     = null;
function _ensureFpsEl() {
  if (_fpsEl) return;
  _fpsEl = document.createElement('div');
  _fpsEl.style.cssText = 'position:fixed;top:6px;right:8px;z-index:99999;font:bold 13px/1.3 monospace;'
    + 'color:#8fff8f;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:5px;pointer-events:none;white-space:pre;';
  document.body.appendChild(_fpsEl);
}
window.addEventListener('keydown', function(e) {
  if (e.key === 'f' || e.key === 'F') { _fpsShow = !_fpsShow; if (!_fpsShow && _fpsEl) _fpsEl.style.display = 'none'; }
});

function loop3() {
  requestAnimationFrame(loop3);

  var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  var frameMs = now - _loopLastT;
  _loopLastT = now;
  if (frameMs > 250) frameMs = 250;  // clamp big gaps (tab backgrounded, etc.)

  var stepsThisFrame = 0;
  if (gameState3 === 'playing') {
    _loopAcc += frameMs;
    while (_loopAcc >= SIM_STEP_MS && stepsThisFrame < SIM_MAX_STEPS) {
      update3();
      _loopAcc -= SIM_STEP_MS;
      stepsThisFrame++;
    }
    if (stepsThisFrame >= SIM_MAX_STEPS) _loopAcc = 0;  // can't keep up — drop backlog, hold correct speed
  } else {
    _loopAcc = 0;
  }

  updateVisuals3();
  renderer.render(scene, camera);

  // FPS sampling
  _fpsFrames++;
  _fpsSteps += stepsThisFrame;
  if (_fpsShow) {
    _ensureFpsEl();
    _fpsEl.style.display = 'block';
    var el = now - _fpsT0;
    if (el >= 500) {
      var fps = Math.round(_fpsFrames * 1000 / el);
      var spf = (_fpsSteps / Math.max(1, _fpsFrames)).toFixed(1);
      _fpsEl.textContent = fps + ' fps  (' + spf + ' steps/frame)';
      _fpsFrames = 0; _fpsSteps = 0; _fpsT0 = now;
    }
  }
}

// ── AUDIO ─────────────────────────────────────────────────────────

var _audioMuted  = localStorage.getItem('krr3d_muted') === '1';
var _audioVolume = parseFloat(localStorage.getItem('krr3d_vol') || '0.30');

// Music — single element, never recreated; survives deaths/stages/menus
var _muzTracks = ['music-twang.mp3?v=1', 'music-hidden-creek.mp3?v=1', 'music-desert-road.mp3?v=1'];
(function() {  // Fisher-Yates shuffle once at load
  for (var i = _muzTracks.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = _muzTracks[i]; _muzTracks[i] = _muzTracks[j]; _muzTracks[j] = t;
  }
})();
var _muzIdx   = 0;
var _muzEl    = new Audio(_muzTracks[0]);
_muzEl.volume = _audioVolume;
_muzEl.muted  = _audioMuted;
_muzEl.addEventListener('ended', function() {
  _muzIdx    = (_muzIdx + 1) % _muzTracks.length;
  _muzEl.src = _muzTracks[_muzIdx];
  _muzEl.play().catch(function() {});
});
var _muzStarted = false;
function _muzKickoff() {
  if (_muzStarted) return;
  _muzStarted = true;
  _muzEl.play().catch(function() {});
}
// Unlock on first user gesture (browser autoplay policy blocks music until then)
(function() {
  function _firstGesture() {
    _muzKickoff();
    document.removeEventListener('click',      _firstGesture, true);
    document.removeEventListener('touchstart', _firstGesture, true);
    document.removeEventListener('keydown',    _firstGesture, true);
  }
  document.addEventListener('click',      _firstGesture, true);
  document.addEventListener('touchstart', _firstGesture, true);
  document.addEventListener('keydown',    _firstGesture, true);
})();

// SFX — preloaded; cloneNode() lets the same sound overlap itself
var _sfxEls = (function() {
  var files = {
    jump:     'sfx-jump.mp3',
    collect:  'sfx-collect.mp3',
    trick:    'sfx-trick.mp3',
    crash:    'sfx-crash.mp3',
    splash:   'sfx-splash.mp3',
    select:   'sfx-select.mp3',
    shield:   'sfx-shield.mp3',
    nearmiss: 'sfx-nearmiss.mp3'
  };
  var els = {};
  Object.keys(files).forEach(function(k) {
    var a = new Audio(files[k] + '?v=1');
    a.volume = 0.45; a.preload = 'auto';
    els[k] = a;
  });
  return els;
})();
function _sfxPlay(key) {
  if (_audioMuted) return;
  var src = _sfxEls[key]; if (!src) return;
  var c = src.cloneNode();
  c.volume = Math.min(1.0, _audioVolume * 1.5);  // SFX ~1.5× music; scale with master volume
  c.play().catch(function() {});
}

// Mute toggle — applies to music + SFX, persisted to localStorage
function _setMuted(val) {
  _audioMuted  = val;
  _muzEl.muted = val;
  localStorage.setItem('krr3d_muted', val ? '1' : '0');
  document.getElementById('btn-mute').textContent = val ? '🔇' : '🔊';
}
_setMuted(_audioMuted);  // apply persisted state immediately
document.getElementById('btn-mute').addEventListener('click', function() {
  _setMuted(!_audioMuted);
});

// ── VOLUME SLIDER (desktop only; hidden on touch via CSS pointer:fine) ───────
(function() {
  var _vs = document.getElementById('vol-slider');
  if (!_vs) return;
  _vs.value = _audioVolume;
  _vs.addEventListener('input', function() {
    _audioVolume    = parseFloat(this.value);
    _muzEl.volume   = _audioVolume;
    localStorage.setItem('krr3d_vol', _audioVolume.toFixed(2));
  });
})();

// SFX: select sound on all menu/UI buttons
['btn3-start','btn3-ready','btn3-story','btn3-sb-mainmenu','btn3-scoreboard',
 'btn3-pause','btn3-resume','btn3-quit','btn3-retry','btn3-menu',
 'mode-card-classic','mode-card-daring'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function() { _sfxPlay('select'); });
});

// ── INIT ──────────────────────────────────────────────────────────
buildWorld();
initCloudPatches();
_initWildlife();
_initStoryViewer();
showScreen3('start');
loop3();
