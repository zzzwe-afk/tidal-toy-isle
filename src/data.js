export const ITEMS = {
  wood:      { name: '木材', tint: '#a97a4f' },
  stone:     { name: '石头', tint: '#9aa39c' },
  fiber:     { name: '纤维', tint: '#7fbe63' },
  coconut:   { name: '椰子', tint: '#8b6544', food: 16, foodLabel: '清甜' },
  fish:      { name: '生鱼', tint: '#8fc4c8', food: 8, foodLabel: '腥' },
  cookedFish:{ name: '烤鱼', tint: '#e1a45c', food: 38, foodLabel: '香' },
  shell:     { name: '贝壳', tint: '#f0b8a4' },
  crabMeat:  { name: '蟹肉', tint: '#e8735a', food: 22, foodLabel: '鲜' },
};

export const HOTBAR = ['wood', 'stone', 'fiber', 'coconut', 'fish', 'cookedFish', 'crabMeat', 'shell'];

export const TOOLS = {
  axe:     { name: '漂流木斧', icon: 'axe' },
  pickaxe: { name: '石镐', icon: 'pickaxe' },
  sword:   { name: '短弯刀', icon: 'sword' },
  rod:     { name: '鱼竿', icon: 'rod' },
};

export const RECIPES = [
  {
    id: 'axe', name: '漂流木斧', tool: 'axe', icon: 'axe',
    desc: '砍树更快，每一下能多带回一些木材。',
    cost: { wood: 3, stone: 2, fiber: 2 }, station: null,
  },
  {
    id: 'pickaxe', name: '石镐', tool: 'pickaxe', icon: 'pickaxe',
    desc: '敲开礁石，采集石头更省力。',
    cost: { wood: 2, stone: 3, fiber: 2 }, station: null,
  },
  {
    id: 'sword', name: '短弯刀', tool: 'sword', icon: 'sword',
    desc: '海盗的体面，也是对付寄居蟹的利器。',
    cost: { wood: 2, stone: 3, fiber: 1 }, station: null,
  },
  {
    id: 'rod', name: '鱼竿', tool: 'rod', icon: 'rod',
    desc: '在浅海抛竿，等一会儿就有鱼咬钩。',
    cost: { wood: 3, fiber: 2 }, station: null,
  },
  {
    id: 'cookedFish', name: '烤鱼', item: 'cookedFish', icon: 'cookedFish',
    desc: '在营火上慢慢烤，饥饿恢复得更快。',
    cost: { fish: 1 }, station: 'fire',
  },
];

export const BUILDS = [
  {
    id: 'campfire', name: '营火', icon: 'campfire',
    desc: '照亮夜晚，烹饪食物，也是在岛上醒来的地方。',
    cost: { wood: 4, stone: 3 }, station: null,
  },
  {
    id: 'workbench', name: '工作台', icon: 'workbench',
    desc: '解锁更完整的制作配方。',
    cost: { wood: 8, stone: 2, fiber: 4 }, station: null,
  },
  {
    id: 'chest', name: '储物箱', icon: 'chest',
    desc: '把材料收进箱子，营地看起来才像个家。',
    cost: { wood: 6, fiber: 2 }, station: null,
  },
  {
    id: 'bed', name: '睡袋', icon: 'bed',
    desc: '睡到清晨，恢复体力，跳过长夜。',
    cost: { wood: 2, fiber: 6 }, station: null,
  },
];

export const QUESTS = [
  { id: 'gather', text: '捡起 3 木材、2 纤维和 2 石头' },
  { id: 'camp', text: '在营地空地上建造营火' },
  { id: 'axe', text: '制作一把漂流木斧' },
  { id: 'bench', text: '建造工作台' },
  { id: 'boat', text: '修好小船的船身和帆' },
  { id: 'sail', text: '出海，前往椰铃林' },
  { id: 'fragment', text: '在椰铃林高处找到潮汐罗盘碎片' },
];

export const BOAT_REPAIR = [
  { stage: 0, label: '修船身', cost: { wood: 6, fiber: 4 }, doneText: '船身补好了，海水不再往里灌。' },
  { stage: 1, label: '补船帆', cost: { wood: 3, fiber: 5 }, doneText: '补丁帆挂上了桅杆，风一吹就鼓起来。' },
];

export function canAfford(inv, cost) {
  return Object.keys(cost).every((k) => (inv[k] || 0) >= cost[k]);
}

export function pay(inv, cost) {
  Object.keys(cost).forEach((k) => { inv[k] = (inv[k] || 0) - cost[k]; });
}

export function costText(cost) {
  return Object.keys(cost).map((k) => `${ITEMS[k].name}×${cost[k]}`).join('、');
}
