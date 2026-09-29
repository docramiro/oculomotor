import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
/*__HEAD3D__*/
const EOM=window.EOM;
const D2R=Math.PI/180, RG=12, XM=-31;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const hosts={main:document.getElementById('host-main'),face:document.getElementById('host-face'),face2:document.getElementById('host-face2')};
document.querySelectorAll('.v3msg').forEach(e=>e.remove());

/* ---------- renderer / scene ---------- */
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
renderer.domElement.className='gl';
const labelsEl=document.createElement('div'); labelsEl.className='labels';
const tipEl=document.createElement('div'); tipEl.className='tip'; tipEl.hidden=true;
const scene=new THREE.Scene();
const camA=new THREE.PerspectiveCamera(32,1,1,4000);   // anatomy
const camF=new THREE.PerspectiveCamera(14,1,10,4000);  // face
const camN=new THREE.PerspectiveCamera(8,1,10,4000);   // nine positions
const controls=new OrbitControls(camA,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.09; controls.minDistance=40; controls.maxDistance=900;
scene.add(new THREE.HemisphereLight(0xfff4ea,0x3a3430,1.0));
const key=new THREE.DirectionalLight(0xffffff,2.1); key.position.set(-140,170,320); scene.add(key);
const fill=new THREE.DirectionalLight(0xfff1e6,0.55); fill.position.set(200,40,120); scene.add(fill);
const rimL=new THREE.DirectionalLight(0x9fd0ff,0.6); rimL.position.set(-140,50,-200); scene.add(rimL);
const pen=new THREE.PointLight(0xffffff,0.55,0,0); scene.add(pen);

const pivot=new THREE.Group(); scene.add(pivot); pivot.position.set(0,-95,-30);
const P=new THREE.Group(); P.position.set(0,95,30); pivot.add(P);

let hostKey=null, mode='face';
function mount(which){
  const h=hosts[which]; if(!h)return; hostKey=which; mode=which==='main'?'anat':'face';
  h.insertBefore(renderer.domElement,h.firstChild); if(which==='main'){h.appendChild(labelsEl);h.appendChild(tipEl);} else {labelsEl.remove();tipEl.remove();}
  controls.enabled=mode==='anat'; lastKey=''; resize();
}
function resize(){if(!hostKey)return;const h=hosts[hostKey];const w=h.clientWidth,hh=h.clientHeight;if(!w||!hh)return;renderer.setSize(w,hh,false);renderer.domElement.style.width=w+'px';renderer.domElement.style.height=hh+'px';for(const c of [camA,camF]){c.aspect=w/hh;c.updateProjectionMatrix();}lastKey='';}
const ro=new ResizeObserver(resize); Object.values(hosts).forEach(h=>h&&ro.observe(h));

/* ---------- head ---------- */
const HD=JSON.parse(document.getElementById('headData').textContent);
const tl=new THREE.TextureLoader();
const hMap=tl.load(window.HEAD_MAP,()=>{lastKey='';EOM.markDirty&&EOM.markDirty();}); hMap.colorSpace=THREE.SRGBColorSpace; hMap.flipY=false; const hNorm=tl.load(window.HEAD_NORMAL,()=>{EOM.markDirty&&EOM.markDirty();});
const H=buildHead(THREE,HD,{map:hMap,normal:hNorm});
P.add(H.mesh); P.add(H.lashes);

/* ---------- materials ---------- */
const COL={belly:new THREE.Color('#A8443B'),tendon:new THREE.Color('#E8DFCB'),dead:new THREE.Color('#8B827E'),n3:new THREE.Color('#4471E3'),n4:new THREE.Color('#DE9A2E'),n6:new THREE.Color('#DB4436'),
  nerve:new THREE.Color('#F0CC55'),lesion:new THREE.Color('#FF3B2E'),optic:new THREE.Color('#EFE5CC'),symp:new THREE.Color('#3FAE84'),mlf:new THREE.Color('#B48BF0')};
const matBone=new THREE.MeshStandardMaterial({color:0xE9DFC9,roughness:.9,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
const matRim=new THREE.MeshStandardMaterial({color:0xE9DFC9,roughness:.8,transparent:true,opacity:.55});
const matStem=new THREE.MeshStandardMaterial({color:0xD9BBAF,roughness:.7,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false});
const matArt=new THREE.MeshStandardMaterial({color:0xC23B30,roughness:.4});
const matTendon=new THREE.MeshStandardMaterial({color:0xE8DFCB,roughness:.55});
const matDark=new THREE.MeshStandardMaterial({color:0x151c1b,roughness:1});

/* ---------- helpers ---------- */
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
class Band{
  constructor(nL,nR){this.nL=nL;this.nR=nR;const nv=nL*nR;this.pos=new Float32Array(nv*3);this.col=new Float32Array(nv*3);const idx=[];
    for(let i=0;i<nL-1;i++)for(let j=0;j<nR;j++){const a=i*nR+j,b=i*nR+(j+1)%nR,c=(i+1)*nR+j,d=(i+1)*nR+(j+1)%nR;idx.push(a,c,b,b,c,d);}
    this.geo=new THREE.BufferGeometry();this.geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));this.geo.setAttribute('color',new THREE.BufferAttribute(this.col,3));this.geo.setIndex(idx);
    this.mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,side:THREE.DoubleSide});this.mesh=new THREE.Mesh(this.geo,this.mat);this.curve=null;}
  update(points,prof,bellyCol,center){
    const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');this.curve=curve;
    const {nL,nR,pos,col}=this;const c=new THREE.Color();const Nv=new THREE.Vector3(),Bv=new THREE.Vector3();let prevN=null;
    for(let i=0;i<nL;i++){const u=i/(nL-1);const p=curve.getPointAt(u),T=curve.getTangentAt(u).normalize();
      Nv.copy(p).sub(center);Nv.addScaledVector(T,-Nv.dot(T));if(Nv.lengthSq()<1e-6)Nv.copy(prevN||V(0,1,0));Nv.normalize();prevN=Nv.clone();
      Bv.crossVectors(T,Nv).normalize();const {w,h,t}=prof(u);c.copy(bellyCol).lerp(COL.tendon,t);
      for(let j=0;j<nR;j++){const a=j/nR*Math.PI*2,x=Math.cos(a)*w/2,y=Math.sin(a)*h/2,k=(i*nR+j)*3;
        pos[k]=p.x+Bv.x*x+Nv.x*y;pos[k+1]=p.y+Bv.y*x+Nv.y*y;pos[k+2]=p.z+Bv.z*x+Nv.z*y;col[k]=c.r;col[k+1]=c.g;col[k+2]=c.b;}}
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.color.needsUpdate=true;this.geo.computeVertexNormals();this.geo.computeBoundingSphere();
  }
  pointAt(u,inward){const p=this.curve.getPointAt(u);if(inward){const d=p.clone().normalize();p.addScaledVector(d,-inward);}return p;}
}
function wrap(Pt,I,r){
  const Ir=I.clone().setLength(r);
  if(Pt.clone().sub(Ir).dot(Ir)>=0)return [Pt.clone(),Ir];
  const d=Pt.length(),Ph=Pt.clone().normalize();
  let n=new THREE.Vector3().crossVectors(Pt,Ir);if(n.lengthSq()<1e-6)n.set(0,1,0);n.normalize();
  const perp=new THREE.Vector3().crossVectors(n,Ph).normalize();
  const ca=Math.min(0.999,r/d),sa=Math.sqrt(1-ca*ca);
  let T=Ph.clone().multiplyScalar(ca).addScaledVector(perp,sa).multiplyScalar(r);
  if(perp.dot(Ir)<0)T=Ph.clone().multiplyScalar(ca).addScaledVector(perp,-sa).multiplyScalar(r);
  const a=T.clone().normalize(),b=Ir.clone().normalize(),ang=a.angleTo(b);
  const pts=[Pt.clone()],n2=Math.max(2,Math.ceil(ang/0.1)),q=new THREE.Quaternion().setFromUnitVectors(a,b);
  for(let i=0;i<=n2;i++){const qi=new THREE.Quaternion().slerp(q,i/n2);pts.push(a.clone().applyQuaternion(qi).multiplyScalar(r));}
  return pts;
}
function tubeMesh(points,r,mat,seg){const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');return new THREE.Mesh(new THREE.TubeGeometry(curve,seg||Math.max(16,points.length*6),r,8,false),mat);}

/* ---------- anatomy constants (eye-local mm, +x lateral, +y up, +z anterior) ---------- */
const INSD={MR:[-10.2,0,6.4],LR:[10.7,0,5.4],SR:[0.6,10.9,4.9],IR:[0.4,-10.4,6.0],SO:[4.5,9.5,-5.5],IO:[8.5,-3,-7.8]};
const INS={};for(const k in INSD)INS[k]=V(...INSD[k]).setLength(RG);
const ORIG={LR:V(-8,0,-38),MR:V(-14,0,-38),SR:V(-11,3.2,-38),IR:V(-11,-3.2,-38)};
const PUL={LR:V(15.2,0.5,-7),MR:V(-15.6,0,-6),SR:V(-1,15.6,-7.5),IR:V(-1,-15.4,-6.5)};
const SO_O=V(-15,6.5,-37), TROCH=V(-14.5,12,4.5), IO_O=V(-12.5,-12.5,8), IO_P=V(-3,-14.8,-1.5);
const LPS_PTS=[V(-11,5.8,-38),V(-5,14,-18),V(-1,16.2,-4),V(0,15.4,6),V(0,12.6,13.5)];
const MDEF={SR:{dir:[0,1,0],mag:20},IR:{dir:[0,-1,0],mag:20},MR:{dir:[-1,0,0],mag:22},LR:{dir:[1,0,0],mag:22},SO:{dir:[-0.5,1,0.2],mag:28},IO:{dir:[0.2,-1,0.6],mag:24},LPS:{dir:[0,1,0.3],mag:36}};
const rectusProf=(W,Hh,insW,k)=>u=>{const tO=1-sstep(0.03,0.1,u),tA=sstep(0.74,0.84,u),belly=Math.sin(Math.PI*Math.min(1,Math.max(0,(u-0.02)/0.86)));
  let w=3+(W-3)*Math.pow(belly,0.6),h=1.2+(Hh*k-1.2)*belly;const wa=W*0.8+(insW-W*0.8)*sstep(0.84,1,u);
  w=w*(1-tA)+wa*tA;h=h*(1-tA)+0.55*tA;w=w*(1-tO)+2.6*tO;h=h*(1-tO)+1.3*tO;return {w,h,t:Math.max(tO,tA)};};
const soBellyProf=k=>u=>{const tO=1-sstep(0.02,0.07,u),tT=sstep(0.66,0.76,u),b=Math.sin(Math.PI*Math.min(1,u/0.85));let w=2.4+3.4*b,h=1.4+(2.8*k-1.4)*b;w=w*(1-tT)+2.1*tT;h=h*(1-tT)+1.9*tT;return {w:w*(1-tO)+2*tO,h:h*(1-tO)+1.4*tO,t:Math.max(tO,tT)};};
const soTendProf=()=>u=>{const f=sstep(0.6,1,u);return {w:2.1+(9-2.1)*f,h:1.9+(0.5-1.9)*f,t:1};};
const ioProf=k=>u=>{const tO=1-sstep(0.01,0.05,u),tA=sstep(0.84,0.93,u),b=Math.sin(Math.PI*Math.min(1,Math.max(0,(u-0.01)/0.9)));let w=3.5+3.8*Math.pow(b,0.5),h=1.2+(2.6*k-1.2)*b;const wa=7+2*sstep(0.93,1,u);w=w*(1-tA)+wa*tA;h=h*(1-tA)+0.6*tA;return {w:w*(1-tO)+3*tO,h:h*(1-tO)+1.2*tO,t:Math.max(tO*0.7,tA)};};
const lpsProf=()=>u=>{const a=sstep(0.6,0.72,u);return {w:4+6*Math.min(1,u/0.6)*(1-a)+(10+12*sstep(0.72,1,u))*a,h:2*(1-a)+0.35*a,t:a};};
const RSIZE={SR:[9,3.2,10.6],IR:[8.5,3.6,9.8],MR:[9.5,4.2,10.3],LR:[9,3.3,9.2]};
const NPART={III:[0,.3,-.2,6],IIIsup:[0,1,0,8],IIIinf:[0,-1,0,8],cil:[1,-.5,0,10],IV:[0,1,-.2,12],VI:[0,-1,-.2,12],optic:[0,0,-1,6],symp:[0,-1,-.4,26]};
const bs=v=>({bs:v}), mu=(m,u,inw)=>({mu:m,u,inw}), gl=v=>({gl:v});
const NDEF={
  III:[{r:1.25,pts:[bs(V(XM+2,6,-100)),bs(V(XM+3,3,-94)),bs(V(XM+5,0.5,-90)),V(XM+9.5,1,-80),V(XM+12.5,3,-72),V(-17.5,4.2,-62),V(-15.5,3.3,-52),V(-12,2,-43),V(-10,1.2,-37)]}],
  IIIsup:[{r:.75,pts:[V(-10,1.2,-37),V(-7,3.5,-32),V(-4,6.5,-27),mu('SR',.32,1.4)]},{r:.45,pts:[mu('SR',.32,1.4),mu('SR',.37,-2.4),mu('LPS',.36,1)]}],
  IIIinf:[{r:.85,pts:[V(-10,1.2,-37),V(-10.5,-2,-33),V(-9.5,-4,-29)]},{r:.55,pts:[V(-9.5,-4,-29),V(-12.5,-2,-24),mu('MR',.36,1.4)]},{r:.55,pts:[V(-9.5,-4,-29),V(-5,-8.5,-24),mu('IR',.36,1.4)]},{r:.5,pts:[V(-9.5,-4,-29),V(-3,-10.5,-20),V(4,-13,-11),mu('IO',.7,-1.2)]}],
  cil:[{r:.35,pts:[V(-9,-3.6,-30),V(-6.5,-2.8,-28.5),V(-4.4,-1.9,-27.2)]},{r:.25,pts:[V(-4.2,-1.8,-27),V(-3.5,-0.6,-20),gl(V(-0.12,0.2,-1))]},{r:.25,pts:[V(-4.2,-1.8,-27),V(-2.8,-2.2,-19),gl(V(0.14,-0.14,-1))]},{r:.25,pts:[V(-4.2,-1.8,-27),V(-5,-1.6,-19),gl(V(-0.3,-0.12,-1))]}],
  IV:[{r:.55,pts:[bs(V(XM-2,1,-104)),bs(V(XM-2,-1,-109.5)),bs(V(XM,-2.2,-111.5)),bs(V(XM+3,-2.8,-111.5)),V(XM+11,-1.5,-108),V(XM+15.5,0.5,-96),V(XM+15.8,1.8,-82),V(-15.8,1.8,-66),V(-15,1.4,-54),V(-12.5,7,-42),V(-12.5,11,-32),mu('SOb',.42,-1.6)]}],
  VI:[{r:.85,pts:[bs(V(XM+2.5,-13,-106)),bs(V(XM+4,-18,-98)),bs(V(XM+5,-24.5,-90)),V(XM+9,-21,-79),V(XM+13,-11,-68),V(-16,-3,-58),V(-15.5,-1.5,-50),V(-10,-0.5,-41),V(-4,0,-32),mu('LR',.4,1.4)]}],
  optic:[{r:1.8,pts:[gl(V(-0.25,0.04,-0.97)),V(-6,-0.5,-22),V(-10.5,1.5,-33),V(-13.5,2.2,-41),V(-16,2.8,-50)]}]
};
const icaPts=()=>[V(-18,-16,-66),V(-17.5,-6,-63.5),V(-17,-3.5,-56),V(-16.8,-2.5,-49),V(-17,2,-46),V(-17.8,5.5,-50),V(-17.5,4.6,-60),V(-17.8,5,-66),V(-19,9,-71)];
const SITE={III:[V(-17,4,-62),'III'],IIIsup:[V(-5.5,5.5,-28.5),'IIIsup'],IIIinf:[V(-9.5,-4,-29),'IIIinf'],cil:[V(-4.3,-1.9,-27.2),'cil'],IV:[V(XM+15.6,1,-90),'IV'],VI:[V(XM+11,-16,-74),'VI'],
  MLF:[V(XM+1.8,-4,-103.6),'brainstem'],cs:[V(-16.8,0.5,-55),'cs'],n3nuc:[V(XM+2,6,-100),'brainstem'],n6nuc:[V(XM+2.5,-13,-106),'brainstem'],pprf:[V(XM+3.2,-15.5,-100.5),'brainstem'],
  symp:[V(-17,-5,-58),'symp'],optic:[V(-10.5,1.5,-33),'optic'],annulus:[V(-11,0,-38.5),'annulus'],n3fasc:[V(XM+3.5,2.5,-93),'brainstem'],brainstem:[V(XM+6,2,-92),'brainstem']};

/* ---------- one orbit (side) ---------- */
const pickables=[];
function makeSide(side){
  const S={side,root:new THREE.Group(),parts:{},bands:{},nuclei:{}};
  const c=HD.eyes[side].c; S.root.position.set(c[0],c[1],c[2]); if(side==='R')S.root.scale.x=-1; P.add(S.root);
  const mk=(id,layer,dir,mag)=>{const g=new THREE.Group();S.root.add(g);const p={id,side,g,layer,dir:new THREE.Vector3(...dir).normalize(),mag,user:new THREE.Vector3(),hidden:false,meshes:[]};S.parts[id]=p;return p;};
  const add=(p,mesh,info,pick=true)=>{mesh.userData.pid=p.id;mesh.userData.side=side;mesh.userData.info=info||p.id;p.g.add(mesh);p.meshes.push(mesh);if(pick)pickables.push(mesh);return mesh;};
  S.mk=mk;S.add=add;
  // bone
  const bone=mk('bone','hueso',[0,0,0],0);
  {const A=V(-12,0,-40),Rc=V(1,1,9),NL=22,NA=40,pos=[],idx=[];
   for(let i=0;i<=NL;i++){const t=i/NL;const s=(0.14+0.86*Math.pow(Math.sin(t*Math.PI/2),0.8))*(1+0.08*Math.sin(Math.PI*t));const cc=A.clone().lerp(Rc,t);
     for(let j=0;j<NA;j++){const a=j/NA*Math.PI*2;const zo=-7*Math.max(0,Math.cos(a))*t*t+1.5*Math.max(0,Math.sin(a))*t*t;pos.push(cc.x+Math.cos(a)*20*s,cc.y+Math.sin(a)*17.5*s,cc.z+zo);}}
   for(let i=0;i<NL;i++)for(let j=0;j<NA;j++){const a=i*NA+j,b=i*NA+(j+1)%NA,cc=(i+1)*NA+j,d=(i+1)*NA+(j+1)%NA;idx.push(a,b,cc,b,d,cc);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
   add(bone,new THREE.Mesh(g,matBone),'bone');
   const rimPts=[];for(let j=0;j<=NA;j++){const k=(NL*NA)+(j%NA);rimPts.push(V(pos[k*3],pos[k*3+1],pos[k*3+2]));}
   add(bone,new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts,true),120,1.5,8,true),matRim),'bone');
   add(bone,tubeMesh([V(-7.5,-1.5,-38.5),V(-3,3,-37),V(3,7.5,-34.5),V(7,9,-32)],1.1,matDark),'sof');
   const oc=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.5,8,24),matDark);oc.position.set(-13.5,2.2,-41);add(bone,oc,'optic');}
  // globe (realistic eyeball)
  const globe=mk('globe','globo',[0,0,1],32); const eye=makeEyeball(THREE); globe.g.add(eye.group); S.eye=eye;
  add(globe,eye.sclera,'globe'); eye.rot.add(eye.sclera);
  // muscles
  for(const m of ['SR','IR','MR','LR','IO','LPS']){const p=mk(m,'musculos',MDEF[m].dir,MDEF[m].mag);const b=new Band(64,14);S.bands[m]=b;add(p,b.mesh,m);}
  {const p=mk('SO','musculos',MDEF.SO.dir,MDEF.SO.mag);S.bands.SOb=new Band(48,12);S.bands.SOt=new Band(48,12);add(p,S.bands.SOb.mesh,'SO');add(p,S.bands.SOt.mesh,'SO');
   const tro=new THREE.Mesh(new THREE.TorusGeometry(2.1,0.75,10,24),new THREE.MeshStandardMaterial({color:0xDCD3BC,roughness:.5}));tro.position.copy(TROCH);tro.lookAt(V(-3,8,-20));add(p,tro,'trochlea');}
  {const p=mk('annulus','musculos',[0,0,-1],16);const an=new THREE.Mesh(new THREE.TorusGeometry(5.2,0.9,10,32),matTendon);an.position.set(-11,0,-38.5);an.lookAt(V(0,0,0));add(p,an,'annulus');}
  // nerves
  for(const id in NPART){const d=NPART[id];const p=mk(id,'nervios',d.slice(0,3),d[3]);p.mat=new THREE.MeshStandardMaterial({color:id==='optic'?COL.optic:id==='symp'?COL.symp:COL.nerve,roughness:.45});p.tubes=[];}
  // vessels (own carotid, PCom, aneurysm, sinus)
  const vasos=mk('vasos','vasos',[0,-1,-.4],26);
  add(vasos,tubeMesh([V(XM+7,-1.5,-85.5),V(XM+11,1.5,-77),V(-17.8,4.6,-66)],0.7,matArt),'pcom');
  add(vasos,tubeMesh(icaPts(),1.9,matArt),'ica');
  const an=new THREE.Mesh(new THREE.SphereGeometry(2.5,24,16),new THREE.MeshStandardMaterial({color:0xFF3B2E,roughness:.3,emissive:0x550000}));an.position.set(-18.6,3.2,-67);add(vasos,an,'aneur');vasos.aneur=an;
  const csP=mk('cs','vasos',[0,-1,-.4],26); S.matSinus=new THREE.MeshStandardMaterial({color:0x6E68C4,roughness:.6,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
  {const m=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),S.matSinus);m.scale.set(5.2,8.5,12.5);m.position.set(-16.8,0.5,-55);add(csP,m,'cs');}
  if(side==='R'){ // midline structures live once, in the right-side frame
    const art=(pts,r,info)=>add(vasos,tubeMesh(pts,r,matArt),info);
    art([V(XM,-40,-90),V(XM,-20,-88),V(XM,-3,-86.5)],1.6,'basilar');
    for(const s of [1,-1]){art([V(XM,-3,-86.5),V(XM+7*s,-1.5,-85.5),V(XM+14*s,0.5,-90),V(XM+19*s,2,-99),V(XM+22*s,3,-108)],1.1,'pca');
      art([V(XM,-5.5,-87),V(XM+8*s,-5.5,-86.5),V(XM+15*s,-3.5,-94),V(XM+19*s,-2.5,-103)],0.9,'sca');}
    const stem=mk('brainstem','tronco',[0,0,-1],50);
    const prof=[[0.1,-48],[7,-47],[8.5,-38],[9.5,-30],[12,-27],[15,-22],[15.5,-14],[14.5,-6],[11.5,-2],[12,2],[12.5,8],[11,12],[8,14],[0.1,14.5]].map(([r,y])=>new THREE.Vector2(r,y));
    const g=new THREE.LatheGeometry(prof,40);g.scale(1,1,0.78);const m=new THREE.Mesh(g,matStem);m.position.set(XM,0,-100);add(stem,m,'brainstem');
    const coll=new THREE.MeshStandardMaterial({color:0xD9BBAF,roughness:.7,transparent:true,opacity:.45});
    for(const s of [-1,1])for(const [y,z] of [[8.5,-108.6],[2.5,-109]]){const cc=new THREE.Mesh(new THREE.SphereGeometry(2.6,16,12),coll);cc.position.set(XM+3.6*s,y,z);add(stem,cc,'brainstem');}
    const nuc=(id,info,pos,r,col)=>{const mm=new THREE.MeshStandardMaterial({color:col,roughness:.4,emissive:new THREE.Color(col).multiplyScalar(0.35)});const sp=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),mm);sp.position.copy(pos);add(stem,sp,info);S.nuclei[id]=sp;sp.userData.base=new THREE.Color(col);};
    nuc('n3R','n3nuc',V(XM+2,6,-100),1.7,'#4471E3');nuc('n3L','n3nuc',V(XM-2,6,-100),1.7,'#4471E3');nuc('ew','ew',V(XM+0.9,8.2,-102.2),0.9,'#E08A3C');nuc('ewL','ew',V(XM-0.9,8.2,-102.2),0.9,'#E08A3C');
    nuc('n4R','n4nuc',V(XM+2,1,-104),1.15,'#DE9A2E');nuc('n4L','n4nuc',V(XM-2,1,-104),1.15,'#DE9A2E');
    nuc('n6R','n6nuc',V(XM+2.5,-13,-106),1.5,'#DB4436');nuc('n6L','n6nuc',V(XM-2.5,-13,-106),1.5,'#DB4436');
    nuc('pprfR','pprf',V(XM+3.2,-15.5,-100.5),1.7,'#9F7AE0');nuc('pprfL','pprf',V(XM-3.2,-15.5,-100.5),1.7,'#9F7AE0');
    S.mlfR=new THREE.MeshStandardMaterial({color:COL.mlf,roughness:.4,emissive:0x221133});S.mlfL=S.mlfR.clone();
    add(stem,tubeMesh([V(XM-2.5,-13,-106),V(XM-0.5,-13.6,-105.2),V(XM+1.6,-12,-104.6),V(XM+1.8,-3,-103.6),V(XM+2,5.5,-100.6)],0.45,S.mlfR),'MLF');
    add(stem,tubeMesh([V(XM+2.5,-13,-106),V(XM+0.5,-13.6,-105.2),V(XM-1.6,-12,-104.6),V(XM-1.8,-3,-103.6),V(XM-2,5.5,-100.6)],0.45,S.mlfL),'MLF');
  }
  return S;
}
const SIDES={R:makeSide('R'),L:makeSide('L')};
const allParts=()=>[...Object.values(SIDES.R.parts),...Object.values(SIDES.L.parts)];
function bsOff(side){const p=SIDES.R.parts.brainstem.g.position;return side==='R'?p.clone():V(-p.x,p.y,p.z);}

/* ---------- labels (right side + midline) ---------- */
const SR_=SIDES.R;
const LABELS=[
 ['Recto superior','SR',()=>SR_.bands.SR.pointAt(.55,-2.5),'',1],['Recto inferior','IR',()=>SR_.bands.IR.pointAt(.55,-2.5),'',1],['Recto medial','MR',()=>SR_.bands.MR.pointAt(.5,-2.5),'',1],['Recto lateral','LR',()=>SR_.bands.LR.pointAt(.5,-2.5),'',1],
 ['Oblicuo superior','SO',()=>SR_.bands.SOb.pointAt(.5,-2),'',1],['Oblicuo inferior','IO',()=>SR_.bands.IO.pointAt(.35,-2),'',1],['Elevador del párpado','LPS',()=>SR_.bands.LPS.pointAt(.5,-1.5),'',0],
 ['Tróclea','SO',()=>TROCH.clone(),'',1],['Anillo de Zinn','annulus',()=>V(-11,-5.5,-38.5),'',0],['Nervio óptico','optic',()=>V(-10.5,1.5,-33),'',1],['Fisura orbitaria superior','bone',()=>V(4,8.5,-33.5),'',0],
 ['III par','III',()=>V(XM+12.5,3,-72),'n3',1],['División superior','IIIsup',()=>V(-4.5,6.5,-27),'n3',0],['División inferior','IIIinf',()=>V(-10,-3.5,-31),'n3',0],['Ganglio ciliar','cil',()=>V(-4.3,-1.9,-27.2),'n3',0],
 ['IV par','IV',()=>V(XM+15.6,0.5,-96),'n4',1],['VI par','VI',()=>V(XM+9,-21,-79),'n6',1],['Canal de Dorello','VI',()=>V(XM+13,-11,-68),'n6',0],
 ['Seno cavernoso','cs',()=>V(-16.8,9,-55),'',1],['Carótida interna','vasos',()=>V(-17.5,-8,-64),'vas',0],['A. comunicante posterior','vasos',()=>V(XM+11,1.5,-77),'vas',0],['A. cerebral posterior','vasos',()=>V(XM+19,2,-99),'vas',0],['A. cerebelosa superior','vasos',()=>V(XM+15,-3.5,-94),'vas',0],['A. basilar','vasos',()=>V(XM,-24,-88),'vas',0],
 ['Núcleo del III','brainstem',()=>V(XM+2,6,-100),'n3',1],['Edinger-Westphal','brainstem',()=>V(XM+0.9,8.4,-102),'',0],['Núcleo del IV','brainstem',()=>V(XM-2,1,-104),'n4',0],['Núcleo del VI','brainstem',()=>V(XM+2.5,-13,-106),'n6',1],['FRPP','brainstem',()=>V(XM+3.2,-15.5,-100.5),'',0],['FLM','brainstem',()=>V(XM+1.8,-3,-103.6),'',1],
 ['Mesencéfalo','brainstem',()=>V(XM-12,7,-100),'',0],['Protuberancia','brainstem',()=>V(XM-16,-15,-100),'',0],
 ['OD','globe',()=>V(0,-16,6),'',1]
];
const labEls=LABELS.map(([t,,,cls])=>{const d=document.createElement('div');d.className='lab'+(cls?' '+cls:'');d.textContent=t;labelsEl.appendChild(d);return d;});
const labOI=document.createElement('div');labOI.className='lab';labOI.textContent='OI';labelsEl.appendChild(labOI);
const lesLabs={R:document.createElement('div'),L:document.createElement('div')};for(const k in lesLabs){lesLabs[k].className='lab les';labelsEl.appendChild(lesLabs[k]);}

/* ---------- UI state ---------- */
let colorMode='anat', labelMode='key', explodeT=0, explodeV=0, moveMode=false, selected=null, lastKey='', reassemble=null;
const layerOn={piel:false,hueso:true,globo:true,musculos:true,nervios:true,tronco:true,vasos:true};
const LAYERS=[['piel','Piel (rostro)','#E0B89A'],['hueso','Hueso','#E9DFC9'],['globo','Globos','#F5F2EA'],['musculos','Músculos','#A8443B'],['nervios','Nervios','#F0CC55'],['tronco','Tronco','#D9BBAF'],['vasos','Vasos y seno','#C23B30']];
const layersEl=document.getElementById('layers');
layersEl.innerHTML=LAYERS.map(([k,t,c])=>`<label><input type="checkbox" id="ly-${k}" ${layerOn[k]?'checked':''}><i style="background:${c}"></i>${t}</label>`).join('');
LAYERS.forEach(([k])=>document.getElementById('ly-'+k).addEventListener('change',e=>{layerOn[k]=e.target.checked;lastKey='';}));
function segWire(id,fn){const el=document.getElementById(id);if(!el)return;el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset.v);});}
segWire('segLabels',v=>{labelMode=v;});
document.getElementById('explode').addEventListener('input',e=>{explodeT=e.target.value/100;reassemble=null;});
document.getElementById('btnReassemble').onclick=()=>{reassemble={t0:performance.now(),from:explodeV,users:allParts().map(p=>[p,p.user.clone()])};document.getElementById('explode').value=0;explodeT=0;};
const btnMove=document.getElementById('btnMove');btnMove.onclick=()=>{moveMode=!moveMode;btnMove.setAttribute('aria-pressed',moveMode);};
const btnColor=document.getElementById('btnColor');btnColor.onclick=()=>{colorMode=colorMode==='anat'?'nerve':'anat';btnColor.setAttribute('aria-pressed',colorMode==='nerve');lastKey='';};
document.querySelectorAll('#vtool [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.getElementById('btnShowAll').onclick=()=>{allParts().forEach(p=>p.hidden=false);LAYERS.forEach(([k])=>{if(k==='piel')return;layerOn[k]=true;document.getElementById('ly-'+k).checked=true;});lastKey='';};
document.getElementById('btnIsolate').onclick=()=>{if(!selected)return;allParts().forEach(p=>p.hidden=!(p.id===selected.pid&&p.side===selected.side));lastKey='';};
document.getElementById('btnHide').onclick=()=>{if(!selected)return;SIDES[selected.side].parts[selected.pid].hidden=true;lastKey='';};

/* ---------- views ---------- */
let curView='front';
function setView(v){
  curView=v; let t,p;
  if(v==='front'){t=V(0,0,-25);p=V(0,22,215);}
  else if(v==='top'){t=V(0,0,-50);p=V(0,270,20);}
  else if(v==='side'){t=V(-10,0,-45);p=V(-330,25,-20);}
  else {t=V(0,-5,-78);p=V(150,110,-330);}
  controls.target.copy(t);camA.position.copy(p);controls.update();
}
setView('front');

/* ---------- picking & drag (anatomy) ---------- */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
let down=null, drag=null;
function pick(e){const r=renderer.domElement.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camA);
  const vis=pickables.filter(m=>{let o=m;while(o){if(!o.visible)return false;o=o.parent;}return true;});
  const hits=ray.intersectObjects(vis,false);return hits.find(h=>!(h.object.userData.info==='bone'&&h.object.material===matBone))||null;}
renderer.domElement.addEventListener('pointerdown',e=>{
  if(mode!=='anat')return; down={x:e.clientX,y:e.clientY};
  if(moveMode){const h=pick(e);if(h&&h.object.userData.pid!=='bone'){const S=SIDES[h.object.userData.side];const n=new THREE.Vector3();camA.getWorldDirection(n);
    drag={S,p:S.parts[h.object.userData.pid],plane:new THREE.Plane().setFromNormalAndCoplanarPoint(n,h.point),last:h.point.clone()};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);}}
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(mode!=='anat')return;
  if(drag){const r=renderer.domElement.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camA);
    const pt=new THREE.Vector3();if(ray.ray.intersectPlane(drag.plane,pt)){const a=drag.S.root.worldToLocal(drag.last.clone()),b=drag.S.root.worldToLocal(pt.clone());drag.p.user.add(b.sub(a));drag.last.copy(pt);lastKey='';}return;}
  if(e.pointerType==='mouse'){const h=pick(e);if(h){const inf=EOM.INFO[h.object.userData.info];tipEl.hidden=false;tipEl.textContent=(inf?inf.n:'')+(h.object.userData.side==='L'&&!['brainstem','basilar','pca','sca'].includes(h.object.userData.info)?' · OI':' ');const r=hosts.main.getBoundingClientRect();tipEl.style.left=(e.clientX-r.left)+'px';tipEl.style.top=(e.clientY-r.top)+'px';renderer.domElement.style.cursor='pointer';}else{tipEl.hidden=true;renderer.domElement.style.cursor=moveMode?'move':'grab';}}
});
renderer.domElement.addEventListener('pointerleave',()=>{tipEl.hidden=true;});
renderer.domElement.addEventListener('pointerup',e=>{
  if(mode!=='anat')return;
  if(drag){drag=null;controls.enabled=true;return;}
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const h=pick(e);select(h?{pid:h.object.userData.pid,info:h.object.userData.info,side:h.object.userData.side}:null);}
  down=null;
});
function select(s){
  selected=s; lastKey='';
  const T=document.getElementById('infoType'),N=document.getElementById('infoName'),B=document.getElementById('infoBody');
  document.getElementById('btnIsolate').disabled=!s; document.getElementById('btnHide').disabled=!s;
  if(!s){T.textContent='Pieza seleccionada';N.textContent='Toca cualquier estructura';B.innerHTML='Gira con un dedo o el ratón, acerca con pellizco o rueda. Toca un músculo, nervio, núcleo o vaso para ver su origen, inserción, inervación y perla clínica.';return;}
  const inf=EOM.INFO[s.info]||{n:s.info};
  T.textContent=(inf.t||'')+(['brainstem','n3nuc','n4nuc','n6nuc','pprf','ew','MLF','basilar','pca','sca'].includes(s.info)?'':(s.side==='R'?' · ojo derecho':' · ojo izquierdo'));N.textContent=inf.n;
  const esc=x=>String(x||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const rows=[['Origen',inf.o],['Inserción / destino',inf.i],['Inervación',inf.v],['Acción / trayecto',inf.a]].filter(r=>r[1]&&r[1]!=='—');
  B.innerHTML=`<dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${inf.p?`<div class="pearl">${esc(inf.p)}</div>`:''}`;
}

/* ---------- per-frame model update ---------- */
function forceK(f,dead){if(dead)return 0.45;const r=Math.max(0,f/EOM.T0);return Math.min(1.35,0.55+0.45*Math.pow(Math.min(2.4,r),0.6));}
const off=(S,id)=>S.parts[id]?S.parts[id].g.position:new THREE.Vector3();
function resolve(S,pt,partId){
  let v;
  if(pt.isVector3)v=pt.clone();
  else if(pt.bs)v=pt.bs.clone().add(bsOff(S.side));
  else if(pt.gl)v=pt.gl.clone().normalize().multiplyScalar(RG+0.1).applyEuler(S.eye.rot.rotation).add(off(S,'globe'));
  else if(pt.mu){const b=S.bands[pt.mu];const mid=pt.mu==='SOb'||pt.mu==='SOt'?'SO':pt.mu;v=b.pointAt(pt.u,pt.inw).add(off(S,mid));}
  return v.sub(off(S,partId));
}
function lidDrop(E,p){const open=Math.max(0.03,0.12+0.88*E.LPS-0.22*(1-E.symp));const lift=EOM.S.lift&&mode==='face'?0.45:1;return (1-open)*9.6*lift-Math.max(-3.2,Math.min(3.2,p[1]*0.12));}
function pupilMM(E){return 3.5+3*(1-E.para)-1.3*(1-E.symp);}
function poseEyes(pR,pL){
  const S=EOM.S;
  for(const [side,p] of [['R',pR],['L',pL]]){const Sd=SIDES[side];Sd.eye.rot.rotation.set(-p[1]*D2R,p[0]*D2R,p[2]*D2R);Sd.eye.pupil.scale.setScalar(pupilMM(S.E[side])/2);}
  H.setLids({R:lidDrop(S.E.R,pR),L:lidDrop(S.E.L,pL)});
}
function updateSide(Sd,now,full){
  const S=EOM.S, cur=EOM.cur, p=EOM.disp[Sd.side], E=S.E[Sd.side], hid=S.hidden, les=EOM.lesionSites(Sd.side);
  for(const id of ['III','IIIsup','IIIinf','cil','IV','VI','optic','symp']){const pp=Sd.parts[id];const pulse=0.5+0.5*Math.sin(now/260);if(les.sites.has(id))pp.mat.emissive.setRGB(0.5*pulse,0.05,0.02);else pp.mat.emissive.setRGB(0,0,0);}
  if(!full)return;
  for(const q of Object.values(Sd.parts)){q.g.position.copy(q.dir).multiplyScalar(q.mag*explodeV).add(q.user);
    let vis=mode==='anat'?(layerOn[q.layer]&&!q.hidden):(q.id==='globe'); q.g.visible=vis;}
  if(mode!=='anat')return;
  const eul=Sd.eye.rot.rotation, f=cur[Sd.side].f;
  const dead=m=>!hid&&E[m]<0.05;
  const bellyCol=m=>dead(m)?COL.dead:(colorMode==='nerve'?COL[{LR:'n6',SO:'n4'}[m]||'n3']:COL.belly);
  for(const m of ['SR','IR','MR','LR']){const I=INS[m].clone().applyEuler(eul);const [W,Hh,iw]=RSIZE[m];
    Sd.bands[m].update([ORIG[m].clone(),...wrap(PUL[m],I,m==='SR'?12.9:12.45)],rectusProf(W,Hh,iw,forceK(f[m],dead(m))),bellyCol(m),V(0,0,0));}
  {const I=INS.IO.clone().applyEuler(eul);Sd.bands.IO.update([IO_O.clone(),...wrap(IO_P,I,12.95)],ioProf(forceK(f.IO,dead('IO'))),bellyCol('IO'),V(0,0,0));}
  {const I=INS.SO.clone().applyEuler(eul);Sd.bands.SOb.update([SO_O.clone(),V(-17,9.5,-22),V(-16.5,11.5,-6),TROCH.clone()],soBellyProf(forceK(f.SO,dead('SO'))),bellyCol('SO'),V(-2,0,-10));
   Sd.bands.SOt.update(wrap(TROCH,I,12.4),soTendProf(),bellyCol('SO'),V(0,0,0));}
  Sd.bands.LPS.update(LPS_PTS.map(v=>v.clone()),lpsProf(),(!hid&&E.LPS<0.05)?COL.dead:(colorMode==='nerve'?COL.n3:COL.belly),V(0,0,-2));
  const selHere=selected&&selected.side===Sd.side;
  for(const m of ['SR','IR','MR','LR','IO','LPS'])Sd.bands[m].mat.emissive.setScalar(selHere&&selected.info===m?0.18:0);
  for(const b of [Sd.bands.SOb,Sd.bands.SOt])b.mat.emissive.setScalar(selHere&&selected.info==='SO'?0.18:0);
  for(const id in NDEF){const pp=Sd.parts[id];pp.tubes.forEach(t=>{pp.g.remove(t);t.geometry.dispose();const i=pickables.indexOf(t);if(i>=0)pickables.splice(i,1);});pp.tubes=[];
    pp.mat.color.copy(les.sites.has(id)?COL.lesion:(id==='optic'?COL.optic:(colorMode==='nerve'?COL[{III:'n3',IIIsup:'n3',IIIinf:'n3',cil:'n3',IV:'n4',VI:'n6'}[id]]:COL.nerve)));
    for(const seg of NDEF[id]){const pts=seg.pts.map(x=>resolve(Sd,x,id));const t=tubeMesh(pts,seg.r,pp.mat);Sd.add(pp,t,id);pp.tubes.push(t);}}
  {const pp=Sd.parts.cil;const g=new THREE.Mesh(new THREE.SphereGeometry(1.35,16,12),pp.mat);g.position.copy(V(-4.3,-1.9,-27.2));Sd.add(pp,g,'cil');pp.tubes.push(g);}
  {const pp=Sd.parts.symp;pp.tubes.forEach(t=>{pp.g.remove(t);t.geometry.dispose();const i=pickables.indexOf(t);if(i>=0)pickables.splice(i,1);});pp.tubes=[];
   pp.mat.color.copy(les.sites.has('symp')?COL.lesion:COL.symp);
   const c=new THREE.CatmullRomCurve3(icaPts(),false,'centripetal');const pts=[];for(let i=0;i<=90;i++){const u=i/90;const q=c.getPointAt(u),T=c.getTangentAt(u);const a=V(0,1,0).cross(T).normalize(),b=T.clone().cross(a).normalize(),ang=u*Math.PI*14;pts.push(q.add(a.multiplyScalar(Math.cos(ang)*2.5)).add(b.multiplyScalar(Math.sin(ang)*2.5)).add(off(Sd,'vasos')).sub(off(Sd,'symp')));}
   const t=tubeMesh(pts,0.22,pp.mat,300);Sd.add(pp,t,'symp');pp.tubes.push(t);}
  Sd.matSinus.color.set(les.sites.has('cs')?0xE0463A:0x6E68C4); Sd.matSinus.opacity=les.sites.has('cs')?0.34:0.2;
  Sd.parts.vasos.aneur.visible=les.aneur;
}
function updateMidline(){
  const R=SIDES.R, lr=EOM.lesionSites('R'), ll=EOM.lesionSites('L');
  const lit={n3R:lr.sites.has('n3nuc'),n3L:ll.sites.has('n3nuc'),n6R:lr.sites.has('n6nuc'),n6L:ll.sites.has('n6nuc'),pprfR:lr.sites.has('pprf'),pprfL:ll.sites.has('pprf'),n4L:lr.sites.has('IV'),n4R:ll.sites.has('IV')};
  for(const [id,m] of Object.entries(R.nuclei)){const on=!!lit[id];m.material.color.copy(on?COL.lesion:m.userData.base);m.material.emissive.copy(on?COL.lesion:m.userData.base).multiplyScalar(on?0.6:0.3);}
  R.mlfR.color.copy(lr.sites.has('MLF')?COL.lesion:COL.mlf); R.mlfL.color.copy(ll.sites.has('MLF')?COL.lesion:COL.mlf);
}
const markerMat=new THREE.MeshBasicMaterial({color:0xFF3B2E,transparent:true,opacity:.85,depthTest:false});
const markers=[];for(let i=0;i<16;i++){const m=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.35,8,28),markerMat);m.renderOrder=10;m.visible=false;scene.add(m);markers.push(m);}

function update(now){
  const S=EOM.S; if(!EOM.cur)return;
  if(reassemble){const k=Math.min(1,(now-reassemble.t0)/650),e=1-Math.pow(1-k,3);explodeV=reassemble.from*(1-e);reassemble.users.forEach(([p,u])=>p.user.copy(u).multiplyScalar(1-e));lastKey='';if(k>=1)reassemble=null;}
  else{const d=explodeT-explodeV;if(Math.abs(d)>0.001){explodeV+=d*0.18;lastKey='';}}
  const pR=EOM.disp.R, pL=EOM.disp.L;
  pivot.rotation.set(0,-S.yaw*D2R,S.tilt*D2R);
  const lr=EOM.lesionSites('R'), ll=EOM.lesionSites('L');
  const k=[mode,pR.map(x=>x.toFixed(2)).join(),pL.map(x=>x.toFixed(2)).join(),JSON.stringify(S.E),S.hidden,S.lift,[...lr.sites].join(),[...ll.sites].join(),lr.aneur,ll.aneur,explodeV.toFixed(3),colorMode,selected&&(selected.side+selected.info),JSON.stringify(layerOn),allParts().map(q=>q.hidden?1:0).join('')].join('|');
  // markers
  let mi=0;
  if(mode==='anat')for(const side of ['R','L']){const les=side==='R'?lr:ll;const Sd=SIDES[side];const pulse=0.5+0.5*Math.sin(now/260);
    for(const s of les.sites){const d=SITE[s];if(!d||mi>=markers.length)continue;const partSide=(d[1]==='brainstem')?'R':side;const Pp=SIDES[partSide].parts[d[1]];
      let lp=d[0].clone(); if(d[1]==='brainstem'&&side==='L')lp.x=2*XM-lp.x;
      const m=markers[mi++];m.visible=!!(Pp&&Pp.g.visible);m.position.copy(SIDES[partSide].root.localToWorld(lp.add(Pp?Pp.g.position:V(0,0,0))));m.scale.setScalar(0.9+0.35*pulse);m.lookAt(camA.position);}}
  for(;mi<markers.length;mi++)markers[mi].visible=false;
  const full=k!==lastKey; lastKey=k;
  if(full){poseEyes(pR,pL); updateMidline();}
  updateSide(SIDES.R,now,full); updateSide(SIDES.L,now,full);
  if(full){
    H.mesh.visible=mode==='face'||layerOn.piel; H.lashes.visible=H.mesh.visible;
    const tr=mode==='anat'; if(H.material.transparent!==tr){H.material.transparent=tr;H.material.depthWrite=!tr;H.material.needsUpdate=true;} H.material.opacity=tr?0.32:1;
  }
}

/* ---------- face camera, overlays, nine ---------- */
function frameFace(){camF.position.set(0,-10,480);camF.lookAt(0,-14,0);camF.updateMatrixWorld();}
const tmpV=new THREE.Vector3();
function eyeScreen(){ // CSS px in current host
  const h=hosts[hostKey];const w=h.clientWidth,hh=h.clientHeight;const out={};
  for(const side of ['R','L']){const Sd=SIDES[side];Sd.root.getWorldPosition(tmpV);const c=tmpV.clone().project(camF);const e=tmpV.clone().add(V(12,0,0)).project(camF);
    out[side]={x:(c.x+1)/2*w,y:(1-c.y)/2*h.clientHeight,r:Math.abs(e.x-c.x)/2*w};}
  return out;
}
function renderNine(cv,cells){
  if(!hostKey||mode!=='face')return false;
  const dpr=Math.min(2,devicePixelRatio||1);const W=cv.clientWidth,Hh=cv.clientHeight;if(!W||!Hh)return false;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(Hh*dpr);}
  const g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
  const cw=cv.width/3, ch=cv.height/3, gl=renderer.domElement, gw=gl.width, gh=gl.height;
  const cellH=ch*0.78, asp=cw/cellH;
  camN.aspect=gw/gh; camN.fov=7.2; camN.position.set(0,-2,430); camN.lookAt(0,-2,0); camN.updateProjectionMatrix();
  for(const Sd of Object.values(SIDES))for(const q of Object.values(Sd.parts))q.g.visible=q.id==='globe';
  H.mesh.visible=true;H.lashes.visible=true;
  const savedOp=H.material.opacity;H.material.opacity=1;
  cells.forEach((c,i)=>{
    poseEyes(c.R,c.L); for(const s of ['R','L'])SIDES[s].eye.updateReflex(camN); pen.position.copy(camN.position);
    renderer.render(scene,camN);
    let sw=gw, sh=gw/asp; if(sh>gh){sh=gh;sw=gh*asp;}
    const col=i%3,row=(i/3)|0; g.drawImage(gl,(gw-sw)/2,(gh-sh)/2,sw,sh,col*cw+2,row*ch+2,cw-4,cellH-4);
  });
  H.material.opacity=savedOp;
  lastKey=''; return true;
}
EOM.renderNine=renderNine;

function drawLabels(){
  const show=mode==='anat'&&labelMode!=='none';const r=hosts.main.getBoundingClientRect();
  const R=SIDES.R;
  LABELS.forEach(([t,pid,fn,cls,isKey],i)=>{const el=labEls[i];const p=R.parts[pid];
    if(!show||!p||!p.g.visible||(labelMode==='key'&&!isKey)){el.style.display='none';return;}
    let v;try{v=fn();}catch(e){el.style.display='none';return;}
    const w=R.root.localToWorld(v.add(p.g.position)).project(camA);
    if(w.z>1||Math.abs(w.x)>1.1||Math.abs(w.y)>1.1){el.style.display='none';return;}
    el.style.display='';el.style.left=((w.x+1)/2*r.width)+'px';el.style.top=((1-w.y)/2*r.height)+'px';});
  {const L=SIDES.L,p=L.parts.globe;const w=L.root.localToWorld(V(0,-16,6).add(p.g.position)).project(camA);
   if(show&&p.g.visible&&w.z<1){labOI.style.display='';labOI.style.left=((w.x+1)/2*r.width)+'px';labOI.style.top=((1-w.y)/2*r.height)+'px';}else labOI.style.display='none';}
  for(const side of ['R','L']){const el=lesLabs[side];const les=EOM.lesionSites(side);const first=[...les.sites].find(s=>SITE[s]);
    if(!show||!first){el.style.display='none';continue;}
    const d=SITE[first];const partSide=d[1]==='brainstem'?'R':side;const Pp=SIDES[partSide].parts[d[1]];if(!Pp||!Pp.g.visible){el.style.display='none';continue;}
    let lp=d[0].clone();if(d[1]==='brainstem'&&side==='L')lp.x=2*XM-lp.x;
    const w=SIDES[partSide].root.localToWorld(lp.add(Pp.g.position)).project(camA);
    el.style.display='';el.textContent='Lesión '+(side==='R'?'OD':'OI');el.style.left=((w.x+1)/2*r.width+6)+'px';el.style.top=((1-w.y)/2*r.height+16)+'px';}
}
function loop(now){
  requestAnimationFrame(loop);
  if(!hostKey)return; const h=hosts[hostKey]; if(!h||h.offsetParent===null)return;
  update(now);
  const cam=mode==='anat'?camA:camF;
  if(mode==='face')frameFace(); else controls.update();
  for(const s of ['R','L'])SIDES[s].eye.updateReflex(cam);
  pen.position.copy(cam.position);
  renderer.render(scene,cam);
  if(mode==='face')EOM.eyeScreen=eyeScreen(); else drawLabels();
}
EOM.onTab=t=>{if(t==='anat'){mount('main');}else if(t==='sim'){mount('face');}else if(t==='dx'){mount('face2');}EOM.markDirty&&EOM.markDirty();};
EOM.has3D=true; document.documentElement.classList.add('has3d');
EOM.onTab(EOM.S.tab);
requestAnimationFrame(loop);
