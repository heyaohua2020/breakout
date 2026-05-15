/* ============================================
   霓虹突破 NEON BREAK — v7 赛博朋克版
   ============================================ */

/* ---------- DOM ---------- */
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score');
const livesEl=document.getElementById('lives');
const levelEl=document.getElementById('level');
const startBtn=document.getElementById('startBtn');
const pauseBtn=document.getElementById('pauseBtn');
const diffBtns=document.querySelectorAll('.diff-btn');
const W=800,H=600;

/* ---------- 状态 ---------- */
const STATE={MENU:0,PLAYING:1,PAUSED:2,GAMEOVER:3,WIN:4,TRANSITION:5};
let state=STATE.MENU;
let transTimer=0,transAlpha=0;
const paddle={x:0,y:570,w:120,h:14,defaultW:120,speed:8,color:'#00f0ff'};
let balls=[],score=0,lives=3,level=1,bricks=[],particles=[];
let comboCount=0,lastComboTime=0,animFrameId=null;
const keys={left:false,right:false};
let scorePopups=[];
let boss=null,bossBullets=[],bossShields=[],bossPhase=1,bossHitFlash=0,bossBGAlpha=0;
const DIFF={EASY:0,NORMAL:1,HARD:2};
let diff=DIFF.NORMAL;

/* ---------- 霓虹背景 ---------- */
let bgStars=[];
function initBG(){bgStars=Array.from({length:80},()=>({x:Math.random()*W,y:Math.random()*H,s:0.5+Math.random()*2,sp:0.1+Math.random()*0.4,b:0.3+Math.random()*0.7}))}
initBG();
function drawBG(){
    ctx.fillStyle='#070713';ctx.fillRect(0,0,W,H);
    if(boss&&bossBGAlpha>0){ctx.fillStyle=`rgba(0,0,0,${bossBGAlpha*0.15})`;ctx.fillRect(0,0,W,H)}
    // Stars
    for(const s of bgStars){
        s.y+=s.sp*0.5;if(s.y>H){s.y=-2;s.x=Math.random()*W}
        ctx.globalAlpha=s.b*0.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=s.b*0.15;ctx.fillStyle='#00f0ff';ctx.beginPath();ctx.arc(s.x,s.y,s.s*3,0,Math.PI*2);ctx.fill()
    }
    ctx.globalAlpha=1;
}

/* ---------- 屏幕震动 ---------- */
let shakeTime=0,shakeIntensity=0;
function triggerShake(i,d){shakeIntensity=i;shakeTime=d;}
function updateShake(){if(shakeTime<=0)return;shakeTime-=16;}

/* ---------- 排行榜 ---------- */
function getScores(){try{return JSON.parse(localStorage.getItem('breakout_scores'))||[]}catch(e){return[]}}
function addScore(s){
    const l=getScores();l.push({score:s,level:level,date:new Date().toLocaleDateString()});
    l.sort((a,b)=>b.score-a.score);if(l.length>15)l.length=15;
    try{localStorage.setItem('breakout_scores',JSON.stringify(l))}catch(e){}
}
function drawScores(x,y,w=160){
    const list=getScores();if(!list.length)return;
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle='rgba(0,240,255,0.35)';ctx.font='600 12px Rajdhani,sans-serif';
    ctx.fillText('— HIGH SCORES —',x,y);
    const maxShow=Math.min(list.length,15),start=Math.max(0,list.length-maxShow);
    for(let i=start;i<list.length;i++){
        const s=list[i],rank=i+1,idx=i-start;
        const c=rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'rgba(255,255,255,0.25)';
        ctx.fillStyle=c;
        const isTop=rank<=3;
        ctx.font=isTop?'700 13px Rajdhani,sans-serif':'500 12px Rajdhani,sans-serif';
        ctx.shadowColor=c;ctx.shadowBlur=isTop?8:0;
        const label=`#${rank}  ${s.score}`;
        ctx.fillText(label,x,y+16+idx*16);
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.12)';ctx.font='500 10px Rajdhani,sans-serif';
        ctx.fillText(`LV${s.level}`,x+w-30,y+16+idx*16);
    }
}

/* ---------- 砖块类型 ---------- */
const B={NONE:0,NORMAL:1,METAL:2,BOMB:3,REWARD:4,INVISIBLE:5,BOSS:6};
const BC={[B.NORMAL]:'#ff5577',[B.METAL]:'#6a8aaa',[B.BOMB]:'#bb55ff',[B.REWARD]:'#44ffaa',[B.INVISIBLE]:'#ffaa44'};
const BH={[B.NORMAL]:1,[B.METAL]:3,[B.BOMB]:1,[B.REWARD]:1,[B.INVISIBLE]:2};
const BS={[B.NORMAL]:10,[B.METAL]:30,[B.BOMB]:15,[B.REWARD]:10,[B.INVISIBLE]:15};
const BNAMES={[B.NORMAL]:'标准',[B.METAL]:'合金',[B.BOMB]:'爆弹',[B.REWARD]:'奖励',[B.INVISIBLE]:'幻影'};
const BGLOW={[B.NORMAL]:'#ff5577',[B.METAL]:'#6a8aaa',[B.BOMB]:'#bb55ff',[B.REWARD]:'#44ffaa',[B.INVISIBLE]:'#ffaa44'};

/* ---------- 道具 ---------- */
const PU=[
    {id:'W',name:'WIDTH+',color:'#00f0ff',duration:12000,type:'buff'},
    {id:'M',name:'MULTI',color:'#ff00aa',duration:0,type:'buff'},
    {id:'F',name:'PIERCE',color:'#ff4400',duration:12000,type:'buff'},
    {id:'S',name:'SLOW',color:'#ffd700',duration:12000,type:'buff'},
    {id:'H',name:'HP+1',color:'#ff0055',duration:0,type:'buff'},
    {id:'G',name:'STICKY',color:'#aa44ff',duration:12000,type:'buff'},
    {id:'N',name:'NARROW',color:'#ff8800',duration:12000,type:'debuff'},
    {id:'E',name:'SPEED',color:'#39ff14',duration:12000,type:'debuff'},
    {id:'B',name:'FIRE',color:'#ff4400',duration:12000,type:'buff'},
    {id:'I',name:'ICE',color:'#3388ff',duration:12000,type:'buff'},
];
let powerups=[],activeEffects={};

/* ---------- BGM ---------- */
const bgm={
    ctx:null,loopId:null,on:false,idx:-1,melodies:[
        {seq:[[262,0.25],[294,0.25],[330,0.25],[392,0.5],[349,0.25],[330,0.25],[294,0.25],[262,0.5],[294,0.25],[349,0.25],[440,0.25],[523,0.5],[440,0.25],[349,0.25],[294,0.25],[262,0.5]],bass:[[131,0.5],[131,0.5],[175,0.5],[175,0.5],[165,0.5],[165,0.5],[131,0.5],[131,0.5]],dur:4400},
        {seq:[[294,0.25],[330,0.25],[392,0.25],[523,0.5],[494,0.25],[440,0.25],[392,0.25],[294,0.5],[330,0.25],[392,0.25],[523,0.25],[587,0.5],[523,0.25],[392,0.25],[330,0.25],[294,0.5]],bass:[[147,0.5],[147,0.5],[196,0.5],[196,0.5],[175,0.5],[175,0.5],[165,0.5],[165,0.5]],dur:4400},
        {seq:[[349,0.3],[392,0.3],[440,0.3],[523,0.6],[494,0.3],[440,0.3],[392,0.3],[349,0.6],[392,0.3],[440,0.3],[523,0.3],[659,0.6],[587,0.3],[523,0.3],[440,0.3],[349,0.6]],bass:[[175,0.6],[175,0.6],[220,0.6],[220,0.6],[196,0.6],[196,0.6],[175,0.6],[175,0.6]],dur:5200},
        {seq:[[262,0.3],[294,0.3],[330,0.3],[523,0.6],[440,0.3],[392,0.3],[330,0.3],[262,0.6],[330,0.3],[392,0.3],[523,0.3],[659,0.6],[523,0.3],[392,0.3],[330,0.3],[262,0.6]],bass:[[131,0.6],[131,0.6],[165,0.6],[165,0.6],[175,0.6],[175,0.6],[165,0.6],[165,0.6]],dur:5200},
    ],
    _note(f,d,t){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.07,this.ctx.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+t+d);o.connect(g);g.connect(this.ctx.destination);o.start(this.ctx.currentTime+t);o.stop(this.ctx.currentTime+t+d+0.05)},
    _bass(f,d,t){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=f/2;g.gain.setValueAtTime(0.12,this.ctx.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+t+d);o.connect(g);g.connect(this.ctx.destination);o.start(this.ctx.currentTime+t);o.stop(this.ctx.currentTime+t+d+0.05)},
    _pick(){let i;do{i=Math.floor(Math.random()*this.melodies.length)}while(i===this.idx&&this.melodies.length>1);this.idx=i},
    _play(){if(!this.on)return;const m=this.melodies[this.idx],n=this.ctx.currentTime;let t=0;for(let i=0;i<m.seq.length;i++){this._note(m.seq[i][0],m.seq[i][1],t);t+=m.seq[i][1]}t=0;for(let i=0;i<m.bass.length;i++){this._bass(m.bass[i][0],m.bass[i][1],t);t+=m.bass[i][1]}this.loopId=setTimeout(()=>this._play(),m.dur)},
    start(){if(!sfx.ctx){sfx.init()}this.ctx=sfx.ctx;if(!this.ctx||this.on)return;this.on=true;if(this.idx<0)this._pick();this._play()},
    switch(){if(!this.ctx||!this.on)return;this._pick();this.stop();this.on=true;this._play()},
    stop(){this.on=false;if(this.loopId){clearTimeout(this.loopId);this.loopId=null}},
};

/* ---------- 音效 ---------- */
const sfx={
    ctx:null,
    init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}},
    _osc(t,f,ef,d,v=0.3){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=t;o.frequency.setValueAtTime(f,this.ctx.currentTime);if(ef!==undefined)o.frequency.linearRampToValueAtTime(ef,this.ctx.currentTime+d);g.gain.setValueAtTime(v,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+d);o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d+0.05)},
    play(t){if(!this.ctx)return;switch(t){case'paddle':this._osc('triangle',220,160,0.07,0.35);break;case'wall':this._osc('sine',520,380,0.04,0.12);break;case'break':this._osc('triangle',620,880,0.08,0.25);break;case'hit':this._osc('sine',380,420,0.05,0.15);break;case'lose':this._osc('sine',400,100,0.35,0.3);break;case'levelup':[523,659,784].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;const t=this.ctx.currentTime+i*0.15;g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+0.15);});break;case'gameover':this._osc('sawtooth',350,60,0.8,0.3);break;case'combo':this._osc('square',500+Math.min(comboCount,10)*50,0,0.08,0.2);break;case'powerup':this._osc('sine',600,900,0.15,0.2);break}},
};

/* ---------- 球 ---------- */
function createBall(x,y,dx,dy,stuck=true){
    const a={x,y,r:15,dx:dx||0,dy:dy||0,stuck,trail:[]};
    a.aura=Array.from({length:12},(_,i)=>({angle:i/12*Math.PI*2+Math.random()*0.3,radius:24+Math.random()*10,size:1.5+Math.random()*3,speed:0.6+Math.random()*0.6,phase:Math.random()*Math.PI*2}));
    return a;
}
function resetBall(stick=true){
    balls=[createBall(paddle.x+paddle.w/2,paddle.y-10)];
    const b=balls[0];b.stuck=stick;
    if(!stick){const a=-Math.PI/2+(Math.random()-0.5)*1.2,s=5+(level-1)*0.3;b.dx=Math.cos(a)*s;b.dy=Math.sin(a)*s;b.trail=[];}
}

/* ---------- 关卡布局 ---------- */
const LN=[
    '霓虹初现','信号干扰','钢铁防线','合金堡垒',
    '幽灵频率','幻影矩阵','连锁反应','爆破专家',
    '万花筒','终极代码'
];

const LG=[
    // 1: 霓虹初现 — 全 NORMAL
    ()=>[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],
    // 2: 信号干扰 — NORMAL + REWARD 菱形
    ()=>[[0,0,0,0,4,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,4,1,4,1,1,0],[1,1,1,1,1,1,1,1,1]],
    // 3: 钢铁防线 — METAL 堡垒
    ()=>[[0,0,0,0,2,0,0,0,0],[0,0,0,2,1,2,0,0,0],[0,0,2,1,1,1,2,0,0],[0,0,0,2,1,2,0,0,0],[0,0,0,0,2,0,0,0,0]],
    // 4: 合金堡垒 — METAL + NORMAL 棋盘
    ()=>{const g=Array.from({length:6},()=>Array(10).fill(0));for(let r=0;r<6;r++)for(let c=0;c<10;c++)g[r][c]=(r+c)%2===0?1:2;g[0][4]=4;g[5][5]=4;return g;},
    // 5: 幽灵频率 — INVISIBLE 引入
    ()=>{const g=Array.from({length:6},()=>Array(11).fill(0));for(let r=0;r<6;r++){const s=5-Math.floor(r/1.5),e=5+Math.floor(r/1.5);for(let c=s;c<=e;c++)g[r][c]=1}g[0][5]=5;g[2][3]=5;g[2][7]=5;g[4][5]=5;g[5][2]=4;g[5][8]=4;return g;},
    // 6: 幻影矩阵 — INVISIBLE 密集
    ()=>{const g=Array.from({length:6},()=>Array(11).fill(0));for(let r=0;r<6;r++)for(let c=0;c<11;c++){const d=Math.abs(c-5);if(d<=2+r&&d>=Math.abs(r-2))g[r][c]=1}g[0][5]=5;g[5][5]=5;g[1][3]=5;g[1][7]=5;g[3][2]=5;g[3][8]=5;g[4][5]=5;g[2][5]=4;g[5][3]=4;g[5][7]=4;return g;},
    // 7: 连锁反应 — BOMB 乐园
    ()=>{const g=Array.from({length:7},()=>Array(12).fill(0));for(let r=0;r<7;r++){const s=r*2,e=11-r;for(let c=s;c<=e;c++)g[r][c]=1}g[0][5]=3;g[1][4]=3;g[1][7]=3;g[2][3]=3;g[2][8]=3;g[3][5]=3;g[3][6]=3;g[4][2]=3;g[4][9]=3;g[5][4]=3;g[5][7]=3;g[6][5]=3;return g;},
    // 8: 爆破专家 — BOMB + METAL + INVISIBLE 复合
    ()=>{const g=Array.from({length:7},()=>Array(13).fill(0));for(let c=0;c<13;c++){g[0][c]=1;g[6][c]=1}for(let r=1;r<6;r++){g[r][0]=1;g[r][12]=1}for(let r=2;r<5;r++){g[r][3]=1;g[r][9]=1}for(let c=4;c<9;c++)g[3][c]=1;g[0][2]=2;g[0][10]=2;g[6][2]=2;g[6][10]=2;g[1][1]=3;g[1][11]=3;g[5][1]=3;g[5][11]=3;g[2][5]=3;g[4][7]=3;g[0][6]=5;g[6][6]=5;g[3][0]=4;g[3][12]=4;return g;},
    // 9: 万花筒 — 全类型密集
    ()=>{const g=Array.from({length:8},()=>Array(14).fill(0));for(let r=1;r<7;r++)for(let c=1;c<13;c++){if(r%2===0&&c%2===0)g[r][c]=2;else if(r%3===0&&c%3===0)g[r][c]=3;else if(r===1&&c%4===0)g[r][c]=4;else if(c===1&&r%3===0)g[r][c]=5;else g[r][c]=1}g[0][3]=5;g[0][10]=5;g[7][3]=5;g[7][10]=5;g[3][7]=3;g[4][6]=3;g[1][7]=4;g[6][6]=4;return g;},
    // 10: 终极代码 — 最大密度最终关
    ()=>{const g=Array.from({length:8},()=>Array(14).fill(1));for(let r=0;r<8;r++)for(let c=0;c<14;c++){if((r===0||r===7)&&c%2===0)g[r][c]=2;if((r===1||r===6)&&(c===1||c===12))g[r][c]=5}for(const p of[[2,2],[2,11],[5,2],[5,11]])g[p[0]][p[1]]=3;for(const p of[[2,6],[2,7],[5,6],[5,7]])g[p[0]][p[1]]=4;g[0][6]=5;g[7][7]=5;g[3][4]=3;g[3][9]=3;g[4][3]=3;g[4][10]=3;return g;},
];

function createBrick(x,y,w,h,t,sx,sy,bw,bh){
    const st=t!==B.INVISIBLE,isInvis=t===B.INVISIBLE;
    return{x,y,w,h,type:t,color:BC[t],alive:true,hp:BH[t]||1,
        visible:st,startX:sx,startY:sy,bw,bh,
        glowPulse:Math.random()*Math.PI*2,
        revealed:!isInvis,
        flashTime:0};
}
function getNormalLevelIndex(lvl){
    if(lvl<=4)return lvl-1;
    if(lvl<=8)return lvl-2;
    if(lvl<=11)return lvl-3;
    return lvl-4;
}
function isBossLevel(lvl){return lvl in BOSS_AT_LEVEL}
function getBossIndex(lvl){return BOSS_AT_LEVEL[lvl]}
function initBoss(idx){
    const c=BOSS_CFG[idx];
    boss={idx,x:W/2-60,y:50,w:120,h:80,hp:c.hp,maxHp:c.hp,dir:1,phase:1,lastShot:0,score:c.score};
    bossShields=[];bossBullets=[];bossPhase=1;bossHitFlash=0;bossBGAlpha=0;
    for(let i=0;i<c.shields;i++){const angle=i/c.shields*Math.PI*2;bossShields.push({offX:Math.cos(angle)*60,offY:Math.sin(angle)*40,w:50,h:20,hp:2,alive:true,angle,x:0,y:0})}
}
function buildLevel(lvl){
    if(isBossLevel(lvl)){initBoss(getBossIndex(lvl));return[]}
    const idx=getNormalLevelIndex(lvl);
    const g=LG[idx](),cols=g[0].length,rows=g.length;
    const bw=Math.min(68,Math.floor((W-40)/cols)-4),bh=20,gap=4;
    const ox=(W-(cols*(bw+gap)-gap))/2,oy=42;
    const list=[];
    const c=DIFF_CFG[diff];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        if(g[r][c]===B.NONE)continue;
        const b=createBrick(ox+c*(bw+gap),oy+r*(bh+gap),bw,bh,g[r][c],ox,oy,bw,bh);
        if(b.type===B.METAL)b.hp=c.mhpBase+Math.floor(lvl/c.mhpDiv);list.push(b);
    }
    return list;
}

/* ---------- 粒子 (霓虹版) ---------- */
function spawnParticles(x,y,color,c=18,glow=true){
    for(let i=0;i<c;i++){const a=Math.random()*Math.PI*2,s=1.5+Math.random()*4;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.012+Math.random()*0.028,size:2+Math.random()*6,color,glow,rot:Math.random()*Math.PI*2,rv:(Math.random()-0.5)*0.1})}
}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.04;p.life-=p.decay;p.rot+=p.rv;if(p.life<=0)particles.splice(i,1)}}
function drawParticles(){
    for(const p of particles){
        ctx.globalAlpha=p.life;
        if(p.glow&&p.life>0.3){ctx.shadowColor=p.color;ctx.shadowBlur=15*p.life}
        ctx.fillStyle=p.color;
        const s=p.size*p.life;
        ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
}

/* ---------- 分数弹出 ---------- */
function spawnScorePopup(x,y,text,color='#ffd700'){
    scorePopups.push({x,y,text,color,vy:-2,life:1,decay:0.018});
}
function updateScorePopups(){for(let i=scorePopups.length-1;i>=0;i--){const p=scorePopups[i];p.y+=p.vy;p.life-=p.decay;if(p.life<=0)scorePopups.splice(i,1)}}
function drawScorePopups(){for(const p of scorePopups){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.font='700 18px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=p.color;ctx.shadowBlur=20*p.life;ctx.fillText(p.text,p.x,p.y);ctx.shadowBlur=0}ctx.globalAlpha=1}

/* ---------- 道具逻辑 ---------- */
function spawnPowerup(x,y){if(Math.random()>0.25)return;const t=PU[Math.floor(Math.random()*PU.length)];powerups.push({x,y,type:t,vy:2,wobble:0,wobbleSpeed:2+Math.random()*2});}
function updatePowerups(){for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];p.y+=p.vy;p.wobble+=p.wobbleSpeed;p.x+=Math.sin(p.wobble*0.05)*0.3;if(p.y+14>=paddle.y&&p.y-14<=paddle.y+paddle.h&&p.x>=paddle.x-4&&p.x<=paddle.x+paddle.w+4){activateEffect(p.type);powerups.splice(i,1);continue}if(p.y>H+20)powerups.splice(i,1);}}
function drawPowerups(){
    for(const p of powerups){const cx=p.x,cy=p.y;
        ctx.shadowColor=p.type.color;ctx.shadowBlur=25;
        const g=ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,14);
        g.addColorStop(0,'#fff');g.addColorStop(0.3,p.type.color);g.addColorStop(1,'rgba(0,0,0,0.5)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,14,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font='700 12px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.type.id,cx,cy+1);
        ctx.fillStyle='rgba(0,240,255,0.15)';ctx.font='10px Rajdhani,sans-serif';ctx.fillText(p.type.name,cx,cy+18);
    }
}
const CONFLICTS={'S':'E','E':'S','B':'I','I':'B','W':'N','N':'W'};
function cancelEffect(id){
    if(!activeEffects[id])return;
    _applyEffect(id,false);delete activeEffects[id];
}
const STACK_INCR=0.3,STACK_MAX=5;
function _stackWidth(id,stacks){
    if(id==='W')return paddle.defaultW*Math.min(1+STACK_INCR*stacks,1+STACK_INCR*STACK_MAX);
    if(id==='N')return paddle.defaultW*Math.max(1-STACK_INCR*0.5*stacks,0.4);
    return paddle.defaultW;
}
function activateEffect(t){
    sfx.play('powerup');
    if(t.id==='H'){lives=Math.min(lives+1,9);updateUI();spawnParticles(paddle.x+paddle.w/2,paddle.y,'#ff0055',30);return}
    if(t.id==='M'){const cur=balls.filter(b=>!b.stuck);for(const b of cur)for(let i=0;i<9;i++){const a=Math.atan2(b.dy,b.dx)+(i/9-0.5)*1.2,s=Math.sqrt(b.dx*b.dx+b.dy*b.dy);if(s>0.1)balls.push(createBall(b.x,b.y,Math.cos(a)*s,Math.sin(a)*s,false))}spawnParticles(paddle.x+paddle.w/2,paddle.y,'#ff00aa',30);return}
    if(t.duration>0){
        const conflict=CONFLICTS[t.id];
        if(conflict&&activeEffects[conflict])cancelEffect(conflict);
        if(activeEffects[t.id]){
            const ef=activeEffects[t.id];
            if(ef.stacks<STACK_MAX){ef.stacks++;paddle.w=_stackWidth(t.id,ef.stacks);if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;if(paddle.x<0)paddle.x=0}
            ef.endTime+=t.duration;if(ef.endTime-Date.now()>60000)ef.endTime=Date.now()+60000;
            spawnParticles(paddle.x+paddle.w/2,paddle.y,t.color,12);return
        }
        activeEffects[t.id]={endTime:Date.now()+t.duration,stacks:1,...t};_applyEffect(t.id,true)
    }
}
function _applyEffect(id,a){
    switch(id){case'W':paddle.w=a?_stackWidth('W',activeEffects.W?activeEffects.W.stacks:1):paddle.defaultW;break;case'N':paddle.w=a?_stackWidth('N',activeEffects.N?activeEffects.N.stacks:1):paddle.defaultW;break;case'S':balls.forEach(b=>{if(!b.stuck){b.dx*=a?0.5:2;b.dy*=a?0.5:2}});break;case'E':balls.forEach(b=>{if(!b.stuck){b.dx*=a?1.6:0.625;b.dy*=a?1.6:0.625}});break}
    if(id==='W'||id==='N'){if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;if(paddle.x<0)paddle.x=0}
}
function updateActiveEffects(){const n=Date.now();for(const id in activeEffects){const ef=activeEffects[id];if(n<ef.endTime)continue;if((id==='W'||id==='N')&&ef.stacks>1){ef.stacks--;ef.endTime=n+ef.duration;paddle.w=_stackWidth(id,ef.stacks);if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;if(paddle.x<0)paddle.x=0}else{_applyEffect(id,false);delete activeEffects[id]}}}
function drawActiveEffects(){const list=Object.values(activeEffects);if(!list.length)return;let ox=10;for(const ef of list){const r=Math.max(0,ef.endTime-Date.now()),p=r/ef.duration;ctx.fillStyle='rgba(0,0,0,0.6)';roundRect(ctx,ox,8,80,18,4);ctx.fill();ctx.fillStyle=ef.color;roundRect(ctx,ox+2,10,76*p,14,3);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 10px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const label=ef.stacks>1?ef.id+'×'+ef.stacks:ef.id;ctx.fillText(label+' '+(r/1000).toFixed(1)+'s',ox+40,17);ox+=86}}

/* ---------- 碰撞 ---------- */
function cRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh));const dx=cx-nx,dy=cy-ny;return{hit:dx*dx+dy*dy<cr*cr,nx,ny}}
function ballPaddleCollision(b){
    const{hit,nx}=cRect(b.x,b.y,b.r,paddle.x,paddle.y,paddle.w,paddle.h);
    if(!hit)return false;
    if(activeEffects['G']){b.stuck=true;b.x=paddle.x+paddle.w/2;b.y=paddle.y-b.r-1;b.dx=0;b.dy=0;sfx.play('paddle');spawnParticles(b.x,paddle.y,'#aa44ff',8);return true}
    const hp=(b.x-paddle.x)/paddle.w,angle=(hp-0.5)*Math.PI*0.7,spd=Math.sqrt(b.dx*b.dx+b.dy*b.dy);
    b.dx=Math.sin(angle)*spd;b.dy=-Math.cos(angle)*spd;b.y=paddle.y-b.r-1;
    sfx.play('paddle');spawnParticles(b.x,paddle.y,'#00f0ff',8);return true;
}
function bombExplode(b){
    const col=Math.round((b.x-b.startX)/(b.bw+4)),row=Math.round((b.y-b.startY)/(b.bh+4));
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(dr===0&&dc===0)continue;for(const bk of bricks){if(!bk.alive)continue;const bc=Math.round((bk.x-b.startX)/(b.bw+4)),br=Math.round((bk.y-b.startY)/(b.bh+4));if(br===row+dr&&bc===col+dc&&bk!==b){bk.alive=false;spawnParticles(bk.x+bk.w/2,bk.y+bk.h/2,'#aa00ff',20)}}}
    triggerShake(10,300);spawnParticles(b.x+b.w/2,b.y+b.h/2,'#cc44ff',50);
}
function fireExplode(b){
    for(const bk of bricks){
        if(!bk.alive||bk===b)continue;
        const dc=Math.round((bk.x-b.x)/(bk.bw+4)),dr=Math.round((bk.y-b.y)/(bk.bh+4));
        if(Math.abs(dc)>2||Math.abs(dr)>2||(dc===0&&dr===0))continue;
        if(bk.type===B.BOMB)bombExplode(bk);
        spawnPowerup(bk.x+bk.w/2,bk.y+bk.h/2);bk.alive=false;
        comboCount++;score+=BS[bk.type]||10;
        spawnParticles(bk.x+bk.w/2,bk.y+bk.h/2,'#ff4400',20);
    }
    triggerShake(8,200);spawnParticles(b.x+b.w/2,b.y+b.h/2,'#ff4400',45);sfx.play('break');
}
function freezeBricks(b){
    for(const bk of bricks){
        if(!bk.alive||bk===b)continue;
        const dc=Math.round((bk.x-b.x)/(bk.bw+4)),dr=Math.round((bk.y-b.y)/(bk.bh+4));
        if(Math.abs(dc)>1||Math.abs(dr)>1||(dc===0&&dr===0))continue;
        bk.hp=1;bk.color='#00d4ff';bk.frozen=true;
        spawnParticles(bk.x+bk.w/2,bk.y+bk.h/2,'#80deea',8);
    }
    spawnParticles(b.x+b.w/2,b.y+b.h/2,'#00d4ff',30);sfx.play('hit');
}
function ballBrickCollision(ball){
    for(const brick of bricks){
        if(!brick.alive)continue;
        if(brick.type===B.INVISIBLE&&!brick.visible){
            const{hit}=cRect(ball.x,ball.y,ball.r,brick.x,brick.y,brick.w,brick.h);
            if(hit){
                if(activeEffects['B']){brick.alive=false;spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#ff4400',20);fireExplode(brick);const dx=ball.x-brick.x-brick.w/2,dy=ball.y-brick.y-brick.h/2;if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy;return true}
                if(activeEffects['I']){brick.alive=false;spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#80deea',20);freezeBricks(brick);const dx=ball.x-brick.x-brick.w/2,dy=ball.y-brick.y-brick.h/2;if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy;return true}
                brick.visible=true;brick.color='#ff8800';brick.revealed=true;brick.flashTime=300;
                spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#ff8800',15);
                const dx=ball.x-brick.x-brick.w/2,dy=ball.y-brick.y-brick.h/2;
                if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy;return true
            }
            continue;
        }
        const{hit,nx,ny}=cRect(ball.x,ball.y,ball.r,brick.x,brick.y,brick.w,brick.h);
        if(!hit)continue;
        if(!activeEffects['F']){const dx=ball.x-nx,dy=ball.y-ny;if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
        if(activeEffects['B'])brick.hp=1;
        if(activeEffects['I']){brick.hp=1;freezeBricks(brick);}
        brick.hp--;
            if(brick.hp<=0){
            brick.alive=false;
            if(brick.type===B.BOMB)bombExplode(brick);else if(brick.type===B.REWARD)spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);else spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);
            sfx.play('break');spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,brick.color,28);
            if(activeEffects['B'])fireExplode(brick);
            const n=Date.now();if(n-lastComboTime<600)comboCount++;else comboCount=1;lastComboTime=n;
            const pts=(BS[brick.type]||10)*Math.min(comboCount,10);
            score+=pts;sfx.play('combo');
            spawnScorePopup(brick.x+brick.w/2,brick.y,'+'+pts,comboCount>=5?'#ff00aa':'#ffd700');
        }else{sfx.play('hit');spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#ffffff',brick.type===B.METAL?10:6);score+=2}
        updateUI();if(!activeEffects['F'])return true;
    }
    return false;
}

/* ---------- 重置 ---------- */
const DIFF_CFG={
    [DIFF.EASY]:{lives:5,pw:130,bs:4,mhpBase:2,mhpDiv:4},
    [DIFF.NORMAL]:{lives:3,pw:120,bs:5,mhpBase:3,mhpDiv:3},
    [DIFF.HARD]:{lives:2,pw:100,bs:6.5,mhpBase:4,mhpDiv:2},
};
const BOSS_AT_LEVEL={5:0,9:1,12:2,14:3};
const BOSS_CFG=[
    {name:'HEX EYES',hp:20,color:'#ff00aa',glow:'#ff00aa',bulletInterval:0,shields:2,speed:1.5,score:500},
    {name:'NEON TITAN',hp:30,color:'#ff4400',glow:'#ff4400',bulletInterval:2000,shields:4,speed:2,score:1000},
    {name:'CYBER WYRM',hp:40,color:'#39ff14',glow:'#39ff14',bulletInterval:1500,shields:3,speed:3,score:2000},
    {name:'VOIDMASTER',hp:60,color:'#00f0ff',glow:'#00f0ff',bulletInterval:1200,shields:4,speed:2.5,score:5000},
];
function resetPaddle(){paddle.w=paddle.defaultW;paddle.x=(W-paddle.w)/2}
function resetGame(){const c=DIFF_CFG[diff];score=0;lives=c.lives;level=1;paddle.defaultW=c.pw;comboCount=0;particles=[];powerups=[];scorePopups=[];boss=null;bossBullets=[];bossShields=[];activeEffects={};keys.left=false;keys.right=false;updateUI();resetPaddle();bricks=buildLevel(1);resetBall(true)}
function updateUI(){scoreEl.textContent=score;livesEl.textContent=lives;levelEl.textContent=level}

/* ---------- 更新 ---------- */
function update(){
    if(state===STATE.TRANSITION){
        transTimer-=16;transAlpha=Math.min(1,transTimer/300);
        if(transTimer<=0){state=STATE.PLAYING;
            bricks=buildLevel(level);resetBall(true);lives=Math.min(lives+1,5);updateUI();
        }
        updateParticles();return;
    }
    if(state!==STATE.PLAYING)return;
    if(keys.left)paddle.x-=paddle.speed;
    if(keys.right)paddle.x+=paddle.speed;
    paddle.x=Math.max(0,Math.min(W-paddle.w,paddle.x));
    for(let i=balls.length-1;i>=0;i--){
        const b=balls[i];
        if(b.stuck){b.x=paddle.x+paddle.w/2;b.y=paddle.y-b.r-1;continue}
        b.x+=b.dx;b.y+=b.dy;b.trail.push({x:b.x,y:b.y});if(b.trail.length>10)b.trail.shift();
        if(b.x-b.r<=0){b.x=b.r;b.dx=-b.dx;sfx.play('wall')}if(b.x+b.r>=W){b.x=W-b.r;b.dx=-b.dx;sfx.play('wall')}if(b.y-b.r<=0){b.y=b.r;b.dy=-b.dy;sfx.play('wall')}
        if(b.y-b.r>H){balls.splice(i,1);continue}
        ballPaddleCollision(b);ballBrickCollision(b);
        if(isBossLevel(level))bossBallCollision(b);
    }
    // Boss bullet-paddle collision
    if(isBossLevel(level)){
        for(let i=bossBullets.length-1;i>=0;i--){
            const bu=bossBullets[i];
            const{hit}=cRect(bu.x,bu.y,bu.r,paddle.x,paddle.y,paddle.w,paddle.h);
            if(hit){bossBullets.splice(i,1);triggerShake(4,150);lives--;comboCount=0;updateUI();if(lives<=0){triggerShake(6,400);sfx.play('gameover');bgm.stop();addScore(score);state=STATE.GAMEOVER;return}resetBall(true);return}
        }
    }
    if(balls.length===0){
        triggerShake(5,200);sfx.play('lose');lives--;comboCount=0;updateUI();
        if(lives<=0){triggerShake(6,400);sfx.play('gameover');bgm.stop();addScore(score);state=STATE.GAMEOVER;return}
        resetBall(true);return;
    }
    if(!isBossLevel(level)&&bricks.every(b=>!b.alive)){
        sfx.play('levelup');level++;levelEl.textContent=level;
        if(level%3===1&&level>1&&!isBossLevel(level))bgm.switch();
        transTimer=400;transAlpha=0;state=STATE.TRANSITION;
    }
    // Brick flash timer
    for(const bk of bricks)if(bk.flashTime>0)bk.flashTime-=16;
    if(isBossLevel(level))updateBoss();
    updatePowerups();updateActiveEffects();updateParticles();updateScorePopups();
}

/* ---------- BOSS 更新 ---------- */
function updateBoss(){
    if(!boss)return;
    const c=BOSS_CFG[boss.idx];
    boss.x+=boss.dir*c.speed;
    if(boss.x<=0||boss.x+boss.w>=W)boss.dir*=-1;
    if(bossShields.every(s=>!s.alive)&&boss.phase===1){boss.phase=2;bossBGAlpha=0.6}
    if(boss.hp<=boss.maxHp*0.5&&boss.phase===2){boss.phase=3;bossBGAlpha=0.8;spawnParticles(boss.x+boss.w/2,boss.y+boss.h/2,c.color,40)}
    if(bossHitFlash>0)bossHitFlash-=16;
    for(const s of bossShields){
        if(!s.alive)continue;
        s.angle+=0.03;
        s.x=boss.x+boss.w/2+Math.cos(s.angle)*60-s.w/2;
        s.y=boss.y+boss.h/2+Math.sin(s.angle)*40-s.h/2;
    }
    if(boss.phase===3&&c.bulletInterval>0){
        const now=Date.now();
        if(now-boss.lastShot>c.bulletInterval){
            boss.lastShot=now;
            const spread=boss.idx>=2?3:1;
            for(let i=0;i<spread;i++){
                const a=Math.PI/2+(i-(spread-1)/2)*0.3,spd=2+Math.random();
                bossBullets.push({x:boss.x+boss.w/2,y:boss.y+boss.h,r:6,dx:Math.cos(a)*spd,dy:Math.sin(a)*spd});
            }
        }
    }
    for(let i=bossBullets.length-1;i>=0;i--){
        const b=bossBullets[i];b.x+=b.dx;b.y+=b.dy;
        if(b.y>H+20||b.x<-20||b.x>W+20){bossBullets.splice(i,1);continue}
    }
    bossBGAlpha=Math.min(bossBGAlpha+0.005,1);
}

/* ---------- BOSS 碰撞 ---------- */
function bossBallCollision(ball){
    if(!boss)return false;
    for(const s of bossShields){
        if(!s.alive)continue;
        const{hit}=cRect(ball.x,ball.y,ball.r,s.x,s.y,s.w,s.h);
        if(hit){
            if(!activeEffects['F']){const dx=ball.x-(s.x+s.w/2),dy=ball.y-(s.y+s.h/2);if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
            s.hp--;if(s.hp<=0){s.alive=false;spawnParticles(s.x+s.w/2,s.y+s.h/2,'#ff00aa',15)}else spawnParticles(s.x+s.w/2,s.y+s.h/2,'#fff',6)
            return true;
        }
    }
    if(boss.phase>=2){
        const{hit}=cRect(ball.x,ball.y,ball.r,boss.x,boss.y,boss.w,boss.h);
        if(hit){
            if(!activeEffects['F']){const dx=ball.x-(boss.x+boss.w/2),dy=ball.y-(boss.y+boss.h/2);if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
            boss.hp--;bossHitFlash=200;
            spawnParticles(ball.x,ball.y,BOSS_CFG[boss.idx].color,20);
            if(boss.hp<=0){
                sfx.play('levelup');const c=BOSS_CFG[boss.idx];score+=c.score;
                spawnParticles(boss.x+boss.w/2,boss.y+boss.h/2,c.color,80);
                spawnScorePopup(W/2,boss.y+30,'BOSS DEFEATED! +'+c.score,c.color);
                if(boss.idx===3){addScore(score);bgm.stop();state=STATE.WIN;return true}
                boss=null;bossBullets=[];bossShields=[];level++;levelEl.textContent=level;
                transTimer=400;transAlpha=0;state=STATE.TRANSITION;return true;
            }
            if(activeEffects['B']&&boss.phase>=2){for(const s of bossShields)if(s.alive){s.alive=false;spawnParticles(s.x+s.w/2,s.y+s.h/2,'#ff4400',12)}}
            return true;
        }
    }
    return false;
}

/* ---------- 绘制砖块 (霓虹版) ---------- */
function drawBricks(){
    const now=Date.now();
    for(const bk of bricks){
        if(!bk.alive||(bk.type===B.INVISIBLE&&!bk.visible))continue;
        let c=bk.color;
        const glow=BGLOW[bk.type]||c;
        bk.glowPulse+=0.04;

        // BOMB pulse
        if(bk.type===B.BOMB){const p=Math.sin(now/250)*0.2+0.8;c=darkenColor(bk.color,1-p)}
        // REWARD shimmer
        if(bk.type===B.REWARD){const p=Math.sin(now/400)*0.15+0.85;c=darkenColor(bk.color,1-p)}

        // INVISIBLE revealed flash effect
        let flashExtra=0;
        if(bk.flashTime>0){flashExtra=bk.flashTime/300}

        // Neon glow outline
        const glowIntensity=bk.type===B.BOMB?0.7:bk.type===B.REWARD?0.5:0.35;
        ctx.shadowColor=glow;ctx.shadowBlur=8+6*Math.sin(now/600+bk.glowPulse)+flashExtra*20;

        // Fill gradient
        const g=ctx.createLinearGradient(bk.x,bk.y,bk.x,bk.y+bk.h);
        g.addColorStop(0,c);
        g.addColorStop(0.5,lightenColor(c,0.2));
        g.addColorStop(1,darkenColor(c,0.3));
        ctx.fillStyle=g;
        roundRect(ctx,bk.x,bk.y,bk.w,bk.h,3);ctx.fill();
        ctx.shadowBlur=0;

        // Neon border
        ctx.strokeStyle=glow;ctx.lineWidth=1.5;
        ctx.globalAlpha=0.3+0.2*Math.sin(now/500+bk.glowPulse)+flashExtra*0.5;
        roundRect(ctx,bk.x,bk.y,bk.w,bk.h,3);ctx.stroke();
        ctx.globalAlpha=1;

        // Top highlight
        ctx.fillStyle='rgba(255,255,255,0.15)';roundRect(ctx,bk.x+2,bk.y+2,bk.w-4,4,2);ctx.fill();

        // Type-specific overlays
        if(bk.type===B.METAL&&bk.hp>0){
            ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='700 9px Orbitron,sans-serif';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.shadowColor='#fff';ctx.shadowBlur=6;
            ctx.fillText('◆'+bk.hp,bk.x+bk.w/2,bk.y+bk.h/2);ctx.shadowBlur=0;
        }
        if(bk.type===B.BOMB){
            ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='700 10px Orbitron,sans-serif';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.shadowColor='#aa00ff';ctx.shadowBlur=12;
            ctx.fillText('☢',bk.x+bk.w/2,bk.y+bk.h/2);ctx.shadowBlur=0;
        }
        if(bk.type===B.REWARD){
            ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='12px sans-serif';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText('◆',bk.x+bk.w/2,bk.y+bk.h/2+1);
        }
        if(bk.type===B.INVISIBLE&&bk.visible){
            // Glitchy scanlines for revealed invisible bricks
            ctx.fillStyle='rgba(255,136,0,0.06)';
            for(let l=0;l<4;l++){const ly=bk.y+2+l*(bk.h/4);ctx.fillRect(bk.x,ly,bk.w,1)}
        }
        if(bk.frozen){
            ctx.fillStyle='rgba(0,212,255,0.2)';roundRect(ctx,bk.x,bk.y,bk.w,bk.h,3);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='700 12px Orbitron,sans-serif';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.shadowColor='#00d4ff';ctx.shadowBlur=10;
            ctx.fillText('❄',bk.x+bk.w/2,bk.y+bk.h/2+1);ctx.shadowBlur=0;
        }
    }
}

/* ---------- 绘制 BOSS ---------- */
function drawBoss(){
    if(!boss)return;
    const c=BOSS_CFG[boss.idx];
    const flash=bossHitFlash>0;
    const now=Date.now();
    const cx=boss.x+boss.w/2,cy=boss.y+boss.h/2,r=boss.w/2*0.8;

    // Shields
    for(const s of bossShields){
        if(!s.alive)continue;
        ctx.shadowColor='#ff00aa';ctx.shadowBlur=10;
        ctx.fillStyle=s.hp>1?darkenColor('#ff00aa',0.2):'#ff00aa';
        roundRect(ctx,s.x,s.y,s.w,s.h,4);ctx.fill();ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;roundRect(ctx,s.x,s.y,s.w,s.h,4);ctx.stroke();
    }

    // Boss hexagon
    const gp=1+Math.sin(now/300)*0.08;
    ctx.shadowColor=c.glow;ctx.shadowBlur=flash?40:20*gp;
    const grad=ctx.createRadialGradient(cx-8,cy-8,5,cx,cy,r);
    if(flash){grad.addColorStop(0,'#fff');grad.addColorStop(1,'#fff')}
    else{grad.addColorStop(0,lightenColor(c.color,0.4));grad.addColorStop(0.5,c.color);grad.addColorStop(1,darkenColor(c.color,0.3))}
    ctx.fillStyle=grad;
    ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}
    ctx.closePath();ctx.fill();ctx.shadowBlur=0;

    // Border
    ctx.strokeStyle=c.glow;ctx.lineWidth=2;ctx.globalAlpha=0.5+0.3*Math.sin(now/500);
    ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}
    ctx.closePath();ctx.stroke();ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
    ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r*0.6,cy+Math.sin(a)*r*0.6)}
    ctx.closePath();ctx.stroke();

    // Eye
    if(!flash){ctx.fillStyle=`rgba(255,255,255,${(Math.sin(now/200)*0.3+0.7)*0.6})`;ctx.beginPath();ctx.arc(cx,cy,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(cx-3,cy-3,3,0,Math.PI*2);ctx.fill()}

    // Name + HP
    ctx.fillStyle='rgba(0,240,255,0.3)';ctx.font='600 11px Rajdhani,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(c.name,cx,boss.y-8);
    const barW=140,barH=6,bx=cx-barW/2,by=boss.y-6;
    ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(ctx,bx,by,barW,barH,3);ctx.fill();
    const hpP=boss.hp/boss.maxHp;
    ctx.fillStyle=boss.phase===3?'#ff0044':c.color;ctx.shadowColor=boss.phase===3?'#ff0044':c.glow;ctx.shadowBlur=8;
    roundRect(ctx,bx,by,barW*hpP,barH,3);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.15)';roundRect(ctx,bx+2,by+1,Math.max(0,barW*hpP-4),2,2);ctx.fill();

    // Bullets
    for(const b of bossBullets){
        ctx.shadowColor='#ff0044';ctx.shadowBlur=15;
        const bg2=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.r);
        bg2.addColorStop(0,'#fff');bg2.addColorStop(0.3,'#ff0044');bg2.addColorStop(1,'#880022');
        ctx.fillStyle=bg2;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
}

/* ---------- 绘制 ---------- */
function draw(){
    let sx=0,sy=0;
    if(shakeTime>0){const d=Math.min(shakeTime/300,1);sx=(Math.random()-0.5)*2*shakeIntensity*d;sy=(Math.random()-0.5)*2*shakeIntensity*d;updateShake()}
    ctx.save();ctx.translate(sx,sy);
    drawBG();
    drawBricks();
    if(isBossLevel(level))drawBoss();

    // Balls
    for(const b of balls){
        let bn=8,fc='#d5d9df',fl='#f5f7fa',fd='#8a9099';
        if(activeEffects['B']){bn=5;fc='#ff4400';fl='#ff8844';fd='#cc2200'}
        else if(activeEffects['F']){bn=3;fc='#ff2200';fl='#ff6644';fd='#990000'}
        else if(activeEffects['I']){bn=2;fc='#00aaff';fl='#44ccff';fd='#0066cc'}
        else if(activeEffects['E']){bn=6;fc='#39ff14';fl='#66ff44';fd='#00aa00'}
        else if(activeEffects['S']){bn=1;fc='#ffd700';fl='#ffee44';fd='#cc9900'}
        else if(activeEffects['G']){bn=4;fc='#aa44ff';fl='#cc88ff';fd='#7722cc'}
        // Trail
        for(let i=0;i<b.trail.length;i++){const t=b.trail[i],p=(i+1)/b.trail.length;ctx.globalAlpha=p*0.3;ctx.fillStyle=darkenColor(fc,1-p);ctx.shadowColor=fc;ctx.shadowBlur=10*p;ctx.beginPath();ctx.arc(t.x,t.y,b.r*(0.2+0.6*p),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
        ctx.globalAlpha=1;
        if(!b.stuck||state===STATE.MENU){
            // Core glow
            const gp=1+Math.sin(Date.now()/300)*0.1;ctx.shadowColor=fc;ctx.shadowBlur=30*gp;
            const g=ctx.createRadialGradient(b.x-4,b.y-4,1,b.x,b.y,b.r);
            g.addColorStop(0,fl);g.addColorStop(0.35,fc);g.addColorStop(1,fd);
            ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
            ctx.shadowBlur=0;
            // Center highlight
            ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(b.x-5,b.y-5,2.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.3)';ctx.beginPath();ctx.arc(b.x-8,b.y-8,1.2,0,Math.PI*2);ctx.fill();
            // Orbital aura
            const nt=Date.now()/1000;
            for(const p of b.aura){const a=p.angle+nt*p.speed;ctx.globalAlpha=0.25+0.2*Math.sin(nt*2+p.phase);ctx.fillStyle=fl;ctx.shadowColor=fl;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*p.radius,b.y+Math.sin(a)*p.radius*0.6,p.size,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
            ctx.globalAlpha=1;
        }else if(Math.sin(Date.now()/200)>0){ctx.globalAlpha=0.4+0.2*Math.sin(Date.now()/150);ctx.fillStyle=fc;ctx.shadowColor=fc;ctx.shadowBlur=25;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1}
    }

    // Launch hint
    if(balls.length>0&&balls.every(b=>b.stuck)&&state===STATE.PLAYING){
        const blink=Math.sin(Date.now()/300)>0;
        if(blink){ctx.fillStyle='rgba(0,240,255,0.3)';ctx.font='600 13px Rajdhani,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('▸ 按 空格键 发射 ◂',W/2,20)}
    }

    // Paddle
    const pp=Math.sin(Date.now()/400)*0.3+0.7;
    ctx.shadowColor='#00f0ff';ctx.shadowBlur=20*pp;
    const pg=ctx.createLinearGradient(paddle.x,paddle.y,paddle.x,paddle.y+paddle.h);
    pg.addColorStop(0,'#66f0ff');pg.addColorStop(0.5,paddle.color);pg.addColorStop(1,'#0099cc');
    ctx.fillStyle=pg;
    roundRect(ctx,paddle.x,paddle.y,paddle.w,paddle.h,8);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.2)';roundRect(ctx,paddle.x+16,paddle.y+3,paddle.w-32,3,2);ctx.fill();
    // Paddle edge glow dots
    ctx.fillStyle='rgba(0,240,255,0.4)';ctx.beginPath();ctx.arc(paddle.x+6,paddle.y+paddle.h/2,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,240,255,0.4)';ctx.beginPath();ctx.arc(paddle.x+paddle.w-6,paddle.y+paddle.h/2,2,0,Math.PI*2);ctx.fill();

    drawPowerups();drawParticles();drawScorePopups();drawActiveEffects();

    // Transition overlay
    if(state===STATE.TRANSITION&&transAlpha>0){
        ctx.fillStyle=`rgba(0,0,0,${transAlpha*0.6})`;ctx.fillRect(0,0,W,H);
        ctx.fillStyle=`rgba(0,240,255,${transAlpha*0.8})`;ctx.font='700 32px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#00f0ff';ctx.shadowBlur=40*transAlpha;
        const isBoss=isBossLevel(level);
        ctx.fillText(isBoss?'⚠ BOSS 来袭':`第 ${level} 关`,W/2,H/2-30);
        ctx.fillStyle=`rgba(255,255,255,${transAlpha*0.5})`;ctx.font='600 18px Rajdhani,sans-serif';ctx.shadowBlur=0;
        ctx.fillText(isBoss?BOSS_CFG[getBossIndex(level)].name:(LN[getNormalLevelIndex(level)]||'FINAL'),W/2,H/2+20);
    }

    // Overlays
    if(state===STATE.MENU){
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);
        const pulse=Math.sin(Date.now()/500)*0.2+0.8;
        ctx.fillStyle='#00f0ff';ctx.font='700 44px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#00f0ff';ctx.shadowBlur=50*pulse;
        ctx.fillText('◆ 霓虹突破',W/2,100);
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(0,240,255,0.25)';ctx.font='600 14px Rajdhani,sans-serif';ctx.fillText('NEON BREAK',W/2,145);
        ctx.fillStyle='rgba(0,240,255,0.1)';ctx.fillRect(W/2-80,160,160,1);

        // 当前难度
        const dn=['EASY','NORMAL','HARD'];
        ctx.fillStyle='rgba(0,240,255,0.2)';ctx.font='600 11px Rajdhani,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
        ctx.fillText(`DIFFICULTY: ${dn[diff]}`,W/2,175);

        // 左侧排行榜
        drawScores(30,200,140);

        // 右侧砖块类型
        ctx.fillStyle='rgba(0,240,255,0.2)';ctx.font='600 11px Rajdhani,sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
        ctx.fillText('— BRICK TYPES —',530,200);
        let col=0;
        for(const t of[1,2,3,4,5]){
            const bx=530,by=220+col*32,bs=14;
            ctx.fillStyle=BC[t];ctx.shadowColor=BGLOW[t];ctx.shadowBlur=8;
            roundRect(ctx,bx,by,bs,bs,3);ctx.fill();ctx.shadowBlur=0;
            ctx.fillStyle='rgba(255,255,255,0.45)';ctx.font='500 11px Rajdhani,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
            ctx.fillText(BNAMES[t],bx+bs+8,by+bs/2);
            col++;
        }

        // 底部操作提示
        ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='600 14px Rajdhani,sans-serif';ctx.textAlign='center';
        ctx.fillText('← → / A D  移动    空格  发射 · 暂停',W/2,530);
        const blink=Math.sin(Date.now()/350)>0;
        if(blink){ctx.fillStyle='rgba(0,240,255,0.2)';ctx.font='600 14px Rajdhani,sans-serif';ctx.fillText('▸ 点击「开始游戏」开始 ◂',W/2,560)}
    }else if(state===STATE.PAUSED){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#00f0ff';ctx.font='700 40px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#00f0ff';ctx.shadowBlur=35;
        ctx.fillText('⏸ PAUSED',W/2,H/2-30);ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='600 16px Rajdhani,sans-serif';ctx.fillText('按 空格键 或「继续」',W/2,H/2+25);
    }else if(state===STATE.GAMEOVER){
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#ff0044';ctx.font='700 42px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#ff0044';ctx.shadowBlur=45;
        ctx.fillText('☠ SYSTEM FAILURE',W/2,H/2-80);ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700';ctx.font='700 24px Orbitron,sans-serif';ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
        ctx.fillText(`SCORE: ${score}`,W/2,H/2-20);ctx.shadowBlur=0;
        drawScores(30,210,140);
        ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='600 14px Rajdhani,sans-serif';ctx.textAlign='center';ctx.fillText('按 空格键 重新开始',W/2,540);
    }else if(state===STATE.WIN){
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#39ff14';ctx.font='700 40px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#39ff14';ctx.shadowBlur=50;
        ctx.fillText('◆ SYSTEM COMPLETE',W/2,H/2-80);ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700';ctx.font='700 26px Orbitron,sans-serif';ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
        ctx.fillText(`FINAL: ${score}`,W/2,H/2-20);ctx.shadowBlur=0;
        drawScores(30,210,140);
        ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='600 14px Rajdhani,sans-serif';ctx.textAlign='center';ctx.fillText('按 空格键 再来一次',W/2,540);
    }
    ctx.restore();
}

/* ---------- 工具 ---------- */
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function darkenColor(hex,f){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${r*(1-f)|0},${g*(1-f)|0},${b*(1-f)|0})`}
function lightenColor(hex,f){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${Math.min(255,r+(255-r)*f)|0},${Math.min(255,g+(255-g)*f)|0},${Math.min(255,b+(255-b)*f)|0})`}

/* ---------- 循环 ---------- */
function gameLoop(){update();draw();animFrameId=requestAnimationFrame(gameLoop)}

/* ---------- 控制 ---------- */
function setDiff(d){
    diff=d;
    diffBtns.forEach((btn,i)=>{
        btn.classList.toggle('active',i===d);
    });
}
function startGame(){sfx.init();resetGame();state=STATE.PLAYING;transTimer=400;transAlpha=0;startBtn.innerHTML='<span>▶ 重新开始</span>';pauseBtn.disabled=false;pauseBtn.innerHTML='<span>⏸ 暂停</span>';bgm.start()}
function togglePause(){if(state===STATE.PLAYING){state=STATE.PAUSED;pauseBtn.innerHTML='<span>▶ 继续</span>';bgm.stop()}else if(state===STATE.PAUSED){state=STATE.PLAYING;pauseBtn.innerHTML='<span>⏸ 暂停</span>';bgm.start()}}
function launchBall(){if(state!==STATE.PLAYING||balls.length===0)return;for(const b of balls){if(!b.stuck)continue;b.stuck=false;const c=DIFF_CFG[diff],s=c.bs+(level-1)*0.3,a=-Math.PI/2+(Math.random()-0.5)*0.8;b.dx=Math.cos(a)*s;b.dy=Math.sin(a)*s;b.trail=[];if(activeEffects['S']){b.dx*=0.5;b.dy*=0.5}if(activeEffects['E']){b.dx*=1.6;b.dy*=1.6}}}

/* ---------- 事件 ---------- */
window.addEventListener('keydown',e=>{switch(e.code){case'ArrowLeft':case'KeyA':keys.left=true;e.preventDefault();break;case'ArrowRight':case'KeyD':keys.right=true;e.preventDefault();break;case'Space':e.preventDefault();if(state===STATE.MENU)startGame();else if(state===STATE.TRANSITION){}else if(state===STATE.PLAYING&&balls.some(b=>b.stuck))launchBall();else if(state===STATE.PLAYING||state===STATE.PAUSED)togglePause();else if(state===STATE.GAMEOVER||state===STATE.WIN)startGame();break}});
window.addEventListener('keyup',e=>{switch(e.code){case'ArrowLeft':case'KeyA':keys.left=false;e.preventDefault();break;case'ArrowRight':case'KeyD':keys.right=false;e.preventDefault();break}});

startBtn.addEventListener('click',startGame);
pauseBtn.addEventListener('click',togglePause);
diffBtns.forEach((btn,i)=>btn.addEventListener('click',()=>{if(state===STATE.MENU)setDiff(i)}));
diffBtns.forEach((btn,i)=>btn.addEventListener('touchstart',e=>{e.preventDefault();if(state===STATE.MENU)setDiff(i)}));

/* ---------- 手机端左右按钮 ---------- */
const btnLeft=document.getElementById('btnLeft');
const btnRight=document.getElementById('btnRight');
const btnLaunch=document.getElementById('btnLaunch');
function setMobileKey(btn,key){
    btn.addEventListener('touchstart',e=>{e.preventDefault();keys[key]=true});
    btn.addEventListener('touchend',e=>{e.preventDefault();keys[key]=false});
    btn.addEventListener('touchcancel',e=>{keys[key]=false});
}
setMobileKey(btnLeft,'left');
setMobileKey(btnRight,'right');
btnLaunch.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(state===STATE.MENU||state===STATE.GAMEOVER||state===STATE.WIN)startGame();
    else if(state===STATE.PAUSED)togglePause();
    else if(state===STATE.PLAYING&&balls.some(b=>b.stuck))launchBall();
});

/* ---------- 触摸控制 ---------- */
canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    const t=e.changedTouches[0];if(!t)return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=W/rect.width;
    const tx=(t.clientX-rect.left)*scaleX;
    if(state===STATE.MENU||state===STATE.GAMEOVER||state===STATE.WIN){startGame();return}
    if(state===STATE.PAUSED){togglePause();return}
    if(state===STATE.PLAYING){
        if(balls.some(b=>b.stuck))launchBall();
        keys.left=tx<W/2;keys.right=tx>=W/2;
    }
});
canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(state!==STATE.PLAYING)return;
    const t=e.changedTouches[0];if(!t)return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=W/rect.width;
    const tx=(t.clientX-rect.left)*scaleX;
    keys.left=tx<W/2;keys.right=tx>=W/2;
});
canvas.addEventListener('touchend',e=>{e.preventDefault();keys.left=false;keys.right=false});
canvas.addEventListener('touchcancel',e=>{keys.left=false;keys.right=false});

/* ---------- 启动 ---------- */
setDiff(DIFF.NORMAL);
resetGame();gameLoop();
