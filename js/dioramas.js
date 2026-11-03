import * as T from './vendor/three.module.js';

// 所有模型在本地生成，三个场景共用一个画布，只渲染当前场景。
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scenes = new Map();
const pointer = {x:0,y:0,drag:false,lastX:0};
let active = null;
let seed = 731;
const random = () => {seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const mat = (color, extra={}) => new T.MeshStandardMaterial({color,roughness:.77,...extra});
const materials = {
  leaf: mat('#728b77',{side:T.DoubleSide}),stem:mat('#587568'),wood:mat('#5b4541'),
  brass:mat('#cbb48b',{metalness:.55,roughness:.4}),metal:mat('#435269',{metalness:.45}),
  warm:mat('#f7d2a2',{emissive:'#ffd2a0',emissiveIntensity:1.5}),dark:mat('#293446')
};
function mesh(geo,material,parent,x=0,y=0,z=0){
  const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(parent,w,h,d,x,y,z,material){return mesh(new T.BoxGeometry(w,h,d),material,parent,x,y,z);}
function ball(parent,r,x,y,z,material,sx=1,sy=1,sz=1){const m=mesh(new T.SphereGeometry(r,14,9),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
function rod(parent,a,b,r,material,r2=r){
  const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);
  const m=mesh(new T.CylinderGeometry(r2,r,dir.length(),9),material,parent);
  m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m;
}
function label(parent,text,w,h,x,y,z,bg='#534c55',ink='#f4e2ba'){
  const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);
  const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle='#b8a087';ctx.lineWidth=6;ctx.strokeRect(18,18,c.width-36,c.height-36);
  ctx.fillStyle=ink;ctx.font=`${Math.round(c.height*.52)}px "KaiTi","STKaiti",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height*.53);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.8}),parent,x,y,z);
}
function texture(color,grain=18){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  for(let i=0;i<3000;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,255':'0,0,0'},${random()*.09})`;ctx.fillRect(random()*256,random()*256,random()*grain,1);}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
function base(kind){
  const scene=new T.Scene();scene.background=new T.Color(kind==='flowers'?'#b5b0c4':'#777a99');
  scene.fog=new T.Fog(scene.background,25,60);
  const world=new T.Group();scene.add(world);
  const slab=mat('#41465c');box(world,10,.36,7,0,-.25,0,slab);
  box(world,9.92,.04,6.92,0,-.04,0,mat(kind==='flowers'?'#8a958b':'#727781'));
  // 台座饰边和小铭牌提供收藏模型的质感。
  box(world,10,.035,.025,0,-.22,3.515,materials.brass);
  label(world,'2026 · 01 · 03',2,.25,0,-.22,3.526,'#41465c','#d8c8b0');
  const ambient=new T.HemisphereLight('#e4e4fa',kind==='flowers'?'#6d7766':'#3a3445',2.1);scene.add(ambient);
  const sun=new T.DirectionalLight('#ffebce',kind==='flowers'?3.2:1.15);sun.position.set(-5,11,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.normalBias=.035;scene.add(sun);
  const fill=new T.DirectionalLight('#b3b8ff',1.2);fill.position.set(7,4,-6);scene.add(fill);
  const floor=mesh(new T.PlaneGeometry(200,200),mat(kind==='flowers'?'#b5b0c4':'#777a99'),scene,0,-.46,0);floor.rotation.x=-Math.PI/2;
  return {scene,world,animated:[],yaw:0,kind};
}

// 洋桔梗花瓣是起伏的薄曲面，外层展开、内层成杯，不使用圆球替代花朵。
function petalGeometry(size,index){
  const g=new T.PlaneGeometry(1,1,12,14);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const u=p.getX(i)*2,v=p.getY(i)+.5;
    const width=Math.pow(Math.sin(v*Math.PI*.89),.68)*.62+.025;
    const x=u*width*size;
    const y=(v*.94+.035*Math.sin(u*13+index)*Math.pow(v,4))*size;
    const z=(.14*Math.sin(v*Math.PI)+.5*v*v+.045*Math.cos(u*11+index)*v*v)*size;
    p.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals();return g;
}
const petalMats=['#f4efe5','#ddd4e8','#c0b3dc','#faf5ed'].map(color=>mat(color,{side:T.DoubleSide,roughness:.54}));
function lisianthus(parent,x,z,height,colorIndex){
  const group=new T.Group();parent.add(group);group.position.set(x,0,z);group.rotation.z=(random()-.5)*.17;
  const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,0,0),new T.Vector3(-.16,height*.6,0),new T.Vector3(.05,height,0));
  mesh(new T.TubeGeometry(curve,14,.018,5,false),materials.stem,group);
  for(let i=0;i<5;i++){
    const leaf=mesh(petalGeometry(.6,2),materials.leaf,group,0,height*(.2+i*.12),0);
    leaf.rotation.set(.5+i*.7, i*2.4,(-1)**i*.9);leaf.scale.x=.45;
  }
  const flower=new T.Group();flower.position.set(.05,height,0);flower.rotation.set(.18,random()*6,.18);group.add(flower);
  for(let layer=0;layer<3;layer++)for(let k=0;k<6;k++){
    const pivot=new T.Group();pivot.rotation.y=k*Math.PI/3+layer*.42;flower.add(pivot);
    const m=mesh(petalGeometry(.58-layer*.115,k+layer),petalMats[(colorIndex+layer%2)%petalMats.length],pivot,0,layer*.025,.04);
    m.castShadow=false;
    m.rotation.x=.45-layer*.22;
  }
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;rod(flower,[0,0,0],[Math.cos(a)*.04,.18,Math.sin(a)*.04],.006,materials.stem);ball(flower,.014,Math.cos(a)*.04,.18,Math.sin(a)*.04,materials.brass);}
  // 侧枝与尚未开放的尖形花苞。
  const side=random()>.5?1:-1;rod(group,[0,height*.6,0],[side*.34,height*.95,.13],.011,materials.stem);
  ball(group,.085,side*.34,height*.95,.13,petalMats[colorIndex],.7,1.65,.7);
  return group;
}
function flowers(){
  const s=base('flowers');
  box(s.world,8.9,.18,5.9,0,.05,0,mat('#a5ad99'));
  const bed=mat('#727964');
  for(let row=0;row<3;row++){
    box(s.world,8.1,.18,1.4,0,.16,-1.9+row*1.8,bed);
    for(let i=0;i<11;i++){
      const f=lisianthus(s.world,-3.65+i*.73+(random()-.5)*.2,-1.9+row*1.8+(random()-.5)*.75,1.3+random()*1.45,i%4);
      s.animated.push({node:f,phase:random()*6,type:'flower'});
    }
  }
  return s;
}
function tree(parent,x,z,size=1,purple=false){
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(size);parent.add(g);
  const bark=mat('#504751');rod(g,[0,0,0],[.1,3.4,0],.13,bark,.075);
  for(let i=0;i<5;i++){
    const a=i*2.4;const bx=Math.cos(a)*.9,bz=Math.sin(a)*.8;
    rod(g,[.03,1.5+i*.25,0],[bx,3.3+i*.1,bz],.06,bark,.025);
  }
  const colors=purple?['#9482b4','#b4a0ce','#81749f']:['#778178','#929f8a','#606e69'];
  for(let i=0;i<28;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*1.3;
    const m=ball(g,.4+random()*.2,Math.cos(a)*r,3.2+random()*.8,Math.sin(a)*r,mat(colors[i%3]),1.25,.75,1);
    m.geometry=new T.IcosahedronGeometry(.4+random()*.2,1);
  }
  return g;
}
function lamp(parent,x,z){
  rod(parent,[x,0,z],[x,2.85,z],.035,materials.metal);
  rod(parent,[x,2.85,z],[x+.4,2.85,z],.035,materials.metal);
  box(parent,.55,.08,.2,x+.36,2.82,z,materials.metal);
  box(parent,.42,.025,.14,x+.36,2.765,z,materials.warm);
  const l=new T.PointLight('#ffd8a1',7,5,2);l.position.set(x+.36,2.64,z);parent.add(l);
  // 地面的柔软光池用透明纹理平面表现。
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,218,159,.23)');grad.addColorStop(1,'rgba(255,218,159,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const p=mesh(new T.PlaneGeometry(2.6,3),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}),parent,x+.4,.035,z);p.rotation.x=-Math.PI/2;
}
function road(){
  const s=base('road');const asphalt=mat('#424a60',{map:texture('#485165')});
  box(s.world,9.6,.04,3.2,0,0,.8,asphalt);
  for(const z of [-1.05,2.65]){
    box(s.world,9.7,.14,.5,0,.06,z,mat('#a9aaa7'));
    for(let x=-4.6;x<4.7;x+=.37)box(s.world,.34,.012,.49,x,.14,z,mat('#b8b7ae'));
  }
  for(let x=-4;x<4.5;x+=1.4)box(s.world,.65,.015,.045,x,.03,.8,mat('#d5c6a5'));
  for(let x=-3.7;x<4;x+=2.5){tree(s.world,x,-2.3,.86,true);lamp(s.world,x,2.8);}
  // 普通校园围墙与栅栏，不出现欧式城堡或复古街灯。
  box(s.world,9.4,.43,.18,0,.22,-3.1,mat('#b4acb3'));
  for(let x=-4.5;x<=4.6;x+=.28)rod(s.world,[x,.4,-3.1],[x,1.25,-3.1],.012,materials.metal);
  rod(s.world,[-4.6,1.2,-3.1],[4.6,1.2,-3.1],.018,materials.metal);
  const bench=new T.Group();s.world.add(bench);bench.position.set(2.7,.15,-.7);
  for(let i=0;i<4;i++)box(bench,1.2,.06,.09,0,.37,-.15+i*.11,materials.wood);
  for(const x of [-.45,.45]){rod(bench,[x,0,-.1],[x,.4,-.1],.03,materials.metal);rod(bench,[x,0,.2],[x,.4,.2],.03,materials.metal);}
  for(let i=0;i<95;i++){
    const p=mesh(new T.PlaneGeometry(.045,.08),mat('#c7b5df',{side:T.DoubleSide}),s.world,(random()-.5)*9,random()*5,(random()-.5)*6);
    s.animated.push({node:p,phase:random()*7,type:'petal'});
  }
  return s;
}
function restaurant(){
  const s=base('restaurant');
  const plaster=mat('#c5b7ac',{map:texture('#c2b4a7',30)});
  const tiles=mat('#666677');
  for(let x=-4.6;x<4.7;x+=.5)for(let z=-3;z<3.3;z+=.43)box(s.world,.47,.025,.4,x,.015,z,mat((Math.floor(x*2+z*2)%3===0)?'#98928e':'#88878a'));
  // 店面三面墙和完整室内，门窗留空，不把窗户贴成图片。
  box(s.world,5.7,3.6,.2,.4,1.8,-2.45,plaster);
  box(s.world,.2,3.6,3.4,-2.45,1.8,-.8,plaster);
  box(s.world,.2,3.6,3.4,3.25,1.8,-.8,plaster);
  box(s.world,5.7,.45,.2,.4,3.4,.9,plaster);
  box(s.world,5.7,.35,.2,.4,.2,.9,plaster);
  for(const x of [-2.4,-.65,.65,3.2])box(s.world,.14,2.8,.18,x,1.75,.9,materials.wood);
  // 木窗分隔与暖色玻璃，隐约看见桌椅。
  const glass=new T.MeshPhysicalMaterial({color:'#f3d0a0',transparent:true,opacity:.15,roughness:.2,side:T.DoubleSide,depthWrite:false});
  for(const [x,w] of [[-1.55,1.5],[1.9,2.35]]){
    box(s.world,w,2.2,.025,x,1.65,.91,glass);
    for(let i=1;i<4;i++)box(s.world,.045,2.2,.1,x-w/2+i*w/4,1.65,.94,materials.wood);
    box(s.world,w,.07,.1,x,1.55,.94,materials.wood);
  }
  box(s.world,.95,.1,.1,0,2.9,.94,materials.wood);
  box(s.world,.95,.1,.1,0,.45,.94,materials.wood);
  for(const x of [-.5,.5])box(s.world,.08,2.4,.12,x,1.65,.94,materials.wood);
  rod(s.world,[.35,1.3,1.04],[.35,1.6,1.04],.02,materials.brass);
  label(s.world,'湘 菜 馆',3.7,.7,.35,3.55,1.06,'#514b56','#f9e4bc');
  // 屋檐带逐片瓦片和有厚度的檐口。
  const roof=box(s.world,6.3,.17,4,.4,3.95,-.6,tiles);roof.rotation.x=.07;
  for(let x=-2.7;x<3.6;x+=.18)for(let z=-2.4;z<1.4;z+=.4){const tile=mesh(new T.CylinderGeometry(.1,.1,.43,7,1,false,0,Math.PI),tiles,s.world,x,4.04-z*.07,z);tile.rotation.x=Math.PI/2;}
  for(const x of [-1.45,1.85]){
    box(s.world,1.1,.1,.75,x,.9,-.8,materials.wood);
    for(const dx of [-.43,.43])for(const dz of [-.28,.28])rod(s.world,[x+dx,0,-.8+dz],[x+dx,.9,-.8+dz],.035,materials.wood);
    for(const dz of [-.7,.7]){
      box(s.world,.5,.08,.42,x,.5,-.8+dz,materials.wood);
      for(const dx of [-.2,.2])rod(s.world,[x+dx,0,-.8+dz],[x+dx,.9,-.8+dz],.025,materials.wood);
      box(s.world,.5,.35,.05,x,.82,-.8+dz+(dz>0?.18:-.18),materials.wood);
    }
    for(const dx of [-.25,.25])mesh(new T.CylinderGeometry(.13,.13,.025,20),mat('#e7dfd0'),s.world,x+dx,.97,-.8);
  }
  for(const x of [-1.4,1.8]){
    rod(s.world,[x,3.8,-.7],[x,2.95,-.7],.015,materials.metal);
    mesh(new T.ConeGeometry(.35,.2,24,1,true),materials.brass,s.world,x,2.94,-.7);
    ball(s.world,.08,x,2.84,-.7,materials.warm);
    const light=new T.PointLight('#ffd39b',10,7,2);light.position.set(x,2.75,-.7);s.world.add(light);
  }
  // 入口盆栽和一侧窄巷。
  for(const x of [-2.85,3.5]){
    mesh(new T.CylinderGeometry(.3,.22,.5,14),mat('#938b85'),s.world,x,.25,1.3);
    for(let i=0;i<10;i++){
      const a=i*2.4;rod(s.world,[x,.4,1.3],[x+Math.cos(a)*.3,.9+random()*.4,1.3+Math.sin(a)*.3],.012,materials.stem);
      const leaf=mesh(petalGeometry(.48,i),materials.leaf,s.world,x+Math.cos(a)*.3,1+random()*.3,1.3+Math.sin(a)*.3);leaf.rotation.set(.6,a,.5);leaf.scale.x=.6;
    }
  }
  tree(s.world,-4,-1.8,.8,true);
  return s;
}

const host=document.createElement('div');host.id='diorama-canvas';host.setAttribute('aria-label','立体回忆场景，可左右拖动');document.querySelector('#app').append(host);
let renderer;
try{
  renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;host.append(renderer.domElement);
}catch(error){console.warn('3D 不可用，显示原场景背景。');host.remove();}
if(renderer){
  const camera=new T.PerspectiveCamera(34,1,.1,100);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(host);
  const hint=document.createElement('div');hint.className='orbit-hint';hint.textContent='左右轻拖，看看这段回忆';host.append(hint);
  let selected;
  function select(){
    let kind=null;
    if(document.querySelector('#screen-2.active'))kind='flowers';
    if(document.querySelector('#screen-3.active.solved'))kind='road';
    if(document.querySelector('#screen-4.active.solved'))kind='restaurant';
    if(kind===selected)return;
    selected=kind;
    host.classList.toggle('visible',!!kind);
    if(!kind){active=null;return;}
    if(!scenes.has(kind))scenes.set(kind,({flowers,road,restaurant})[kind]());
    active=scenes.get(kind);
    const target=document.querySelector(`#screen-${kind==='flowers'?2:kind==='road'?3:4}`);
    (target.querySelector('.reveal')||target).append(host);
    resize();
    target.classList.add('has-diorama');
  }
  new MutationObserver(select).observe(document.querySelector('#app'),{subtree:true,attributes:true,attributeFilter:['class']});select();
  host.addEventListener('pointerdown',e=>{pointer.drag=true;pointer.lastX=e.clientX;host.setPointerCapture(e.pointerId);hint.classList.add('used');});
  host.addEventListener('pointermove',e=>{if(pointer.drag&&active){active.yaw=Math.max(-.8,Math.min(.8,active.yaw+(e.clientX-pointer.lastX)*.006));pointer.lastX=e.clientX;}});
  host.addEventListener('pointerup',()=>{pointer.drag=false;});host.addEventListener('pointercancel',()=>{pointer.drag=false;});
  let last=0;
  function animate(now){
    requestAnimationFrame(animate);if(!active||document.hidden||now-last<32)return;last=now;
    const time=now*.001;
    const yaw=active.yaw+(reduce?0:Math.sin(time*.16)*.065);
    const distance=camera.aspect<.8?32:16.5;
    camera.position.set(Math.sin(.33+yaw)*distance,camera.aspect<.8?14:10.8,Math.cos(.33+yaw)*distance);camera.lookAt(0,1.3,0);
    for(const a of active.animated){
      if(reduce)continue;
      if(a.type==='flower')a.node.rotation.z=Math.sin(time*.65+a.phase)*.035;
      else{a.node.position.y=5-((time*.27+a.phase)%5);a.node.position.x+=Math.sin(time+a.phase)*.0008;a.node.rotation.set(time*.35,a.phase,time*.25);}
    }
    renderer.render(active.scene,camera);
  }
  requestAnimationFrame(animate);
}
