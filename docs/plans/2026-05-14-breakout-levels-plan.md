# 打砖块 — 关卡扩展实现计划
> **Goal:** 扩展为 10 关 + 4 种特殊砖块
> **Architecture:** `buildLevel()` 网格模板化，砖块对象增加 type/visible，碰撞逻辑扩展
> **Tech Stack:** 纯 JavaScript + Canvas

---

### Task 1: 网格模板系统 + 10 关布局
**文件:** `F:\xuexi\openproject\agent robot\test\g2\breakout_game\game.js`

**Step 1:** 替换 `buildLevel()` 为网格系统

定义砖块类型常量：
```javascript
const BRICK = {
    NONE:      0,
    NORMAL:    1,
    METAL:     2,
    BOMB:      3,
    REWARD:    4,
    INVISIBLE: 5,
};
```

**Step 2:** 定义 10 关布局函数，每关返回 2D 数字网格

布局示例（用 ASCII 可视化）：
```
// 关1: 标准矩形 4×8
[
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
]

// 关2: 金字塔 5 行 (0=空, 1=普通, 4=奖励)
[
  [0,0,0,0,4,0,0,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,4,1,1,1,1],
]

// 关3: 菱形 5 行 (2=金属)
[
  [0,0,0,0,1,0,0,0,0],
  [0,0,0,1,2,1,0,0,0],
  [0,0,1,1,2,1,1,0,0],
  [0,0,0,1,2,1,0,0,0],
  [0,0,0,0,1,0,0,0,0],
]

// 关4: 城墙 5行 (3=炸弹)
[
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,1,0,0,1,0,0,1],
  [1,0,0,1,0,0,1,0,0,1],
  [1,0,0,1,0,0,1,0,0,1],
  [1,1,1,1,1,1,1,1,1,1],
]

// 关5: 棋盘 6行 (2=金属, 4=奖励间隔)
// 关6: 箭头 6行 (3=炸弹, 4=奖励)
// 关7: 靶心 6行 (5=隐形, 2=金属)
// 关8: 阶梯 7行 (3+2+4混合)
// 关9: 堡垒 7行 (全类型)
// 关10: 终极 8行 (全类型密集)
```

**Step 3:** 砖块尺寸适配
```javascript
// 根据网格列数动态计算砖块尺寸
const cols = grid[0].length;
const bw = Math.min(68, Math.floor((W - 40) / cols) - 4);
const bh = 20;
```

---

### Task 2: 砖块创建函数
**新增函数:**
```javascript
function createBrick(x, y, w, h, type) {
    const colors = {
        1: '#ff6b6b',  // 普通
        2: '#78909c',  // 金属
        3: '#3f51b5',  // 炸弹
        4: '#4caf50',  // 奖励
        5: '#9e9e9e',  // 隐形（显示后）
    };
    const hpMap = { 1: 1, 2: 3 + Math.floor(level / 3), 3: 1, 4: 1, 5: 2 };
    return {
        x, y, w, h,
        type,
        color: colors[type],
        alive: true,
        hp: hpMap[type] || 1,
        visible: type !== 5,  // 隐形砖初始不可见
    };
}
```

---

### Task 3: 炸弹爆炸
**新增函数:**
```javascript
function bombExplode(brick, row, col, grid) {
    const bw = brick.w + 4, bh = brick.h + 4; // 含间距
    const startX = brick.x - col * bw;
    const startY = brick.y - row * bh;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            for (const b of bricks) {
                if (!b.alive) continue;
                const bc = Math.round((b.x - startX) / bw);
                const br = Math.round((b.y - startY) / bh);
                if (br === nr && bc === nc) {
                    b.alive = false;
                    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#3f51b5', 20);
                    // 奖励砖连锁不掉道具（防止无限）
                }
            }
        }
    }
    spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, '#ff5722', 40);
}
```

---

### Task 4: 修改碰撞逻辑
**修改 `ballBrickCollision()`:**

击中逻辑增加：
```javascript
// 隐形砖 — 第一次撞击使其显现
if (brick.type === 5 && !brick.visible) {
    brick.visible = true;
    brick.color = '#9e9e9e';
    return true;  // 不扣血，反弹
}

// 砖块破碎后：
if (brick.hp <= 0) {
    brick.alive = false;
    // 炸弹砖 → 爆炸
    if (brick.type === 3) {
        bombExplode(brick, row, col, grid);
    }
    // 奖励砖 → 100% 掉道具
    if (brick.type === 4) {
        spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
    } else {
        spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2); // 原 18% 概率
    }
    // 计分：金属 30，炸弹 15，奖励 10，隐形 15
    const scoreMap = { 2: 30, 3: 15, 4: 10, 5: 15 };
    score += (scoreMap[brick.type] || 10) * Math.min(comboCount, 10);
}
```

---

### Task 5: 绘制逻辑扩展
**修改 `draw()` 中的砖块绘制:**

```javascript
for (const brick of bricks) {
    if (!brick.alive) continue;
    
    // 隐形砖未显现 → 不绘制
    if (brick.type === 5 && !brick.visible) continue;
    
    // 根据类型选择颜色和效果
    let color = brick.color;
    // 炸弹砖脉冲闪烁
    if (brick.type === 3) {
        const pulse = Math.sin(Date.now() / 300) * 0.15 + 0.85;
        color = darkenColor(brick.color, 1 - pulse);
    }
    // 奖励砖旋转光泽
    // ... 绘制逻辑 ...
    
    // 金属砖显示 HP
    if (brick.type === 2 && brick.hp > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦' + brick.hp, brick.x + brick.w / 2, brick.y + brick.h / 2);
    }
}
```

---

### Task 6: 关卡上限 + 速度调整
- 胜利条件: `level > 10`（原 5）
- 球速公式: `5 + (level - 1) * 0.3` 不变
- 生命奖励: 每关 +1，上限 5 不变

---

### Task 7: 测试验证
1. 打开浏览器，从第 1 关玩到第 10 关
2. 验证每关布局是否正确
3. 测试金属砖多次击打
4. 测试炸弹砖爆炸连锁
5. 测试奖励砖 100% 掉道具
6. 测试隐形砖显现
7. 验证第 10 关通关后有胜利画面
