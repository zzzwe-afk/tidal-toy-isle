import * as THREE from '../vendor/three.module.js';
import {
  createPalm, createRock, createBush, createDriftwood, createCoconutPickup,
  createShellPickup, createCrab,
} from './models.js';
import { angleLerp, damp } from './util.js';

const NODE_DEF = {
  tree:      { label: '椰子树', verb: '砍伐', hp: 3, respawn: 75, radius: 2.4 },
  rock:      { label: '礁石',   verb: '敲击', hp: 3, respawn: 65, radius: 2.1 },
  bush:      { label: '草簇',   verb: '采集', hp: 2, respawn: 45, radius: 1.9 },
  driftwood: { label: '漂流木', verb: '拾取', hp: 1, respawn: 85, radius: 1.9 },
  coconut:   { label: '椰子',   verb: '拾取', hp: 1, respawn: 70, radius: 1.7, instant: true },
  shell:     { label: '贝壳',   verb: '拾取', hp: 1, respawn: 90, radius: 1.6, instant: true },
};

export class Gatherable {
  constructor(scene, kind, x, z, ground, opts = {}) {
    const def = NODE_DEF[kind];
    this.kind = kind;
    this.def = def;
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.label = def.label;
    this.verb = def.verb;
    this.radius = def.radius;
    this.hp = def.hp;
    this.alive = true;
    this.respawnTimer = 0;
    this.squash = 0;
    this.grow = 1;
    this.pos = new THREE.Vector3(x, ground, z);

    let obj;
    const rng = () => Math.random();
    switch (kind) {
      case 'tree': obj = createPalm(rng); break;
      case 'rock': obj = createRock(rng, opts.tint || '#a8b0a7'); break;
      case 'bush': obj = createBush(rng); break;
      case 'driftwood': obj = createDriftwood(rng); break;
      case 'coconut': obj = createCoconutPickup(); break;
      case 'shell': obj = createShellPickup(opts.tint || '#f2b9a4'); break;
      default: obj = new THREE.Group();
    }
    this.object = obj;
    obj.position.set(x, ground - 0.02, z);
    obj.rotation.y = opts.rot ?? Math.random() * 6.28;
    if (kind === 'tree') obj.rotation.y = opts.rot ?? Math.random() * 6.28;
    this.baseScale = obj.scale.x;
    scene.add(obj);
  }

  hit() {
    if (!this.alive) return false;
    this.hp -= 1;
    this.squash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnTimer = this.def.respawn;
      this.object.visible = false;
      return true;
    }
    return false;
  }

  // 返回本次采集获得的物品
  harvest(tools) {
    const out = [];
    switch (this.kind) {
      case 'tree':
        out.push(['wood', tools.axe ? 3 : 1]);
        if (Math.random() < 0.22) out.push(['coconut', 1]);
        break;
      case 'rock':
        out.push(['stone', tools.pickaxe ? 2 : 1]);
        if (Math.random() < 0.1) out.push(['shell', 1]);
        break;
      case 'bush':
        out.push(['fiber', 2]);
        break;
      case 'driftwood':
        out.push(['wood', 2]);
        break;
      case 'coconut':
        out.push(['coconut', 1]);
        break;
      case 'shell':
        out.push(['shell', 1]);
        break;
    }
    return out;
  }

  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.hp = this.def.hp;
        this.grow = 0;
        this.object.visible = true;
      }
      return;
    }
    if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 1.4);
    }
    const s = this.grow < 1 ? 0.6 + 0.4 * this.grow : 1;
    this.squash = damp(this.squash, 0, 9, dt);
    this.object.scale.set(
      this.baseScale * s * (1 + this.squash * 0.13),
      this.baseScale * s * (1 - this.squash * 0.18),
      this.baseScale * s * (1 + this.squash * 0.13),
    );
  }
}

/* ---------------- 寄居蟹 ---------------- */

export class HermitCrab {
  constructor(scene, x, z, ground, opts = {}) {
    this.object = createCrab(opts.scale || 1);
    this.object.position.set(x, ground, z);
    scene.add(this.object);
    this.home = new THREE.Vector3(x, ground, z);
    this.pos = new THREE.Vector3(x, ground, z);
    this.baseScale = opts.scale || 1;
    this.maxHp = opts.hp || 46;
    this.hp = this.maxHp;
    this.alive = true;
    this.state = 'idle';
    this.timer = Math.random() * 1.5;
    this.attackCd = 0;
    this.damageDealt = false;
    this.target = new THREE.Vector3(x, ground, z);
    this.heading = Math.random() * 6.28;
    this.walkTime = 0;
    this.flash = 0;
    this.recoverTime = 0;
    this.leash = 4;
    this.bar = this._makeBar();
    this.object.add(this.bar);
    this.baseClawY = [this.object.userData.clawL.rotation.x, this.object.userData.clawR.rotation.x];
  }

  _makeBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.13),
      new THREE.MeshBasicMaterial({ color: '#27413e', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.075),
      new THREE.MeshBasicMaterial({ color: '#e8735a', depthWrite: false, side: THREE.DoubleSide }),
    );
    fill.position.z = 0.001;
    g.add(bg, fill);
    g.position.y = 2.15;
    g.userData.fill = fill;
    g.visible = false;
    return g;
  }

  damage(amount, fromPos) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 1;
    const d = new THREE.Vector3(this.pos.x - fromPos.x, 0, this.pos.z - fromPos.z);
    if (d.lengthSq() > 0) { d.normalize(); this.pos.x += d.x * 0.55; this.pos.z += d.z * 0.55; }
    if (this.state === 'windup' || this.state === 'lunge') {
      this.state = 'recover'; this.recoverTime = 0.6;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dead';
      this.timer = 42;
      this.bar.visible = false;
      return true;
    }
    return false;
  }

  update(dt, ctx) {
    const { player, world, camera, onHitPlayer } = ctx;
    const obj = this.object;
    const ud = obj.userData;

    if (!this.alive) {
      this.timer -= dt;
      if (this.timer > 0) {
        obj.scale.setScalar(Math.max(0.001, obj.scale.x - dt * 3));
        return;
      }
      // 重生
      this.alive = true;
      this.hp = this.maxHp;
      this.pos.copy(this.home);
      this.state = 'idle';
      this.timer = 1;
      obj.scale.setScalar(this.baseScale);
      obj.visible = true;
      return;
    }

    // 受击闪光
    this.flash = Math.max(0, this.flash - dt * 4);
    ud.mats?.forEach((m) => {
      m.emissive?.setRGB(this.flash * 0.55, this.flash * 0.1, 0);
    });

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const pdist = Math.hypot(dx, dz);
    const groundY = world.heightAt(this.pos.x, this.pos.z);
    this.pos.y = groundY;

    let moved = 0;
    this.attackCd = Math.max(0, this.attackCd - dt);

    if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.target.set(this.home.x + (Math.random() - 0.5) * 9, 0, this.home.z + (Math.random() - 0.5) * 9);
        this.state = 'wander';
        this.timer = 4;
      }
      if (pdist < 8.5 && player.alive) this.state = 'chase';
    } else if (this.state === 'wander') {
      this.timer -= dt;
      const tdx = this.target.x - this.pos.x;
      const tdz = this.target.z - this.pos.z;
      const td = Math.hypot(tdx, tdz);
      if (td > 0.6) {
        this.heading = angleLerp(this.heading, Math.atan2(tdx, tdz), 1 - Math.exp(-4 * dt));
        this.pos.x += Math.sin(this.heading) * 1.15 * dt;
        this.pos.z += Math.cos(this.heading) * 1.15 * dt;
        moved = 1.15;
      } else this.state = 'idle';
      if (this.timer <= 0) this.state = 'idle';
      if (pdist < 8.5 && player.alive) this.state = 'chase';
    } else if (this.state === 'chase') {
      if (pdist > 15) { this.state = 'idle'; this.timer = 1; }
      else if (pdist < 2.35 && this.attackCd <= 0) {
        this.state = 'windup'; this.timer = 0.55; this.damageDealt = false;
        this.attackCd = 1.5;
      } else if (pdist < 2.0) {
        // 太近了就绕开一点，避免卡在角色里
        this.pos.x -= dx / (pdist || 1) * 2.0 * dt;
        this.pos.z -= dz / (pdist || 1) * 2.0 * dt;
      } else {
        this.heading = angleLerp(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-5 * dt));
        this.pos.x += dx / pdist * 2.7 * dt;
        this.pos.z += dz / pdist * 2.7 * dt;
        moved = 2.7;
      }
    } else if (this.state === 'windup') {
      this.timer -= dt;
      this.heading = angleLerp(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
      if (this.timer <= 0) {
        this.state = 'lunge';
        this.timer = 0.26;
        this.lungeDir = new THREE.Vector3(dx, 0, dz);
        if (this.lungeDir.lengthSq() < 0.0001) this.lungeDir.set(0, 0, 1);
        this.lungeDir.normalize();
      }
    } else if (this.state === 'lunge') {
      this.timer -= dt;
      this.pos.x += this.lungeDir.x * 7 * dt;
      this.pos.z += this.lungeDir.z * 7 * dt;
      moved = 7;
      if (!this.damageDealt && pdist < 2.9) {
        this.damageDealt = true;
        onHitPlayer?.(12, this.pos);
      }
      if (this.timer <= 0) { this.state = 'recover'; this.recoverTime = 0.65; }
    } else if (this.state === 'recover') {
      this.recoverTime -= dt;
      if (this.recoverTime <= 0) this.state = 'chase';
    }

    // 距离营地太远就拉回
    const fromHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    if (fromHome > 18) {
      this.pos.x = this.home.x;
      this.pos.z = this.home.z;
    }

    obj.position.copy(this.pos);
    obj.rotation.y = this.heading;

    // 走动动画
    this.walkTime += dt * (moved > 0 ? 7 : 2.2);
    const bob = Math.abs(Math.sin(this.walkTime)) * (moved > 0 ? 0.08 : 0.03);
    obj.position.y = groundY + bob;
    ud.legs?.forEach((leg, i) => {
      leg.rotation.x = -0.2 + (moved > 0 ? Math.sin(this.walkTime + i * 1.2) * 0.35 : Math.sin(this.walkTime * 0.5) * 0.05);
    });

    // 螯的抬起与挥动
    const raise = this.state === 'windup' ? 1.0 : this.state === 'lunge' ? 0.7 : 0;
    const idleSway = Math.sin(this.walkTime * 0.8) * 0.1;
    ud.clawL.rotation.x = -raise * 0.85 - idleSway;
    ud.clawR.rotation.x = -raise * 0.85 + idleSway;
    ud.clawL.rotation.z = raise * 0.3;
    ud.clawR.rotation.z = -raise * 0.3;
    ud.eyeStalkL.rotation.z = Math.sin(this.walkTime * 0.7) * 0.1;
    ud.eyeStalkR.rotation.z = -Math.sin(this.walkTime * 0.7) * 0.1;

    // 血条
    this.bar.visible = this.hp < this.maxHp;
    if (this.bar.visible) {
      this.bar.rotation.y = -this.heading;
      const ratio = Math.max(0.01, this.hp / this.maxHp);
      this.bar.userData.fill.scale.x = ratio;
      this.bar.userData.fill.position.x = -(1 - ratio) * 0.44;
    }
  }
}
