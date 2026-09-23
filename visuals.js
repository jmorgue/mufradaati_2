// Visual effects for the emerald/gold theme. Never touches app data or rules.
(function(){
  "use strict";
  const reduced=()=>window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── the bab: fold the leaves open, then hand over to the existing review setup ──
  window.enterBab=function(el){
    if(!el||el.classList.contains("shut")||el.classList.contains("open"))return;
    el.classList.add("open");
    setTimeout(()=>{ORS();setTimeout(()=>el.classList.remove("open"),900);},reduced()?0:800);
  };

  // ── medina: shared <defs> are fetched once; scene art is parsed once and cloned per card ──
  fetch("medina-defs.html").then(r=>r.text()).then(t=>{
    if(!document.getElementById("medina-defs"))document.body.insertAdjacentHTML("afterbegin",t);
  }).catch(()=>{});
  const cache={};let lastKey=null;
  function hydrateMedina(){
    document.querySelectorAll(".m-world[data-mv]").forEach(el=>{
      const k=+el.dataset.mv;
      if(typeof MEDINA==="undefined")return;
      if(!cache[k]){const t=document.createElement("template");t.innerHTML=MEDINA[k];cache[k]=t.content;}
      el.appendChild(cache[k].cloneNode(true));el.removeAttribute("data-mv");
    });
    const med=document.querySelector(".medina");
    document.body.classList.toggle("medina-mode",!!med);
    if(!med){lastKey=null;return;}
    if(med.dataset.key!==lastKey){
      lastKey=med.dataset.key;
      med.classList.add("m-enter");setTimeout(()=>med.classList.remove("m-enter"),1300);
    }
  }
  window.hydrateMedina=hydrateMedina;

  // every render of the app goes through R(); layer the scene on top of it
  const baseR=window.R;
  window.R=function(){baseR.apply(this,arguments);hydrateMedina();};

  // ── keyboard-only review: Space reveals, then j/k/l grade the card ──
  // j = demote (Again), k = stay (Hard), l = move up (Good) — same three
  // buttons under the card, just reachable without a mouse.
  addEventListener("keydown",e=>{
    const t=e.target;
    if(t&&(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName)||t.isContentEditable))return;
    if(typeof view==="undefined"||view!=="review")return;
    const isSpace=e.code==="Space"||e.key===" "||e.key==="Spacebar";
    if(isSpace&&!fl){e.preventDefault();FC();return;}
    if(!fl)return;
    const k=e.key.toLowerCase();
    if(k==="j"){e.preventDefault();RC("again");}
    else if(k==="k"){e.preventDefault();RC("hard");}
    else if(k==="l"){e.preventDefault();RC("good");}
  });

  // ── sky follows the clock (updated every 5 minutes); stars = mastered words ──
  const SKY_KEYS=[
   [0,[3,17,13],[6,34,25],[4,22,15],0,1],
   [4.6,[3,17,13],[6,34,25],[4,22,15],0,1],
   [5.7,[8,34,44],[20,80,74],[170,125,54],.5,.55],
   [7.4,[8,44,50],[16,76,70],[52,104,86],.3,.22],
   [12,[8,46,52],[18,84,76],[46,100,84],.12,.18],
   [16.6,[8,44,50],[16,76,70],[66,104,80],.28,.2],
   [18.3,[8,32,42],[34,74,60],[200,128,54],.6,.5],
   [19.7,[5,26,28],[10,46,40],[110,76,40],.3,.9],
   [21.2,[3,17,13],[6,34,25],[4,22,15],0,1],
   [24,[3,17,13],[6,34,25],[4,22,15],0,1]];
  function _lerp(a,b,t){return a+(b-a)*t;}
  function skyAt(h){
    let i=0;while(i<SKY_KEYS.length-2&&h>=SKY_KEYS[i+1][0])i++;
    const a=SKY_KEYS[i],b=SKY_KEYS[i+1];const t=Math.max(0,Math.min(1,(h-a[0])/(b[0]-a[0])));
    const mix=(x,y)=>x.map((v,k)=>Math.round(_lerp(v,y[k],t)));
    return{top:mix(a[1],b[1]),mid:mix(a[2],b[2]),low:mix(a[3],b[3]),glow:_lerp(a[4],b[4],t),stars:_lerp(a[5],b[5],t)};
  }
  function _orbPlace(el,h,start,end){
    if(!el)return;
    if(h<start||h>end){el.style.opacity=0;return;}
    const p=(h-start)/(end-start);
    el.style.left=(6+88*p)+"%";el.style.top=(66-46*Math.sin(Math.PI*p))+"%";el.style.opacity=1;
  }
  function applySky(){
    const d=new Date();const h=d.getHours()+d.getMinutes()/60;
    const s=skyAt(h);const r=document.documentElement.style;
    r.setProperty("--sky-top","rgb("+s.top+")");r.setProperty("--sky-mid","rgb("+s.mid+")");r.setProperty("--sky-low","rgb("+s.low+")");
    r.setProperty("--sky-glow",s.glow.toFixed(2));r.setProperty("--star-a",Math.max(.2,s.stars).toFixed(2));
    _orbPlace(document.getElementById("sun"),h,5.6,18.4);
    _orbPlace(document.getElementById("moon"),h<5.6?h+24:h,18.4,29.6);
  }
  let starN=-1,starW=0,starH=0,twink=[];
  function seeded(seed){let s=seed;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};}
  function masteredCount(){try{return bw().filter(w=>w.leitnerLevel==="M").length;}catch(e){return 0;}}
  function refreshStars(force){
    const c=document.getElementById("stars"),c2=document.getElementById("stars2");if(!c||!c2)return;
    const n=Math.min(1500,masteredCount());const w=innerWidth,h=innerHeight;
    if(!force&&n===starN&&w===starW&&h===starH)return;
    starN=n;starW=w;starH=h;twink=[];
    const dpr=Math.min(2,window.devicePixelRatio||1);
    [c,c2].forEach(cv=>{cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);});
    const g=c.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const rnd=seeded(1337);
    for(let i=0;i<n;i++){
      const x=rnd()*w,y=Math.pow(rnd(),1.3)*h*.8,r=.5+Math.pow(rnd(),3)*1.6,a=.35+rnd()*.65,gold=rnd()<.35;
      g.globalAlpha=a;g.fillStyle=gold?"#F6DC96":"#DFF6EE";g.beginPath();g.arc(x,y,r,0,6.2832);g.fill();
      if(r>1.6){g.globalAlpha=a*.5;g.fillRect(x-r*2.2,y-.4,r*4.4,.8);g.fillRect(x-.4,y-r*2.2,.8,r*4.4);}
      if(i%14===0)twink.push([x,y,r,gold]);
    }
  }
  function twinkle(){
    const c=document.getElementById("stars2");if(!c||!twink.length||reduced())return;
    const dpr=Math.min(2,window.devicePixelRatio||1);const g=c.getContext("2d");
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,starW,starH);
    twink.forEach(([x,y,r,gold])=>{
      if(Math.random()<.55)return;
      g.globalAlpha=.25+Math.random()*.7;g.fillStyle=gold?"#FFF0BE":"#FFFFFF";
      g.beginPath();g.arc(x,y,r*1.5+.6,0,6.2832);g.fill();
      g.globalAlpha*=.6;g.fillRect(x-r*3,y-.5,r*6,1);g.fillRect(x-.5,y-r*3,1,r*6);
    });
  }
  applySky();refreshStars(true);
  setInterval(applySky,300000);setInterval(twinkle,650);
  let rs;addEventListener("resize",()=>{clearTimeout(rs);rs=setTimeout(()=>refreshStars(true),200);});

  // ── answer feedback: lanterns flare (right) or gutter (missed), card lifts or swings back ──
  let fxBusy=false;
  function spawnSparks(med){
    const layer=med.querySelector(".fx-layer");if(!layer)return;
    const mr=med.getBoundingClientRect();
    med.querySelectorAll(".m-lan").forEach(l=>{
      const r=l.getBoundingClientRect();if(r.width<8)return;
      const cx=r.left+r.width/2-mr.left,cy=r.top+r.height*.55-mr.top;
      const n=Math.max(2,Math.round(r.width/9));
      for(let i=0;i<n;i++){
        const s=document.createElement("i");s.className="spark";s.style.left=cx+"px";s.style.top=cy+"px";
        s.style.setProperty("--dx",((Math.random()-.5)*46)+"px");s.style.setProperty("--dy",(-(30+Math.random()*70))+"px");
        s.style.animationDelay=(Math.random()*.15)+"s";layer.appendChild(s);
      }
    });
  }
  function fxPlay(kind,cb){
    const med=document.querySelector(".medina");
    if(!med||reduced()){cb();return;}
    if(fxBusy)return;fxBusy=true;
    med.classList.add(kind==="correct"?"fx-good":"fx-bad");
    if(kind==="correct")spawnSparks(med);
    setTimeout(()=>{fxBusy=false;cb();},kind==="correct"?740:660);
  }
  // the same ratings as before — the animation just plays first
  const baseRC=window.RC;
  window.RC=function(a){
    if(a==="hard")return baseRC(a);
    return fxPlay(a==="good"?"correct":"incorrect",()=>baseRC(a));
  };

  // ── summary lanterns + fill vessel ──
  window.lanternRowHtml=function(c,t){
    if(!t)return"";
    const N=Math.min(t,24);const lit=Math.round(c/t*N);let h='<div class="lan-row">';
    for(let i=0;i<N;i++)h+='<svg class="'+(i<lit?"on":"off")+'" viewBox="0 0 44 100" style="animation-delay:'+(i*.07).toFixed(2)+'s"><use href="#lan"/></svg>';
    return h+'</div><div class="lan-cap">'+c+' of '+t+' lanterns lit</div>';
  };
  window.vesselHtml=function(inPlay,target){
    const pct=Math.max(0,Math.min(1,inPlay/Math.max(1,target)));const y=80-43*pct;const over=inPlay>target;
    return '<svg class="vessel'+(inPlay>=target?" full":"")+'" viewBox="0 0 44 100" width="30" height="68" aria-hidden="true"><defs>'
     +'<clipPath id="vsl"><path d="M12 37.4H32L35 62L32 80H12L9 62Z"/></clipPath>'
     +'<linearGradient id="vslg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3C4"/><stop offset="1" stop-color="#E6A93E"/></linearGradient></defs>'
     +'<line x1="22" y1="0" x2="22" y2="13" stroke="#E6C36E" stroke-opacity=".8"/><circle cx="22" cy="15" r="3" fill="none" stroke="#E6C36E" stroke-width="1.3"/>'
     +'<path d="M13 34L22 19L31 34Z" fill="#C9973A" stroke="#F0D48A" stroke-width=".8"/><rect x="11" y="34" width="22" height="3.4" rx="1" fill="#D9B45E"/>'
     +'<path d="M12 37.4H32L35 62L32 80H12L9 62Z" fill="#0B1F19" fill-opacity=".75"/>'
     +'<g clip-path="url(#vsl)"><rect x="6" y="'+y.toFixed(1)+'" width="32" height="48" fill="url(#vslg)"/></g>'
     +'<path d="M12 37.4H32L35 62L32 80H12L9 62Z" fill="none" stroke="#F0D48A" stroke-width=".9"/>'
     +'<path d="M12 80L16 87H28L32 80Z" fill="#C9973A" stroke="#F0D48A" stroke-width=".7"/><circle cx="22" cy="93" r="2.6" fill="#F6DC96"/></svg>'
     +(over?'<div class="vessel-over">+'+(inPlay-target)+'</div>':"");
  };

  // stars follow the mastered count after every render
  const layeredR=window.R;
  window.R=function(){layeredR.apply(this,arguments);refreshStars(false);};
})();
