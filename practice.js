/* Apply tab: Translate and Case Endings practice, built from your Mastered box.
   Loaded after index.html's main script; uses its globals (bw, R, gLS, sLS, toast, sh, CU, applyDialect). */
(function(){
"use strict";

const WORKER="https://tiny-sound-c8ff.jmorgansmith03.workers.dev";
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const AMIRI="font-family:'Amiri',serif;direction:rtl;";
const GOLD="#D9B45E", INK="#EEE8D5", SAGE="#8DB5A5", ROSE="#F07A7A", MINT="#5FD3A0";

/* ---------- storage ---------- */
const pkey=()=>`mufradat-practice-${CU.username}`;
function store(){
  const d=gLS(pkey())||{};
  d.tr=d.tr||{n:0,sum:0,good:0,byFocus:{}};
  d.cs=d.cs||{sent:0,words:0,ok:0,byLabel:{},byRule:{}};
  return d;
}
const save=d=>sLS(pkey(),d);

/* ---------- AI ---------- */
async function ai(system,user,max){
  const apiKey=(gLS(`mufradat-apikey-${CU.username}`)||"").replace(/^["']|["']$/g,"");
  if(!apiKey)throw new Error("No API key. Add it in Settings.");
  if(!navigator.onLine)throw new Error("This needs a connection.");
  const res=await fetch(WORKER,{method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:max||1800,messages:[{role:"user",content:system+"\n\n"+user}]})});
  const data=await res.json();
  if(data.error)throw new Error(data.error.message||"API error");
  const raw=(data.content||[]).map(c=>c.text||"").join("");
  let s=raw.replace(/```json|```/g,"").trim();
  const a=s.indexOf("{"),b=s.lastIndexOf("}");
  if(a<0||b<0)throw new Error("parse");
  s=s.slice(a,b+1).split("\n").join(" ").split("\r").join(" ");
  try{return JSON.parse(s);}catch(e){}
  // salvage a response that was cut off mid-list
  let i=s.lastIndexOf("}");
  while(i>0){
    for(const tail of ["]}","}]}","]}]}"]){try{return JSON.parse(s.slice(0,i+1)+tail);}catch(e){}}
    i=s.lastIndexOf("}",i-1);
  }
  throw new Error("parse");
}

/* ---------- mastered pool ---------- */
const strip=t=>String(t||"").replace(/[ً-ٰٟـ]/g,"");
const norm=t=>strip(t).replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[.,،؟?!؛:«»"'()\[\]…—–]/g," ").replace(/\s+/g," ").trim();
function pool(){return bw().filter(w=>w.leitnerLevel==="M"&&(w.dialect||"MSA")===applyDialect&&w.arabic&&w.english);}
function sample(arr,n){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a.slice(0,n);
}
const vName=v=>v==="MSA"?"Modern Standard Arabic (Fusha)":v==="Shaami"?"Levantine (Shaami) colloquial Arabic":v==="Darija"?"Moroccan Darija":v+" colloquial Arabic";
const headWord=w=>String(w.arabic).split(" · ")[0];
function usedIn(text,w){
  const t=" "+norm(text)+" ", h=norm(headWord(w)).replace(/^ال/,"");
  return h.length>=2&&t.includes(h);
}
const notice=(msg,c)=>`<div style="padding:12px 14px;background:rgba(217,180,94,0.07);border:1px solid rgba(217,180,94,0.2);border-radius:10px;margin-bottom:14px;font-size:12px;color:${c||SAGE}">${msg}</div>`;
const chip=(label,on,fn)=>`<div onclick="${fn}" style="background:${on?"rgba(217,180,94,0.12)":"var(--panel)"};border:1px solid ${on?GOLD:"rgba(217,180,94,0.12)"};border-radius:20px;padding:6px 12px;cursor:pointer;font-size:12px;color:${on?GOLD:INK}">${label}</div>`;
const seg=(opts,cur,fn)=>`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${opts.map(([v,l])=>chip(l,cur===v,`${fn}(${typeof v==="number"?v:`'${v}'`})`)).join("")}</div>`;
const scoreBar=n=>`<span style="display:inline-flex;gap:3px">${[1,2,3,4,5].map(i=>`<i style="width:10px;height:10px;border-radius:3px;display:block;background:${i<=n?(n>=4?MINT:n===3?GOLD:ROSE):"rgba(255,255,255,0.12)"}"></i>`).join("")}</span>`;
const corrList=items=>items.map(c=>`<div style="border-bottom:1px solid rgba(217,180,94,0.12);padding:8px 0">
  <div style="${AMIRI}font-size:18px;text-align:right"><s style="color:${ROSE}">${esc(c.wrong)}</s> <span style="color:${SAGE};font-size:13px">←</span> <b style="color:${MINT}">${esc(c.right)}</b></div>
  <div style="font-size:12px;color:${SAGE};margin-top:3px">${esc(c.why)}</div></div>`).join("");
const card=inner=>`<div style="background:var(--panel);border:1px solid rgba(217,180,94,0.22);border-radius:16px;padding:18px;margin-top:16px">${inner}</div>`;

/* =====================================================================
   TRANSLATE
   ===================================================================== */
const TR_FOCUS=[["hypo","Hypotheticals (لَوْ… لَـ)"],["compare","Comparison"],["argue","Argument & opinion"],["narr","Past narration"],["desc","Description"],["haal","Haal clauses (الحال)"],["relative","Relative clauses"],["passive","Passive voice"],["numbers","Numbers"],["mixed","Mixed bag"]];
const trSt={focus:"hypo",level:2,count:3,batch:null,busy:"",err:"",attempt:"",hint:false};

const trGenSys=(focus,v,level,count)=>`You write English sentences for an intermediate-advanced Arabic learner to translate into ${vName(v)}.
Target structure or skill: ${focus}.
Difficulty ${level} of 3 (1 = short everyday sentence, 2 = two clauses, 3 = multi-clause, formal or nuanced).
The user message includes a numbered list of words the learner has MASTERED. Build each sentence so that its natural translation uses 1 or 2 words from the list (different words in different sentences). Never mention the Arabic words in the English sentence or in the hint. The sentence must still require the target structure, and it must sound natural and useful.
Return ONLY JSON, no fences: {"items":[{"en":"English sentence","hint":"short structural hint in English naming the Arabic structure to use; never give the full answer","uses":[list numbers]}]} with exactly ${count} item${count===1?"":"s"}.`;
const trCheckSys=v=>`You are a precise but encouraging Arabic coach grading a translation into ${vName(v)}. The learner is intermediate-advanced and is working on SENTENCE STRUCTURE.
Judge meaning and structure. Accept any natural, correct translation and never penalize a valid alternative phrasing.${v==="MSA"?" Flag dialect intrusions as register mixing.":" Do not convert the answer to Fusha."}
Return ONLY JSON, no fences:
{"score":1-5 (5 native-like, 4 correct with minor issues, 3 understandable with structural errors, 2 major errors, 1 off),
"verdict":"one short English sentence",
"model":"the best natural translation, full diacritics",
"alt":"optional second natural version with diacritics, or empty",
"structure":"1-2 English sentences on the key structure: what they did well or what was missing",
"corrections":[{"wrong":"exact snippet from the learner","right":"corrected snippet with diacritics","why":"short English explanation"}]}
At most 6 corrections. Empty array if none.`;

window.trSet=(k,v)=>{trSt[k]=v;R();};
window.trAttempt=v=>{trSt.attempt=v;};
window.trHint=()=>{trSt.hint=true;R();};

window.trStart=async function(){
  const p=pool();
  if(p.length<3){toast("Master at least 3 "+applyDialect+" words first",GOLD);return;}
  trSt.busy="gen";trSt.err="";trSt.attempt="";trSt.hint=false;R();
  try{
    const picked=sample(p,Math.min(12,trSt.count*2+4));
    const f=TR_FOCUS.find(x=>x[0]===trSt.focus);
    const r=await ai(trGenSys(f[1],applyDialect,trSt.level,trSt.count),
      "MASTERED VOCABULARY (numbered):\n"+picked.map((w,i)=>`${i+1}. ${headWord(w)} = ${w.english}`).join("\n"),2000);
    const items=(r.items||[]).filter(x=>x&&x.en).slice(0,trSt.count).map(x=>({
      en:x.en,hint:x.hint||"",
      words:(Array.isArray(x.uses)?x.uses:[]).map(n=>picked[(+n)-1]).filter(Boolean)}));
    if(!items.length)throw new Error("empty");
    trSt.batch={items,idx:0,focus:f[1],variety:applyDialect,result:null,attempt:"",scores:[]};
  }catch(e){trSt.err=e.message==="parse"||e.message==="empty"?"Couldn't generate sentences. Try again.":e.message;}
  trSt.busy="";R();
};
window.trCheck=async function(){
  const b=trSt.batch,item=b&&b.items[b.idx];
  if(!item||!trSt.attempt.trim())return;
  trSt.busy="check";trSt.err="";R();
  try{
    const r=await ai(trCheckSys(b.variety),`English: ${item.en}\nLearner's translation: ${trSt.attempt.trim()}`+
      (item.words.length?`\nIntended vocabulary (not required, accept alternatives): ${item.words.map(headWord).join("، ")}`:""),1400);
    const res={score:Math.max(1,Math.min(5,Math.round(+r.score)||1)),verdict:r.verdict||"",model:r.model||"",alt:r.alt||"",
      structure:r.structure||"",corrections:Array.isArray(r.corrections)?r.corrections.slice(0,6):[]};
    b.result=res;b.attempt=trSt.attempt.trim();b.scores.push(res.score);
    window.statsLog&&statsLog("tr",1,res.score>=4?1:0);
    const d=store();
    d.tr.n++;d.tr.sum+=res.score;if(res.score>=4)d.tr.good++;
    const f=d.tr.byFocus[b.focus]||(d.tr.byFocus[b.focus]={n:0,sum:0});f.n++;f.sum+=res.score;
    save(d);
  }catch(e){trSt.err=e.message==="parse"?"Couldn't grade that one. Try again.":e.message;}
  trSt.busy="";R();
};
window.trNext=function(){
  const b=trSt.batch;b.idx++;b.result=null;b.attempt="";trSt.attempt="";trSt.hint=false;R();
};

function rTranslate(hasKey){
  const p=pool(),b=trSt.batch,d=store().tr;
  const done=b&&b.idx>=b.items.length,item=b&&!done?b.items[b.idx]:null,res=b&&b.result;
  const focusSel=`<label class="lbl">Focus</label><select class="inp" style="cursor:pointer;font-size:13px;padding:10px 12px;margin-bottom:12px" onchange="trSet('focus',this.value)">
    ${TR_FOCUS.map(([id,l])=>`<option value="${id}"${id===trSt.focus?" selected":""}>${l}</option>`).join("")}</select>`;
  const setup=`
    ${p.length<3?notice(`You have <strong style="color:${GOLD}">${p.length}</strong> mastered ${esc(applyDialect)} words. Master at least 3 to build sentences from them.`):
      notice(`Sentences are built from your <strong style="color:${GOLD}">${p.length}</strong> mastered ${esc(applyDialect)} words, so you use them in context.`)}
    ${!hasKey?notice("No API key. <span style=\"cursor:pointer;text-decoration:underline\" onclick=\"V('settings')\">Add it in Settings</span>",ROSE):""}
    ${focusSel}
    <label class="lbl">Difficulty</label>${seg([[1,"Everyday"],[2,"Intermediate"],[3,"Advanced"]],trSt.level,"trLevel")}
    <label class="lbl">Sentences</label>${seg([[1,"1"],[3,"3"],[5,"5"]],trSt.count,"trCount")}
    <button class="btn1" onclick="trStart()" style="width:100%;justify-content:center"${!hasKey||p.length<3||trSt.busy?" disabled":""}>${trSt.busy==="gen"?'<span class="spinner"></span>Writing sentences...':(b?"New set":"Start")}</button>`;
  let body="";
  if(item){
    body=card(`
      <div style="font-size:11px;color:${SAGE};margin-bottom:8px">${b.items.length>1?`${b.idx+1} of ${b.items.length} · `:""}${esc(b.focus)} · ${esc(b.variety)}</div>
      <div style="font-size:20px;line-height:1.5;color:${INK};margin-bottom:12px">${esc(item.en)}</div>
      ${trSt.hint?`<div style="font-size:13px;color:${GOLD};background:rgba(217,180,94,0.08);border-radius:8px;padding:8px 10px;margin-bottom:12px">${esc(item.hint)}</div>`
        :`<div style="font-size:12px;color:${GOLD};cursor:pointer;margin-bottom:12px" onclick="trHint()">Show hint</div>`}
      <textarea class="inp" dir="rtl" style="${AMIRI}font-size:20px;min-height:100px;width:100%" placeholder="تَرْجِمْ هُنا…"${res?" disabled":""} oninput="trAttempt(this.value)">${esc(res?b.attempt:trSt.attempt)}</textarea>
      ${!res?`<button class="btn1" style="width:100%;justify-content:center;margin-top:10px" onclick="trCheck()"${trSt.busy?" disabled":""}>${trSt.busy==="check"?'<span class="spinner"></span>Grading...':"Check"}</button>`:`
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;color:${INK}">${scoreBar(res.score)}<span style="font-size:13px">${esc(res.verdict)}</span></div>
          <div style="${AMIRI}font-size:21px;line-height:1.9;text-align:right;color:${INK}">${esc(res.model)}</div>
          ${res.alt?`<div style="${AMIRI}font-size:17px;text-align:right;color:${SAGE}">${esc(res.alt)}</div>`:""}
          ${item.words.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="font-size:11px;color:${SAGE}">Words in play</span>
            ${item.words.map(w=>{const ok=usedIn(b.attempt,w);return`<span style="border:1px solid ${ok?"rgba(95,211,160,0.5)":"rgba(217,180,94,0.25)"};border-radius:20px;padding:2px 10px;font-size:12px;color:${ok?MINT:SAGE}"><span style="${AMIRI}font-size:16px">${esc(headWord(w))}</span> ${esc(w.english)}${ok?" ✓":""}</span>`;}).join("")}</div>`:""}
          ${res.structure?`<div style="font-size:13px;color:${INK};border-left:3px solid ${GOLD};padding-left:10px">${esc(res.structure)}</div>`:""}
          ${res.corrections.length?corrList(res.corrections):""}
          <button class="btn1" style="width:100%;justify-content:center" onclick="trNext()">${b.idx+1<b.items.length?"Next sentence":"Finish"}</button>
        </div>`}
    `);
  } else if(done){
    const avg=(b.scores.reduce((a,x)=>a+x,0)/Math.max(1,b.scores.length)).toFixed(1);
    body=card(`<div style="text-align:center"><div style="${AMIRI}font-size:36px;color:${MINT}">أَحْسَنْتَ!</div>
      <div style="font-size:13px;color:${INK};margin-top:6px">Set complete, averaging ${avg}. Start another or change the focus.</div></div>`);
  }
  if(trSt.err)body=`<div style="font-size:12px;color:${ROSE};margin-top:12px">${esc(trSt.err)}</div>`+body;
  const stats=d.n?`<div style="font-size:11px;color:${SAGE};margin-top:18px">All time: ${d.n} sentence${d.n===1?"":"s"} translated, average ${(d.sum/d.n).toFixed(1)}, ${d.good} scored 4 or 5.</div>`:"";
  return setup+body+stats;
}
window.trLevel=v=>{trSt.level=v;R();};
window.trCount=v=>{trSt.count=v;R();};

/* =====================================================================
   CASE ENDINGS (إعراب)
   ===================================================================== */
const RULES=[
 {id:"R01",level:1,labels:["nom"],en:"Subject and predicate of a nominal sentence",why:{nom:"Subject or predicate of a nominal sentence → nominative"}},
 {id:"R02",level:1,labels:["nom"],en:"Doer of a verb (or subject of a passive verb)",why:{nom:"Doer of the verb (or subject of a passive verb) → nominative"}},
 {id:"R03",level:1,labels:["acc"],en:"Direct object",why:{acc:"Direct object of the verb → accusative"}},
 {id:"R04",level:1,labels:["gen"],en:"Object of a preposition",why:{gen:"Object of a preposition → genitive"}},
 {id:"R05",level:1,labels:["gen"],en:"Second term of an idafa",why:{gen:"Second term of an idafa (also after بعد، مع، عند…) → genitive"}},
 {id:"R06",level:1,labels:["nom","acc","gen"],en:"Adjectives and و-joined nouns",why:{nom:"Follows a nominative word → nominative",acc:"Follows an accusative word → accusative",gen:"Follows a genitive word → genitive"}},
 {id:"R07",level:1,labels:["ind"],en:"Present verb in the indicative",why:{ind:"Present verb with no particle governing it → indicative"}},
 {id:"R08",level:2,labels:["nom","acc"],en:"Kana and her sisters",why:{nom:"Subject of كان or a sister → nominative",acc:"Predicate of كان or a sister → accusative"}},
 {id:"R09",level:2,labels:["acc","nom"],en:"Inna and her sisters",why:{acc:"Subject of إنّ or a sister → accusative",nom:"Predicate of إنّ or a sister → nominative"}},
 {id:"R10",level:2,labels:["acc"],en:"Adverbs, hal, tamyiz, exception",why:{acc:"Adverb, hal, tamyiz, or noun after إلا in a complete affirmative sentence → accusative"}},
 {id:"R11",level:2,labels:["sub"],en:"Present verb in the subjunctive",why:{sub:"After أنْ، لنْ، كي، لـ or حتى → subjunctive"}},
 {id:"R12",level:2,labels:["jus"],en:"Present verb in the jussive",why:{jus:"After لم، لا of prohibition, لام الأمر, or in a condition → jussive"}},
 {id:"R13",level:2,labels:["acc"],marks:{acc:["kasra","kasratan"]},en:"Sound feminine plural in the accusative",why:{acc:"Sound feminine plural in the accusative → kasra instead of fatha"}},
 {id:"R14",level:3,labels:["gen"],marks:{gen:["fatha"]},en:"Diptote in the genitive",why:{gen:"Diptote in the genitive (no ال, no idafa) → fatha, no tanwin"}},
 {id:"R15",level:3,labels:["acc","jus"],marks:{jus:["damma","fatha","kasra"]},en:"Defective nouns and verbs",why:{acc:"Defective noun in the accusative → the fatha shows on its ي",jus:"Defective verb in the jussive → the long vowel drops and the short vowel before it stays"}},
];
const RULE=Object.fromEntries(RULES.map(r=>[r.id,r]));
const LABEL_MARKS={nom:["damma","dammatan"],acc:["fatha","fathatan"],gen:["kasra","kasratan"],ind:["damma"],sub:["fatha"],jus:["sukun"]};
const LABELS={nom:["Nominative","مَرْفُوع"],acc:["Accusative","مَنْصُوب"],gen:["Genitive","مَجْرُور"],ind:["Indicative","مَرْفُوع"],sub:["Subjunctive","مَنْصُوب"],jus:["Jussive","مَجْزُوم"]};
const FAM={nom:"nominative",acc:"accusative",gen:"genitive",ind:"indicative",sub:"subjunctive",jus:"jussive"};
const CM={fathatan:"ً",dammatan:"ٌ",kasratan:"ٍ",fatha:"َ",damma:"ُ",kasra:"ِ",shadda:"ّ",sukun:"ْ"};
const MARK_NAME={"ً":"fathatan","ٌ":"dammatan","ٍ":"kasratan","َ":"fatha","ُ":"damma","ِ":"kasra","ْ":"sukun"};
const VOWEL_OF={damma:"u",dammatan:"u",fatha:"a",fathatan:"a",kasra:"i",kasratan:"i",sukun:"o"};
const isLetter=c=>/[ء-غف-يٱ]/.test(c);
const isMark=c=>/[ً-ٰٟ]/.test(c);
const splitWords=t=>String(t||"").trim().split(/\s+/).filter(Boolean);
const trimP=w=>String(w||"").replace(/[.,،؟?!؛:«»"'()]+$/g,"").replace(/^[«"'(]+/,"");

function lettersOf(word){
  const out=[];
  for(const ch of String(word||"")){
    if(isLetter(ch))out.push({ch,marks:[]});
    else if(isMark(ch)&&out.length)out[out.length-1].marks.push(ch);
  }
  return out;
}
function caseOf(marks){
  const s=[...new Set((marks||[]).filter(m=>MARK_NAME[m]))];
  if(!s.length)return null;
  if(s.length>1)return{name:"multi",v:"x",tan:false};
  const name=MARK_NAME[s[0]];
  return{name,v:VOWEL_OF[name],tan:/tan$/.test(name)};
}
function defaultPos(L){
  const n=L.length;
  if(n>=2&&L[n-1].ch==="ا"&&L[n-2].marks.includes(CM.fathatan))return n-2;
  return n-1;
}
const hasAl=base=>/^(?:[وف])?(?:[بك])?ال/.test(base)||/^(?:[وف])?لل/.test(base);
const allowedMarks=(rule,label)=>(rule.marks&&rule.marks[label])||LABEL_MARKS[label];

// Key check: a generated item only reaches the learner if every graded ending is internally consistent.
function validateItem(it){
  const errs=[];
  if(!it||typeof it!=="object")return{ok:false,errors:["not an object"]};
  const{lvl,v,en,g}=it;
  if(![1,2,3].includes(lvl))errs.push("lvl");
  if(typeof v!=="string"||!/[ء-ي]/.test(v))return{ok:false,errors:["v missing"]};
  if(typeof en!=="string"||!en.trim())errs.push("en missing");
  if(/[ً-ٰٟ]/.test(strip(v)))errs.push("strip leaves marks");
  if(!/[ً-ٰٟ]/.test(v))errs.push("no diacritics");
  if(!Array.isArray(g)||!g.length)return{ok:false,errors:["g empty"]};
  if(g.length>10)errs.push("too many graded");
  const words=splitWords(v);
  words.forEach((w,wi)=>lettersOf(w).forEach(l=>{if(l.ch==="ا"&&l.marks.includes(CM.fathatan))errs.push(`w${wi}: fathatan on alef`);}));
  const resolved=[],seen=new Set(),tagged={};
  for(let e of g){
    if(Array.isArray(e)&&e.length===3)e=[...e,-1];
    if(!Array.isArray(e)||e.length!==4){errs.push("bad g entry");continue;}
    let[wi,lab,rid,pos]=e;
    if(!Number.isInteger(wi)||wi<0||wi>=words.length){errs.push("wordIdx range");continue;}
    if(seen.has(wi)){errs.push(`w${wi}: twice`);continue;}
    seen.add(wi);
    if(!LABELS[lab]){errs.push("bad label");continue;}
    const r=RULE[rid];
    if(!r||!r.labels.includes(lab)){errs.push(`w${wi}: rule/label`);continue;}
    const L=lettersOf(words[wi]);
    if(!L.length){errs.push(`w${wi}: no letters`);continue;}
    if(pos===null||pos===undefined||pos===-1)pos=defaultPos(L);
    if(!Number.isInteger(pos)||pos<0||pos>=L.length){errs.push(`w${wi}: pos`);continue;}
    const{ch,marks}=L[pos],c=caseOf(marks);
    if(!c||c.name==="multi"){errs.push(`w${wi}: mark`);continue;}
    if(!allowedMarks(r,lab).includes(c.name))errs.push(`w${wi}: ${c.name} vs ${lab}`);
    if(ch==="ى"||ch==="ا")errs.push(`w${wi}: alef`);
    if(c.name==="fathatan"){
      const last=pos===L.length-1;
      const okTa=ch==="ة"&&last;
      const okHamza=ch==="ء"&&last&&pos>0&&L[pos-1].ch==="ا";
      const okAlef=pos===L.length-2&&L[L.length-1].ch==="ا";
      if(!okTa&&!okHamza&&!okAlef)errs.push(`w${wi}: fathatan placement`);
    }
    if(c.name==="sukun"&&pos===L.length-1&&wi+1<words.length&&/^[اٱ]/.test(strip(words[wi+1])))errs.push(`w${wi}: sukun before wasl`);
    const base=strip(words[wi]);
    if(c.tan&&hasAl(base))errs.push(`w${wi}: tanwin with ال`);
    tagged[wi]={lab,rid,tan:c.tan,al:hasAl(base)};
    resolved.push([wi,lab,rid,pos]);
  }
  Object.entries(tagged).forEach(([k,t])=>{
    const nx=tagged[+k+1];
    if(nx&&nx.rid==="R05"&&["nom","acc","gen"].includes(t.lab)&&(t.tan||t.al))errs.push(`w${k}: mudaf form`);
  });
  resolved.sort((a,b)=>a[0]-b[0]);
  return{ok:errs.length===0,errors:errs,item:{lvl,v,en,g:resolved}};
}
// Models often put fathatan on the alef; move it onto the letter before.
const normalizeV=v=>String(v||"").replace(/([ء-ي])([ٌ-ْٰ]*)ا([ً-ْ]*)/g,
  (m,l,before,after)=>after.includes("ً")?l+before+"ًا"+after.replace(/ً/g,""):m);

function familyOf(vowel,label){
  const verb=["ind","sub","jus"].includes(label);
  const f=verb?{u:"ind",a:"sub",o:"jus",i:"kasra"}[vowel]:{u:"nom",a:"acc",i:"gen",o:"sukun"}[vowel];
  return f||"?";
}
const sameBase=(a,b)=>splitWords(strip(a)).join(" ")===splitWords(strip(b)).join(" ");

// Deterministic: only the keyed letter of each graded word matters.
function grade(item,userText){
  const vw=splitWords(item.v),uw=splitWords(userText);
  const gmap=Object.fromEntries(item.g.map(e=>[e[0],e]));
  const words=vw.map((w,i)=>{
    const e=gmap[i],base={i,vword:w,uword:uw[i]||""};
    if(!e)return{...base,graded:false,out:"ungraded"};
    const[,label,rule,pos]=e;
    const VL=lettersOf(w),UL=lettersOf(uw[i]||"");
    const exp=caseOf(VL[pos]?VL[pos].marks:[]);
    let um=UL[pos]?UL[pos].marks.slice():[];
    const alefNext=UL.length===pos+2&&UL[pos+1].ch==="ا";
    if(alefNext)um=um.concat(UL[pos+1].marks);
    const giv=caseOf(um);
    let out;
    if(!giv){
      const later=UL.slice(pos+(alefNext?2:1));
      out=later.some(l=>{const c=caseOf(l.marks);return c&&exp&&c.v===exp.v;})?"misplaced":"blank";
    }else if(giv.name==="multi")out="wrong";
    else if(exp&&giv.v===exp.v)out=giv.tan===exp.tan?"correct":"tanwin";
    else out="wrong";
    let fam=null;
    if(out==="wrong"&&giv){fam=giv.name==="multi"?"two marks":familyOf(giv.v,label);if(fam===label)fam=giv.name;}
    return{...base,graded:true,out,label,rule,pos,given:giv?giv.name:null,expected:exp?exp.name:null,fam};
  });
  const gw=words.filter(w=>w.graded);
  const ok=gw.filter(w=>w.out==="correct"||w.out==="tanwin").length;
  return{words,n:gw.length,ok,slips:gw.filter(w=>w.out==="tanwin").length,perfect:gw.length>0&&ok===gw.length};
}
// Attach `mark` to the letter just before the caret. Same mark again removes it; shadda toggles.
function insertMark(text,caret,mark){
  let k=Math.min(caret,text.length)-1;
  while(k>=0&&isMark(text[k]))k--;
  if(k<0||!isLetter(text[k]))return null;
  let end=k+1;
  while(end<text.length&&isMark(text[end]))end++;
  const cur=text.slice(k+1,end).split("");
  let shadda=cur.includes(CM.shadda);
  const vowels=cur.filter(c=>MARK_NAME[c]);
  const other=cur.filter(c=>c!==CM.shadda&&!MARK_NAME[c]);
  let vowel=vowels.length?vowels[vowels.length-1]:"";
  if(mark===CM.shadda)shadda=!shadda;else vowel=vowel===mark?"":mark;
  const cluster=(shadda?CM.shadda:"")+vowel+other.join("");
  return{text:text.slice(0,k+1)+cluster+text.slice(end),caret:k+1+cluster.length};
}
const GLYPH={damma:"ُ",dammatan:"ٌ",fatha:"َ",fathatan:"ً",kasra:"ِ",kasratan:"ٍ",sukun:"ْ"};
const markShow=n=>GLYPH[n]?`◌${GLYPH[n]} ${n}`:(n||"nothing");
const famName=f=>FAM[f]||f;
const ruleWhy=(rule,label)=>{const r=RULE[rule];return r?(r.why[label]||Object.values(r.why)[0]):"";};
const OUT={correct:["✓","Correct","ok"],tanwin:["✓","Case right, tanwin off","slip"],wrong:["✗","Wrong ending","bad"],blank:["✗","Left blank","bad"],misplaced:["✗","Right mark, wrong letter","bad"]};
const OUT_COLOR={ok:MINT,slip:GOLD,bad:ROSE};

const genSys=(lvl)=>`You write practice sentences for a learner drilling Arabic case and mood endings (الإعراب) in Modern Standard Arabic.
The user message includes a numbered list of words the learner has MASTERED. Every sentence must contain 1 or 2 of these words (any inflected form, different words in different sentences), and you should grade those words when their ending shows a short vowel.
Return ONLY JSON, no fences: {"items":[{"v":"FULLY vocalized sentence","en":"short English gloss","g":[[wordIdx,"label","ruleId",pos]],"uses":[list numbers]}]}
- v: 5 to 10 words, natural and high-frequency. Correct, complete tashkeel on every letter.
- wordIdx: 0-based index among whitespace-separated words of v. Punctuation stuck to a word is not a word.
- label: nom, acc or gen for nouns; ind, sub or jus for present verbs. The label must be one the rule allows.
- pos: -1 when the case mark is on the word's last letter (or on the letter before a final tanwin alef). Only when a pronoun suffix follows, give the 0-based index of the letter that carries the case mark, counting letters only.
- Grade 3 to 6 words. Grade ONLY words whose case shows as a short vowel. NEVER grade indeclinables, pronouns, demonstratives, relative pronouns, particles, past or imperative verbs, duals, sound masculine plurals, the five nouns, the five verbs, words ending in alef maqsura, defective nouns in the nominative or genitive, or numbers.
- Write fathatan on the letter before the final alef (كِتابًا). Never grade a jussive verb that is followed by a word starting with ال.
- Only write sentences whose إعراب is certain and uncontroversial.
Rules (id [labels]: meaning):
${RULES.map(r=>`${r.id} [${r.labels.join("/")}]: ${r.en}${r.marks?` (ending: ${Object.entries(r.marks).map(([l,m])=>`${l} = ${m.join("/")}`).join("; ")})`:""}`).join("\n")}
Level ${lvl}: ${lvl===1?"simple sentences, rules R01 to R07 only.":lvl===2?"rules R01 to R13 (no conditionals); every sentence grades at least one word under R08 to R13.":"two clauses; any rule; every sentence grades at least one word under R10 (tamyiz or exception with إلا), R12 (conditional with إنْ/مَنْ/ما), R14 or R15."}`;

const csSt={level:1,len:3,batch:null,busy:"",err:"",flash:""};

window.csSet=(k,v)=>{csSt[k]=v;R();};
window.csText=v=>{csSt.batch.text=v;};

async function genItems(n,lvl,p){
  const out=[];
  const one=async k=>{
    const picked=sample(p,Math.min(12,k*3+3));
    const r=await ai(genSys(lvl),`Write ${k} sentence${k===1?"":"s"}. Vary topics and sentence frames.\n\nMASTERED VOCABULARY (numbered):\n${picked.map((w,i)=>`${i+1}. ${headWord(w)} = ${w.english}`).join("\n")}`,2200);
    return(r.items||[]).slice(0,k).map(x=>{
      const res=validateItem({lvl,v:normalizeV(x&&x.v),en:(x&&x.en)||"",g:x&&x.g});
      if(!res.ok)return null;
      return{...res.item,words:(Array.isArray(x.uses)?x.uses:[]).map(n=>picked[(+n)-1]).filter(Boolean)};
    }).filter(Boolean);
  };
  for(let left=n;left>0;left-=3){
    const k=Math.min(3,left);
    let good=await one(k);
    if(good.length<k){try{good=good.concat(await one(k-good.length));}catch(e){}}
    out.push(...good.slice(0,k));
  }
  return out;
}
window.csStart=async function(){
  const p=pool();
  if(p.length<3){toast("Master at least 3 MSA words first",GOLD);return;}
  csSt.busy="gen";csSt.err="";R();
  try{
    const items=await genItems(csSt.len,csSt.level,p);
    if(!items.length)throw new Error("empty");
    csSt.batch={items,idx:0,text:strip(items[0].v),undo:[],result:null,scores:[]};
  }catch(e){csSt.err=e.message==="parse"||e.message==="empty"?"Couldn't get sentences that passed the key check. Try again.":e.message;}
  csSt.busy="";R();
};
window.csMark=function(m){
  const ta=document.getElementById("cs-ta"),b=csSt.batch;
  if(!ta||!b)return;
  const r=insertMark(ta.value,ta.selectionStart,m);
  const fl=document.getElementById("cs-flash");
  if(!r){if(fl)fl.textContent="Put the cursor right after a letter first.";return;}
  if(fl)fl.textContent="Tap right after a letter, then tap a mark. Tap the same mark again to remove it.";
  b.undo=[...b.undo,b.text].slice(-60);
  b.text=r.text;ta.value=r.text;ta.focus();ta.setSelectionRange(r.caret,r.caret);
};
window.csUndo=function(){
  const b=csSt.batch;if(!b||!b.undo.length)return;
  b.text=b.undo[b.undo.length-1];b.undo=b.undo.slice(0,-1);R();
};
window.csClear=function(){const b=csSt.batch,it=b.items[b.idx];b.undo=[...b.undo,b.text].slice(-60);b.text=strip(b.text);R();};
window.csReset=function(){const b=csSt.batch;b.text=strip(b.items[b.idx].v);R();};
window.csSubmit=function(){
  const b=csSt.batch,item=b.items[b.idx];
  if(!sameBase(item.v,b.text))return;
  const r=grade(item,b.text);
  b.result=r;b.scores.push(r.perfect?1:0);
  window.statsLog&&statsLog("cs",r.n,r.ok);
  const d=store(),c=d.cs;
  c.sent++;c.words+=r.n;c.ok+=r.ok;
  r.words.filter(w=>w.graded).forEach(w=>{
    const ok=w.out==="correct"||w.out==="tanwin";
    const bl=c.byLabel[w.label]||(c.byLabel[w.label]={n:0,ok:0});bl.n++;if(ok)bl.ok++;
    const br=c.byRule[w.rule]||(c.byRule[w.rule]={n:0,ok:0});br.n++;if(ok)br.ok++;
  });
  save(d);R();
};
window.csNext=function(){
  const b=csSt.batch;b.idx++;b.result=null;b.undo=[];
  b.text=b.idx<b.items.length?strip(b.items[b.idx].v):"";R();
};

function rCase(hasKey){
  const p=pool(),b=csSt.batch,d=store().cs;
  if(applyDialect!=="MSA")return notice("Case endings only exist in Fusha. Switch the dialect to MSA to practice them.");
  const done=b&&b.idx>=b.items.length,item=b&&!done?b.items[b.idx]:null,res=b&&b.result;
  const setup=`
    ${p.length<3?notice(`You have <strong style="color:${GOLD}">${p.length}</strong> mastered MSA words. Master at least 3 to build sentences from them.`):
      notice(`Sentences are written around your <strong style="color:${GOLD}">${p.length}</strong> mastered MSA words. Add the case and mood endings; only the ending is graded.`)}
    ${!hasKey?notice("No API key. <span style=\"cursor:pointer;text-decoration:underline\" onclick=\"V('settings')\">Add it in Settings</span>",ROSE):""}
    <label class="lbl">Level</label>${seg([[1,"1 · Basics"],[2,"2 · Kana, Inna, moods"],[3,"3 · Advanced"]],csSt.level,"csLevel")}
    <label class="lbl">Sentences</label>${seg([[1,"1"],[3,"3"],[5,"5"]],csSt.len,"csLen")}
    <button class="btn1" onclick="csStart()" style="width:100%;justify-content:center"${!hasKey||p.length<3||csSt.busy?" disabled":""}>${csSt.busy==="gen"?'<span class="spinner"></span>Writing and key-checking...':(b?"New set":"Start")}</button>`;
  let body="";
  if(item){
    const baseOk=sameBase(item.v,b.text);
    const wordsRow=item.words.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px"><span style="font-size:11px;color:${SAGE}">Your words</span>
      ${item.words.map(w=>`<span style="border:1px solid rgba(217,180,94,0.25);border-radius:20px;padding:2px 10px;font-size:12px;color:${SAGE}"><span style="${AMIRI}font-size:16px;color:${INK}">${esc(headWord(w))}</span> ${esc(w.english)}</span>`).join("")}</div>`:"";
    let inner=`<div style="font-size:11px;color:${SAGE};margin-bottom:6px">${b.items.length>1?`${b.idx+1} of ${b.items.length} · `:""}Level ${item.lvl}</div>
      <div style="font-size:14px;color:${SAGE};margin-bottom:10px">${esc(item.en)}</div>${wordsRow}`;
    if(!res){
      inner+=`<textarea id="cs-ta" class="inp" dir="rtl" rows="2" spellcheck="false" autocomplete="off" autocorrect="off" style="${AMIRI}font-size:26px;line-height:2;width:100%;min-height:110px" oninput="csText(this.value)">${esc(b.text)}</textarea>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px">
          ${["damma","dammatan","fatha","fathatan","kasra","kasratan","sukun","shadda"].map(n=>`<button type="button" onmousedown="event.preventDefault()" onclick="csMark(CM_${n})" aria-label="Add ${n}" title="${n}" style="min-height:44px;border:1px solid rgba(217,180,94,0.25);background:var(--panel);border-radius:10px;color:${INK};cursor:pointer;${AMIRI}font-size:28px;line-height:1">◌${n==="shadda"?CM.shadda:GLYPH[n]}</button>`).join("")}
          <button type="button" onmousedown="event.preventDefault()" onclick="csUndo()"${b.undo.length?"":" disabled"} style="min-height:44px;border:1px solid rgba(217,180,94,0.25);background:var(--panel);border-radius:10px;color:${GOLD};cursor:pointer;font-family:inherit;font-size:12px">Undo</button>
        </div>
        <div id="cs-flash" style="font-size:11px;color:${SAGE};margin-top:6px">Tap right after a letter, then tap a mark. Tap the same mark again to remove it.</div>
        ${!baseOk?`<div style="margin-top:10px;background:rgba(240,122,122,0.12);color:${ROSE};border-radius:10px;padding:8px 12px;font-size:12px">You changed some letters, not just marks. Grading needs the original letters. <span style="text-decoration:underline;cursor:pointer" onclick="csReset()">Reset sentence</span></div>`:""}
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn2" style="flex:1;text-align:center" onclick="csClear()">Clear my marks</button>
          <button class="btn1" style="flex:2;justify-content:center" onclick="csSubmit()"${baseOk?"":" disabled"}>Check endings</button>
        </div>`;
    } else {
      inner+=`<div style="font-weight:600;color:${res.perfect?MINT:INK};margin-bottom:8px">${res.ok} of ${res.n} right${res.slips?` <span style="font-weight:400;font-size:12px;color:${SAGE}">· ${res.slips} tanwin slip${res.slips===1?"":"s"}</span>`:""}</div>
        <div style="${AMIRI}font-size:24px;line-height:2.1;text-align:right">${res.words.map(w=>{
          const o=w.graded?OUT[w.out][2]:"un";
          const bg=o==="ok"?"rgba(95,211,160,0.16)":o==="slip"?"rgba(217,180,94,0.18)":o==="bad"?"rgba(240,122,122,0.18)":"transparent";
          return`<span style="border-radius:6px;padding:0 3px;background:${bg};${w.graded?"":`color:${SAGE}`}">${esc(w.uword)} </span>`;}).join("")}</div>
        <div style="${AMIRI}font-size:21px;line-height:1.9;text-align:right;color:${INK};margin-top:6px">${esc(item.v)}</div>
        <div style="font-size:11px;color:${SAGE};margin:4px 0 10px">Muted words aren't graded: indeclinables, pronouns, particles, past verbs, or endings shown by letters.</div>
        ${res.words.filter(w=>w.graded).map(w=>{
          const[sym,txt,cls]=OUT[w.out],miss=!(w.out==="correct"||w.out==="tanwin");
          return`<div style="border-left:3px solid ${OUT_COLOR[cls]};padding:4px 0 6px 12px;margin-bottom:8px">
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font-weight:700;color:${OUT_COLOR[cls]}">${sym}</span>
              <span style="${AMIRI}font-size:20px">${w.out!=="correct"?`<s style="color:${ROSE}">${esc(trimP(w.uword))}</s> `:""}<b>${esc(trimP(w.vword))}</b></span>
              <span style="font-size:12px;font-weight:600;color:${INK}">${LABELS[w.label][0]} <span style="${AMIRI}font-weight:400;font-size:14px">${LABELS[w.label][1]}</span></span></div>
            <div style="font-size:12px;color:${SAGE};margin-top:2px">${txt}${miss?`. You: ${w.out==="misplaced"?"on another letter":markShow(w.given)}${w.fam?` (${famName(w.fam)})`:""}. Key: ${markShow(w.expected)}.`:"."}</div>
            <div style="font-size:12px;color:${SAGE}">${esc(ruleWhy(w.rule,w.label))} <span style="opacity:.6">(${w.rule})</span></div></div>`;}).join("")}
        <button class="btn1" style="width:100%;justify-content:center;margin-top:8px" onclick="csNext()">${b.idx+1<b.items.length?"Next sentence":"Finish"}</button>`;
    }
    body=card(inner);
  } else if(done){
    const perfect=b.scores.filter(Boolean).length;
    body=card(`<div style="text-align:center"><div style="${AMIRI}font-size:36px;color:${MINT}">أَحْسَنْتَ!</div>
      <div style="font-size:13px;color:${INK};margin-top:6px">${perfect} of ${b.items.length} sentence${b.items.length===1?"":"s"} fully right. Start another set.</div></div>`);
  }
  if(csSt.err)body=`<div style="font-size:12px;color:${ROSE};margin-top:12px">${esc(csSt.err)}</div>`+body;
  let stats="";
  if(d.words){
    const weak=Object.entries(d.byLabel).filter(([,x])=>x.n>=5).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n)[0];
    stats=`<div style="font-size:11px;color:${SAGE};margin-top:18px">All time: ${d.sent} sentence${d.sent===1?"":"s"}, ${d.ok} of ${d.words} endings right (${Math.round(d.ok/d.words*100)}%).${weak?` Weakest: ${FAM[weak[0]]} (${Math.round(weak[1].ok/weak[1].n*100)}%).`:""}</div>`;
  }
  return setup+body+stats;
}
window.csLevel=v=>{csSt.level=v;R();};
window.csLen=v=>{csSt.len=v;R();};
// palette buttons call csMark(CM_<name>)
Object.keys(CM).forEach(k=>{window["CM_"+k]=CM[k];});

/* =====================================================================
   CLOZE (no AI): blank a mastered word in its own example sentence
   ===================================================================== */
function findBlank(w){
  const m=String(w.example||"").match(/^([\s\S]*?)\s*\(([^()]*[A-Za-z][^()]*)\)\s*$/);
  const sent=(m?m[1]:String(w.example||"")).trim();
  const eng=m?m[2].trim():"";
  const tokens=sent.split(/\s+/).filter(Boolean);
  if(tokens.length<3)return null;
  const variants=[...new Set(String(w.arabic).split(/\s*[·,،\/]\s*/).map(norm).filter(v=>v.length>=2&&/^[ء-ي ]+$/.test(v)))];
  // present-tense verb forms start with ي; the same stem appears with أ ت ن ي in sentences
  const stems=variants.filter(v=>/^ي.{2,}/.test(v)).map(v=>v.slice(1));
  const clean=tokens.map(norm);
  const tries=[...variants.map(v=>({v,pre:"[وفبلك]?(?:ال)?"})),...stems.map(v=>({v,pre:"[وفبلك]?[يتنا]"}))];
  for(const{v,pre}of tries){
    const k=v.split(" ").length;
    const re=new RegExp("^"+pre+v+"(?:ها|هم|هن|كم|ني|نا|ان|ين|ون|ات|وا|ه|ك|ي|ت)?$");
    for(let i=0;i+k<=tokens.length;i++){
      const joined=clean.slice(i,i+k).join(" ");
      if(!re.test(joined))continue;
      const last=tokens[i+k-1];
      const punct=(last.match(/[.,،؟?!؛:]+$/)||[""])[0];
      const shown=tokens.slice(i,i+k).join(" ").replace(/[.,،؟?!؛:]+$/,"");
      return{before:tokens.slice(0,i).join(" "),after:tokens.slice(i+k).join(" "),shown,punct,eng,
        accepted:[...new Set([joined,v,"ال"+v,joined.replace(/^ال/,"")])]};
    }
  }
  return null;
}
const clSt={cur:null,dia:null,ans:"",status:null,mean:false,sess:{n:0,ok:0}};
function clDraw(){
  const list=pool().map(w=>({w,b:findBlank(w)})).filter(x=>x.b);
  clSt.dia=applyDialect;clSt.ans="";clSt.status=null;clSt.mean=false;
  if(!list.length){clSt.cur=null;return;}
  let c=list[0];
  for(let t=0;t<6;t++){c=list[Math.floor(Math.random()*list.length)];if(!clSt.cur||c.w.id!==clSt.cur.w.id)break;}
  clSt.cur=c;clSt.count=list.length;
}
function clLog(ok){window.statsLog&&statsLog("cl",1,ok?1:0);const d=store();d.cl=d.cl||{n:0,ok:0};d.cl.n++;if(ok)d.cl.ok++;save(d);}
window.clAns=v=>{clSt.ans=v;};
window.clMean=()=>{clSt.mean=true;R();};
window.clNext=()=>{clDraw();R();};
window.clCheck=()=>{
  if(clSt.status||!clSt.cur)return;
  const a=norm(clSt.ans);if(!a)return;
  const ok=clSt.cur.b.accepted.includes(a);
  clSt.status=ok?"right":"wrong";clSt.sess.n++;if(ok)clSt.sess.ok++;clLog(ok);R();
};
window.clReveal=()=>{
  if(clSt.status||!clSt.cur)return;
  clSt.status="revealed";clSt.sess.n++;clLog(false);R();
};
window.clKey=e=>{if(e.key==="Enter"){clSt.status?window.clNext():window.clCheck();}};

function rCloze(){
  if(!clSt.cur||clSt.dia!==applyDialect)clDraw();
  const c=clSt.cur,d=(store().cl)||{n:0,ok:0};
  if(!c)return notice(`No ${esc(applyDialect)} mastered words have a usable example sentence yet. Cards need an example that contains the word.`);
  const st=clSt.status;
  const shown=st?`<b style="color:${st==="right"?MINT:ROSE}">${esc(c.b.shown)}</b>`:`<span style="display:inline-block;min-width:72px;border-bottom:3px solid ${GOLD};text-align:center;color:${GOLD}">＿＿＿＿</span>`;
  return notice(`Fill the blank with the mastered word. Sentences come from your own cards, so this costs nothing. <strong style="color:${GOLD}">${clSt.count}</strong> ${esc(applyDialect)} words have a usable sentence.`)+
  card(`
    <div style="${AMIRI}font-size:26px;line-height:2.1;text-align:right;color:${INK}">${c.b.before?esc(c.b.before)+" ":""}${shown}${esc(c.b.punct)}${c.b.after?" "+esc(c.b.after):""}</div>
    ${!st?(clSt.mean?`<div style="font-size:13px;color:${GOLD};background:rgba(217,180,94,0.08);border-radius:8px;padding:8px 10px;margin:8px 0">${esc(c.w.english)}</div>`
      :`<div style="font-size:12px;color:${GOLD};cursor:pointer;margin:8px 0" onclick="clMean()">Show meaning</div>`):""}
    <input id="cl-in" class="inp" dir="rtl" autocomplete="off" style="${AMIRI}font-size:22px;width:100%;margin-top:6px" placeholder="اُكْتُبِ الكَلِمَة…" value="${esc(clSt.ans)}"${st?" disabled":""} oninput="clAns(this.value)" onkeydown="clKey(event)">
    ${st?`<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><b style="color:${st==="right"?MINT:ROSE}">${st==="right"?"Correct.":st==="revealed"?"Revealed.":"Not quite."}</b>
        <span style="${AMIRI}font-size:20px;color:${INK}">${esc(c.w.arabic)}</span><span style="font-size:13px;color:${SAGE}">${esc(c.w.english)}</span></div>
      ${c.b.eng?`<div style="font-size:13px;color:${SAGE}">${esc(c.b.eng)}</div>`:""}</div>`:""}
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn2" style="flex:1;text-align:center" onclick="clNext()">Skip</button>
      ${!st?`<button class="btn2" style="flex:1;text-align:center" onclick="clReveal()">Show answer</button>
        <button class="btn1" style="flex:1;justify-content:center" onclick="clCheck()">Check</button>`
        :`<button class="btn1" style="flex:2;justify-content:center" onclick="clNext()">Next</button>`}
    </div>`)+
  `<div style="font-size:11px;color:${SAGE};margin-top:18px">${clSt.sess.n?`This session: ${clSt.sess.ok} of ${clSt.sess.n}. `:""}${d.n?`All time: ${d.ok} of ${d.n} (${Math.round(d.ok/d.n*100)}%).`:""}</div>`;
}

/* =====================================================================
   JOURNAL: write in Arabic with a mastered-word challenge, then get feedback
   ===================================================================== */
const J_PROMPTS=[
  "If you could live one year anywhere in the Arab world, where and why?",
  "If you hadn't started Arabic, what would you be doing right now?",
  "Compare life in two places you know well. Which would you pick to raise a family?",
  "Dialect first or Fusha first? Pick a side and defend it.",
  "Should universities require a foreign language? Take a side.",
  "Narrate yesterday hour by hour. No skipping the boring parts.",
  "How did you first get hooked on Arabic? Tell it as a story.",
  "Describe your childhood home so well someone could draw it.",
];
const jFbSys=v=>`You are a sharp, encouraging Arabic writing coach. The learner is intermediate-advanced and wants to improve SENTENCE STRUCTURE (word order, clause linking, agreement, verb choice), not just vocabulary.
The entry is written in ${v==="MSA"?"Modern Standard Arabic (Fusha). Flag any dialect intrusions as register mixing.":vName(v)+". Correct it as natural "+v+". Do NOT convert it to Fusha. Only flag things you are confident about."}
Return ONLY a JSON object, no preamble, no markdown fences:
{"overall":"1-2 sentences in English: the biggest structural takeaway",
"upgrade":{"original":"one sentence from the entry","better":"a more native, more sophisticated rewrite with full diacritics","why":"short English explanation"},
"corrections":[{"wrong":"exact snippet from the entry","right":"corrected snippet with full diacritics","why":"short English explanation"}]}
Rules: at most 8 corrections, most important first. Keep snippets short (a few words). If the entry is clean, return an empty corrections array and still give an upgrade.`;
const jSt={text:"",prompt:null,challenge:null,sel:null,busy:false,err:"",confirm:false};
const wcount=t=>t.trim().split(/\s+/).filter(Boolean).length;
const jEntries=()=>(store().j||[]);
function jMut(fn){const d=store();d.j=d.j||[];fn(d.j);save(d);}

window.jText=v=>{jSt.text=v;};
window.jPrompt=()=>{jSt.prompt=J_PROMPTS[Math.floor(Math.random()*J_PROMPTS.length)];R();};
window.jChallenge=()=>{
  const p=pool();if(p.length<5){toast("Master at least 5 "+applyDialect+" words first",GOLD);return;}
  jSt.challenge=sample(p,5).map(w=>({ar:headWord(w),en:w.english,used:false}));R();
};
window.jClearCh=()=>{jSt.challenge=null;R();};
window.jUse=i=>{jSt.challenge[i].used=!jSt.challenge[i].used;R();};
window.jOpen=id=>{jSt.sel=id;jSt.err="";jSt.confirm=false;R();};
window.jClose=()=>{jSt.sel=null;jSt.confirm=false;R();};
window.jDel=id=>{
  if(!jSt.confirm){jSt.confirm=true;R();return;}
  jMut(a=>{const i=a.findIndex(e=>e.id===id);if(i>=0)a.splice(i,1);});
  jSt.sel=null;jSt.confirm=false;R();
};
window.jSave=async function(withFb){
  const ta=document.getElementById("j-ta");if(ta)jSt.text=ta.value;
  if(!jSt.text.trim())return;
  const e={id:"j"+Date.now().toString(36),date:new Date().toISOString().slice(0,10),variety:applyDialect,
    prompt:jSt.prompt||"",text:jSt.text.trim(),words:wcount(jSt.text),challenge:jSt.challenge,feedback:null};
  window.statsLog&&statsLog("jw",e.words,0);
  jMut(a=>{a.unshift(e);if(a.length>150)a.length=150;});
  jSt.text="";jSt.prompt=null;jSt.challenge=null;jSt.sel=e.id;jSt.confirm=false;R();
  if(withFb)await window.jFeedback(e.id);
};
window.jFeedback=async function(id){
  const e=jEntries().find(x=>x.id===id);if(!e)return;
  jSt.busy=true;jSt.err="";R();
  try{
    const note=e.challenge&&e.challenge.length?`\n\n(Not part of the entry. The learner was challenged to use these words: ${e.challenge.map(c=>`${c.ar} = ${c.en}`).join("; ")}. If any were used incorrectly, mention it in "overall" and add a correction.)`:"";
    const fb=await ai(jFbSys(e.variety),e.text+note,1800);
    const clean={overall:fb.overall||"",upgrade:fb.upgrade||null,corrections:Array.isArray(fb.corrections)?fb.corrections.slice(0,8):[]};
    jMut(a=>{const x=a.find(y=>y.id===id);if(x)x.feedback=clean;});
  }catch(x){jSt.err=x.message==="parse"?"Feedback didn't come back cleanly. Try again.":x.message;}
  jSt.busy=false;R();
};

function jFeedbackHtml(fb){
  return`<div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
    ${fb.overall?`<div style="font-size:13px;color:${INK};border-left:3px solid ${GOLD};padding-left:10px">${esc(fb.overall)}</div>`:""}
    ${fb.upgrade&&fb.upgrade.better?`<div style="background:rgba(217,180,94,0.08);border-radius:10px;padding:10px 12px">
      <div style="font-size:11px;font-weight:600;color:${GOLD};margin-bottom:4px">Sentence upgrade</div>
      <div style="${AMIRI}font-size:16px;color:${SAGE};text-align:right">${esc(fb.upgrade.original)}</div>
      <div style="${AMIRI}font-size:19px;color:${INK};text-align:right;margin-top:4px">${esc(fb.upgrade.better)}</div>
      <div style="font-size:12px;color:${SAGE};margin-top:4px">${esc(fb.upgrade.why)}</div></div>`:""}
    ${fb.corrections.length?corrList(fb.corrections):`<div style="font-size:13px;color:${SAGE}">No errors flagged. Suspicious, but congratulations.</div>`}</div>`;
}

function rJournal(hasKey){
  const entries=jEntries(),sel=jSt.sel&&entries.find(e=>e.id===jSt.sel);
  const p=pool();
  if(sel){
    return`<div style="font-size:12px;color:${GOLD};cursor:pointer;margin-bottom:10px" onclick="jClose()">← All entries</div>`+card(`
      <div style="font-size:11px;color:${SAGE};margin-bottom:6px">${esc(sel.date)} · ${esc(sel.variety)} · ${sel.words} words</div>
      ${sel.prompt?`<div style="font-size:12px;color:${SAGE};margin-bottom:6px">Prompt: ${esc(sel.prompt)}</div>`:""}
      ${sel.challenge?`<div style="font-size:12px;color:${SAGE};margin-bottom:6px">Word challenge: ${sel.challenge.filter(c=>c.used).length} of ${sel.challenge.length} ticked. <span style="${AMIRI}font-size:15px">${sel.challenge.map(c=>esc(c.ar)).join("، ")}</span></div>`:""}
      <div style="${AMIRI}font-size:19px;line-height:2;text-align:right;color:${INK};white-space:pre-wrap;background:rgba(255,255,255,0.03);border-radius:10px;padding:12px">${esc(sel.text)}</div>
      ${sel.feedback?jFeedbackHtml(sel.feedback):`<button class="btn1" style="width:100%;justify-content:center;margin-top:12px" onclick="jFeedback('${sel.id}')"${jSt.busy||!hasKey?" disabled":""}>${jSt.busy?'<span class="spinner"></span>Reading your Arabic...':"Get feedback"}</button>`}
      ${jSt.err?`<div style="font-size:12px;color:${ROSE};margin-top:10px">${esc(jSt.err)}</div>`:""}
      <div style="display:flex;gap:8px;margin-top:14px">
        ${sel.feedback?`<button class="btn2" style="flex:1;text-align:center" onclick="jFeedback('${sel.id}')"${jSt.busy||!hasKey?" disabled":""}>${jSt.busy?"Working...":"Re-run feedback"}</button>`:""}
        <button class="btn2" style="flex:1;text-align:center;color:${ROSE}" onclick="jDel('${sel.id}')">${jSt.confirm?"Confirm delete":"Delete"}</button></div>`);
  }
  const ch=jSt.challenge;
  const challengeHtml=ch?`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:11px;color:${SAGE}">Word challenge: tap each word once you've used it (${ch.filter(c=>c.used).length}/${ch.length})</span>
      <span style="font-size:11px;color:${GOLD};cursor:pointer" onclick="jClearCh()">Clear</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${ch.map((c,i)=>`<div onclick="jUse(${i})" style="cursor:pointer;border:1px solid ${c.used?"rgba(95,211,160,0.5)":"rgba(217,180,94,0.25)"};background:${c.used?"rgba(95,211,160,0.12)":"var(--panel)"};border-radius:10px;padding:4px 12px;text-align:center">
      <div style="${AMIRI}font-size:18px;color:${INK};${c.used?"text-decoration:line-through":""}">${esc(c.ar)}</div><div style="font-size:11px;color:${SAGE}">${esc(c.en)}</div></div>`).join("")}</div></div>`
    :`<button class="btn2" style="width:100%;text-align:center;margin-bottom:12px" onclick="jChallenge()"${p.length<5?" disabled":""}>Word challenge: use 5 mastered words</button>`;
  const list=entries.length?`<div style="margin-top:18px">${sh("Entries")}${entries.slice(0,30).map(e=>`<div onclick="jOpen('${e.id}')" style="cursor:pointer;border:1px solid rgba(217,180,94,0.18);background:var(--panel);border-radius:10px;padding:10px 12px;margin-bottom:6px">
      <div style="font-size:11px;color:${SAGE}">${esc(e.date)} · ${esc(e.variety)} · ${e.words}w${e.feedback?` <span style="color:${MINT}">● feedback</span>`:""}</div>
      <div style="${AMIRI}font-size:16px;color:${INK};text-align:right;margin-top:3px">${esc(e.text.slice(0,90))}${e.text.length>90?"…":""}</div></div>`).join("")}</div>`:"";
  const words=entries.reduce((a,e)=>a+e.words,0);
  return(!hasKey?notice("No API key, so you can save entries but not get feedback. <span style=\"cursor:pointer;text-decoration:underline\" onclick=\"V('settings')\">Add it in Settings</span>",ROSE):"")+
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
      <div style="font-size:13px;color:${INK}">${jSt.prompt?esc(jSt.prompt):`<span style="color:${SAGE}">Write about anything, or pull a prompt.</span>`}</div>
      <button class="btn2" onclick="jPrompt()" style="white-space:nowrap">Prompt</button></div>`+
    challengeHtml+
    `<textarea id="j-ta" class="inp" dir="rtl" style="${AMIRI}font-size:20px;line-height:1.9;min-height:200px;width:100%" placeholder="اُكْتُبْ هُنا…" oninput="jText(this.value)">${esc(jSt.text)}</textarea>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn2" style="flex:1;text-align:center" onclick="jSave(false)">Save entry</button>
      <button class="btn1" style="flex:2;justify-content:center" onclick="jSave(true)"${hasKey&&!jSt.busy?"":" disabled"}>Save and get feedback</button></div>`+
    list+
    (entries.length?`<div style="font-size:11px;color:${SAGE};margin-top:14px">${entries.length} entr${entries.length===1?"y":"ies"}, ${words} words written. Entries are saved on this device.</div>`:"");
}

window.rPracticeCloze=rCloze;
window.rPracticeJournal=rJournal;
window.rPracticeTranslate=rTranslate;
window.rPracticeCase=rCase;
})();
