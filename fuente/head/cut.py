import sys, os
# Uso: python cut.py ruta/a/LeePerrySmith.glb
# El modelo está en el repositorio de three.js: examples/models/gltf/LeePerrySmith/LeePerrySmith.glb
import trimesh, numpy as np, json, base64, sys
m=trimesh.load(sys.argv[1] if len(sys.argv)>1 else 'LeePerrySmith.glb',force='mesh',process=False)
V=m.vertices.copy(); F=m.faces.copy(); UV=m.visual.uv.copy()
MM=53.4                          # mm per model unit (IPD 63 mm)
RG=12/MM; RL=RG+1.3/MM           # globe radius; lid rides 0.9 mm outside
P=dict(W=15.0/MM, U=4.6/MM, Lo=4.4/MM, dy=-0.4/MM)
eyes={}
for side,sx in (('R',-1),('L',1)):
    sel=(abs(V[:,0]-(-0.658 if sx<0 else 0.522))<0.2)&(V[:,1]>1.47)&(V[:,1]<1.85)&(V[:,2]>1.55)
    vv=V[sel]; A=np.c_[2*vv,np.ones(len(vv))]; b=(vv**2).sum(1); sol=np.linalg.lstsq(A,b,rcond=None)[0]; c=sol[:3]; r=np.sqrt(sol[3]+c@c)
    front=c[2]+r
    gz=front-0.6/MM-(RG+2.6/MM)      # cornea apex 0.6 mm behind closed-lid surface
    eyes[side]=dict(c=np.array([c[0],c[1]+P['dy'],gz]),fit=c,r=r,front=front,sx=sx)
    print(side,'fit',c,r,'front',front,'globe z',gz)
def arcs(e,x):
    s=np.clip((x-e['c'][0])/P['W'],-1,1); nas=-e['sx']*s  # +1 toward nose
    base=(1-s**2)
    up=P['U']*base**0.62*(1+0.12*nas) + 0.8/MM*(-nas)   # lateral canthus a bit higher
    lo=-P['Lo']*base**0.75*(1-0.05*nas) + 0.8/MM*(-nas)*base**0
    return e['c'][1]+up, e['c'][1]+lo*1.0
keep=np.ones(len(F),bool)
cent=V[F].mean(1)
for side,e in eyes.items():
    dx=cent[:,0]-e['c'][0]
    inx=abs(dx)<P['W']*0.995
    up,lo=arcs(e,cent[:,0])
    inside=inx&(cent[:,1]<up)&(cent[:,1]>lo)&(cent[:,2]>e['c'][2])&(abs(cent[:,1]-e['c'][1])<0.3)
    keep&=~inside
    e['nDel']=int(inside.sum())
Fk=F[keep]; Fd=F[~keep]
bnd=np.intersect1d(np.unique(Fk),np.unique(Fd))
Vn=V.copy()
info={}
for side,e in eyes.items():
    c=e['c']; b=bnd[(abs(V[bnd,0]-c[0])<P['W']*1.3)&(abs(V[bnd,1]-c[1])<0.25)]
    up,lo=arcs(e,V[b,0])
    isup=V[b,1]>(up+lo)/2
    x=np.clip(V[b,0],c[0]-P['W'],c[0]+P['W'])
    y=np.where(isup,up,lo)
    dd=RL**2-(x-c[0])**2-(y-c[1])**2
    z=c[2]+np.sqrt(np.clip(dd,0,None))
    Vn[b,0]=x; Vn[b,1]=y; Vn[b,2]=np.where(dd>0,z,V[b,2])
    # push other lid vertices out of the globe
    reg=np.where((np.linalg.norm(Vn-c,axis=1)<RL+0.4/MM)&(Vn[:,2]>c[2]))[0]
    for i in reg:
        d=Vn[i]-c; n=np.linalg.norm(d); Vn[i]=c+d/n*(RL+0.4/MM)
    # ordered margins
    ub=b[isup]; lb=b[~isup]
    ub=ub[np.argsort(Vn[ub,0])]; lb=lb[np.argsort(Vn[lb,0])]
    # upper-lid influence (for ptosis): vertices above upper arc within 11 mm, front side
    upA,_=arcs(e,Vn[:,0])
    dyu=Vn[:,1]-upA
    cand=np.where((abs(Vn[:,0]-c[0])<P['W']*1.25)&(dyu>-0.2/MM)&(dyu<11/MM)&(Vn[:,2]>c[2]-2/MM))[0]
    cand=np.setdiff1d(cand,np.setdiff1d(np.unique(Fd),np.unique(Fk)))
    w=np.clip(1-dyu[cand]/(11/MM),0,1)**1.4 * np.clip(1-(abs(Vn[cand,0]-c[0])/(P['W']*1.25))**4,0,1)
    info[side]=dict(ub=ub,lb=lb,pi=cand,pw=w)
used=np.unique(Fk)
remap=-np.ones(len(V),int); remap[used]=np.arange(len(used))
mid=(eyes['R']['c']+eyes['L']['c'])/2
Vo=(Vn[used]-mid)*MM
out=dict(pos=base64.b64encode(Vo.astype(np.float32).tobytes()).decode(),
 uv=base64.b64encode(UV[used].astype(np.float32).tobytes()).decode(),
 idx=base64.b64encode(remap[Fk].astype(np.uint16).ravel().tobytes()).decode(),
 eyes={s:dict(c=((e['c']-mid)*MM).round(3).tolist(),r=RG*MM) for s,e in eyes.items()},
 margin={s:dict(up=remap[info[s]['ub']].tolist(),lo=remap[info[s]['lb']].tolist()) for s in info},
 ptosis={s:dict(i=remap[info[s]['pi']].tolist(),w=np.round(info[s]['pw'],3).tolist()) for s in info},
 mm=MM)
print({s:(e['nDel']) for s,e in eyes.items()}, 'verts',len(used),'faces',len(Fk), {s:len(info[s]['pi']) for s in info},{s:(len(info[s]['ub']),len(info[s]['lb'])) for s in info})
print('eyes',out['eyes'])
json.dump(out,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'head.json'),'w'))
