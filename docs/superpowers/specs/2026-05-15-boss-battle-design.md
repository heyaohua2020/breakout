# BOSS 战设计 — 霓虹突破

## 概述

在现有 10 关普通关卡之间插入 4 个 BOSS 战，间隔递减。每个 BOSS 为大型发光几何体，具有多阶段战斗机制。

## 关卡进度

```
L1-L4 → BOSS1 → L5-L7 → BOSS2 → L8-L9 → BOSS3 → L10 → BOSS4(最终)
```

- 普通关卡保持原有 10 关布局，微调配平
- 胜负条件改为击败 BOSS4 才进入 WIN 状态
- BOSS 战有独立过渡动画和背景色调变化

## BOSS 数据

```javascript
const BOSSES = [
  { name:'HEX EYES',    hp:20, color:'#ff00aa', bulletRate:0,    shieldCount:2, speed:1.5 },
  { name:'NEON TITAN',  hp:30, color:'#ff4400', bulletRate:2000, shieldCount:4, speed:2 },
  { name:'CYBER WYRM',  hp:40, color:'#39ff14', bulletRate:1500, shieldCount:3, speed:3 },
  { name:'VOIDMASTER',  hp:60, color:'#00f0ff', bulletRate:1200, shieldCount:4, speed:2.5 },
];
```

## BOSS 实体

新增 `boss` 全局对象（替换 `bricks` 为 BOSS 战模式）：

```
boss = {
  idx: 0..3,           // BOSS 索引
  x, y, w:120, h:80,  // 位置尺寸
  hp, maxHp,           // 血量
  phase: 1|2|3,        // 当前阶段
  dir: 1,              // 左右移动方向
  shields: [{x,y,w,h,alive}],  // 护盾砖块
  bullets: [{x,y,dx,dy,r}],     // 弹幕列表
  lastShot: 0,         // 上次射击时间
  flashTimer: 0,       // 受击闪白
};
```

## 三阶段战斗流程

### 阶段 1 — 护盾
- BOSS 周围环绕 N 块护盾砖块（`shields`）
- 护盾随 BOSS 移动，围绕 BOSS 排列（上下左右）
- 护盾有独立 HP（=2），打碎后消失
- **所有护盾打碎后** → 进入阶段 2

### 阶段 2 — 核心
- BOSS 本体暴露，在顶部左右移动（`x += dir * speed`）
- 球碰到 BOSS 本体造成伤害（`boss.hp--`）
- HP 降至 50% 以下 → 进入阶段 3

### 阶段 3 — 暴走
- BOSS 继续移动，保持可被球攻击
- 每隔 `bulletRate` ms 发射一颗弹幕球
- 弹幕球：小型发光球，从 BOSS 位置向挡板方向下落（带随机偏移）
- 弹幕球碰到挡板 = 掉一条命
- 弹幕球可被球消除（球碰到弹幕球即消除）
- 部分 BOSS 会召唤小砖块填充战场

## 绘制

- **BOSS 本体**：六边形（`ctx.beginPath` + 6 条边），渐变填充 + 霓虹外发光 + 脉冲动画
- **护盾**：菱形小砖块，对应 BH 颜色，带旋转动画
- **HP 条**：BOSS 上方显示血条（`maxHp` 分段的霓虹条）
- **弹幕**：红色/紫色发光小球，带拖尾
- **阶段切换**：全屏闪烁 + 文字提示

## 碰撞处理

| 碰撞对 | 处理 |
|--------|------|
| 球 → 护盾 | 护盾 HP--，球反弹 |
| 球 → BOSS 核心 | BOSS HP--，球反弹，粒子爆炸 |
| 球 → 弹幕 | 弹幕 + 球都消除（穿透球仅消除弹幕） |
| 弹幕 → 挡板 | 弹幕消除，玩家掉命 |
| 弹幕 → 底部 | 弹幕消除 |

## 击败奖励

- BOSS1: 掉落 2 个随机道具
- BOSS2: 掉落 3 个随机道具
- BOSS3: 掉落 4 个随机道具
- BOSS4: 游戏胜利，进入 WIN 画面

## 所需改动清单

1. `game.js` — 新增 `boss` 对象、BOSS 数据常量、BOSS 更新/绘制/碰撞逻辑
2. `game.js` — 修改关卡流程控制（检测 BOSS 触发时机、替换 bricks 为 boss 模式）
3. `game.js` — 修改过渡动画（BOSS 战前显示 BOSS 名称和 HP）
4. `game.js` — 修改胜负条件（击败 BOSS4 才 WIN）
5. `game.js` — 新增弹幕系统（创建、更新、绘制、碰撞）
6. `game.js` — BOSS 专属粒子效果（爆炸更大、颜色对应）
7. `game.js` — BOSS 背景色调偏移（战斗时背景染上 BOSS 颜色）
