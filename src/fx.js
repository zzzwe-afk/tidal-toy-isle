import * as THREE from '../vendor/three.module.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.pool = [];
    this.rings = [];
    this.geo = new THREE.OctahedronGeometry(1, 0);
    this.ringGeo = new THREE.RingGeometry(0.42, 0.56, 24);
  }

  _particle() {
    if (this.pool.length) return this.pool.pop();
    const mat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false });
    const m = new THREE.Mesh(this.geo, mat);
    m.frustumCulled = false;
    return m;
  }

  burst(pos, color, count = 10, opts = {}) {
    const {
      speed = 2.6, life = 0.55, size = 0.09, gravity = 9, spread = 1, up = 1.5,
    } = opts;
    for (let i = 0; i < count; i++) {
      const m = this._particle();
      m.material.color.set(color);
      m.material.opacity = 1;
      m.material.blending = THREE.AdditiveBlending;
      m.material.needsUpdate = true;
      m.position.copy(pos);
      m.position.x += (Math.random() - 0.5) * 0.3;
      m.position.y += (Math.random() - 0.5) * 0.3;
      m.position.z += (Math.random() - 0.5) * 0.3;
      const s = size * (0.6 + Math.random() * 0.8);
      m.scale.setScalar(s);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.visible = true;
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const below = 1 - spread;
      this.particles.push({
        m,
        vx: Math.cos(a) * sp * spread,
        vy: (Math.random() * 0.8 + below) * up * speed * 0.5,
        vz: Math.sin(a) * sp * spread,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        gravity,
        spin: (Math.random() - 0.5) * 8,
        size: s,
      });
    }
  }

  ring(pos, color, opts = {}) {
    const { life = 0.45, size = 1.0, flat = true } = opts;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(pos);
    if (flat) m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(size);
    this.scene.add(m);
    this.rings.push({ m, life, maxLife: life, size });
  }

  slashArc(pos, heading, color = '#ffe6a4') {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.RingGeometry(0.7, 1.15, 20, 1, -0.7, 1.4);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.position.y += 1.0;
    m.rotation.y = heading;
    m.rotation.z = 0.3;
    this.scene.add(m);
    this.rings.push({ m, life: 0.26, maxLife: 0.26, size: 1.2, tilt: true });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.m.visible = false;
        this.scene.remove(p.m);
        this.pool.push(p.m);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.spin * dt;
      p.m.rotation.y += p.spin * dt;
      const k = Math.max(0, p.life / p.maxLife);
      p.m.material.opacity = k;
      p.m.scale.setScalar(p.size * (0.3 + k * 0.9));
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.m);
        this.rings.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      r.m.scale.setScalar(r.size * (0.7 + k * 1.7));
      r.m.material.opacity = (1 - k) * 0.85;
    }
  }
}
