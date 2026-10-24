// 靜態檢查：外部載入、儲存、lookbehind、寫死色碼、重複 id、doctype／viewport、出處鍵存在
const {load,mk}=require('./harness');
const file=process.argv.find(a=>a.endsWith('.html'));
const {A,html}=load(file); const set=mk(A);
const bad=[];
const css=(html.match(/<style>([\s\S]*?)<\/style>/g)||[]).join("\n").replace(/\/\*[\s\S]*?\*\//g,"");
const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
if(/<link[^>]+href=["']?https?:|<script[^>]+src=|fonts\.googleapis|fonts\.gstatic|@import/.test(html)) bad.push("外部載入");
if(/localStorage|sessionStorage|document\.cookie|indexedDB/.test(js)) bad.push("使用瀏覽器儲存");
if(/\(\?<[=!]/.test(js)) bad.push("正規式使用 lookbehind");
if(!/^<!doctype html>/i.test(html)) bad.push("缺 doctype");
if(!/<html lang="zh-Hant">/.test(html)) bad.push("缺 lang");
if(!/viewport-fit=cover/.test(html)) bad.push("viewport 缺 viewport-fit=cover");
if(/<meta name="claude:/.test(html)) bad.push("含 claude: meta");
// 色碼只可出現在 token 宣告（--xxx:#...）
css.split(/[;{}]/).forEach(d=>{ if(/#[0-9a-fA-F]{3,8}\b|rgba?\((?!0,0,0,)/.test(d)&&!/^\s*--[\w-]+\s*:/.test(d)) bad.push("寫死色碼："+d.trim().slice(0,60)); });
const jsCol=js.match(/(?:color|background)\s*:\s*#[0-9a-fA-F]{3,8}/g); if(jsCol) bad.push("JS 內寫死色碼 "+jsCol.length);
// 靜態 id 重複
const ids={}; (html.replace(/<script>[\s\S]*<\/script>/,"").match(/\sid="[^"$]+"/g)||[]).forEach(m=>{ids[m]=(ids[m]||0)+1;});
Object.entries(ids).filter(([,n])=>n>1).forEach(([k])=>bad.push("重複 id "+k));
// REF 每筆有 s 與 f
for(const [k,r] of Object.entries(A.REF)) if(!r.s||!r.f) bad.push("REF 缺欄位 "+k);
// 實際輸出中的出處鍵都存在於 REF（render 所有情境）
const used=new Set(), missing=new Set();
const scan=h=>{ for(const m of h.matchAll(/data-ref="([^"]*)"/g)){ used.add(m[1]); if(!A.REF[m[1]]) missing.add(m[1]); } };
for(const [sk,sy] of Object.entries(A.SYS)) for(const sub of sy.subs){ set({tab:"emp",sys:sk,sub:sub.id,sev:"shock",allergy:"pen_ana"}); scan(A.render("emp")); for(const p of (A.PL[sub.id]||[])){ set({tab:"emp",sys:sk,sub:sub.id,path:p}); scan(A.render("emp")); } }
for(const t of ["spec","cur","oral","px","vanco","teico","ix","ref"]){ set({tab:t}); scan(A.render(t)); }
// 新模組：每個藥物頁、每個手術、TDM 各藥各用途（含濃度）、PEN-FAST 各分數
const PTS=[{},{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6,method:"cg"}},{pt:{age:60,sex:"F",wt:55,method:"hd"}}];
for(const k of Object.keys(A.D)) for(const pt of PTS){ set(Object.assign({tab:"drug",drug:k},JSON.parse(JSON.stringify(pt)))); scan(A.render("drug")); }
for(const p of A.PROC) for(const al of ["none","pen_ana"]){ set({tab:"px",proc:p.id,allergy:al}); scan(A.render("px")); }
for(const td of ["vanco","teico","gent","amk"]) for(const mode of ["ei","conv","syn"]) for(const pt of PTS) for(const lv of [{},{c1:4,t1:8},{c1:12,t1:1.5,c2:2,t2:12}]){ set(Object.assign({tab:"tdm",tdm:td,ag:Object.assign({mode,ti:0.5,c1:null,t1:null,c2:null,t2:null},lv)},JSON.parse(JSON.stringify(pt)))); scan(A.render("tdm")); }
for(let m=0;m<16;m++){ set({pf:{f5:!!(m&1),ana:!!(m&2),scar:!!(m&4),tx:!!(m&8)}}); scan(A.pfHTML()); }
// 每筆 REF 都有被引用（來源頁本身不算）
set({tab:"ref"}); const refHtml=A.render("ref");
Object.keys(A.REF).forEach(k=>{ if(!refHtml.includes(A.REF[k].s)) bad.push("REF 未列在來源頁 "+k); });
const unused=Object.keys(A.REF).filter(k=>!used.has(k)); if(unused.length) console.log("（提示）未被任何情境引用的 REF："+unused.join(", "));
missing.forEach(k=>bad.push("出處鍵不存在 "+k));
// 每個藥恰好屬於一個清單分組（DGRP）
if(A.DGRP){ const cnt={}; A.DGRP.forEach(([,ks])=>ks.forEach(k=>{cnt[k]=(cnt[k]||0)+1; if(!A.D[k]) bad.push("分組內藥物不存在 "+k);}));
  Object.keys(A.D).forEach(k=>{ if(cnt[k]!==1) bad.push("藥物分組次數 "+(cnt[k]||0)+"："+k); }); }
if(/\bsrc\b[^>]*title=/.test(js)&&/class="src" title=/.test(js)) bad.push("出處仍用 hover title");
if(bad.length){ console.log("STATIC FAIL",bad.length); bad.slice(0,40).forEach(b=>console.log("  "+b)); process.exit(1); }
console.log("STATIC OK（出處鍵 "+used.size+"）");
