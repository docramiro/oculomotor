/* ================= DATA: cases and diagnostic tree (logic only) =================
   The text of cases, tree and anatomy cards lives in fuente/i18n/<lang>.json under
   "cases", "tree" and "info"; OCU_DATA(dict) merges it in for the active language. */
window.OCU_DATA = function(T){
const CASES = [
 {id:'vi-dm', lesion:{R:'VI'}, preguntas:[{c:0,gaze:[30,0]},{c:0},{c:0},{c:0}]},
 {id:'iv-tce', lesion:{R:'IV'}, preguntas:[{c:0},{c:0,gaze:[-25,0]},{c:0,tilt:25},{c:0},{c:0}]},
 {id:'iii-aneur', lesion:{R:'III'}, preguntas:[{c:0},{c:0},{c:0},{c:0}]},
 {id:'iii-isq', lesion:{L:'IIIps'}, preguntas:[{c:0},{c:0},{c:0},{c:0}]},
 {id:'ino-em', lesion:{R:'INO'}, preguntas:[{c:0,gaze:[-30,0]},{c:0,conv:true},{c:0},{c:0}]},
 {id:'vi-hic', syn:{k:'VI2',side:'R',sev:60}, preguntas:[{c:0,gaze:[30,0]},{c:0},{c:0},{c:0}]},
 {id:'seno', syn:{k:'CS',side:'R',sev:100}, preguntas:[{c:0},{c:0},{c:0},{c:0}]},
 {id:'uno-medio', syn:{k:'OAH',side:'R',sev:100}, preguntas:[{c:0,gaze:[-30,0]},{c:0},{c:0,conv:true}]},
 {id:'horner', lesion:{L:'HOR'}, preguntas:[{c:0},{c:0},{c:0}]}
];

/* ---------- diplopia decision tree: opts = next node per answer ---------- */
const TREE = {
 root:{opts:['pupil','mono']},
 mono:{},
 pupil:{opts:['iiicomp','horner','ptosis']},
 iiicomp:{load:{les:{R:'III'}}},
 horner:{load:{les:{L:'HOR'}}},
 ptosis:{opts:['iiiisq','mg','dir']},
 iiiisq:{load:{les:{R:'IIIps'}}},
 mg:{},
 dir:{opts:['horiz','vert']},
 horiz:{opts:['vi','ino','oah','foria']},
 vi:{opts:['vi1','vi2']},
 vi1:{load:{les:{R:'VI'}}},
 vi2:{load:{syn:{k:'VI2',side:'R',sev:70}}},
 ino:{load:{les:{R:'INO'}}},
 oah:{load:{syn:{k:'OAH',side:'R',sev:100}}},
 foria:{},
 vert:{opts:['parks','skew','restr']},
 parks:{go:'parks',load:{les:{R:'IV'}}},
 skew:{},
 restr:{}
};
for(const c of CASES){const x=T.cases[c.id];c.titulo=x.titulo;c.vineta=x.vineta;c.dx=x.dx;c.preguntas=c.preguntas.map((q,i)=>({...q,...x.preguntas[i]}));}
for(const k in TREE){const n=TREE[k],x=T.tree[k];if(n.opts){n.q=x.q;n.opts=n.opts.map((next,i)=>[x.opts[i],next]);}else{n.dx=x.dx;n.text=x.text;}}
return {CASES, TREE, INFO:T.info};
};
