// 組合模擬：node tests/fuzz.js [模組…]   模組：drug tdm px pf search emp cmp cmpentry abg（預設全部）
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

if(on("hep")){
  // Child-Pugh 邊界（Pugh 1973）
  const C=[[{bili:1.9,alb:3.6,inr:1.6,asc:"1",enc:"1"},5,"A"],[{bili:2,alb:3.5,inr:1.7,asc:"1",enc:"1"},8,"B"],[{bili:3,alb:2.8,inr:2.3,asc:"2",enc:"2"},10,"C"],[{bili:3.1,alb:2.7,inr:2.4,asc:"3",enc:"3"},15,"C"],[{bili:1,alb:4,inr:1,asc:"2",enc:"1"},6,"A"],[{bili:1,alb:4,inr:1,asc:"2",enc:"2"},7,"B"],[{bili:2.5,alb:3,inr:2,asc:"2",enc:"1"},9,"B"]];
  C.forEach(([cp,sc,cl])=>{ n++; const r=A.cpScore(Object.assign({mode:"calc"},cp)); if(!r||r.score!==sc||r.cls!==cl) fails.push(["cp",cp,`預期 ${sc}/${cl}，得到 ${r&&r.score}/${r&&r.cls}`]); });
  n++; if(A.cpScore({mode:"calc",bili:null,alb:3,inr:1})!==null) fails.push(["cp",{},"缺資料仍給分級"]);
  n++; if(A.cpScore({mode:"direct",cls:"B"}).cls!=="B") fails.push(["cp",{},"直接選分級錯"]);
  for(const k of Object.keys(A.D)) for(const cls of ["","A","B","C"])
    run("hep "+k,{tab:"drug",drug:k,cp:{mode:"direct",cls}},()=>A.render("drug"),(t,h)=>{
      if(!/肝功能/.test(t)) return "藥物頁缺肝功能區";
      if(A.HEP[k]&&cls&&!new RegExp('class="cur"><td>Child-Pugh '+cls).test(h)) return "未反白目前分級";
      if(!A.HEP[k]&&!/app 未收錄這個藥的肝功能/.test(t)) return "未收錄藥未標示";
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
  // v1.1：雙和常用與新加入的商品名要搜得到
  for(const [q,k] of [["Curam","amoxclav"],["brosym","cps"],["Zavicefta","cza"],["贊飛得","cza"],["zerbaxa","ctz"]]){ n++; if(!A.searchHits(q).some(x=>x.go&&x.go.drug===k)) fails.push(["search",{q},"商品名搜不到 "+k]); }
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

if(on("cmp")){
  // v0.16 比較：所有兩兩組合（細菌、黴菌）＋ 3、4 個藥抽樣；每格說明與出處；摘要與表格一致
  const BK=A.SPEC_ROWS.map(r=>r[0]), FK=A.FCOLS.map(c=>c[0]);
  for(const r of ["ESBL","CRE"]) for(const k of BK){ n++; const v=A.cmpV(k,r); if(![0,1,2,3].includes(v)) fails.push(["cmp-x",{r,k},"值錯 "+v]);
    const x=A.XROWS[r].v[k]; if(x){ if(!x[1]||!x[2]) fails.push(["cmp-x",{r,k},"缺說明或出處"]); if(A.SPV[k][5]===0&&x[0]>0) fails.push(["cmp-x",{r,k},"G(−) 無效卻有 ESBL／CRE 值"]); } }
  // 臨床一致性：CRE 不應有 ≥ +；carbapenem ESBL ++；ESBL ≤ 一般 G(−)
  // v1.1：只有 ceftazidime-avibactam 可在 CRE 列 ≥ +（KPC、OXA-48）
  for(const k of BK){ n++; if(k!=="cza"&&A.cmpV(k,"CRE")>=2) fails.push(["cmp-c",{k},"CRE ≥ +"]); if(A.cmpV(k,"ESBL")>A.SPV[k][5]) fails.push(["cmp-c",{k},"ESBL 高於一般 G(−)"]); }
  for(const k of ["etp","ipm","mem"]){ n++; if(A.cmpV(k,"ESBL")!==3) fails.push(["cmp-c",{k},"carbapenem ESBL 非 ++"]); if(A.cmpV(k,"CRE")!==0) fails.push(["cmp-c",{k},"carbapenem CRE 非 −"]); }
  // v1.1 CZA／CTZ：臨床一致性與逐格依據
  { n++; const V=A.SPV, e=[];
    if(A.cmpV("cza","CRE")!==3) e.push("CZA CRE 非 ++"); if(A.cmpV("ctz","CRE")!==0) e.push("CTZ CRE 非 −");
    if(V.ctz[6]>1) e.push("CTZ AmpC > ±"); if(V.cza[8]||V.ctz[8]) e.push("CZA／CTZ 對 A. baumannii 非 −");
    if(V.cza[7]!==3||V.ctz[7]!==3) e.push("PsA 非 ++"); if(V.cza[9]>0) e.push("CZA 厭氧菌非 −");
    for(const k of ["cza","ctz"]){ if(A.cmpV(k,"ESBL")>1) e.push(k+" ESBL 高於 ±（IDSA 建議保留）"); for(let c=0;c<11;c++){ const x=A.CELLN[k][c]; if(!x||!x[0]||!x[1].length) e.push(k+" 第 "+c+" 欄缺依據"); else x[1].forEach(r=>{ if(!A.REF[r]) e.push("缺 REF "+r); }); } }
    if(e.length) fails.push(["cmp-new",{},e.join("；")]); }
  // 管制抗生素在單一欄或多欄建議中排在最後、不進合併方案
  for(const cols of [[5],[7],[5,7],[6,7],[5,6,7],[3,7],[2,7],[7,9],[5,9]]) run("spec-adv",{tab:"spec",spec:{view:"bac",cols}},()=>A.render("spec"),(t,h)=>{
    if(/合併：[^<]*(Ceftazidime-avibactam|Ceftolozane-tazobactam|Colistin)/.test(t)) return "管制抗生素進入合併方案";
    const seg=h.split("單一藥物即可涵蓋")[1]; if(seg){ const s1=seg.split("</div></div>")[0]; const iR=s1.search(/Ceftazidime-avibactam|Ceftolozane-tazobactam|Colistin/), iN=s1.search(/Meropenem|Piperacillin|Cefepime|Imipenem/); if(iR>=0&&iN>iR) return "管制抗生素排在非管制藥前面"; }
    return ""; });
  const chk=(t,h,keys,fun)=>{
    const nm=fun?keys.map(k=>A.FCOLS.find(c=>c[0]===k)[1]):keys.map(k=>{const r=A.SPEC_ROWS.find(x=>x[0]===k);return r[4]||A.D[r[1]].n;});
    if(!nm.every(x=>t.includes(x))) return "缺藥名";
    const rows=fun?A.FROWS.length:A.CMP_ROWS.length;
    if((h.match(/data-act="cmp-cell"/g)||[]).length!==rows*keys.length) return "格數錯";
    if(!/只有|都不涵蓋|完全相同|差別在強度/.test(t)) return "缺摘要";
    return "";
  };
  for(let i=0;i<BK.length;i++) for(let j=i+1;j<BK.length;j++){ const keys=[BK[i],BK[j]];
    run("cmp2",{tab:"spec",spec:{view:"cmp",cmpt:"bac",cmp:keys}},()=>A.render("spec"),(t,h)=>chk(t,h,keys,false)); }
  for(let i=0;i<FK.length;i++) for(let j=i+1;j<FK.length;j++){ const keys=[FK[i],FK[j]];
    run("cmpf",{tab:"spec",spec:{view:"cmp",cmpt:"fun",cmpf:keys}},()=>A.render("spec"),(t,h)=>chk(t,h,keys,true)); }
  for(let s=0;s<60;s++){ const m=3+(s%2), keys=[]; for(let q=0;keys.length<m;q++){ const k=BK[(s*7+q*11)%BK.length]; if(!keys.includes(k)) keys.push(k); }
    run("cmp34",{tab:"spec",spec:{view:"cmp",cmp:keys}},()=>A.render("spec"),(t,h)=>chk(t,h,keys,false)); }
  // 每一格的說明都有內容
  for(const k of BK) for(const r of A.CMP_ROWS) run("cmp-cell",{tab:"spec",spec:{view:"cmp",cmp:[k,BK[0]===k?BK[1]:BK[0]],cell:[String(r),k]}},()=>A.render("spec"),t=>/×.*：[−±+]/.test(t)?"":"格子說明未顯示");
  for(const k of FK) for(let r=0;r<A.FROWS.length;r++) run("cmp-fcell",{tab:"spec",spec:{view:"cmp",cmpt:"fun",cmpf:[k,FK[0]===k?FK[1]:FK[0]],cell:[String(r),k]}},()=>A.render("spec"),t=>/×.*：[−±+]/.test(t)?"":"格子說明未顯示");
  // 只看差異：相同藥兩欄應全隱藏；選 0、1 個藥不出表
  run("cmp-diff",{tab:"spec",spec:{view:"cmp",cmp:["mem","ipm"],diff:true}},()=>A.render("spec"),(t,h)=>{ const nd=A.CMP_ROWS.filter(r=>A.cmpV("mem",r)!==A.cmpV("ipm",r)).length; return (h.match(/data-act="cmp-cell"/g)||[]).length===nd*2?"":"差異列數錯"; });
  for(const c of [[],["mem"]]) run("cmp-few",{tab:"spec",spec:{view:"cmp",cmp:c}},()=>A.render("spec"),(t,h)=>/data-act="cmp-cell"/.test(h)?"少於 2 個藥仍出表":"");
  // 藥物頁：有抗菌譜資料的藥才有「加入比較」
  for(const k of Object.keys(A.D)) run("cmp-btn",{tab:"drug",drug:k},()=>A.render("drug"),(t,h)=>{ const has=/data-act="cmp-go"/.test(h); return has===!!A.cmpKeyOf(k)?"":"加入比較按鈕不一致"; });
}

if(on("cmpentry")){
  // v1.2 比較入口：方案卡「比較這 N 個藥」、抗菌譜藥卡加入比較（搜尋比較已取消）
  const BK=A.SPEC_ROWS.map(r=>r[0]);
  for(const q of ["比較","compare","cefepime meropenem","mica fluco"]){ n++; if(A.searchHits(q).some(x=>x.t==="比較")) fails.push(["cmp-search",{q},"搜尋不應出現比較（使用者 v1.2 取消）"]); }
  // 方案卡連結：鍵存在、2–4 個、同類、每個藥都在同一張卡內、數字一致
  const chkCards=(label,o,tab)=>run(label,o,()=>A.render(tab),(t,h)=>{
    for(const seg of h.split(/<div class="opt(?: primary)?">/).slice(1)){
      const m=seg.match(/data-act="cmp-set" data-v="(bac|fun)\|([^"]+)">比較(這|其中) (\d) 個藥/); if(!m) continue;
      const ks=m[2].split(","); if(ks.length<2||ks.length>4||+m[4]!==ks.length) return "連結藥數錯 "+m[0];
      for(const k of ks){ const nm=m[1]==="bac"?(A.SPEC_ROWS.find(r=>r[0]===k)||[])[1]:k; if(!nm) return "連結鍵不存在 "+k;
        const names=m[1]==="bac"?[A.D[nm].n]:A.FCOLS.find(c=>c[0]===k)[2].map(r=>A.D[A.REG[r].d].n); if(!names.some(dn=>seg.includes(dn)||seg.includes(dn.replace(/（.*?）/,"")))) return "連結的藥不在卡內 "+names[0]; }
    } return ""; });
  for(const [sk,sy] of Object.entries(A.SYS)) for(const u of sy.subs){
    for(const sev of (A.hasSev(u.id)?["none","sepsis","shock"]:["none"])) for(const al of ["none","pen_ana"]) chkCards("cmp-card",{tab:"emp",sys:sk,sub:u.id,sev,allergy:al},"emp");
    for(const p of (A.PL[u.id]||[])) chkCards("cmp-card",{tab:"emp",sys:sk,sub:u.id,path:p},"emp"); }
  // 抗菌譜藥卡：加入比較按鈕狀態
  for(const k of BK) for(const inC of [false,true]) run("cmp-tog",{tab:"spec",spec:{view:"bac",drug:k,cmp:inC?[k]:[]}},()=>A.render("spec"),(t,h)=>{ const m=h.match(/data-act="cmp-tog" data-v="([^"]+)" aria-pressed="(true|false)"/); return !m||m[1]!==k||(m[2]==="true")!==inC?"加入比較按鈕狀態錯":""; });
}

if(on("abg")){
  // v1.3 院內 antibiogram：資料完整、抽查原表、對應、提示邏輯、過期
  const R=A.ABG_ROWS, nm=new Set();
  n++; if(R.length!==116) fails.push(["abg-data",{},"列數 "+R.length+"（原表 79＋37）"]);
  for(const r of R){ n++; if(nm.has(r[0])) fails.push(["abg-data",{o:r[0]},"菌名重複"]); nm.add(r[0]);
    if(!(r[2]>0)||!["gn","gp"].includes(r[1])) fails.push(["abg-data",{o:r[0]},"n 或分組錯"]);
    for(const [c,v] of Object.entries(r[4])) if(!(v>=0&&v<=100)||!/^[A-Z]{3}m?$/.test(c)) fails.push(["abg-data",{o:r[0],c},"值或代碼錯"]); }
  for(const [p,ns] of Object.entries(A.ABG_PATH)) for(const x of ns){ n++; if(!nm.has(x)) fails.push(["abg-path",{p,x},"菌名不在院內表"]); if(!A.PATH[p]) fails.push(["abg-path",{p},"app 無此菌種"]); }
  // 抽查原表（PDF 逐格對位）
  const SPOT=[["Escherichia coli","n",1058],["Escherichia coli","CRO",68.7],["Escherichia coli","CIP",47.3],["Escherichia coli","SXT",53.7],["Escherichia coli","TZP",95.1],["Escherichia coli","ETP",98.1],
    ["Klebsiella pneumoniae","ETP",74.9],["Klebsiella pneumoniae","CZA",95.4],["Pseudomonas aeruginosa","MEM",84.5],["Pseudomonas aeruginosa","LVX",67],["Acinetobacter baumannii","IPM",26],["Acinetobacter baumannii","COL",98.6],
    ["Staphylococcus aureus","OXA",49.5],["Staphylococcus aureus","n",410],["Enterococcus faecium","VAN",41.7],["Enterococcus faecalis","AMP",99.6],["Streptococcus pneumoniae","PENm",28.6],["Streptococcus pneumoniae","PEN",92.9],["Shewanella sp.","n",1]];
  for(const [o,c,v] of SPOT){ n++; const r=R.find(x=>x[0]===o); const got=r&&(c==="n"?r[2]:r[4][c]); if(got!==v) fails.push(["abg-spot",{o,c},"預期 "+v+" 得到 "+got]); }
  // 對應與推估
  const V=(o,d,m)=>A.abgVal(o,d,m);
  const chk=[[V("Escherichia coli","levo"),x=>x&&x.bad,"E. coli levofloxacin 應標異常"],[V("Escherichia coli","cefazolin"),x=>x&&x.v===60.1&&!x.sur,"E. coli cefazolin"],
    [V("Staphylococcus aureus","cefazolin"),x=>x&&x.v===49.5&&/oxacillin/.test(x.sur),"S. aureus cefazolin 依 oxacillin"],[V("Klebsiella pneumoniae","colistin"),x=>x&&x.i,"colistin 為 %I"],
    [V("Enterococcus faecalis","gent"),x=>x&&x.code==="GEH","Enterococcus gentamicin 用高濃度"],[V("Staphylococcus aureus","azithro"),x=>x===null,"S. aureus 不以 erythromycin 推估 azithromycin"],
    [V("Streptococcus pneumoniae","penG",true),x=>x&&x.v===28.6&&x.men,"腦膜炎判讀"],[V("Escherichia coli","nitrofurantoin"),x=>x===null,"nitrofurantoin 無資料"]];
  chk.forEach(([x,ok,m])=>{ n++; if(!ok(x)) fails.push(["abg-val",{},m+" → "+JSON.stringify(x)]); });
  // 經驗性情境：只列 ≥30 株；E. coli、K. pneumoniae 不顯示 levofloxacin；提示的數字低於門檻；標靶不放逐藥 %S 與提示
  const short=o=>/coagulase/.test(o)?"CoNS":o.replace(/^(\w)\w+ /,"$1. "), big=new Set(R.filter(r=>r[2]>=30).map(r=>short(r[0])));
  const UTI=["pyelo","cuti","cauti","abp","uti_unk"];
  for(const [sk,sy] of Object.entries(A.SYS)) for(const u of sy.subs) for(const sev of (A.hasSev(u.id)?["none","sepsis","shock"]:["none"])) for(const al of ["none","pen_ana"]) for(const path of [null,...(A.PL[u.id]||[]).slice(0,3)])
    run("abg-emp",{tab:"emp",sys:sk,sub:u.id,sev,allergy:al,path},()=>A.render("emp"),(t,h)=>{
      for(const L of (h.match(/<div class="rx-meta abg">[\s\S]*?<\/div>/g)||[])) for(const m of L.matchAll(/<i>([^<]+)<\/i>/g)) if(!big.has(m[1])) return "列出 <30 株菌種 "+m[1];
      for(const seg of h.split('<div class="rx').slice(1)) if(/>Levofloxacin</.test(seg)&&/rx-meta abg[^]*?<i>(E\. coli|K\. pneumoniae)<\/i>/.test(seg.split('<div class="rx')[0])) return "腸道菌 levofloxacin 顯示了異常值";
      const W=(h.match(/<div class="cond abgw">[\s\S]*?<\/div>/g)||[]).map(x=>x.replace(/<[^>]+>/g,""));
      if(path){ const tg=h.split("經驗性治療（未知菌種時）")[0]; if(/rx-meta abg|cond abgw/.test(tg)) return "標靶區出現逐藥 %S 或提示"; }
      for(const w of W){
        if(/IDSA cUTI 2025/.test(w)){ if(!UTI.includes(u.id)||sev==="none") return "非 cUTI 敗血症卻出現 cUTI 門檻"; const T=sev==="shock"?90:80; for(const m of w.matchAll(/感受 ([\d.]+)%/g)) if(+m[1]>=T) return "提示數字未低於門檻 "+m[1]; }
        if(/Rec 2/.test(w)&&u.id!=="cys") return "非膀胱炎出現 TMP-SMX 門檻";
        if(/Rec 9/.test(w)&&!(u.id==="pyelo"&&sev==="none")) return "Rec 9 出現在錯誤情境";
        if(/SIS\/IDSA 2010/.test(w)&&!["ciai_mild","ciai_sev","biliary","iai_unk"].includes(u.id)) return "cIAI FQ 門檻出現在錯誤情境";
      }
      if(!path&&u.id==="cys"&&/>TMP-SMX</.test(h)&&!W.some(w=>/Rec 2/.test(w))) return "膀胱炎 TMP-SMX 缺門檻提示";
      if(!path&&u.id==="pyelo"&&sev==="none"&&/>Ciprofloxacin</.test(h)&&!W.some(w=>/Rec 9/.test(w))) return "腎盂腎炎 FQ 缺門檻提示";
      if(sk==="hap"&&!/院內（全院）S\. aureus 中 MRSA 50\.5%/.test(t)) return "HAP／VAP 缺院內 MRSA";
      return ""; });
  // 標靶摘要：有 ≥30 株代表菌才出現
  for(const [p] of Object.entries(A.ABG_PATH)){ const sub=Object.values(A.SYS).flatMap(s=>s.subs).find(u=>(A.PL[u.id]||[]).includes(p)); if(!sub) continue;
    const sk=Object.keys(A.SYS).find(k=>A.SYS[k].subs.includes(sub)), has=A.ABG_PATH[p].some(o=>R.find(r=>r[0]===o)[2]>=30);
    run("abg-tgt",{tab:"emp",sys:sk,sub:sub.id,path:p},()=>A.render("emp"),t=>/院內 %S（115Q1）/.test(t)===has?"":"標靶摘要有無錯誤"); }
  // 院內檢視：每個菌種都能開、異常值標示、腦膜炎
  for(const r of R) run("abg-view",{tab:"spec",spec:{view:"abg",abg:r[0]}},()=>A.render("spec"),t=>{
    if(!t.includes(r[0])) return "缺菌名"; if(A.ABG_BAD[r[0]]&&!/數值異常・請確認/.test(t)) return "異常值未標示";
    if(r[2]<30&&!/株數 <30，數字不穩定/.test(t)) return "<30 株未標示"; if(r[4].PENm!==undefined&&!/腦膜炎/.test(t)) return "缺腦膜炎判讀"; return ""; });
  // 比較表：院內區塊數值與資料一致
  run("abg-cmp",{tab:"spec",spec:{view:"cmp",cmp:["cro","mem"]}},()=>A.render("spec"),t=>/院內感受率/.test(t)&&/E\. coli 1058 68\.7 99\.1/.test(t)?"":"比較表院內區塊錯");
  // 門檻邊界（IDSA cUTI 2025：敗血症 ≥80%、休克 ≥90%；IDSA/ESCMID 2010：TMP-SMX 抗藥 ≤20%）——暫改資料測 ≥／<
  const row=o=>R.find(r=>r[0]===o)[4], EC=row("Escherichia coli"), KP=row("Klebsiella pneumoniae"), keep={ec:{...EC},kp:{...KP}};
  const hasW=(o,re)=>{ set(o); const h=A.render("emp"); return (h.match(/<div class="cond abgw">[\s\S]*?<\/div>/g)||[]).some(x=>re.test(x.replace(/<[^>]+>/g,""))); };
  const B=[[()=>{EC.CRO=80;KP.CRO=80;},{sys:"gu",sub:"pyelo",sev:"sepsis"},/ceftriaxone/,false,"敗血症 80% 應不提示"],[()=>{EC.CRO=79.9;},{sys:"gu",sub:"pyelo",sev:"sepsis"},/ceftriaxone/,true,"敗血症 79.9% 應提示"],
    [()=>{EC.MEM=90;KP.MEM=90;},{sys:"gu",sub:"pyelo",sev:"shock"},/meropenem/,false,"休克 90% 應不提示"],[()=>{KP.MEM=89.9;},{sys:"gu",sub:"pyelo",sev:"shock"},/meropenem/,true,"休克 89.9% 應提示"],
    [()=>{EC.SXT=80;},{sys:"gu",sub:"cys"},/Rec 2/,false,"TMP-SMX 抗藥 20% 應不提示"],[()=>{EC.SXT=79.9;},{sys:"gu",sub:"cys"},/Rec 2/,true,"TMP-SMX 抗藥 20.1% 應提示"],
    [()=>{EC.CIP=90;},{sys:"gu",sub:"pyelo",sev:"none"},/Rec 9/,false,"FQ 抗藥 10% 應不提示"],[()=>{EC.CIP=89.9;},{sys:"gu",sub:"pyelo",sev:"none"},/Rec 9/,true,"FQ 抗藥 10.1% 應提示"]];
  for(const [mut,o,re,want,m] of B){ n++; mut(); const got=hasW(Object.assign({tab:"emp"},o),re); if(got!==want) fails.push(["abg-edge",o,m]); }
  Object.assign(EC,keep.ec); Object.assign(KP,keep.kp);
  // 過期：期末後 12 個月內不提示，超過則提示且不出門檻警示
  A.setNow(()=>new Date("2027-03-30T12:00:00+08:00")); run("abg-stale",{tab:"spec",spec:{view:"abg"}},()=>A.render("spec"),t=>/可能過期/.test(t)?"12 個月內誤報過期":"");
  A.setNow(()=>new Date("2027-04-02T12:00:00+08:00"));
  run("abg-stale",{tab:"spec",spec:{view:"abg"}},()=>A.render("spec"),t=>/可能過期/.test(t)?"":"超過 12 個月未提示");
  run("abg-stale",{tab:"emp",sys:"gu",sub:"cys"},()=>A.render("emp"),(t,h)=>/cond abgw/.test(h)?"過期仍出現門檻提示":"");
  A.setNow(()=>new Date());
}

const by={}; for(const f of fails){const k=f[0].split("#")[0]+" | "+f[2].slice(0,90);(by[k]=by[k]||[]).push(f[1]);}
console.log("FUZZ TOTAL",n,"FAILS",fails.length);
for(const [k,v] of Object.entries(by)) console.log(v.length+"× "+k+"\n  e.g. "+JSON.stringify(v[0]).slice(0,240));
process.exit(fails.length?1:0);
