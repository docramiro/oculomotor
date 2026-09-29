/* ---------- realistic head (Lee Perry-Smith scan, CC BY 3.0) with open eyes ---------- */
function b64(b64s,T){const bin=atob(b64s);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer);}
function irisCanvas(){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const C=256;
  const g=x.createRadialGradient(C,C,30,C,C,256);g.addColorStop(0,'#5a3a1e');g.addColorStop(.28,'#8a5a2c');g.addColorStop(.5,'#6d4a2a');g.addColorStop(.82,'#4e3420');g.addColorStop(.95,'#2a1b10');g.addColorStop(1,'#140c07');
  x.fillStyle=g;x.fillRect(0,0,512,512);
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<420;i++){const a=rnd()*Math.PI*2,r0=60+rnd()*40,r1=150+rnd()*100,lite=rnd()<.35;
    x.strokeStyle=lite?`rgba(${200+rnd()*40|0},${150+rnd()*40|0},${90+rnd()*30|0},${.18+rnd()*.2})`:`rgba(30,18,8,${.15+rnd()*.25})`;
    x.lineWidth=.6+rnd()*1.8;x.beginPath();x.moveTo(C+Math.cos(a)*r0,C+Math.sin(a)*r0);
    const am=a+(rnd()-.5)*.12;x.quadraticCurveTo(C+Math.cos(am)*(r0+r1)/2,C+Math.sin(am)*(r0+r1)/2,C+Math.cos(a)*r1,C+Math.sin(a)*r1);x.stroke();}
  for(let i=0;i<26;i++){const a=rnd()*Math.PI*2,r=100+rnd()*90;x.fillStyle=`rgba(25,14,6,${.25+rnd()*.25})`;x.beginPath();x.ellipse(C+Math.cos(a)*r,C+Math.sin(a)*r,4+rnd()*8,2+rnd()*4,a,0,7);x.fill();}
  x.strokeStyle='rgba(215,165,100,.55)';x.lineWidth=7;x.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,r=100+Math.sin(a*9)*7;i?x.lineTo(C+Math.cos(a)*r,C+Math.sin(a)*r):x.moveTo(C+Math.cos(a)*r,C+Math.sin(a)*r);}x.stroke();
  const lg=x.createRadialGradient(C,C,215,C,C,256);lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(1,'rgba(10,6,3,.95)');x.fillStyle=lg;x.fillRect(0,0,512,512);
  return c;
}
function lashCanvas(){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');x.clearRect(0,0,1024,256);
  let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const band=(y0,y1,n,len)=>{for(let i=0;i<n;i++){const u=rnd()*1024,l=(y1-y0)*(0.55+rnd()*0.45)*len;const bend=(rnd()-.5)*14+(u-512)/512*10;
    x.strokeStyle=`rgba(${18+rnd()*14|0},${11+rnd()*8|0},${7+rnd()*5|0},${.75+rnd()*.25})`;x.lineWidth=1.2+rnd()*1.6;x.beginPath();x.moveTo(u,y0);x.quadraticCurveTo(u+bend*0.3,y0+l*0.5,u+bend,y0+l);x.stroke();}};
  band(0,128,900,1); band(128,256,380,0.8);
  const g=x.createLinearGradient(0,0,0,18);g.addColorStop(0,'rgba(25,15,10,.8)');g.addColorStop(1,'rgba(25,15,10,0)');x.fillStyle=g;x.fillRect(0,0,1024,18);
  return c;
}
function scleraCanvas(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
  x.fillStyle='#f2ece4';x.fillRect(0,0,1024,512);
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  // equirect: v=0 top (north = +y), u around; front (+z) at u=0.75? three sphere: u=0.25 -> +z? use radial vessels near equator band
  for(let i=0;i<90;i++){let px=rnd()*1024,py=20+rnd()*170;x.strokeStyle=`rgba(${170+rnd()*40|0},${50+rnd()*30|0},${50+rnd()*30|0},${.18+rnd()*.25})`;x.lineWidth=.6+rnd()*1.2;x.beginPath();x.moveTo(px,py);
    for(let k=0;k<6;k++){px+=(rnd()-.5)*40;py+=(rnd()-.5)*22;x.lineTo(px,py);}x.stroke();}
  const g=x.createLinearGradient(0,0,0,512);g.addColorStop(0,'rgba(120,110,105,.25)');g.addColorStop(.06,'rgba(0,0,0,0)');g.addColorStop(.4,'rgba(230,200,190,.25)');g.addColorStop(1,'rgba(200,170,160,.5)');x.fillStyle=g;x.fillRect(0,0,1024,512);
  return c;
}
function makeEyeball(THREE){
  // 12 mm globe, +z = visual axis. Returns {group, rot, pupil}
  const group=new THREE.Group(), rot=new THREE.Group(); rot.rotation.order='YXZ'; group.add(rot);
  const st=new THREE.CanvasTexture(scleraCanvas()); st.colorSpace=THREE.SRGBColorSpace;
  const sg=new THREE.SphereGeometry(12,72,48,0,Math.PI*2,Math.asin(5.95/12),Math.PI-Math.asin(5.95/12)); sg.rotateX(Math.PI/2);
  const sclera=new THREE.Mesh(sg,new THREE.MeshPhysicalMaterial({map:st,roughness:.3,clearcoat:.7,clearcoatRoughness:.12}));
  rot.add(sclera);
  const back=new THREE.Mesh(new THREE.CircleGeometry(6.2,48),new THREE.MeshBasicMaterial({color:0x050404}));back.position.z=9.9;rot.add(back);
  const it=new THREE.CanvasTexture(irisCanvas()); it.colorSpace=THREE.SRGBColorSpace;
  const iris=new THREE.Mesh(new THREE.CircleGeometry(5.9,64),new THREE.MeshStandardMaterial({map:it,roughness:.75}));iris.position.z=10.35;rot.add(iris);
  const limb=new THREE.Mesh(new THREE.RingGeometry(5.7,6.35,64),new THREE.MeshBasicMaterial({color:0x2a2018,transparent:true,opacity:.55}));limb.position.z=10.42;rot.add(limb);
  const pupil=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x030303}));pupil.position.z=10.4;rot.add(pupil);
  const cg=new THREE.SphereGeometry(7.8,48,24,0,Math.PI*2,0,Math.acos(5.27/7.8));cg.rotateX(Math.PI/2);
  const cornea=new THREE.Mesh(cg,new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.02,metalness:0,transparent:true,opacity:.12,clearcoat:1,clearcoatRoughness:0,specularIntensity:1,depthWrite:false}));
  cornea.position.z=5.27;rot.add(cornea);
  const mk=new THREE.Mesh(new THREE.BoxGeometry(.5,2.2,.3),new THREE.MeshBasicMaterial({color:0xC8483A,transparent:true,opacity:.75}));mk.position.set(0,7.3,9.55);mk.rotation.x=-0.66;rot.add(mk);
  const reflex=new THREE.Mesh(new THREE.CircleGeometry(0.42,20),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));reflex.renderOrder=4;group.add(reflex);
  const cc=new THREE.Vector3(),dir=new THREE.Vector3(),wp=new THREE.Vector3();
  function updateReflex(camera){ // corneal light reflex for a light at the camera (Hirschberg)
    cc.set(0,0,5.27).applyEuler(rot.rotation); group.localToWorld(wp.copy(cc));
    dir.copy(camera.position).sub(wp).normalize();
    const p=wp.clone().addScaledVector(dir,7.85*Math.abs(group.getWorldScale(new THREE.Vector3()).x));
    reflex.position.copy(group.worldToLocal(p)); reflex.quaternion.copy(camera.quaternion); const q=group.getWorldQuaternion(new THREE.Quaternion()).invert(); reflex.quaternion.premultiply(q);
  }
  return {group,rot,pupil,sclera,iris,cornea,reflex,updateReflex};
}
function buildHead(THREE,D,maps){
  const pos=b64(D.pos,Float32Array), uv=b64(D.uv,Float32Array), idx=b64(D.idx,Uint16Array);
  const base=pos.slice();
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
  const dupMap=new Map();for(let i=0;i<pos.length/3;i++){const k=Math.round(pos[i*3]*50)+','+Math.round(pos[i*3+1]*50)+','+Math.round(pos[i*3+2]*50);const a=dupMap.get(k);if(a)a.push(i);else dupMap.set(k,[i]);}
  const dups=[...dupMap.values()].filter(a=>a.length>1);
  function normals(){geo.computeVertexNormals();const n=geo.attributes.normal.array;for(const g of dups){let x=0,y=0,z=0;for(const i of g){x+=n[i*3];y+=n[i*3+1];z+=n[i*3+2];}const l=Math.hypot(x,y,z)||1;for(const i of g){n[i*3]=x/l;n[i*3+1]=y/l;n[i*3+2]=z/l;}}geo.attributes.normal.needsUpdate=true;}
  normals();
  const mat=new THREE.MeshStandardMaterial({map:maps.map,roughness:.62,metalness:0,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(geo,mat);
  const lashes=new THREE.Group();
  const lineMat=new THREE.MeshStandardMaterial({color:0x1d130d,roughness:.8});
  const wetMat=new THREE.MeshStandardMaterial({color:0xc0877c,roughness:.25});
  const lashLineMat=new THREE.LineBasicMaterial({color:0x1a110b,transparent:true,opacity:.32});
  const lashGeo=new THREE.BufferGeometry();const LA=new Float32Array(2*2*3*140);lashGeo.setAttribute('position',new THREE.BufferAttribute(LA,3));
  const lashLines=new THREE.LineSegments(lashGeo,lashLineMat);lashes.add(lashLines);
  const tubes=[];
  const V=new THREE.Vector3(),C=new THREE.Vector3(),N=new THREE.Vector3(),T=new THREE.Vector3();
  const lastDrop={R:null,L:null};
  function smoothCurve(s,key){
    const ids=D.margin[s][key];const pts=ids.map(i=>new THREE.Vector3(pos[i*3],pos[i*3+1],pos[i*3+2])).sort((a,b)=>a.x-b.x);
    const out=[];const n=pts.length;for(let k=0;k<n;k++){const a=Math.max(0,k-2),b=Math.min(n-1,k+2);const v=new THREE.Vector3();for(let j=a;j<=b;j++)v.add(pts[j]);out.push(v.multiplyScalar(1/(b-a+1)));}
    const res=[];for(let k=0;k<n;k+=3)res.push(out[k]);res.push(out[n-1]);
    return new THREE.CatmullRomCurve3(res,false,'centripetal');
  }
  function buildLashes(){
    tubes.forEach(t=>{lashes.remove(t);t.geometry.dispose();});tubes.length=0;let n=0;
    for(const s of ['R','L']){const c=D.eyes[s].c;C.set(c[0],c[1],c[2]);
      const cu=smoothCurve(s,'up'), cl=smoothCurve(s,'lo');
      const tu=new THREE.Mesh(new THREE.TubeGeometry(cu,40,0.42,6,false),lineMat);const tl=new THREE.Mesh(new THREE.TubeGeometry(cl,40,0.28,6,false),wetMat);
      lashes.add(tu,tl);tubes.push(tu,tl);
      for(let k=0;k<70;k++){const t=0.04+0.92*k/69;const p=cu.getPointAt(t);N.copy(p).sub(C).normalize();const prof=Math.pow(Math.sin(Math.PI*t),0.6);const L=4.6*(0.35+0.65*prof);
        const b=p.clone().addScaledVector(N,0.9);T.set(N.x*0.25,0.3+N.y*0.15,0.95).normalize();const j=((k*37)%7-3)*0.12;
        const m=[b.x+T.x*L*0.5+j,b.y+T.y*L*0.5,b.z+T.z*L*0.5];const e=[b.x+T.x*L*0.8+j*1.6,b.y+T.y*L*0.8+L*0.35,b.z+T.z*L*0.7];
        LA.set([b.x,b.y,b.z,...m,...m,...e],n*3);n+=4;}}
    lashGeo.setDrawRange(0,n);lashGeo.attributes.position.needsUpdate=true;lashGeo.computeBoundingSphere();
  }
  function setLids(drops){ // drops: {R:mm,L:mm} downward displacement of upper-lid margin
    let changed=false;
    for(const s of ['R','L']){const d=Math.round(drops[s]*20)/20; if(d===lastDrop[s])continue; lastDrop[s]=d; changed=true;
      const P=D.ptosis[s], c=D.eyes[s].c, RL=D.eyes[s].r+1.3;
      for(let k=0;k<P.i.length;k++){const i=P.i[k],w=P.w[k];let x=base[i*3],y=base[i*3+1]-d*w,z=base[i*3+2];
        const dx=x-c[0],dy=y-c[1],dd=RL*RL-dx*dx-dy*dy; if(dd>0){const zs=c[2]+Math.sqrt(dd); if(z<zs)z=zs;}
        pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;}}
    if(changed){geo.attributes.position.needsUpdate=true;normals();buildLashes();}
  }
  setLids({R:0,L:0}); buildLashes();
  return {mesh,lashes,setLids,material:mat,eyes:D.eyes};
}
