import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, noise2, fbm, mulberry32, TAU } from './util.js';
import {
  M, mesh, finish, createPalm, createRock, createBush, createBoat, createLighthouse,
  createCaveMouth, createChest, createGull, createMarker,
} from './models.js';
import { Gatherable, HermitCrab } from './entities.js';

export const ISLAND_DEFS = [
  {
    id: 'A', name: '漂瓶湾', cx: 0, cz: 0, radius: 34, peak: 6.2, seed: 11,
    sand: '#f1ddb0', wet: '#dcc08b', grass: '#80c163', grass2: '#69a950', rock: '#9aa394',
  },
  {
    id: 'B', name: '椰铃林', cx: 0, cz: -120, radius: 23, peak: 7.4, seed: 73,
    sand: '#eed7a6', wet: '#d9bd8c', grass: '#86c46d', grass2: '#6cae55', rock: '#8d9a8c',
  },
];

const smoothstep = (t) => t * t * (3 - 2 * t);

export class World {
  constructor(scene, time = 0) {
    this.scene = scene;
    this.time = time;
    this.waterLevel = 0;
    this.islands = ISLAND_DEFS.map((d) => ({ ...d }));
    this.nodes = [];
    this.crabs = [];
    this.palms = [];
    this.clouds = [];
    this.crates = [];
    this.gulls = [];
    this.camp = { x: -16, z: 7, r: 8.5, h: 1.3 };
    this.treasureSpot = { x: 2, z: -121, r: 3.2, h: 7.0 };
    this.campPos = new THREE.Vector3(this.camp.x, this.camp.h, this.camp.z);
    this.boatPos = new THREE.Vector3(-24.5, 0.1, 11);
    this.boatStage = 0;
    this.boatReady = false;
    this.treasureFound = false;
    this.rng = mulberry32(20261118);
    this.scene.fog = new THREE.Fog('#c7ebe1', 60, 250);

    this.buildLights();
    this.buildSky();
    this.buildTerrain();
    this.buildGroundCover();
    this.buildOcean();
    this.buildClouds();
    this.buildRain();
    this.buildNight();
    this.buildScenery();
    this.buildBoat();
    this.populate();
    this.setTimeOfDay(0.36);
  }

  /* ------------- 地形高度 ------------- */
  heightAt(x, z) {
    let h = -3.2;
    for (const isl of this.islands) {
      const dx = x - isl.cx, dz = z - isl.cz;
      const d = Math.hypot(dx, dz);
      if (d > isl.radius + 14) continue;
      const t = Math.max(0, 1 - d / isl.radius);
      if (t <= 0) continue;
      let hh = isl.peak * Math.pow(t, 1.62);
      const n = (fbm((x + isl.seed * 3.1) * 0.085, (z + isl.seed * 1.7) * 0.085, 4) - 0.5) * 2;
      hh += n * 1.45 * Math.min(1, t * 2.5);
      hh += (noise2(x * 0.33, z * 0.33) - 0.5) * 0.4 * Math.min(1, t * 3);
      hh -= 0.58;
      h = Math.max(h, hh);
    }
    // 营地平台
    const dc = Math.hypot(x - this.camp.x, z - this.camp.z);
    if (dc < this.camp.r) {
      const k = smoothstep(dc / this.camp.r);
      h = lerp(this.camp.h, h, k);
    }
    // 山顶平台
    const dt = Math.hypot(x - this.treasureSpot.x, z - this.treasureSpot.z);
    if (dt < this.treasureSpot.r) {
      const k = smoothstep(dt / this.treasureSpot.r);
      h = lerp(this.treasureSpot.h, h, k);
    }
    return h;
  }

  slopeAt(x, z) {
    const e = 0.6;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  }

  islandOf(x, z) {
    let best = null, bd = 1e9;
    this.islands.forEach((isl) => {
      const d = Math.hypot(x - isl.cx, z - isl.cz);
      if (d < bd) { bd = d; best = isl; }
    });
    return { island: best, dist: bd };
  }

  /* ------------- 灯光与天空 ------------- */
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#bfe8ea', '#d8c79a', 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff3d8', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 0.5; c.far = 130;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.7, 0.4);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(320, 24, 16);
    this.skyUniforms = {
      uTop: { value: new THREE.Color('#57b8d4') },
      uBottom: { value: new THREE.Color('#c7ebe1') },
      uSunColor: { value: new THREE.Color('#ffe9b0') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.2) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSunColor; uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uBottom, uTop, smoothstep(-0.12, 0.45, h));
          float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 220.0) * 2.0;
          col += uSunColor * pow(sunAmt, 9.0) * 0.28;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  /* ------------- 岛与海 ------------- */
  buildTerrain() {
    const group = new THREE.Group();
    this.scene.add(group);
    this.islands.forEach((isl) => {
      const size = isl.radius * 2.7;
      const seg = isl.id === 'A' ? 150 : 110;
      const geo = new THREE.PlaneGeometry(size, size, seg, seg);
      geo.rotateX(-Math.PI / 2);
      geo.translate(isl.cx, 0, isl.cz);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const cWet = new THREE.Color(isl.wet);
      const cSand = new THREE.Color(isl.sand);
      const cGrass = new THREE.Color(isl.grass);
      const cGrass2 = new THREE.Color(isl.grass2);
      const cRock = new THREE.Color(isl.rock);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = this.heightAt(x, z);
        pos.setY(i, h);
        const slope = this.slopeAt(x, z);
        const n = noise2(x * 0.4 + isl.seed, z * 0.4);
        const m = noise2(x * 0.12 + isl.seed * 2, z * 0.12);
        if (h < 0.55) tmp.copy(cWet).lerp(cSand, clamp((h + 0.2) / 0.75, 0, 1));
        else if (h < 1.6 + n * 0.3) tmp.copy(cSand);
        else if (h < 3.5) {
          tmp.copy(cGrass).lerp(cGrass2, clamp((h - 1.5) / 1.9, 0, 1));
          // 草地里的深浅斑块
          if (m < 0.34) tmp.lerp(new THREE.Color('#5d9647'), 0.35);
          if (m > 0.72) tmp.lerp(new THREE.Color('#94d078'), 0.28);
        } else tmp.copy(cGrass2).lerp(cRock, clamp((h - 3.4) / 2.4, 0, 1));
        if (slope > 0.62) tmp.lerp(cRock, clamp((slope - 0.55) * 1.4, 0, 0.8));
        const shade = 0.93 + n * 0.12;
        colors[i * 3] = tmp.r * shade;
        colors[i * 3 + 1] = tmp.g * shade;
        colors[i * 3 + 2] = tmp.b * shade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
    });
    this.terrainGroup = group;
  }

  /* ------------- 地表植被与碎石 ------------- */
  surfacePoint(isl, minD, maxD) {
    const a = Math.random() * TAU;
    const d = minD + Math.random() * (maxD - minD);
    const x = isl.cx + Math.cos(a) * d;
    const z = isl.cz + Math.sin(a) * d;
    return { x, z, h: this.heightAt(x, z) };
  }

  buildGroundCover() {
    const dummy = new THREE.Object3D();

    // —— 草簇 ——
    const bladeVerts = [];
    const bladeIdx = [];
    let vi = 0;
    const blades = 5;
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * TAU + 0.4;
      const hh = 0.32 + Math.random() * 0.34;
      const w = 0.032 + Math.random() * 0.018;
      const ox = Math.cos(a), oz = Math.sin(a);
      const nx = -Math.sin(a), nz = Math.cos(a);
      const bend = 0.6;
      const bx = ox * 0.02, bz = oz * 0.02;
      const mx = ox * 0.1, mz = oz * 0.1;
      const tx = ox * 0.24, tz = oz * 0.24;
      const midY = hh * bend;
      const verts = [
        [bx + nx * w, 0, bz + nz * w],
        [bx - nx * w, 0, bz - nz * w],
        [mx + nx * w * 0.7, midY, mz + nz * w * 0.7],
        [mx - nx * w * 0.7, midY, mz - nz * w * 0.7],
        [tx + nx * w * 0.18, hh, tz + nz * w * 0.18],
        [tx - nx * w * 0.18, hh, tz - nz * w * 0.18],
      ];
      verts.forEach((v) => bladeVerts.push(...v));
      bladeIdx.push(vi, vi + 1, vi + 3, vi, vi + 3, vi + 2, vi + 2, vi + 3, vi + 5, vi + 2, vi + 5, vi + 4);
      vi += 6;
    }
    const grassGeo = new THREE.BufferGeometry();
    grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(bladeVerts, 3));
    grassGeo.setIndex(bladeIdx);
    grassGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
    });
    const grassCount = 2600;
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    grass.castShadow = false;
    grass.receiveShadow = false;
    grass.frustumCulled = true;
    const greens = ['#78b45a', '#66a64b', '#86c466', '#5c9a43', '#93cf72'];
    const color = new THREE.Color();
    let gi = 0;
    for (const isl of this.islands) {
      const target = isl.id === 'A' ? 2000 : 600;
      let guard = 0;
      let placed = 0;
      while (placed < target && guard < target * 8 && gi < grassCount) {
        guard++;
        const p = this.surfacePoint(isl, isl.radius * 0.22, isl.radius * 0.92);
        if (p.h < 1.25 || p.h > 5.2) continue;
        if (this.slopeAt(p.x, p.z) > 0.55) continue;
        if (isl.id === 'A' && Math.hypot(p.x - this.camp.x, p.z - this.camp.z) < 8.5) continue;
        dummy.position.set(p.x, p.h - 0.02, p.z);
        dummy.rotation.set(0, Math.random() * TAU, 0);
        const s = 0.8 + Math.random() * 0.9;
        dummy.scale.set(s, s * (0.85 + Math.random() * 0.4), s);
        dummy.updateMatrix();
        grass.setMatrixAt(gi, dummy.matrix);
        color.set(greens[Math.floor(Math.random() * greens.length)]);
        color.offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.07);
        grass.setColorAt(gi, color);
        gi++;
        placed++;
      }
    }
    grass.count = gi;
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    this.scene.add(grass);

    // —— 沙滩碎石 ——
    const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
    const pebbleCount = 420;
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    pebbles.castShadow = false;
    pebbles.receiveShadow = true;
    const pebbleCols = ['#b9b3a4', '#cbbfa8', '#a7a79c', '#ded0b4', '#d8c7a6'];
    let pi = 0;
    for (const isl of this.islands) {
      let guard = 0;
      const target = isl.id === 'A' ? 320 : 100;
      let placed = 0;
      while (placed < target && guard < target * 8 && pi < pebbleCount) {
        guard++;
        const p = this.surfacePoint(isl, isl.radius * 0.55, isl.radius * 0.98);
        if (p.h < 0.18 || p.h > 1.45) continue;
        dummy.position.set(p.x, p.h + 0.01, p.z);
        dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        const s = 0.035 + Math.random() * 0.075;
        dummy.scale.set(s, s * 0.7, s);
        dummy.updateMatrix();
        pebbles.setMatrixAt(pi, dummy.matrix);
        color.set(pebbleCols[Math.floor(Math.random() * pebbleCols.length)]);
        pebbles.setColorAt(pi, color);
        pi++;
        placed++;
      }
    }
    pebbles.count = pi;
    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    this.scene.add(pebbles);

    // —— 野花 ——
    const flowerGeo = new THREE.IcosahedronGeometry(1, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const flowerCount = 240;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    flowers.castShadow = false;
    const flowerCols = ['#f4a7a0', '#f7d27a', '#fbf3df', '#e88f9b', '#f5b85c'];
    let fi = 0;
    for (const isl of this.islands) {
      let guard = 0;
      const target = isl.id === 'A' ? 190 : 50;
      let placed = 0;
      while (placed < target && guard < target * 8 && fi < flowerCount) {
        guard++;
        const p = this.surfacePoint(isl, isl.radius * 0.3, isl.radius * 0.85);
        if (p.h < 1.7 || p.h > 4.4) continue;
        if (isl.id === 'A' && Math.hypot(p.x - this.camp.x, p.z - this.camp.z) < 9) continue;
        dummy.position.set(p.x, p.h + 0.2 + Math.random() * 0.15, p.z);
        dummy.rotation.set(0, Math.random() * TAU, 0);
        const s = 0.035 + Math.random() * 0.035;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        flowers.setMatrixAt(fi, dummy.matrix);
        color.set(flowerCols[Math.floor(Math.random() * flowerCols.length)]);
        flowers.setColorAt(fi, color);
        fi++;
        placed++;
      }
    }
    flowers.count = fi;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    this.scene.add(flowers);
  }

  buildOcean() {
    const geo = new THREE.PlaneGeometry(560, 560, 160, 160);
    this.waterUniforms = {
      uTime: { value: 0 },
      uTide: { value: 0 },
      uShallow: { value: new THREE.Color('#6fcfc2') },
      uDeep: { value: new THREE.Color('#1e7d8d') },
      uFoam: { value: new THREE.Color('#f2fffb') },
      uIslands: { value: this.islands.map((i) => new THREE.Vector4(i.cx, i.cz, i.radius, i.seed)) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec2 vXZ;
        varying float vWave;
        void main() {
          vec3 p = position;
          float w = sin(p.x * 0.16 + uTime * 1.0) * 0.16
                  + sin(p.y * 0.21 - uTime * 0.8) * 0.12
                  + sin((p.x + p.y) * 0.09 + uTime * 0.55) * 0.18;
          p.z += w;
          vWave = w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vXZ = wp.xz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime; uniform float uTide;
        uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
        uniform vec4 uIslands[2];
        varying vec3 vWorld; varying vec2 vXZ; varying float vWave;
        void main() {
          float depth = clamp(vWorld.y - uTide, -0.6, 0.6);
          vec3 col = mix(uShallow, uDeep, clamp(depth * 1.2 + 0.35, 0.0, 1.0));
          float shore = 0.0;
          for (int i = 0; i < 2; i++) {
            float d = length(vXZ - uIslands[i].xy);
            float band = abs(d - (uIslands[i].z + 1.2));
            shore = max(shore, smoothstep(4.2, 0.0, band));
          }
          float ripple = smoothstep(0.55, 1.0, sin(uTime * 1.6 + length(vXZ) * 0.42));
          float foam = shore * (0.35 + ripple * 0.65);
          col = mix(col, uFoam, foam * 0.75);
          float alpha = 0.80 + foam * 0.15 + smoothstep(0.05, 0.5, abs(depth)) * 0.04;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.water.renderOrder = 3;
    this.scene.add(this.water);
  }

  buildClouds() {
    const cloudMat = M('#f7faf6', { roughness: 1 });
    const rng = mulberry32(99);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        const b = mesh(new THREE.SphereGeometry(1, 8, 6), cloudMat);
        b.position.set((rng() - 0.5) * 8, (rng() - 0.5) * 1.6, (rng() - 0.5) * 4);
        b.scale.set(2.4 + rng() * 2.2, 1.2 + rng() * 0.9, 2.0 + rng() * 1.6);
        g.add(b);
      }
      const a = rng() * TAU;
      const r = 60 + rng() * 110;
      g.position.set(Math.cos(a) * r, 34 + rng() * 22, Math.sin(a) * r * 0.7 - 40);
      g.userData.speed = 1.5 + rng() * 2.5;
      this.clouds.push(g);
      this.scene.add(g);
    }
  }

  buildRain() {
    const count = 1800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 76;
      pos[i * 3 + 1] = Math.random() * 44;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 76;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#dcefee', size: 0.12, transparent: true, opacity: 0.85, depthWrite: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildNight() {
    // 星空
    const count = 700;
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const e = Math.random() * 0.9 + 0.08;
      const r = 300;
      p[i * 3] = Math.cos(a) * Math.cos(e) * r;
      p[i * 3 + 1] = Math.sin(e) * r;
      p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#fff6da', size: 1.7, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // 萤火虫
    const fc = 70;
    const fp = new Float32Array(fc * 3);
    this.fireflyBase = [];
    for (let i = 0; i < fc; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * 13;
      const x = this.camp.x + Math.cos(a) * r;
      const z = this.camp.z + Math.sin(a) * r;
      const y = this.heightAt(x, z) + 0.4 + Math.random() * 1.5;
      fp[i * 3] = x; fp[i * 3 + 1] = y; fp[i * 3 + 2] = z;
      this.fireflyBase.push({ x, y, z, ph: Math.random() * TAU });
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      color: '#ffd97a', size: 0.22, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(fgeo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  /* ------------- 场景装饰 ------------- */
  buildScenery() {
    // 灯塔小岛
    const islet = new THREE.Group();
    const rng = mulberry32(5);
    for (let i = 0; i < 5; i++) {
      const r = createRock(rng);
      r.position.set((rng() - 0.5) * 9, -0.7, (rng() - 0.5) * 8);
      r.scale.multiplyScalar(1.6);
      islet.add(r);
    }
    const lh = createLighthouse();
    lh.position.y = 1.0;
    lh.scale.setScalar(0.9);
    islet.add(lh);
    islet.position.set(48, 0, -54);
    this.scene.add(islet);
    this.lighthouse = lh;

    // 洞穴
    const cave = createCaveMouth();
    cave.position.set(13, this.heightAt(13, -15) - 0.1, -15);
    cave.rotation.y = 0.4;
    this.scene.add(cave);

    // 营地标记
    this.campMarker = createMarker('#2f8f8a');
    this.campMarker.position.set(this.camp.x, this.camp.h + 0.04, this.camp.z);
    this.scene.add(this.campMarker);

    // 海面漂浮木箱
    const rng2 = mulberry32(31);
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const box = mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), M('#a97a4f'));
      box.position.y = 0.2;
      g.add(box);
      const band = mesh(new THREE.BoxGeometry(0.86, 0.1, 0.86), M('#7c5433'), 0, 0.3, 0);
      g.add(band);
      g.position.set((rng2() - 0.5) * 90, 0, (rng2() - 0.5) * 100 + 10);
      g.userData.ph = i * 1.7;
      this.crates.push(g);
      this.scene.add(g);
    }

    // 海鸥
    for (let i = 0; i < 3; i++) {
      const gull = createGull();
      gull.userData.ph = i * 2;
      this.gulls.push(gull);
      this.scene.add(gull);
    }
  }

  buildBoat() {
    this.boat = createBoat({ wreck: true });
    this.boat.position.copy(this.boatPos);
    this.boat.position.y = Math.max(this.heightAt(this.boatPos.x, this.boatPos.z), -0.2);
    this.boat.rotation.z = -0.16;
    this.boat.rotation.y = -0.4;
    this.scene.add(this.boat);
    this.boatBase = this.boat.position.clone();
  }

  /* ------------- 资源与生物 ------------- */
  placeValidPositions(count, minD, maxD, avoidCamp = true) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      const isl = ISLAND_DEFS[0];
      const a = Math.random() * TAU;
      const d = minD + Math.random() * (maxD - minD);
      const x = isl.cx + Math.cos(a) * d;
      const z = isl.cz + Math.sin(a) * d;
      const h = this.heightAt(x, z);
      if (h < 0.15 || h > 4.4) continue;
      if (avoidCamp && Math.hypot(x - this.camp.x, z - this.camp.z) < 10) continue;
      if (Math.hypot(x - this.boatPos.x, z - this.boatPos.z) < 5) continue;
      if (Math.hypot(x - this.camp.x, z - this.camp.z) < 1.5) continue;
      if (out.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.6)) continue;
      out.push([x, z, h]);
    }
    return out;
  }

  populate() {
    const add = (kind, x, z, h, opts = {}) => {
      const n = new Gatherable(this.scene, kind, x, z, h, opts);
      this.nodes.push(n);
      if (kind === 'tree') this.palms.push(n.object);
      return n;
    };

    // 岛 A 椰林
    this.placeValidPositions(26, 7, 24).forEach(([x, z, h]) => {
      add('tree', x, z, h);
    });
    // 石头
    this.placeValidPositions(15, 5, 27).forEach(([x, z, h]) => {
      add('rock', x, z, h, { tint: Math.random() > 0.5 ? '#a8b0a7' : '#b2b8a8' });
    });
    // 草簇
    this.placeValidPositions(20, 4, 25).forEach(([x, z, h]) => {
      add('bush', x, z, h);
    });
    // 漂流木
    this.placeValidPositions(9, 20, 29, false).forEach(([x, z, h]) => {
      add('driftwood', x, z, h);
    });
    // 椰子与贝壳
    this.placeValidPositions(12, 12, 28).forEach(([x, z, h]) => {
      add('coconut', x, z, h + 0.05);
    });
    this.placeValidPositions(10, 19, 30, false).forEach(([x, z, h]) => {
      add('shell', x, z, h + 0.02, { tint: Math.random() > 0.5 ? '#f2b9a4' : '#e9cbb2' });
    });

    // 岛 B
    const islB = ISLAND_DEFS[1];
    let guard = 0;
    const bCount = { tree: 12, rock: 7, bush: 9, coconut: 6, shell: 5 };
    Object.entries(bCount).forEach(([kind, num]) => {
      let placed = 0;
      guard = 0;
      while (placed < num && guard < 200) {
        guard++;
        const a = Math.random() * TAU;
        const d = 4 + Math.random() * 18;
        const x = islB.cx + Math.cos(a) * d;
        const z = islB.cz + Math.sin(a) * d;
        const h = this.heightAt(x, z);
        if (h < 0.15) continue;
        if (Math.hypot(x - this.treasureSpot.x, z - this.treasureSpot.z) < 4.5) continue;
        if (this.nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 2.4)) continue;
        add(kind, x, z, kind === 'coconut' || kind === 'shell' ? h + 0.05 : h, {});
        placed++;
      }
    });

    // 寄居蟹
    const spots = [
      [-10, 20], [-2, 22], [14, 18], [24, 6], [-24, 2],
      [4, -100], [-8, -104], [10, -106],
    ];
    spots.forEach(([x, z], i) => {
      const h = this.heightAt(x, z);
      if (h < 0) return;
      const crab = new HermitCrab(this.scene, x, z, h, { hp: i < 5 ? 46 : 60, scale: i === 4 ? 1.15 : 1 });
      this.crabs.push(crab);
    });

    // 宝箱
    this.treasure = createChest(true);
    this.treasure.position.set(this.treasureSpot.x, this.treasureSpot.h, this.treasureSpot.z);
    this.treasure.rotation.y = 0.4;
    this.scene.add(this.treasure);
  }

  /* ------------- 修船状态 ------------- */
  setBoatStage(stage) {
    this.boatStage = stage;
    this.boatReady = stage >= 2;
    this.boat.userData.sail.visible = stage >= 2;
    this.boat.userData.flag.visible = stage >= 2;
  }

  setSail(upright) {
    this.sailing = upright;
  }

  /* ------------- 每帧更新 ------------- */
  setTimeOfDay(dayTime, weatherType = 'sunny') {
    const a = (dayTime - 0.25) * TAU;
    const sunY = Math.sin(a);
    this.sunDir.set(Math.cos(a) * 0.92, sunY, 0.42).normalize();

    const dayCol = new THREE.Color('#57b8d4');
    const dayBot = new THREE.Color('#c7ebe1');
    const duskCol = new THREE.Color('#6d5f9e');
    const duskBot = new THREE.Color('#ffb277');
    const nightCol = new THREE.Color('#101c3c');
    const nightBot = new THREE.Color('#2b3d63');
    const stormCol = new THREE.Color('#45565b');
    const stormBot = new THREE.Color('#7e908d');

    const night = clamp(-sunY * 2.2, 0, 1);
    const dusk = clamp(1 - Math.abs(sunY) * 3.4, 0, 1);
    let top = dayCol.clone();
    let bottom = dayBot.clone();
    top.lerp(duskCol, dusk * 0.85);
    bottom.lerp(duskBot, dusk);
    top.lerp(nightCol, night);
    bottom.lerp(nightBot, night);

    let sunColor = new THREE.Color('#fff3d8');
    sunColor.lerp(new THREE.Color('#ffb36b'), dusk * 0.9);
    let sunInt = clamp(sunY, 0, 1) * 2.4 + 0.15;
    let hemiInt = 0.7 + clamp(sunY, 0, 1) * 0.45;

    if (weatherType === 'storm' || weatherType === 'rain') {
      const k = weatherType === 'storm' ? 0.72 : 0.45;
      top.lerp(stormCol, k);
      bottom.lerp(stormBot, k);
      sunInt *= weatherType === 'storm' ? 0.42 : 0.62;
      hemiInt *= 0.82;
    } else if (weatherType === 'fog') {
      top.lerp(new THREE.Color('#cddbd4'), 0.55);
      bottom.lerp(new THREE.Color('#e8efe6'), 0.7);
      sunInt *= 0.7;
    }

    if (sunY < 0) {
      sunColor.set('#93a9d8');
      sunInt = Math.max(sunInt, 0.25);
    }

    this.skyUniforms.uTop.value.copy(top);
    this.skyUniforms.uBottom.value.copy(bottom);
    this.skyUniforms.uSunColor.value.copy(sunColor);
    this.skyUniforms.uSunDir.value.copy(this.sunDir);
    this.sun.color.copy(sunColor);
    this.sun.intensity = sunInt;
    this.hemi.intensity = hemiInt;
    this.hemi.color.copy(top);
    this.hemi.groundColor.set(night > 0.5 ? '#25344a' : '#d8c79a');

    this.scene.fog.color.copy(bottom);
    let fogNear = 60, fogFar = 250;
    if (weatherType === 'fog') { fogNear = 18; fogFar = 90; }
    if (weatherType === 'rain') { fogNear = 40; fogFar = 170; }
    if (weatherType === 'storm') { fogNear = 25; fogFar = 120; }
    this.scene.fog.near = fogNear;
    this.scene.fog.far = fogFar;

    // 水面随昼夜调色
    const waterDay = new THREE.Color('#6fcfc2');
    const waterNight = new THREE.Color('#2b5b6b');
    const wl = waterDay.clone().lerp(waterNight, night);
    if (weatherType === 'storm') wl.lerp(new THREE.Color('#4b7376'), 0.4);
    this.waterUniforms.uShallow.value.copy(wl);
    this.waterUniforms.uDeep.value.set('#1e7d8d').lerp(new THREE.Color('#123a4c'), night);

    this.starMat.opacity = clamp(night * 1.4 - 0.2, 0, 0.95);
    this.fireflyMat.opacity = clamp(night * 1.5 - 0.25, 0, 0.95);
    this.nightAmount = night;

    // 天气粒子
    this.rain.visible = weatherType === 'rain' || weatherType === 'storm';
    this.rain.material.opacity = weatherType === 'storm' ? 0.9 : 0.55;
    const cloudTint = weatherType === 'storm' ? '#6b7c7c' : weatherType === 'rain' ? '#b3c2bf' : weatherType === 'fog' ? '#dbe6df' : '#f7faf6';
    this.clouds.forEach((c) => {
      c.traverse((o) => { if (o.isMesh) o.material = M(cloudTint, { roughness: 1 }); });
    });
  }

  update(dt, env) {
    this.time += dt;
    const { dayTime, weather, playerPos, tide } = env;
    this.waterLevel = tide;
    this.water.position.y = tide;
    this.waterUniforms.uTime.value = this.time;
    this.waterUniforms.uTide.value = tide;

    this.setTimeOfDay(dayTime, weather.type);

    // 太阳跟随玩家保证阴影
    this.sun.target.position.set(playerPos.x, playerPos.y, playerPos.z);
    this.sun.position.set(
      playerPos.x + this.sunDir.x * 60,
      playerPos.y + Math.max(12, this.sunDir.y * 60),
      playerPos.z + this.sunDir.z * 60,
    );

    // 天空跟随镜头，避免穿出
    this.sky.position.copy(env.cameraPos).setY(0);
    this.stars.position.copy(env.cameraPos).setY(0);
    this.rain.position.set(env.cameraPos.x, 0, env.cameraPos.z);

    // 雨
    if (this.rain.visible) {
      const pos = this.rain.geometry.attributes.position;
      const wind = weather.type === 'storm' ? 5 : 2;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * (weather.type === 'storm' ? 26 : 18);
        let x = pos.getX(i) + dt * wind;
        if (y < 0) { y = 42; x = (Math.random() - 0.5) * 76; }
        if (x > 38) x -= 76;
        pos.setY(i, y); pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    // 云漂移
    this.clouds.forEach((c) => {
      c.position.x += c.userData.speed * dt * (weather.type === 'storm' ? 3.5 : 1);
      if (c.position.x > 180) c.position.x = -180;
      c.position.y += Math.sin(this.time * 0.3 + c.position.z) * 0.01;
    });

    // 棕榈随风
    const windAmt = weather.type === 'storm' ? 0.13 : weather.type === 'rain' ? 0.06 : 0.022;
    this.palms.forEach((p, i) => {
      const crown = p.userData.crown;
      if (crown) {
        crown.rotation.z = Math.sin(this.time * 1.4 + i) * windAmt;
        crown.rotation.x = Math.cos(this.time * 1.1 + i) * windAmt * 0.6;
      }
    });

    // 海面木箱
    this.crates.forEach((c) => {
      c.position.y = Math.sin(this.time * 0.9 + c.userData.ph) * 0.12 + 0.1;
      c.rotation.z = Math.sin(this.time * 0.7 + c.userData.ph) * 0.08;
    });

    // 海鸥
    this.gulls.forEach((g, i) => {
      const ph = g.userData.ph;
      const t = this.time * 0.35 + ph;
      const r = 26 + i * 4;
      g.position.set(
        this.camp.x + Math.cos(t) * r,
        this.camp.h + 9 + Math.sin(t * 2) * 1.6,
        this.camp.z + Math.sin(t) * r,
      );
      g.rotation.y = -t;
      const flap = Math.sin(this.time * 8 + ph) * 0.5;
      g.userData.wl.rotation.z = flap;
      g.userData.wr.rotation.z = -flap;
    });

    // 萤火虫漂浮
    if (this.fireflyMat.opacity > 0.05) {
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < this.fireflyBase.length; i++) {
        const b = this.fireflyBase[i];
        pos.setY(i, b.y + Math.sin(this.time * 1.2 + b.ph) * 0.4);
        pos.setX(i, b.x + Math.cos(this.time * 0.8 + b.ph) * 0.5);
      }
      pos.needsUpdate = true;
    }

    // 营火标记
    if (this.campMarker) {
      this.campMarker.userData.ring.material.opacity = 0.35 + Math.sin(this.time * 2.2) * 0.15;
      this.campMarker.rotation.y = this.time * 0.4;
    }

    // 船
    if (this.boat) {
      if (this.boatReady && !this.sailing) {
        const gy = this.heightAt(this.boatPos.x, this.boatPos.z);
        this.boat.position.set(this.boatPos.x, Math.max(tide + 0.15, gy + 0.1) + Math.sin(this.time * 1.1) * 0.07, this.boatPos.z);
        this.boat.rotation.z = Math.sin(this.time * 0.8) * 0.04;
        this.boat.userData.lampLight.intensity = this.nightAmount > 0.4 ? 1.2 : 0.15;
      }
    }

    // 灯塔灯
    if (this.lighthouse && this.nightAmount > 0.3) {
      this.lighthouse.userData.lamp.material.emissiveIntensity = 0.8 + Math.sin(this.time * 2.4) * 0.5;
    }
    this.obs = this.obs || { trophy: 0 };
  }

  buildBoatGroupForSail() {
    // 用于出航时把小船从残骸转正
  }
}
