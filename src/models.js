import * as THREE from '../vendor/three.module.js';

const cache = new Map();
export function M(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: 0.88, metalness: 0.02, ...opts,
    }));
  }
  return cache.get(key);
}

const SPHERE = new THREE.SphereGeometry(1, 12, 9);
const SPHERE_LO = new THREE.SphereGeometry(1, 8, 6);

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function finish(group, cast = true) {
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = false; }
  });
  return group;
}

function newGroup() { return new THREE.Group(); }

/* ---------------- 植被 ---------------- */

let _leafMat = null;
let _frondGeo = null;
let _trunkMat = null;

function palmLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 220;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 220);
  const cols = ['#4d8f3b', '#63a84a', '#7cbf5a', '#569a41'];
  const cy = 110;
  for (let i = 0; i < 32; i++) {
    const t = 0.05 + (i / 32) * 0.93;
    const x = 8 + t * 492;
    const len = (84 + Math.sin(i * 2.1) * 9) * (1 - 0.62 * t);
    [-1, 1].forEach((dir, di) => {
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(dir * -(0.76 + Math.sin(i * 0.7) * 0.13));
      const grad = ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, cols[(i + di) % cols.length]);
      grad.addColorStop(0.55, cols[(i + di + 1) % cols.length]);
      grad.addColorStop(1, cols[(i + di + 2) % cols.length]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-2, -3.4);
      ctx.quadraticCurveTo(len * 0.46, -7.5, len, 0);
      ctx.quadraticCurveTo(len * 0.46, 5.5, -2, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(36,74,28,.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.55, -1, len * 0.94, 0);
      ctx.stroke();
      ctx.restore();
    });
  }
  ctx.strokeStyle = '#5d8f3e';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(6, cy); ctx.quadraticCurveTo(250, cy - 3, 504, cy + 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(226,246,196,.5)';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(14, cy - 3); ctx.quadraticCurveTo(250, cy - 6, 494, cy - 2); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function palmLeafMaterial() {
  if (!_leafMat) {
    _leafMat = new THREE.MeshStandardMaterial({
      map: palmLeafTexture(), alphaTest: 0.4, side: THREE.DoubleSide,
      roughness: 0.88, metalness: 0, color: '#ffffff',
    });
  }
  return _leafMat;
}

function palmTrunkTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9b6e46';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 132; y += 13) {
    ctx.strokeStyle = 'rgba(86,54,29,.78)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(32, y + 4, 64, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(218,178,128,.32)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y + 3.2);
    ctx.quadraticCurveTo(32, y + 7, 64, y + 3.2);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(72,46,25,${0.05 + Math.random() * 0.14})`;
    ctx.fillRect(Math.random() * 64, Math.random() * 128, 1.2, 3 + Math.random() * 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function palmTrunkMaterial() {
  if (!_trunkMat) {
    _trunkMat = new THREE.MeshStandardMaterial({ map: palmTrunkTexture(), roughness: 0.94, metalness: 0 });
  }
  return _trunkMat;
}

function frondGeometry() {
  if (!_frondGeo) {
    _frondGeo = new THREE.PlaneGeometry(2.15, 0.92, 10, 1);
    _frondGeo.rotateX(-Math.PI / 2);
    const pos = _frondGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const t = clamp01((x + 1.075) / 2.15);
      pos.setY(i, pos.getY(i) - 0.34 * t * t);
    }
    _frondGeo.translate(1.06, 0.04, 0);
    _frondGeo.computeVertexNormals();
  }
  return _frondGeo;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createPalm(rng = Math.random) {
  const g = newGroup();
  const h = 3.4 + rng() * 2.0;
  const lean = (rng() - 0.5) * 0.55;

  const trunkMat = palmTrunkMaterial();
  const segs = 3;
  let px = 0, pz = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const rBot = 0.34 - t * 0.1;
    const rTop = 0.31 - t * 0.11;
    const seg = mesh(new THREE.CylinderGeometry(rTop, rBot, h / segs + 0.06, 9, 1, true), trunkMat);
    seg.position.set(px, (i + 0.5) * (h / segs), pz);
    seg.rotation.z = -lean * 0.3;
    g.add(seg);
    px += Math.sin(-lean * 0.3) * (h / segs);
  }
  const root = mesh(SPHERE_LO, M('#8d6440'), 0, 0.1, 0);
  root.scale.set(0.52, 0.2, 0.52);
  g.add(root);

  const crown = newGroup();
  crown.position.set(px, h + 0.02, pz);
  const leafMat = palmLeafMaterial();
  const n = 9 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const pivot = newGroup();
    pivot.rotation.y = (i / n) * Math.PI * 2 + rng() * 0.22;
    const frond = new THREE.Mesh(frondGeometry(), leafMat);
    frond.rotation.z = -0.16 - rng() * 0.26;
    frond.scale.set(0.85 + rng() * 0.3, 1, 0.8 + rng() * 0.3);
    frond.castShadow = true;
    pivot.add(frond);
    crown.add(pivot);
  }
  // 顶端新叶
  for (let i = 0; i < 3; i++) {
    const young = new THREE.Mesh(frondGeometry(), leafMat);
    young.scale.setScalar(0.42 + rng() * 0.16);
    young.rotation.y = i * 2.1;
    young.rotation.z = 0.55 + rng() * 0.2;
    young.position.y = 0.12;
    young.castShadow = true;
    crown.add(young);
  }

  const coco = M('#7a5433');
  for (let i = 0; i < 3; i++) {
    const c = mesh(SPHERE_LO, coco, Math.cos(i * 2.1) * 0.2, -0.16, Math.sin(i * 2.1) * 0.2);
    c.scale.setScalar(0.135);
    crown.add(c);
  }
  g.add(crown);
  g.userData.crown = crown;
  return finish(g);
}

export function createRock(rng = Math.random, tint = '#a8b0a7') {
  const g = newGroup();
  const makeChunk = (scale, offset, rotation, color) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const f = 0.78 + rng() * 0.4;
      pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.92, pos.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const m = mesh(geo, M(color, { flatShading: true }));
    m.scale.copy(scale);
    m.position.copy(offset);
    m.rotation.set(rotation.x, rotation.y, rotation.z);
    g.add(m);
    return m;
  };

  const sc = 0.72 + rng() * 0.85;
  const main = makeChunk(
    new THREE.Vector3(sc * (0.95 + rng() * 0.35), sc * (0.6 + rng() * 0.28), sc),
    new THREE.Vector3(0, sc * 0.42, 0),
    { x: rng() * 0.3, y: rng() * 6.28, z: rng() * 0.3 },
    tint,
  );

  // 叠在一起的第二块岩层
  if (rng() > 0.25) {
    makeChunk(
      new THREE.Vector3(sc * (0.6 + rng() * 0.4), sc * (0.4 + rng() * 0.3), sc * (0.55 + rng() * 0.4)),
      new THREE.Vector3(sc * (0.45 + rng() * 0.4) * (rng() > 0.5 ? 1 : -1), sc * (0.3 + rng() * 0.4), sc * (rng() - 0.5) * 0.5),
      { x: rng() * 0.8, y: rng() * 6.28, z: rng() * 0.8 },
      rng() > 0.5 ? '#b7bdb2' : '#8f988f',
    );
  }

  // 底部小石子
  for (let i = 0; i < 2; i++) {
    const pebble = mesh(SPHERE_LO, M('#b3b8ac', { flatShading: true }),
      (rng() - 0.5) * sc * 2.4, 0.06, (rng() - 0.5) * sc * 2.2);
    pebble.scale.set(sc * 0.14, sc * 0.08, sc * 0.13);
    g.add(pebble);
  }

  if (rng() > 0.45) {
    const moss = mesh(SPHERE_LO, M('#6f9c52'), -0.12, main.position.y + sc * 0.5, -0.06);
    moss.scale.set(sc * 0.4, sc * 0.08, sc * 0.34);
    moss.rotation.z = rng() * 0.3;
    g.add(moss);
  }
  return finish(g);
}

export function createBush(rng = Math.random) {
  const g = newGroup();
  const cols = ['#79b85c', '#8ecb6b', '#6aa650'];
  for (let i = 0; i < 4; i++) {
    const b = mesh(SPHERE_LO, M(cols[i % 3]));
    const s = 0.3 + rng() * 0.28;
    b.position.set((rng() - 0.5) * 0.7, s * 0.75 + rng() * 0.2, (rng() - 0.5) * 0.7);
    b.scale.set(s, s * 0.9, s);
    g.add(b);
  }
  if (rng() > 0.6) {
    const f = mesh(SPHERE_LO, M('#f0a2a2'), 0.15, 0.75, 0.1);
    f.scale.setScalar(0.07);
    g.add(f);
  }
  return finish(g);
}

export function createDriftwood(rng = Math.random) {
  const g = newGroup();
  for (let i = 0; i < 2; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6 + rng() * 0.6, 7), M('#b28a5d'));
    log.rotation.z = Math.PI / 2 - 0.12;
    log.rotation.y = rng() * 3;
    log.position.set((rng() - 0.5) * 0.5, 0.2 + i * 0.16, (rng() - 0.5) * 0.4);
    g.add(log);
  }
  return finish(g);
}

export function createShellPickup(color = '#f2b9a4') {
  const g = newGroup();
  const s = mesh(SPHERE_LO, M(color, { roughness: 0.4 }), 0, 0.14, 0);
  s.scale.set(0.24, 0.09, 0.24);
  g.add(s);
  const rib = mesh(new THREE.TorusGeometry(0.14, 0.035, 5, 10, Math.PI * 1.1), M('#e79e89'), 0, 0.2, 0);
  rib.rotation.x = -Math.PI / 2;
  g.add(rib);
  return finish(g);
}

export function createCoconutPickup() {
  const g = newGroup();
  const c = mesh(SPHERE, M('#8a6040'), 0, 0.2, 0);
  c.scale.setScalar(0.24);
  g.add(c);
  const fiber = mesh(SPHERE_LO, M('#b18a63'), 0, 0.34, 0);
  fiber.scale.set(0.2, 0.1, 0.2);
  g.add(fiber);
  return finish(g);
}

/* ---------------- 营地建筑 ---------------- */

export function createCampfire() {
  const g = newGroup();
  const stone = M('#a8b0a7', { flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = mesh(SPHERE_LO, stone, Math.cos(a) * 0.72, 0.13, Math.sin(a) * 0.72);
    s.scale.set(0.22, 0.16, 0.2);
    g.add(s);
  }
  const logMat = M('#8a5c37');
  for (let i = 0; i < 3; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 6), logMat);
    log.rotation.z = Math.PI / 2.5;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.24;
    g.add(log);
  }
  const flameMat = new THREE.MeshStandardMaterial({
    color: '#ff9a4a', emissive: '#ff6a1f', emissiveIntensity: 1.4, roughness: 0.6, transparent: true, opacity: 0.95,
  });
  const flame = mesh(new THREE.ConeGeometry(0.3, 0.85, 6), flameMat, 0, 0.62, 0);
  const flame2 = mesh(new THREE.ConeGeometry(0.18, 0.55, 6), new THREE.MeshStandardMaterial({
    color: '#ffe58a', emissive: '#ffd166', emissiveIntensity: 1.5, roughness: 0.5,
  }), 0, 0.6, 0);
  g.add(flame, flame2);

  const light = new THREE.PointLight('#ffb15c', 2.2, 12, 2);
  light.position.set(0, 1.2, 0);
  g.add(light);
  g.userData.flame = flame;
  g.userData.flame2 = flame2;
  g.userData.light = light;
  return finish(g);
}

export function createWorkbench() {
  const g = newGroup();
  const wood = M('#b1834f');
  const woodDark = M('#8a6038');
  const top = mesh(new THREE.BoxGeometry(2.1, 0.16, 1.0), wood, 0, 0.86, 0);
  g.add(top);
  [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].forEach(([x, z]) => {
    const leg = mesh(new THREE.BoxGeometry(0.16, 0.86, 0.16), woodDark, x, 0.43, z);
    g.add(leg);
  });
  const vice = mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), M('#6f7d78'), -0.6, 1.06, 0);
  g.add(vice);
  const hammerHead = mesh(new THREE.BoxGeometry(0.3, 0.14, 0.14), M('#b7c0b6'), 0.55, 1.0, 0.1);
  hammerHead.rotation.y = 0.3;
  g.add(hammerHead);
  const hammerShaft = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.5, 5), M('#a97a4f'), 0.55, 1.02, 0.1);
  hammerShaft.rotation.z = Math.PI / 2.4;
  g.add(hammerShaft);
  const plank = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), M('#c9a06b'), 0.1, 0.94, 0.3);
  plank.rotation.y = 0.2;
  g.add(plank);
  return finish(g);
}

export function createChest(gold = false) {
  const g = newGroup();
  const wood = M(gold ? '#8f5a33' : '#a97a4f');
  const band = M(gold ? '#e0a94a' : '#8a6038');
  const body = mesh(new THREE.BoxGeometry(1.1, 0.62, 0.7), wood, 0, 0.36, 0);
  g.add(body);
  const lid = mesh(new THREE.BoxGeometry(1.14, 0.26, 0.74), wood, 0, 0.78, 0);
  g.add(lid);
  [-0.36, 0.36].forEach((x) => {
    const b = mesh(new THREE.BoxGeometry(0.1, 0.66, 0.76), band, x, 0.38, 0);
    g.add(b);
  });
  const lock = mesh(new THREE.BoxGeometry(0.18, 0.22, 0.1), M('#e0a94a'), 0, 0.46, 0.37);
  g.add(lock);
  if (gold) {
    const glow = new THREE.PointLight('#ffce7a', 1.2, 7, 2);
    glow.position.set(0, 1.1, 0);
    g.add(glow);
  }
  g.userData.lid = lid;
  return finish(g);
}

export function createBed() {
  const g = newGroup();
  const mat = mesh(new THREE.BoxGeometry(1.9, 0.22, 0.8), M('#e7d6ab'), 0, 0.14, 0);
  g.add(mat);
  const pillow = mesh(new THREE.BoxGeometry(0.5, 0.2, 0.62), M('#f6eccf'), -0.7, 0.28, 0);
  g.add(pillow);
  const stripe = mesh(new THREE.BoxGeometry(1.0, 0.03, 0.83), M('#d97a5e'), 0.35, 0.26, 0);
  g.add(stripe);
  const roll = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 8), M('#e2c995'), 1.05, 0.16, 0);
  roll.rotation.z = Math.PI / 2;
  g.add(roll);
  return finish(g);
}

/* ---------------- 小船 ---------------- */

function sailTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(122,89,52,.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(i * 25, 0); ctx.lineTo(i * 25, 128); ctx.stroke();
  }
  const patches = [
    ['#d98a5e', 20, 34, 30, 26],
    ['#7ea79a', 68, 74, 36, 30],
    ['#c9a05f', 26, 92, 28, 22],
  ];
  patches.forEach(([col, x, y, w, h]) => {
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(60,45,30,.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.setLineDash([]);
  });
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(0, 0, 128, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBoat({ wreck = false } = {}) {
  const g = newGroup();
  const hullMat = M(wreck ? '#7c6448' : '#8a5b3b');
  const trimMat = M('#3f8f88');

  const shape = new THREE.Shape();
  shape.moveTo(0, 2.9);
  shape.bezierCurveTo(1.05, 1.9, 1.02, -1.3, 0.78, -2.35);
  shape.quadraticCurveTo(0, -2.65, -0.78, -2.35);
  shape.bezierCurveTo(-1.02, -1.3, -1.05, 1.9, 0, 2.9);

  const hullGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.95, bevelEnabled: true, bevelSize: 0.14, bevelThickness: 0.14, bevelSegments: 2, curveSegments: 10,
  });
  const hull = mesh(hullGeo, hullMat, 0, 0.62, 0);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);

  const topRim = mesh(new THREE.TorusGeometry(1.0, 0.1, 5, 24), trimMat, 0, 0.62, 0);
  topRim.rotation.x = Math.PI / 2;
  topRim.scale.set(0.85, 1.0, 1);
  g.add(topRim);

  const deck = mesh(new THREE.BoxGeometry(1.5, 0.1, 4.5), M('#a7794c'), 0, 0.6, 0);
  deck.scale.set(1, 1, 1);
  g.add(deck);

  const mast = mesh(new THREE.CylinderGeometry(0.08, 0.1, wreck ? 2.4 : 3.6, 7), M('#8a6038'), 0, wreck ? 1.8 : 2.4, -0.35);
  if (wreck) mast.rotation.z = 0.35;
  g.add(mast);

  const sail = mesh(new THREE.PlaneGeometry(2.2, 1.9), new THREE.MeshStandardMaterial({
    map: sailTexture(), roughness: 0.9, side: THREE.DoubleSide,
  }), 0, wreck ? 2.1 : 2.9, -0.28);
  sail.visible = !wreck;
  g.add(sail);

  const boom = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5), M('#8a6038'), 0, 1.85, -0.28);
  boom.rotation.z = Math.PI / 2;
  boom.visible = !wreck;
  g.add(boom);

  // 船首像 / 船头装饰
  const figure = mesh(SPHERE_LO, M('#e0a94a'), 0, 0.85, 2.55);
  figure.scale.set(0.2, 0.28, 0.2);
  g.add(figure);

  // 船尾货箱
  const crate = mesh(new THREE.BoxGeometry(0.55, 0.42, 0.55), M('#b1834f'), 0.25, 0.82, -1.55);
  g.add(crate);

  // 绳圈
  const rope = mesh(new THREE.TorusGeometry(0.24, 0.07, 5, 11), M('#cbb78c'), -0.42, 0.7, -1.2);
  rope.rotation.x = Math.PI / 2;
  g.add(rope);

  // 小旗
  const flagMat = new THREE.MeshStandardMaterial({ color: '#d95e48', roughness: 0.85, side: THREE.DoubleSide });
  const flag = mesh(new THREE.PlaneGeometry(0.55, 0.32), flagMat, 0.26, wreck ? 2.8 : 3.95, -0.35);
  flag.visible = !wreck;
  g.add(flag);

  // 船灯（修好后才会亮）
  const lamp = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.26, 8), M('#5f7f7c'), -0.5, 0.95, 2.25);
  g.add(lamp);
  const lampLight = new THREE.PointLight('#ffcf7a', 0, 0);
  lampLight.position.set(-0.5, 1.2, 2.25);
  g.add(lampLight);

  g.userData.sail = sail;
  g.userData.flag = flag;
  g.userData.lampLight = lampLight;
  return finish(g);
}

/* ---------------- 生物 ---------------- */

export function createCrab(scale = 1) {
  const g = newGroup();
  const shellMat = M('#d3695a', { roughness: 0.6 }).clone();
  const shellMat2 = M('#c25a4b', { roughness: 0.6 }).clone();
  const cream = M('#f0d9b4');

  const shell = mesh(SPHERE, shellMat, 0, 1.0, -0.1);
  shell.scale.set(0.82, 0.62, 0.78);
  g.add(shell);
  const shellTop = mesh(SPHERE_LO, shellMat2, 0, 1.28, -0.16);
  shellTop.scale.set(0.55, 0.28, 0.5);
  g.add(shellTop);
  for (let i = 0; i < 5; i++) {
    const spot = mesh(SPHERE_LO, M('#f0a08c'), Math.cos(i * 1.7) * 0.42, 1.28 + (i % 2) * 0.1, Math.sin(i * 1.7) * 0.35);
    spot.scale.setScalar(0.1);
    g.add(spot);
  }

  const body = mesh(SPHERE_LO, cream, 0, 0.55, 0.35);
  body.scale.set(0.6, 0.35, 0.48);
  g.add(body);

  // 眼睛
  const eyeStalkL = newGroup(); eyeStalkL.position.set(-0.22, 0.95, 0.5);
  const stalk = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 5), cream, 0, 0.14, 0);
  eyeStalkL.add(stalk);
  const eyeL = mesh(SPHERE_LO, M('#ffffff'), 0, 0.34, 0.02);
  eyeL.scale.set(0.11, 0.13, 0.11);
  const pupilL = mesh(SPHERE_LO, M('#243d3c'), 0, 0.36, 0.11);
  pupilL.scale.setScalar(0.05);
  eyeStalkL.add(eyeL, pupilL);
  g.add(eyeStalkL);

  const eyeStalkR = eyeStalkL.clone();
  eyeStalkR.position.x = 0.22;
  g.add(eyeStalkR);

  // 螯
  const makeClaw = (side) => {
    const grp = newGroup();
    grp.position.set(side * 0.62, 0.6, 0.35);
    const upper = mesh(SPHERE_LO, shellMat, side * 0.15, 0.12, 0.18);
    upper.scale.set(0.36, 0.26, 0.3);
    grp.add(upper);
    const lower = mesh(SPHERE_LO, shellMat2, side * 0.1, 0.05, 0.52);
    lower.scale.set(0.28, 0.22, 0.3);
    grp.add(lower);
    const pincer = mesh(new THREE.ConeGeometry(0.16, 0.36, 5), cream, side * 0.03, 0.12, 0.8);
    pincer.rotation.x = Math.PI / 2;
    pincer.rotation.z = side * 0.35;
    grp.add(pincer);
    grp.userData.side = side;
    return grp;
  };
  const clawL = makeClaw(-1);
  const clawR = makeClaw(1);
  g.add(clawL, clawR);

  // 腿
  const legMat = M('#e8c39c');
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const leg = mesh(new THREE.CapsuleGeometry(0.06, 0.45, 3, 5), legMat, side * 0.65, 0.32, -0.1 + k * 0.26);
    leg.rotation.z = side * 0.55;
    leg.rotation.x = -0.2;
    g.add(leg);
    legs.push(leg);
  }

  g.scale.setScalar(scale);
  g.userData = { clawL, clawR, shell, body, legs, eyeStalkL, eyeStalkR, mats: [shellMat, shellMat2] };
  return finish(g);
}

export function createGull() {
  const g = newGroup();
  const white = M('#f4f1e4');
  const body = mesh(SPHERE_LO, white, 0, 0, 0);
  body.scale.set(0.34, 0.25, 0.5);
  g.add(body);
  const wingGeo = new THREE.PlaneGeometry(1.2, 0.5);
  const wingMat = new THREE.MeshStandardMaterial({ color: '#f8f5e8', roughness: 0.9, side: THREE.DoubleSide });
  const wl = mesh(wingGeo, wingMat, -0.62, 0.05, 0);
  const wr = mesh(wingGeo, wingMat, 0.62, 0.05, 0);
  g.add(wl, wr);
  const beak = mesh(new THREE.ConeGeometry(0.07, 0.22, 5), M('#e0a94a'), 0, 0, 0.5);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  const tail = mesh(new THREE.PlaneGeometry(0.34, 0.18), wingMat, 0, 0.02, -0.5);
  g.add(tail);
  g.userData = { wl, wr };
  return finish(g, false);
}

/* ---------------- 场景装饰 ---------------- */

export function createMarker(color = '#2f8f8a') {
  const g = newGroup();
  const ring = mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
  }), 0, 0.06, 0);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

export function createLighthouse() {
  const g = newGroup();
  const white = M('#f2ecdc');
  const red = M('#d95e48');
  const tower = mesh(new THREE.CylinderGeometry(0.9, 1.25, 6.5, 12), white, 0, 3.25, 0);
  g.add(tower);
  const stripe = mesh(new THREE.CylinderGeometry(1.05, 1.12, 0.8, 12), red, 0, 4.0, 0);
  g.add(stripe);
  const top = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.25, 12), M('#6d817c'), 0, 6.6, 0);
  g.add(top);
  const lamp = mesh(new THREE.CylinderGeometry(0.75, 0.8, 1.0, 8), M('#ffe9ad', { emissive: '#ffd479', emissiveIntensity: 0.7 }), 0, 7.2, 0);
  g.add(lamp);
  const cap = mesh(new THREE.ConeGeometry(0.95, 0.7, 10), red, 0, 7.95, 0);
  g.add(cap);
  const base = mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.6, 8, 1, false), M('#8e988c'), 0, 0.3, 0);
  g.add(base);
  const light = new THREE.PointLight('#ffe3a3', 1.5, 22, 2);
  light.position.set(0, 7.2, 0);
  g.add(light);
  g.userData.lamp = lamp;
  return finish(g);
}

export function createCaveMouth() {
  const g = newGroup();
  const rockMat = M('#7f887e', { flatShading: true });
  const dome = mesh(new THREE.SphereGeometry(2.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), rockMat);
  dome.scale.set(1.4, 1.5, 1.1);
  dome.position.y = 0;
  g.add(dome);
  const dark = mesh(new THREE.CircleGeometry(1.25, 16), new THREE.MeshBasicMaterial({ color: '#1b2a28' }), 0, 1.2, 1.55);
  g.add(dark);
  g.userData.dark = dark;
  return finish(g);
}
