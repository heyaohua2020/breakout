/* ============================================
     打砖块 Breakout — 游戏逻辑 v6（最终版）
     ============================================ */

/* ---------- DOM ---------- */
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score');
const livesEl=document.getElementById('lives');
const levelEl=document.getElementById('level');
const startBtn=document.getElementById('startBtn');
const pauseBtn=document.getElementById('pauseBtn');
const W=800,H=600;

/* ---------- 状态 ---------- */
const STATE={MENU:0,PLAYING:1,PAUSED:2,GAMEOVER:3,WIN:4};
let state=STATE.MENU;
const paddle={x:0,y:570,w:120,h:14,defaultW:120,speed:8,color:'#4fc3f7'};
let balls=[],score=0,lives=3,level=1,bricks=[],particles=[];
let comboCount=0,lastComboTime=0,animFrameId=null;
const keys={left:false,right:false};
let mouseX=null;

/* ---------- 屏幕震动 ---------- */
let shakeTime=0,shakeIntensity=0;
function triggerShake(i,d){shakeIntensity=i;shakeTime=d;}
function updateShake(){if(shakeTime<=0)return;shakeTime-=16;}

/* ---------- 排行榜 ---------- */
function getScores(){try{return JSON.parse(localStorage.getItem('breakout_scores'))||[]}catch(e){return[]}}
function addScore(s){
    const l=getScores();l.push({score:s,level:level,date:new Date().toLocaleDateString()});
    l.sort((a,b)=>b.score-a.score);if(l.length>5)l.length=5;
    try{localStorage.setItem('breakout_scores',JSON.stringify(l))}catch(e){}
}
function drawScores(x,y){
    const list=getScores();if(!list.length)return;
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='14px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('🏆 最高分',x,y);
    list.forEach((s,i)=>{
        ctx.fillStyle=i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,0.4)';
        ctx.fillText(`${i+1}. ${s.score}分 (第${s.level}关)`,x,y+20+i*18);
    });
}

/* ---------- 砖块类型 ---------- */
const B={NONE:0,NORMAL:1,METAL:2,BOMB:3,REWARD:4,INVISIBLE:5};
const BC={[B.NORMAL]:'#ff6b6b',[B.METAL]:'#78909c',[B.BOMB]:'#3f51b5',[B.REWARD]:'#4caf50',[B.INVISIBLE]:'#9e9e9e'};
const BH={[B.NORMAL]:1,[B.METAL]:3,[B.BOMB]:1,[B.REWARD]:1,[B.INVISIBLE]:2};
const BS={[B.NORMAL]:10,[B.METAL]:30,[B.BOMB]:15,[B.REWARD]:10,[B.INVISIBLE]:15};

/* ---------- 道具 ---------- */
const PU=[
    {id:'W',name:'加宽挡板',color:'#4fc3f7',duration:10000,type:'buff'},
    {id:'M',name:'多球',color:'#e91e63',duration:0,type:'buff'},
    {id:'F',name:'穿透球',color:'#ff5722',duration:8000,type:'buff'},
    {id:'S',name:'减速',color:'#66bb6a',duration:8000,type:'buff'},
    {id:'H',name:'加命',color:'#ff6b6b',duration:0,type:'buff'},
    {id:'G',name:'粘球挡板',color:'#ab47bc',duration:10000,type:'buff'},
    {id:'N',name:'缩小挡板',color:'#ff9800',duration:10000,type:'debuff'},
    {id:'E',name:'加速',color:'#ffeb3b',duration:8000,type:'debuff'},
];
let powerups=[],activeEffects={};

/* ---------- 音效 ---------- */
const sfx={
    ctx:null,
    init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}},
    _osc(t,f,ef,d,v=0.3){
        if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type=t;o.frequency.setValueAtTime(f,this.ctx.currentTime);
        if(ef!==undefined)o.frequency.linearRampToValueAtTime(ef,this.ctx.currentTime+d);
        g.gain.setValueAtTime(v,this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+d);
        o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d+0.05);
    },
    play(t){
        if(!this.ctx)return;
        switch(t){
            case'paddle':this._osc('square',440,580,0.1,0.3);break;
            case'break':this._osc('triangle',620,880,0.08,0.25);break;
            case'hit':this._osc('sine',380,420,0.05,0.15);break;
            case'lose':this._osc('sine',400,100,0.35,0.3);break;
            case'levelup':[523,659,784].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;const t=this.ctx.currentTime+i*0.15;g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+0.15);});break;
            case'gameover':this._osc('sawtooth',350,60,0.8,0.3);break;
            case'combo':this._osc('square',500+Math.min(comboCount,10)*50,0,0.08,0.2);break;
            case'powerup':this._osc('sine',600,900,0.15,0.2);break;
        }
    },
};

/* ---------- 球 ---------- */
function createBall(x,y,dx,dy,stuck=true){return{x,y,r:9,dx:dx||0,dy:dy||0,stuck,trail:[]}}
function resetBall(stick=true){
    balls=[createBall(paddle.x+paddle.w/2,paddle.y-10)];
    const b=balls[0];b.stuck=stick;
    if(!stick){const a=-Math.PI/2+(Math.random()-0.5)*1.2,s=5+(level-1)*0.3;b.dx=Math.cos(a)*s;b.dy=Math.sin(a)*s;b.trail=[];}
}

/* ---------- 关卡布局 ---------- */
const LG=[
    ()=>[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],
    ()=>[[0,0,0,0,4,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,4,1,1,1,1]],
    ()=>[[0,0,0,0,1,0,0,0,0],[0,0,0,2,1,2,0,0,0],[0,0,1,1,2,1,1,0,0],[0,0,0,2,1,2,0,0,0],[0,0,0,0,1,0,0,0,0]],
    ()=>[[1,1,1,1,1,1,1,1,1,1],[1,0,0,3,0,0,3,0,0,1],[1,0,0,1,0,0,1,0,0,1],[1,0,0,1,0,0,1,0,0,1],[1,1,1,1,1,1,1,1,1,1]],
    ()=>{const g=Array.from({length:6},()=>Array(10).fill(0));for(let r=0;r<6;r++)for(let c=0;c<10;c++)g[r][c]=(r+c)%2===0?1:0;g[0][4]=4;g[2][2]=2;g[3][7]=2;g[5][1]=4;return g;},
    ()=>{const g=Array.from({length:6},()=>Array(11).fill(0));for(let r=0;r<6;r++){const s=5-Math.floor(r/1.5),e=5+Math.floor(r/1.5);for(let c=s;c<=e;c++)g[r][c]=1;}g[1][5]=3;g[3][3]=4;g[3][7]=4;g[5][5]=3;return g;},
    ()=>{const g=Array.from({length:6},()=>Array(11).fill(0));for(let r=0;r<6;r++)for(let c=0;c<11;c++){const d=Math.abs(c-5);if(d<=2+r&&d>=Math.abs(r-2))g[r][c]=1;}g[0][5]=5;g[5][5]=5;g[2][2]=2;g[2][8]=2;g[4][5]=5;return g;},
    ()=>{const g=Array.from({length:7},()=>Array(12).fill(0));for(let r=0;r<7;r++){const s=r*2,e=11-r;for(let c=s;c<=e;c++)g[r][c]=1;}g[1][2]=3;g[1][9]=3;g[3][5]=2;g[3][6]=2;g[5][3]=4;g[5][8]=4;g[6][6]=3;return g;},
    ()=>{const g=Array.from({length:7},()=>Array(13).fill(0));for(let c=0;c<13;c++){g[0][c]=1;g[6][c]=1;}for(let r=1;r<6;r++){g[r][0]=1;g[r][12]=1;}for(let r=2;r<5;r++){g[r][3]=1;g[r][9]=1;}for(let c=4;c<9;c++)g[3][c]=1;g[0][6]=5;g[6][6]=5;g[2][2]=2;g[2][10]=2;g[4][6]=3;g[1][1]=4;g[1][11]=4;g[5][1]=3;g[5][11]=3;return g;},
    ()=>{const g=Array.from({length:8},()=>Array(14).fill(1));for(let r=0;r<8;r++)for(let c=0;c<14;c++)if((r===0||r===7)&&c%2===0)g[r][c]=2;g[0][3]=5;g[0][10]=5;g[7][3]=5;g[7][10]=5;g[3][1]=3;g[3][12]=3;g[4][6]=3;g[4][7]=3;g[1][7]=4;g[6][6]=4;return g;},
];

function createBrick(x,y,w,h,t,sx,sy,bw,bh){return{x,y,w,h,type:t,color:BC[t],alive:true,hp:BH[t]||1,visible:t!==B.INVISIBLE,startX:sx,startY:sy,bw:bh}}
function buildLevel(lvl){
    const g=LG[lvl-1](),cols=g[0].length,rows=g.length;
    const bw=Math.min(68,Math.floor((W-40)/cols)-4),bh=20,gap=4;
    const ox=(W-(cols*(bw+gap)-gap))/2,oy=42;
    const list=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        if(g[r][c]===B.NONE)continue;
        const b=createBrick(ox+c*(bw+gap),oy+r*(bh+gap),bw,bh,g[r][c],ox,oy,bw,bh);
        if(b.type===B.METAL)b.hp=3+Math.floor(lvl/3);list.push(b);
    }
    return list;
}

/* ---------- 粒子 ---------- */
function spawnParticles(x,y,color,c=18){for(let i=0;i<c;i++){const a=Math.random()*Math.PI*2,s=1.5+Math.random()*4;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.015+Math.random()*0.025,size:2+Math.random()*5,color});}}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life-=p.decay;if(p.life<=0)particles.splice(i,1);}}
function drawParticles(){for(const p of particles){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}

/* ---------- 道具逻辑 ---------- */
function spawnPowerup(x,y){if(Math.random()>0.18)return;const t=PU[Math.floor(Math.random()*PU.length)];powerups.push({x,y,type:t,vy:2,wobble:0,wobbleSpeed:2+Math.random()*2});}
function updatePowerups(){for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];p.y+=p.vy;p.wobble+=p.wobbleSpeed;p.x+=Math.sin(p.wobble*0.05)*0.3;if(p.y+12>=paddle.y&&p.y-12<=paddle.y+paddle.h&&p.x>=paddle.x&&p.x<=paddle.x+paddle.w){activateEffect(p.type);powerups.splice(i,1);continue}if(p.y>H+20)powerups.splice(i,1);}}
function drawPowerups(){for(const p of powerups){const cx=p.x,cy=p.y;ctx.shadowColor=p.type.color;ctx.shadowBlur=15;const g=ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,14);g.addColorStop(0,'#fff');g.addColorStop(0.3,p.type.color);g.addColorStop(1,darkenColor(p.type.color,0.4));ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,14,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.type.id,cx,cy+1);}}
function activateEffect(t){
    sfx.play('powerup');
    if(t.id==='H'){lives=Math.min(lives+1,9);updateUI();spawnParticles(paddle.x+paddle.w/2,paddle.y,'#ff6b6b',30);return}
    if(t.id==='M'){const cur=balls.filter(b=>!b.stuck);for(const b of cur)for(let i=0;i<2;i++){const a=Math.atan2(b.dy,b.dx)+(i===0?-0.5:0.5),s=Math.sqrt(b.dx*b.dx+b.dy*b.dy);if(s>0.1)balls.push(createBall(b.x,b.y,Math.cos(a)*s,Math.sin(a)*s,false))}spawnParticles(paddle.x+paddle.w/2,paddle.y,'#e91e63',30);return}
    if(t.duration>0){if(activeEffects[t.id]){activeEffects[t.id].endTime=Date.now()+t.duration;return}activeEffects[t.id]={endTime:Date.now()+t.duration,...t};_applyEffect(t.id,true)}
}
function _applyEffect(id,a){
    switch(id){case'W':paddle.w=a?paddle.defaultW*1.6:paddle.defaultW;break;case'N':paddle.w=a?paddle.defaultW*0.6:paddle.defaultW;break;case'S':balls.forEach(b=>{if(!b.stuck){b.dx*=a?0.5:2;b.dy*=a?0.5:2}});break;case'E':balls.forEach(b=>{if(!b.stuck){b.dx*=a?1.6:0.625;b.dy*=a?1.6:0.625}});break}
    if(id==='W'||id==='N'){if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;if(paddle.x<0)paddle.x=0}
}
function updateActiveEffects(){const n=Date.now();for(const id in activeEffects)if(n>=activeEffects[id].endTime){_applyEffect(id,false);delete activeEffects[id]}}
function drawActiveEffects(){const list=Object.values(activeEffects);if(!list.length)return;let ox=10;for(const ef of list){const r=Math.max(0,ef.endTime-Date.now()),p=r/ef.duration;ctx.fillStyle='rgba(0,0,0,0.55)';roundRect(ctx,ox,8,80,18,4);ctx.fill();ctx.fillStyle=ef.color;roundRect(ctx,ox+2,10,76*p,14,3);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ef.id+' '+(r/1000).toFixed(1)+'s',ox+40,17);ox+=86}}

/* ---------- 碰撞 ---------- */
function cRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh));const dx=cx-nx,dy=cy-ny;return{hit:dx*dx+dy*dy<cr*cr,nx,ny}}
function ballPaddleCollision(b){
    const{hit,nx}=cRect(b.x,b.y,b.r,paddle.x,paddle.y,paddle.w,paddle.h);
    if(!hit)return false;
    if(activeEffects['G']){b.stuck=true;b.x=paddle.x+paddle.w/2;b.y=paddle.y-b.r-1;b.dx=0;b.dy=0;sfx.play('paddle');spawnParticles(b.x,paddle.y,'#ab47bc',8);return true}
    const hp=(b.x-paddle.x)/paddle.w,angle=(hp-0.5)*Math.PI*0.7,spd=Math.sqrt(b.dx*b.dx+b.dy*b.dy);
    b.dx=Math.sin(angle)*spd;b.dy=-Math.cos(angle)*spd;b.y=paddle.y-b.r-1;
    sfx.play('paddle');spawnParticles(b.x,paddle.y,'#4fc3f7',8);return true;
}
function bombExplode(b){
    const col=Math.round((b.x-b.startX)/(b.bw+4)),row=Math.round((b.y-b.startY)/(b.bh+4));
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(dr===0&&dc===0)continue;for(const bk of bricks){if(!bk.alive)continue;const bc=Math.round((bk.x-b.startX)/(b.bw+4)),br=Math.round((bk.y-b.startY)/(b.bh+4));if(br===row+dr&&bc===col+dc&&bk!==b){bk.alive=false;spawnParticles(bk.x+bk.w/2,bk.y+bk.h/2,'#3f51b5',20)}}}
    triggerShake(10,300);spawnParticles(b.x+b.w/2,b.y+b.h/2,'#ff5722',40);
}
function ballBrickCollision(ball){
    for(const brick of bricks){
        if(!brick.alive)continue;
        if(brick.type===B.INVISIBLE&&!brick.visible){
            const{hit}=cRect(ball.x,ball.y,ball.r,brick.x,brick.y,brick.w,brick.h);
            if(hit){brick.visible=true;brick.color='#9e9e9e';spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#e0e0e0',12);const dx=ball.x-brick.x-brick.w/2,dy=ball.y-brick.y-brick.h/2;if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy;return true}
            continue;
        }
        const{hit,nx,ny}=cRect(ball.x,ball.y,ball.r,brick.x,brick.y,brick.w,brick.h);
        if(!hit)continue;
        if(!activeEffects['F']){const dx=ball.x-nx,dy=ball.y-ny;if(Math.abs(dx)>Math.abs(dy))ball.dx=-ball.dx;else ball.dy=-ball.dy}
        brick.hp--;
        if(brick.hp<=0){
            brick.alive=false;
            if(brick.type===B.BOMB)bombExplode(brick);else if(brick.type===B.REWARD)spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);else spawnPowerup(brick.x+brick.w/2,brick.y+brick.h/2);
            sfx.play('break');spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,brick.color,28);
            const n=Date.now();if(n-lastComboTime<600)comboCount++;else comboCount=1;lastComboTime=n;
            score+=(BS[brick.type]||10)*Math.min(comboCount,10);sfx.play('combo');
        }else{sfx.play('hit');spawnParticles(brick.x+brick.w/2,brick.y+brick.h/2,'#ffffff',brick.type===B.METAL?10:6);score+=2}
        updateUI();if(!activeEffects['F'])return true;
    }
    return false;
}

/* ---------- 重置 ---------- */
function resetPaddle(){paddle.w=paddle.defaultW;paddle.x=(W-paddle.w)/2}
function resetGame(){score=0;lives=3;level=1;comboCount=0;particles=[];powerups=[];activeEffects={};keys.left=false;keys.right=false;updateUI();resetPaddle();bricks=buildLevel(1);resetBall(true)}
function updateUI(){scoreEl.textContent=score;livesEl.textContent=lives;levelEl.textContent=level}

/* ---------- 更新 ---------- */
function update(){
    if(state!==STATE.PLAYING)return;
    if(keys.left)paddle.x-=paddle.speed;
    if(keys.right)paddle.x+=paddle.speed;
    if(mouseX!==null&&!keys.left&&!keys.right){const t=mouseX-paddle.w/2,d=t-paddle.x;if(Math.abs(d)>2)paddle.x+=Math.sign(d)*Math.min(Math.abs(d),paddle.speed*1.2);else paddle.x=t}
    paddle.x=Math.max(0,Math.min(W-paddle.w,paddle.x));
    for(let i=balls.length-1;i>=0;i--){
        const b=balls[i];
        if(b.stuck){b.x=paddle.x+paddle.w/2;b.y=paddle.y-b.r-1;continue}
        b.x+=b.dx;b.y+=b.dy;b.trail.push({x:b.x,y:b.y});if(b.trail.length>8)b.trail.shift();
        if(b.x-b.r<=0){b.x=b.r;b.dx=-b.dx}if(b.x+b.r>=W){b.x=W-b.r;b.dx=-b.dx}if(b.y-b.r<=0){b.y=b.r;b.dy=-b.dy}
        if(b.y-b.r>H){balls.splice(i,1);continue}
        ballPaddleCollision(b);ballBrickCollision(b);
    }
    if(balls.length===0){
        triggerShake(5,200);sfx.play('lose');lives--;comboCount=0;updateUI();
        if(lives<=0){triggerShake(6,400);sfx.play('gameover');addScore(score);state=STATE.GAMEOVER;return}
        resetBall(true);return;
    }
    if(bricks.every(b=>!b.alive)){
        sfx.play('levelup');level++;levelEl.textContent=level;
        if(level>10){addScore(score);state=STATE.WIN;return}
        bricks=buildLevel(level);resetBall(true);lives=Math.min(lives+1,5);updateUI();
    }
    updatePowerups();updateActiveEffects();updateParticles();
}

/* ---------- 绘制 ---------- */
function draw(){
    let sx=0,sy=0;
    if(shakeTime>0){const d=Math.min(shakeTime/300,1);sx=(Math.random()-0.5)*2*shakeIntensity*d;sy=(Math.random()-0.5)*2*shakeIntensity*d;updateShake()}
    ctx.save();ctx.translate(sx,sy);
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.02)';ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    for(const bk of bricks){
        if(!bk.alive||(bk.type===B.INVISIBLE&&!bk.visible))continue;
        let c=bk.color;
        if(bk.type===B.BOMB){const p=Math.sin(Date.now()/300)*0.15+0.85;c=darkenColor(bk.color,1-p)}
        if(bk.type===B.REWARD){const s=Math.sin(Date.now()/500)*0.1+0.9;c=darkenColor(bk.color,1-s)}
        const g=ctx.createLinearGradient(bk.x,bk.y,bk.x,bk.y+bk.h);
        g.addColorStop(0,c);g.addColorStop(1,darkenColor(c,0.3));
        ctx.fillStyle=g;ctx.shadowColor=c;ctx.shadowBlur=6;
        roundRect(ctx,bk.x,bk.y,bk.w,bk.h,3);ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.2)';roundRect(ctx,bk.x+2,bk.y+2,bk.w-4,4,2);ctx.fill();
        if(bk.type===B.METAL&&bk.hp>0){ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✦'+bk.hp,bk.x+bk.w/2,bk.y+bk.h/2)}
        if(bk.type===B.BOMB){ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('💣',bk.x+bk.w/2,bk.y+bk.h/2)}
        if(bk.type===B.REWARD){ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',bk.x+bk.w/2,bk.y+bk.h/2+1)}
    }
    for(const b of balls){
        for(let i=0;i<b.trail.length;i++){const t=b.trail[i];ctx.globalAlpha=(i+1)/b.trail.length*0.4;ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(t.x,t.y,b.r*(0.4+0.6*(i+1)/b.trail.length),0,Math.PI*2);ctx.fill()}
        ctx.globalAlpha=1;
        if(!b.stuck||state===STATE.MENU){const g=ctx.createRadialGradient(b.x-3,b.y-3,2,b.x,b.y,b.r);g.addColorStop(0,'#fff8e1');g.addColorStop(0.4,'#ffd700');g.addColorStop(1,darkenColor('#ffd700',0.4));ctx.fillStyle=g;ctx.shadowColor='#ffd700';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}else if(Math.sin(Date.now()/200)>0){ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
    }
    if(balls.length>0&&balls.every(b=>b.stuck)&&state===STATE.PLAYING){ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('按 空格键 发射',W/2,20)}
    const pg=ctx.createLinearGradient(paddle.x,paddle.y,paddle.x,paddle.y+paddle.h);
    pg.addColorStop(0,'#81d4fa');pg.addColorStop(0.5,paddle.color);pg.addColorStop(1,'#1565c0');
    ctx.fillStyle=pg;ctx.shadowColor=paddle.color;ctx.shadowBlur=16;
    roundRect(ctx,paddle.x,paddle.y,paddle.w,paddle.h,8);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.35)';roundRect(ctx,paddle.x+12,paddle.y+3,paddle.w-24,4,3);ctx.fill();
    drawPowerups();drawParticles();drawActiveEffects();

    // 状态覆盖层
    if(state===STATE.MENU){
        ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
        // 标题动画（发光脉冲）
        const pulse=Math.sin(Date.now()/600)*0.2+0.8;
        ctx.fillStyle='#ffd700';ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='#ffd700';ctx.shadowBlur=40*pulse;
        ctx.fillText('🧱 打砖块',W/2,160);
        ctx.shadowBlur=0;
        // 副标题
        ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='16px sans-serif';ctx.fillText('Breakout Game',W/2,210);
        // 操作提示
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='15px sans-serif';ctx.fillText('← → / A D  移动挡板',W/2,300);
        ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='14px sans-serif';ctx.fillText('鼠标也可控制  |  空格键 发射/暂停',W/2,328);
        // 最高分
        drawScores(W/2-40,370);
        // 开始按钮闪光提示
        const blink=Math.sin(Date.now()/400)>0;
        if(blink){ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='18px sans-serif';ctx.fillText('👆 点击「开始游戏」或按 空格键',W/2,510)}
    }else if(state===STATE.PAUSED){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#90caf9';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#90caf9';ctx.shadowBlur=40;ctx.fillText('⏸ 暂停中',W/2,H/2-30);ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='22px sans-serif';ctx.fillText('按 空格键 或点击「继续」',W/2,H/2+36)}
    else if(state===STATE.GAMEOVER){
        ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#ff6b6b';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#ff6b6b';ctx.shadowBlur=40;
        ctx.fillText('💀 游戏结束',W/2,H/2-70);ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700';ctx.font='bold 28px sans-serif';ctx.fillText(`得分: ${score}`,W/2,H/2-10);
        drawScores(W/2-40,H/2+30);
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='16px sans-serif';ctx.fillText('点击或按 空格键 重新开始',W/2,H/2+140);
    }else if(state===STATE.WIN){
        ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#69db7c';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#69db7c';ctx.shadowBlur=40;
        ctx.fillText('🎉 恭喜通关！',W/2,H/2-70);ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700';ctx.font='bold 28px sans-serif';ctx.fillText(`最终得分: ${score} 🏆`,W/2,H/2-10);
        drawScores(W/2-40,H/2+30);
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='16px sans-serif';ctx.fillText('点击或按 空格键 重新开始',W/2,H/2+140);
    }
    ctx.restore();
}

/* ---------- 工具 ---------- */
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function darkenColor(hex,f){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${r*(1-f)|0},${g*(1-f)|0},${b*(1-f)|0})`}

/* ---------- 循环 ---------- */
function gameLoop(){update();draw();animFrameId=requestAnimationFrame(gameLoop)}

/* ---------- 控制 ---------- */
function startGame(){sfx.init();resetGame();state=STATE.PLAYING;startBtn.textContent='重新开始';pauseBtn.disabled=false;pauseBtn.textContent='暂停'}
function togglePause(){if(state===STATE.PLAYING){state=STATE.PAUSED;pauseBtn.textContent='继续'}else if(state===STATE.PAUSED){state=STATE.PLAYING;pauseBtn.textContent='暂停'}}
function launchBall(){if(state!==STATE.PLAYING||balls.length===0)return;for(const b of balls){if(!b.stuck)continue;b.stuck=false;const s=5+(level-1)*0.3,a=-Math.PI/2+(Math.random()-0.5)*0.8;b.dx=Math.cos(a)*s;b.dy=Math.sin(a)*s;b.trail=[]}}

/* ---------- 事件 ---------- */
window.addEventListener('keydown',e=>{switch(e.code){case'ArrowLeft':case'KeyA':keys.left=true;e.preventDefault();break;case'ArrowRight':case'KeyD':keys.right=true;e.preventDefault();break;case'Space':e.preventDefault();if(state===STATE.MENU)startGame();else if(state===STATE.PLAYING&&balls.some(b=>b.stuck))launchBall();else if(state===STATE.PLAYING||state===STATE.PAUSED)togglePause();else if(state===STATE.GAMEOVER||state===STATE.WIN)startGame();break}});
window.addEventListener('keyup',e=>{switch(e.code){case'ArrowLeft':case'KeyA':keys.left=false;e.preventDefault();break;case'ArrowRight':case'KeyD':keys.right=false;e.preventDefault();break}});

// 鼠标
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouseX=(e.clientX-r.left)*(canvas.width/r.width)});
canvas.addEventListener('mouseleave',()=>{mouseX=null});
canvas.addEventListener('click',()=>{if(state===STATE.MENU)startGame();else if(state===STATE.PLAYING&&balls.some(b=>b.stuck))launchBall();else if(state===STATE.GAMEOVER||state===STATE.WIN)startGame()});

// 触屏支持
canvas.addEventListener('touchstart',e=>{e.preventDefault();const t=e.touches[0],r=canvas.getBoundingClientRect();mouseX=(t.clientX-r.left)*(canvas.width/r.width);if(state===STATE.MENU)startGame();else if(state===STATE.PLAYING&&balls.some(b=>b.stuck))launchBall();else if(state===STATE.GAMEOVER||state===STATE.WIN)startGame()},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();const t=e.touches[0],r=canvas.getBoundingClientRect();mouseX=(t.clientX-r.left)*(canvas.width/r.width)},{passive:false});
canvas.addEventListener('touchend',e=>{e.preventDefault();mouseX=null},{passive:false});

startBtn.addEventListener('click',startGame);
pauseBtn.addEventListener('click',togglePause);

/* ---------- 启动 ---------- */
resetGame();gameLoop();
