// 組合模擬：node tests/fuzz.js [模組…]   模組：drug tdm px pf search emp（預設全部）
const {load,mk}=require('./harness');
const {A}=load(process.argv.find(a=>a.endsWith('.html')));
const set=mk(A);
const only=process.argv.slice(2).filter(a=>!a.endsWith('.html'));
const on=m=>!only.length||only.includes(m);
const BAD=/undefined|NaN|\[object|Infinity|null(?![\w-])/;
const txt=h=>h.replace(/<(script|style)[\s\S]*?<\/\1>/g," ").replace(/<[^>]+>/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/\s+/g," ");
let fails=[],n=0;
function run(label,o,fn,inv){
  set(JSON.parse(JSON.stringify(o))); let h;
  try{ h=fn(); }catch(e){ fails.push([label,o,"EXC "+e.message]); return; }
  n++; const t=txt(h);
  const m=t.match(new RegExp(".{0,40}("+BAD.source+").{0,40}")); if(m) fails.push([label,o,"BAD "+m[0]]);
  const e=inv&&inv(t,h); if(e) fails.push([label,o,e]);
}
const PT={
  none:{},
  n90:{pt:{age:40,sex:"M",wt:70,ht:175,scr:0.9,method:"cg"}},
  c45:{pt:{age:60,sex:"M",wt:70,ht:175,scr:null,method:"crcl",crcl:45}},
  c35:{pt:{age:60,sex:"M",wt:70,ht:175,method:"crcl",crcl:35}},
  c25:{pt:{age:60,sex:"M",wt:70,ht:175,method:"crcl",crcl:25}},
  c15:{pt:{age:60,sex:"M",wt:70,ht:175,method:"crcl",crcl:15}},
  hd:{pt:{age:60,sex:"F",wt:55,method:"hd"}},
  crrt:{pt:{age:60,sex:"F",wt:55,method:"crrt"}},
  aki:{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6,method:"cg",aki:true}},
  obese:{pt:{age:50,sex:"M",wt:130,ht:170,scr:1.0,method:"cg"}}
};
const P=k=>JSON.parse(JSON.stringify(PT[k]));

if(on("drug")) for(const k of Object.keys(A.D)) for(const pk of ["none","c35","hd","crrt"]) for(const preg of [false,true])
  run("drug",Object.assign({tab:"drug",drug:k,preg},P(pk)),()=>A.render("drug"),t=>{
    if(!t.includes(A.D[k].n.replace(/（.*?）/,""))) return "藥物頁沒有藥名";
    const regs=Object.keys(A.REG).filter(r=>A.REG[r].d===k);
    if(regs.length&&!/(IV|PO|IM|吸入|IT)/.test(t)) return "藥物頁沒有途徑";
    if(regs.length===0&&!/沒有這個藥的劑量資料/.test(t)) return "無劑量資料卻未提示";
    if(preg&&!/懷孕/.test(t)) return "未顯示懷孕";
    return "";
  });

if(on("tdm")){
  for(const td of ["vanco","teico","gent","amk"]) for(const mode of ["ei","conv","syn"]) for(const pk of Object.keys(PT)) for(const preg of [false,true])
    run("tdm",Object.assign({tab:"tdm",tdm:td,preg,ag:{mode,ti:0.5,c1:null,t1:null,c2:null,t2:null}},P(pk)),()=>A.render("tdm"),(t)=>{
      if(td!=="gent"&&td!=="amk") return "";
      const X=A.AGX[td]; const pt=PT[pk].pt||{};
      const m=(td==="amk"&&mode==="syn")?"ei":mode;
      const excl=pt.aki||preg||["hd","pd","crrt"].includes(pt.method)||(pt.method==="crcl"&&pt.crcl<20);
      if(m==="ei"&&excl&&/Hartford \d+ mg\/kg/.test(t)) return "不適用每日一次卻顯示 Hartford 卡";
      if(m==="ei"&&excl&&!/不適用每日一次/.test(t)) return "缺不適用提示";
      if(m==="ei"&&!excl){
        const q=pt.method==="crcl"?(pt.crcl>=60?24:pt.crcl>=40?36:48):null;
        if(q&&!new RegExp("IV q"+q+"h").test(t)) return "間隔錯（預期 q"+q+"h）";
        if(td==="amk"&&!/先除以 2/.test(t)) return "amikacin Hartford 未提示 ÷2";
        if(pt.method==="crcl"&&pt.crcl>=20&&pt.crcl<30&&!/CrCl 20–29 各來源不一致/.test(t)) return "CrCl 20–29 未列來源差異";
      }
      if(["hd","crrt"].includes(pt.method)&&!/HD：/.test(t)) return "透析未顯示 HD 劑量";
      if(td==="gent"&&!/CLSI/.test(t)) return "缺 CLSI 2023 提示";
      if(m==="syn"&&!/peak 3–4/.test(t)) return "協同缺目標";
      return "";
    });
  // 兩點濃度
  const cases=[
    [{c1:12,t1:1.5,c2:2,t2:12},"gent",t=>/q24h/.test(t)&&/半衰期/.test(t)],
    [{c1:12,t1:1.5,c2:6,t2:12},"gent",t=>/超過 48 小時/.test(t)||/q48h/.test(t)],
    [{c1:40,t1:1.5,c2:6,t2:12},"amk",t=>/藥動估算/.test(t)],
    [{c1:2,t1:1.5,c2:6,t2:12},"gent",t=>/要低於第一次/.test(t)],
    [{c1:6,t1:12,c2:2,t2:8},"gent",t=>/要晚於第一次/.test(t)],
    [{c1:4,t1:8},"amk",t=>/2 mg\/L（8 小時）/.test(t)],
    [{c1:4,t1:20},"gent",t=>/不在 6–14 小時內/.test(t)]
  ];
  cases.forEach(([lv,td,ok],i)=>run("tdm-level#"+i,Object.assign({tab:"tdm",tdm:td,ag:Object.assign({mode:"ei",ti:0.5,c1:null,t1:null,c2:null,t2:null},lv)},P("n90")),()=>A.render("tdm"),t=>ok(t)?"":"判讀不符預期"));
  // 數值核對：K、t½、Cmax
  set({tab:"tdm",tdm:"gent",ag:{mode:"ei",ti:0.5,c1:12,t1:1.5,c2:2,t2:12}}); const c=A.agCalc();
  const K=Math.log(6)/10.5; if(Math.abs(c.K-K)>1e-9||Math.abs(c.cmax-12*Math.exp(K))>1e-9) fails.push(["tdm-calc",{},"K 或 Cmax 計算錯"]);
}

if(on("px")) for(const p of A.PROC) for(const al of ["none","pen_low","pen_ana"]) for(const pk of ["none","n90","hd"])
  run("px "+p.id,Object.assign({tab:"px",proc:p.id,allergy:al},P(pk)),()=>A.render("px"),t=>{
    if(!t.includes(p.need)) return "未顯示是否需要";
    if(/通常不需要/.test(p.need)&&p.pri.length) return "通常不需要卻有首選";
    if(al!=="none"&&!/β-lactam 過敏/.test(t)) return "過敏未顯示替代";
    if(!/術前尿液培養/.test(t)) return "缺術前尿液培養通則";
    return "";
  });

if(on("pf")) for(let m=0;m<16;m++) for(const al of ["none","pen_low","pen_ana"]){
  const pf={f5:!!(m&1),ana:!!(m&2),scar:!!(m&4),tx:!!(m&8)};
  const sc=(pf.f5?2:0)+((pf.ana||pf.scar)?2:0)+(pf.tx?1:0);
  run("pf",{pf,allergy:al},()=>A.pfHTML(),(t,h)=>{
    if(A.pfScore(pf)!==sc) return "分數錯";
    if(!t.includes(sc+" 分")) return "未顯示分數";
    const btn=/data-act="pf-apply"/.test(h);
    if(btn&&(sc>=3||pf.ana||pf.scar)) return "非低風險卻可套用非嚴重";
    if(btn&&al==="pen_low") return "已是非嚴重仍顯示套用";
    if(pf.scar&&!/SCAR 史不做挑戰/.test(t)) return "SCAR 未警示";
    if(sc<3&&!pf.ana&&!pf.scar&&!/低風險/.test(t)) return "低風險未標示";
    return "";
  });
}

if(on("search")){
  const S=[["cefe","藥物","Cefepime"],["腎盂","診斷","腎盂腎炎"],["turp","手術預防","TURP"],["mrsa","菌種","MRSA"],["amikacin","TDM","Amikacin"],["xyzxyz",null,null]];
  for(const [q,cat,name] of S){
    const hs=A.searchHits(q); n++;
    if(!cat){ if(hs.length) fails.push(["search",{q},"應無結果"]); continue; }
    if(!hs.some(x=>x.t===cat&&x.n.includes(name))) fails.push(["search",{q},`缺 ${cat}：${name}`]);
  }
  const bk=Object.keys(A.D).find(k=>A.D[k].brand);
  if(bk){ const b=A.D[bk].brand.split(/[、,／/ ]/)[0]; const hs=A.searchHits(b); n++; if(!hs.some(x=>x.go.drug===bk)) fails.push(["search",{q:b},"商品名搜不到"]); }
}

if(on("emp")) for(const [sk,sy] of Object.entries(A.SYS)) for(const u of sy.subs) for(const path of [null,...(A.PL[u.id]||[])])
  run("emp",Object.assign({tab:"emp",sys:sk,sub:u.id,path},P("c35")),()=>A.render("emp"),t=>{
    if(path&&!/標靶治療/.test(t)) return "選菌未顯示標靶";
    if(path&&!/經驗性治療（未知菌種時）/.test(t)) return "選菌後經驗性方案未收合";
    if(!path&&/經驗性治療（未知菌種時）/.test(t)) return "未選菌卻出現收合區";
    return "";
  });

const by={}; for(const f of fails){const k=f[0].split("#")[0]+" | "+f[2].slice(0,90);(by[k]=by[k]||[]).push(f[1]);}
console.log("FUZZ TOTAL",n,"FAILS",fails.length);
for(const [k,v] of Object.entries(by)) console.log(v.length+"× "+k+"\n  e.g. "+JSON.stringify(v[0]).slice(0,240));
process.exit(fails.length?1:0);
