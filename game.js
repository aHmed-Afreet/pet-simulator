import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const $=s=>document.querySelector(s);
const canvas=$('#game'), worldPill=$('#worldPill'), coinsEl=$('#coins'), petCountEl=$('#petCount');
const targetBox=$('#target'), targetName=$('#targetName'), targetFill=$('#targetFill'), targetHp=$('#targetHp');
const actionBtn=$('#action'), toast=$('#toast'), help=$('#help'), stick=$('#stick'), knob=$('#knob'), jumpBtn=$('#jump');

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9edcff);
scene.fog=new THREE.Fog(0x9edcff,90,260);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,600);

scene.add(new THREE.HemisphereLight(0xffffff,0x4b5b4b,2));
const sun=new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(35,55,-20); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-55; sun.shadow.camera.right=55; sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55;
scene.add(sun);

const WORLD_LEN=100, WORLD_W=68;
const worlds=[
{name:'Meadow',icon:'🌿',ground:0x75c96d,accent:0x3f9f4a,sky:0x9edcff,unlock:0,egg:40,power:2,hp:18,reward:14},
{name:'Desert',icon:'🏜️',ground:0xe4bc6c,accent:0xc98736,sky:0xffd7a6,unlock:250,egg:140,power:5,hp:60,reward:46},
{name:'Ice',icon:'❄️',ground:0xbce8f7,accent:0x66bddb,sky:0xdff7ff,unlock:1100,egg:550,power:11,hp:190,reward:145},
{name:'Volcano',icon:'🌋',ground:0x443b3c,accent:0xff6745,sky:0x80655f,unlock:4200,egg:1900,power:24,hp:560,reward:430},
{name:'Space',icon:'🌌',ground:0x403d79,accent:0x927cff,sky:0x12152f,unlock:14500,egg:6200,power:52,hp:1450,reward:1100}
];

const state={coins:0,unlocked:0,pets:[{name:'Buddy',power:1,color:0xffd34d}]};
try{
 const s=JSON.parse(localStorage.getItem('pet-sim-save')||'null');
 if(s&&Number.isFinite(s.coins)&&Number.isInteger(s.unlocked)&&Array.isArray(s.pets)){
   state.coins=Math.max(0,s.coins); state.unlocked=Math.min(4,Math.max(0,s.unlocked)); state.pets=s.pets.slice(0,40);
 }
}catch{}
const save=()=>localStorage.setItem('pet-sim-save',JSON.stringify(state));

function box(w,h,d,color){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.78}));
 m.castShadow=true;m.receiveShadow=true;return m;
}
function label(text,bg='#202634'){
 const c=document.createElement('canvas');c.width=512;c.height=128;
 const x=c.getContext('2d');x.fillStyle=bg;x.beginPath();x.roundRect(8,8,496,112,28);x.fill();
 x.fillStyle='#fff';x.font='700 42px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,64);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(12,3,1);return s;
}
function rock(g,x,z,color,s=1){
 const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1.8*s,0),new THREE.MeshStandardMaterial({color,roughness:1}));
 m.position.set(x,1.1*s,z);m.rotation.set(Math.random(),Math.random(),Math.random());m.scale.y=.7;m.castShadow=true;g.add(m);
}
function tree(g,x,z){
 const t=box(1.1,5,1.1,0x77502f);t.position.set(x,2.5,z);g.add(t);
 const c=new THREE.Mesh(new THREE.SphereGeometry(3.2,10,8),new THREE.MeshStandardMaterial({color:0x3f9f4a,roughness:1}));
 c.position.set(x,6.8,z);c.castShadow=true;g.add(c);
}

const breakables=[],eggs=[],gates=[];
function addBreakable(g,wi,x,z,type='Pile'){
 const cfg=worlds[wi];
 const color=type==='Chest'?0xd29a3c:type==='Crystal'?cfg.accent:0x98704b;
 const mesh=type==='Crystal'
   ?new THREE.Mesh(new THREE.OctahedronGeometry(2.5),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.15,roughness:.4}))
   :box(type==='Chest'?4.6:3.8,type==='Chest'?3:2.4,type==='Chest'?3.4:3.8,color);
 mesh.position.set(x,type==='Crystal'?2.6:1.35,z);mesh.castShadow=true;g.add(mesh);
 const mul=type==='Chest'?1.7:type==='Crystal'?1.25:1;
 const d={mesh,wi,type,hp:Math.round(cfg.hp*mul),maxHp:Math.round(cfg.hp*mul),reward:Math.round(cfg.reward*mul),alive:true,respawn:0};
 mesh.userData.breakable=d;breakables.push(d);
}
function addDecor(g,wi,z0){
 for(let i=0;i<12;i++){
   const side=i%2?1:-1,x=side*(18+Math.random()*12),z=z0+10+Math.random()*80;
   if(wi===0)tree(g,x,z);
   if(wi===1){const c=box(1.5,6,1.5,0x3d8b57);c.position.set(x,3,z);g.add(c);const a=box(3,1.1,1.1,0x3d8b57);a.position.set(x+side*1.4,3.7,z);g.add(a);}
   if(wi===2){rock(g,x,z,0xdaf7ff,1.2);const p=new THREE.Mesh(new THREE.ConeGeometry(3.1,7.5,8),new THREE.MeshStandardMaterial({color:0x4f8797}));p.position.set(x+side*3,3.8,z+2);p.castShadow=true;g.add(p);}
   if(wi===3){rock(g,x,z,0x292426,1.3);const l=new THREE.PointLight(0xff5a2a,2.2,12);l.position.set(x,2,z);g.add(l);}
   if(wi===4){const o=new THREE.Mesh(new THREE.SphereGeometry(1.6+Math.random(),12,8),new THREE.MeshStandardMaterial({color:i%2?0x7380ff:0x9b83ff,emissive:0x2b215d,emissiveIntensity:.5}));o.position.set(x,2.5+Math.random()*4,z);o.castShadow=true;g.add(o);}
 }
}
function buildWorld(wi){
 const cfg=worlds[wi],z0=wi*WORLD_LEN,g=new THREE.Group();scene.add(g);
 const floor=box(WORLD_W,1,WORLD_LEN,cfg.ground);floor.position.set(0,-.5,z0+WORLD_LEN/2);g.add(floor);
 const path=box(18,.08,WORLD_LEN-8,wi===4?0x5b5c8d:0xeadfc8);path.position.set(0,.04,z0+WORLD_LEN/2);g.add(path);
 const lab=label(cfg.icon+' '+cfg.name);lab.position.set(0,10,z0+12);g.add(lab);
 addDecor(g,wi,z0);
 for(let i=0;i<8;i++){const side=i%2?1:-1;addBreakable(g,wi,side*(7+(i%3)*4.5),z0+24+i*8,i%5===4?'Chest':i%3===0?'Crystal':'Pile');}
 const egg=new THREE.Group(),ped=box(6,1.2,6,0xe8e8ef);ped.position.y=.6;egg.add(ped);
 const shell=new THREE.Mesh(new THREE.SphereGeometry(2.1,20,16),new THREE.MeshStandardMaterial({color:cfg.accent,roughness:.45}));
 shell.scale.y=1.25;shell.position.y=3.2;shell.castShadow=true;egg.add(shell);egg.position.set(-12,0,z0+13);g.add(egg);
 const el=label('Egg · '+cfg.egg+' coins','#253041');el.scale.set(9.5,2.4,1);el.position.set(-12,7.3,z0+13);g.add(el);
 eggs.push({group:egg,wi,pos:egg.position.clone()});
 if(wi<4){
   const gate=new THREE.Group(),z=z0+WORLD_LEN-2;
   const p1=box(3,10,3,0x2b303b),p2=box(3,10,3,0x2b303b),top=box(23,2.5,3,0x2b303b);
   p1.position.set(-10,5,0);p2.position.set(10,5,0);top.position.set(0,10,0);gate.add(p1,p2,top);
   const barrier=new THREE.Mesh(new THREE.BoxGeometry(18,8,.8),new THREE.MeshStandardMaterial({color:0xffcc57,transparent:true,opacity:.6,emissive:0x6e4f10,emissiveIntensity:.4}));
   barrier.position.set(0,4,0);gate.add(barrier);gate.position.z=z;g.add(gate);
   const gl=label('Unlock '+worlds[wi+1].name+' · '+worlds[wi+1].unlock,'#6a4c16');gl.position.set(0,13,z);g.add(gl);
   gates.push({group:gate,barrier,from:wi,to:wi+1,pos:new THREE.Vector3(0,0,z),label:gl});
 }
}
worlds.forEach((_,i)=>buildWorld(i));

const player=new THREE.Group();scene.add(player);
const torso=box(2.1,2.8,1.25,0x2f80ed);torso.position.y=3.7;player.add(torso);
const head=new THREE.Mesh(new THREE.SphereGeometry(.82,16,12),new THREE.MeshStandardMaterial({color:0xf2c89c}));head.position.y=5.8;head.castShadow=true;player.add(head);
const legL=box(.75,2.1,.85,0x27354e),legR=box(.75,2.1,.85,0x27354e);legL.position.set(-.55,1.45,0);legR.position.set(.55,1.45,0);player.add(legL,legR);
const armL=box(.6,2.2,.65,0xf2c89c),armR=box(.6,2.2,.65,0xf2c89c);armL.position.set(-1.35,3.8,0);armR.position.set(1.35,3.8,0);player.add(armL,armR);
player.position.set(0,0,7);

let pets=[];
function createAnimalPet(pet){
 const g=new THREE.Group();
 const color=pet.color||0xffd34d;
 const fur=new THREE.MeshStandardMaterial({color,roughness:.78});
 const dark=new THREE.MeshStandardMaterial({color:0x241d19,roughness:.95});
 const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});
 const n=(pet.name||'').toLowerCase();
 const type=n.includes('bunny')?'bunny':n.includes('fox')?'fox':n.includes('cat')?'cat':n.includes('dragon')?'dragon':'dog';

 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.58,1.25,8,14),fur);
 body.rotation.x=Math.PI/2; body.position.set(0,1.15,.08); body.castShadow=true; g.add(body);

 const chest=new THREE.Mesh(new THREE.SphereGeometry(.56,14,12),fur);
 chest.scale.set(1.02,.92,1.08); chest.position.set(0,1.15,-.56); chest.castShadow=true; g.add(chest);

 const headSize=type==='dog'?.68:type==='bunny'?.61:.64;
 const head=new THREE.Mesh(new THREE.SphereGeometry(headSize,16,14),fur);
 head.position.set(0,1.55,-1.22); head.castShadow=true; g.add(head);

 const snout=new THREE.Mesh(new THREE.SphereGeometry(type==='dog'?.31:.23,12,10),fur);
 snout.scale.set(.9,.72,type==='dog'?1.15:.9); snout.position.set(0,1.38,-1.78); snout.castShadow=true; g.add(snout);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),dark);
 nose.position.set(0,1.4,-2.02); g.add(nose);

 for(const x of[-.23,.23]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),eyeMat);
   eye.position.set(x,1.62,-1.78); g.add(eye);
 }

 if(type==='bunny'){
   for(const x of[-.22,.22]){
     const ear=new THREE.Mesh(new THREE.CapsuleGeometry(.10,.65,6,8),fur);
     ear.position.set(x,2.37,-1.15); ear.rotation.z=x>0?-.08:.08; ear.castShadow=true; g.add(ear);
   }
 }else if(type==='dog'){
   for(const x of[-.47,.47]){
     const ear=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),fur);
     ear.scale.set(.8,1.55,.8); ear.position.set(x,1.75,-1.15); ear.castShadow=true; g.add(ear);
   }
 }else{
   for(const x of[-.35,.35]){
     const ear=new THREE.Mesh(new THREE.ConeGeometry(.20,.48,5),fur);
     ear.position.set(x,2.03,-1.12); ear.rotation.z=x>0?-.16:.16; ear.castShadow=true; g.add(ear);
   }
 }

 const legGeo=new THREE.CylinderGeometry(.16,.20,.95,8);
 for(const [x,z] of[[-.43,-.55],[.43,-.55],[-.43,.55],[.43,.55]]){
   const leg=new THREE.Mesh(legGeo,fur); leg.position.set(x,.55,z); leg.castShadow=true; g.add(leg);
   const paw=new THREE.Mesh(new THREE.SphereGeometry(.21,10,8),fur); paw.scale.set(1.05,.62,1.25); paw.position.set(x,.12,z-.08); paw.castShadow=true; g.add(paw);
 }

 if(type==='bunny'){
   const tail=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),fur);
   tail.position.set(0,1.16,1.25); tail.castShadow=true; tail.userData.tail=true; g.add(tail);
 }else{
   const tail=new THREE.Mesh(new THREE.CylinderGeometry(.055,.10,type==='dog'?.95:1.2,8),fur);
   tail.position.set(0,1.48,1.28); tail.rotation.x=type==='dog'?-.85:-1.05; tail.castShadow=true; tail.userData.tail=true; g.add(tail);
 }
 if(type==='dragon'){
   for(const x of[-.48,.48]){
     const wing=new THREE.Mesh(new THREE.ConeGeometry(.42,.9,3),fur);
     wing.position.set(x,1.65,.15); wing.rotation.z=x>0?-.75:.75; wing.rotation.x=.45; wing.castShadow=true; g.add(wing);
   }
 }
 g.scale.setScalar(.95);
 return g;
}
function rebuildPets(){
 pets.forEach(p=>scene.remove(p.group));pets=[];
 const equipped=[...state.pets].sort((a,b)=>b.power-a.power).slice(0,4);
 equipped.forEach((p,i)=>{
   const g=createAnimalPet(p);
   scene.add(g);pets.push({group:g,data:p,i});
 });
 petCountEl.textContent=equipped.length;
}
rebuildPets();

const keys={};let camYaw=Math.PI,camPitch=.38,camDist=13,vertical=0,grounded=true,shiftLock=false,gait=0;
let activeTarget=null,nearby=null,lastAttack=0,joyX=0,joyY=0;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();

function currentWorld(){return Math.max(0,Math.min(4,Math.floor(player.position.z/WORLD_LEN)));}
function maxZ(){return (state.unlocked+1)*WORLD_LEN-4;}
function say(t){toast.textContent=t;clearTimeout(say.t);say.t=setTimeout(()=>toast.textContent='',1800);}
function updateHUD(){
 const wi=currentWorld(),cfg=worlds[wi];worldPill.textContent=cfg.icon+' '+cfg.name;coinsEl.textContent=Math.floor(state.coins).toLocaleString();
 if(scene.background.getHex()!==cfg.sky){scene.background.set(cfg.sky);scene.fog.color.set(cfg.sky);}
}
function jump(){if(grounded){vertical=8.2;grounded=false;}}
addEventListener('keydown',e=>{
 keys[e.code]=true;
 if(e.code==='Space'){e.preventDefault();jump();}
 if(e.code==='ShiftLeft'){shiftLock=!shiftLock;say(shiftLock?'Shift Lock ON':'Shift Lock OFF');}
 if(e.code==='KeyE') interact();
});
addEventListener('keyup',e=>keys[e.code]=false);

let rotating=false,lastX=0,lastY=0;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button===2){rotating=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);return;}
 if(e.pointerType==='mouse'&&e.button===0) pick(e.clientX,e.clientY);
});
canvas.addEventListener('pointermove',e=>{
 if(rotating){camYaw-=(e.clientX-lastX)*.006;camPitch=Math.max(.08,Math.min(1.05,camPitch+(e.clientY-lastY)*.0045));lastX=e.clientX;lastY=e.clientY;}
});
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'&&e.button===2)rotating=false;});
canvas.addEventListener('wheel',e=>{camDist=Math.max(7,Math.min(22,camDist+e.deltaY*.012));},{passive:true});

function pick(x,y){
 const r=canvas.getBoundingClientRect();pointer.x=((x-r.left)/r.width)*2-1;pointer.y=-((y-r.top)/r.height)*2+1;ray.setFromCamera(pointer,camera);
 const hits=ray.intersectObjects(breakables.filter(b=>b.alive).map(b=>b.mesh),false);
 if(hits.length){activeTarget=hits[0].object.userData.breakable;say('Pets attacking '+activeTarget.type+'!');}
}
function interact(){
 if(!nearby)return;
 if(nearby.kind==='egg'){
  const e=nearby.data,cfg=worlds[e.wi];
  if(state.coins<cfg.egg){say('Need '+(cfg.egg-state.coins)+' more coins');return;}
  state.coins-=cfg.egg;
  const names=['Cat','Dog','Bunny','Fox','Dragon'];const roll=Math.random();
  const mult=roll>.96?2.4:roll>.82?1.65:roll>.5?1.25:1;
  const power=Math.round(cfg.power*mult),color=new THREE.Color().setHSL(Math.random(),.65,.58).getHex();
  const pet={name:names[Math.floor(Math.random()*names.length)],power,color};state.pets.push(pet);rebuildPets();save();say('Hatched '+pet.name+' · '+power+' power!');
 }else{
  const g=nearby.data,cost=worlds[g.to].unlock;
  if(g.to<=state.unlocked){say(worlds[g.to].name+' already unlocked');return;}
  if(state.coins<cost){say('Need '+(cost-state.coins)+' more coins');return;}
  state.coins-=cost;state.unlocked=g.to;g.barrier.visible=false;g.label.visible=false;save();say(worlds[g.to].name+' unlocked!');
 }
}
actionBtn.addEventListener('click',interact);

function updateNearby(){
 nearby=null;let best=8;
 for(const e of eggs){if(e.wi>state.unlocked)continue;const d=player.position.distanceTo(e.pos);if(d<best){best=d;nearby={kind:'egg',data:e};}}
 for(const g of gates){const d=player.position.distanceTo(g.pos);if(d<best){best=d;nearby={kind:'gate',data:g};}}
 if(!nearby){actionBtn.classList.add('hidden');return;}
 actionBtn.classList.remove('hidden');
 if(nearby.kind==='egg')actionBtn.textContent='Hatch Egg · '+worlds[nearby.data.wi].egg+' 🪙';
 else actionBtn.textContent=nearby.data.to<=state.unlocked?'Enter '+worlds[nearby.data.to].name:'Unlock '+worlds[nearby.data.to].name+' · '+worlds[nearby.data.to].unlock+' 🪙';
}

function attack(dt,now){
 if(!activeTarget||!activeTarget.alive){targetBox.classList.add('hidden');activeTarget=null;return;}
 targetBox.classList.remove('hidden');targetName.textContent=activeTarget.type;targetHp.textContent=Math.ceil(activeTarget.hp)+' / '+activeTarget.maxHp;
 targetFill.style.width=(Math.max(0,activeTarget.hp)/activeTarget.maxHp*100)+'%';
 const total=pets.reduce((s,p)=>s+p.data.power,0);
 if(now-lastAttack>330){
   lastAttack=now;activeTarget.hp-=Math.max(1,total);
   activeTarget.mesh.scale.setScalar(.9);setTimeout(()=>activeTarget?.mesh?.scale.setScalar(1),90);
   if(activeTarget.hp<=0){
     const b=activeTarget;b.alive=false;b.mesh.visible=false;b.respawn=now+7000;
     state.coins+=b.reward;save();say('+'+b.reward+' coins');activeTarget=null;targetBox.classList.add('hidden');
   }
 }
}
function respawn(now){
 for(const b of breakables)if(!b.alive&&now>=b.respawn&&b.wi<=state.unlocked){b.alive=true;b.hp=b.maxHp;b.mesh.visible=true;}
}

let stickId=null;
let stickCenter={x:0,y:0};
function showStick(x,y){
 const size=150;
 stickCenter={x,y};
 stick.style.left=(x-size/2)+'px';
 stick.style.top=(y-size/2)+'px';
 stick.style.bottom='auto';
 stick.classList.add('active');
}
function stickMove(e){
 let dx=e.clientX-stickCenter.x,dy=e.clientY-stickCenter.y,max=50;
 const len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}
 joyX=dx/max;joyY=dy/max;knob.style.transform='translate('+dx+'px,'+dy+'px)';
}
function resetStick(e){
 if(e.pointerId!==stickId)return;
 stickId=null;joyX=joyY=0;knob.style.transform='translate(0,0)';stick.classList.remove('active');
}
function touchStartsJoystick(e){
 return e.pointerType==='touch'&&e.clientX<innerWidth*.46&&stickId===null;
}
canvas.addEventListener('pointerdown',e=>{
 if(!touchStartsJoystick(e))return;
 stickId=e.pointerId;showStick(e.clientX,e.clientY);stickMove(e);canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&e.pointerId===stickId)stickMove(e);});
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&e.pointerId===stickId)resetStick(e);});
canvas.addEventListener('pointercancel',e=>{if(e.pointerType==='touch'&&e.pointerId===stickId)resetStick(e);});
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();jump();});

let touchCam=null,touchMoved=false,touchStartX=0,touchStartY=0;
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||e.pointerId===stickId)return;
 touchCam=e.pointerId;touchMoved=false;touchStartX=lastX=e.clientX;touchStartY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch'||e.pointerId!==touchCam||e.pointerId===stickId)return;
 const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.hypot(e.clientX-touchStartX,e.clientY-touchStartY)>10)touchMoved=true;
 camYaw-=dx*.007;camPitch=Math.max(.08,Math.min(1.05,camPitch+dy*.005));lastX=e.clientX;lastY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
 if(e.pointerType!=='touch'||e.pointerId!==touchCam||e.pointerId===stickId)return;
 if(!touchMoved)pick(e.clientX,e.clientY);touchCam=null;
});


let lastTouchEnd=0;
document.addEventListener('touchend',e=>{
 const now=Date.now();
 if(now-lastTouchEnd<350)e.preventDefault();
 lastTouchEnd=now;
},{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});

let last=performance.now();
function loop(now){
 requestAnimationFrame(loop);const dt=Math.min(.033,(now-last)/1000);last=now;
 let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;
 let z=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY;
 const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 const f=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw)),r=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
 const mv=f.clone().multiplyScalar(z).add(r.clone().multiplyScalar(x));
 if(mv.lengthSq()>.001){
   mv.normalize();const speed=10.5;let nx=player.position.x+mv.x*speed*dt,nz=player.position.z+mv.z*speed*dt;
   nx=Math.max(-WORLD_W/2+2,Math.min(WORLD_W/2-2,nx));nz=Math.max(2,Math.min(maxZ(),nz));
   player.position.x=nx;player.position.z=nz;
   const yaw=shiftLock?Math.atan2(f.x,f.z):Math.atan2(mv.x,mv.z);player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,yaw,1-Math.pow(.001,dt));
   gait+=dt*11;legL.rotation.x=Math.sin(gait)*.55;legR.rotation.x=-Math.sin(gait)*.55;armL.rotation.x=-Math.sin(gait)*.4;armR.rotation.x=Math.sin(gait)*.4;
 }else{
   legL.rotation.x*=.82;legR.rotation.x*=.82;armL.rotation.x*=.82;armR.rotation.x*=.82;
   if(shiftLock)player.rotation.y=Math.atan2(f.x,f.z);
 }
 vertical-=22*dt;player.position.y+=vertical*dt;if(player.position.y<=0){player.position.y=0;vertical=0;grounded=true;}
 const focus=player.position.clone().add(new THREE.Vector3(0,3.5,0)),h=Math.cos(camPitch)*camDist;
 const off=new THREE.Vector3(Math.sin(camYaw)*h,Math.sin(camPitch)*camDist+1.2,Math.cos(camYaw)*h);
 if(shiftLock)off.x+=Math.cos(camYaw)*1.6;
 camera.position.lerp(focus.clone().add(off),1-Math.pow(.00005,dt));camera.lookAt(focus);
 const atk=activeTarget?.alive?activeTarget.mesh.position:null;
 pets.forEach((p,i)=>{
   let dest;
   if(atk){const a=i/Math.max(1,pets.length)*Math.PI*2;dest=atk.clone().add(new THREE.Vector3(Math.cos(a)*3.1,0,Math.sin(a)*3.1));}
   else{
     const back=new THREE.Vector3(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y)).multiplyScalar(-4.5-Math.floor(i/2)*2.4);
     const side=new THREE.Vector3(Math.cos(player.rotation.y),0,-Math.sin(player.rotation.y)).multiplyScalar((i%2?1:-1)*(2+Math.floor(i/2)*.35));
     dest=player.position.clone().add(back).add(side);
   }
   p.group.position.lerp(dest,1-Math.pow(.01,dt));p.group.position.y=.2+Math.sin(now*.004+i)*.22;
   if(atk)p.group.lookAt(atk.x,p.group.position.y,atk.z);else p.group.rotation.y=player.rotation.y;
   const tail=p.group.children.find(c=>c.userData&&c.userData.tail);
   if(tail)tail.rotation.z=Math.sin(now*.012+i)*.28;
 });
 eggs.forEach((e,i)=>{e.group.rotation.y+=dt*.65;e.group.children[1].position.y=3.2+Math.sin(now*.002+i)*.18;});
 updateNearby();attack(dt,now);respawn(now);updateHUD();renderer.render(scene,camera);
}
requestAnimationFrame(loop);
setTimeout(()=>help.style.opacity='0',9000);setTimeout(()=>help.style.display='none',9600);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);});
