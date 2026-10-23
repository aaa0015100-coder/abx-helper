// 用 node vm 載入 index.html 的 script（不需 DOM），提供 A（API）、set（設定狀態）、txt（HTML 轉純文字）
const fs=require('fs'),vm=require('vm'),path=require('path');
function load(file){
  const html=fs.readFileSync(file||path.join(__dirname,'..','index.html'),'utf8');
  const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const ctx={console,setTimeout,clearTimeout}; vm.createContext(ctx);
  vm.runInContext(js+`
;this.__api={S,UI,REF,DGRP,SYS,SUBDEF,REG,D,PL,PATH,PROC,TABS,
  getRenal,hasSev,
  setR(){R=getRenal();},
  render(tab){R=getRenal(); return ({spec:renderSpec,emp:renderEmp,cur:renderCur,oral:renderOral,px:renderPx,vanco:renderVanco,teico:renderTeico,ix:renderIx,ref:renderRef})[tab]();}
};`,ctx);
  return {A:ctx.__api,html};
}
function mk(A){
  const base=JSON.parse(JSON.stringify(A.S));
  // 每次 set 都由預設狀態開始，再套用 o（巢狀物件以淺合併處理 pt／cur／oral／spec）
  return function set(o={}){
    const b=JSON.parse(JSON.stringify(base));
    for(const k of Object.keys(b)) A.S[k]=b[k];
    for(const [k,v] of Object.entries(o)){
      if(v&&typeof v==="object"&&!Array.isArray(v)&&A.S[k]&&typeof A.S[k]==="object") Object.assign(A.S[k],v);
      else A.S[k]=v;
    }
    if(A.UI) A.UI.edit=null;   // 快照與模擬看完整建議（不停在選部位）
    A.setR();
  };
}
const txt=h=>h.replace(/<(script|style)[\s\S]*?<\/\1>/g," ").replace(/<[^>]+>/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
module.exports={load,mk,txt};
