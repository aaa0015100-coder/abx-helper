// 快照：固定情境下各分頁的文字片段（依片段排序，只比內容不比位置）。
// node tests/snap.js            → 與 tests/snap.txt 比對，印出差異
// node tests/snap.js --update   → 覆寫 tests/snap.txt
const fs=require('fs'),path=require('path');
const {load,mk}=require('./harness');
const {A}=load(process.argv.find(a=>a.endsWith('.html')));
const set=mk(A);
const frags=h=>h.replace(/<(script|style)[\s\S]*?<\/\1>/g," ").split(/<[^>]+>/).map(s=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/\s+/g," ").trim()).filter(Boolean);
const PT={
  none:{},
  c35:{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6,method:"cg",crcl:null,egfr:null,aki:false}},
  hd:{pt:{age:60,sex:"F",wt:55,ht:null,scr:null,method:"hd",crcl:null,egfr:null,aki:false}},
  arc:{pt:{age:25,sex:"M",wt:70,ht:175,scr:0.5,method:"cg",crcl:null,egfr:null,aki:true}},
};
const out=[];
function snap(label,o,tab){
  set(o); let h;
  try{ h=A.render(tab); }catch(e){ out.push("## "+label+"\nEXC "+e.message); return; }
  out.push("## "+label+"\n"+[...frags(h)].sort().join("\n"));
}
for(const [sk,sy] of Object.entries(A.SYS)) for(const sub of sy.subs){
  const sevs=A.hasSev(sub.id)?["none","shock"]:["none"];
  for(const sev of sevs) for(const pk of ["none","c35","hd"]) for(const al of ["none","pen_ana"]){
    snap(`emp ${sub.id} ${sev} ${pk} ${al}`,Object.assign({tab:"emp",sys:sk,sub:sub.id,sev,allergy:al},JSON.parse(JSON.stringify(PT[pk]))),"emp");
  }
  for(const p of (A.PL[sub.id]||[])) snap(`emp ${sub.id} path ${p}`,Object.assign({tab:"emp",sys:sk,sub:sub.id,path:p},JSON.parse(JSON.stringify(PT.c35))),"emp");
}
snap("emp arc preg mdr",Object.assign({tab:"emp",preg:true,mdr:["prevESBL","prevPSA"]},PT.arc),"emp");
for(const tab of ["spec","cur","oral","vanco","teico","ix","ref"]) for(const pk of ["none","c35","hd"]) snap(`${tab} ${pk}`,Object.assign({tab},JSON.parse(JSON.stringify(PT[pk]))),tab);
for(const k of Object.keys(A.D)) snap(`drug ${k}`,Object.assign({tab:"drug",drug:k},JSON.parse(JSON.stringify(PT.c35))),"drug");
for(const td of ["vanco","teico","gent","amk"]) for(const mode of ["ei","conv","syn"]) for(const pk of ["none","c35","hd"]) snap(`tdm ${td} ${mode} ${pk}`,Object.assign({tab:"tdm",tdm:td,ag:{mode,ti:0.5,c1:12,t1:1.5,c2:2,t2:12}},JSON.parse(JSON.stringify(PT[pk]))),"tdm");
for(const pr of A.PROC) snap(`px ${pr.id||pr[0]}`,Object.assign({tab:"px",proc:pr.id||pr[0]},PT.c35),"px");
const s=out.join("\n")+"\n";
const f=path.join(__dirname,'snap.txt');
if(process.argv.includes('--update')||!fs.existsSync(f)){ fs.writeFileSync(f,s); console.log("snap written",out.length,"scenarios"); process.exit(0); }
const old=fs.readFileSync(f,'utf8');
if(old===s){ console.log("SNAP OK",out.length); process.exit(0); }
// 依情境分段比對，只印有差異的片段
const parse=t=>{const m={};let k=null;for(const l of t.split("\n")){if(l.startsWith("## ")){k=l.slice(3);m[k]=[];}else if(k&&l) m[k].push(l);}return m;};
const a=parse(old),b=parse(s); const agg={};
for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
  const x=a[k]||[],y=b[k]||[]; const cnt=new Map();
  x.forEach(l=>cnt.set(l,(cnt.get(l)||0)+1)); y.forEach(l=>cnt.set(l,(cnt.get(l)||0)-1));
  for(const [l,c] of cnt) if(c){ const key=(c>0?"- ":"+ ")+l; (agg[key]=agg[key]||[]).push(k); }
}
const keys=Object.keys(agg);
console.log("SNAP DIFF",keys.length,"distinct fragments");
for(const k of keys.slice(0,+(process.env.SNAPN||80))) console.log(agg[k].length+"× "+k.slice(0,160)+"   e.g. "+agg[k][0]);
process.exit(1);
