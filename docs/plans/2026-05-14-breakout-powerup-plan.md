# 打砖块 — 道具系统实现计划
> **Goal:** 为打砖块游戏添加完整的 8 种道具系统
> **Architecture:** 新增道具数据结构和逻辑模块，集成到现有游戏循环中
> **Tech Stack:** 纯 JavaScript + Canvas

---

### Task 1: 新增道具数据结构 + 激活效果状态
**文件:**
- 修改: `F:\xuexi\openproject\agent robot\test\g2\breakout_game\game.js`

**Step 1:** 在 `keys` 定义之后，新增以下数据结构：

```javascript
/* ---------- 道具系统数据 ---------- */
const POWERUP_TYPES = [
    { id: 'W', name: '加宽挡板', color: '#4fc3f7', duration: 10000, type: 'buff' },
    { id: 'M', name: '多球',     color: '#e91e63', duration: 0,     type: 'buff' },    // 0 = 瞬时
    { id: 'F', name: '穿透球',   color: '#ff5722', duration: 8000,  type: 'buff' },
    { id: 'S', name: '减速',     color: '#66bb6a', duration: 8000,  type: 'buff' },
    { id: 'H', name: '加命',     color: '#ff6b6b', duration: 0,     type: 'buff' },
    { id: 'G', name: '粘球挡板', color: '#ab47bc', duration: 10000, type: 'buff' },
    { id: 'N', name: '缩小挡板', color: '#ff9800', duration: 10000, type: 'debuff' },
    { id: 'E', name: '加速',     color: '#ffeb3b', duration: 8000,  type: 'debuff' },
];

let powerups = [];          // 下落中的道具 { x, y, type, vy, wobble, wobbleSpeed }
let activeEffects = {};     // { 'W': { endTime, id, name, color } }
let balls = [];             // 球数组（支持多球）
```

**Step 2:** 将原有的 `ball` 对象重构为多球架构，新增 `createBall()` 工厂函数：

```javascript
function createBall(x, y, dx, dy, stuck = true) {
    return { x, y, r: 9, dx: dx || 0, dy: dy || 0, speed: 5, stuck, trail: [] };
}
```

**Step 3:** 修改 `resetBall()` → 操作 `balls[0]`，并清空 `balls` 数组

**Step 4:** 修改所有引用 `ball.xxx` 的地方，改为遍历 `balls[]` 处理

---

### Task 2: 道具生成 — 砖碎时概率掉落
**修改位置:** `ballBrickCollision()` 中砖块破碎处

```javascript
// 在 brick.alive = false 之后调用
function spawnPowerup(x, y) {
    if (Math.random() > 0.18) return;  // 18% 概率
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
        x, y,
        type,
        vy: 2,
        wobble: 0,
        wobbleSpeed: 2 + Math.random() * 2,
    });
}
```

---

### Task 3: 道具下落 + 接取检测
**新增函数:**

```javascript
function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.y += p.vy;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble * 0.05) * 0.3;   // 左右摆动

        // 检查挡板接取
        if (p.y + 12 >= paddle.y && p.y - 12 <= paddle.y + paddle.h &&
            p.x >= paddle.x && p.x <= paddle.x + paddle.w) {
            activateEffect(p.type);
            powerups.splice(i, 1);
            continue;
        }

        // 落底消失
        if (p.y > H + 20) {
            powerups.splice(i, 1);
        }
    }
}
```

---

### Task 4: 效果激活 / 还原系统
**新增函数:**

```javascript
function activateEffect(type) {
    // 加命 — 瞬时生效
    if (type.id === 'H') {
        lives = Math.min(lives + 1, 9);
        updateUI();
        return;
    }

    // 多球 — 瞬时分裂
    if (type.id === 'M') {
        const currentBalls = balls.slice();
        for (const b of currentBalls) {
            if (b.stuck) continue;
            for (let i = 0; i < 2; i++) {
                const angle = Math.atan2(b.dy, b.dx) + (i === 0 ? -0.5 : 0.5);
                const spd = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
                balls.push(createBall(b.x, b.y,
                    Math.cos(angle) * spd,
                    Math.sin(angle) * spd, false));
            }
        }
        return;
    }

    // 有效果时间限制的道具
    if (type.duration > 0) {
        // 如果已有该效果，仅刷新计时
        if (activeEffects[type.id]) {
            activeEffects[type.id].endTime = Date.now() + type.duration;
            return;
        }
        activeEffects[type.id] = {
            endTime: Date.now() + type.duration,
            ...type,
        };
        applyEffect(type.id, true);
    }
}

function applyEffect(id, activate) {
    switch (id) {
        case 'W': // 加宽挡板
            paddle.w = activate ? paddle.w * 1.6 : paddle.w / 1.6;
            break;
        case 'F': // 穿透球 — 在碰撞检测中用
            break;
        case 'S': // 减速
            balls.forEach(b => { b.dx *= activate ? 0.5 : 2; b.dy *= activate ? 0.5 : 2; });
            break;
        case 'G': // 粘球挡板 — 在碰撞检测中用
            break;
        case 'N': // 缩小挡板
            paddle.w = activate ? paddle.w * 0.6 : paddle.w / 0.6;
            break;
        case 'E': // 加速
            balls.forEach(b => { b.dx *= activate ? 1.6 : 0.625; b.dy *= activate ? 1.6 : 0.625; });
            break;
    }
    // 防止挡板超出边界
    paddle.x = Math.min(paddle.x, W - paddle.w);
}

function updateActiveEffects() {
    const now = Date.now();
    for (const id in activeEffects) {
        if (now >= activeEffects[id].endTime) {
            applyEffect(id, false);
            delete activeEffects[id];
        }
    }
}
```

---

### Task 5: 绘制道具 + 效果状态栏
**新增函数:**

```javascript
function drawPowerups() {
    for (const p of powerups) {
        const cx = p.x, cy = p.y, r = 14;
        // 发光效果
        ctx.shadowColor = p.type.color;
        ctx.shadowBlur = 15;
        // 圆形底
        const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, r);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, p.type.color);
        grad.addColorStop(1, darkenColor(p.type.color, 0.4));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // 图标文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type.id, cx, cy + 1);
    }
}

function drawActiveEffects() {
    const list = Object.values(activeEffects);
    if (list.length === 0) return;
    const barX = 10, barY = 8;
    let offsetX = barX;
    for (const ef of list) {
        const remaining = Math.max(0, ef.endTime - Date.now());
        const total = ef.duration;
        const pct = remaining / total;
        const w = 80, h = 18;
        // 背景
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, offsetX, barY, w, h, 4);
        ctx.fill();
        // 进度条
        ctx.fillStyle = ef.color;
        roundRect(ctx, offsetX + 2, barY + 2, (w - 4) * pct, h - 4, 3);
        ctx.fill();
        // 文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${ef.id} ${(remaining / 1000).toFixed(1)}s`, offsetX + w / 2, barY + h / 2);
        offsetX += w + 6;
    }
}
```

---

### Task 6: 修改球碰撞逻辑支持穿透和粘球
**修改 `ballPaddleCollision()`:** 粘球效果

```javascript
// 在挡板碰撞检测命中后：
if (activeEffects['G']) {
    // 粘球效果 — 球粘住
    ball.stuck = true;
    // 仍播放音效和粒子
    sfx.play('paddle');
    spawnParticles(ball.x, paddle.y, '#4fc3f7', 8);
    return true;
}
```

**修改 `ballBrickCollision()`:** 穿透效果

```javascript
// 在球砖碰撞检测命中后，处理穿透：
if (activeEffects['F']) {
    // 穿透球 — 不反弹方向，只打碎砖块
    brick.hp--;
    if (brick.hp <= 0) {
        brick.alive = false;
        spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
        spawnParticles(/*...*/);
        score += 10;
    }
    updateUI();
    continue;  // 继续检查下一块砖（不 break）
} else {
    // 原有逻辑：反弹 + break
}
```

---

### Task 7: 整合到游戏主循环
**修改 `update()`:**
```javascript
function update() {
    if (state !== STATE.PLAYING) return;
    
    // ... 现有挡板移动逻辑不变 ...
    
    // 遍历所有球
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        // ... 球移动、碰撞逻辑（适配多球）...
        // 如果球掉出底部，从 balls 移除
        if (ball.y + ball.r > H) {
            balls.splice(i, 1);
        }
    }
    
    // 没有球了 → 掉球处理
    if (balls.length === 0) {
        sfx.play('lose');
        lives--;
        comboCount = 0;
        updateUI();
        if (lives <= 0) {
            sfx.play('gameover');
            state = STATE.GAMEOVER;
            return;
        }
        // 重生一个球
        resetBall(true);
        balls = [createBall(paddle.x + paddle.w / 2, paddle.y - 10)];
        ball.stuck = true;
        return;
    }
    
    updatePowerups();
    updateActiveEffects();
    updateParticles();
}

// 同时需要检查所有球是否都 stuck（都粘住时不能全部发射）
```

**修改 `draw()`:** 在粒子绘制后、叠加状态文字前，插入：
```javascript
drawPowerups();
drawActiveEffects();
```

**修改 `resetGame()`:** 清空道具状态
```javascript
powerups = [];
activeEffects = {};
balls = [createBall(W / 2 - 18, 550)];
```

---

### Task 8: 测试验证
1. 打开浏览器，开始游戏
2. 击碎砖块，观察道具是否掉落（18% 概率）
3. 分别测试 8 种道具效果
4. 测试多球分裂
5. 测试道具时间结束后效果还原
6. 测试粘球 + 重新发射
7. 测试穿透球穿过多个砖块
