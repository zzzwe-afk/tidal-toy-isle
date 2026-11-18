import * as THREE from '../vendor/three.module.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { initAudio, sfx, setMuted, isMuted } from './audio.js';
import { ITEMS, RECIPES, BUILDS, QUESTS, BOAT_REPAIR, canAfford, pay, costText, TOOLS } from './data.js';
import { createCampfire, createWorkbench, createChest, createBed } from './models.js';
import { angleLerp, clamp, damp, TAU } from './util.js';

/* ---------------- 渲染基础 ---------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 24, 52);

const SAVE_KEY = 'tidalToyIsle_save_v1';

/* ---------------- 游戏状态 ---------------- */
const S = {
  started: false,
  paused: true,
  dead: false,
  victory: false,
  sailing: false,
  time: 0,
  dayTime: 0.36,
  day: 1,
  tide: 0.05,
  tideRising: true,
  weather: { type: 'sunny', label: '晴朗', timer: 110 },
  inventory: { wood: 0, stone: 0, fiber: 0, coconut: 0, fish: 0, cookedFish: 0, shell: 0, crabMeat: 0 },
  tools: { axe: false, pickaxe: false, sword: false, rod: false },
  quest: 0,
  boatStage: 0,
  boatHeading: Math.PI,
  boatVel: 0,
  built: [],
  landedB: false,
  treasureFound: false,
  stats: { kills: 0, gathered: 0, built: 0 },
  build: null,
  gather: { node: null, t: 0 },
  fishing: 0,
  lostPack: null,
  saveTimer: 0,
  uiTimer: 0,
  shake: 0,
};

const world = new World(scene);
const player = new Player(scene);
const fx = new FX(scene);

const SPAWN = new THREE.Vector3(-19.5, 0, 12);
const CAMP_SPAWN = new THREE.Vector3(-17, 0, 10);
const BOAT_START = new THREE.Vector3(-25.5, 0, 12.5);
player.pos.copy(SPAWN);
player.pos.y = world.heightAt(SPAWN.x, SPAWN.z);
player.heading = 2.6;
player.root.position.copy(player.pos);

world.boatPos.copy(BOAT_START);
world.boat.position.set(BOAT_START.x, Math.max(world.heightAt(BOAT_START.x, BOAT_START.z), -0.1), BOAT_START.z);

/* ---------------- UI ---------------- */
const ui = new UI({
  onNewGame: () => {
    if (readSave()) startFresh();
    else startGame(null);
  },
  onContinueGame: () => {
    const sv = readSave();
    if (sv) startGame(sv);
    else startGame(null);
  },
  onRespawn: () => respawn(),
  onContinue: () => {
    S.victory = false;
    S.paused = false;
    ui.hideVictory();
    ui.toast('潮汐罗盘在你手里微微发热。', 'good');
  },
  onRestart: () => startFresh(),
  onEat: (key) => eatItem(key),
  onCraft: (r) => craftRecipe(r),
  onBuildSelect: (b) => enterBuild(b),
});

/* ---------------- 镜头与输入 ---------------- */
let camYaw = 2.6 + Math.PI;
let camPitch = 0.36;
let camDist = 8.6;
const camLook = new THREE.Vector3();
const camDesired = new THREE.Vector3();
let dragging = false;
let lastPointer = { x: 0, y: 0 };
const keys = {};

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  if (!S.started) return;
  if (e.button === 2) {
    dragging = true;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button === 0) {
    if (S.paused) return;
    if (S.build) placeBuild();
    else tryAttack();
  }
});

window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  camYaw -= dx * 0.0045;
  camPitch = clamp(camPitch + dy * 0.0032, 0.06, 0.95);
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 2) dragging = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camDist = clamp(camDist + e.deltaY * 0.008, 4.5, 13);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement) return;
  keys[e.code] = true;
  if (!S.started) return;

  if (e.code === 'Escape') {
    if (S.build) cancelBuild();
    else ui.closeSheets();
    return;
  }
  if (e.code === 'KeyC' && !S.paused && !S.sailing) {
    if (ui.craftOpen) ui.closeCraft();
    else openCraftPanel();
  }
  if (e.code === 'KeyB' && !S.paused && !S.sailing) {
    if (S.build) cancelBuild();
    else if (ui.buildOpen) ui.closeBuild();
    else ui.openBuild(BUILDS, S.inventory);
  }
  if (e.code === 'KeyR' && S.build) S.build.rot += Math.PI / 4;
  if (e.code === 'KeyE') {
    if (S.paused) return;
    interact();
  }
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    ui.toast(isMuted() ? '静音' : '声音恢复');
  }
  if (e.code === 'Space') e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- 天气/时间 ---------------- */
const WEATHER = {
  sunny: { label: '晴朗', min: 90, max: 140 },
  rain: { label: '阵雨', min: 50, max: 90 },
  fog: { label: '海雾', min: 45, max: 80 },
  storm: { label: '风暴', min: 32, max: 55 },
};
const WEATHER_TOAST = {
  sunny: '云散开了，阳光重新落在沙滩上。',
  rain: { msg: '阵雨来了，火堆小声地噼啪了一下。', kind: 'warn' },
  fog: { msg: '海雾涌上来，远处的灯塔只剩一个影子。', kind: 'warn' },
  storm: { msg: '风暴压过来了。抓紧船和营地。', kind: 'bad' },
};

function rollWeather() {
  const r = Math.random();
  let type = 'sunny';
  if (r > 0.9) type = 'storm';
  else if (r > 0.72) type = 'fog';
  else if (r > 0.48) type = 'rain';
  const conf = WEATHER[type];
  S.weather = {
    type,
    label: conf.label,
    timer: conf.min + Math.random() * (conf.max - conf.min),
  };
  const t = WEATHER_TOAST[type];
  if (typeof t === 'string') ui.toast(t);
  else ui.toast(t.msg, t.kind);
}

/* ---------------- 存档 ---------------- */
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeSave() {
  if (!S.started) return;
  const data = {
    inventory: S.inventory,
    tools: S.tools,
    quest: S.quest,
    day: S.day,
    dayTime: S.dayTime,
    boatStage: S.boatStage,
    landedB: S.landedB,
    treasureFound: S.treasureFound,
    stats: S.stats,
    boatPos: { x: world.boatPos.x, z: world.boatPos.z },
    pos: { x: player.pos.x, z: player.pos.z },
    heading: player.heading,
    built: S.built.map((b) => ({ type: b.type, x: b.x, z: b.z, rot: b.rot })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* 忽略 */ }
}

function startFresh() {
  localStorage.removeItem(SAVE_KEY);
  sessionStorage.setItem('tidalAutoStart', '1');
  location.reload();
}

function applySave(sv) {
  Object.keys(S.inventory).forEach((k) => {
    S.inventory[k] = Number(sv.inventory?.[k] || 0);
  });
  Object.keys(S.tools).forEach((k) => { S.tools[k] = !!sv.tools?.[k]; });
  S.quest = sv.quest || 0;
  S.day = sv.day || 1;
  S.dayTime = sv.dayTime ?? 0.36;
  S.landedB = !!sv.landedB;
  S.treasureFound = !!sv.treasureFound;
  S.stats = sv.stats || S.stats;
  S.boatStage = sv.boatStage || 0;
  S.boatHeading = Math.PI;

  if (sv.boatPos) {
    world.boatPos.set(sv.boatPos.x, 0, sv.boatPos.z);
  }
  world.setBoatStage(S.boatStage);

  (sv.built || []).forEach((b) => addBuilding(b.type, b.x, b.z, b.rot, false));
  if (S.boatStage >= 2) {
    world.boat.position.set(world.boatPos.x, world.waterLevel + 0.15, world.boatPos.z);
  }

  if (sv.pos) {
    player.pos.set(sv.pos.x, world.heightAt(sv.pos.x, sv.pos.z), sv.pos.z);
  }
  player.heading = sv.heading || 0;
  player.root.position.copy(player.pos);
  player.root.rotation.y = player.heading;

  if (S.treasureFound) {
    world.treasureFound = true;
    world.treasure.userData.lid.rotation.x = -0.6;
  }

  const tool = S.tools.sword ? 'sword' : S.tools.axe ? 'axe' : null;
  player.setTool(tool);
  ui.setEquip(tool);
}

/* ---------------- 开局 ---------------- */
function startGame(save) {
  S.started = true;
  initAudio();
  ui.hideStart();
  ui.showHUD();
  S.weather = { type: 'sunny', label: '晴朗', timer: 100 };

  if (save) {
    applySave(save);
    ui.toast('欢迎回到岛上。', 'good');
  } else {
    S.inventory = { wood: 0, stone: 0, fiber: 0, coconut: 0, fish: 0, cookedFish: 0, shell: 0, crabMeat: 0 };
    S.tools = { axe: false, pickaxe: false, sword: false, rod: false };
    S.built = [];
    S.quest = 0;
    S.boatStage = 0;
    world.setBoatStage(0);
    player.reset(SPAWN);
    player.pos.y = world.heightAt(SPAWN.x, SPAWN.z);
    player.heading = 2.6;
    camYaw = 2.6 + Math.PI;
    setTimeout(() => {
      ui.toast('潮水把一小袋材料冲上了岸。', 'good');
      setTimeout(() => ui.toast('按 E 采集，按 C 制作，按 B 建造。'), 1800);
    }, 400);
  }

  S.paused = false;
  S.dead = false;
  S.victory = false;
  snapCamera();
  refreshUI(true);
}

window.addEventListener('beforeunload', writeSave);

/* ---------------- 工具函数 ---------------- */
function refreshUI(force = false) {
  ui.setVitals(player.health, player.stamina, player.hunger);
  ui.setInventory(S.inventory, S.tools);
  ui.setClock(S.dayTime, S.day, S.weather, S.tide, S.tideRising);
  let progress = '';
  if (S.quest === 0) {
    progress = `${Math.min(S.inventory.wood, 3)}/3 木材 · ${Math.min(S.inventory.fiber, 2)}/2 纤维 · ${Math.min(S.inventory.stone, 2)}/2 石头`;
  }
  ui.setQuests(S.quest, progress);
  ui.setEquip(player.tool);
}

function addItem(key, n) {
  if (!ITEMS[key]) return;
  S.inventory[key] = (S.inventory[key] || 0) + n;
  S.stats.gathered += n;
  const slot = ui.slots[key];
  if (slot) {
    slot.root.classList.remove('pulse');
    void slot.root.offsetWidth;
    slot.root.classList.add('pulse');
  }
}

function gainToast(text) {
  ui.toast(text, 'good');
}

function nearBuilding(type, radius = 3.2) {
  return S.built.find((b) => b.type === type
    && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < radius
    && Math.abs(world.heightAt(b.x, b.z) - player.pos.y) < 2.5) || null;
}

function campfirePos() {
  const f = S.built.find((b) => b.type === 'campfire');
  if (f) return new THREE.Vector3(f.x, world.heightAt(f.x, f.z), f.z);
  return new THREE.Vector3(world.camp.x, world.camp.h, world.camp.z);
}

function updateQuest() {
  let changed = false;
  for (let guard = 0; guard < 8; guard++) {
    let advance = false;
    if (S.quest === 0) {
      advance = S.inventory.wood >= 3 && S.inventory.fiber >= 2 && S.inventory.stone >= 2;
    } else if (S.quest === 1) {
      advance = S.built.some((b) => b.type === 'campfire');
    } else if (S.quest === 2) {
      advance = S.tools.axe;
    } else if (S.quest === 3) {
      advance = S.built.some((b) => b.type === 'workbench');
    } else if (S.quest === 4) {
      advance = S.boatStage >= 2;
    } else if (S.quest === 5) {
      advance = S.landedB;
    }
    if (!advance) break;
    S.quest += 1;
    changed = true;
    const q = QUESTS[S.quest];
    if (q) {
      setTimeout(() => ui.toast(`手账更新：${q.text}`, 'good'), 120);
      sfx('craft');
    }
  }
  if (changed) refreshUI();
}

/* ---------------- 采集 ---------------- */
const ITEM_FX = {
  wood: '#d9ab72', stone: '#d4dbd2', fiber: '#9dd77c', coconut: '#b98a5e',
  fish: '#9ed3d8', cookedFish: '#f0b06c', shell: '#f5c1ad', crabMeat: '#f39072',
};

function nearestTarget() {
  if (S.sailing || S.paused) return null;
  let best = null;
  let bestD = 1e9;
  const px = player.pos.x, pz = player.pos.z, py = player.pos.y;

  world.nodes.forEach((n) => {
    if (!n.alive) return;
    const d = Math.hypot(n.x - px, n.z - pz);
    if (d < n.radius && Math.abs(n.pos.y - py) < 2.6 && d < bestD) {
      bestD = d;
      best = { kind: 'node', node: n, dist: d };
    }
  });

  S.built.forEach((b) => {
    const d = Math.hypot(b.x - px, b.z - pz);
    if (d < 2.9 && d < bestD) {
      bestD = d;
      best = { kind: 'building', building: b, dist: d };
    }
  });

  if (world.boatReady || S.boatStage < 2) {
    const d = Math.hypot(world.boat.position.x - px, world.boat.position.z - pz);
    const gy = world.heightAt(world.boat.position.x, world.boat.position.z);
    if (d < 4.6 && Math.abs(gy - py) < 3.5 && d < bestD) {
      bestD = d;
      best = { kind: 'boat', dist: d };
    }
  }

  if (!world.treasureFound) {
    const t = world.treasure.position;
    const d = Math.hypot(t.x - px, t.z - pz);
    if (d < 3.2 && Math.abs(t.y - py) < 2.5 && d < bestD) {
      bestD = d;
      best = { kind: 'treasure', dist: d };
    }
  }

  if (S.lostPack) {
    const p = S.lostPack.object.position;
    const d = Math.hypot(p.x - px, p.z - pz);
    if (d < 2.7 && d < bestD) {
      bestD = d;
      best = { kind: 'pack', dist: d };
    }
  }

  return best;
}

function canFish() {
  if (!S.tools.rod || player.swimming) return false;
  const fx2 = Math.sin(player.heading);
  const fz2 = Math.cos(player.heading);
  for (let i = 1; i <= 5; i++) {
    const x = player.pos.x + fx2 * i;
    const z = player.pos.z + fz2 * i;
    if (world.heightAt(x, z) < world.waterLevel - 0.9) return true;
  }
  return false;
}

function promptForTarget(t) {
  if (S.sailing) return '靠岸登陆';
  if (S.build) return '左键放置 · R 旋转 · Esc 取消';
  if (!t) return canFish() ? '抛竿钓鱼' : null;
  switch (t.kind) {
    case 'node': {
      const n = t.node;
      return `${n.verb}${n.label}`;
    }
    case 'building': {
      const type = t.building.type;
      if (type === 'campfire') return '在营火旁烹饪';
      if (type === 'workbench') return '使用工作台';
      if (type === 'bed') return '睡到清晨';
      if (type === 'chest') return '打开储物箱';
      return '查看';
    }
    case 'boat':
      return S.boatStage < 2 ? BOAT_REPAIR[S.boatStage].label : '登船出海';
    case 'treasure': return '打开罗盘宝箱';
    case 'pack': return '取回遗落的材料';
    default: return null;
  }
}

function beginGather(node) {
  if (!node.alive) return;
  if (S.gather.node === node) return;
  S.gather.node = node;
  S.gather.t = node.def.instant ? 0.18 : 0.38;
  player.playGather();
  if (node.kind === 'tree' && S.tools.axe) player.setTool('axe');
  else if (node.kind === 'rock' && S.tools.pickaxe) player.setTool('pickaxe');
  else if (node.kind === 'tree' || node.kind === 'rock') player.setTool(null);
}

function applyGatherHit(node) {
  if (!node.alive) return;
  const done = node.hit();
  const yields = node.harvest(S.tools);
  let text = [];
  yields.forEach(([k, n]) => {
    addItem(k, n);
    text.push(`${ITEMS[k].name}×${n}`);
  });
  const color = ITEM_FX[yields[0]?.[0]] || '#ffe3a3';
  fx.burst(node.pos.clone().setY(node.pos.y + 0.6), color, done ? 16 : 7, {
    speed: 2.6, life: 0.5, size: 0.08,
  });
  S.gather.t = node.def.instant ? 0.5 : 0.46;
  if (node.kind === 'rock') sfx('pick');
  else if (node.kind === 'bush' || node.kind === 'coconut' || node.kind === 'shell') sfx('pickup');
  else sfx('chop');
  if (text.length) gainToast('+' + text.join(' · '));
  if (done) {
    ui.toast(node.kind === 'tree' ? '树倒了，留下了一圈年轮。' : `${node.label}采完了。`, 'good');
    fx.ring(node.pos.clone().setY(node.pos.y + 0.3), color, { life: 0.55, size: 1.3 });
  }
  updateQuest();
  refreshUI();
}

function startFishing() {
  if (S.fishing > 0) return;
  S.fishing = 2.4;
  player.setTool('rod');
  player.playGather();
  sfx('splash');
  ui.toast('抛竿……等鱼咬钩。');
}

function finishFishing() {
  S.fishing = 0;
  world.waterLevel;
  const splash = player.pos.clone();
  splash.y = world.waterLevel + 0.1;
  fx.burst(splash, '#cfeff2', 12, { speed: 2.2, life: 0.5, size: 0.07, gravity: 7 });
  if (Math.random() < 0.8) {
    addItem('fish', 1);
    gainToast('+生鱼×1');
    sfx('pickup');
  } else {
    ui.toast('鱼线一轻，只钓上来一团海草。', 'warn');
  }
  player.setTool(S.tools.sword ? 'sword' : null);
  refreshUI();
}

/* ---------------- 互动 ---------------- */
function interact() {
  if (S.build) { placeBuild(); return; }
  if (ui.craftOpen || ui.buildOpen) return;
  if (S.sailing) {
    tryDisembark();
    return;
  }
  const t = nearestTarget();
  if (!t) {
    if (canFish()) startFishing();
    return;
  }
  switch (t.kind) {
    case 'node':
      beginGather(t.node);
      applyGatherHit(t.node);
      S.gather.t = t.node.def.instant ? 0.55 : 0.5;
      break;
    case 'building': {
      const type = t.building.type;
      if (type === 'campfire') openCraftPanel();
      else if (type === 'workbench') openCraftPanel();
      else if (type === 'bed') sleepInBed();
      else if (type === 'chest') {
        sfx('click');
        ui.toast('箱子里只有一张被海水泡皱的旧海图。', 'warn');
      }
      break;
    }
    case 'boat':
      if (S.boatStage < 2) repairBoat();
      else boardBoat();
      break;
    case 'treasure':
      openTreasure();
      break;
    case 'pack':
      recoverPack();
      break;
  }
}

function openCraftPanel() {
  const nearFire = !!nearBuilding('campfire', 3.4);
  const nearBench = !!nearBuilding('workbench', 3.4);
  ui.openCraft(RECIPES, S.inventory, { nearFire, nearBench });
  sfx('click');
}

function craftRecipe(r) {
  const nearFire = !!nearBuilding('campfire', 3.4);
  const nearBench = !!nearBuilding('workbench', 3.4);
  if (r.station === 'fire' && !nearFire) {
    ui.toast('需要靠近营火才能烹饪。', 'warn');
    return;
  }
  if (r.station === 'workbench' && !nearBench) {
    ui.toast('需要靠近工作台。', 'warn');
    return;
  }
  if (r.tool && S.tools[r.tool]) {
    ui.toast('你已经有这件工具了。', 'warn');
    return;
  }
  if (!canAfford(S.inventory, r.cost)) {
    ui.toast('材料不够：' + costText(r.cost), 'bad');
    return;
  }
  pay(S.inventory, r.cost);
  if (r.tool) {
    S.tools[r.tool] = true;
    player.setTool(r.tool);
    ui.setEquip(r.tool);
  }
  if (r.item) addItem(r.item, 1);
  sfx('craft');
  ui.toast(`制作完成：${r.name}`, 'good');
  fx.burst(player.pos.clone().setY(player.pos.y + 1.1), '#ffd479', 14, { speed: 2.4, life: 0.6, size: 0.08 });
  fx.ring(player.pos.clone().setY(player.pos.y + 0.1), '#ffd479', { life: 0.5, size: 1.1 });
  ui.renderCraft(RECIPES, S.inventory);
  ui.setInventory(S.inventory, S.tools);
  updateQuest();
  refreshUI();
  writeSave();
}

function sleepInBed() {
  S.dayTime = 0.27;
  S.day += 1;
  player.stamina = 100;
  player.health = Math.min(100, player.health + 12);
  player.hunger = Math.max(0, player.hunger - 8);
  ui.toast('你在营地里睡到天亮，潮水退了。', 'good');
  sfx('craft');
  refreshUI();
}

/* ---------------- 战斗 ---------------- */
function tryAttack() {
  if (S.sailing || S.paused || ui.craftOpen || ui.buildOpen) return;
  if (!player.playAttack()) return;
  player.heading = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
  player.root.rotation.y = player.heading;
  const sword = S.tools.sword;
  player.setTool(sword ? 'sword' : null);
  const fxDir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const arcPos = player.pos.clone().add(fxDir.clone().multiplyScalar(1.0));
  fx.slashArc(arcPos, player.heading, sword ? '#ffe9a8' : '#e6f0e6');
  sfx('chop');

  const dmg = sword ? 24 : 7;
  let hitAny = false;
  world.crabs.forEach((crab) => {
    if (!crab.alive) return;
    const dx = crab.pos.x - player.pos.x;
    const dz = crab.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    const vy = Math.abs(crab.pos.y - player.pos.y);
    if (d > 3.0 || vy > 2.2) return;
    const dot = (Math.sin(player.heading) * dx + Math.cos(player.heading) * dz) / (d || 1);
    if (dot < -0.05) return;
    hitAny = true;
    const killed = crab.damage(dmg, player.pos);
    fx.burst(new THREE.Vector3(crab.pos.x, crab.pos.y + 1.1, crab.pos.z), '#fff1c4', 12, {
      speed: 3.4, life: 0.45, size: 0.07,
    });
    S.shake = 0.22;
    sfx('hit');
    if (killed) {
      S.stats.kills += 1;
      addItem('shell', 1);
      addItem('crabMeat', 2);
      fx.ring(new THREE.Vector3(crab.pos.x, crab.pos.y + 0.1, crab.pos.z), '#ffb27a', { life: 0.7, size: 1.6 });
      ui.toast('寄居蟹缩回了壳里。获得 蟹肉×2、贝壳×1', 'good');
      refreshUI();
    }
  });
  if (!hitAny) {
    // 空挥也有一点声音反馈
    S.shake = Math.max(S.shake, 0.05);
  }
}

function playerHurt(dmg) {
  if (S.sailing) return;
  player.takeDamage(dmg);
  if (player.hurtCd > 0.6) {
    ui.flashHurt();
    S.shake = 0.4;
    sfx('hurt');
  }
  if (player.health <= 0) die();
}

/* ---------------- 死亡与复活 ---------------- */
function die() {
  if (S.dead) return;
  S.dead = true;
  player.alive = false;
  player.root.visible = true;
  player.root.rotation.z = 1.2;
  sfx('death');
  ui.closeSheets();
  if (S.sailing) {
    S.sailing = false;
    world.setSail(false);
    world.boatPos.copy(BOAT_START);
  }
  player.root.visible = true;
  const lost = {};
  let any = false;
  const wasSailing = S.sailing;
  ['wood', 'stone', 'fiber', 'shell', 'coconut'].forEach((k) => {
    const n = Math.floor((S.inventory[k] || 0) * 0.5);
    if (n > 0) { lost[k] = n; S.inventory[k] -= n; any = true; }
  });
  if (any && !wasSailing) createLostPack(lost);
  const text = any ? '你遗落了一些材料，它们还在倒下的地方。' : '你在沙滩上醒来，随身没有可丢的东西。';
  ui.showDeath(text);
  ui.setInventory(S.inventory, S.tools);
  refreshUI();
}

function createLostPack(lost) {
  if (S.lostPack) {
    Object.entries(S.lostPack.lost).forEach(([k, n]) => { S.lostPack.lost[k] += n; });
    return;
  }
  const obj = createChest(false);
  obj.scale.setScalar(0.9);
  obj.position.copy(player.pos);
  obj.position.y = world.heightAt(obj.position.x, obj.position.z);
  obj.rotation.y = Math.random() * 3;
  scene.add(obj);
  S.lostPack = { object: obj, lost };
}

function recoverPack() {
  if (!S.lostPack) return;
  Object.entries(S.lostPack.lost).forEach(([k, n]) => addItem(k, n));
  ui.toast('你把湿漉漉的材料重新塞回了袋子。', 'good');
  scene.remove(S.lostPack.object);
  S.lostPack = null;
  sfx('pickup');
  refreshUI();
}

function respawn() {
  S.dead = false;
  player.alive = true;
  player.root.rotation.z = 0;
  const p = campfirePos();
  player.reset(p.clone().add(new THREE.Vector3(1.2, 0, 1.2)));
  player.pos.y = world.heightAt(player.pos.x, player.pos.z);
  player.root.position.copy(player.pos);
  player.hunger = 62;
  ui.hideDeath();
  snapCamera();
  ui.toast('你在营火旁醒来。去把遗落的材料捡回来吧。', 'good');
  refreshUI();
  writeSave();
}

/* ---------------- 建造 ---------------- */
function buildFactory(type) {
  if (type === 'campfire') return createCampfire();
  if (type === 'workbench') return createWorkbench();
  if (type === 'chest') return createChest(false);
  if (type === 'bed') return createBed();
  return new THREE.Group();
}

function addBuilding(type, x, z, rot, record = true) {
  const obj = buildFactory(type);
  const y = world.heightAt(x, z);
  obj.position.set(x, y - 0.02, z);
  obj.rotation.y = rot || 0;
  scene.add(obj);
  if (record) {
    S.built.push({ type, x, z, rot: rot || 0, object: obj });
    S.stats.built += 1;
  } else {
    S.built.push({ type, x, z, rot: rot || 0, object: obj });
  }
  if (type === 'campfire') {
    world.campMarker.visible = false;
  }
  return obj;
}

function enterBuild(b) {
  if (!canAfford(S.inventory, b.cost)) {
    ui.toast('材料不够：' + costText(b.cost), 'bad');
    return;
  }
  ui.closeSheets();
  const ghost = buildFactory(b.id);
  ghost.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.52;
      o.material.depthWrite = false;
    }
    if (o.isLight) o.visible = false;
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.35, 26),
    new THREE.MeshBasicMaterial({ color: '#7fd0a0', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ghost.add(ring);
  scene.add(ghost);
  S.build = { def: b, ghost, rot: 0, ring, valid: false };
  ui.toast('移动到一个平整的空地，左键放下。', 'good');
}

function cancelBuild() {
  if (!S.build) return;
  scene.remove(S.build.ghost);
  S.build = null;
  ui.toast('收起了建材。');
}

function updateGhost(dt) {
  if (!S.build) return;
  const dirX = Math.sin(player.heading);
  const dirZ = Math.cos(player.heading);
  const x = player.pos.x + dirX * 2.9;
  const z = player.pos.z + dirZ * 2.9;
  const h = world.heightAt(x, z);
  S.build.ghost.position.set(x, h - 0.02, z);
  S.build.ghost.rotation.y = player.heading + S.build.rot;
  S.build.ghost.rotation.z = 0;

  let valid = h > world.waterLevel + 0.12 && world.slopeAt(x, z) < 0.55;
  if (valid) {
    for (const b of S.built) {
      if (Math.hypot(b.x - x, b.z - z) < 3.1) { valid = false; break; }
    }
  }
  if (valid) {
    for (const n of world.nodes) {
      if (n.alive && Math.hypot(n.x - x, n.z - z) < 1.7) { valid = false; break; }
    }
  }
  if (valid && Math.hypot(world.boat.position.x - x, world.boat.position.z - z) < 3.4) valid = false;
  if (Math.hypot(player.pos.x - x, player.pos.z - z) < 1.6) valid = false;

  S.build.valid = valid && canAfford(S.inventory, S.build.def.cost);
  S.build.ring.material.color.set(S.build.valid ? '#7fd0a0' : '#e8735a');
  S.build.ring.material.opacity = 0.55 + Math.sin(S.time * 4) * 0.2;
  S.build.ghost.visible = true;
}

function placeBuild() {
  if (!S.build) return;
  if (!S.build.valid) {
    ui.toast('这里放不下，换一块平整的空地。', 'warn');
    return;
  }
  const b = S.build.def;
  if (!canAfford(S.inventory, b.cost)) {
    ui.toast('材料不够：' + costText(b.cost), 'bad');
    return;
  }
  pay(S.inventory, b.cost);
  const gx = S.build.ghost.position.x;
  const gz = S.build.ghost.position.z;
  addBuilding(b.id, gx, gz, player.heading + S.build.rot, true);
  scene.remove(S.build.ghost);
  S.build = null;
  sfx('repair');
  ui.toast(`${b.name}搭好了。`, 'good');
  fx.ring(new THREE.Vector3(gx, world.heightAt(gx, gz) + 0.1, gz), '#ffd479', { life: 0.7, size: 1.7 });
  refreshUI();
  updateQuest();
  writeSave();
}

/* ---------------- 小船 ---------------- */
function repairBoat() {
  const rep = BOAT_REPAIR[S.boatStage];
  if (!rep) return;
  if (!canAfford(S.inventory, rep.cost)) {
    ui.toast(`材料不够：${costText(rep.cost)}`, 'bad');
    return;
  }
  pay(S.inventory, rep.cost);
  S.boatStage += 1;
  world.setBoatStage(S.boatStage);
  sfx('repair');
  ui.toast(rep.doneText, 'good');
  fx.burst(world.boat.position.clone().setY(world.boat.position.y + 1.2), '#ffd479', 18, { speed: 2.6, life: 0.6, size: 0.09 });
  if (S.boatStage >= 2) {
    setTimeout(() => ui.toast('船修好了。靠岸时按 E 就能上船。', 'good'), 700);
  }
  refreshUI();
  updateQuest();
  writeSave();
}

function boardBoat() {
  if (S.boatStage < 2) return;
  S.sailing = true;
  world.setSail(true);
  S.boatHeading = Math.PI;
  world.boat.rotation.y = S.boatHeading;
  S.boatVel = 0;
  player.root.visible = false;
  camYaw = S.boatHeading + Math.PI;
  camDist = 11.5;
  sfx('sail');
  ui.toast('小船离岸了。W 前进，S 后退，A/D 转舵。', 'good');
  ui.closeSheets();
}

function endSailingAt(playerPoint, island) {
  S.sailing = false;
  world.setSail(false);
  player.root.visible = true;
  player.alive = true;
  player.pos.copy(playerPoint);
  player.pos.y = world.heightAt(playerPoint.x, playerPoint.z);
  player.root.position.copy(player.pos);
  player.root.rotation.z = 0;
  player.velY = 0;
  world.boatPos.copy(world.boat.position);
  camDist = 8;
  camPitch = 0.34;
  sfx('splash');
  ui.toast(`在${island.name}上岸。`, 'good');
  if (island.id === 'B' && !S.landedB) {
    S.landedB = true;
    updateQuest();
    setTimeout(() => ui.toast('林子里有一条通往高处的旧石阶。', 'good'), 1200);
  }
  refreshUI();
  writeSave();
}

function tryDisembark() {
  const isl = world.islandOf(world.boat.position.x, world.boat.position.z);
  if (isl.dist > isl.island.radius + 6) {
    ui.toast('这里离岸还远，再靠近一点。', 'warn');
    return;
  }
  const point = findShorePoint(isl.island);
  if (!point) {
    ui.toast('找不到可以上岸的地方。', 'warn');
    return;
  }
  endSailingAt(point, isl.island);
}

function findShorePoint(isl) {
  const bx = world.boat.position.x;
  const bz = world.boat.position.z;
  let dx = bx - isl.cx;
  let dz = bz - isl.cz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  let fallback = null;
  for (let d = isl.radius; d > 3; d -= 1) {
    const x = isl.cx + dx * d;
    const z = isl.cz + dz * d;
    const h = world.heightAt(x, z);
    if (h > 0.3 && h < 2.6) {
      if (!fallback) fallback = new THREE.Vector3(x, h, z);
      if (h > 0.6) return new THREE.Vector3(x, h, z);
    }
  }
  return fallback;
}

/* ---------------- 宝箱与结局 ---------------- */
function openTreasure() {
  if (world.treasureFound) return;
  world.treasureFound = true;
  S.treasureFound = true;
  world.treasure.userData.lid.rotation.x = -0.7;
  sfx('win');
  fx.burst(world.treasure.position.clone().setY(world.treasure.position.y + 1.2), '#ffe08a', 30, { speed: 4, life: 1.1, size: 0.12 });
  fx.ring(world.treasure.position.clone().setY(world.treasure.position.y + 0.2), '#ffe08a', { life: 1.0, size: 2.2 });
  S.quest = QUESTS.length;
  setTimeout(() => {
    S.victory = true;
    S.paused = true;
    ui.showVictory(`
      <div><b>${S.day}</b>天</div>
      <div><b>${S.stats.built}</b>设施</div>
      <div><b>${S.stats.kills}</b>寄居蟹</div>
      <div><b>${S.stats.gathered}</b>材料</div>
    `);
    writeSave();
  }, 1500);
  ui.toast('宝箱里躺着一片旧罗盘，指针还在轻轻发抖。', 'good');
}

/* ---------------- 进食 ---------------- */
function eatItem(key) {
  if (!S.started || S.paused) return;
  const def = ITEMS[key];
  if (!def) return;
  if (!def.food) { ui.toast(`${def.name}不能吃。`, 'warn'); return; }
  if ((S.inventory[key] || 0) <= 0) { ui.toast(`没有${def.name}了。`, 'warn'); return; }
  S.inventory[key] -= 1;
  player.hunger = Math.min(100, player.hunger + def.food);
  if (key === 'cookedFish') player.health = Math.min(100, player.health + 6);
  sfx('eat');
  ui.toast(`吃掉${def.name}，饥饿 +${def.food}`, 'good');
  fx.burst(player.pos.clone().setY(player.pos.y + 1.3), '#ffd479', 6, { speed: 1.4, life: 0.4, size: 0.06, gravity: 3 });
  refreshUI();
}

/* ---------------- 镜头更新 ---------------- */
function snapCamera() {
  const look = player.pos.clone();
  look.y += 1.15;
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch),
  ).multiplyScalar(camDist);
  camera.position.copy(look).add(off);
  camera.lookAt(look);
  camLook.copy(look);
}

function updateCamera(dt, cinematic = false) {
  if (cinematic) {
    const t = S.time * 0.06;
    camera.position.set(Math.sin(t) * 54, 25, Math.cos(t) * 54 - 12);
    camera.lookAt(0, 3, -4);
    return;
  }
  const look = S.sailing
    ? new THREE.Vector3(world.boat.position.x, world.boat.position.y + 1.5, world.boat.position.z)
    : player.pos.clone().setY(player.pos.y + 1.15);
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch),
  ).multiplyScalar(camDist);
  camDesired.copy(look).add(off);
  const gy = world.heightAt(camDesired.x, camDesired.z);
  camDesired.y = Math.max(camDesired.y, gy + 0.8);
  const k = 1 - Math.exp(-(S.sailing ? 4 : 8) * dt);
  camera.position.lerp(camDesired, k);
  camLook.lerp(look, 1 - Math.exp(-10 * dt));
  camera.lookAt(camLook);

  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt * 1.6);
    camera.position.x += (Math.random() - 0.5) * S.shake;
    camera.position.y += (Math.random() - 0.5) * S.shake;
  }
}

/* ---------------- 主循环 ---------------- */
let last = performance.now();

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0.0001, raw));

  if (!S.started) {
    S.time += dt;
    world.update(dt, {
      dayTime: 0.36, weather: { type: 'sunny', label: '晴朗' },
      tide: 0.12, playerPos: new THREE.Vector3(0, 0, 0), cameraPos: camera.position,
    });
    updateCamera(dt, true);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  if (!S.paused) {
    S.time += dt;
    S.dayTime += dt / 600;
    if (S.dayTime >= 1) { S.dayTime -= 1; S.day += 1; }
    const tidePhase = S.time * TAU / 240;
    S.tide = Math.sin(tidePhase) * 0.85 + 0.02;
    S.tideRising = Math.cos(tidePhase) > 0;

    S.weather.timer -= dt;
    if (S.weather.timer <= 0) rollWeather();

    // 玩家移动
    const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const r = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const moveX = f.x * iz + r.x * ix;
    const moveZ = f.z * iz + r.z * ix;
    const uiOpen = ui.craftOpen || ui.buildOpen;
    const input = {
      x: moveX, z: moveZ,
      sprint: keys.ShiftLeft || keys.ShiftRight,
      jump: keys.Space,
      frozen: uiOpen,
    };

    if (S.sailing) {
      updateSailing(dt);
      player.pos.copy(world.boat.position);
      camYaw = angleLerp(camYaw, S.boatHeading + Math.PI, 1 - Math.exp(-2.6 * dt));
    } else {
      player.update(dt, input, world, world.waterLevel);
      if (S.dead) player.root.rotation.z = 1.2;
    }

    // 采集持续
    updateGathering(dt);
    updateFishing(dt);
    updateGhost(dt);

    // 生物
    const crabCtx = { player, world, camera, onHitPlayer: (dmg) => playerHurt(dmg) };
    world.crabs.forEach((crab) => crab.update(dt, crabCtx));
    world.nodes.forEach((n) => n.update(dt));

    // 营火动画
    S.built.forEach((b) => {
      if (b.type !== 'campfire' || !b.object) return;
      const fl = b.object.userData.flame;
      if (fl) {
        const s = 1 + Math.sin(S.time * 9 + b.x) * 0.12;
        fl.scale.set(s, 1 + Math.sin(S.time * 12 + b.z) * 0.18, s);
        b.object.userData.light.intensity = 2.1 + Math.sin(S.time * 7 + b.x * 3) * 0.6;
      }
    });

    // 提示与互动目标
    const t = nearestTarget();
    if (S.sailing) {
      const isl = world.islandOf(world.boat.position.x, world.boat.position.z);
      const canLand = isl.dist < isl.island.radius + 6;
      ui.prompt(canLand ? `靠岸登陆 · ${isl.island.name}` : null);
    } else if (S.build) {
      ui.prompt('左键放置 · R 旋转 · Esc 取消');
    } else {
      ui.prompt(promptForTarget(t));
    }

    if (S.fishing > 0 && Math.hypot(moveX, moveZ) > 0.1) {
      S.fishing = 0;
      player.setTool(S.tools.sword ? 'sword' : null);
    }

    // 饥饿/死亡检查
    if (!S.dead && player.health <= 0) die();

    // 任务
    updateQuest();
    ui.setVitals(player.health, player.stamina, player.hunger);
    S.uiTimer += dt;
    if (S.uiTimer > 0.15) { S.uiTimer = 0; refreshUI(); }
    ui.setUnderwater(player.swimming && !S.sailing);

    S.saveTimer += dt;
    if (S.saveTimer > 20) { S.saveTimer = 0; writeSave(); }
  } else {
    // 暂停（死亡/胜利）时仍让水面和光线呼吸
    S.time += dt * 0.4;
  }

  const env = {
    dayTime: S.dayTime,
    weather: S.weather,
    tide: S.tide,
    playerPos: S.sailing ? world.boat.position : player.pos,
    cameraPos: camera.position,
  };
  world.update(dt, env);
  fx.update(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------- 出航 ---------------- */
function updateSailing(dt) {
  const targetSpeed = keys.KeyW ? 13 : keys.KeyS ? -4.5 : 0;
  S.boatVel = damp(S.boatVel, targetSpeed, 2.2, dt);
  const turn = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (Math.abs(S.boatVel) > 0.4) {
    S.boatHeading += turn * 1.25 * dt * (S.boatVel >= 0 ? 1 : -1);
  }
  const nx = world.boat.position.x + Math.sin(S.boatHeading) * S.boatVel * dt;
  const nz = world.boat.position.z + Math.cos(S.boatHeading) * S.boatVel * dt;
  const h = world.heightAt(nx, nz);
  if (h < world.waterLevel + 0.5) {
    world.boat.position.x = nx;
    world.boat.position.z = nz;
  } else {
    S.boatVel *= 0.3;
  }
  world.boat.position.y = world.waterLevel + 0.18 + Math.sin(S.time * 1.4) * 0.08;
  world.boat.rotation.y = S.boatHeading;
  world.boat.rotation.z = Math.sin(S.time * 1.1) * 0.035;
  world.boat.rotation.x = Math.sin(S.time * 0.9) * 0.02;
  world.boat.userData.lampLight.intensity = world.nightAmount > 0.4 ? 1.3 : 0.1;
}

function updateGathering(dt) {
  if (S.paused || S.sailing) { S.gather.node = null; return; }
  const t = nearestTarget();
  if (keys.KeyE && t && t.kind === 'node' && !ui.craftOpen && !ui.buildOpen) {
    beginGather(t.node);
  }
  if (!keys.KeyE) {
    S.gather.node = null;
    return;
  }
  if (!S.gather.node) return;
  if (!S.gather.node.alive) { S.gather.node = null; return; }
  S.gather.t -= dt;
  if (S.gather.t <= 0) applyGatherHit(S.gather.node);
}

function updateFishing(dt) {
  if (S.fishing <= 0) return;
  S.fishing -= dt;
  if (S.fishing <= 0) finishFishing();
}

/* ---------------- 启动 ---------------- */
const auto = sessionStorage.getItem('tidalAutoStart');
if (auto) {
  sessionStorage.removeItem('tidalAutoStart');
  startGame(null);
} else {
  const sv = readSave();
  ui.showStart(!!sv);
  // 让开场背景先跑起来
  world.update(0.016, {
    dayTime: 0.36, weather: { type: 'sunny', label: '晴朗' },
    tide: 0.12, playerPos: new THREE.Vector3(0, 0, 0), cameraPos: camera.position,
  });
}

refreshUI();
requestAnimationFrame(frame);
