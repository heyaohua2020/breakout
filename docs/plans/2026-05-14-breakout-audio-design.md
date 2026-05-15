# 打砖块 — 音效系统设计文档
> **日期:** 2026-05-14
> **状态:** 已批准 ✅

## 技术方案
**Web Audio API 程序化合成音效**（方案 A）

使用 `OscillatorNode` + `GainNode` 合成 8-bit 风格音效，零外部依赖。

## 音效参数

| 音效 | 触发时机 | 波形 | 频率变化 | 时长 | 音量 |
|------|---------|------|---------|------|------|
| paddle | 挡板反弹 | 方波 | 440→580Hz | 0.1s | 0.3 |
| break | 砖块粉碎 | 三角波 | 620→880Hz | 0.08s | 0.25 |
| hit | 砖块减血 | 正弦波 | 380→420Hz | 0.05s | 0.15 |
| lose | 掉球 | 正弦波 | 400→100Hz 下降 | 0.35s | 0.3 |
| levelup | 过关 | 方波 | C5→E5→G5 三连 | 0.45s | 0.25 |
| gameover | 游戏结束 | 锯齿波 | 350→60Hz 下降 | 0.8s | 0.3 |
| combo | 连击加分 | 方波 | 500+combo×50Hz | 0.08s | 0.2 |

## 架构

```
SoundManager 类 (sfx)
├── init()         → 惰性创建 AudioContext
├── play(type)     → 统一入口，分发到具体方法
├── 内部方法: paddleHit / brickBreak / brickHit / ballLost / levelUp / gameOver / comboUp
└── 自动清理: 每个音效播放后 stop() + disconnect()
```

## 集成位置（只需插入 6 处调用）
- `ballPaddleCollision()` → `sfx.play('paddle')`
- `ballBrickCollision()` 砖碎 → `sfx.play('break')`
- `ballBrickCollision()` 耐久命中 → `sfx.play('hit')`
- 掉球逻辑 → `sfx.play('lose')`
- 过关逻辑 → `sfx.play('levelup')`
- 游戏结束 → `sfx.play('gameover')`
- 连击加分 → `sfx.play('combo')`

## 关键设计决策
1. AudioContext 首次用户交互后创建（浏览器策略）
2. 自动释放振荡器资源
3. 失败静默，不影响游戏正常运行
