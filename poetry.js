/* Poetry tab: paste a classical poem, get a verse-by-verse English translation, a short
   cultural background and explanation, and a memorize mode.
   Poems live in this browser (localStorage) and sync to the `user_poems` table when it
   exists (see poetry-setup.sql); if it doesn't, everything still works locally.
   Translation and explanation are written by Claude from its own knowledge and labelled as such;
   "Find sources" runs a web search and only links to what it finds.
   Loaded after index.html's main script; uses its globals (CU, R, V, gLS, sLS, toast, sh, uid, sbGet, sbUpsert, sbFetch). */
(function(){
"use strict";

const WORKER="https://tiny-sound-c8ff.jmorgansmith03.workers.dev";
const GOLD="#D9B45E", INK="#EEE8D5", SAGE="#8DB5A5", ROSE="#F07A7A", MINT="#5FD3A0";
const AR="font-family:'Amiri',serif;direction:rtl;";
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ---------- storage ---------- */
const key=()=>`mufradat-poems-${CU.username}`;
const load=()=>{const a=gLS(key());return Array.isArray(a)?a:[];};
const saveLocal=a=>sLS(key(),a);
let cloud="unknown"; // unknown | ok | local   (is the user_poems table reachable?)
let pulled=false;

async function push(p){
  try{
    await sbUpsert("/user_poems?on_conflict=user_id,poem_id",[{user_id:CU.id,poem_id:p.id,data:p,updated_at:new Date(p.updatedAt||Date.now()).toISOString()}]);
    cloud="ok";
  }catch(e){cloud="local";}
}
async function pull(){
  if(pulled)return;pulled=true;
  try{
    const rows=await sbGet(`/user_poems?user_id=eq.${encodeURIComponent(CU.id)}&select=poem_id,data`);
    cloud="ok";
    const mine=load(),by=new Map(mine.map(p=>[p.id,p]));let changed=false;
    (rows||[]).forEach(r=>{
      const c=r.data;if(!c||!c.id)return;
      const l=by.get(c.id);
      if(!l||(c.updatedAt||0)>(l.updatedAt||0)){by.set(c.id,c);changed=true;}
    });
    // anything only on this device goes up
    for(const p of mine){if(!(rows||[]).some(r=>r.poem_id===p.id))push(p);}
    if(changed){saveLocal([...by.values()]);if(view==="poetry")R();}
  }catch(e){cloud="local";if(view==="poetry")R();}
}
function put(p){
  p.updatedAt=Date.now();
  const a=load(),i=a.findIndex(x=>x.id===p.id);
  if(i>=0)a[i]=p;else a.push(p);
  saveLocal(a);push(p);
}
async function drop(id){
  saveLocal(load().filter(p=>p.id!==id));
  try{await sbFetch(`/user_poems?user_id=eq.${encodeURIComponent(CU.id)}&poem_id=eq.${encodeURIComponent(id)}`,{method:"DELETE",prefer:"return=minimal"});}catch(e){}
}

/* ---------- parsing the pasted Arabic ---------- */
// A classical verse (bayt) has two halves. Pasted poems separate them with a tab, a run of
// spaces, an ellipsis, a star, or a dash — or put each half on its own line.
const SEP=/\t+|\s{3,}|\s*…+\s*|\s*\.{3,}\s*|\s*\*+\s*|\s+[–—]\s+/;
function parsePoem(text,layout){
  const rows=String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const split=r=>{const p=r.split(SEP).map(s=>s.trim()).filter(Boolean);return p.length>=2?[p[0],p.slice(1).join(" ")]:[r,""];};
  const hasSep=rows.filter(r=>SEP.test(r)).length;
  const mode=layout==="auto"?(hasSep>=rows.length/2?"halves":"single"):layout;
  if(mode==="halves")return rows.map(split);
  if(mode==="pair"){const o=[];for(let i=0;i<rows.length;i+=2)o.push([rows[i],rows[i+1]||""]);return o;}
  return rows.map(r=>[r,""]);
}

/* ---------- AI ---------- */
function apiKey(){return(gLS(`mufradat-apikey-${CU.username}`)||"").replace(/^["']|["']$/g,"");}
async function callClaude(body){
  const k=apiKey();
  if(!k)throw new Error("No API key. Add it in Settings.");
  if(!navigator.onLine)throw new Error("This needs a connection.");
  const res=await fetch(WORKER,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-6",...body})});
  const data=await res.json();
  if(data.error)throw new Error(data.error.message||"API error");
  return data;
}
function parseJSON(raw){
  const s=String(raw||"").replace(/```json|```/g,"").trim();
  const a=s.indexOf("{"),b=s.lastIndexOf("}");
  return JSON.parse(a>=0&&b>a?s.slice(a,b+1):s);
}
async function analyze(verses,hint){
  const numbered=verses.map((v,i)=>`${i+1}. ${v[0]}${v[1]?"  ‖  "+v[1]:""}`).join("\n");
  const prompt=`You are an expert in classical Arabic poetry and Arabic literary history, writing for an English-speaking learner of Arabic.

Below is a poem, numbered by verse (bayt). The two halves of a verse are separated by " ‖ ".
${hint?`The learner says: ${hint}\n`:""}
${numbered}

Return ONLY valid JSON (no markdown fences, no commentary) with these keys:
"title": the poem's usual title or famous opening words, in Arabic (if you don't know a title, use its first half-verse),
"titleEn": a short English title,
"poet": the poet's name in English, and "poetAr" the same in Arabic,
"era": the period (for example Pre-Islamic, Umayyad, Abbasid, Andalusi, Mamluk, Modern) with approximate dates,
"topic": the genre or theme in a few words (for example ghazal, fakhr, ritha', hija', madih, wasf, hikma),
"attribution": "sure", "likely" or "unknown" — how confident you are of who wrote it. NEVER guess: if you do not recognise the poem, use "unknown" and set poet to "Unknown",
"lines": an array of EXACTLY ${verses.length} English strings, one per verse in order — a faithful, natural, line-by-line translation that keeps the imagery,
"background": a BRIEF cultural background, 3 to 5 sentences: who wrote it, roughly when, and what occasion or purpose it was written for. If you do not know the occasion, say so plainly rather than inventing one,
"meaning": 3 to 5 sentences on what the poem says and how it develops,
"notes": an array of at most 5 short notes on notable imagery, devices, difficult or archaic words, and the meter (bahr) only if you are confident.
Do not invent facts, anecdotes or quotations.`;
  const data=await callClaude({max_tokens:Math.min(8000,1800+160*verses.length),messages:[{role:"user",content:prompt}]});
  return parseJSON((data.content||[]).map(c=>c.text||"").join(""));
}
// Read the Arabic out of screenshots / photos of a poem. The result goes into the
// text box so it can be checked before translating — handwriting and small vowel
// marks are easy to misread.
async function readImages(images){
  const content=[...images.map(im=>({type:"image",source:{type:"base64",media_type:im.mediaType,data:im.base64}})),
    {type:"text",text:`Transcribe the Arabic poem shown in ${images.length>1?"these images (in order)":"this image"}, exactly as written, keeping every diacritic (tashkeel) you can see. Do not translate, correct, complete or modernise anything.
- Keep the verses in order. When a verse is printed as two halves (two columns, or one half above the other), put BOTH halves of that verse on ONE line, separated by three spaces. When each line is a full verse, one verse per line.
- Skip page numbers, headers, footnotes, commentary, translations and any website or app interface.
- If the image shows a title or poet's name, put them first as "TITLE: …" and "POET: …" lines (leave them out if not shown).
- Return only the transcription, with no commentary.`}];
  const data=await callClaude({max_tokens:4000,messages:[{role:"user",content}]});
  return(data.content||[]).map(c=>c.text||"").join("").trim();
}

async function findSources(p){
  const q=`Find reliable web pages about the Arabic poem "${p.titleEn||p.title}"${p.poet&&p.poet!=="Unknown"?` by ${p.poet}`:""} (it begins: ${(p.verses[0]||[]).join(" ")}). Prefer encyclopedias, university or library pages, poetry archives and reputable Arabic literature sites. Reply with one or two sentences saying what you found.`;
  const data=await callClaude({max_tokens:1200,tools:[{type:"web_search_20250305",name:"web_search",max_uses:4}],messages:[{role:"user",content:q}]});
  const seen=new Set(),out=[];
  const add=(u,t)=>{if(u&&!seen.has(u)){seen.add(u);out.push({url:u,title:t||u});}};
  (data.content||[]).forEach(b=>{
    if(b.type==="web_search_tool_result"&&Array.isArray(b.content))b.content.forEach(r=>add(r.url,r.title));
    (b.citations||[]).forEach(c=>add(c.url,c.title));
  });
  const note=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join(" ").trim().slice(0,400);
  return{links:out.slice(0,8),note};
}

/* ---------- state ---------- */
const P={sel:null,adding:false,editing:false,mode:"read",rev:new Set(),busy:null,layout:"auto",images:[],draft:{title:"",poet:"",text:""}};
const MAX_IMG=4;
// Keep what's typed in the Add form across the re-renders that adding/removing a picture causes.
function snap(){
  const g=id=>{const e=document.getElementById(id);return e?e.value:null;};
  const t=g("po-title"),p=g("po-poet"),x=g("po-text");
  if(t!==null)P.draft.title=t;if(p!==null)P.draft.poet=p;if(x!==null)P.draft.text=x;
}
async function addImgs(fileList){
  const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("image/"));
  if(!files.length)return;
  snap();
  const room=MAX_IMG-P.images.length;
  if(room<=0){toast(`Max ${MAX_IMG} images`,"#D9B45E");return;}
  if(files.length>room)toast(`Only ${room} more image${room!==1?"s":""} allowed`,"#D9B45E");
  for(const f of files.slice(0,room)){
    try{P.images.push(await prepareImage(f));}catch(e){toast("Couldn't read that image","#F07A7A");}
  }
  R();
}
window.PO={
  open(id){P.sel=id;P.adding=false;P.editing=false;P.mode="read";P.rev=new Set();R();window.scrollTo(0,0);},
  back(){P.sel=null;P.adding=false;P.editing=false;R();},
  add(){P.adding=true;P.sel=null;P.images=[];P.draft={title:"",poet:"",text:""};R();},
  pick(files){addImgs(files);},
  rmImg(i){snap();P.images.splice(i,1);R();},
  over(e){e.preventDefault();e.stopPropagation();const d=document.getElementById("po-drop");if(d)d.style.borderColor=GOLD;},
  leave(e){e.preventDefault();e.stopPropagation();const d=document.getElementById("po-drop");if(d)d.style.borderColor="rgba(217,180,94,0.35)";},
  drop(e){e.preventDefault();e.stopPropagation();PO.leave(e);addImgs(e.dataTransfer&&e.dataTransfer.files);},
  async read(){
    if(P.busy||!P.images.length)return;
    snap();
    if(P.draft.text.trim()&&!confirm("Replace the text in the box with what's read from the picture?"))return;
    const btn=document.getElementById("po-read");
    P.busy="read";if(btn){btn.disabled=true;btn.textContent="⏳ Reading the picture…";}
    try{
      let t=await readImages(P.images);
      const m=k=>{const r=t.match(new RegExp("^\\s*"+k+"\\s*:\\s*(.+)$","im"));if(r){t=t.replace(r[0],"");return r[1].trim();}return"";};
      const title=m("TITLE"),poet=m("POET");
      if(title&&!P.draft.title.trim())P.draft.title=title;
      if(poet&&!P.draft.poet.trim())P.draft.poet=poet;
      P.draft.text=t.replace(/^\s*\n/,"").trim();
      if(!P.draft.text)toast("Couldn't find any Arabic in the picture","#D9B45E");
      else toast("Read ✓ — check it against the picture, then translate");
    }catch(e){
      console.error("[Poetry] read failed:",e);
      toast(e.message&&e.message.length<90?e.message:"Could not read the picture","#F07A7A");
    }
    P.busy=null;R();
  },
  setLayout(v){P.layout=v;},
  mode(m){P.mode=m;P.rev=new Set();R();},
  flip(i){if(P.rev.has(i))P.rev.delete(i);else P.rev.add(i);R();},
  revealAll(){const p=cur();if(p)P.rev=new Set(p.verses.map((_,i)=>i));R();},
  hideAll(){P.rev=new Set();R();},
  edit(){P.editing=!P.editing;R();},
  saveEdit(){
    const p=cur();if(!p)return;
    const g=id=>(document.getElementById(id)||{}).value||"";
    p.title=g("pe-title").trim()||p.title;p.titleEn=g("pe-titleEn").trim();p.poet=g("pe-poet").trim()||"Unknown";
    p.era=g("pe-era").trim();p.topic=g("pe-topic").trim();
    put(p);P.editing=false;R();
  },
  async create(){
    if(P.busy)return;
    const g=id=>(document.getElementById(id)||{}).value||"";
    const verses=parsePoem(g("po-text"),P.layout);
    if(!verses.length){toast("Paste the poem's Arabic first","#D9B45E");return;}
    const hint=[g("po-title").trim()&&`title "${g("po-title").trim()}"`,g("po-poet").trim()&&`poet ${g("po-poet").trim()}`].filter(Boolean).join(", ");
    const btn=document.getElementById("po-go");
    P.busy="create";if(btn){btn.disabled=true;btn.textContent="⏳ Translating & explaining…";}
    try{
      const a=await analyze(verses,hint);
      const en=Array.isArray(a.lines)?a.lines.map(String):[];
      if(en.length!==verses.length)toast(`Got ${en.length} translated lines for ${verses.length} verses — check the alignment`,"#D9B45E");
      const p={id:uid(),addedAt:Date.now(),
        title:g("po-title").trim()||a.title||verses[0][0],titleEn:a.titleEn||"",
        poet:g("po-poet").trim()||a.poet||"Unknown",attribution:g("po-poet").trim()?"sure":(a.attribution||"unknown"),
        era:a.era||"",topic:a.topic||"",
        verses:verses.map((v,i)=>({a:v[0],b:v[1],en:en[i]||""})).map(v=>[v.a,v.b,v.en]),
        background:a.background||"",meaning:a.meaning||"",notes:Array.isArray(a.notes)?a.notes.map(String):[],sources:[],ai:true};
      put(p);P.busy=null;P.adding=false;P.sel=p.id;P.mode="read";P.rev=new Set();P.images=[];P.draft={title:"",poet:"",text:""};
      toast("Poem added ✓");
    }catch(e){
      console.error("[Poetry] failed:",e);
      P.busy=null;toast(e.message&&e.message.length<90?e.message:"Could not translate — try again","#F07A7A");
      if(btn){btn.disabled=false;btn.textContent="✦ Translate & explain";}
      return;
    }
    R();window.scrollTo(0,0);
  },
  async retranslate(){
    const p=cur();if(!p||P.busy)return;
    if(!confirm("Redo the translation and explanation? Your edits to them will be replaced."))return;
    P.busy="again";R();
    try{
      const a=await analyze(p.verses.map(v=>[v[0],v[1]]),"");
      const en=Array.isArray(a.lines)?a.lines.map(String):[];
      p.verses=p.verses.map((v,i)=>[v[0],v[1],en[i]||v[2]]);
      p.background=a.background||p.background;p.meaning=a.meaning||p.meaning;p.notes=Array.isArray(a.notes)?a.notes.map(String):p.notes;
      put(p);toast("Updated ✓");
    }catch(e){toast(e.message&&e.message.length<90?e.message:"Could not redo it","#F07A7A");}
    P.busy=null;R();
  },
  async sources(){
    const p=cur();if(!p||P.busy)return;
    P.busy="sources";R();
    try{
      const s=await findSources(p);
      p.sources=s.links;p.sourcesNote=s.note;
      if(!s.links.length)toast("No sources found","#D9B45E");
      put(p);
    }catch(e){
      const m=String(e.message||"");
      toast(/web.?search|tool/i.test(m)?"Web search isn't enabled for your API key":(m.length<90?m:"Could not search"),"#F07A7A");
    }
    P.busy=null;R();
  },
  words(){
    const p=cur();if(!p)return;
    const text=p.verses.map(v=>v[0]+(v[1]?" "+v[1]:"")).join("\n");
    V("import");
    const t=document.getElementById("it");if(t)t.value=text;
  },
  async del(){
    const p=cur();if(!p)return;
    if(!confirm(`Delete "${p.titleEn||p.title}"? This can't be undone.`))return;
    await drop(p.id);P.sel=null;toast("Poem deleted");R();
  }
};
const cur=()=>load().find(p=>p.id===P.sel);

/* ---------- views ---------- */
if(!document.getElementById("poetry-css")){
  const st=document.createElement("style");st.id="poetry-css";
  st.textContent=`.po-cover{filter:blur(8px);opacity:.75;cursor:pointer;user-select:none}
  .po-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center;padding:14px 4px;border-top:1px solid rgba(217,180,94,0.12)}
  .po-ar{display:flex;flex-wrap:wrap;gap:6px 34px;justify-content:center;direction:rtl;${AR}font-size:24px;line-height:2;color:#F0D48A}
  @media(max-width:640px){.po-row{grid-template-columns:1fr;gap:6px}.po-ar{font-size:22px}}`;
  document.head.appendChild(st);
}
const pill=(l,on,h)=>`<button onclick="${h}" style="padding:6px 13px;border-radius:20px;border:1px solid ${on?"rgba(217,180,94,.5)":"rgba(217,180,94,.18)"};background:${on?"rgba(217,180,94,.15)":"transparent"};color:${on?GOLD:SAGE};font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">${l}</button>`;
const btn=(l,h,tone)=>`<button class="btn2" onclick="${h}" style="font-size:12px;padding:8px 14px${tone==="danger"?";color:"+ROSE+";border-color:rgba(240,122,122,.35)":""}">${l}</button>`;
const meta=p=>[p.poet&&p.poet!=="Unknown"?p.poet:(p.poet==="Unknown"?"Poet unknown":""),p.era,p.topic].filter(Boolean).map(esc).join(" · ");

function rList(){
  const a=load().sort((x,y)=>(y.addedAt||0)-(x.addedAt||0));
  const note=cloud==="local"?`<div style="font-size:11px;color:${SAGE};margin-top:12px;line-height:1.5">Saved on this device only. To sync poems across devices, run the SQL in <code>poetry-setup.sql</code> once in Supabase.</div>`:"";
  return`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px">
    <div style="font-family:'Mirza','Amiri',serif;direction:rtl;font-size:26px;color:${GOLD}">الشِّعْرُ</div>
    <button class="btn1" onclick="PO.add()" style="padding:9px 16px;font-size:13px">+ Add poem</button></div>
  <div style="font-size:12px;color:${SAGE};margin-bottom:16px;line-height:1.6">Classical poetry, read verse by verse beside its translation, with a short note on where it comes from.</div>
  ${a.length?a.map(p=>`<div onclick="PO.open('${p.id}')" style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="${AR}font-size:22px;color:#F0D48A;text-align:right;line-height:1.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</div>
        <div style="font-size:13px;color:${INK};margin-top:2px">${esc(p.titleEn||"")}</div>
        <div style="font-size:11px;color:${SAGE};margin-top:3px">${meta(p)}</div></div>
      <div style="font-size:11px;color:${SAGE};flex-shrink:0">${p.verses.length} verse${p.verses.length!==1?"s":""}</div></div>`).join("")
    :`<div style="text-align:center;padding:50px 20px;color:${SAGE}"><div style="font-size:38px;opacity:.5;margin-bottom:10px">📜</div><div style="font-size:14px;color:${INK};margin-bottom:6px">No poems yet</div><div style="font-size:12px;margin-bottom:18px">Paste a classical poem and it appears here, with its translation and background.</div></div>`}${note}`;
}

function rAdd(){
  const sel=(v,l)=>`<option value="${v}"${P.layout===v?" selected":""}>${l}</option>`;
  return`<button onclick="PO.back()" style="background:none;border:none;color:${SAGE};cursor:pointer;font-size:13px;margin-bottom:14px;padding:0">← Back</button>
  <div style="font-family:'Mirza','Amiri',serif;direction:rtl;font-size:26px;color:${GOLD};text-align:right;margin-bottom:6px">إِضَافَةُ قَصِيدَةٍ</div>
  <div style="font-size:12px;color:${SAGE};margin-bottom:16px;line-height:1.6">Paste the Arabic of a poem, or add a screenshot or photo and let AI read it. The translation and background are written by AI from what it knows, so treat them as a study aid and check them with the sources.</div>
  ${apiKey()?"":`<div style="padding:10px 14px;background:rgba(240,122,122,0.08);border:1px solid rgba(240,122,122,0.25);border-radius:10px;margin-bottom:14px;font-size:12px;color:${ROSE}">No API key saved. <span style="cursor:pointer;text-decoration:underline" onclick="V('settings')">Add it in Settings →</span></div>`}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <div><label class="lbl">Title (optional)</label><input id="po-title" class="inp" value="${esc(P.draft.title)}" placeholder="Leave blank to let AI name it"/></div>
    <div><label class="lbl">Poet (optional)</label><input id="po-poet" class="inp" value="${esc(P.draft.poet)}" placeholder="Leave blank if unsure"/></div>
  </div>
  ${P.images.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${P.images.map((im,i)=>`<div style="position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;border:1px solid rgba(217,180,94,0.35)"><img src="${im.dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/><button onclick="PO.rmImg(${i})" title="Remove" style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(4,20,15,0.85);border:1px solid rgba(240,122,122,0.5);color:${ROSE};cursor:pointer;font-size:13px;line-height:1;padding:0;font-family:inherit">×</button></div>`).join("")}</div>`:""}
  ${P.images.length<MAX_IMG?`<div id="po-drop" ondrop="PO.drop(event)" ondragover="PO.over(event)" ondragleave="PO.leave(event)" onclick="document.getElementById('po-file').click()" style="border:1.5px dashed rgba(217,180,94,0.35);border-radius:12px;padding:14px;text-align:center;cursor:pointer;margin-bottom:10px;background:rgba(217,180,94,0.04)">
    <div style="font-size:13px;color:${GOLD};font-weight:600">${P.images.length?"Add another picture":"🖼 Add a screenshot or photo of the poem"}</div>
    <div style="font-size:11px;color:${SAGE};margin-top:3px;line-height:1.5">Tap to choose · drag &amp; drop · or press <strong>Ctrl/Cmd+V</strong> to paste</div></div>
  <input type="file" id="po-file" accept="image/*" multiple style="display:none" onchange="PO.pick(this.files);this.value=''"/>`:""}
  ${P.images.length?`<button class="btn2" id="po-read" onclick="PO.read()" style="width:100%;justify-content:center;display:flex;margin-bottom:6px"${apiKey()?"":" disabled"}>📖 Read the Arabic from the picture${P.images.length>1?"s":""}</button>
  <div style="font-size:11px;color:${SAGE};margin-bottom:12px;line-height:1.5">The text lands in the box below. Check it against the picture — small vowel marks and handwriting are easy to misread — fix anything, then translate.</div>`:""}
  <div style="margin-bottom:12px"><label class="lbl">How is it laid out?</label>
    <select class="inp" style="cursor:pointer;font-size:13px;padding:10px 12px" onchange="PO.setLayout(this.value)">
      ${sel("auto","Auto — two halves on a line if they're separated, otherwise one verse per line")}
      ${sel("pair","One half per line — pair them up into verses")}
      ${sel("single","One verse per line — don't split")}
    </select></div>
  <textarea id="po-text" class="inp" style="${AR}height:230px;resize:vertical;padding:14px;font-size:20px;line-height:2;display:block;margin-bottom:12px" placeholder="الصق القصيدة هنا…">${esc(P.draft.text)}</textarea>
  <button class="btn1" id="po-go" onclick="PO.create()" style="width:100%;justify-content:center"${apiKey()?"":" disabled"}>✦ Translate &amp; explain</button>`;
}

function rPoem(p){
  const hideAr=P.mode==="hideAr",hideEn=P.mode==="hideEn",hideHalf=P.mode==="hideHalf";
  const rows=p.verses.map((v,i)=>{
    const open=P.rev.has(i);
    const a=hideAr&&!open?`<span class="po-cover" onclick="PO.flip(${i})">${esc(v[0])}${v[1]?"</span><span class=\"po-cover\" onclick=\"PO.flip("+i+")\">"+esc(v[1]):""}</span>`
      :`<span>${esc(v[0])}</span>${v[1]?(hideHalf&&!open?`<span class="po-cover" onclick="PO.flip(${i})">${esc(v[1])}</span>`:`<span>${esc(v[1])}</span>`):""}`;
    const en=hideEn&&!open?`<span class="po-cover" onclick="PO.flip(${i})">${esc(v[2])}</span>`:esc(v[2]);
    return`<div class="po-row"><div class="po-ar">${a}</div><div style="font-size:14px;color:${INK};line-height:1.7">${en}</div></div>`;
  }).join("");
  const memo=P.mode!=="read";
  const meta2=meta(p);
  const attr=p.attribution==="unknown"?`<span style="color:${GOLD}">Poet not identified by the AI — add one with Edit if you know it.</span>`:p.attribution==="likely"?`<span style="color:${GOLD}">Attribution is likely, not certain.</span>`:"";
  const sect=(t,b)=>b?`<div style="margin-bottom:14px"><div style="font-size:10px;color:${GOLD};letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px">${t}</div><div style="font-size:13px;color:${INK};line-height:1.75">${b}</div></div>`:"";
  const edit=P.editing?`<div style="background:var(--panel);border:1px solid rgba(217,180,94,0.22);border-radius:12px;padding:14px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${[["pe-title","Title (Arabic)",p.title],["pe-titleEn","Title (English)",p.titleEn],["pe-poet","Poet",p.poet],["pe-era","Era",p.era],["pe-topic","Topic",p.topic]].map(([id,l,v])=>`<div><label class="lbl">${l}</label><input id="${id}" class="inp" value="${esc(v)}"/></div>`).join("")}
    <div style="display:flex;align-items:flex-end"><button class="btn1" onclick="PO.saveEdit()" style="width:100%;justify-content:center">Save</button></div></div>`:"";
  const src=(p.sources&&p.sources.length)?`<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8">${p.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" style="color:${MINT}">${esc(s.title)}</a></li>`).join("")}</ul>${p.sourcesNote?`<div style="font-size:11px;color:${SAGE};margin-top:6px">${esc(p.sourcesNote)}</div>`:""}`:"";
  return`<button onclick="PO.back()" style="background:none;border:none;color:${SAGE};cursor:pointer;font-size:13px;margin-bottom:12px;padding:0">← All poems</button>
  <div style="text-align:center;margin-bottom:14px">
    <div style="${AR}font-size:32px;color:${GOLD};line-height:1.6">${esc(p.title)}</div>
    ${p.titleEn?`<div style="font-size:15px;color:${INK};margin-top:2px">${esc(p.titleEn)}</div>`:""}
    <div style="font-size:12px;color:${SAGE};margin-top:5px">${meta2}</div>
    ${attr?`<div style="font-size:11px;margin-top:4px">${attr}</div>`:""}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:14px">${btn("✎ Edit details","PO.edit()")}${btn("↻ Redo translation","PO.retranslate()")}${btn("🗑 Delete","PO.del()","danger")}</div>
  ${edit}
  ${P.busy==="again"?`<div style="text-align:center;color:${GOLD};font-size:13px;padding:10px">⏳ Redoing the translation…</div>`:""}
  <div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:14px;padding:10px 16px;margin-bottom:6px">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px 0 10px">
      <span style="font-size:10px;color:${SAGE};letter-spacing:.1em;text-transform:uppercase;margin-right:4px">Memorize</span>
      ${pill("Off",P.mode==="read","PO.mode('read')")}${pill("Hide Arabic",P.mode==="hideAr","PO.mode('hideAr')")}${pill("Hide English",P.mode==="hideEn","PO.mode('hideEn')")}${pill("Hide 2nd halves",P.mode==="hideHalf","PO.mode('hideHalf')")}
      ${memo?`<span style="flex:1"></span>${pill("Reveal all",false,"PO.revealAll()")}${pill("Hide all",false,"PO.hideAll()")}`:""}</div>
    ${memo?`<div style="font-size:11px;color:${SAGE};padding-bottom:6px">Tap a blurred line to reveal it. Say it from memory first.</div>`:""}
    ${rows}</div>
  <div style="font-size:11px;color:${SAGE};margin-bottom:18px">Translation and notes are AI-generated from its own knowledge and can be wrong, especially on archaic words — check them against the sources.</div>
  ${sh("Background")}
  <div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:14px;padding:16px;margin-bottom:12px">
    ${sect("Where it comes from",esc(p.background))}${sect("What it says",esc(p.meaning))}
    ${p.notes&&p.notes.length?sect("Worth noticing",`<ul style="margin:0;padding-left:18px">${p.notes.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`):""}</div>
  ${sh("Sources")}
  <div style="background:var(--panel);border:1px solid rgba(217,180,94,0.18);border-radius:14px;padding:16px;margin-bottom:12px">
    ${src||`<div style="font-size:12px;color:${SAGE};margin-bottom:10px;line-height:1.6">Search the web for pages about this poem. You get links to read, nothing is copied into the app.</div>`}
    <div style="margin-top:${src?10:0}px">${P.busy==="sources"?`<span style="color:${GOLD};font-size:13px">⏳ Searching…</span>`:btn(src?"↻ Search again":"🔍 Find sources","PO.sources()")}</div></div>
  <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">${btn("＋ Words from this poem","PO.words()")}</div>
  <div style="font-size:11px;color:${SAGE};text-align:center">Sends the Arabic to AI Import so you can pick words for the Vault.</div>`;
}

// Ctrl/Cmd+V of a screenshot while the Add form is open.
document.addEventListener("paste",e=>{
  if(typeof view==="undefined"||view!=="poetry"||!P.adding)return;
  const files=[];
  for(const it of (e.clipboardData&&e.clipboardData.items)||[]){
    if(it.kind==="file"&&it.type.startsWith("image/")){const f=it.getAsFile();if(f)files.push(f);}
  }
  if(files.length){e.preventDefault();addImgs(files);toast(`${files.length} image${files.length!==1?"s":""} pasted ✓`);}
});

window.rPoetry=function(){
  if(!pulled)pull();
  if(P.adding)return rAdd();
  const p=P.sel&&cur();
  if(p)return rPoem(p);
  P.sel=null;
  return rList();
};
})();
