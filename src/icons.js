// 手绘贴纸风图标：全部用 Canvas 画，保持统一的粗描边和圆角
const INK = '#27413e';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function strokeFill(ctx, fill, lw = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

const painters = {
  wood(ctx) {
    ctx.save();
    ctx.translate(6, 30); ctx.rotate(-0.32);
    rr(ctx, 0, 0, 40, 15, 7);
    strokeFill(ctx, '#b1834f');
    ctx.beginPath(); ctx.ellipse(40, 7.5, 4.6, 7.5, 0, 0, Math.PI * 2);
    strokeFill(ctx, '#d9ab72', 2.4);
    ctx.beginPath(); ctx.ellipse(40, 7.5, 1.7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9b6a3c'; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(14, 22); ctx.rotate(0.25);
    rr(ctx, 0, 0, 34, 13, 6);
    strokeFill(ctx, '#a07443');
    ctx.beginPath(); ctx.ellipse(34, 6.5, 4, 6.5, 0, 0, Math.PI * 2);
    strokeFill(ctx, '#ceA26d', 2.2);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(20, 26); ctx.lineTo(26, 21); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.2; ctx.stroke();
  },
  stone(ctx) {
    poly(ctx, [[12, 46], [9, 30], [22, 18], [40, 16], [53, 30], [50, 46], [34, 52], [20, 51]]);
    strokeFill(ctx, '#a7b0a6');
    poly(ctx, [[22, 18], [40, 16], [44, 28], [28, 32]]);
    ctx.fillStyle = 'rgba(255,255,255,.48)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 44); ctx.lineTo(30, 36); ctx.lineTo(34, 48);
    ctx.strokeStyle = 'rgba(39,65,62,.3)'; ctx.lineWidth = 2.6; ctx.stroke();
  },
  fiber(ctx) {
    const leaf = (x, y, rot, col) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 5.4, 0, 0, Math.PI * 2);
      strokeFill(ctx, col, 2.6);
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.strokeStyle = 'rgba(39,65,62,.35)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    };
    leaf(30, 22, -0.7, '#8ec96f');
    leaf(26, 36, 0.15, '#74b257');
    leaf(38, 34, 0.75, '#9dd77c');
    ctx.beginPath(); ctx.moveTo(32, 48); ctx.quadraticCurveTo(26, 40, 30, 30);
    ctx.strokeStyle = '#4f8c46'; ctx.lineWidth = 3; ctx.stroke();
  },
  coconut(ctx) {
    ctx.beginPath(); ctx.arc(32, 32, 18, 0, Math.PI * 2);
    strokeFill(ctx, '#9a6f47');
    ctx.beginPath(); ctx.arc(28, 26, 12, 0.9, 4.6);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
    [[27, 30], [37, 28], [32, 40]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#5d3f28'; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(26, 22, 4.5, 3.4, 5.4);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2.5; ctx.stroke();
  },
  fish(ctx) {
    ctx.beginPath();
    ctx.moveTo(14, 32);
    ctx.bezierCurveTo(22, 18, 43, 18, 50, 32);
    ctx.bezierCurveTo(43, 46, 22, 46, 14, 32);
    ctx.closePath();
    strokeFill(ctx, '#93c9ce');
    poly(ctx, [[50, 32], [60, 22], [58, 32], [60, 42]]);
    strokeFill(ctx, '#7fb8bf', 2.6);
    ctx.beginPath(); ctx.arc(27, 29, 2.6, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, 24); ctx.quadraticCurveTo(40, 32, 34, 40);
    ctx.strokeStyle = 'rgba(39,65,62,.4)'; ctx.lineWidth = 2; ctx.stroke();
  },
  cookedFish(ctx) {
    ctx.beginPath();
    ctx.moveTo(13, 34);
    ctx.bezierCurveTo(20, 20, 42, 20, 49, 34);
    ctx.bezierCurveTo(42, 48, 20, 48, 13, 34);
    ctx.closePath();
    strokeFill(ctx, '#e0a05a');
    poly(ctx, [[49, 34], [59, 25], [57, 34], [59, 44]]);
    strokeFill(ctx, '#c9853f', 2.6);
    ctx.beginPath(); ctx.arc(26, 30, 2.4, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.save(); ctx.translate(30, 34); ctx.rotate(-0.5);
    ctx.strokeStyle = 'rgba(39,65,62,.5)'; ctx.lineWidth = 2.2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 6 + 3, -7); ctx.lineTo(i * 6 - 3, 7); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(20, 22); ctx.quadraticCurveTo(24, 12, 30, 16);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.4; ctx.stroke();
  },
  shell(ctx) {
    ctx.beginPath();
    ctx.moveTo(32, 52);
    ctx.bezierCurveTo(14, 46, 10, 26, 18, 15);
    ctx.bezierCurveTo(24, 7, 40, 7, 46, 15);
    ctx.bezierCurveTo(54, 26, 50, 46, 32, 52);
    strokeFill(ctx, '#f3bfa7');
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(32, 46);
      ctx.quadraticCurveTo(32 + i * 15, 30, 32 + i * 12, 13 + Math.abs(i) * 3);
      ctx.strokeStyle = 'rgba(39,65,62,.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(20, 44); ctx.quadraticCurveTo(14, 24, 26, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.6; ctx.stroke();
  },
  crabMeat(ctx) {
    ctx.save(); ctx.translate(6, 4); ctx.rotate(0.45);
    ctx.beginPath(); ctx.moveTo(8, 56); ctx.lineTo(44, 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 56); ctx.lineTo(44, 10);
    ctx.strokeStyle = '#d9b06f'; ctx.lineWidth = 2; ctx.stroke();
    [[22, 40], [30, 30], [38, 19]].forEach(([x, y], i) => {
      rr(ctx, x - 8, y - 6, 16, 13, 6);
      strokeFill(ctx, i === 1 ? '#f08d6e' : '#e8735a', 2.6);
    });
    ctx.restore();
  },
  axe(ctx) {
    ctx.save(); ctx.translate(31, 6); ctx.rotate(0.22);
    rr(ctx, -3, 0, 7, 50, 3.5); strokeFill(ctx, '#a97a4f', 2.6);
    ctx.beginPath();
    ctx.moveTo(-3, 8);
    ctx.quadraticCurveTo(-24, 8, -22, 22);
    ctx.quadraticCurveTo(-22, 28, -6, 27);
    ctx.lineTo(-2, 12); ctx.closePath();
    strokeFill(ctx, '#b7c0b6', 2.6);
    ctx.beginPath(); ctx.moveTo(-19, 12); ctx.quadraticCurveTo(-22, 20, -15, 25);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
  },
  pickaxe(ctx) {
    ctx.save(); ctx.translate(31, 6); ctx.rotate(0.1);
    rr(ctx, -3, 5, 7, 50, 3.5); strokeFill(ctx, '#a97a4f', 2.6);
    ctx.beginPath();
    ctx.moveTo(-24, 16); ctx.quadraticCurveTo(-12, 2, 2, 9);
    ctx.quadraticCurveTo(14, 2, 26, 14);
    ctx.quadraticCurveTo(12, 10, 2, 16);
    ctx.quadraticCurveTo(-8, 10, -24, 16);
    ctx.closePath();
    strokeFill(ctx, '#b7c0b6', 2.6);
    ctx.restore();
  },
  sword(ctx) {
    ctx.save(); ctx.translate(10, 54); ctx.rotate(-0.62);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(6, -18, 10, -40);
    ctx.quadraticCurveTo(14, -18, 8, 0);
    ctx.closePath();
    strokeFill(ctx, '#c6cdc3', 2.8);
    ctx.beginPath(); ctx.moveTo(3, -6); ctx.lineTo(17, -6);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -6); ctx.lineTo(17, -6);
    ctx.strokeStyle = '#e0a94a'; ctx.lineWidth = 2.4; ctx.stroke();
    rr(ctx, 6, -4, 6, 12, 3); strokeFill(ctx, '#7c5433', 2.4);
    ctx.restore();
  },
  rod(ctx) {
    ctx.save(); ctx.translate(12, 56); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 0); ctx.lineTo(44, -42);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 0); ctx.lineTo(44, -42);
    ctx.strokeStyle = '#b1834f'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, -42); ctx.quadraticCurveTo(46, -8, 44, 10);
    ctx.strokeStyle = '#e4decb'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(44, 14, 4, 0.4, Math.PI * 2); ctx.strokeStyle = '#2f8f8a'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
  },
  campfire(ctx) {
    [[18, 44], [32, 48], [46, 44], [24, 53], [40, 52]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.ellipse(x, y, 7, 4.6, 0, 0, Math.PI * 2);
      strokeFill(ctx, '#a7b0a6', 2.2);
    });
    ctx.save(); ctx.translate(32, 36);
    ctx.beginPath(); ctx.moveTo(-14, 20); ctx.lineTo(6, -2);
    ctx.moveTo(14, 20); ctx.lineTo(-6, -2);
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = '#a97a4f'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(32, 8); ctx.quadraticCurveTo(44, 20, 38, 32);
    ctx.quadraticCurveTo(34, 40, 28, 34);
    ctx.quadraticCurveTo(22, 24, 32, 8);
    ctx.closePath();
    ctx.fillStyle = '#f07a52'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32, 19); ctx.quadraticCurveTo(38, 25, 34, 32);
    ctx.quadraticCurveTo(31, 37, 28, 31);
    ctx.quadraticCurveTo(27, 24, 32, 19);
    ctx.closePath(); ctx.fillStyle = '#ffd06e'; ctx.fill();
  },
  workbench(ctx) {
    ctx.beginPath(); ctx.moveTo(10, 28); ctx.lineTo(54, 24);
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = '#b1834f'; ctx.lineWidth = 5; ctx.stroke();
    [[16, 30], [16, 52], [48, 28], [48, 50]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8);
      ctx.strokeStyle = '#7c5433'; ctx.lineWidth = 5; ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(16, 24); ctx.lineTo(28, 12); ctx.lineTo(34, 22);
    ctx.strokeStyle = '#8b9492'; ctx.lineWidth = 5; ctx.stroke();
    rr(ctx, 36, 10, 15, 6, 2); strokeFill(ctx, '#c6cdc3', 2.2);
    rr(ctx, 38, 16, 6, 10, 2); strokeFill(ctx, '#7c5433', 2.2);
  },
  chest(ctx) {
    rr(ctx, 12, 22, 40, 26, 5); strokeFill(ctx, '#a97a4f');
    ctx.beginPath();
    ctx.moveTo(12, 22); ctx.lineTo(12, 30);
    ctx.lineTo(52, 30); ctx.lineTo(52, 22);
    ctx.strokeStyle = 'rgba(39,65,62,.55)'; ctx.lineWidth = 2.4; ctx.stroke();
    rr(ctx, 12, 15, 40, 8, 4); strokeFill(ctx, '#c08b58', 2.6);
    ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(52, 34);
    ctx.strokeStyle = '#8a6038'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 30); ctx.lineTo(32, 42);
    ctx.strokeStyle = '#e0a94a'; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(32, 39, 3.4, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  },
  bed(ctx) {
    ctx.save(); ctx.translate(8, 10); ctx.rotate(-0.22);
    rr(ctx, 0, 24, 48, 16, 8); strokeFill(ctx, '#e4d3a8', 2.8);
    rr(ctx, 0, 14, 16, 26, 8); strokeFill(ctx, '#f0e2bd', 2.6);
    ctx.beginPath(); ctx.moveTo(8, 24); ctx.quadraticCurveTo(14, 30, 20, 24);
    ctx.strokeStyle = 'rgba(39,65,62,.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 30); ctx.lineTo(48, 30);
    ctx.strokeStyle = '#c86f52'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  },
  compass(ctx) {
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); strokeFill(ctx, '#f3e2bb');
    ctx.beginPath(); ctx.arc(32, 32, 16, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(39,65,62,.35)'; ctx.lineWidth = 2; ctx.stroke();
    poly(ctx, [[32, 12], [38, 32], [32, 36], [26, 32]]); ctx.fillStyle = '#e8735a'; ctx.fill();
    poly(ctx, [[32, 52], [26, 32], [32, 28], [38, 32]]); ctx.fillStyle = '#2f8f8a'; ctx.fill();
    ctx.beginPath(); ctx.arc(32, 32, 3, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  },
};

export function drawIcon(ctx, type, size = 64) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const s = size / 64;
  ctx.scale(s, s);
  const fn = painters[type];
  if (fn) fn(ctx);
  ctx.restore();
}

export function makeIcon(type, px = 76) {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, px, px);
  drawIcon(ctx, type, px);
  return c;
}
