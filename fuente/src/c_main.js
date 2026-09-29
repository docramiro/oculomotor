(function(){
"use strict";
const D2R=Math.PI/180;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MUS=['LR','MR','SR','IR','SO','IO'];
const SHORT={LR:'RL',MR:'RM',SR:'RS',IR:'RI',SO:'OS',IO:'OI'};
const NERVE={LR:'n6',MR:'n3',SR:'n3',IR:'n3',SO:'n4',IO:'n3'};
const T0=15, OBL=0.6, HX=0.15, LIM=50;
const {CASES,TREE,INFO}=window.OCU_DATA;

/* ================= ENGINE ================= */
function action(m,h){
  const a=(23-h)*D2R, b=(51+h)*D2R;
  switch(m){
    case 'LR':return [1,0,0];
    case 'MR':return [-1,0,0];
    case 'SR':return [-HX, Math.cos(a), Math.sin(a)];
    case 'IR':return [-HX,-Math.cos(a),-Math.sin(a)];
    case 'SO':return [HX, -OBL*Math.cos(b), OBL*Math.sin(b)];
    case 'IO':return [HX,  OBL*Math.cos(b),-OBL*Math.sin(b)];
  }
}
const lim=(x,L)=>L*Math.tanh(x/L);
const NORMAL={LR:1,MR:1,SR:1,IR:1,SO:1,IO:1,LPS:1,para:1,symp:1,ino:0};
function forces(E,c,cvg){
  const inoF=c[0]<0?(1-0.92*E.ino):1;
  return {
    LR:E.LR*T0*Math.exp(c[0]-cvg), MR:E.MR*T0*Math.exp(-c[0]*inoF+cvg),
    SR:E.SR*T0*Math.exp(c[1]), IR:E.IR*T0*Math.exp(-c[1]),
    IO:E.IO*T0*Math.exp(c[2]), SO:E.SO*T0*Math.exp(-c[2])
  };
}
function forward(E,c,cvg){
  const f=forces(E,c,cvg); let p=[0,0,0];
  for(let k=0;k<7;k++){
    const s=[0,0,0];
    for(const m of MUS){const a=action(m,p[0]);s[0]+=f[m]*a[0];s[1]+=f[m]*a[1];s[2]+=f[m]*a[2];}
    p=[lim(s[0],LIM),lim(s[1],LIM),lim(s[2],20)];
  }
  return {p,f};
}
function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<3;i++){
    let mx=i;for(let r=i+1;r<3;r++)if(Math.abs(M[r][i])>Math.abs(M[mx][i]))mx=r;
    [M[i],M[mx]]=[M[mx],M[i]];
    const d=M[i][i]||1e-9;
    for(let r=0;r<3;r++){if(r===i)continue;const k=M[r][i]/d;for(let q=i;q<4;q++)M[r][q]-=k*M[i][q];}
  }
  return [M[0][3]/(M[0][0]||1e-9),M[1][3]/(M[1][1]||1e-9),M[2][3]/(M[2][2]||1e-9)];
}
const W=[1,1,0.45];
function inverse(E,tgt,cvg,cRef){
  const w=cRef?[1,1,0.1]:W, lamV=[0.14,0.6,0.6], CAP=1.5;
  let c=cRef?cRef.slice():[0,0,0];
  const res=cc=>{const p=forward(E,cc,cvg).p;const r=[(p[0]-tgt[0])*w[0],(p[1]-tgt[1])*w[1],(p[2]-tgt[2])*w[2]];
    if(cRef){for(let i=0;i<3;i++)r.push(lamV[i]*(cc[i]-cRef[i])*10);} return r;};
  let r=res(c), mu=0.02; const n2=v=>Math.hypot(...v);
  for(let it=0;it<22;it++){
    const n=n2(r); if(n<0.02)break;
    const m=r.length, J=[], h=1e-3;
    for(let i=0;i<m;i++)J.push([0,0,0]);
    for(let j=0;j<3;j++){const cc=c.slice();cc[j]+=h;const rr=res(cc);for(let i=0;i<m;i++)J[i][j]=(rr[i]-r[i])/h;}
    const A=[[0,0,0],[0,0,0],[0,0,0]],g=[0,0,0];
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<m;k++)s+=J[k][i]*J[k][j];A[i][j]=s+(i===j?mu*(1+s):0);}
    for(let i=0;i<3;i++){let s=0;for(let k=0;k<m;k++)s+=J[k][i]*r[k];g[i]=-s;}
    const dc=solve3(A,g);
    const cn=c.map((v,i)=>Math.max(-CAP,Math.min(CAP,v+Math.max(-1,Math.min(1,dc[i])))));
    const rn=res(cn);
    if(n2(rn)<n){c=cn;r=rn;mu=Math.max(1e-4,mu*0.4);}else{mu*=4;}
  }
  return c;
}

/* ================= LESIONS ================= */
const LES={
  normal:{label:'Sin lesión',keys:[]},
  III:{label:'III completo (con pupila)',keys:['MR','SR','IR','IO','LPS','para'],short:'III completo'},
  IIIps:{label:'III con respeto pupilar',keys:['MR','SR','IR','IO','LPS'],short:'III con respeto pupilar'},
  IIIsup:{label:'III · división superior',keys:['SR','LPS'],short:'III div. superior'},
  IIIinf:{label:'III · división inferior',keys:['MR','IR','IO','para'],short:'III div. inferior'},
  IV:{label:'IV troclear',keys:['SO'],short:'IV'},
  VI:{label:'VI abducens',keys:['LR'],short:'VI'},
  INO:{label:'Oftalmoplejía internuclear (FLM)',keys:['ino'],short:'INO'},
  HOR:{label:'Síndrome de Horner (contraste)',keys:['symp'],short:'Horner'},
  manual:{label:'Ajuste manual',keys:[],short:'ajuste manual'}
};
function weaken(E,keys,s){for(const k of keys){if(k==='ino')E.ino=Math.max(E.ino,s);else E[k]=Math.min(E[k],1-s);}}
const III_ALL=['MR','SR','IR','IO','LPS','para'];
const SYN={
  none:{label:'Ninguno'},
  CS:{label:'Seno cavernoso',f:(ip,co,s)=>weaken(ip,[...III_ALL,'SO','LR','symp'],s)},
  APEX:{label:'Ápex orbitario',f:(ip,co,s)=>weaken(ip,[...III_ALL,'SO','LR'],s)},
  VI2:{label:'VI bilateral (hipertensión intracraneal)',f:(ip,co,s)=>{weaken(ip,['LR'],s);weaken(co,['LR'],s);}},
  IV2:{label:'IV bilateral (traumático)',f:(ip,co,s)=>{weaken(ip,['SO'],s);weaken(co,['SO'],s);}},
  N3:{label:'Nuclear del III',f:(ip,co,s)=>{weaken(ip,['MR','IR','IO','SR','para'],s);weaken(co,['SR'],s);weaken(ip,['LPS'],s*0.8);weaken(co,['LPS'],s*0.8);}},
  OAH:{label:'Uno y medio',f:(ip,co,s)=>{weaken(ip,['LR'],s);ip.ino=s;co.ino=s;}},
  WEB:{label:'Weber (mesencéfalo ventral)',f:(ip,co,s)=>weaken(ip,III_ALL,s)}
};
const S={
  E:{R:{...NORMAL},L:{...NORMAL}},
  les:{R:'VI',L:'normal'}, sev:{R:100,L:100}, syn:{k:'none',side:'R',sev:100},
  gaze:{x:0,y:0}, fix:'L', cover:'', tilt:0, yaw:0, conv:false, verg:0, lift:true,
  hidden:false, tab:'sim'
};
const other=s=>s==='R'?'L':'R';
function applyLesion(side){
  const k=S.les[side]; if(k==='manual')return;
  const E={...NORMAL}; weaken(E,LES[k].keys,S.sev[side]/100); S.E[side]=E;
}
function applyAll(){
  if(S.syn.k!=='none'){
    const ip={...NORMAL}, co={...NORMAL}; SYN[S.syn.k].f(ip,co,S.syn.sev/100);
    S.E[S.syn.side]=ip; S.E[other(S.syn.side)]=co;
  } else { applyLesion('R'); applyLesion('L'); }
}
function fixEye(){return S.cover?other(S.cover):S.fix;}
const sideName=s=>s==='R'?'derecho':'izquierdo';
const sideShort=s=>s==='R'?'der.':'izq.';
function describeLesion(){
  if(S.hidden)return 'Lesión oculta';
  if(S.syn.k!=='none')return SYN[S.syn.k].label+(['VI2','IV2'].includes(S.syn.k)?'':' '+sideShort(S.syn.side));
  const a=[];for(const s of ['R','L']){const k=S.les[s];if(k!=='normal')a.push(LES[k].short+' '+sideShort(s)+(S.sev[s]<100&&k!=='manual'?` (${S.sev[s]} %)`:''));}
  return a.length?a.join(' + '):'Sin lesión';
}
function lesionSites(eye){
  const out=new Set(); let aneur=false;
  if(S.hidden)return {sites:out,aneur};
  const add=a=>a.forEach(x=>out.add(x));
  if(S.syn.k!=='none'){
    const same=S.syn.side===eye, k=S.syn.k;
    if(k==='CS'&&same)add(['cs','III','IIIsup','IIIinf','cil','IV','VI','symp']);
    if(k==='APEX'&&same)add(['III','IIIsup','IIIinf','IV','VI','optic','annulus']);
    if(k==='VI2')add(['VI']); if(k==='IV2')add(['IV']);
    if(k==='N3')add(same?['n3nuc','III']:['n3nuc']);
    if(k==='OAH')add(same?['n6nuc','pprf','MLF']:['MLF']);
    if(k==='WEB'&&same)add(['n3fasc','III','brainstem']);
  } else {
    const k=S.les[eye];
    if(k==='III'){add(['III','IIIsup','IIIinf','cil']);aneur=true;}
    if(k==='IIIps')add(['III']); if(k==='IIIsup')add(['IIIsup']); if(k==='IIIinf')add(['IIIinf','cil']);
    if(k==='IV')add(['IV']); if(k==='VI')add(['VI']); if(k==='INO')add(['MLF']); if(k==='HOR')add(['symp']);
    if(k==='manual'){const E=S.E[eye];if(E.LR<.9)add(['VI']);if(E.SO<.9)add(['IV']);if(E.SR<.9||E.LPS<.9)add(['IIIsup']);if(E.MR<.9||E.IR<.9||E.IO<.9)add(['IIIinf']);}
  }
  return {sites:out,aneur};
}

/* ================= SIMULATION ================= */
const CONV=12;
const convDeg=()=>S.conv?CONV:(S.verg||0);
function targets(gx,gy){
  const ex=gx-S.yaw, conv=convDeg(), kt=0.3;
  return {R:[ex-conv,gy,kt*S.tilt], L:[-ex-conv,gy,-kt*S.tilt]};
}
function compute(gx,gy){
  const T=targets(gx,gy), F=fixEye(), O=other(F);
  const cvg=convDeg()>0?Math.asinh(convDeg()/(2*T0)):0;
  const cFh=inverse(NORMAL,T[F],cvg), cOh=inverse(NORMAL,T[O],cvg), cF=inverse(S.E[F],T[F],cvg,cFh);
  const d=[cF[0]-cFh[0],cF[1]-cFh[1],cF[2]-cFh[2]];
  const cO=[cOh[0]-d[0],cOh[1]+d[2],cOh[2]+d[1]];
  const out={F,O,T};
  const rF=forward(S.E[F],cF,cvg), rO=forward(S.E[O],cO,cvg);
  out[F]={p:rF.p,f:rF.f}; out[O]={p:rO.p,f:rO.f};
  return out;
}
function deviation(r){
  const dR=[0,1,2].map(i=>r.R.p[i]-r.T.R[i]), dL=[0,1,2].map(i=>r.L.p[i]-r.T.L[i]);
  return {dR,dL,eso:-(dR[0]+dL[0]), rht:dR[1]-dL[1], extR:-dR[2], extL:-dL[2]};
}
const PD=deg=>100*Math.tan(Math.abs(deg)*D2R);
function pupilMM(E){return 3.5+3.0*(1-E.para)-1.3*(1-E.symp);}
function lidOpen(E){return Math.max(0.03,0.12+0.88*E.LPS-0.22*(1-E.symp));}

/* ================= COLORS ================= */
let C={};
function readColors(){
  const cs=getComputedStyle(document.documentElement);
  for(const k of ['bg','panel','panel2','ink','muted','line','n3','n4','n6','accent','skin','skin-2','skin-dark','sclera','iris','lidline','lash','lip','stage','stage-2','screen','screen-line','screen-ink','bad'])C[k]=cs.getPropertyValue('--'+k).trim();
}
readColors();
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();markDirty();});}catch(e){}
new MutationObserver(()=>{readColors();markDirty();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

/* ================= DRAWING ================= */
function fit(cv){const r=cv.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1);const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}return {w:r.width,h:r.height,d};}
const IRIS_RAYS=Array.from({length:44},(_,i)=>({a:i/44*Math.PI*2+((i*7919)%13)/13*0.12, l:0.55+((i*104729)%17)/17*0.4, lite:i%3===0}));

function drawEye(ctx,side,cx,cy,R,p,E,opt){
  const h=p[0]*D2R, v=p[1]*D2R, t=p[2];
  const sgn=side==='R'?-1:1;
  const dx=sgn*R*Math.sin(h)*Math.cos(v), dy=-R*Math.sin(v);
  const Wd=1.32*R, up=0.62*R, lo=0.5*R;
  const vlid=Math.max(-0.35,Math.min(0.35,p[1]/50))*R;
  const open=lidOpen(E);
  const nasal=side==='R'?1:-1; // viewer-space direction of the nose for this eye
  const icx=cx+nasal*Wd, ocx=cx-nasal*Wd; // inner/outer canthus x
  const icy=cy+R*0.04, ocy=cy-R*0.06;
  const fullUp=up+vlid*0.6;
  const almond=(u)=>{ctx.beginPath();ctx.moveTo(icx,icy);ctx.bezierCurveTo(icx-nasal*Wd*0.35,cy-1.45*u,ocx+nasal*Wd*0.45,cy-1.35*u,ocx,ocy);ctx.bezierCurveTo(ocx+nasal*Wd*0.45,cy+1.2*lo,icx-nasal*Wd*0.4,cy+1.3*lo,icx,icy);ctx.closePath();};
  // socket shadow
  if(!opt.simple){ctx.save();ctx.beginPath();ctx.ellipse(cx,cy-R*0.1,Wd*1.25,R*1.05,0,0,7);const sg=ctx.createRadialGradient(cx,cy,R*0.5,cx,cy,R*1.4);sg.addColorStop(0,'rgba(90,55,35,.18)');sg.addColorStop(1,'rgba(90,55,35,0)');ctx.fillStyle=sg;ctx.fill();ctx.restore();}
  ctx.save();
  almond(fullUp); ctx.fillStyle=C.sclera; ctx.fill(); ctx.clip();
  const g=ctx.createRadialGradient(cx,cy,R*0.25,cx,cy,R*1.35); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(120,70,60,.28)');
  ctx.fillStyle=g; ctx.fillRect(cx-Wd*1.1,cy-R,2.2*Wd,2*R);
  // caruncle
  ctx.beginPath(); ctx.ellipse(icx-nasal*R*0.16,icy,R*0.2,R*0.15,0,0,7); ctx.fillStyle='rgba(214,120,118,.75)'; ctx.fill();
  // iris
  const ri=0.5*R, th=Math.acos(Math.max(-1,Math.min(1,Math.cos(h)*Math.cos(v)))), phi=Math.atan2(dy,dx), fs=Math.max(0.15,Math.cos(th));
  const ix=cx+dx, iy=cy+dy;
  ctx.save(); ctx.translate(ix,iy); ctx.rotate(phi); ctx.scale(fs,1); ctx.rotate(-phi);
  const ig=ctx.createRadialGradient(0,0,ri*0.15,0,0,ri); ig.addColorStop(0,'#A0764A'); ig.addColorStop(0.45,'#7C5634'); ig.addColorStop(0.85,C.iris); ig.addColorStop(1,'#241810');
  ctx.beginPath(); ctx.arc(0,0,ri,0,7); ctx.fillStyle=ig; ctx.fill();
  if(!opt.simple){
    ctx.lineWidth=Math.max(0.6,R*0.02);
    for(const ray of IRIS_RAYS){ctx.strokeStyle=ray.lite?'rgba(230,190,140,.28)':'rgba(40,24,12,.3)';ctx.beginPath();ctx.moveTo(Math.cos(ray.a)*ri*0.32,Math.sin(ray.a)*ri*0.32);ctx.lineTo(Math.cos(ray.a)*ri*ray.l,Math.sin(ray.a)*ri*ray.l);ctx.stroke();}
    ctx.beginPath(); ctx.arc(0,0,ri*0.47,0,7); ctx.strokeStyle='rgba(210,165,110,.35)'; ctx.lineWidth=Math.max(0.8,R*0.03); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0,0,ri*0.985,0,7); ctx.strokeStyle='rgba(20,12,6,.65)'; ctx.lineWidth=Math.max(1,R*0.045); ctx.stroke();
  const pr=ri*pupilMM(E)/6.5;
  ctx.beginPath(); ctx.arc(0,0,pr,0,7); ctx.fillStyle='#070505'; ctx.fill();
  // torsion mark
  const tAng=(-90+(side==='R'?t:-t))*D2R;
  ctx.strokeStyle='#E0493A'; ctx.lineWidth=Math.max(1.5,R*0.065); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(Math.cos(tAng)*ri*0.74,Math.sin(tAng)*ri*0.74); ctx.lineTo(Math.cos(tAng)*ri*1.16,Math.sin(tAng)*ri*1.16); ctx.stroke();
  ctx.restore();
  // window highlight + corneal reflex
  if(!opt.simple){ctx.beginPath();ctx.ellipse(ix-ri*0.38,iy-ri*0.42,ri*0.2,ri*0.12,-0.5,0,7);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fill();}
  if(opt.reflex){ctx.beginPath();ctx.arc(cx+dx*0.35,cy+dy*0.35,Math.max(1.6,R*0.075),0,7);ctx.fillStyle='rgba(255,255,255,.97)';ctx.fill();}
  // ptotic lid
  const lidU=fullUp*(2*open-1);
  if(open<0.97){
    const alpha=opt.lift?0.38:1;
    ctx.beginPath();ctx.moveTo(icx,icy);ctx.bezierCurveTo(icx-nasal*Wd*0.35,cy-1.45*lidU,ocx+nasal*Wd*0.45,cy-1.35*lidU,ocx,ocy);ctx.lineTo(ocx,cy-3*R);ctx.lineTo(icx,cy-3*R);ctx.closePath();
    ctx.globalAlpha=alpha; const lg=ctx.createLinearGradient(0,cy-R,0,cy+R*0.4); lg.addColorStop(0,C['skin']); lg.addColorStop(1,C['skin-2']); ctx.fillStyle=lg; ctx.fill(); ctx.globalAlpha=1;
    ctx.beginPath();ctx.moveTo(icx,icy);ctx.bezierCurveTo(icx-nasal*Wd*0.35,cy-1.45*lidU,ocx+nasal*Wd*0.45,cy-1.35*lidU,ocx,ocy);
    ctx.strokeStyle=C.lash; ctx.lineWidth=Math.max(1,R*0.05); ctx.setLineDash(opt.lift?[4,3]:[]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // lid margin, lashes, crease, lower lid
  const upperCurve=(u)=>{ // point on upper lid curve at param s
    return s=>{const a=[icx,icy],b=[icx-nasal*Wd*0.35,cy-1.45*u],c=[ocx+nasal*Wd*0.45,cy-1.35*u],d=[ocx,ocy];const q=1-s;
      return [q*q*q*a[0]+3*q*q*s*b[0]+3*q*s*s*c[0]+s*s*s*d[0], q*q*q*a[1]+3*q*q*s*b[1]+3*q*s*s*c[1]+s*s*s*d[1]];};};
  almond(fullUp); ctx.strokeStyle=C.lidline; ctx.lineWidth=Math.max(1,R*0.045); ctx.stroke();
  const marginU=open<0.97&&!opt.lift?lidU:fullUp; const cu=upperCurve(marginU);
  ctx.beginPath(); for(let i=0;i<=24;i++){const [x,y]=cu(i/24); i?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.strokeStyle=C.lash; ctx.lineWidth=Math.max(1.3,R*0.075); ctx.stroke();
  if(!opt.simple){
    ctx.strokeStyle=C.lash; ctx.lineWidth=Math.max(0.8,R*0.03); ctx.lineCap='round';
    for(let i=2;i<=21;i++){const s=i/23;const [x,y]=cu(s);const len=R*(0.16+0.12*Math.sin(Math.PI*s));const dirx=-nasal*(s-0.35)*0.9;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+dirx*len*0.4,y-len*0.7,x+dirx*len,y-len*1.05);ctx.stroke();}
    ctx.beginPath(); ctx.moveTo(icx-nasal*Wd*0.15,cy-fullUp*0.72); ctx.bezierCurveTo(icx-nasal*Wd*0.5,cy-fullUp*2.2,ocx+nasal*Wd*0.5,cy-fullUp*2.15,ocx+nasal*Wd*0.02,cy-fullUp*0.6);
    ctx.strokeStyle=C['skin-dark']; ctx.globalAlpha=0.7; ctx.lineWidth=Math.max(1,R*0.04); ctx.stroke(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.moveTo(icx-nasal*Wd*0.2,cy+lo*0.95); ctx.bezierCurveTo(icx-nasal*Wd*0.6,cy+lo*1.55,ocx+nasal*Wd*0.5,cy+lo*1.45,ocx+nasal*Wd*0.05,cy+lo*0.5);
    ctx.strokeStyle=C['skin-dark']; ctx.globalAlpha=0.35; ctx.stroke(); ctx.globalAlpha=1;
  }
  if(opt.covered){
    ctx.save(); ctx.fillStyle='#1B2422'; ctx.globalAlpha=0.9; ctx.beginPath(); ctx.ellipse(cx,cy,Wd*1.18,R*1.08,0,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle='#E6EEEB'; ctx.font=`600 ${Math.max(9,R*0.27)}px Archivo, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('oclusor',cx,cy); ctx.restore();
  }
}

function fmtGaze(x,y){
  if(Math.abs(x)<1&&Math.abs(y)<1)return 'al frente';
  const a=[]; if(Math.abs(y)>=1)a.push((y>0?'arriba ':'abajo ')+Math.round(Math.abs(y))+'°'); if(Math.abs(x)>=1)a.push((x>0?'a la derecha ':'a la izquierda ')+Math.round(Math.abs(x))+'°');
  return a.join(', ');
}
function drawOverlay(cv,store,opts){
  const {w,h,d}=fit(cv); const ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0); ctx.clearRect(0,0,w,h);
  const es=EOM.eyeScreen; const cx=w/2, cy=es?(es.R.y+es.L.y)/2:h*0.45; const k=Math.min(w,h)/95;
  store.cx=cx; store.cy=cy; store.k=k;
  const ink='rgba(226,236,232,.85)';
  if(es){ctx.font='600 11px Archivo, sans-serif';ctx.textAlign='center';ctx.fillStyle=ink;
    for(const s of ['R','L']){const e=es[s];
      if(S.cover===s){ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle='#0E1413';ctx.globalAlpha=.94;ctx.beginPath();ctx.ellipse(0,0,e.r*2.1,e.r*1.7,0,0,7);ctx.fill();ctx.fillRect(-e.r*0.35,e.r*1.4,e.r*0.7,h);ctx.globalAlpha=1;ctx.fillStyle='#DDE8E4';ctx.fillText('oclusor',0,4);ctx.restore();}
      ctx.fillStyle=ink;ctx.fillText(s==='R'?'OD':'OI',e.x,e.y+e.r*1.75+6);}}
  const tx=cx-S.gaze.x*k, ty=cy-S.gaze.y*k;
  const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,18); tg.addColorStop(0,'rgba(255,214,110,.8)'); tg.addColorStop(1,'rgba(255,214,110,0)');
  ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(tx,ty,18,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(tx,ty,4.5,0,7); ctx.fillStyle='#FFD36A'; ctx.fill(); ctx.strokeStyle='#5B4312'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=ink; ctx.font='500 11px Archivo, sans-serif'; ctx.textAlign='left';
  if(!opts||!opts.compact){ctx.fillText('← derecha del paciente',10,h-10); ctx.textAlign='right'; ctx.fillText('izquierda del paciente →',w-10,h-10);}
  ctx.textAlign='left'; ctx.fillText('Linterna: '+fmtGaze(S.gaze.x,S.gaze.y),10,18);
  if(S.tilt||S.yaw){ctx.textAlign='right';const parts=[];if(S.tilt)parts.push('inclinada a la '+(S.tilt>0?'derecha ':'izquierda ')+Math.abs(S.tilt)+'°');if(S.yaw)parts.push('cara a la '+(S.yaw>0?'derecha ':'izquierda ')+Math.abs(S.yaw)+'°');ctx.fillText('Cabeza '+parts.join(' · '),w-10,18);}
  if(convDeg()>=3){ctx.textAlign='center';ctx.fillStyle='#8FE0D2';ctx.fillText('Convergencia (objetivo cercano)',cx,h-28);}
}
function drawFace(cv,disp,store,opts){
  if(EOM.has3D)return drawOverlay(cv,store,opts);
  const {w,h,d}=fit(cv); const ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0); ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h*0.45, R=Math.min(w/10.5,h/9.2); const k=Math.min(w,h)/95;
  store.cx=cx; store.cy=cy; store.k=k;
  const bg=ctx.createRadialGradient(cx,cy,10,cx,cy,Math.max(w,h)*0.7); bg.addColorStop(0,C.stage); bg.addColorStop(1,C['stage-2']); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  ctx.fillStyle=C.line;
  for(let gx=-40;gx<=40;gx+=10)for(let gy=-30;gy<=30;gy+=10){ctx.beginPath();ctx.arc(cx-gx*k,cy-gy*k,1.2,0,7);ctx.fill();}
  ctx.save(); ctx.translate(cx,cy+R*0.9); ctx.rotate(-S.tilt*D2R); ctx.translate(0,-R*0.9);
  const yo=-S.yaw/30*R*0.55;
  // neck & head
  ctx.beginPath(); ctx.moveTo(-R*1.6,R*4.4); ctx.lineTo(-R*1.7,R*7); ctx.lineTo(R*1.7,R*7); ctx.lineTo(R*1.6,R*4.4); ctx.fillStyle=C['skin-2']; ctx.fill();
  const hg=ctx.createRadialGradient(yo*0.3-R*0.8,-R*0.6,R*0.5,yo*0.3,R*0.9,R*4.6); hg.addColorStop(0,C.skin); hg.addColorStop(0.75,C.skin); hg.addColorStop(1,C['skin-2']);
  ctx.beginPath(); ctx.ellipse(yo*0.3,R*0.9,R*3.55,R*4.45,0,0,7); ctx.fillStyle=hg; ctx.fill();
  // hair
  ctx.save(); ctx.beginPath(); ctx.ellipse(yo*0.3,R*0.9,R*3.62,R*4.52,0,0,7); ctx.clip();
  ctx.beginPath(); ctx.moveTo(-R*4,-R*1.8); ctx.bezierCurveTo(-R*2.6,-R*2.9,R*2.2,-R*2.6,R*4,-R*2.1); ctx.lineTo(R*4,-R*5); ctx.lineTo(-R*4,-R*5); ctx.closePath(); ctx.fillStyle='#3B2A20'; ctx.fill(); ctx.restore();
  // brows
  for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*R*0.85+yo*0.4,-R*1.0);ctx.quadraticCurveTo(s*R*1.9+yo*0.4,-R*1.5,s*R*3.0+yo*0.4,-R*1.0);ctx.strokeStyle='#4A3325';ctx.lineWidth=R*0.2;ctx.lineCap='round';ctx.stroke();}
  // nose
  ctx.beginPath(); ctx.moveTo(yo*0.6+R*0.35,-R*0.5); ctx.quadraticCurveTo(yo*1.1+R*0.5,R*0.9,yo+R*0.55,R*1.5); ctx.strokeStyle=C['skin-dark']; ctx.globalAlpha=0.45; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1;
  ctx.beginPath(); ctx.moveTo(yo-R*0.55,R*1.55); ctx.quadraticCurveTo(yo,R*1.9,yo+R*0.55,R*1.55); ctx.strokeStyle=C['skin-dark']; ctx.lineWidth=2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(yo-R*0.3,R*1.62,R*0.13,R*0.07,0,0,7); ctx.ellipse(yo+R*0.3,R*1.62,R*0.13,R*0.07,0,0,7); ctx.fillStyle=C['skin-dark']; ctx.globalAlpha=.6; ctx.fill(); ctx.globalAlpha=1;
  // mouth
  ctx.beginPath(); ctx.moveTo(yo*0.7-R*0.85,R*2.62); ctx.quadraticCurveTo(yo*0.7-R*0.3,R*2.45,yo*0.7,R*2.55); ctx.quadraticCurveTo(yo*0.7+R*0.3,R*2.45,yo*0.7+R*0.85,R*2.62); ctx.quadraticCurveTo(yo*0.7,R*3.05,yo*0.7-R*0.85,R*2.62); ctx.fillStyle=C.lip; ctx.fill();
  const ex=R*1.95;
  drawEye(ctx,'R',-ex+yo*0.35,0,R,disp.R,S.E.R,{reflex:true,lift:S.lift,covered:S.cover==='R'});
  drawEye(ctx,'L', ex+yo*0.35,0,R,disp.L,S.E.L,{reflex:true,lift:S.lift,covered:S.cover==='L'});
  ctx.fillStyle=C.muted; ctx.font='600 11px Archivo, sans-serif'; ctx.textAlign='center';
  ctx.fillText('OD',-ex+yo*0.35,R*1.3); ctx.fillText('OI',ex+yo*0.35,R*1.3);
  ctx.restore();
  // penlight target
  const tx=cx-S.gaze.x*k, ty=cy-S.gaze.y*k;
  const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,16); tg.addColorStop(0,'rgba(255,214,110,.75)'); tg.addColorStop(1,'rgba(255,214,110,0)');
  ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(tx,ty,16,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(tx,ty,4.5,0,7); ctx.fillStyle='#FFD36A'; ctx.fill(); ctx.strokeStyle='#5B4312'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=C.muted; ctx.font='500 11px Archivo, sans-serif'; ctx.textAlign='left';
  if(!opts||!opts.compact){ctx.fillText('← derecha del paciente',10,h-10); ctx.textAlign='right'; ctx.fillText('izquierda del paciente →',w-10,h-10);}
  ctx.textAlign='left'; ctx.fillText('Linterna: '+fmtGaze(S.gaze.x,S.gaze.y),10,18);
  if(S.tilt||S.yaw){ctx.textAlign='right';const parts=[];if(S.tilt)parts.push('inclinada a la '+(S.tilt>0?'derecha ':'izquierda ')+Math.abs(S.tilt)+'°');if(S.yaw)parts.push('cara a la '+(S.yaw>0?'derecha ':'izquierda ')+Math.abs(S.yaw)+'°');ctx.fillText('Cabeza '+parts.join(' · '),w-10,18);}
  if(convDeg()>=3){ctx.textAlign='center';ctx.fillStyle=C.accent;ctx.fillText('Convergencia (objetivo cercano)',cx,h-26);}
}

/* nine positions */
const NINE=[[25,20],[0,20],[-25,20],[25,0],[0,0],[-25,0],[25,-20],[0,-20],[-25,-20]];
let nineCache=null;
function devLabel(dv){
  const parts=[]; if(Math.abs(dv.eso)>=1)parts.push((dv.eso>0?'ET ':'XT ')+Math.round(PD(dv.eso))+'Δ');
  if(Math.abs(dv.rht)>=1)parts.push((dv.rht>0?'HTD ':'HTI ')+Math.round(PD(dv.rht))+'Δ');
  return parts;
}
function drawNine(cv){
  const {w,h,d}=fit(cv); const ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0); ctx.clearRect(0,0,w,h);
  const cw=w/3, ch=h/3;
  if(!nineCache)nineCache=NINE.map(([x,y])=>{const r=compute(x,y);return {r,dv:deviation(r)};});
  const in3d=EOM.renderNine&&EOM.renderNine(cv,nineCache.map(c=>({R:c.r.R.p,L:c.r.L.p})));
  ctx.setTransform(d,0,0,d,0,0);
  NINE.forEach(([x,y],i)=>{
    const col=i%3,row=Math.floor(i/3), ox=col*cw+cw/2, oy=row*ch+ch*0.44;
    const {r,dv}=nineCache[i]; const R=Math.min(cw/7.4,ch/3.4);
    if(!in3d){
    ctx.fillStyle=C.skin; ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(ox-R*3.8,oy-R*1.35,R*7.6,R*2.6,R*0.9); else ctx.rect(ox-R*3.8,oy-R*1.35,R*7.6,R*2.6); ctx.fill();
    drawEye(ctx,'R',ox-R*1.85,oy,R,r.R.p,S.E.R,{reflex:true,lift:true,simple:true});
    drawEye(ctx,'L',ox+R*1.85,oy,R,r.L.p,S.E.L,{reflex:true,lift:true,simple:true});}
    const parts=devLabel(dv);
    ctx.font=`600 ${Math.max(9.5,Math.min(12,cw/13))}px JetBrains Mono, monospace`; ctx.textAlign='center';
    ctx.fillStyle=parts.length?C.bad:C.muted; ctx.fillText(parts.length?parts.join(' · '):'orto',ox,row*ch+ch*0.9);
    ctx.strokeStyle=C.line; ctx.lineWidth=1;
    if(col<2){ctx.beginPath();ctx.moveTo((col+1)*cw,row*ch+6);ctx.lineTo((col+1)*cw,row*ch+ch-6);ctx.stroke();}
    if(row<2){ctx.beginPath();ctx.moveTo(col*cw+6,(row+1)*ch);ctx.lineTo(col*cw+cw-6,(row+1)*ch);ctx.stroke();}
  });
}

/* patient view */
function diplopiaText(dv){
  const msg=[]; const e=dv.eso, v=dv.rht;
  if(S.cover)return `Con ${S.cover==='R'?'OD':'OI'} tapado el paciente ve una sola imagen: la diplopía binocular desaparece al ocluir un ojo.`;
  if(Math.abs(e)>=1.5)msg.push(e>0?`Diplopía horizontal <b>no cruzada</b> (homónima): cada imagen queda del lado de su ojo. Separación ${Math.round(PD(e))}Δ.`:`Diplopía horizontal <b>cruzada</b> (heterónima): cada imagen queda del lado opuesto a su ojo. Separación ${Math.round(PD(e))}Δ.`);
  if(Math.abs(v)>=1)msg.push(`Diplopía vertical: la imagen más baja pertenece al ojo más alto (${v>0?'OD':'OI'}).`);
  const tt=Math.abs(dv.extR)>Math.abs(dv.extL)?{s:'OD',t:dv.extR}:{s:'OI',t:dv.extL};
  if(Math.abs(tt.t)>=2)msg.push(`${tt.s} en ${tt.t>0?'extorsión':'intorsión'} de ${Math.abs(tt.t).toFixed(0)}°: su imagen se ve inclinada.`);
  return msg.length?msg.join(' '):'Visión única: ambas imágenes caen en la fóvea.';
}
function drawPatient(cv,dv){
  const {w,h,d}=fit(cv); const ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0);
  ctx.fillStyle=C.screen; ctx.fillRect(0,0,w,h);
  const cx=w/2, cy=h/2, k=Math.min(w,h)/60;
  ctx.strokeStyle=C['screen-line']; ctx.lineWidth=1;
  for(let a=-40;a<=40;a+=10){ctx.beginPath();ctx.moveTo(cx+a*k,0);ctx.lineTo(cx+a*k,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,cy+a*k);ctx.lineTo(w,cy+a*k);ctx.stroke();}
  ctx.strokeStyle=C['screen-ink']; ctx.globalAlpha=0.35; ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke(); ctx.globalAlpha=1;
  ctx.fillStyle=C['screen-ink']; ctx.font='500 10px JetBrains Mono, monospace'; ctx.textAlign='left'; ctx.fillText('10°',cx+10*k+3,cy-4);
  const lenH=Math.min(h*0.26,64);
  for(const side of ['L','R']){
    if(S.cover===side)continue;
    const dev=side==='R'?dv.dR:dv.dL, dxw=side==='R'?dev[0]:-dev[0];
    const x=cx-dxw*k, y=cy+dev[1]*k, rot=-(side==='R'?-dev[2]:dev[2]);
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot*D2R);
    const col=side==='R'?'#FF5A4A':'#F4F2EA';
    ctx.shadowColor=col; ctx.shadowBlur=14; ctx.fillStyle=col; ctx.globalAlpha=0.88; ctx.fillRect(-3.5,-lenH/2,7,lenH); ctx.restore();
    ctx.fillStyle=side==='R'?'#FF8A7E':C['screen-ink']; ctx.font='600 11px Archivo, sans-serif'; ctx.textAlign='center';
    ctx.fillText(side==='R'?'OD':'OI',x,y+lenH/2+14);
  }
  ctx.fillStyle=C['screen-ink']; ctx.textAlign='left'; ctx.font='500 11px Archivo, sans-serif'; ctx.fillText('Mira: '+fmtGaze(S.gaze.x,S.gaze.y),10,h-10);
}

/* readouts */
function setRO(id,v,s,bad){const e=$(id);e.textContent=v;e.className='v'+(bad?' bad':'');$(id+'s').textContent=s;}
function updateReadouts(dv){
  const e=dv.eso; setRO('roH',Math.abs(e)<1?'orto':`${e>0?'ET':'XT'} ${Math.round(PD(e))}Δ`,Math.abs(e)<1?'sin desviación':`${Math.abs(e).toFixed(1)}° · ${e>0?'endotropia':'exotropia'}`,Math.abs(e)>=1);
  const v=dv.rht; setRO('roV',Math.abs(v)<1?'orto':`${v>0?'HTD':'HTI'} ${Math.round(PD(v))}Δ`,Math.abs(v)<1?'sin desviación':`${Math.abs(v).toFixed(1)}° · hipertropia ${v>0?'derecha':'izquierda'}`,Math.abs(v)>=1);
  const tf=t=>Math.abs(t)<1?'0°':`${t>0?'ext':'int'} ${Math.abs(t).toFixed(0)}°`;
  setRO('roT',`${tf(dv.extR)} / ${tf(dv.extL)}`,'OD / OI respecto a lo esperado',Math.abs(dv.extR)>=2||Math.abs(dv.extL)>=2);
  const pR=pupilMM(S.E.R), pL=pupilMM(S.E.L);
  setRO('roP',`${pR.toFixed(1)} / ${pL.toFixed(1)}`,Math.abs(pR-pL)>=0.5?`anisocoria de ${Math.abs(pR-pL).toFixed(1)} mm`:'isocóricas (mm, luz ambiente)',Math.abs(pR-pL)>=0.5);
}
function examLine(dv){
  const parts=devLabel(dv); const pR=pupilMM(S.E.R),pL=pupilMM(S.E.L);
  const tf=t=>Math.abs(t)<2?'':` · ${t>0?'ext':'int'} ${Math.abs(t).toFixed(0)}°`;
  $('examLine').textContent=`${fmtGaze(S.gaze.x,S.gaze.y)} → ${parts.length?parts.join(' · '):'ortotropia'}${tf(dv.extR)?' · OD'+tf(dv.extR):''}${tf(dv.extL)?' · OI'+tf(dv.extL):''} · pupilas ${pR.toFixed(1)}/${pL.toFixed(1)} mm`;
}

/* interpretation */
const CLIN={
  III:{t:'III par completo',p:['Ojo abajo y afuera: el recto lateral (VI) y el oblicuo superior (IV) actúan sin oposición. Ptosis completa por pérdida del elevador. Midriasis arreactiva y pérdida de la acomodación por lesión de las fibras parasimpáticas.','Con la pupila afectada piensa primero en compresión: aneurisma de la arteria comunicante posterior o herniación uncal. Requiere angio-TC o angio-RM urgente.']},
  IIIps:{t:'III par con respeto pupilar',p:['Misma oftalmoplejía y ptosis, con pupila normal. Las fibras pupilomotoras viajan en la periferia del nervio, irrigadas por vasos piales; la isquemia microvascular daña el centro.','Típico de diabetes e hipertensión; suele recuperarse en 8 a 12 semanas. Vigila la pupila en los primeros días.']},
  IIIsup:{t:'III par · división superior',p:['Ptosis y limitación de la elevación (recto superior). El III se divide en el seno cavernoso anterior o en la fisura orbitaria superior, así que una lesión divisional orienta a esa región.']},
  IIIinf:{t:'III par · división inferior',p:['Exotropia con limitación de la aducción y la depresión, y midriasis. El párpado se conserva porque el elevador depende de la división superior.']},
  IV:{t:'IV par (troclear)',p:['Hipertropia del ojo afectado que aumenta en la mirada contralateral, hacia abajo y al inclinar la cabeza hacia el lado lesionado (Bielschowsky). Extorsión del ojo afectado.','Postura compensadora: cabeza inclinada hacia el lado sano, mentón abajo. El traumatismo es la causa adquirida más frecuente. Por su decusación completa, una lesión nuclear afecta al ojo contralateral.']},
  VI:{t:'VI par (abducens)',p:['Endotropia con limitación de la abducción. Diplopía horizontal no cruzada que empeora de lejos y hacia el lado lesionado. Postura compensadora: cara girada hacia el lado afectado.','Causas: isquemia microvascular, hipertensión intracraneal (signo falso localizador por el canal de Dorello), tumores del clivus o del ángulo pontocerebeloso, encefalopatía de Wernicke.']},
  INO:{t:'Oftalmoplejía internuclear (FLM)',p:['Lesión del fascículo longitudinal medial del lado del ojo que no aduce. En la mirada lateral ese ojo se queda corto en aducción y el contralateral presenta nistagmo en abducción. La convergencia se conserva: pruébalo con el botón Convergencia.','Bilateral en una persona joven: esclerosis múltiple. Unilateral en un adulto mayor: infarto del tronco.']},
  HOR:{t:'Síndrome de Horner (contraste)',p:['No es un par craneal: es la vía simpática. Ptosis leve de 1 a 2 mm (músculo de Müller), miosis y anhidrosis variable; la anisocoria aumenta en la oscuridad. Motilidad normal.']},
  manual:{t:'Ajuste manual',p:['Cada control es la fuerza del músculo (100 % = normal). Prueba paresias parciales o combinaciones.']},
  CS:{t:'Síndrome del seno cavernoso',p:['Afecta III, IV, VI, V1 (y V2) y el simpático pericarotídeo: oftalmoplejía dolorosa con pupila media arreactiva e hipoestesia facial. El VI viaja dentro del seno, junto a la carótida; los demás, en la pared lateral.','Causas: fístula carótido-cavernosa, trombosis séptica, aneurisma cavernoso, tumores (meningioma, adenoma hipofisario, metástasis) y síndrome de Tolosa-Hunt.']},
  APEX:{t:'Síndrome del ápex orbitario',p:['Oftalmoplejía de III, IV y VI con V1 y, además, neuropatía óptica: pérdida visual y defecto pupilar aferente relativo. Sin afección del II se llama síndrome de la fisura orbitaria superior.','Causas: inflamación orbitaria, mucormicosis y aspergilosis en diabéticos, tumores y traumatismo.']},
  VI2:{t:'Paresia bilateral del VI',p:['Endotropia que aumenta en la mirada a ambos lados. En la hipertensión intracraneal el VI se estira en el canal de Dorello: es un signo falso localizador. Revisa el fondo de ojo.']},
  IV2:{t:'Parálisis bilateral del IV',p:['Hipertropia que alterna: derecha en la mirada a la izquierda e izquierda en la mirada a la derecha, con Bielschowsky positivo a ambos lados. Suele haber endotropia en V y extorsión grande (más de 10°). Típica del traumatismo craneal grave.']},
  N3:{t:'Lesión nuclear del III',p:['El subnúcleo del recto superior inerva al RS contralateral y el núcleo caudal central, único, inerva ambos elevadores: una lesión nuclear da ptosis bilateral y debilidad de ambos RS, además del III ipsilateral.','Causas: infartos mesencefálicos paramedianos (arteria de Percheron), tumores, desmielinización.']},
  OAH:{t:'Síndrome del uno y medio',p:['Lesión del núcleo del VI o la FRPP más el FLM del mismo lado. Hacia el lado de la lesión no se mueve ningún ojo; hacia el otro solo abduce el ojo contralateral, con nistagmo. La convergencia se conserva.','Causas: esclerosis múltiple, infarto o tumor de la protuberancia.']},
  WEB:{t:'Síndrome de Weber',p:['Lesión del mesencéfalo ventral: fascículo del III y pedúnculo cerebral. III ipsilateral con hemiparesia contralateral. Si afecta el núcleo rojo con temblor contralateral, es síndrome de Benedikt.']}
};
function updateClin(){
  const el=$('clin'), f=$('findings');
  if(S.hidden){el.innerHTML='<p>Caso en curso: la interpretación se muestra al terminar el caso.</p>';f.innerHTML='';return;}
  const html=[];
  if(S.syn.k!=='none'){const c=CLIN[S.syn.k];html.push(`<h3>${c.t}${['VI2','IV2'].includes(S.syn.k)?'':' · lado '+sideName(S.syn.side)}${S.syn.sev<100?` · ${S.syn.sev} %`:''}</h3>`+c.p.map(x=>`<p>${x}</p>`).join(''));}
  else for(const s of ['R','L']){const k=S.les[s];if(k==='normal')continue;const c=CLIN[k];
    html.push(`<h3>${c.t} · ojo ${sideName(s)}${S.sev[s]<100&&k!=='manual'?` · paresia ${S.sev[s]} %`:''}</h3>`+c.p.map(x=>`<p>${x}</p>`).join(''));}
  el.innerHTML=html.length?html.join(''):'<p>Ambos ojos sanos. Elige una lesión o un síndrome en el panel de la izquierda.</p>';
  // findings
  const out=[]; const d0=deviation(compute(0,0)); const F=fixEye();
  const e=d0.eso, v=d0.rht;
  out.push(['Primaria',(Math.abs(e)<1&&Math.abs(v)<1)?`Ortotropia en posición primaria (fija ${F==='R'?'OD':'OI'}).`:[Math.abs(e)>=1?`${e>0?'Endotropia':'Exotropia'} de ${Math.round(PD(e))}Δ`:'',Math.abs(v)>=1?`hipertropia ${v>0?'derecha':'izquierda'} de ${Math.round(PD(v))}Δ`:''].filter(Boolean).join(' y ')+` con ${F==='R'?'OD':'OI'} fijando.`,Math.abs(e)>=1||Math.abs(v)>=1]);
  const sick=['R','L'].filter(s=>MUS.some(m=>S.E[s][m]<0.95));
  if(sick.length===1){
    const keep={fix:S.fix,cover:S.cover}; S.cover=''; S.fix=sick[0];
    const d2=deviation(compute(0,0)); S.fix=keep.fix; S.cover=keep.cover;
    const m1=Math.hypot(PD(e),PD(v)), m2=Math.hypot(PD(d2.eso),PD(d2.rht));
    if(m2>m1+2&&sick[0]!==F)out.push(['Hering',`Si fija el ojo parético la desviación sube a unas ${Math.round(m2)}Δ (desviación secundaria mayor que la primaria).`,false]);
  }
  for(const s of ['R','L']){const o=lidOpen(S.E[s]);if(o<0.95)out.push(['Párpado',`${s==='R'?'OD':'OI'}: ptosis ${o<0.2?'completa':o<0.85?'parcial':'leve'}.`,o<0.85]);}
  const pR=pupilMM(S.E.R),pL=pupilMM(S.E.L);
  if(Math.abs(pR-pL)>=0.5){const bigS=pR>pL?'R':'L';const E=S.E[bigS];
    out.push(['Pupila',E.para<0.9?(E.symp<0.9?`Pupila ${bigS==='R'?'derecha':'izquierda'} media y arreactiva: lesión parasimpática y simpática.`:`Midriasis en ${bigS==='R'?'OD':'OI'}: la anisocoria aumenta con la luz.`):`Miosis en ${bigS==='R'?'OI':'OD'}: la anisocoria aumenta en la oscuridad.`,true]);}
  f.innerHTML=out.map(([k,t,hot])=>`<div class="fnd"><span class="pill${hot?' hot':''}">${k}</span><span>${t}</span></div>`).join('');
}

/* ================= CONTROLS ================= */
const MKEYS=['LR','MR','SR','IR','SO','IO','LPS'];
function buildEyeCtl(side){
  const el=$('eyectl-'+side);
  const opts=Object.entries(LES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  el.innerHTML=`<div class="eyehead"><b>${side==='R'?'Ojo derecho':'Ojo izquierdo'}</b><span>${side==='R'?'OD':'OI'}</span></div>
  <select id="les-${side}" aria-label="Lesión del ojo ${sideName(side)}">${opts}</select>
  <div class="row"><label for="sev-${side}">Gravedad</label><input type="range" id="sev-${side}" min="10" max="100" step="5" value="100"><output id="sevO-${side}">100 %</output></div>
  <details class="manual" id="man-${side}"><summary>Fuerza de cada músculo</summary><div class="mgrid">
  ${MKEYS.map(m=>`<label for="m-${side}-${m}"><span class="tag" style="background:var(--${m==='LPS'?'n3':NERVE[m]})"></span>${m==='LPS'?'Elevador':SHORT[m]}</label><input type="range" id="m-${side}-${m}" min="0" max="100" step="5" value="100"><output id="mo-${side}-${m}">100</output>`).join('')}
  <label for="m-${side}-para"><span class="tag" style="background:var(--n3)"></span>Pupila III</label><input type="range" id="m-${side}-para" min="0" max="100" step="5" value="100"><output id="mo-${side}-para">100</output>
  <label for="m-${side}-symp"><span class="tag" style="background:var(--symp)"></span>Simpático</label><input type="range" id="m-${side}-symp" min="0" max="100" step="5" value="100"><output id="mo-${side}-symp">100</output>
  </div></details>`;
  const sel=$('les-'+side);
  sel.addEventListener('change',()=>{S.syn.k='none';$('synSel').value='none';S.les[side]=sel.value;applyAll();syncCtl();changed();});
  const sev=$('sev-'+side);
  sev.addEventListener('input',()=>{S.sev[side]=+sev.value;$('sevO-'+side).textContent=sev.value+' %';applyAll();syncCtl();changed();});
  for(const m of [...MKEYS,'para','symp']){
    const inp=$(`m-${side}-${m}`);
    inp.addEventListener('input',()=>{
      if(S.syn.k!=='none'){S.les.R='manual';S.les.L='manual';S.syn.k='none';}
      S.les[side]='manual';S.E[side][m]=inp.value/100;$(`mo-${side}-${m}`).textContent=inp.value;syncCtl(true);changed();});
  }
}
function syncCtl(skipSliders){
  for(const side of ['R','L']){
    const sel=$('les-'+side); sel.value=S.syn.k!=='none'?'manual':S.les[side];
    sel.disabled=S.syn.k!=='none';
    $('sev-'+side).disabled=(S.syn.k!=='none'||S.les[side]==='normal'||S.les[side]==='manual');
    $('sev-'+side).value=S.sev[side]; $('sevO-'+side).textContent=S.sev[side]+' %';
    if(!skipSliders)for(const m of [...MKEYS,'para','symp']){const v=Math.round(S.E[side][m]*100);$(`m-${side}-${m}`).value=v;$(`mo-${side}-${m}`).textContent=v;}
  }
  $('synSel').value=S.syn.k; $('synSev').value=S.syn.sev; $('synSevO').textContent=S.syn.sev+' %';
  $('synSev').disabled=S.syn.k==='none';
  document.querySelectorAll('#synSide button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.syn.side));
  $('lesionLock').hidden=!S.hidden; $('lesionCtl').hidden=S.hidden;
}
$('synSel').innerHTML=Object.entries(SYN).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
$('synSel').addEventListener('change',e=>{S.syn.k=e.target.value;if(S.syn.k==='none'){S.les.R='normal';S.les.L='normal';}applyAll();syncCtl();changed();});
$('synSev').addEventListener('input',e=>{S.syn.sev=+e.target.value;applyAll();syncCtl();changed();});
$('synSide').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.syn.side=b.dataset.v;applyAll();syncCtl();changed();});

function bindSegs(){
  document.querySelectorAll('.seg[data-bind]').forEach(el=>{
    el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S[el.dataset.bind]=b.dataset.v;syncSegs();changed();});
  });
}
function syncSegs(){
  document.querySelectorAll('.seg[data-bind]').forEach(el=>{const v=S[el.dataset.bind];el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));});
  document.querySelectorAll('#tiltSeg2 button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===S.tilt));
  for(const id of ['btnConv','btnConv2'])$(id).setAttribute('aria-pressed',S.conv);
}
bindSegs();
function setHead(t,y){S.tilt=t;S.yaw=y;$('tilt').value=t;$('yaw').value=y;$('tiltO').textContent=(t>0?'D ':t<0?'I ':'')+Math.abs(t)+'°';$('yawO').textContent=(y>0?'D ':y<0?'I ':'')+Math.abs(y)+'°';syncSegs();changed();}
$('tilt').addEventListener('input',()=>setHead(+$('tilt').value,S.yaw));
$('yaw').addEventListener('input',()=>setHead(S.tilt,+$('yaw').value));
$('btnHeadReset').onclick=()=>setHead(0,0);
$('btnComp').onclick=()=>{
  let t=0,y=0; const eyeHas=(s,m)=>S.E[s][m]<0.6;
  for(const s of ['R','L']){const sg=s==='R'?1:-1; if(eyeHas(s,'LR'))y+=sg*20; if(eyeHas(s,'SO'))t-=sg*20;}
  setHead(Math.max(-35,Math.min(35,t)),Math.max(-30,Math.min(30,y))); stopAnim(); S.gaze={x:0,y:0};
};
$('tiltSeg2').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setHead(+b.dataset.v,S.yaw);});
$('lift').addEventListener('change',e=>{S.lift=e.target.checked;markDirty();});
function toggleConv(){S.conv=!S.conv;if(S.conv){stopAnim();S.gaze={x:0,y:0};}syncSegs();changed();}
$('btnConv').onclick=toggleConv; $('btnConv2').onclick=toggleConv;
$('btnCenter').onclick=()=>setGaze(0,0);
function setGaze(x,y){stopAnim();S.gaze={x,y};dirty=true;syncPads();}

/* gaze pads (3x3) */
const PADS=[['gazepad2'],['gazepad3d']];
function buildPad(id){
  const el=$(id); const lab=['↖','↑','↗','←','•','→','↙','↓','↘'];
  el.innerHTML=NINE.map((g,i)=>`<button data-i="${i}" aria-label="Mirar ${fmtGaze(g[0],g[1])}">${lab[i]}</button>`).join('');
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const [x,y]=NINE[+b.dataset.i];setGaze(x,y);});
}
function syncPads(){for(const [id] of PADS){$(id).querySelectorAll('button').forEach(b=>{const [x,y]=NINE[+b.dataset.i];b.classList.toggle('on',Math.abs(S.gaze.x-x)<1&&Math.abs(S.gaze.y-y)<1);});}}
PADS.forEach(([id])=>buildPad(id));

/* drag on faces */
const faceStores={face:{},face2:{}};
for(const id of ['face','face2']){
  const cv=$(id); let drag=false;
  const upd=e=>{const r=cv.getBoundingClientRect(),st=faceStores[id];S.gaze={x:Math.max(-40,Math.min(40,-(e.clientX-r.left-st.cx)/st.k)),y:Math.max(-32,Math.min(32,-(e.clientY-r.top-st.cy)/st.k))};dirty=true;syncPads();};
  cv.addEventListener('pointerdown',e=>{drag=true;stopAnim();cv.setPointerCapture(e.pointerId);upd(e);});
  cv.addEventListener('pointermove',e=>{if(drag)upd(e);});
  cv.addEventListener('pointerup',()=>drag=false); cv.addEventListener('pointercancel',()=>drag=false);
}
$('nine').addEventListener('click',e=>{const cv=$('nine');const r=cv.getBoundingClientRect();const col=Math.min(2,Math.floor((e.clientX-r.left)/(r.width/3))),row=Math.min(2,Math.floor((e.clientY-r.top)/(r.height/3)));const [x,y]=NINE[row*3+col];setGaze(x,y);});

/* H pattern */
let anim=null;
const HPATH=[[0,0],[30,0],[30,25],[30,-25],[30,0],[0,0],[-30,0],[-30,25],[-30,-25],[-30,0],[0,0]];
const HBTNS=['btnH','btnH2','btnH3d'];
function stopAnim(){anim=null;HBTNS.forEach(id=>$(id).textContent='Seguimiento en H');}
function startH(){if(anim){stopAnim();return;}S.conv=false;syncSegs();anim={t0:performance.now(),seg:950};HBTNS.forEach(id=>$(id).textContent='Detener');}
HBTNS.forEach(id=>$(id).onclick=startH);
function stepAnim(now){
  if(!anim)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el=(now-anim.t0)/(reduce?anim.seg*1.6:anim.seg); const i=Math.floor(el);
  if(i>=HPATH.length-1){S.gaze={x:0,y:0};stopAnim();markDirty();return;}
  const u=el-i, e=u<0.5?2*u*u:1-Math.pow(-2*u+2,2)/2; const a=HPATH[i],b=HPATH[i+1];
  S.gaze={x:a[0]+(b[0]-a[0])*e,y:a[1]+(b[1]-a[1])*e}; dirty=true;
}

/* ================= TABS ================= */
const TABHASH={sim:'simulador',anat:'anatomia',dx:'diagnostico'};
function showTab(t){
  for(const k of Object.keys(TABHASH)){$('view-'+k).hidden=k!==t;$('tab-'+k).setAttribute('aria-selected',k===t);}
  S.tab=t; try{localStorage.setItem('oculo-tab',t);}catch(e){}
  try{history.replaceState(null,'','#'+TABHASH[t]);}catch(e){}
  nineCache=null; markDirty();
  const cc=$('camCard'); if(t==='anat')$('anatCamSlot').appendChild(cc); else if(t==='sim')$('simCamSlot').appendChild(cc); if(typeof Cam!=='undefined'&&Cam.on){const v=$('camVideo');if(v.paused)v.play().catch(()=>{});}
  if(t==='dx')renderDx();
  if(EOM.onTab)EOM.onTab(t);
}
document.querySelectorAll('nav.tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('goAnat').onclick=()=>showTab('anat');
$('btnGoSim').onclick=()=>showTab('sim');

/* status chips */
function updateStatus(){
  const st=$('status'); const les=describeLesion();
  const chips=[];
  if(dxState.running)chips.push(`<span class="fld"><span>Caso</span><b>${esc(dxState.case.titulo)}</b></span>`);
  else chips.push(`<span class="fld${les==='Sin lesión'?'':' bad'}"><span>Lesión</span><b>${esc(les)}</b></span>`);
  chips.push(`<span class="fld"><span>Fija</span><b>${fixEye()==='R'?'OD':'OI'}${S.cover?' · tapado '+(S.cover==='R'?'OD':'OI'):''}</b></span>`);
  st.innerHTML=chips.join('');
  const al=$('anatLesion'); if(al)al.textContent=S.hidden?'Caso en curso: la lesión no se marca en la anatomía hasta terminarlo.':`Lesión actual: ${les}. Las estructuras afectadas se marcan en rojo y los músculos paralizados se ven grises.`;
}

/* ================= LOOP ================= */
let dirty=true, nineNeeds=true, cur=null, curDv=null, disp={R:[0,0,0],L:[0,0,0]};
function markDirty(){dirty=true;nineNeeds=true;}
function changed(){nineCache=null;dirty=true;updateClin();updateStatus();}
function nystagmus(now,r){
  const out={R:[0,0,0],L:[0,0,0]};
  for(const s of ['R','L']){const E=S.E[s]; if(E.ino<0.3)continue; const o=other(s);
    if(S.E[o].ino>0.3&&S.E[o].LR<0.5)continue;
    if(r.T[o][0]>12&&convDeg()<3){const ph=(now/1000*2.6)%1; const amp=3.5*E.ino*Math.min(1,(r.T[o][0]-12)/15);
      out[o][0]=ph<0.8?-amp*(ph/0.8):-amp*(1-(ph-0.8)/0.2);}}
  return out;
}
function frame(now){
  stepAnim(now);
  if(dirty){
    cur=compute(S.gaze.x,S.gaze.y); curDv=deviation(cur);
    if(S.tab==='sim'){updateReadouts(curDv);drawPatient($('patient'),curDv);$('dipNote').innerHTML=diplopiaText(curDv);}
    if(S.tab==='dx'){drawPatient($('patient2'),curDv);examLine(curDv);}
    dirty=false;
  }
  if(S.tab==='sim'&&(nineNeeds||!nineCache)){drawNine($('nine'));nineNeeds=false;}
  const ny=nystagmus(now,cur);
  for(const s of ['R','L'])for(let i=0;i<3;i++){const tgt=cur[s].p[i]+ny[s][i];disp[s][i]+=(tgt-disp[s][i])*0.35;}
  if(S.tab==='sim')drawFace($('face'),disp,faceStores.face);
  if(S.tab==='dx')drawFace($('face2'),disp,faceStores.face2,{compact:true});
  EOM.cur=cur; updateDragDot();
  requestAnimationFrame(frame);
}

/* ================= DIAGNOSIS ================= */
const dxState={mode:'case',running:false,case:null,qi:0,ans:[],picked:null,parks:[null,null,null],path:['root']};
const Store={mode:'local',items:[],db:null,readonly:false,msg:''};
function loadLocal(){try{Store.items=JSON.parse(localStorage.getItem('oculo-casos')||'[]');}catch(e){Store.items=[];}}
function saveLocal(){try{localStorage.setItem('oculo-casos',JSON.stringify(Store.items));}catch(e){}}
function cleanCase(c){
  const q=(c.preguntas||[]).filter(x=>x&&x.q&&Array.isArray(x.opts)&&x.opts.length>=2).slice(0,30).map(x=>({q:String(x.q).slice(0,600),opts:x.opts.slice(0,6).map(o=>String(o).slice(0,300)),c:Math.max(0,Math.min(x.opts.length-1,+x.c||0)),fb:String(x.fb||'').slice(0,1200)}));
  const L=c.lesion||{}; const okL=k=>LES[k]&&k!=='manual'?k:'normal';
  const syn=c.syn&&SYN[c.syn.k]?{k:c.syn.k,side:c.syn.side==='L'?'L':'R',sev:Math.max(10,Math.min(100,+c.syn.sev||100))}:null;
  return {titulo:String(c.titulo||'Caso sin título').slice(0,120),vineta:String(c.vineta||'').slice(0,2000),dx:String(c.dx||'').slice(0,400),extiende:String(c.extiende||''),lesion:{R:okL(L.R),L:okL(L.L)},syn:syn&&syn.k!=='none'?syn:null,preguntas:q,creado:+c.creado||Date.now()};
}
async function initStore(){
  loadLocal();
  for(let i=0;i<40&&!(window.claude&&window.claude.use);i++)await new Promise(r=>setTimeout(r,100));
  try{
    if(!(window.claude&&window.claude.use))return;
    const db=await window.claude.use('db'); if(!db)return;
    Store.db=db; Store.mode='db';
    db.collection('casos').onSnapshot(snap=>{Store.items=snap.docs.map(d=>({...d.data(),_id:d.id}));if(S.tab==='dx')renderDx();},
      err=>{Store.db=null;Store.mode='local';loadLocal();if(S.tab==='dx')renderDx();});
  }catch(e){}
}
async function storeSave(item){
  const c=cleanCase(item);
  if(Store.db&&!Store.readonly){
    const id=item._id||('c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    try{await Store.db.collection('casos').doc(id).set(c);return true;}
    catch(e){if(e&&e.code==='invalid_argument'){Store.readonly=true;Store.msg='No tienes permiso para guardar en el banco compartido; se guardó solo en este navegador.';}else{Store.msg='No se pudo guardar en el banco compartido; se guardó en este navegador.';}}
  }
  const id=item._id||('l'+Date.now().toString(36));
  const i=Store.items.findIndex(x=>x._id===id); const rec={...c,_id:id,_local:true};
  if(i>=0)Store.items[i]=rec; else Store.items.push(rec); saveLocal(); return true;
}
async function storeDelete(id){
  const it=Store.items.find(x=>x._id===id);
  if(Store.db&&it&&!it._local){try{await Store.db.collection('casos').doc(id).delete();return;}catch(e){Store.msg='No se pudo eliminar del banco compartido.';}}
  Store.items=Store.items.filter(x=>x._id!==id); saveLocal();
}
function allCases(){
  const custom=Store.items.filter(x=>!x.extiende).map(x=>({...x,id:'u:'+x._id,custom:true}));
  return [...CASES,...custom];
}
function caseQuestions(cs){
  const extra=Store.items.filter(x=>x.extiende===cs.id).flatMap(x=>x.preguntas||[]);
  return [...(cs.preguntas||[]),...extra];
}
$('dxTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;dxState.mode=b.dataset.v;document.querySelectorAll('#dxTabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderDx();});

function loadLesion(spec){
  S.syn={k:'none',side:'R',sev:100}; S.les={R:'normal',L:'normal'}; S.sev={R:100,L:100};
  if(spec.syn)S.syn={...spec.syn};
  if(spec.les||spec.lesion){const L=spec.les||spec.lesion;S.les.R=L.R||'normal';S.les.L=L.L||'normal';}
  applyAll();
  const affected=['R','L'].filter(s=>MUS.some(m=>S.E[s][m]<0.95)||S.E[s].LPS<0.95||S.E[s].para<0.95||S.E[s].symp<0.95);
  S.fix=affected.length===1?other(affected[0]):'L'; S.cover=''; S.conv=false; S.gaze={x:0,y:0}; stopAnim();
  setHead(0,0); syncCtl(); syncSegs(); syncPads(); changed();
}
function startCase(cs){
  dxState.running=true; dxState.case=cs; dxState.qs=caseQuestions(cs); dxState.qi=0; dxState.ans=[]; dxState.picked=null;
  S.hidden=true; loadLesion({lesion:cs.lesion,syn:cs.syn}); dxState.mode='case';
  document.querySelectorAll('#dxTabs button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v==='case'));
  renderDx(); updateStatus();
}
function endCase(reveal){
  dxState.running=false; S.hidden=false; syncCtl(); changed(); updateStatus(); if(!reveal)renderDx();
}
function renderDx(){
  const m=$('dxMain');
  if(dxState.mode==='case')return renderCase(m);
  if(dxState.mode==='parks')return renderParks(m);
  if(dxState.mode==='tree')return renderTree(m);
  if(dxState.mode==='edit')return renderEditor(m);
}
function renderCase(m){
  if(!dxState.running&&!dxState.done){
    const list=allCases();
    m.innerHTML=`<div class="h2">Casos clínicos</div>
    <p style="font-family:var(--f-text);font-size:17px;margin:0 0 14px;max-width:62ch">La lesión queda oculta. Lee la viñeta, explora al paciente en el panel de la derecha (mirada, inclinación, oclusor, fijación) y responde paso a paso hasta el diagnóstico topográfico.</p>
    <div class="btnrow" style="margin-bottom:16px"><button class="btn primary" id="caseRandom">Caso aleatorio</button></div>
    <div class="edlist">${list.map((c,i)=>`<div class="eitem"><div><b>${esc(c.titulo)}</b><small>${caseQuestions(c).length} preguntas${c.custom?' · creado por ti':''}</small></div><button class="btn sm" data-i="${i}">Iniciar</button></div>`).join('')}</div>`;
    $('caseRandom').onclick=()=>startCase(list[Math.floor(Math.random()*list.length)]);
    m.querySelectorAll('.eitem button').forEach(b=>b.onclick=()=>startCase(list[+b.dataset.i]));
    return;
  }
  if(dxState.done&&!dxState.running){
    const cs=dxState.case, ok=dxState.ans.filter(Boolean).length, n=dxState.qs.length;
    m.innerHTML=`<div class="h2">Resultado</div>
    <div class="result"><div class="score">${ok}/${n}</div><div><b style="font-size:16px">${esc(cs.titulo)}</b><div style="font-family:var(--f-text);font-size:16px;margin-top:4px">Diagnóstico: ${esc(cs.dx||describeLesion())}</div><div class="note">Lesión cargada en el simulador: ${esc(describeLesion())}</div></div></div>
    <div class="btnrow" style="margin-top:14px"><button class="btn primary" id="rSim">Ver en el simulador</button><button class="btn" id="rAnat">Ver en anatomía 3D</button><button class="btn" id="rAgain">Otro caso</button></div>`;
    $('rSim').onclick=()=>showTab('sim'); $('rAnat').onclick=()=>showTab('anat'); $('rAgain').onclick=()=>{dxState.done=false;renderDx();};
    return;
  }
  const cs=dxState.case, qs=dxState.qs, qi=dxState.qi, q=qs[qi];
  const prog=qs.map((_,i)=>`<span class="${i<dxState.ans.length?(dxState.ans[i]?'ok':'no'):(i===qi?'cur':'')}"></span>`).join('');
  const letters='ABCDEF';
  let optsHtml='';
  if(q){optsHtml=q.opts.map((o,i)=>{let cls='opt';if(dxState.picked!=null){if(i===q.c)cls+=' right';else if(i===dxState.picked)cls+=' wrong';}
    return `<button class="${cls}" data-i="${i}" ${dxState.picked!=null?'disabled':''}><b>${letters[i]}</b><span>${esc(o)}</span></button>`;}).join('');}
  const explore=q&&(q.gaze||q.tilt!=null||q.conv)?`<button class="btn sm hintbtn" id="qExplore">Explorar: ${q.gaze?'mirar '+fmtGaze(q.gaze[0],q.gaze[1]):''}${q.tilt!=null?(q.gaze?' · ':'')+'inclinar la cabeza a la '+(q.tilt>0?'derecha':'izquierda'):''}${q.conv?'pedir convergencia':''}</button>`:'';
  m.innerHTML=`<div class="h2"><span>Caso · ${esc(cs.titulo)}</span><button class="btn sm ghost" id="caseQuit">Abandonar</button></div>
    <div class="vignette">${esc(cs.vineta)}</div>
    <div class="progress">${prog}</div>
    ${q?`<div class="note">Pregunta ${qi+1} de ${qs.length}</div><div class="q">${esc(q.q)}</div><div class="opts">${optsHtml}</div>${explore}
    ${dxState.picked!=null?`<div class="fb ${dxState.picked===q.c?'ok':'no'}"><b>${dxState.picked===q.c?'Correcto.':'Incorrecto.'}</b> ${esc(q.fb)}</div><div class="btnrow" style="margin-top:12px"><button class="btn primary" id="qNext">${qi+1<qs.length?'Siguiente':'Ver diagnóstico'}</button></div>`:''}`:'<p>Este caso no tiene preguntas.</p><button class="btn primary" id="qNext">Ver diagnóstico</button>'}`;
  $('caseQuit').onclick=()=>{dxState.done=false;endCase(false);};
  m.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{dxState.picked=+b.dataset.i;dxState.ans.push(dxState.picked===q.c);renderDx();});
  const ex=$('qExplore'); if(ex)ex.onclick=()=>{if(q.gaze)setGaze(q.gaze[0],q.gaze[1]);if(q.tilt!=null)setHead(q.tilt,S.yaw);if(q.conv&&!S.conv)toggleConv();};
  const nx=$('qNext'); if(nx)nx.onclick=()=>{dxState.picked=null;if(qi+1<qs.length){dxState.qi++;renderDx();}else{dxState.done=true;endCase(true);renderDx();}};
}

/* Parks three-step */
const PARKS_M=[['R','SR'],['R','IR'],['R','SO'],['R','IO'],['L','SR'],['L','IR'],['L','SO'],['L','IO']];
const MNAME={SR:'Recto superior',IR:'Recto inferior',SO:'Oblicuo superior',IO:'Oblicuo inferior'};
function parksSets(){
  const [s1,s2,s3]=dxState.parks; let set=PARKS_M.map(x=>x.join('-'));
  const keep=a=>{set=set.filter(x=>a.includes(x));};
  if(s1==='R')keep(['R-IR','R-SO','L-SR','L-IO']); if(s1==='L')keep(['L-IR','L-SO','R-SR','R-IO']);
  if(s2==='R')keep(['R-SR','R-IR','L-SO','L-IO']); if(s2==='L')keep(['L-SR','L-IR','R-SO','R-IO']);
  if(s3==='R')keep(['R-SR','R-SO','L-IR','L-IO']); if(s3==='L')keep(['L-SR','L-SO','R-IR','R-IO']);
  return set;
}
function renderParks(m){
  const P=dxState.parks, set=parksSets();
  const chips=PARKS_M.map(([s,mu])=>{const id=s+'-'+mu;const inn=set.includes(id);return `<div class="mchip${inn?'':' out'}${inn&&set.length===1?' win':''}">${s==='R'?'OD':'OI'} · ${SHORT[mu]}<small>${MNAME[mu]}</small></div>`;}).join('');
  const step=(n,title,help,opts,val)=>`<div class="step"><h4><span class="n">${n}</span>${title}</h4><div class="note" style="margin-bottom:8px">${help}</div><div class="btnrow">${opts.map(([v,t])=>`<button class="btn sm" data-step="${n}" data-v="${v}" aria-pressed="${val===v}" ${n>1&&!P[n-2]?'disabled':''}>${t}</button>`).join('')}</div></div>`;
  let result='';
  if(set.length===1&&P[2]){const [s,mu]=set[0].split('-');const nerve=mu==='SO'?'IV par (troclear)':'III par';
    result=`<div class="leaf" style="margin-top:14px"><h3>${MNAME[mu]} ${sideName(s)}</h3><p>Músculo parético: ${MNAME[mu].toLowerCase()} del ojo ${sideName(s)}, inervado por el ${nerve}. ${mu==='SO'?'Es el resultado más frecuente: la parálisis del IV es la causa principal de diplopía vertical aislada.':'Una paresia aislada de un músculo del III es rara: busca afección de otros músculos del III, miastenia o una causa restrictiva.'}</p><button class="btn primary" id="parksLoad">Cargar en el simulador</button></div>`;}
  m.innerHTML=`<div class="h2">Tres pasos de Parks-Bielschowsky</div>
  <p style="font-family:var(--f-text);font-size:16.5px;margin:0 0 6px;max-width:64ch">Para una hipertropia por parálisis de un solo músculo cicloverical. Cada paso descarta la mitad de los candidatos. Mide en el panel de la derecha: la lectura muestra HTD o HTI en dioptrías prismáticas.</p>
  <div class="parks">${chips}</div>
  <div class="stepper">
   ${step(1,'¿Qué ojo está más alto en posición primaria?','Tapa y destapa, o mira el reflejo corneal: el ojo alto tiene el reflejo por debajo del centro de la pupila.',[['R','Hipertropia derecha'],['L','Hipertropia izquierda']],P[0])}
   ${step(2,'¿Hacia qué lado aumenta la hipertropia?','Mira a la derecha y a la izquierda (flechas del panel) y compara la lectura.',[['R','Mirada a la derecha'],['L','Mirada a la izquierda']],P[1])}
   ${step(3,'¿Con qué inclinación de la cabeza aumenta?','Inclina la cabeza a cada hombro: la contrarrotación ocular exige intorsión del ojo del lado inclinado.',[['R','Inclinación a la derecha'],['L','Inclinación a la izquierda']],P[2])}
  </div>${result}
  <div class="btnrow" style="margin-top:14px"><button class="btn ghost" id="parksReset">Reiniciar</button></div>`;
  m.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const n=+b.dataset.step;dxState.parks[n-1]=b.dataset.v;for(let i=n;i<3;i++)dxState.parks[i]=null;
    if(n===2)setGaze(b.dataset.v==='R'?25:-25,0); if(n===3)setHead(b.dataset.v==='R'?25:-25,0); renderDx();});
  $('parksReset').onclick=()=>{dxState.parks=[null,null,null];setHead(0,0);setGaze(0,0);renderDx();};
  const pl=$('parksLoad'); if(pl)pl.onclick=()=>{const [s,mu]=set[0].split('-');
    if(dxState.running)endCase(false);
    if(mu==='SO')loadLesion({les:{[s]:'IV'}});
    else{loadLesion({});S.les[s]='manual';S.E[s][mu]=0;S.fix=other(s);syncCtl();changed();}
    showTab('sim');};
}

/* diplopia tree */
function renderTree(m){
  const path=dxState.path, node=TREE[path[path.length-1]];
  const crumbs=path.slice(0,-1).map(id=>`<span>${esc(TREE[id].q?TREE[id].q.replace(/^¿|\?$/g,'').slice(0,34)+'…':'')}</span>`).join('');
  let body='';
  if(node.q){body=`<div class="q">${esc(node.q)}</div><div class="opts">${node.opts.map(([t,next],i)=>`<button class="opt" data-next="${next}"><b>${'ABCD'[i]}</b><span>${esc(t)}</span></button>`).join('')}</div>`;}
  else{body=`<div class="leaf"><h3>${esc(node.dx)}</h3><p>${esc(node.text)}</p><div class="btnrow">${node.load?'<button class="btn primary" id="treeLoad">Cargar un ejemplo en el simulador</button>':''}${node.go?'<button class="btn" id="treeGo">Ir a los tres pasos</button>':''}</div></div>`;}
  m.innerHTML=`<div class="h2">Algoritmo de diplopía</div>
  ${path.length>1?`<div class="crumbs">${crumbs}</div>`:'<p style="font-family:var(--f-text);font-size:16.5px;margin:0 0 12px;max-width:64ch">Responde con lo que encuentras en la historia y la exploración. Cada hoja del árbol explica el diagnóstico y puede cargar un ejemplo en el simulador.</p>'}
  ${body}
  <div class="btnrow" style="margin-top:14px">${path.length>1?'<button class="btn" id="treeBack">← Atrás</button><button class="btn ghost" id="treeReset">Reiniciar</button>':''}</div>`;
  m.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{dxState.path.push(b.dataset.next);renderDx();});
  const bk=$('treeBack'); if(bk)bk.onclick=()=>{dxState.path.pop();renderDx();};
  const rs=$('treeReset'); if(rs)rs.onclick=()=>{dxState.path=['root'];renderDx();};
  const ld=$('treeLoad'); if(ld)ld.onclick=()=>{if(dxState.running)endCase(false);loadLesion(node.load);showTab('sim');};
  const go=$('treeGo'); if(go)go.onclick=()=>{dxState.mode='parks';document.querySelectorAll('#dxTabs button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v==='parks'));renderDx();};
}

/* editor */
let edit=null, delArm=null;
function blankQ(){return {q:'',opts:['','','',''],c:0,fb:''};}
function renderEditor(m){
  if(edit)return renderForm(m);
  const items=Store.items;
  const storeTxt=Store.mode==='db'?(Store.readonly?'Banco compartido (solo lectura para ti)':'Guardado en el banco del artifact: lo ves en cualquier dispositivo'):'Guardado solo en este navegador';
  m.innerHTML=`<div class="h2"><span>Mis preguntas y casos</span><span class="chip storechip"><i style="background:${Store.mode==='db'?'var(--good)':'var(--n4)'}"></i>${storeTxt}</span></div>
  <p style="font-family:var(--f-text);font-size:16.5px;margin:0 0 12px;max-width:64ch">Crea un caso nuevo con su viñeta, la lesión oculta y tus preguntas, o agrega preguntas a uno de los casos incluidos. Aparecen en «Caso clínico».</p>
  ${Store.msg?`<div class="fb no" style="margin-bottom:12px">${esc(Store.msg)}</div>`:''}
  <div class="btnrow" style="margin-bottom:14px"><button class="btn primary" id="edNew">Nuevo caso</button><button class="btn" id="edAdd">Agregar preguntas a un caso incluido</button></div>
  <div class="edlist">${items.length?items.map(it=>`<div class="eitem"><div><b>${esc(it.titulo)}</b><small>${(it.preguntas||[]).length} preguntas${it.extiende?' · agregadas a «'+esc((CASES.find(c=>c.id===it.extiende)||{}).titulo||it.extiende)+'»':''}${it._local?' · solo en este navegador':''}</small></div><div class="btnrow"><button class="btn sm" data-a="try" data-id="${esc(it._id)}">Probar</button><button class="btn sm" data-a="edit" data-id="${esc(it._id)}">Editar</button><button class="btn sm danger" data-a="del" data-id="${esc(it._id)}">${delArm===it._id?'¿Eliminar?':'Eliminar'}</button></div></div>`).join(''):'<div class="note">Todavía no tienes casos propios.</div>'}</div>
  <details style="margin-top:18px"><summary class="lbl" style="cursor:pointer">Exportar o importar (JSON)</summary>
   <div class="form" style="margin-top:10px"><textarea id="edJson" rows="6" placeholder="Pega aquí un JSON exportado para importarlo"></textarea>
   <div class="btnrow"><button class="btn sm" id="edExport">Exportar mis casos</button><button class="btn sm" id="edCopy">Copiar</button><button class="btn sm" id="edImport">Importar</button><span class="note" id="edJsonMsg"></span></div></div></details>`;
  $('edNew').onclick=()=>{edit={titulo:'',vineta:'',dx:'',extiende:'',lesion:{R:'normal',L:'normal'},syn:null,preguntas:[blankQ()]};renderDx();};
  $('edAdd').onclick=()=>{edit={titulo:'Preguntas extra',vineta:'',dx:'',extiende:CASES[0].id,lesion:{R:'normal',L:'normal'},syn:null,preguntas:[blankQ()]};renderDx();};
  m.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
    const it=Store.items.find(x=>x._id===b.dataset.id); if(!it)return;
    if(b.dataset.a==='edit'){edit=JSON.parse(JSON.stringify(it));renderDx();}
    if(b.dataset.a==='del'){if(delArm===it._id){delArm=null;await storeDelete(it._id);renderDx();}else{delArm=it._id;renderDx();setTimeout(()=>{if(delArm===it._id){delArm=null;if(dxState.mode==='edit'&&!edit)renderDx();}},3500);}}
    if(b.dataset.a==='try'){const base=it.extiende?CASES.find(c=>c.id===it.extiende):null;startCase(base||{...it,id:'u:'+it._id});}
  });
  $('edExport').onclick=()=>{$('edJson').value=JSON.stringify({casos:Store.items.map(({_id,_local,...r})=>r)},null,1);$('edJsonMsg').textContent='Listo: copia el texto.';};
  $('edCopy').onclick=()=>{const t=$('edJson');const v=t.value;if(!v)return;
    const fallback=()=>{t.focus();t.select();$('edJsonMsg').textContent='Texto seleccionado: cópialo con el menú.';};
    try{navigator.clipboard.writeText(v).then(()=>{$('edJsonMsg').textContent='Copiado.';},fallback);}catch(e){fallback();}};
  $('edImport').onclick=async()=>{let data;try{data=JSON.parse($('edJson').value);}catch(e){$('edJsonMsg').textContent='El texto no es un JSON válido.';return;}
    const arr=Array.isArray(data)?data:(data&&Array.isArray(data.casos)?data.casos:[]);
    if(!arr.length){$('edJsonMsg').textContent='No encontré casos en el JSON.';return;}
    for(const c of arr.slice(0,100))await storeSave(c); $('edJsonMsg').textContent=`Importados: ${Math.min(arr.length,100)}.`; if(Store.mode!=='db')renderDx();};
}
function renderForm(m){
  const e=edit; const lesOpts=sel=>Object.entries(LES).filter(([k])=>k!=='manual').map(([k,v])=>`<option value="${k}" ${sel===k?'selected':''}>${v.label}</option>`).join('');
  const synK=e.syn?e.syn.k:'none';
  m.innerHTML=`<div class="h2"><span>${e._id?'Editar':'Nuevo'}</span></div>
  <div class="form">
   <div><label class="lbl" for="fExt">Tipo</label><select id="fExt"><option value="">Caso nuevo independiente</option>${CASES.map(c=>`<option value="${c.id}" ${e.extiende===c.id?'selected':''}>Agregar preguntas a «${esc(c.titulo)}»</option>`).join('')}</select></div>
   <div><label class="lbl" for="fTit">Título</label><input type="text" id="fTit" value="${esc(e.titulo)}" maxlength="120"></div>
   <div class="caseonly"><label class="lbl" for="fVin">Viñeta clínica</label><textarea id="fVin" rows="4" maxlength="2000">${esc(e.vineta)}</textarea></div>
   <div class="caseonly"><label class="lbl" for="fDx">Diagnóstico (se muestra al final)</label><input type="text" id="fDx" value="${esc(e.dx)}" maxlength="400"></div>
   <div class="caseonly two">
     <div><label class="lbl" for="fR">Lesión oculta · OD</label><select id="fR">${lesOpts(e.lesion.R)}</select></div>
     <div><label class="lbl" for="fL">Lesión oculta · OI</label><select id="fL">${lesOpts(e.lesion.L)}</select></div>
     <div><label class="lbl" for="fSyn">o síndrome</label><select id="fSyn">${Object.entries(SYN).map(([k,v])=>`<option value="${k}" ${synK===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
     <div><label class="lbl" for="fSide">Lado del síndrome</label><select id="fSide"><option value="R" ${e.syn&&e.syn.side==='L'?'':'selected'}>Derecho</option><option value="L" ${e.syn&&e.syn.side==='L'?'selected':''}>Izquierdo</option></select></div>
   </div>
   <div class="caseonly"><button class="btn sm" id="fTake" type="button">Usar la lesión actual del simulador</button></div>
   <div id="fQs" class="form"></div>
   <div class="btnrow"><button class="btn sm" id="fAddQ" type="button">+ Pregunta</button></div>
   <div class="btnrow"><button class="btn primary" id="fSave" type="button">Guardar</button><button class="btn ghost" id="fCancel" type="button">Cancelar</button><span class="note" id="fMsg"></span></div>
  </div>`;
  const syncType=()=>m.querySelectorAll('.caseonly').forEach(x=>x.hidden=!!$('fExt').value);
  $('fExt').onchange=()=>{readForm();syncType();}; syncType();
  const renderQs=()=>{
    $('fQs').innerHTML=e.preguntas.map((q,qi)=>`<div class="qblock" data-q="${qi}">
      <div class="row" style="justify-content:space-between"><b style="font-size:13px">Pregunta ${qi+1}</b><button class="btn sm danger" data-rmq="${qi}" type="button">Quitar</button></div>
      <textarea data-f="q" rows="2" placeholder="Texto de la pregunta">${esc(q.q)}</textarea>
      ${q.opts.map((o,oi)=>`<div class="optrow"><input type="radio" name="c${qi}" value="${oi}" ${q.c===oi?'checked':''} aria-label="Marcar opción ${'ABCDEF'[oi]} como correcta"><input type="text" data-o="${oi}" value="${esc(o)}" placeholder="Opción ${'ABCDEF'[oi]}"><button class="btn sm ghost" data-rmo="${oi}" type="button" ${q.opts.length<=2?'disabled':''} aria-label="Quitar opción">×</button></div>`).join('')}
      <div class="btnrow"><button class="btn sm" data-addo="${qi}" type="button" ${q.opts.length>=6?'disabled':''}>+ Opción</button><span class="note">Marca con el círculo la respuesta correcta.</span></div>
      <textarea data-f="fb" rows="2" placeholder="Retroalimentación (por qué es correcta)">${esc(q.fb)}</textarea></div>`).join('');
    $('fQs').querySelectorAll('[data-rmq]').forEach(b=>b.onclick=()=>{readForm();e.preguntas.splice(+b.dataset.rmq,1);if(!e.preguntas.length)e.preguntas.push(blankQ());renderQs();});
    $('fQs').querySelectorAll('[data-addo]').forEach(b=>b.onclick=()=>{readForm();e.preguntas[+b.dataset.addo].opts.push('');renderQs();});
    $('fQs').querySelectorAll('[data-rmo]').forEach(b=>b.onclick=()=>{readForm();const qi=+b.closest('.qblock').dataset.q;const q=e.preguntas[qi];q.opts.splice(+b.dataset.rmo,1);q.c=Math.min(q.c,q.opts.length-1);renderQs();});
  };
  function readForm(){
    e.extiende=$('fExt').value; e.titulo=$('fTit').value; e.vineta=$('fVin').value; e.dx=$('fDx').value;
    e.lesion={R:$('fR').value,L:$('fL').value}; const sk=$('fSyn').value; e.syn=sk==='none'?null:{k:sk,side:$('fSide').value,sev:100};
    $('fQs').querySelectorAll('.qblock').forEach(b=>{const q=e.preguntas[+b.dataset.q];q.q=b.querySelector('[data-f="q"]').value;q.fb=b.querySelector('[data-f="fb"]').value;
      q.opts=[...b.querySelectorAll('[data-o]')].map(x=>x.value);const r=b.querySelector('input[type=radio]:checked');q.c=r?+r.value:0;});
  }
  renderQs();
  $('fAddQ').onclick=()=>{readForm();e.preguntas.push(blankQ());renderQs();};
  $('fTake').onclick=()=>{readForm();if(S.syn.k!=='none'){e.syn={...S.syn};e.lesion={R:'normal',L:'normal'};}else{e.syn=null;e.lesion={R:S.les.R==='manual'?'normal':S.les.R,L:S.les.L==='manual'?'normal':S.les.L};}renderForm(m);};
  $('fCancel').onclick=()=>{edit=null;renderDx();};
  $('fSave').onclick=async()=>{readForm();
    const qs=e.preguntas.map(q=>({...q,opts:q.opts.map(o=>o.trim()).filter(Boolean)})).filter(q=>q.q.trim()&&q.opts.length>=2);
    if(!e.extiende&&!e.vineta.trim()){$('fMsg').textContent='Escribe la viñeta del caso.';return;}
    if(!qs.length){$('fMsg').textContent='Agrega al menos una pregunta con dos opciones.';return;}
    await storeSave({...e,preguntas:qs}); edit=null; renderDx();};
}


/* ================= CÁMARA Y ROBOT ================= */
const Cam={on:false,stream:null,mode:'hand',lm:null,loading:false,sm:null,lastSeen:0,small:null};
const CAM_BLOCKED='No se pudo abrir la cámara. Si abriste la app dentro de Claude o dentro de Moodle, ábrela directamente en su propia pestaña (tu dirección https). Mientras tanto puedes arrastrar la linterna.';
function camMsg(t){$('camStatus').textContent=t;}
async function loadHand(){
  if(Cam.lm||Cam.loading)return; Cam.loading=true; camMsg('Cargando el detector de manos…');
  try{
    const mp=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs');
    const fs=await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    const opts=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:d},runningMode:'VIDEO',numHands:1});
    try{Cam.lm=await mp.HandLandmarker.createFromOptions(fs,opts('GPU'));}catch(e){Cam.lm=await mp.HandLandmarker.createFromOptions(fs,opts('CPU'));}
    camMsg('Listo: mueve tu dedo índice frente a la cámara. Acércalo para ver la convergencia.');
  }catch(e){Cam.mode='color';$('camMode').value='color';camMsg('No se pudo cargar el detector de manos (requiere internet). Cambié al modo «Dedal rojo»: ponte algo rojo en la punta del dedo.');}
  Cam.loading=false;
}
async function camStart(){
  if(!window.isSecureContext){camMsg('La cámara solo funciona en páginas https. Abre la dirección que empieza con https://.');camHelp('http');return;}
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){camMsg(CAM_BLOCKED);return;}
  camMsg('Pidiendo permiso para la cámara… si el navegador muestra un aviso arriba, pulsa «Permitir».');
  const tries=[{video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false},{video:true,audio:false}];
  let err=null;
  for(const c of tries){try{Cam.stream=await navigator.mediaDevices.getUserMedia(c);err=null;break;}catch(e){err=e;if(e&&e.name==='NotAllowedError')break;}}
  if(!Cam.stream){const n=err&&err.name;
    const M={NotAllowedError:'El permiso de la cámara está bloqueado. En Chrome toca el candado (o el ícono de ajustes) junto a la dirección → Cámara → Permitir, y recarga la página. En Mac revisa también Configuración del Sistema → Privacidad y seguridad → Cámara → activa Chrome.',
      NotFoundError:'No se encontró ninguna cámara en este equipo.',
      NotReadableError:'La cámara está ocupada por otra aplicación (Zoom, Teams, FaceTime…). Ciérrala y vuelve a intentar.',
      OverconstrainedError:'La cámara no aceptó la configuración pedida.',
      SecurityError:CAM_BLOCKED};
    camMsg((M[n]||CAM_BLOCKED)+(n?' ('+n+')':''));if(n==='NotAllowedError'||n==='SecurityError')camHelp('denied');camDiag();return;}
  const v=$('camVideo'); v.srcObject=Cam.stream; try{await v.play();}catch(e){}
  Cam.on=true; stopAnim(); S.conv=false; syncSegs(); $('camIdle').hidden=true; $('btnCam').textContent='Apagar cámara'; $('btnCamTop').textContent='Cámara activa'; const hp=$('camHelp'); if(hp)hp.hidden=true; camDiag();
  if(Cam.mode==='hand')loadHand(); else camMsg('Modo dedal rojo: mueve la punta roja frente a la cámara.');
  requestAnimationFrame(camLoop);
}
function camStop(){
  Cam.on=false; if(Cam.stream)Cam.stream.getTracks().forEach(t=>t.stop()); Cam.stream=null;
  $('camIdle').hidden=false; $('btnCam').textContent='Seguir mi dedo'; $('btnCamTop').textContent='Activar cámara'; S.verg=0; Cam.sm=null; changed();
  const ov=$('camOverlay'); ov.getContext('2d').clearRect(0,0,ov.width,ov.height);
}
function findRed(v){
  if(!Cam.small){Cam.small=document.createElement('canvas');Cam.small.width=96;Cam.small.height=72;}
  const c=Cam.small.getContext('2d',{willReadFrequently:true}); c.drawImage(v,0,0,96,72);
  const d=c.getImageData(0,0,96,72).data; let n=0,sx=0,sy=0;
  for(let i=0,p=0;i<d.length;i+=4,p++){const r=d[i],g=d[i+1],b=d[i+2];if(r>110&&r>g*1.7&&r>b*1.6){n++;sx+=p%96;sy+=(p/96)|0;}}
  if(n<6)return null; return {x:1-(sx/n)/96, y:(sy/n)/72, size:Math.sqrt(n)/96};
}
function camLoop(now){
  if(!Cam.on)return; requestAnimationFrame(camLoop);
  const v=$('camVideo'); if(v.readyState<2)return;
  let pt=null;
  if(Cam.mode==='hand'&&Cam.lm){try{const r=Cam.lm.detectForVideo(v,now);if(r.landmarks&&r.landmarks.length){const L=r.landmarks[0],t=L[8];pt={x:1-t.x,y:t.y,size:Math.hypot(L[0].x-L[9].x,L[0].y-L[9].y),hand:L};}}catch(e){}}
  else if(Cam.mode==='color')pt=findRed(v);
  const ov=$('camOverlay'), W=ov.clientWidth, H=ov.clientHeight, dpr=Math.min(2,devicePixelRatio||1);
  if(ov.width!==Math.round(W*dpr)){ov.width=Math.round(W*dpr);ov.height=Math.round(H*dpr);}
  const g=ov.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  if(pt){
    Cam.lastSeen=now; Cam.sm=Cam.sm?{x:Cam.sm.x+(pt.x-Cam.sm.x)*0.45,y:Cam.sm.y+(pt.y-Cam.sm.y)*0.45,size:Cam.sm.size+(pt.size-Cam.sm.size)*0.3}:pt;
    const A=+$('camRange').value;
    S.gaze={x:Math.max(-40,Math.min(40,-(Cam.sm.x-0.5)*2*A)),y:Math.max(-32,Math.min(32,-(Cam.sm.y-0.5)*2*A*0.8))};
    if($('camConv').checked){const [s0,s1]=Cam.mode==='hand'?[0.2,0.38]:[0.1,0.26];S.verg=Math.max(0,Math.min(1,(Cam.sm.size-s0)/(s1-s0)))*20;}else S.verg=0;
    dirty=true; syncPads();
    if(pt.hand){g.fillStyle='rgba(255,255,255,.55)';for(const q of pt.hand){g.beginPath();g.arc((1-q.x)*W,q.y*H,2,0,7);g.fill();}}
    g.beginPath();g.arc(Cam.sm.x*W,Cam.sm.y*H,9,0,7);g.strokeStyle='#FFD36A';g.lineWidth=3;g.stroke();
  } else if(now-Cam.lastSeen>1500&&S.verg>0){S.verg*=0.9;if(S.verg<0.3)S.verg=0;markDirty();}
}
$('btnCam').onclick=()=>{Cam.on?camStop():camStart();};
$('btnCamTop').onclick=()=>{const c=$('camCard');if(c&&c.scrollIntoView)c.scrollIntoView({behavior:'smooth',block:'center'});if(!Cam.on)camStart();};
function platform(){const u=navigator.userAgent;if(/iPhone|iPad|iPod/.test(u))return 'ios';if(/Android/.test(u))return 'android';if(/Mac/.test(u))return 'mac';return 'other';}
function camHelp(kind){
  const p=platform(); let steps;
  if(kind==='http')steps=['Cierra esta página.','Abre la dirección escribiéndola con <b>https://</b> al principio.'];
  else if(p==='ios')steps=['Abre <b>Ajustes</b> del iPhone → <b>Safari</b> (o <b>Chrome</b>) → <b>Cámara</b> → <b>Preguntar</b> o <b>Permitir</b>.','En Safari toca <b>aA</b> junto a la dirección → <b>Configuración del sitio web</b> → <b>Cámara: Permitir</b>.','Recarga la página y toca <b>Activar cámara</b>.'];
  else if(p==='android')steps=['Toca el ícono junto a la dirección (candado o ajustes) → <b>Permisos</b> → <b>Cámara: Permitir</b>.','Si no aparece, ve a <b>Ajustes del teléfono → Apps → Chrome → Permisos → Cámara → Permitir</b>.','Recarga la página y toca <b>Activar cámara</b>.'];
  else if(p==='mac')steps=['Toca el ícono a la izquierda de la dirección → <b>Cámara: Permitir</b>.','Revisa <b>Configuración del Sistema → Privacidad y seguridad → Cámara</b> y activa tu navegador; ciérralo con Cmd + Q y ábrelo de nuevo.','Recarga la página y toca <b>Activar cámara</b>.'];
  else steps=['Toca el ícono a la izquierda de la dirección → <b>Cámara: Permitir</b>.','Revisa en la configuración del sistema que el navegador tenga acceso a la cámara.','Recarga la página y toca <b>Activar cámara</b>.'];
  let el=$('camHelp'); if(!el){el=document.createElement('div');el.id='camHelp';el.className='camhelp';$('camStatus').after(el);}
  el.innerHTML='<b>Cómo activar la cámara</b><ol>'+steps.map(x=>'<li>'+x+'</li>').join('')+'</ol>'; el.hidden=false;
}
async function camDiag(){
  const d=$('camDiag'); if(!d)return; const parts=[];
  const sec=window.isSecureContext; parts.push(`<span class="${sec?'ok':'no'}">${sec?'https ✓':'sin https ✗'}</span>`);
  const api=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia); parts.push(`<span class="${api?'ok':'no'}">${api?'cámara disponible ✓':'cámara no disponible aquí ✗'}</span>`);
  let st='';try{if(navigator.permissions&&navigator.permissions.query){const r=await navigator.permissions.query({name:'camera'});st=r.state;r.onchange=()=>camDiag();}}catch(e){}
  if(st)parts.push(`<span class="${st==='denied'?'no':'ok'}">permiso: ${st==='granted'?'permitido ✓':st==='denied'?'bloqueado ✗':'se pedirá al activar'}</span>`);
  d.innerHTML=parts.join('');
  if(!sec)camHelp('http'); else if(st==='denied')camHelp('denied');
}
camDiag();
$('camMode').onchange=e=>{Cam.mode=e.target.value;Cam.sm=null;if(Cam.on&&Cam.mode==='hand')loadHand();};
$('camRange').oninput=e=>{$('camRangeO').textContent=e.target.value+'°';};

const dp=$('dragpad3d'); let dpDrag=false;
function dpSet(e){const r=dp.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;stopAnim();
  S.gaze={x:Math.max(-40,Math.min(40,-(x-0.5)*80)),y:Math.max(-32,Math.min(32,-(y-0.5)*64))};dirty=true;syncPads();}
dp.addEventListener('pointerdown',e=>{dpDrag=true;dp.setPointerCapture(e.pointerId);dpSet(e);});
dp.addEventListener('pointermove',e=>{if(dpDrag)dpSet(e);});
dp.addEventListener('pointerup',()=>dpDrag=false);dp.addEventListener('pointercancel',()=>dpDrag=false);
function updateDragDot(){if(S.tab!=='anat')return;const d=$('dp-dot');d.style.left=(50-S.gaze.x/80*100)+'%';d.style.top=(50-S.gaze.y/64*100)+'%';}

/* ================= API FOR 3D ================= */
const EOM=window.EOM={S,MUS,NERVE,T0,INFO,get disp(){return disp;},cur:null,lesionSites,describeLesion,setGaze,startH,showTab,onTab:null,markDirty:()=>{dirty=true;nineNeeds=true;}};

/* ================= INIT ================= */
function tabify(root){(root||document).querySelectorAll('.card>h2:first-child,.card>.h2:first-child').forEach(h=>{if(h.querySelector('.tabl'))return;const t=[...h.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(t){const sp=document.createElement('span');sp.className='tabl';sp.textContent=t.textContent.trim();h.replaceChild(sp,t);}else{const f=h.firstElementChild;if(f&&f.tagName==='SPAN'&&!f.classList.contains('chip'))f.classList.add('tabl');}});}
tabify();
new MutationObserver(()=>tabify()).observe(document.getElementById('dxMain'),{childList:true,subtree:false});
buildEyeCtl('R');buildEyeCtl('L');applyAll();syncCtl();syncSegs();syncPads();
cur=compute(0,0);
updateClin();updateStatus();
new ResizeObserver(()=>{markDirty();}).observe(document.querySelector('main'));
new ResizeObserver(()=>{nineNeeds=true;}).observe($('nine'));
const HASHTAB={simulador:'sim',anatomia:'anat',diagnostico:'dx'};
let startTab=HASHTAB[(location.hash||'').slice(1)];
if(!startTab){try{startTab=localStorage.getItem('oculo-tab');}catch(e){}}
showTab(startTab&&TABHASH[startTab]?startTab:'sim');
initStore();
requestAnimationFrame(frame);
})();
