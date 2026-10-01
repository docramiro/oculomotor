/* ================= I18N: language choice, lookup, static labels =================
   window.OCU_I18N = {es:{…}, en:{…}, …} is inlined by build.py from fuente/i18n/*.json.
   Static markup carries data-i18n="key" (text), data-i18n-html="key" (markup) and
   data-i18n-aria-label / -title / -placeholder="key"; scripts call I18N.t('key', {params}). */
window.I18N = (function(){
const D=window.OCU_I18N, KEY='oculo-lang', ATTRS=['aria-label','title','placeholder'];
const ok=l=>typeof l==='string'&&Object.prototype.hasOwnProperty.call(D,l);
function detect(){
  let l=null;
  try{l=new URLSearchParams(location.search).get('lang');}catch(e){}
  if(!ok(l)){try{l=localStorage.getItem(KEY);}catch(e){}}
  if(!ok(l))l=(navigator.languages||[navigator.language||'']).map(x=>String(x).slice(0,2).toLowerCase()).find(ok);
  return ok(l)?l:'es';
}
let lang=detect();
const get=(d,k)=>k.split('.').reduce((o,p)=>o==null?o:o[p],d);
function t(k,p){
  let s=get(D[lang],k); if(s==null)s=get(D.es,k); if(s==null)return k;
  return p&&typeof s==='string'?s.replace(/\{(\w+)\}/g,(m,n)=>n in p?p[n]:m):s;
}
function apply(root){
  root.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=t(e.getAttribute('data-i18n'));});
  root.querySelectorAll('[data-i18n-html]').forEach(e=>{e.innerHTML=t(e.getAttribute('data-i18n-html'));});
  for(const a of ATTRS)root.querySelectorAll('[data-i18n-'+a+']').forEach(e=>e.setAttribute(a,t(e.getAttribute('data-i18n-'+a))));
}
function set(l){
  if(!ok(l))return; lang=l;
  try{localStorage.setItem(KEY,l);}catch(e){}
  try{const u=new URL(location.href);if(u.searchParams.has('lang')){u.searchParams.delete('lang');history.replaceState(null,'',u);}}catch(e){}
  document.documentElement.lang=l; apply(document);
}
document.documentElement.lang=lang; apply(document);
return {t,apply,set,has:k=>get(D[lang],k)!=null,dict:()=>D[lang],get lang(){return lang;},langs:Object.keys(D).map(k=>[k,D[k]._name||k])};
})();
