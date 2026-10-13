/* Stats tab: dated counters for reviews and every Apply activity, compared over
   the last 30 days, the 30 days before, and all time.
   Storage: the same per-user practice record as practice.js, under `days`:
     days["YYYY-MM-DD"] = { rv:{n,ok}, tr:{n,ok}, cl:{n,ok}, cs:{n,ok}, jw:{n}, m: masteredCount }
   `days.legacy` holds totals from before dated logging began; it counts toward all time only. */
(function(){
"use strict";

const GOLD="#D9B45E", INK="#EEE8D5", SAGE="#8DB5A5", ROSE="#F07A7A", MINT="#5FD3A0";
const AMIRI="font-family:'Amiri',serif;direction:rtl;";
// Mastered-word milestones. Rough vocabulary-size guideposts, not a proficiency test; edit freely.
const LADDER=[250,500,1000,2000,3500,5000,8000];
const KINDS=[
  ["rv","Reviews","recalled"],
  ["tr","Translate","scored 4–5"],
  ["cl","Cloze","correct"],
  ["cs","Case endings","correct"],
];
const pkey=()=>`mufradat-practice-${CU.username}`;
const rec=()=>{const d=gLS(pkey())||{};d.days=d.days||null;return d;};
const mastered=()=>bw().filter(w=>w.leitnerLevel==="M"&&w.english).length;
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// First run after this feature ships: fold the old running totals into one undated bucket.
function ensure(d){
  if(d.days)return d;
  const tr=d.tr||{},cs=d.cs||{},cl=d.cl||{};
  const jw=(d.j||[]).reduce((a,e)=>a+(e.words||0),0);
  d.days={legacy:{
    tr:{n:tr.n||0,ok:tr.good||0},cs:{n:cs.words||0,ok:cs.ok||0},cl:{n:cl.n||0,ok:cl.ok||0},jw:{n:jw}}};
  return d;
}
window.statsLog=function(kind,n,ok){
  try{
    if(typeof CU==="undefined"||!CU)return;
    const d=ensure(rec()),k=dayKey();
    const day=d.days[k]||(d.days[k]={});
    const c=day[kind]||(day[kind]={n:0,ok:0});
    c.n+=n;c.ok+=ok||0;
    day.m=mastered();
    sLS(pkey(),d);
  }catch(e){}
};
// Record today's mastered count even on days with no activity.
function snapshot(d){
  const k=dayKey(),day=d.days[k]||(d.days[k]={});
  const m=mastered();
  if(day.m!==m){day.m=m;sLS(pkey(),d);}
}

const addDays=(key,n)=>{const[y,m,dd]=key.split("-").map(Number);const t=new Date(y,m-1,dd);t.setDate(t.getDate()+n);
  return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");};
function sumRange(days,kind,from,to){ // from < date <= to  (null = open)
  let n=0,ok=0;
  for(const k in days){
    if(k==="legacy"){if(from!==null)continue;}
    else{if(from!==null&&k<=from)continue;if(to!==null&&k>to)continue;}
    const c=days[k][kind];if(c){n+=c.n||0;ok+=c.ok||0;}
  }
  return{n,ok};
}
const pct=(c)=>c.n?Math.round(c.ok/c.n*100):null;

function cell(c,trend){
  if(!c.n)return`<td style="padding:8px 4px;text-align:center;color:${SAGE}">–</td>`;
  const p=pct(c);
  return`<td style="padding:8px 4px;text-align:center"><div style="font-size:15px;font-weight:600;color:${INK}">${p}%${trend||""}</div><div style="font-size:10px;color:${SAGE}">${c.n.toLocaleString()}</div></td>`;
}
function trendOf(cur,prev){
  if(cur.n<10||prev.n<10)return"";
  const d=pct(cur)-pct(prev);
  if(d>=3)return` <span style="color:${MINT};font-size:11px">▲</span>`;
  if(d<=-3)return` <span style="color:${ROSE};font-size:11px">▼</span>`;
  return` <span style="color:${SAGE};font-size:11px">▬</span>`;
}
const tile=(v,l,sub)=>`<div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:12px;padding:12px 14px">
  <div style="font-size:24px;font-weight:600;color:${INK};line-height:1.2">${v}</div><div style="font-size:11px;color:${SAGE}">${l}</div>${sub?`<div style="font-size:10px;color:${GOLD};margin-top:2px">${sub}</div>`:""}</div>`;

window.rStats=function(){
  const d=ensure(rec());
  snapshot(d);
  const days=d.days,today=dayKey();
  const c30=addDays(today,-30),c60=addDays(today,-60);
  const W=(kind)=>({cur:sumRange(days,kind,c30,today),prev:sumRange(days,kind,c60,c30),all:sumRange(days,kind,null,null)});
  const rows=KINDS.map(([k,l,note])=>({k,l,note,...W(k)}));
  const comp=(sel)=>rows.reduce((a,r)=>({n:a.n+r[sel].n,ok:a.ok+r[sel].ok}),{n:0,ok:0});
  const cur=comp("cur"),prev=comp("prev"),all=comp("all");
  const jw=W("jw");
  const m=mastered(),total=bw().length;
  const next=LADDER.find(x=>x>m),prevL=[...LADDER].reverse().find(x=>x<=m)||0;
  const lp=next?Math.round((m-prevL)/(next-prevL)*100):100;

  // mastered growth: last 90 days of snapshots
  const start=addDays(today,-90);
  const pts=Object.keys(days).filter(k=>k!=="legacy"&&k>=start&&days[k].m!=null).sort().map(k=>[k,days[k].m]);
  let spark=`<div style="font-size:12px;color:${SAGE}">The growth line fills in as you use the app. Mastered counts are recorded once a day starting today.</div>`;
  if(pts.length>=2){
    const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1])),span=Math.max(1,hi-lo);
    const t0=new Date(pts[0][0]).getTime(),t1=new Date(pts[pts.length-1][0]).getTime(),ts=Math.max(1,t1-t0);
    const xy=pts.map(([k,v])=>[(new Date(k).getTime()-t0)/ts*280+10,50-((v-lo)/span)*40]);
    const line=xy.map(p=>p.join(",")).join(" ");
    const last=xy[xy.length-1];
    spark=`<svg viewBox="0 0 300 64" style="width:100%;height:84px" role="img" aria-label="Mastered words over time">
      <polygon points="${xy[0][0]},56 ${line} ${last[0]},56" fill="rgba(217,180,94,0.12)"/>
      <polyline points="${line}" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${GOLD}"/>
      <text x="10" y="63" font-size="9" fill="${SAGE}">${esc(pts[0][0])}: ${pts[0][1]}</text>
      <text x="290" y="63" font-size="9" fill="${SAGE}" text-anchor="end">${esc(pts[pts.length-1][0])}: ${pts[pts.length-1][1]}</text></svg>`;
  }

  // activity strip: last 28 days
  const strip=Array.from({length:28}).map((_,i)=>{
    const k=addDays(today,-(27-i)),day=days[k]||{};
    const n=KINDS.reduce((a,[kk])=>a+((day[kk]&&day[kk].n)||0),0)+((day.jw&&day.jw.n)?1:0);
    const lv=n===0?0:n<10?1:n<30?2:n<60?3:4;
    const col=["rgba(255,255,255,0.06)","rgba(217,180,94,0.25)","rgba(217,180,94,0.45)","rgba(217,180,94,0.7)","#D9B45E"][lv];
    return`<div title="${k}: ${n}" style="width:10px;height:22px;border-radius:3px;background:${col}${k===today?";outline:1px solid "+INK:""}"></div>`;
  }).join("");

  // weakest case endings
  const lab=(d.cs&&d.cs.byLabel)||{};
  const NAMES={nom:"Nominative",acc:"Accusative",gen:"Genitive",ind:"Indicative",sub:"Subjunctive",jus:"Jussive"};
  const weak=Object.entries(lab).filter(([,x])=>x.n>=5).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n).slice(0,3);

  const head=`<th style="padding:4px;font-size:10px;font-weight:600;color:${SAGE};text-transform:uppercase;letter-spacing:.06em;text-align:center">`;
  return`<div style="font-family:'Mirza','Amiri',serif;direction:rtl;font-size:26px;color:${GOLD};text-align:right;margin-bottom:6px">إِحْصَاءَاتٌ</div>
  <div style="font-size:12px;color:${SAGE};margin-bottom:16px">How much you practice and how well it goes, now against before.</div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px">
    ${tile(m.toLocaleString(),"mastered words",total?`${Math.round(m/total*100)}% of ${total.toLocaleString()} cards`:"")}
    ${tile(cur.n.toLocaleString(),"items, last 30 days",`${all.n.toLocaleString()} all time`)}
    ${tile(pct(cur)!=null?pct(cur)+"%":"–","accuracy, 30 days",pct(all)!=null?`${pct(all)}% all time`:"")}
  </div>

  ${sh("30 days against before")}
  <div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:14px;padding:8px 10px;margin-bottom:6px;overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <colgroup><col style="width:31%"><col><col><col></colgroup>
    <tr><th></th>${head}Last 30</th>${head}Before</th>${head}All time</th></tr>
    ${rows.map(r=>`<tr style="border-top:1px solid rgba(217,180,94,0.1)"><td style="padding:8px 4px;font-size:12px;color:${INK}">${r.l}<div style="font-size:10px;color:${SAGE}">${r.note}</div></td>${cell(r.cur,trendOf(r.cur,r.prev))}${cell(r.prev)}${cell(r.all)}</tr>`).join("")}
    <tr style="border-top:2px solid rgba(217,180,94,0.25)"><td style="padding:8px 4px;font-size:12px;font-weight:600;color:${GOLD}">Everything<div style="font-size:10px;color:${SAGE};font-weight:400">pooled</div></td>${cell(cur,trendOf(cur,prev))}${cell(prev)}${cell(all)}</tr>
    <tr style="border-top:1px solid rgba(217,180,94,0.1)"><td style="padding:8px 4px;font-size:12px;color:${INK}">Journal<div style="font-size:10px;color:${SAGE}">words written</div></td>
      ${[jw.cur,jw.prev,jw.all].map(c=>`<td style="padding:8px 4px;text-align:center;font-size:15px;font-weight:600;color:${c.n?INK:SAGE}">${c.n?c.n.toLocaleString():"–"}</td>`).join("")}</tr>
  </table></div>
  <div style="font-size:11px;color:${SAGE};margin-bottom:18px">Counts sit under each percentage. ▲ ▼ show a change of 3 points or more against the 30 days before, once both have 10+ items. Earlier practice from before this tab existed counts toward all time only. Reviews are counted from the day this tab shipped.</div>

  ${sh("Mastered words")}
  <div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:14px;padding:14px 16px;margin-bottom:6px">
    ${spark}
    <div style="display:flex;justify-content:space-between;font-size:12px;color:${SAGE};margin:12px 0 6px"><span>${prevL?prevL.toLocaleString()+" words":"Start"}</span><span>${next?`next: ${next.toLocaleString()}`:"top of the ladder"}</span></div>
    <div style="height:8px;border-radius:5px;background:rgba(255,255,255,0.08);overflow:hidden"><div style="width:${lp}%;height:100%;background:${GOLD}"></div></div>
  </div>
  <div style="font-size:11px;color:${SAGE};margin-bottom:18px">Milestones: ${LADDER.map(x=>x<=m?`<span style="color:${GOLD}">${x.toLocaleString()} ✓</span>`:x.toLocaleString()).join(" · ")}. A rough vocabulary-size ladder, not a proficiency score.</div>

  ${sh("Last 28 days")}
  <div style="display:flex;gap:3px;margin-bottom:4px;overflow-x:auto">${strip}</div>
  <div style="font-size:11px;color:${SAGE};margin-bottom:18px">Each bar is a day, darker for more items. Today is outlined.</div>

  ${weak.length?`${sh("Weakest case endings")}${weak.map(([k,x])=>`<div style="display:grid;grid-template-columns:110px 1fr 54px;gap:10px;align-items:center;font-size:12px;color:${INK};padding:4px 0">
    <span>${NAMES[k]||k}</span><div style="height:8px;border-radius:5px;background:rgba(255,255,255,0.08);overflow:hidden"><div style="width:${Math.round(x.ok/x.n*100)}%;height:100%;background:${x.ok/x.n>=0.85?MINT:x.ok/x.n>=0.65?GOLD:ROSE}"></div></div>
    <span style="color:${SAGE}">${Math.round(x.ok/x.n*100)}% · ${x.n}</span></div>`).join("")}`:""}`;
};
})();
