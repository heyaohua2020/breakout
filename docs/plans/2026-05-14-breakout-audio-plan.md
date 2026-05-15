# 打砖块 — 音效系统实现计划
> **For agent:** 使用 Section 5 (Subagent-Driven Development) 或 Section 4 (Executing Plans) 来执行此计划。
> **目标:** 为打砖块游戏添加 Web Audio API 合成的 8-bit 音效
> **架构:** 在 game.js 中新增 SoundManager 类，在 6 个游戏事件点插入音效调用
> **技术栈:** Web Audio API (OscillatorNode + GainNode)，无外部依赖

---

### Task 1: 创建 SoundManager 类
**文件:**
- 修改: `F:\xuexi\openproject\agent robot\test\g2\breakout_game\game.js`（在游戏循环前插入）

**Step 1:** 在 `game.js` 的 `/* ============================================ 事件绑定 ============================================ */` 之前，插入 SoundManager 类定义。

完整代码：
```javascript
/* ---------- 音效系统 (Web Audio API 合成) ---------- */
const sfx = {
    ctx: null,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API 不可用');
        }
    },

    _osc(type, freq, endFreq, duration, volume = 0.3) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (endFreq !== undefined) {
            osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.05);
    },

    play(type) {
        if (!this.ctx) {
            // 如果尚未初始化，在用户交互时尝试初始化
            if (type !== 'init') return;
            this.init();
            return;
        }
        switch (type) {
            case 'paddle':
                this._osc('square', 440, 580, 0.1, 0.3);
                break;
            case 'break':
                this._osc('triangle', 620, 880, 0.08, 0.25);
                break;
            case 'hit':
                this._osc('sine', 380, 420, 0.05, 0.15);
                break;
            case 'lose':
                this._osc('sine', 400, 100, 0.35, 0.3);
                break;
            case 'levelup': {
                if (!this.ctx) return;
                const notes = [523, 659, 784]; // C5 E5 G5
                notes.forEach((freq, i) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.value = freq;
                    const t = this.ctx.currentTime + i * 0.15;
                    gain.gain.setValueAtTime(0.25, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.15);
                });
                break;
            }
            case 'gameover':
                this._osc('sawtooth', 350, 60, 0.8, 0.3);
                break;
            case 'combo': {
                const pitch = 500 + Math.min(comboCount, 10) * 50;
                this._osc('square', pitch, pitch * 1.1, 0.08, 0.2);
                break;
            }
        }
    }
};
```

**Step 2:** 在现有代码中找到以下 6 个位置插入 `sfx.play(...)` 调用：

1. **`startGame()` 函数中** — 在 `state = STATE.PLAYING;` 之前插入 `sfx.init();`（确保 AudioContext 在用户交互时创建）

2. **`ballPaddleCollision()` 函数中** — 在 `return true;` 之前插入 `sfx.play('paddle');`

3. **`ballBrickCollision()` 函数中** — 在砖块粉碎逻辑 `brick.alive = false;` 之后插入 `sfx.play('break');`；在 `score += 2;` 附近插入 `sfx.play('hit');`

4. **掉球逻辑**（`if (ball.y + ball.r > H)` 块中） — 在 `lives--;` 之后插入 `sfx.play('lose');`

5. **游戏结束**（`if (lives <= 0)` 块中） — 在 `state = STATE.GAMEOVER;` 之前插入 `sfx.play('gameover');`

6. **过关逻辑**（`if (bricks.every(b => !b.alive))` 块中） — 在 `level++;` 之前插入 `sfx.play('levelup');`

7. **连击加分** — 在 `score += 10 * bonus;` 之后插入 `sfx.play('combo');`

**Step 3:** 保存文件，验证无语法错误。

---

### Task 2: 测试验证
**Step 1:** 在浏览器中打开 `index.html`，点击「开始游戏」
**Step 2:** 确认以下音效触发：
- [ ] 点击开始按钮 → 无报错
- [ ] 发射球后撞到挡板 → 播放「叮」
- [ ] 球撞碎砖块 → 播放「啪」
- [ ] 连续快速碎砖 → 音调递增连击音效
- [ ] 球掉出底部 → 播放下降音
- [ ] 生命归零 → 播放低沉结束音
- [ ] 清空所有砖块 → 播放三连上升音
