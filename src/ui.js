import { ITEMS, QUESTS, TOOLS, HOTBAR, canAfford } from './data.js';
import { makeIcon } from './icons.js';
import { formatTimeLabel } from './util.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(h) {
    this.handlers = h;
    this.el = {
      hud: $('#hud'),
      barHealth: $('#barHealth'),
      barStamina: $('#barStamina'),
      barHunger: $('#barHunger'),
      clockIcon: $('#clockIcon'),
      clockLabel: $('#clockLabel'),
      dayLabel: $('#dayLabel'),
      weatherLabel: $('#weatherLabel'),
      tideLabel: $('#tideLabel'),
      tideArrow: $('#tideArrow'),
      questList: $('#questList'),
      prompt: $('#prompt'),
      promptText: $('#promptText'),
      toasts: $('#toasts'),
      hotbar: $('#hotbar'),
      equipIcon: $('#equipIcon'),
      equipName: $('#equipName'),
      craftPanel: $('#craftPanel'),
      recipeList: $('#recipeList'),
      craftMats: $('#craftMats'),
      buildPanel: $('#buildPanel'),
      buildList: $('#buildList'),
      deadOverlay: $('#deadOverlay'),
      deadText: $('#deadText'),
      respawnBtn: $('#respawnBtn'),
      victoryOverlay: $('#victoryOverlay'),
      victoryStats: $('#victoryStats'),
      continueBtn: $('#continueBtn'),
      restartBtn: $('#restartBtn'),
      underwater: $('#underwater'),
      vignette: $('#vignette'),
      startScreen: $('#startScreen'),
      newGameBtn: $('#newGameBtn'),
      continueGameBtn: $('#continueGameBtn'),
    };
    this.craftOpen = false;
    this.buildOpen = false;
    this.lastVitals = '';
    this.buildHotbar();
    this.bind();
  }

  bind() {
    this.el.newGameBtn.onclick = () => this.handlers.onNewGame?.();
    this.el.continueGameBtn.onclick = () => this.handlers.onContinueGame?.();
    this.el.respawnBtn.onclick = () => this.handlers.onRespawn?.();
    this.el.continueBtn.onclick = () => this.handlers.onContinue?.();
    this.el.restartBtn.onclick = () => this.handlers.onRestart?.();
  }

  buildHotbar() {
    const bar = this.el.hotbar;
    bar.innerHTML = '';
    this.slots = {};
    HOTBAR.forEach((key) => {
      const s = document.createElement('div');
      s.className = 'slot empty';
      const icon = makeIcon(key, 84);
      s.appendChild(icon);
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = '0';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = ITEMS[key].name;
      s.appendChild(count);
      s.appendChild(name);
      s.onclick = () => this.handlers.onEat?.(key);
      bar.appendChild(s);
      this.slots[key] = { root: s, count, icon };
    });
  }

  showStart(hasSave) {
    this.el.startScreen.classList.remove('hidden');
    this.el.continueGameBtn.classList.toggle('hidden', !hasSave);
    this.el.hud.classList.add('hidden');
  }

  hideStart() { this.el.startScreen.classList.add('hidden'); }
  showHUD() { this.el.hud.classList.remove('hidden'); }

  setVitals(health, stamina, hunger) {
    this.el.barHealth.style.width = `${Math.max(0, health)}%`;
    this.el.barStamina.style.width = `${Math.max(0, stamina)}%`;
    this.el.barHunger.style.width = `${Math.max(0, hunger)}%`;
  }

  setClock(dayTime, day, weather, tide, rising) {
    const sig = `${Math.floor(dayTime * 48)}|${day}|${weather.type}|${tide > 0.3}|${rising}`;
    if (sig === this.clockSig) return;
    this.clockSig = sig;
    const wico = this.el.clockIcon;
    wico.className = 'wico ' + (weather.type === 'storm' || weather.type === 'rain' ? 'storm'
      : weather.type === 'fog' ? 'fog'
        : (dayTime < 0.24 || dayTime > 0.78) ? 'moon' : 'sun');
    this.el.clockLabel.textContent = formatTimeLabel(dayTime);
    this.el.dayLabel.textContent = `第 ${day} 天`;
    this.el.weatherLabel.textContent = weather.label;
    this.el.tideLabel.textContent = rising ? '涨潮中' : '退潮中';
    this.el.tideArrow.textContent = rising ? '↑' : '↓';
    this.el.tideArrow.style.color = rising ? '#2f8f8a' : '#c8863f';
  }

  setQuests(active, progress) {
    const sig = active + '|' + progress;
    if (sig === this.questSig) return;
    this.questSig = sig;
    const list = this.el.questList;
    list.innerHTML = '';
    QUESTS.forEach((q, i) => {
      const li = document.createElement('li');
      li.className = i < active ? 'done' : i === active ? 'active' : '';
      const dot = document.createElement('span');
      dot.className = 'dot';
      const t = document.createElement('span');
      t.textContent = q.text + (i === active && progress ? `（${progress}）` : '');
      li.appendChild(dot);
      li.appendChild(t);
      list.appendChild(li);
    });
  }

  setInventory(inv, tools) {
    const sig = JSON.stringify(inv) + JSON.stringify(tools);
    if (sig === this.invSig) return;
    this.invSig = sig;
    Object.entries(this.slots).forEach(([key, s]) => {
      const n = inv[key] || 0;
      s.count.textContent = String(n);
      s.root.classList.toggle('empty', n <= 0);
    });
    this.lastInv = inv;
    this.lastTools = tools;
    if (this.craftOpen) this.renderCraft();
  }

  setEquip(toolId) {
    const box = this.el.equipIcon;
    box.innerHTML = '';
    if (toolId && TOOLS[toolId]) {
      box.appendChild(makeIcon(toolId, 68));
      this.el.equipName.textContent = TOOLS[toolId].name;
    } else {
      this.el.equipName.textContent = '空手';
    }
  }

  prompt(text) {
    if (!text) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.classList.remove('hidden');
    this.el.promptText.textContent = text;
  }

  toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => {
      t.style.transition = 'opacity .4s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 420);
    }, 2200);
  }

  openCraft(recipes, inv, opts) {
    this.craftOpen = true;
    this.craftOpts = opts;
    this.el.craftPanel.classList.remove('hidden');
    this.renderCraft(recipes, inv);
    this.el.buildPanel.classList.add('hidden');
    this.buildOpen = false;
  }

  renderCraft(recipes = this.lastRecipes, inv = this.lastInv) {
    if (!recipes) return;
    this.lastRecipes = recipes;
    const list = this.el.recipeList;
    list.innerHTML = '';
    recipes.forEach((r) => {
      const affordable = canAfford(inv, r.cost);
      let stationOk = true;
      if (r.station === 'fire') stationOk = this.craftOpts?.nearFire;
      if (r.station === 'workbench') stationOk = this.craftOpts?.nearBench;
      const owned = r.tool && this.lastTools?.[r.tool];
      const disabled = !affordable || !stationOk || owned;

      const row = document.createElement('div');
      row.className = 'recipe' + (disabled ? ' disabled' : '');
      const ic = document.createElement('div');
      ic.className = 'ricon';
      ic.appendChild(makeIcon(r.icon || r.id, 78));
      const main = document.createElement('div');
      main.className = 'rmain';
      const name = document.createElement('div');
      name.className = 'rname';
      name.textContent = r.name;
      if (r.station) {
        const tag = document.createElement('span');
        tag.className = 'station-tag' + (r.station === 'fire' ? ' fire' : '');
        tag.textContent = r.station === 'fire' ? '营火' : '工作台';
        name.appendChild(tag);
      }
      if (owned) {
        const o = document.createElement('span');
        o.className = 'owned-mark'; o.textContent = '已拥有';
        name.appendChild(o);
      }
      const desc = document.createElement('div');
      desc.className = 'rdesc'; desc.textContent = r.desc;
      const cost = document.createElement('div');
      cost.className = 'rcost';
      Object.entries(r.cost).forEach(([k, v]) => {
        const sp = document.createElement('span');
        sp.textContent = `${ITEMS[k].name}×${v}`;
        if ((inv[k] || 0) < v) sp.classList.add('lack');
        cost.appendChild(sp);
      });
      if (r.station && !stationOk) {
        const sp = document.createElement('span');
        sp.className = 'lack';
        sp.textContent = '（需要靠近' + (r.station === 'fire' ? '营火' : '工作台') + '）';
        cost.appendChild(sp);
      }
      main.append(name, desc, cost);
      row.append(ic, main);
      if (!disabled) row.onclick = () => this.handlers.onCraft?.(r);
      list.appendChild(row);
    });

    const mats = this.el.craftMats;
    mats.innerHTML = '';
    ['wood', 'stone', 'fiber', 'fish', 'crabMeat'].forEach((k) => {
      const line = document.createElement('div');
      line.className = 'mat-line';
      line.appendChild(makeIcon(k, 48));
      const n = document.createElement('span');
      n.className = 'mn'; n.textContent = ITEMS[k].name;
      const b = document.createElement('b');
      b.textContent = String(inv[k] || 0);
      line.append(n, b);
      mats.appendChild(line);
    });
  }

  refreshCraft(inv, opts) {
    this.lastInv = inv;
    if (opts) this.craftOpts = opts;
    if (this.craftOpen) this.renderCraft(this.lastRecipes, inv);
  }

  closeCraft() {
    this.craftOpen = false;
    this.el.craftPanel.classList.add('hidden');
  }

  openBuild(builds, inv) {
    this.buildOpen = true;
    this.el.buildPanel.classList.remove('hidden');
    this.el.craftPanel.classList.add('hidden');
    this.craftOpen = false;
    const list = this.el.buildList;
    list.innerHTML = '';
    builds.forEach((b) => {
      const affordable = canAfford(inv, b.cost);
      const card = document.createElement('div');
      card.className = 'build-card' + (affordable ? '' : ' disabled');
      const canvas = makeIcon(b.icon, 120);
      card.appendChild(canvas);
      const n = document.createElement('div');
      n.className = 'bn'; n.textContent = b.name;
      const c = document.createElement('div');
      c.className = 'bc';
      c.textContent = Object.entries(b.cost).map(([k, v]) => `${ITEMS[k].name}×${v}`).join(' · ');
      card.append(n, c);
      if (affordable) card.onclick = () => this.handlers.onBuildSelect?.(b);
      list.appendChild(card);
    });
  }

  closeBuild() {
    this.buildOpen = false;
    this.el.buildPanel.classList.add('hidden');
  }

  closeSheets() {
    this.closeCraft();
    this.closeBuild();
  }

  showDeath(text) {
    this.el.deadText.textContent = text;
    this.el.deadOverlay.classList.remove('hidden');
  }

  hideDeath() { this.el.deadOverlay.classList.add('hidden'); }

  showVictory(stats) {
    this.el.victoryStats.innerHTML = stats;
    this.el.victoryOverlay.classList.remove('hidden');
  }

  hideVictory() { this.el.victoryOverlay.classList.add('hidden'); }

  flashHurt() {
    const v = this.el.vignette;
    v.style.transition = 'none';
    v.style.opacity = '0.9';
    setTimeout(() => {
      v.style.transition = 'opacity .5s';
      v.style.opacity = '0';
    }, 60);
  }

  setUnderwater(on) {
    this.el.underwater.classList.toggle('hidden', !on);
  }
}
