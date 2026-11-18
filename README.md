# 潮玩荒岛 · Tidal Toy Isle

一款用 Three.js 纯前端实现的 3D 海盗生存小游戏：在漂流瓶湾醒来，捡材料、搭营地、修小船，再驶向椰铃林寻找潮汐罗盘。

整个游戏没有构建步骤、没有后端、没有外部 CDN，双击 `潮玩荒岛.html` 即可离线游玩。

## 玩法

- 采集木材、石头、纤维、椰子、贝壳与寄居蟹肉
- 制作斧头、镐、刀、钓竿、营火、工作台、箱子、床
- 模块化建造营地，带幽灵预览与合法位置检测（`R` 旋转）
- 饥饿 / 体力 / 生命三维生存，潮汐与昼夜循环、晴雨雾风暴天气
- 与寄居蟹战斗，修好小船两阶段后出海，登岛拿到罗盘碎片结局
- 自动存档在浏览器 `localStorage`

## 操作

| 按键 | 作用 |
| --- | --- |
| `WASD` | 移动 |
| 鼠标右键拖动 | 转动视角 |
| 滚轮 | 缩放 |
| `E` | 交互 / 采集 / 上船 / 睡觉 |
| 鼠标左键 | 攻击 / 放置建筑 |
| `C` | 制作面板 |
| `B` | 建造面板，`R` 旋转 |
| `Esc` | 关闭面板 |
| `M` | 静音 |

## 运行

方式一：直接双击 `潮玩荒岛.html`（单文件版，已内联 Three.js、样式与全部代码）。

方式二：源码模式需要一个静态服务器（ES Module 不能通过 `file://` 加载）：

```bash
python -m http.server 8080
# 或 npx serve
```

然后访问 <http://localhost:8080/>。

## 项目结构

```
.
├── index.html            # 入口（源码模式）
├── styles.css            # 手账贴纸风界面样式
├── src/
│   ├── main.js           # 主循环、输入、存档、建造、航行、结局
│   ├── world.js          # 地形、海面 shader、天空、昼夜、天气、植被分布
│   ├── models.js         # 程序化模型（椰子树、岩石、船、篝火等）
│   ├── entities.js       # 采集节点与寄居蟹 AI
│   ├── player.js         # 角色控制与程序化动画
│   ├── data.js           # 物品、配方、任务、建造数据
│   ├── ui.js             # HUD、制作与建造面板
│   ├── icons.js          # Canvas 手绘图标
│   ├── fx.js             # 粒子特效
│   ├── audio.js          # WebAudio 程序化音效
│   └── util.js           # 噪声、插值等工具函数
├── vendor/
│   └── three.module.js   # Three.js r160（MIT）
└── 潮玩荒岛.html          # 单文件构建版
```

所有美术资源均为运行时程序化生成（几何体、Canvas 纹理、WebAudio 合成），没有外部图片或音频素材。

## 技术栈

- Three.js r160（本地 vendor，MIT License）
- 原生 ES Modules + Canvas 2D + WebAudio，无框架、无打包工具

## 许可

源码以 [MIT License](LICENSE) 开源。Three.js 版权归其作者所有，遵循 MIT License。
