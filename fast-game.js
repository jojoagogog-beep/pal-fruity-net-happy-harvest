/* Fruity Net! Happy Harvest — original, lightweight canvas production edition.
   30 levels, five worlds, responsive pointer input, original art and soundtrack.
   No third-party scripts, tracking, ads or external dependencies. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const app=$('game'),canvas=$('field'),ctx=canvas.getContext('2d',{alpha:false});
const overlay=$('overlay'),floatLayer=$('floating');
const WORLD=['MINT MEADOW','CITRUS COAST','CANDY CLOUDS','SUNSET FESTIVAL','RAINBOW SKY'];
const WORLD_ID=['mint','citrus','candy','sunset','rainbow'];
const PALETTE=['#70dcbc','#ffc06f','#caaff6','#f8a2b4','#9cc5fc'];
const FRUITS=['apple','orange','strawberry','lemon','grape','watermelon','blueberry','peach','banana','cherry','kiwi','pineapple','mango','starfruit','dragonfruit'];
const VALUES={apple:100,orange:110,strawberry:140,lemon:110,grape:160,watermelon:190,blueberry:130,peach:150,banana:145,cherry:160,kiwi:130,pineapple:190,mango:155,starfruit:200,dragonfruit:220,golden:600,rotten:-150};
const IMAGES={},WORLDS=[],SFX={};
const ASSET='game-assets/';
const music=new Audio();music.loop=true;music.preload='none';music.volume=.28;
let W=390,H=750,DPR=1,lastFrame=0,hudAt=0,lastTimestamp=0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=(a,b)=>a+Math.random()*(b-a);
const choose=a=>a[Math.floor(Math.random()*a.length)];
const zero=n=>String(n).padStart(2,'0');
const saveKey='fruity-net-happy-harvest-js-v1'; // Keep existing saved progress.
const BALANCE_VERSION='2.0';
const RANKS=['GENTLE','WARM-UP','SKILL','TRICKY','EXPERT','MASTER'];
function rankName(level){return RANKS[clamp(Math.floor(level/5),0,5)]}
function netRadius(level){
 // Levels 1-3: generous first catches. Later: precise net throws.
 // Tap versus hold is a genuine risk/reward choice.
 const base=clamp(W*(level<3?.235:level<9?.195:.166),level<9?66:55,level<3?106:level<9?88:73);
 const taper=clamp(level-5,0,24)*.79;
 return clamp(base-taper+(game.netLevel-1)*4,52,110);
}
function holdBonus(ms){return clamp((ms-180)/630,0,1)}
function accuracy(){return game.shots?Math.round(game.hitThrows/game.shots*100):100}

function loadProgress(){
 try{
  const x=JSON.parse(localStorage.getItem(saveKey)||'null')||{};
  return {unlocked:clamp(Number(x.unlocked)||1,1,30),selected:clamp(Number(x.selected)||0,0,29),
    stars:x.stars&&typeof x.stars==='object'?x.stars:{},best:x.best&&typeof x.best==='object'?x.best:{},
    xp:Math.max(0,Number(x.xp)||0),muted:!!x.muted};
 }catch(e){return{unlocked:1,selected:0,stars:{},best:{},xp:0,muted:false}}
}
let profile=loadProgress();
profile.selected=clamp(profile.selected,0,profile.unlocked-1);
function save(){try{localStorage.setItem(saveKey,JSON.stringify(profile))}catch(e){}}
const game={
 mode:'menu',stage:0,world:0,score:0,caught:0,goal:14,combo:0,bestCombo:0,
 lives:3,time:59,round:59,nextSpawn:0,cooldown:0,charge:0,fever:0,netLevel:1,
 fruits:[],nets:[],particles:[],labels:[],tutorial:0,aim:null,dragging:false,
 stars:0,won:false,justUnlocked:false,earnedXp:0,shake:0,musicWorld:-1,
 shots:0,hitThrows:0,misses:0,doubleCatches:0,boss:false,holdStarted:0,netPenalty:0
};
function loadImage(path){
 if(IMAGES[path])return IMAGES[path];
 const img=new Image();img.decoding='async';
 img.src=ASSET+path;
 IMAGES[path]=img;
 return img;
}
function getWorld(n){
 const i=clamp(n|0,0,4);
 if(!WORLDS[i])WORLDS[i]=loadImage('worlds/'+WORLD_ID[i]+'.jpg');
 return WORLDS[i];
}
function sprite(name){return loadImage(name==='mascot'?'mascot.png':'fruits/'+name+'.png')}
function availableMusic(){
 if(profile.muted)return;
 const world=game.world;
 if(game.musicWorld!==world){music.src=ASSET+'audio/'+WORLD_ID[world]+'.mp3';game.musicWorld=world}
 music.play().catch(function(){});
}
function sound(name,pitch){
 if(profile.muted)return;
 if(!SFX[name])SFX[name]=new Audio(ASSET+'audio/'+name+'.wav');
 let play=SFX[name].cloneNode();
 play.volume=name==='bad'?.48:.45;
 if(pitch && pitch!==1)play.playbackRate=pitch;
 play.play().catch(function(){});
 play.addEventListener('ended',function(){play.src='';play=null},{once:true});
}
function resize(){
 const bounds=app.getBoundingClientRect();
 W=Math.max(280,bounds.width);H=Math.max(320,bounds.height);
 DPR=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
 canvas.style.width=W+'px';canvas.style.height=H+'px';
 ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize',resize,{passive:true});resize();
function stageWorld(stage){return Math.min(4,Math.floor(stage/6))}
function goalFor(stage){return 14+Math.floor(stage/6)*4+(stage%6)*3}
function roundFor(stage){return Math.max(47,59-Math.floor(stage/6)*2.3)}
function currentStage(){
 return clamp(profile.selected,0,profile.unlocked-1);
}
function showOverlay(content){
 overlay.classList.remove('hidden');overlay.innerHTML=content;
 app.dataset.state=game.mode;
}
function hideOverlay(){
 overlay.classList.add('hidden');overlay.innerHTML='';
 app.dataset.state=game.mode;
}
function hero(){
 return '<div class="hero-fruits"><img alt="" src="'+ASSET+'fruits/strawberry.png"><img alt="" src="'+ASSET+'fruits/orange.png"><img class="bunny" alt="Smiling bunny mascot" src="'+ASSET+'mascot.png"><img alt="" src="'+ASSET+'fruits/grape.png"><img alt="" src="'+ASSET+'fruits/apple.png"></div>';
}
function renderMenu(){
 game.mode='menu';game.stage=currentStage();game.world=stageWorld(game.stage);
 game.aim=null;game.dragging=false;music.pause();getWorld(game.world);
 const s=game.stage,ww=game.world;
 let html='<div class="panel" role="dialog" aria-label="Fruity Net menu">'+
 '<div class="eyebrow">A LITTLE SLICE OF JOY</div>'+
 '<h1 class="title">FRUITY NET!</h1><div class="subtitle">Happy Harvest</div>'+
 '<div class="tagline">Throw your magical net, catch cute fruit friends & unlock five rainbow worlds!</div>'+
 hero()+
 '<div class="stagebox"><div class="eyebrow">WORLD '+(ww+1)+' / 5 · '+WORLD[ww]+'</div>'+
 '<div class="stage-title">LEVEL '+zero(s+1)+' / 30 · '+rankName(s)+'</div>'+
 '<div class="stage-sub">'+profile.unlocked+' LEVELS UNLOCKED · '+totalStars()+' / 90 STARS · '+profile.xp+' XP</div>'+
 '<div class="button-row">'+
 '<button class="btn lav small" data-action="prev" aria-label="Previous level">◀</button>'+
 '<button class="btn primary" data-action="play">▶ PLAY LEVEL '+zero(s+1)+'</button>'+
 '<button class="btn lav small" data-action="next" aria-label="Next unlocked level">▶</button></div></div>'+
 '<div class="button-row"><button class="btn mint small" data-action="map">LEVEL MAP</button>'+
 '<button class="btn white small" data-action="help">HOW TO PLAY</button></div>'+
 '<div class="statusline">🥝 COLLECT · COMBO · CELEBRATE</div>'+
 '</div>';
 showOverlay(html);
 $('soundToggle').textContent=profile.muted?'♫ OFF':'♫ ON';
}
function totalStars(){return Object.values(profile.stars).reduce((a,b)=>a+Number(b||0),0)}
function renderHelp(){
 showOverlay('<div class="panel" role="dialog" aria-label="How to play">'+
 '<div class="eyebrow">QUICK TUTORIAL</div><h2 class="result-title">CATCH A LITTLE JOY!</h2>'+
 hero()+
 '<div class="mini-card" style="text-align:left;line-height:1.7;font-size:14px">'+
 '🎯 <b>TAP AHEAD</b> of a moving fruit. Your net takes time to arrive.<br>'+
 '🕸️ <b>HOLD, AIM & RELEASE</b> to charge a wider net (slower reload).<br>'+
 '🍓 Catch <b>3 fruits together</b> for a JUICY COMBO.<br>'+
 '🌈 Build your Rainbow meter for a BIG FEVER NET.<br>'+
 '✨ Catch golden fruit for bonus points. Avoid rotten fruit.<br>'+
 '⏱️ Later levels: missed nets cost time. Accuracy earns better stars.<br>'+
 '🏆 Meet the target before time runs out to unlock the next level!'+
 '</div><button class="btn primary" data-action="play">LET’S CATCH FRUITS!</button>'+
 '<button class="btn white small" data-action="menu" style="width:100%;margin-top:12px">BACK TO MENU</button></div>');
}
function renderMap(){
 let html='<div class="panel" role="dialog" aria-label="30-level world map">'+
 '<div class="eyebrow">YOUR FRUIT JOURNEY</div><h2 class="result-title" style="margin:4px 0">LEVEL MAP</h2>'+
 '<div class="stage-sub">'+profile.unlocked+' / 30 UNLOCKED · '+totalStars()+' ★ EARNED</div>'+
 '<div class="world-list">';
 for(let w=0;w<5;w++){
  html+='<div class="level-group">WORLD '+(w+1)+' · '+WORLD[w]+'</div><div class="level-row">';
  for(let n=w*6;n<(w+1)*6;n++){
   const unlocked=n<profile.unlocked,selected=n===profile.selected;
   const stars=profile.stars[String(n)]||0;
   html+='<button class="level-cell'+(selected?' current':'')+'" data-action="choose" data-stage="'+n+'"'+(unlocked?'':' disabled')+'>'+
    (unlocked?'LEVEL '+zero(n+1):'🔒 '+zero(n+1))+
    '<small>'+(unlocked?('★'.repeat(stars)+'☆'.repeat(3-stars)):'LOCKED')+'</small></button>';
  }
  html+='</div>';
 }
 html+='</div><div class="button-row"><button class="btn primary" data-action="play">▶ PLAY LEVEL '+zero(profile.selected+1)+'</button>'+
 '<button class="btn white small" data-action="menu">BACK</button></div></div>';
 showOverlay(html);
}
function resultStars(){
 // A large score from a single giant cluster no longer guarantees 3 stars.
 const base=game.goal*130;
 const a=accuracy();
 const threshold=game.stage<3?68:game.stage<10?73:78;
 if(a>=threshold && game.misses<=2 && game.time>=game.round*.25 &&
    game.score>=base*1.45 && game.lives>=2)return 3;
 if(a>=Math.max(50,threshold-20) && game.lives>=1 &&
    game.time>=game.round*.10)return 2;
 return 1;
}
function renderResult(){
 const was=game.won;
 const next=game.stage+1<profile.unlocked;
 const title=was?'SWEET VICTORY!':'ALMOST RIPE!';
 const stars=was?'★'.repeat(game.stars)+'☆'.repeat(3-game.stars):'☆☆☆';
 let html='<div class="panel" role="dialog" aria-label="Level results">'+
 '<div class="eyebrow">WORLD '+(game.world+1)+' · LEVEL '+zero(game.stage+1)+'</div>'+
 '<h2 class="result-title">'+title+'</h2>'+
 '<div class="starline">'+stars+'</div>'+
 '<div class="result-score">'+game.score.toLocaleString()+'</div>'+
 '<div class="stage-sub">'+(was?'GARDEN POINTS!':'SCORE · KEEP TRYING!')+'</div>'+
 '<div class="card-grid"><div class="mini-card"><small>FRUITS</small><strong>'+game.caught+' / '+game.goal+'</strong></div>'+
 '<div class="mini-card"><small>ACCURACY</small><strong>'+accuracy()+'%</strong></div></div>'+
 '<div class="stage-sub">BEST COMBO '+game.bestCombo+' · MISSED NETS '+game.misses+'</div>'+
 '<div class="statusline">'+(was?(game.justUnlocked?'🔓 LEVEL '+zero(game.stage+2)+' UNLOCKED! ':'')+'+'+game.earnedXp+' GARDEN XP':'Catch more fruit in the time limit and try again!')+'</div>'+
 '<div class="button-row"><button class="btn primary" data-action="'+(was&&next?'nextlevel':'retry')+'">'+
 (was&&next?'▶ NEXT LEVEL':'↻ RETRY LEVEL')+'</button></div>'+
 '<div class="button-row"><button class="btn mint small" data-action="retry">REPLAY</button>'+
 '<button class="btn white small" data-action="menu">LEVEL MAP</button></div></div>';
 showOverlay(html);
}
function endLevel(won){
 if(game.mode!=='play')return;
 game.mode='result';game.won=!!won;game.justUnlocked=false;game.earnedXp=0;game.stars=0;
 music.pause();
 if(won){
  game.stars=resultStars();
  const key=String(game.stage),old=Number(profile.stars[key]||0);
  profile.stars[key]=Math.max(old,game.stars);
  profile.best[key]=Math.max(Number(profile.best[key]||0),game.score);
  game.earnedXp=75+game.stars*35;
  profile.xp+=game.earnedXp;
  if(profile.unlocked===game.stage+1&&profile.unlocked<30){profile.unlocked++;game.justUnlocked=true}
  save();sound('win');burst(W*.5,H*.46,'#ffe7a0',44);
 }else{sound('bad')}
 renderResult();
}
function startLevel(which){
 game.mode='play';game.stage=clamp(which,0,profile.unlocked-1);profile.selected=game.stage;save();
 game.world=stageWorld(game.stage);getWorld(game.world);
 game.score=0;game.caught=0;game.goal=goalFor(game.stage);
 game.combo=0;game.bestCombo=0;game.lives=3;
 game.shots=0;game.hitThrows=0;game.misses=0;game.doubleCatches=0;
 game.boss=game.stage%6===5;
 game.time=roundFor(game.stage)+(game.boss?6:0);game.round=game.time;game.nextSpawn=.5;game.cooldown=0;
 game.charge=0;game.fever=0;game.netLevel=1+Math.min(2,Math.floor(game.stage/10));
 game.fruits=[];game.nets=[];game.particles=[];game.labels=[];game.shake=0;game.tutorial=0;
 game.dragging=false;game.aim=null;game.musicWorld=-1;
 for(let i=0;i<(game.stage<5?6:5);i++)spawnFruit(true);
 hideOverlay();updateHud(true);availableMusic();sound('tap',1.12);
}
function pause(){
 if(game.mode!=='play')return;
 game.mode='pause';music.pause();sound('tap');
 showOverlay('<div class="panel" role="dialog" aria-label="Paused game"><div class="eyebrow">A LITTLE REST</div>'+
 '<h2 class="result-title">PAUSED ♡</h2>'+hero()+
 '<div class="tagline">Your fruit friends will be right here!</div>'+
 '<button class="btn primary" data-action="resume">▶ KEEP CATCHING</button>'+
 '<div class="button-row"><button class="btn mint small" data-action="retry">RESTART</button>'+
 '<button class="btn white small" data-action="menu">LEVEL MAP</button></div></div>');
}
function resume(){if(game.mode!=='pause')return;game.mode='play';hideOverlay();availableMusic()}
function goMenu(){renderMenu()}
function handleAction(action,elem){
 sound('tap',1);
 if(action==='play'){startLevel(profile.selected);return}
 if(action==='prev'){profile.selected=Math.max(0,profile.selected-1);save();renderMenu();return}
 if(action==='next'){profile.selected=Math.min(profile.unlocked-1,profile.selected+1);save();renderMenu();return}
 if(action==='choose'){
  let n=Number(elem.dataset.stage);
  if(n>=0&&n<profile.unlocked){profile.selected=n;save();renderMenu()}
  return;
 }
 if(action==='map'){renderMap();return}
 if(action==='help'){renderHelp();return}
 if(action==='menu'){goMenu();return}
 if(action==='retry'){startLevel(game.stage);return}
 if(action==='nextlevel'){startLevel(Math.min(profile.unlocked-1,game.stage+1));return}
 if(action==='pause'){pause();return}
 if(action==='resume'){resume();return}
}
overlay.addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');
 if(b && !b.disabled){e.preventDefault();handleAction(b.dataset.action,b)}
});
$('pauseBtn').addEventListener('click',e=>{e.preventDefault();pause()});
$('soundToggle').addEventListener('click',()=>{
 profile.muted=!profile.muted;save();
 $('soundToggle').textContent=profile.muted?'♫ OFF':'♫ ON';
 if(profile.muted)music.pause();
 else if(game.mode==='play')availableMusic();
});
window.addEventListener('keydown',e=>{
 if(['Space','Enter'].includes(e.code)){
  if(game.mode==='menu'){e.preventDefault();startLevel(profile.selected)}
  else if(game.mode==='result'){e.preventDefault();startLevel(game.won?Math.min(profile.unlocked-1,game.stage+1):game.stage)}
  else if(game.mode==='pause'){e.preventDefault();resume()}
 }else if(e.code==='Escape'||e.code==='KeyP'){
  if(game.mode==='play')pause();else if(game.mode==='pause')resume();else if(game.mode==='menu')renderMenu();
 }else if(game.mode==='menu'&&e.code==='ArrowRight'){profile.selected=Math.min(profile.unlocked-1,profile.selected+1);save();renderMenu()}
 else if(game.mode==='menu'&&e.code==='ArrowLeft'){profile.selected=Math.max(0,profile.selected-1);save();renderMenu()}
});
function spawnFruit(begin,around){
 if(game.fruits.length>=(game.stage<6?15:game.stage<17?11:9))return null;
 const roll=Math.random(),tier=game.world,level=game.stage;
 let name;
 if(roll<(level<3?0:.036+tier*.012))name='rotten';
 else if(roll>.980-tier*.002)name='golden';
 else name=FRUITS[Math.floor(Math.random()*Math.min(FRUITS.length,7+tier*2))];
 const size=Math.max(63,Math.min(104,W*.206))*rand(.80,1.09)*
  (name==='watermelon'||name==='golden'?1.13:1);
 const minY=136,maxY=Math.max(205,H-154);
 const side=Math.random()<.5?-1:1;
 const gap=level<3?43:level<8?76:level<17?104:122;
 let x=around?around.x+rand(-gap,gap):(begin?rand(size/2,W-size/2):(side<0?-size/2:W+size/2));
 let y=around?around.y+rand(-gap*.78,gap*.78):rand(minY+18,maxY-20);
 x=clamp(x,-size/2,W+size/2);y=clamp(y,minY,maxY);
 // Motion classes become available one at a time; fast apples are not introduced on level 1.
 const movement=level<4?'drift':level<9?
  (Math.random()<.40?'zigzag':'drift'):
  (Math.random()<.24?'dash':Math.random()<.53?'zigzag':'swoop');
 const speed=rand(34,59)*(1+level*.033)*(movement==='dash'?1.44:1);
 const direction=x<W*.5?1:-1;
 const f={name,x,y,vx:direction*speed,vy:rand(-13,13),size,
  age:0,phase:rand(0,Math.PI*2),bob:rand(.7,1.3),
  movement,uid:Math.random(),rot:rand(-.07,.07),lastDash:0};
 game.fruits.push(f);sprite(name);return f;
}
function spawnCluster(){
 const level=game.stage;
 const count=level<3?(Math.random()<.65?3:2):
             level<9?(Math.random()<.37?3:2):
             (Math.random()<.42?3:2);
 let prev=null;
 for(let i=0;i<count;i++)prev=spawnFruit(false,i>0?prev:null)||prev;
}
function addLabel(x,y,text,color){
 const node=document.createElement('div');node.className='float-label';node.textContent=text;node.style.color=color;
 node.style.left=(x/W*100)+'%';node.style.top=(y/H*100)+'%';
 floatLayer.appendChild(node);setTimeout(()=>node.remove(),1000);
}
function burst(x,y,color,count){
 for(let i=0;i<count;i++){
  let a=rand(0,6.283),s=rand(35,175);
  game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,age:0,life:rand(.3,.8),
   size:rand(2,6),color,rect:i%4===0});
 }
 if(game.particles.length>220)game.particles.splice(0,game.particles.length-220);
}
function catchFruit(f){
 if(f.name==='rotten'){
  game.lives=Math.max(0,game.lives-1);game.combo=0;game.charge=Math.max(0,game.charge-18);
  game.score=Math.max(0,game.score-100);
  addLabel(f.x,f.y-18,'OOPS! −1 ♥','#e05a7c');sound('bad');
  burst(f.x,f.y,'#a38d8a',18);game.shake=.5;return false;
 }
 const multiplier=1+Math.min(4,Math.floor(game.combo/5))+(game.fever>0?2:0);
 const points=(VALUES[f.name]||100)*multiplier;
 game.score+=points;game.combo++;game.bestCombo=Math.max(game.bestCombo,game.combo);
 game.caught++;game.charge=Math.min(100,game.charge+(f.name==='golden'?20:6));
 const gold=f.name==='golden';
 addLabel(f.x,f.y-20,gold?'GOLDEN +'+points:'+'+points,gold?'#ce9f37':'#d8649d');
 burst(f.x,f.y,gold?'#ffe48a':'#ffadd1',gold?22:10);
 sound(gold?'rare':'catch',rand(.92,1.12));
 if(game.charge>=100&&game.fever<=0){game.fever=8.5;game.charge=100;addLabel(W*.5,H*.4,'🌈 RAINBOW FEVER!','#cb68ad');sound('combo')}
 return true;
}
function launchNet(x,y,heldMs=0){
 if(game.mode!=='play'||game.cooldown>0||game.nets.length>=3)return false;
 const target={x:clamp(x,44,W-44),y:clamp(y,134,H-138)};
 const origin={x:W*.5,y:H-88};
 const charged=holdBonus(heldMs);
 const rad=netRadius(game.stage)*(1+charged*.24)+(game.fever>0?36:0);
 const dist=Math.hypot(target.x-origin.x,target.y-origin.y);
 game.nets.push({from:origin,to:target,age:0,travel:clamp(dist/1050,.22,.49),
   r:rad,hits:0,awarded:false,charged});
 game.shots++;
 game.cooldown=(game.fever>0?.21:.38)+charged*.30;
 sound('throw',rand(.94,1.07));
 return true;
}
function pointerAt(e){
 const r=canvas.getBoundingClientRect();
 return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
}
canvas.addEventListener('pointerdown',e=>{
 if(game.mode!=='play')return;
 e.preventDefault();
 game.dragging=true;game.aim=pointerAt(e);game.holdStarted=performance.now();
 try{canvas.setPointerCapture(e.pointerId)}catch(err){}
});
canvas.addEventListener('pointermove',e=>{
 if(game.mode==='play'&&game.dragging){game.aim=pointerAt(e);e.preventDefault()}
});
canvas.addEventListener('pointerup',e=>{
 if(game.mode!=='play'||!game.dragging)return;
 e.preventDefault();
 const target=pointerAt(e);const heldMs=performance.now()-game.holdStarted;
 game.dragging=false;game.aim=null;
 launchNet(target.x,target.y,heldMs);
});
canvas.addEventListener('pointercancel',()=>{game.dragging=false;game.aim=null});
function updateHud(force){
 if(!force&&performance.now()-hudAt<90)return;
 hudAt=performance.now();
 $('stageLabel').textContent='LEVEL '+zero(game.stage+1);
 $('worldLabel').textContent=WORLD[game.world].split(' ')[0];
 $('hudGoal').textContent=game.caught+' / '+game.goal;
 $('hudTimer').textContent=Math.max(0,Math.ceil(game.time))+'s';
 $('hudScore').textContent='SCORE '+game.score.toLocaleString();
 $('barFill').style.width=(clamp(game.caught/game.goal,0,1)*100)+'%';
 $('combo').textContent='COMBO '+game.combo+'  ·  x'+(1+Math.min(4,Math.floor(game.combo/5)));
 $('netStatus').textContent=game.cooldown>.10?'NET RELOADING…':
    'HOLD FOR WIDER NET · '+rankName(game.stage);
 $('life').textContent='♥'.repeat(game.lives)+'♡'.repeat(3-game.lives);
 $('feverMeter').textContent=game.fever>0?'🌈 RAINBOW FEVER!':'RAINBOW '+Math.floor(game.charge)+'%';
}
function tick(dt){
 if(game.mode!=='play')return;
 game.time-=dt;game.tutorial+=dt;game.cooldown=Math.max(0,game.cooldown-dt);
 if(game.fever>0){game.fever-=dt;if(game.fever<=0)game.charge=0}
 game.shake=Math.max(0,game.shake-dt*2.7);
 game.nextSpawn-=dt;
 if(game.nextSpawn<=0){
  spawnCluster();
  // More fruit still spawn at high levels; success relies on accuracy,
  // not being forced to wait for spawns.
  game.nextSpawn=rand(1.08,1.54)/(1+Math.min(0.28,game.stage*.012));
 }
 const playMin=137,playMax=H-139;
 for(let i=game.fruits.length-1;i>=0;i--){
  const f=game.fruits[i];f.age+=dt;f.x+=f.vx*dt;
  const sway=f.movement==='zigzag'?85:f.movement==='swoop'?66:12;
  const rate=f.movement==='zigzag'?5.1:f.movement==='swoop'?2.8:3.3;
  f.y+=f.vy*dt+Math.sin(f.age*rate+f.phase)*dt*sway;
  if(f.movement==='dash'&&f.age-f.lastDash>2.3){
   f.vx=clamp(f.vx*1.26,-205,205);f.lastDash=f.age;
   burst(f.x,f.y,'#dcf6ff',3);
  }
  if(f.x<f.size*.29){f.x=f.size*.29;f.vx=Math.abs(f.vx)}
  if(f.x>W-f.size*.29){f.x=W-f.size*.29;f.vx=-Math.abs(f.vx)}
  if(f.y<playMin){f.y=playMin;f.vy=Math.abs(f.vy)+3}
  if(f.y>playMax){f.y=playMax;f.vy=-Math.abs(f.vy)-3}
  if(f.age>(game.stage<6?14:11.2))game.fruits.splice(i,1);
 }
 for(let i=game.nets.length-1;i>=0;i--){
  const n=game.nets[i];n.age+=dt;
  if(n.age>=n.travel && n.age<=n.travel+.29){
   const radius=n.r*clamp((n.age-n.travel)/.17,.09,1);
   const hitsBefore=n.hits;
   for(let j=game.fruits.length-1;j>=0;j--){
    const f=game.fruits[j];
    if(Math.hypot(f.x-n.to.x,f.y-n.to.y)<radius-f.size*.105){
     const good=catchFruit(f);if(good)n.hits++;
     game.fruits.splice(j,1);
    }
   }
   if(hitsBefore===0&&n.hits>0)game.hitThrows++;
   if(!n.awarded&&n.age>n.travel+.30){
    n.awarded=true;
    if(n.hits>=2)game.doubleCatches++;
    if(n.hits>=3){
     game.score+=n.hits*75;addLabel(n.to.x,n.to.y-40,'JUICY x'+n.hits+'!','#b471d6');
     sound('combo');game.shake=.32;
    }else if(n.hits===2){addLabel(n.to.x,n.to.y-35,'DOUBLE CATCH!','#ee81a7')}
   }
  }
  if(n.age>n.travel+.57){
   if(n.hits===0){
    game.combo=0;game.misses++;
    const penalty=game.stage<3?0:game.stage<10?1.15:1.8;
    game.time=Math.max(0,game.time-penalty);
    addLabel(n.to.x,n.to.y,penalty?'MISSED! −'+penalty+'s':'SO CLOSE!','#a67d9d');
   }
   game.nets.splice(i,1);
  }
 }
 for(let i=game.particles.length-1;i>=0;i--){
  const p=game.particles[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;
  if(p.age>=p.life)game.particles.splice(i,1);
 }
 updateHud();
 if(game.caught>=game.goal)endLevel(true);
 else if(game.time<=0||game.lives<=0)endLevel(false);
}
function drawCover(img){
 if(img&&img.complete&&img.naturalWidth>0){
  const sc=Math.max(W/img.naturalWidth,H/img.naturalHeight);
  const sw=W/sc,sh=H/sc,sx=(img.naturalWidth-sw)/2,sy=(img.naturalHeight-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
 }else{
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#b5f4fb');g.addColorStop(.68,'#e8fbdc');g.addColorStop(1,'#7ed2a6');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 }
}
function drawSprite(name,x,y,size,angle){
 const img=sprite(name);
 if(img.complete&&img.naturalWidth>0){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
  ctx.shadowColor='rgba(73,98,96,.21)';ctx.shadowBlur=10;ctx.shadowOffsetY=7;
  ctx.drawImage(img,-size*.5,-size*.5,size,size);ctx.restore();
 }else{
  ctx.fillStyle='#ff87ad';ctx.beginPath();ctx.arc(x,y,size*.3,0,Math.PI*2);ctx.fill();
 }
}
function drawNet(n){
 const tt=clamp(n.age/n.travel,0,1),t=tt*tt*(3-2*tt);
 const x=n.from.x+(n.to.x-n.from.x)*t,y=n.from.y+(n.to.y-n.from.y)*t;
 const open=clamp((n.age-n.travel)/.19,0,1),fade=clamp((n.travel+.57-n.age)/.19,0,1);
 const r=n.age>=n.travel?14+(n.r-14)*open:12+tt*18;
 ctx.save();ctx.lineCap='round';
 ctx.strokeStyle='rgba(91,160,153,'+(.55*fade)+')';ctx.lineWidth=4;
 ctx.beginPath();ctx.moveTo(n.from.x,n.from.y);ctx.quadraticCurveTo((n.from.x+x)/2-22,(n.from.y+y)/2-30,x,y);ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,'+(.9*fade)+')';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(n.from.x,n.from.y);ctx.quadraticCurveTo((n.from.x+x)/2-20,(n.from.y+y)/2-32,x,y);ctx.stroke();
 ctx.shadowColor='rgba(255,255,255,.75)';ctx.shadowBlur=15;
 ctx.fillStyle='rgba(181,255,235,'+(.19*fade)+')';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(x,y,Math.max(0,r-5),0,Math.PI*2);ctx.clip();
 ctx.shadowBlur=0;ctx.lineWidth=1.7;
 for(let k=-5;k<=5;k++){
  const off=k*r/5;
  ctx.strokeStyle='rgba(255,255,255,'+(.58*fade)+')';
  ctx.beginPath();ctx.moveTo(x-r,y+off);ctx.lineTo(x+r,y+off);ctx.stroke();
  ctx.strokeStyle='rgba(102,200,183,'+(.50*fade)+')';
  ctx.beginPath();ctx.moveTo(x+off,y-r);ctx.lineTo(x+off,y+r);ctx.stroke();
 }
 ctx.restore();
 ctx.lineWidth=5;ctx.strokeStyle='rgba(255,255,255,'+(.95*fade)+')';
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
 ctx.lineWidth=3;ctx.strokeStyle='rgba(79,204,165,'+(.9*fade)+')';
 ctx.beginPath();ctx.arc(x,y,r-4,0,Math.PI*2);ctx.stroke();
 ctx.restore();
}
function drawFrame(timestamp){
 const dt=clamp((timestamp-lastTimestamp)/1000,0,.055);lastTimestamp=timestamp;
 tick(dt);
 ctx.setTransform(DPR,0,0,DPR,0,0);
 ctx.save();
 if(game.shake>0&&game.mode==='play')ctx.translate(rand(-4,4)*game.shake,rand(-4,4)*game.shake);
 drawCover(getWorld(game.world));
 ctx.fillStyle='rgba(255,255,255,.035)';ctx.fillRect(0,0,W,H);
 if(game.mode==='play'||game.mode==='pause'||game.mode==='result'){
  if(game.fever>0){
   const fx=ctx.createRadialGradient(W*.5,H*.42,30,W*.5,H*.42,Math.max(W,H)*.7);
   fx.addColorStop(0,'rgba(250,210,255,.09)');fx.addColorStop(1,'rgba(145,236,250,.13)');
   ctx.fillStyle=fx;ctx.fillRect(0,0,W,H);
  }
  for(const f of game.fruits){
   const pY=f.y+Math.sin(timestamp*.002*f.bob+f.phase)*4.5;
   drawSprite(f.name,f.x,pY,f.size,Math.sin(timestamp*.0009+f.phase)*.07);
   if(f.name==='golden'){
    ctx.save();ctx.strokeStyle='#fff4a0';ctx.lineWidth=3;ctx.globalAlpha=.72+Math.sin(timestamp*.007)*.2;
    ctx.beginPath();ctx.arc(f.x,pY,f.size*.39,0,Math.PI*2);ctx.stroke();ctx.restore();
   }
  }
  for(const n of game.nets)drawNet(n);
  if(game.dragging&&game.aim){
   const x=clamp(game.aim.x,44,W-44),y=clamp(game.aim.y,133,H-139);
   const heldMs=performance.now()-game.holdStarted;
   const radius=netRadius(game.stage)*(1+.24*holdBonus(heldMs))+(game.fever>0?36:0);
   ctx.save();ctx.setLineDash([10,7]);ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.91)';
   ctx.beginPath();ctx.moveTo(W*.5,H-89);ctx.lineTo(x,y);ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  drawSprite('mascot',W*.5,H-92,clamp(W*.27,83,123),0);
  for(const p of game.particles){
   const a=clamp(1-p.age/p.life,0,1);ctx.globalAlpha=a;ctx.fillStyle=p.color;
   if(p.rect)ctx.fillRect(p.x,p.y,p.size,p.size*.64);
   else{ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}
  }
  ctx.globalAlpha=1;
  if(game.mode==='play'&&game.tutorial<5.4){
   const boxW=Math.min(338,W-30),boxX=(W-boxW)/2,y=H*.48;
   ctx.fillStyle='rgba(255,255,255,.78)';
   ctx.beginPath();ctx.roundRect(boxX,y-34,boxW,73,17);ctx.fill();
   ctx.textAlign='center';ctx.fillStyle='#dc649a';ctx.font='bold 16px system-ui';
   ctx.fillText('AIM AHEAD OF MOVING FRUITS!',W*.5,y-5);
   ctx.fillStyle='#6e9aa4';ctx.font='bold 12px system-ui';
   ctx.fillText('Hold to widen your net · Misses cost time later!',W*.5,y+18);
  }
 }else{
  const shapes=['strawberry','orange','grape','apple','lemon','peach'];
  const y=H*.74;
  for(let i=0;i<6;i++){
   const x=W*(.1+i*.16)+Math.sin(timestamp*.0004+i)*W*.025;
   drawSprite(shapes[i],x,y+Math.sin(timestamp*.001+i)*18,Math.max(54,Math.min(100,W*.17)),Math.sin(timestamp*.0005+i)*.15);
  }
 }
 ctx.restore();
 requestAnimationFrame(drawFrame);
}
function launch(){
 resize();loadImage('mascot.png');getWorld(0);
 ['strawberry','orange','grape','apple','lemon','peach'].forEach(sprite);
 profile.selected=clamp(profile.selected,0,profile.unlocked-1);
 $('soundToggle').textContent=profile.muted?'♫ OFF':'♫ ON';
 renderMenu();
 $('loading').classList.add('gone');
 setTimeout(()=>$('loading').remove(),420);
 requestAnimationFrame(drawFrame);
}
if(new URLSearchParams(location.search).get('qa')==='1'){
 window.FruityQA={
  snapshot:()=>({mode:game.mode,stage:game.stage,world:game.world,unlocked:profile.unlocked,
    caught:game.caught,goal:game.goal,score:game.score,combo:game.combo,lives:game.lives,
    netCount:game.nets.length,fruitCount:game.fruits.length,fever:game.fever,
    stars:totalStars(),radius:netRadius(game.stage),shots:game.shots,
    hitThrows:game.hitThrows,misses:game.misses,accuracy:accuracy(),
    rank:rankName(game.stage),moving:game.fruits.map(f=>f.movement),
    nets:game.nets.map(n=>({radius:Math.round(n.r),charged:n.charged})),
    cooldown:Math.round(game.cooldown*100)/100,remaining:game.time}),
  start:(i)=>startLevel(i),
  unlockForTest:(i)=>{profile.unlocked=Math.max(profile.unlocked,clamp(i+1,1,30));startLevel(i);},
  net:(x,y,heldMs=0)=>launchNet(x,y,heldMs),
  forceCluster:()=>{
   game.fruits=[];
   for(let i=0;i<3;i++){
    const f=spawnFruit(true);f.name='strawberry';f.x=W*.5+(i-1)*28;f.y=H*.39;f.vx=0;f.vy=0;
   }
   game.cooldown=0;return game.fruits.map(f=>({x:f.x,y:f.y}));
  },
  tick:(seconds)=>tick(seconds),
  fail:()=>endLevel(false),
  win:()=>endLevel(true),
  choose:(i)=>{if(i<profile.unlocked){profile.selected=i;renderMenu()}},
  progress:()=>JSON.parse(JSON.stringify(profile))
 };
}
window.addEventListener('offline',()=>{$('offline').style.display='block'});
window.addEventListener('online',()=>{$('offline').style.display='none'});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launch,{once:true});
else launch();
})();