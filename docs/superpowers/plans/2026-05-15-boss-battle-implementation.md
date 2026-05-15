# BOSS 战 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 multi-phase boss battles interspersed between regular levels

**Architecture:** All changes in `game.js`. Add `boss` object, boss data, shield/bullet systems. Modify level flow to detect boss levels. Boss replaces bricks entirely during its stage.

**Tech Stack:** Vanilla JS + Canvas2D

---

### Task 1: BOSS Constants & Data

**Files:** Modify `game.js`

- [ ] **Step 1: Add BOSS brick type and boss data**

Add to the B object (around line 65):
```javascript
const B={NONE:0,NORMAL:1,METAL:2,BOMB:3,REWARD:4,INVISIBLE:5,BOSS:6};
```

Add after DIFF_CFG (around line 345):
```javascript
const BOSS_AT_LEVEL={5:0,9:1,12:2,14:3};
const BOSS_CFG=[
    {name:'HEX EYES',hp:20,color:'#ff00aa',glow:'#ff00aa',bulletInterval:0,shields:2,speed:1.5,score:500},
    {name:'NEON TITAN',hp:30,color:'#ff4400',glow:'#ff4400',bulletInterval:2000,shields:4,speed:2,score:1000},
    {name:'CYBER WYRM',hp:40,color:'#39ff14',glow:'#39ff14',bulletInterval:1500,shields:3,speed:3,score:2000},
    {name:'VOIDMASTER',hp:60,color:'#00f0ff',glow:'#00f0ff',bulletInterval:1200,shields:4,speed:2.5,score:5000},
];
```

- [ ] **Step 2: Add boss entity** (around line 24 with other state vars)

```javascript
let boss=null,bossBullets=[],bossShields=[],bossPhase=1,bossHitFlash=0,bossBGAlpha=0;
```

---

### Task 2: Boss Initialization

**Files:** Modify `game.js`

- [ ] **Step 1: Add `initBoss` function**

Add after `buildLevel` function:
```javascript
function initBoss(idx){
    const c=BOSS_CFG[idx];
    boss={idx,x:W/2-60,y:50,w:120,h:80,hp:c.hp,maxHp:c.hp,dir:1,phase:1,lastShot:0,score:c.score};
    bossShields=[];bossBullets=[];bossPhase=1;bossHitFlash=0;
    const sw=50,sh=20,gap=8;
    for(let i=0;i<c.shields;i++){
        const angle=i/c.shields*Math.PI*2;
        bossShields.push({offX:Math.cos(angle)*60,offY:Math.sin(angle)*40+10,w:sw,h:sh,hp:2,alive:true,angle});
    }
    bossBGAlpha=0;
}
```

- [ ] **Step 2: Add `isBossLevel` helper**

```javascript
function isBossLevel(lvl){return lvl in BOSS_AT_LEVEL}
function getBossIndex(lvl){return BOSS_AT_LEVEL[lvl]}
```

---

### Task 3: Boss Update

**Files:** Modify `game.js`

- [ ] **Step 1: Add `updateBoss` function**

```javascript
function updateBoss(){
    if(!boss)return;
    const c=BOSS_CFG[boss.idx];
    // Movement
    boss.x+=boss.dir*c.speed;
    if(boss.x<=0||boss.x+boss.w>=W)boss.dir*=-1;
    // Phase check
    if(bossShields.every(s=>!s.alive)&&boss.phase===1){boss.phase=2;bossBGAlpha=0.6}
    if(boss.hp<=boss.maxHp*0.5&&boss.phase===2){boss.phase=3;bossBGAlpha=0.8;spawnParticles(boss.x+boss.w/2,boss.y+boss.h/2,c.color,40)}
    // Hit flash
    if(bossHitFlash>0)bossHitFlash-=16;
    // Shield follow
    for(const s of bossShields){
        if(!s.alive)continue;
        s.angle+=0.03;
        s.x=boss.x+boss.w/2+Math.cos(s.angle)*60-s.w/2;
        s.y=boss.y+boss.h/2+Math.sin(s.angle)*40-s.h/2;
    }
    // Bullets (phase 3)
    if(boss.phase===3&&c.bulletInterval>0){
        const now=Date.now();
        if(now-boss.lastShot>c.bulletInterval){
            boss.lastShot=now;
            const spread=boss.idx>=2?3:1;
            for(let i=0;i<spread;i++){
                const a=Math.PI/2+(i-(spread-1)/2)*0.3;
                const spd=2+Math.random();
                bossBullets.push({x:boss.x+boss.w/2,y:boss.y+boss.h,r:6,dx:Math.cos(a)*spd,dy:Math.sin(a)*spd});
            }
        }
    }
    // Bullet update
    for(let i=bossBullets.length-1;i>=0;i--){
        const b=bossBullets[i];
        b.x+=b.dx;b.y+=b.dy;
        if(b.y>H+20||b.x<-20||b.x>W+20){bossBullets.splice(i,1);continue}
    }
    // BG alpha fade
    bossBGAlpha=Math.min(bossBGAlpha+0.005,1);
}
```

- [ ] **Step 2: Integrate into update loop**

In the `update` function, after the `if(bricks.every(b=>!b.alive))` block, add before `updatePowerups`:
```javascript
    if(isBossLevel(level))updateBoss();
```

---

### Task 4: Boss Drawing

**Files:** Modify `game.js`

- [ ] **Step 1: Add `drawBoss` function**

```javascript
function drawBoss(){
    if(!boss)return;
    const c=BOSS_CFG[boss.idx];
    const flash=bossHitFlash>0;
    const now=Date.now();

    // Shields
    for(const s of bossShields){
        if(!s.alive)continue;
        const pulse=Math.sin(now/400+s.angle)*0.2+0.8;
        ctx.shadowColor='#ff00aa';ctx.shadowBlur=10;
        ctx.fillStyle=s.hp>1?darkenColor('#ff00aa',0.2):'#ff00aa';
        roundRect(ctx,s.x,s.y,s.w,s.h,4);ctx.fill();
        ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;roundRect(ctx,s.x,s.y,s.w,s.h,4);ctx.stroke();
    }

    // Boss hexagon body
    const cx=boss.x+boss.w/2,cy=boss.y+boss.h/2,r=boss.w/2*0.8;
    const gp=1+Math.sin(now/300)*0.08;
    ctx.shadowColor=c.glow;ctx.shadowBlur=flash?40:20*gp;

    const grad=ctx.createRadialGradient(cx-8,cy-8,5,cx,cy,r);
    if(flash){grad.addColorStop(0,'#fff');grad.addColorStop(1,'#fff')}
    else{grad.addColorStop(0,lightenColor(c.color,0.4));grad.addColorStop(0.5,c.color);grad.addColorStop(1,darkenColor(c.color,0.3))}
    ctx.fillStyle=grad;

    // Draw hexagon
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}
    ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;

    // Neon border
    ctx.strokeStyle=c.glow;ctx.lineWidth=2;
    ctx.globalAlpha=0.5+0.3*Math.sin(now/500);
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}
    ctx.closePath();ctx.stroke();
    ctx.globalAlpha=1;

    // Inner hexagon accent
    ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r*0.6,cy+Math.sin(a)*r*0.6)}
    ctx.closePath();ctx.stroke();

    // Center eye
    if(!flash){
        const eyePulse=Math.sin(now/200)*0.3+0.7;
        ctx.fillStyle=`rgba(255,255,255,${eyePulse*0.6})`;ctx.beginPath();ctx.arc(cx,cy,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(cx-3,cy-3,3,0,Math.PI*2);ctx.fill();
    }

    // Boss name + HP bar
    ctx.fillStyle='rgba(0,240,255,0.3)';ctx.font='600 11px Rajdhani,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(c.name,cx,boss.y-8);
    // HP bar
    const barW=140,barH=6,bx=cx-barW/2,by=boss.y-6;
    ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(ctx,bx,by,barW,barH,3);ctx.fill();
    const hpP=boss.hp/boss.maxHp;
    ctx.fillStyle=boss.phase===3?'#ff0044':c.color;
    ctx.shadowColor=boss.phase===3?'#ff0044':c.glow;ctx.shadowBlur=8;
    roundRect(ctx,bx,by,barW*hpP,barH,3);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.15)';roundRect(ctx,bx+2,by+1,Math.max(0,barW*hpP-4),2,2);ctx.fill();

    // Bullets
    for(const b of bossBullets){
        ctx.shadowColor='#ff0044';ctx.shadowBlur=15;
        const bg=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.r);
        bg.addColorStop(0,'#fff');bg.addColorStop(0.3,'#ff0044');bg.addColorStop(1,'#880022');
        ctx.fillStyle=bg;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
    }
}
```

- [ ] **Step 2: Integrate into draw**

In the `draw` function, after `drawBricks()`, add:
```javascript
    if(isBossLevel(level)&&boss)drawBoss();
```

And for boss BG tint, in `drawBG` function before drawing stars:
```javascript
    if(boss&&bossBGAlpha>0){ctx.fillStyle=`rgba(0,0,0,${bossBGAlpha*0.15})`;ctx.fillRect(0,0,W,H)}
```

---

### Task 5: Boss Collision

**Files:** Modify `game.js`

- [ ] **Step 1: Add `bossBallCollision` function**

```javascript
function bossBallCollision(ball){
    if(!boss)return false;
    // Shield collision
    for(const s of bossShields){
        if(!s.alive)continue;
        const{hit}=cRect(ball.x,ball.y,ball.r,s.x,s.y,s.w,s.h);
        if(hit){
            if(!activeEffects['F']){const dx=ball.x-(s.x+s.w/2),dy=ball.y-(s.y+s.h/2);if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
            s.hp--;if(s.hp<=0){s.alive=false;spawnParticles(s.x+s.w/2,s.y+s.h/2,'#ff00aa',15)}else{spawnParticles(s.x+s.w/2,s.y+s.h/2,'#fff',6)}
            return true;
        }
    }
    // Boss body collision (only phase 2+)
    if(boss.phase>=2){
        const{hit}=cRect(ball.x,ball.y,ball.r,boss.x,boss.y,boss.w,boss.h);
        if(hit){
            if(!activeEffects['F']){const dx=ball.x-(boss.x+boss.w/2),dy=ball.y-(boss.y+boss.h/2);if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
            boss.hp--;bossHitFlash=200;
            spawnParticles(ball.x,ball.y,BOSS_CFG[boss.idx].color,20);
            if(boss.hp<=0){
                sfx.play('levelup');
                const c=BOSS_CFG[boss.idx];score+=c.score;
                spawnParticles(boss.x+boss.w/2,boss.y+boss.h/2,c.color,80);
                spawnScorePopup(W/2,boss.y+30,'BOSS DEFEATED! +'+c.score,c.color);
                if(boss.idx===3){addScore(score);bgm.stop();state=STATE.WIN;return}
                boss=null;bossBullets=[];bossShields=[];level++;levelEl.textContent=level;
                transTimer=400;transAlpha=0;state=STATE.TRANSITION;
                return true;
            }
            if(activeEffects['B']&&boss.phase>=2){
                for(const s of bossShields){if(s.alive){s.alive=false;spawnParticles(s.x+s.w/2,s.y+s.h/2,'#ff4400',12)}}
            }
            return true;
        }
    }
    return false;
}
```

- [ ] **Step 2: Bullet-Paddle collision**

Add to `update` function after ball loop:
```javascript
    for(let i=bossBullets.length-1;i>=0;i--){
        const b=bossBullets[i];
        const{hit}=cRect(b.x,b.y,b.r,paddle.x,paddle.y,paddle.w,paddle.h);
        if(hit){bossBullets.splice(i,1);triggerShake(4,150);lives--;comboCount=0;updateUI();if(lives<=0){triggerShake(6,400);sfx.play('gameover');bgm.stop();addScore(score);state=STATE.GAMEOVER;return}resetBall(true);return}
    }
```

- [ ] **Step 3: Bullet-Ball collision**

In `ballBrickCollision` or add new check in ball loop:
In the ball loop, after `ballBrickCollision(b)`, add:
```javascript
        if(isBossLevel(level)){bossBallCollision(b);continue}
```

Actually better: modify the ball loop to check boss collision. In the update function, ball loop, after `ballBrickCollision(b)`:
```javascript
        ballPaddleCollision(b);ballBrickCollision(b);
        if(isBossLevel(level))bossBallCollision(b);
```

---

### Task 6: Level Flow Integration

**Files:** Modify `game.js`

- [ ] **Step 1: Modify `buildLevel` for boss detection**

```javascript
function buildLevel(lvl){
    if(isBossLevel(lvl)){initBoss(getBossIndex(lvl));return []}
    const idx=getNormalLevelIndex(lvl);
    const g=LG[idx](),cols=g[0].length,rows=g.length;
    // ... rest same
}
function getNormalLevelIndex(lvl){
    if(lvl<=4)return lvl-1;
    if(lvl<=8)return lvl-2;
    if(lvl<=11)return lvl-3;
    return lvl-4;
}
```

- [ ] **Step 2: Modify `resetGame`**

Change initial lives count and level 1 build remains same:
```javascript
function resetGame(){const c=DIFF_CFG[diff];score=0;lives=c.lives;level=1;paddle.defaultW=c.pw;comboCount=0;particles=[];powerups=[];scorePopups=[];boss=null;bossBullets=[];bossShields=[];activeEffects={};keys.left=false;keys.right=false;updateUI();resetPaddle();bricks=buildLevel(1);resetBall(true)}
```

- [ ] **Step 3: Modify level-up flow**

In `update`, change the `if(bricks.every(b=>!b.alive))` block:
```javascript
    if(bricks.every(b=>!b.alive)&&!isBossLevel(level)){
        sfx.play('levelup');level++;levelEl.textContent=level;
        if(level%3===1&&level>1&&!isBossLevel(level))bgm.switch();
        transTimer=400;transAlpha=0;state=STATE.TRANSITION;
    }
```

And in transition handler, when building new level, handle boss:
The transition already calls `bricks=buildLevel(level)`. Since `buildLevel` now handles boss detection, this should work. But need to also clear boss state when transitioning out of a boss level.

Actually, let me reconsider. The flow for boss levels:
1. Player enters boss level → `buildLevel` calls `initBoss`, returns empty bricks array
2. Player fights boss
3. Boss killed → boss collision handler sets state to TRANSITION or WIN
4. Transition: builds next level

For normal levels:
1. Player enters level → `buildLevel` returns bricks
2. Player clears bricks
3. `bricks.every(b=>!b.alive)` triggers level++
4. Transition builds next level

The WIN condition stays: boss 4 killed → WIN.

Let me also handle the case where `bricks.every(b=>!b.alive)` is true during boss levels (bricks array is empty, so `every` returns true). I need to skip that check during boss levels.

- [ ] **Step 4: Modify transition display for boss levels**

In the draw function, transition overlay:
```javascript
    if(state===STATE.TRANSITION&&transAlpha>0){
        ctx.fillStyle=`rgba(0,0,0,${transAlpha*0.6})`;ctx.fillRect(0,0,W,H);
        ctx.fillStyle=`rgba(0,240,255,${transAlpha*0.8})`;ctx.font='700 32px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#00f0ff';ctx.shadowBlur=40*transAlpha;
        const isBoss=isBossLevel(level);
        ctx.fillText(isBoss?`⚠ BOSS 来袭`:`第 ${level} 关`,W/2,H/2-30);
        ctx.fillStyle=`rgba(255,255,255,${transAlpha*0.5})`;ctx.font='600 18px Rajdhani,sans-serif';ctx.shadowBlur=0;
        ctx.fillText(isBoss?BOSS_CFG[getBossIndex(level)].name:(LN[getNormalLevelIndex(level)]||'FINAL'),W/2,H/2+20);
    }
```

Also modify the level name in LN array since levels have shifted. Actually, LN stays at 10 entries, referenced via `getNormalLevelIndex`.

---

### Task 7: Polish & Edge Cases

**Files:** Modify `game.js`

- [ ] **Step 1: Ensure `state===STATE.PLAYING` check works during boss**

The `update` function's `if(state!==STATE.PLAYING)return;` check needs to work properly. During boss level, state is STILL PLAYING (boss collision handler changes state to WIN or TRANSITION). The boss killed flow already handles this.

- [ ] **Step 2: Handle boss during pause**

The existing `togglePause` stops bgm and sets state to PAUSED. When resuming, boss update resumes naturally. No changes needed.

- [ ] **Step 3: Verify BOSS_AT_LEVEL and level count**

The maximum level is now 14 (10 normal + 4 boss). The WIN check should be when boss with idx 3 is killed, not when level > 14.
Remove the original `if(level>10)` check in transition handler and rely on boss kill → WIN.

- [ ] **Step 4: Syntax check**

```bash
node -e "const fs=require('fs');const src=fs.readFileSync('game.js','utf8');try{new Function(src);console.log('OK')}catch(e){console.log(e.message)}"
```
