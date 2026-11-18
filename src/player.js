import * as THREE from '../vendor/three.module.js';
import { M, mesh, finish, createCrab } from './models.js';
import { angleLerp, clamp, damp } from './util.js';

function capsule(r, len, mat, seg = 6) {
  return mesh(new THREE.CapsuleGeometry(r, len, 4, seg), mat);
}

export class Player {
  constructor(scene) {
    this.health = 100;
    this.hunger = 100;
    this.stamina = 100;
    this.alive = true;
    this.pos = new THREE.Vector3(-26, 0, 10);
    this.heading = 0;
    this.velY = 0;
    this.grounded = true;
    this.swimming = false;
    this.inWater = false;
    this.hurtCd = 0;
    this.attackT = 0;
    this.gatherT = 0;
    this.swingSide = 1;
    this.visual = null;
    this.animTime = 0;
    this.walkAmt = 0;
    this.swimAmt = 0;
    this.tool = null;
    this.speedNow = 0;
    this.buildGroup(scene);
  }

  buildGroup(scene) {
    const root = new THREE.Group();
    const visual = new THREE.Group();
    this.visual = visual;
    root.add(visual);
    this.root = root;
    scene.add(root);

    const skin = M('#f1c9a4', { roughness: 0.75 });
    const jacket = M('#6f6047');
    const jacketDark = M('#5c4e39');
    const shirt = M('#e8d7b4');
    const pants = M('#5f5040');
    const boot = M('#4c3b2c');
    const hatM = M('#4b3a2a');
    const hair = M('#5b3d28');
    const belt = M('#7a5433');
    const scarf = M('#b5563f');
    const metal = M('#c6cdc3', { roughness: 0.45, metalness: 0.4 });

    // 腿
    const makeLeg = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.125, 0.52, 0);
      const thigh = capsule(0.098, 0.2, pants);
      thigh.position.y = -0.14;
      g.add(thigh);
      const b = mesh(SPHEREsmall(), boot, 0, -0.36, 0.035);
      b.scale.set(0.125, 0.1, 0.185);
      g.add(b);
      return g;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);
    visual.add(legL, legR);

    // 身体
    const torso = capsule(0.245, 0.3, jacket, 10);
    torso.position.y = 0.86;
    torso.scale.z = 0.85;
    visual.add(torso);

    const chest = mesh(new THREE.BoxGeometry(0.24, 0.32, 0.02), shirt, 0, 0.9, 0.215);
    visual.add(chest);
    for (let i = 0; i < 3; i++) {
      const btn = mesh(SPHEREsmall(), M('#c8b089'), 0, 0.8 + i * 0.1, 0.235);
      btn.scale.setScalar(0.022);
      visual.add(btn);
    }

    const beltMesh = mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.09, 12, 1, true), belt, 0, 0.66, 0);
    beltMesh.scale.z = 0.85;
    visual.add(beltMesh);
    const buckle = mesh(new THREE.BoxGeometry(0.07, 0.065, 0.03), M('#e0a94a'), 0, 0.66, 0.2);
    visual.add(buckle);

    // 背包
    const pack = mesh(new THREE.BoxGeometry(0.3, 0.32, 0.2), M('#8a6642'), 0, 0.9, -0.245);
    pack.rotation.x = 0.05;
    visual.add(pack);
    const packFlap = mesh(new THREE.BoxGeometry(0.31, 0.1, 0.22), M('#a97a4f'), 0, 1.02, -0.245);
    visual.add(packFlap);
    const strap = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), M('#6b4a2e'), -0.19, 0.9, 0.17);
    strap.rotation.z = 0.12;
    visual.add(strap);
    const strap2 = strap.clone();
    strap2.position.x = 0.19;
    strap2.rotation.z = -0.12;
    visual.add(strap2);

    // 背后短刀
    const backSword = new THREE.Group();
    backSword.position.set(-0.16, 1.02, -0.34);
    backSword.rotation.z = -0.55;
    const blade = mesh(new THREE.BoxGeometry(0.05, 0.55, 0.012), metal, 0, 0.14, 0);
    const grip = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.18, 6), M('#7c5433'), 0, -0.15, 0);
    const guard = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), M('#e0a94a'), 0, -0.06, 0);
    backSword.add(blade, grip, guard);
    visual.add(backSword);

    // 手臂
    const makeArm = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.285, 1.04, 0);
      const sleeve = capsule(0.085, 0.18, jacket);
      sleeve.position.y = -0.12;
      g.add(sleeve);
      const cuff = mesh(new THREE.CylinderGeometry(0.09, 0.095, 0.07, 8), jacketDark, 0, -0.24, 0);
      g.add(cuff);
      const hand = mesh(SPHEREsmall(), skin, 0, -0.33, 0.02);
      hand.scale.setScalar(0.082);
      g.add(hand);
      return g;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);
    visual.add(armL, armR);

    // 头
    const head = new THREE.Group();
    head.position.y = 1.33;
    visual.add(head);
    this.head = head;

    const skull = mesh(SPHEREmini(), skin, 0, 0, 0);
    skull.scale.set(0.31, 0.3, 0.29);
    head.add(skull);

    const eyeWhite = M('#fdf8ec', { roughness: 0.5 });
    const pupil = M('#243d3c', { roughness: 0.4 });
    [-1, 1].forEach((side) => {
      const e = mesh(SPHEREsmall(), eyeWhite, side * 0.105, 0.02, 0.255);
      e.scale.set(0.072, 0.086, 0.04);
      head.add(e);
      const p = mesh(SPHEREsmall(), pupil, side * 0.105, 0.02, 0.29);
      p.scale.set(0.036, 0.044, 0.022);
      head.add(p);
      const brow = mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), hair, side * 0.105, 0.12, 0.27);
      brow.rotation.z = side * -0.16;
      head.add(brow);
      const blush = mesh(SPHEREsmall(), M('#efa08a'), side * 0.19, -0.065, 0.235);
      blush.scale.set(0.055, 0.032, 0.012);
      head.add(blush);
    });

    const nose = mesh(SPHEREsmall(), skin, 0, -0.02, 0.3);
    nose.scale.set(0.035, 0.03, 0.03);
    head.add(nose);
    const mouth = mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 9, Math.PI), M('#9c5c4d'), 0, -0.085, 0.29);
    mouth.rotation.z = Math.PI;
    head.add(mouth);

    // 头发刘海
    for (let i = 0; i < 3; i++) {
      const h = mesh(SPHEREsmall(), hair, (i - 1) * 0.13, 0.22, 0.22);
      h.scale.set(0.13, 0.1, 0.08);
      head.add(h);
    }
    const hairBack = mesh(SPHEREmini(), hair, 0, 0.05, -0.16);
    hairBack.scale.set(0.29, 0.28, 0.1);
    head.add(hairBack);

    // 围巾
    const sc = mesh(new THREE.TorusGeometry(0.2, 0.045, 5, 12), scarf, 0, 1.12, 0);
    sc.rotation.x = Math.PI / 2;
    visual.add(sc);
    const scTail = mesh(new THREE.BoxGeometry(0.1, 0.22, 0.03), scarf, 0.17, 1.0, -0.12);
    scTail.rotation.z = -0.35;
    visual.add(scTail);

    // 海盗帽
    const hat = new THREE.Group();
    hat.position.set(0, 0.22, 0);
    hat.rotation.z = 0.05;
    head.add(hat);
    const brim = mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.055, 14), hatM, 0, 0, 0);
    brim.scale.set(1.03, 1, 0.92);
    hat.add(brim);
    const crown = mesh(new THREE.CylinderGeometry(0.29, 0.36, 0.22, 10), hatM, 0, 0.1, -0.02);
    hat.add(crown);
    const band = mesh(new THREE.CylinderGeometry(0.355, 0.365, 0.06, 10), scarf, 0, 0.04, -0.02);
    hat.add(band);
    const feather = mesh(new THREE.ConeGeometry(0.045, 0.34, 5), M('#d45f4c'), 0.33, 0.17, 0.1);
    feather.rotation.z = -0.65;
    feather.rotation.x = 0.2;
    hat.add(feather);
    const hatTop = mesh(SPHEREsmall(), hatM, 0, 0.2, -0.02);
    hatTop.scale.set(0.3, 0.1, 0.3);
    hat.add(hatTop);

    this.parts = { legL, legR, armL, armR, head, torso, hat, backSword };
    finish(visual);
    this.buildTools(armR);
  }

  buildTools(armR) {
    const metal = M('#c6cdc3', { roughness: 0.5, metalness: 0.3 });
    const wood = M('#a97a4f', { roughness: 0.8 });
    const tools = {};

    // 斧
    {
      const g = new THREE.Group();
      const handle = mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.46, 5), wood, 0, 0.1, 0);
      handle.rotation.x = -0.2;
      const head1 = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.07), metal, 0, 0.33, 0.02);
      head1.rotation.z = 0.2;
      head1.rotation.y = Math.PI / 2;
      const wedge = mesh(new THREE.ConeGeometry(0.075, 0.16, 4), metal, 0.02, 0.36, -0.11);
      wedge.rotation.x = Math.PI / 2;
      g.add(handle, head1, wedge);
      tools.axe = g;
    }
    // 镐
    {
      const g = new THREE.Group();
      const handle = mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.46, 5), wood, 0, 0.1, 0);
      handle.rotation.x = -0.2;
      const p = mesh(new THREE.ConeGeometry(0.06, 0.36, 4), metal, 0, 0.34, 0.06);
      p.rotation.z = Math.PI / 2;
      p.rotation.y = Math.PI / 2;
      g.add(handle, p);
      tools.pickaxe = g;
    }
    // 弯刀
    {
      const g = new THREE.Group();
      const handle = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 5), M('#7c5433'), 0, -0.02, 0);
      const guard = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), M('#e0a94a'), 0, 0.06, 0);
      const blade = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.4, 4), metal, 0, 0.28, 0);
      blade.scale.set(0.55, 1, 1);
      blade.rotation.z = 0.08;
      g.add(handle, guard, blade);
      tools.sword = g;
    }
    // 鱼竿
    {
      const g = new THREE.Group();
      const rod = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 5), wood, 0, 0.3, 0);
      rod.rotation.x = -0.25;
      const line = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 3), M('#e4decb'), 0.02, 0.52, 0.16);
      g.add(rod, line);
      tools.rod = g;
    }

    Object.entries(tools).forEach(([k, g]) => {
      g.position.set(0.01, -0.38, 0.06);
      g.rotation.x = 0.35;
      g.visible = false;
      g.userData.tool = k;
      armR.add(g);
    });
    this.tools = tools;
  }

  setTool(kind) {
    Object.entries(this.tools).forEach(([k, g]) => { g.visible = k === kind; });
    this.tool = kind;
  }

  playAttack() {
    if (this.attackT > 0.12) return false;
    this.attackT = 0.42;
    return true;
  }

  playGather() {
    if (this.gatherT > 0.2) return false;
    this.gatherT = 0.55;
    return true;
  }

  takeDamage(n) {
    if (this.hurtCd > 0 || !this.alive) return;
    this.health = Math.max(0, this.health - n);
    this.hurtCd = 0.7;
  }

  update(dt, input, world, waterLevel) {
    if (!this.alive) {
      this.animTime += dt;
      return;
    }
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.attackT = Math.max(0, this.attackT - dt);
    this.gatherT = Math.max(0, this.gatherT - dt);

    const groundY = world.heightAt(this.pos.x, this.pos.z);
    const depth = waterLevel - groundY;
    this.inWater = depth > 0.08;
    this.swimming = depth > 1.02;

    let mx = input.x, mz = input.z;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    const moving = mag > 0.05 && !input.frozen;

    let speed = this.swimming ? 2.7 : 4.3;
    const sprinting = input.sprint && !this.swimming && moving && this.stamina > 1;
    if (sprinting) speed = 7.0;

    const targetSpeed = moving ? speed : 0;
    this.speedNow = damp(this.speedNow, targetSpeed, 8, dt);

    if (moving) {
      const nx = this.pos.x + mx * this.speedNow * dt;
      const nz = this.pos.z + mz * this.speedNow * dt;
      // 别走进岛外太深的海
      this.pos.x = nx;
      this.pos.z = nz;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, targetHeading, 1 - Math.exp(-10 * dt));
    }
    this.root.rotation.y = this.heading;

    // 体力与饥饿
    if (sprinting) this.stamina = Math.max(0, this.stamina - 15 * dt);
    else if (this.swimming) this.stamina = Math.max(0, this.stamina - 3.2 * dt);
    else this.stamina = Math.min(100, this.stamina + 11 * dt);

    this.hunger = Math.max(0, this.hunger - dt / 16);
    if (this.hunger > 30) this.health = Math.min(100, this.health + 0.6 * dt);
    if (this.hunger <= 0) this.health = Math.max(0, this.health - 1.4 * dt);
    if (this.swimming && this.stamina <= 0) this.health = Math.max(0, this.health - 5 * dt);

    // 垂直
    const ground2 = world.heightAt(this.pos.x, this.pos.z);
    if (this.swimming) {
      this.velY = 0;
      this.grounded = false;
      this.pos.y = damp(this.pos.y, waterLevel - 0.12, 6, dt);
    } else {
      if (input.jump && this.grounded && !this.swimming) {
        this.velY = 4.4;
        this.grounded = false;
      }
      this.velY -= 11.5 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= ground2) {
        this.pos.y = ground2;
        this.velY = 0;
        this.grounded = true;
      }
    }
    this.root.position.copy(this.pos);

    this.animate(dt, moving, sprinting);
  }

  animate(dt, moving, sprinting) {
    const p = this.parts;
    this.animTime += dt * (moving ? (sprinting ? 1.8 : 1.15) : 0.55);
    this.walkAmt = damp(this.walkAmt, moving && !this.swimming ? 1 : 0, 8, dt);
    this.swimAmt = damp(this.swimAmt, this.swimming ? 1 : 0, 6, dt);

    const t = this.animTime;
    const swing = Math.sin(t * 8);
    const swing2 = Math.sin(t * 8 + Math.PI);

    p.legL.rotation.x = swing * 0.62 * this.walkAmt;
    p.legR.rotation.x = swing2 * 0.62 * this.walkAmt;

    // 默认臂摆
    let armLX = -swing2 * 0.5 * this.walkAmt;
    let armRX = -swing * 0.5 * this.walkAmt;
    p.armL.rotation.z = 0.06;
    p.armR.rotation.z = -0.06;

    // 游泳姿态
    this.visual.rotation.x = this.swimAmt * 1.18;
    this.visual.position.y = this.swimAmt * 0.32;
    if (this.swimming) {
      const paddle = Math.sin(t * 7);
      armLX = -0.6 + paddle * 0.9;
      armRX = -0.6 - paddle * 0.9;
      p.legL.rotation.x = 0.2 + Math.sin(t * 7) * 0.25;
      p.legR.rotation.x = 0.2 - Math.sin(t * 7) * 0.25;
      p.head.rotation.x = -0.35;
    } else {
      p.head.rotation.x = Math.sin(t * 0.8) * 0.03;
    }

    // 攻击
    if (this.attackT > 0) {
      const k = 1 - this.attackT / 0.42;
      const raise = k < 0.32 ? k / 0.32 : 1;
      const slash = k < 0.32 ? 0 : (k - 0.32) / 0.68;
      armRX = -2.1 * raise + slash * 3.1;
      p.armR.rotation.z = -0.15 - raise * 0.2;
      this.visual.rotation.z = Math.sin(slash * Math.PI) * 0.16;
      p.head.rotation.y = -0.15 * (1 - k);
    } else if (this.gatherT > 0) {
      const k = 1 - this.gatherT / 0.55;
      const chop = Math.sin(k * Math.PI * 3);
      armRX = -1.1 + chop * 0.9;
      this.visual.rotation.x = this.swimAmt * 1.18 + Math.sin(k * Math.PI) * 0.18;
    }

    p.armR.rotation.x = armRX;
    p.armL.rotation.x = armLX;
    p.head.rotation.y = 0;
    this.visual.rotation.z = 0;
    if (this.attackT <= 0 && this.gatherT <= 0 && !this.swimming) {
      p.head.rotation.x = Math.sin(t * 0.8) * 0.03;
    }

    // 身体上下与帽子摆动
    const bob = Math.abs(Math.sin(t * 8)) * 0.055 * this.walkAmt;
    this.visual.position.y += bob;
    p.hat.rotation.z = 0.05 + Math.sin(t * 6) * 0.03 * this.walkAmt;
    p.hat.rotation.x = Math.sin(t * 4) * 0.02;
    p.head.rotation.z = Math.sin(t * 3) * 0.02;
  }

  reset(pos) {
    this.pos.copy(pos);
    this.health = 100;
    this.stamina = 100;
    this.hunger = Math.max(this.hunger, 55);
    this.alive = true;
    this.velY = 0;
    this.root.position.copy(this.pos);
  }
}

// 共享几何，减少内存
const _small = new THREE.SphereGeometry(1, 10, 8);
const _mini = new THREE.SphereGeometry(1, 14, 11);
function SPHEREsmall() { return _small; }
function SPHEREmini() { return _mini; }
