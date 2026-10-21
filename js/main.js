const YEARS = Object.keys(DATA).map(Number).sort((a,b)=>a-b);
const BUDGET = 150, REROLLS = 3, MIN_PRICE = 0.5;
const SLOTS = [
  {id:'ei',pos:'EI',row:0},{id:'dc',pos:'DC',row:0},{id:'ed',pos:'ED',row:0},
  {id:'mc1',pos:'MC',row:1},{id:'mc2',pos:'MC',row:1},{id:'mc3',pos:'MC',row:1},
  {id:'li',pos:'LI',row:2},{id:'dfc1',pos:'DFC',row:2},{id:'dfc2',pos:'DFC',row:2},{id:'ld',pos:'LD',row:2},
  {id:'por',pos:'POR',row:3},{id:'dt',pos:'DT',row:4}
];
const POS_NAME = {POR:'Arquero',LD:'Lateral derecho',DFC:'Central',LI:'Lateral izquierdo',MC:'Mediocampista',MCO:'Enganche',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Centrodelantero',DT:'Director técnico'};
const ORDER = ['DT','POR','LD','DFC','LI','MC','MCO','EI','ED','DC'];
const ADJ = {EI:['ED','DC','MCO'],ED:['EI','DC','MCO'],DC:['EI','ED','MCO'],MC:['DFC'],DFC:['MC','LD','LI'],LI:['LD','EI'],LD:['LI','ED'],POR:[],DT:[]};
const PEN = 6;
const RIVALS = [
  {rd:'Octavos',pool:[['Banfield',73],['Talleres',74],['Vélez',72]]},
  {rd:'Cuartos',pool:[['Independiente',75],['Estudiantes',76],['San Lorenzo',74]]},
  {rd:'Semifinal',pool:[['Racing',78],['Boca',79],['River',80]]},
  {rd:'Final',pool:[['Palmeiras',82],['Flamengo',81],['Atlético Mineiro',80]]}
];

let S;
function fresh(){return {picks:{},rerolls:REROLLS,season:null,open:null,sim:null}}

const $ = id => document.getElementById(id);
const fmt = n => '€' + n.toFixed(1).replace('.',',') + ' M';
const last = n => { const p = n.split(' '); return p.length>2 && /^(de|la)$/i.test(p[p.length-2]) ? p.slice(-3).join(' ') : p[p.length-1]; };

function fit(slot,p){ if(slot.pos==='MC') return (p==='MC'||p==='MCO')?0:(ADJ.MC.includes(p)?PEN:null);
  if(slot.pos===p) return 0; return ADJ[slot.pos].includes(p)?PEN:null; }
const spent = () => Object.values(S.picks).reduce((a,p)=>a+p.$,0);
const left = () => BUDGET - spent();
const emptySlots = () => SLOTS.filter(s=>!S.picks[s.id]);
const usedNames = () => new Set(Object.values(S.picks).map(p=>p.n));
const afford = price => price <= left() - MIN_PRICE*(emptySlots().length-1) + 1e-9;
function status(pl){
  if(usedNames().has(pl.n)) return {ok:false,why:'Ya está en tu equipo'};
  const opts = emptySlots().map(s=>({s,pen:fit(s,pl.p)})).filter(o=>o.pen!==null).sort((a,b)=>a.pen-b.pen);
  if(!opts.length) return {ok:false,why:'Puesto ocupado'};
  if(!afford(pl.$)) return {ok:false,why:'No te alcanza'};
  return {ok:true,opts};
}
const seasonPlayers = y => [...DATA[y].dt, ...DATA[y].jugadores];
const seasonPlayable = y => seasonPlayers(y).some(p=>status(p).ok);

function teamRating(){
  const xi = SLOTS.filter(s=>s.pos!=='DT'&&S.picks[s.id]).map(s=>S.picks[s.id].r - S.picks[s.id].pen);
  if(!xi.length) return null;
  const avg = xi.reduce((a,b)=>a+b,0)/xi.length;
  const dt = S.picks.dt ? S.picks.dt.r : null;
  return dt===null ? avg : avg*0.85 + dt*0.15;
}

/* ---- render ---- */
function renderPitch(){
  const pitch = $('pitch'); pitch.querySelectorAll('.row').forEach(r=>r.remove());
  for(let r=0;r<4;r++){
    const row=document.createElement('div'); row.className='row';
    SLOTS.filter(s=>s.row===r).forEach(s=>row.appendChild(slotEl(s)));
    pitch.appendChild(row);
  }
  const b=$('bench'); b.innerHTML='<span class="lbl">Banco</span>'; b.appendChild(slotEl(SLOTS[11]));
  const t=teamRating(); $('media').textContent = t===null?'–':Math.round(t);
}
function slotEl(s){
  const p=S.picks[s.id], d=document.createElement('div');
  const openPl = S.open && S.season ? seasonPlayers(S.season).find(x=>key(x)===S.open) : null;
  const hint = openPl && !p && fit(s,openPl.p)!==null;
  d.className='slot'+(p?' filled':'')+(p&&p.r>=88?' top':'')+(hint?' hint':'');
  if(p){
    d.innerHTML=`<div class="disc" title="Valoración">${p.r - p.pen}</div><div class="nm">${last(p.n)}</div><div class="yr">${p.year}${p.pen?` <span class="pen">−${p.pen}</span>`:''}</div>`;
  } else d.innerHTML=`<div class="disc">${s.pos}</div><div class="nm"></div>`;
  return d;
}
function renderMoney(){
  const sp=spent(), l=left(), n=Object.keys(S.picks).length;
  $('left').textContent=fmt(l); $('left').classList.toggle('low', l < 20 && n<12);
  $('count').textContent=n+'/12'; $('spent').textContent='Gastado '+fmt(sp);
  $('rerolls').textContent=S.rerolls+(S.rerolls===1?' retirada':' retiradas');
  $('barfill').style.width=Math.min(100,sp/BUDGET*100)+'%';
}
function renderSteps(){
  const done = Object.keys(S.picks).length===12;
  $('st1').classList.toggle('on', !S.season && !done);
  $('st2').classList.toggle('on', !!S.season);
  $('st3').classList.toggle('on', done);
}
function renderDice(){
  const done = Object.keys(S.picks).length===12;
  const yr=$('yr'), btn=$('roll'), note=$('note');
  note.classList.remove('alert');
  if(done){
    yr.textContent='LISTO'; yr.classList.remove('idle'); $('dtline').textContent='Tu once está completo';
    $('rollTxt').textContent= S.sim ? 'Simular de nuevo' : 'Simular copa'; btn.disabled=false;
    note.textContent='Jugás octavos, cuartos, semi y final. Si perdés, quedás afuera.';
    return;
  }
  if(!S.season){
    yr.textContent='????'; yr.classList.add('idle'); $('dtline').textContent='Tirá el dado para sortear un plantel';
    $('rollTxt').textContent='Tirar'; btn.disabled=false;
    note.textContent='Cada tirada te da un plantel. Elegís un solo jugador (o el DT) y volvés a tirar.';
    return;
  }
  yr.textContent=S.season; yr.classList.remove('idle');
  $('dtline').textContent='DT: '+DATA[S.season].dt.map(d=>d.n).join(' / ');
  const playable = seasonPlayable(S.season);
  if(!playable){
    $('rollTxt').textContent='Tirar gratis'; btn.disabled=false;
    note.textContent='En este plantel no hay nadie que puedas fichar. Volvé a tirar sin gastar retiradas.'; note.classList.add('alert');
  } else {
    $('rollTxt').textContent='Retirar ('+S.rerolls+')'; btn.disabled = S.rerolls<=0;
    note.textContent = S.rerolls>0 ? '¿No te gusta este plantel? Podés retirar, pero son limitadas.' : 'No te quedan retiradas: elegí a alguien de este plantel.';
  }
}
const key = p => p.n+'|'+p.p;
function renderSquad(){
  const box=$('squad');
  if(!S.season){ $('sqTitle').textContent='Plantel'; box.innerHTML=`<p class="empty">${Object.keys(S.picks).length===12?'Equipo completo. Ahora simulá la copa.':'Todavía no salió ninguna temporada.'}</p>`; return; }
  $('sqTitle').textContent='Plantel '+S.season;
  const list=seasonPlayers(S.season).map(p=>({p,st:status(p)}));
  let html='';
  ORDER.forEach(pos=>{
    const g=list.filter(x=>x.p.p===pos).sort((a,b)=>b.p.r-a.p.r);
    if(!g.length) return;
    html+=`<div class="grp">${POS_NAME[pos]}</div>`;
    g.forEach(({p,st})=>{
      const k=key(p), open=S.open===k && st.ok;
      const cls=p.r>=85?'hi':p.r>=75?'mid':'';
      html+=`<div class="pl"><button data-k="${k}" ${st.ok?'':'disabled'} aria-expanded="${open}">
        <span class="rt ${cls}">${p.r}</span>
        <span class="who"><b>${p.n}</b><small>${st.ok?POS_NAME[p.p]:st.why}</small></span>
        <span class="pos">${p.p}</span><span class="price">${fmt(p.$)}</span></button>`;
      if(open){
        html+=`<div class="chips">`+st.opts.map(o=>`<button class="chip${o.pen?' pen':''}" data-place="${k}" data-slot="${o.s.id}">${o.s.pos==='DT'?'Ponerlo de DT':'Ponerlo de '+o.s.pos}${o.pen?' (−'+o.pen+')':''}</button>`).join('')+`</div>`;
      }
      html+=`</div>`;
    });
  });
  box.innerHTML=html;
}
function render(){ renderPitch(); renderMoney(); renderSteps(); renderDice(); renderSquad(); renderSim(); }

/* ---- acciones ---- */
function roll(){
  if(Object.keys(S.picks).length===12){ simulate(); return; }
  if(S.season){
    if(seasonPlayable(S.season)){ if(S.rerolls<=0) return; S.rerolls--; }
  }
  const opts=YEARS.filter(y=>y!==S.season);
  S.season=opts[Math.floor(Math.random()*opts.length)]; S.open=null;
  const box=$('seasonBox'); box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
  render();
}
function place(k,slotId){
  const p=seasonPlayers(S.season).find(x=>key(x)===k); const s=SLOTS.find(x=>x.id===slotId);
  if(!p||!s||S.picks[slotId]) return;
  S.picks[slotId]={...p,year:S.season,pen:fit(s,p.p)};
  S.season=null; S.open=null; render();
  if(Object.keys(S.picks).length===12) $('roll').focus();
}

/* ---- simulación ---- */
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random()}while(p>L);return k-1}
const pick = a => a[Math.floor(Math.random()*a.length)];
function scorer(){
  const w=[];
  SLOTS.forEach(s=>{const p=S.picks[s.id]; if(!p||s.pos==='DT') return;
    const base={DC:6,EI:3.5,ED:3.5,MC:p.p==='MCO'?2.6:1.2,DFC:.6,LI:.7,LD:.7,POR:0}[s.pos];
    w.push([p,base*(0.6+(p.r-p.pen)/100)]);});
  let t=w.reduce((a,x)=>a+x[1],0)*Math.random();
  for(const [p,x] of w){t-=x; if(t<=0) return p;}
  return w[0][0];
}
function playMatch(T,R){
  const d=(T-R)/12;
  const us=poisson(1.35*Math.exp(d)), them=poisson(1.35*Math.exp(-d));
  const goals=[]; for(let i=0;i<us;i++) goals.push({m:1+Math.floor(Math.random()*90),p:scorer()});
  goals.sort((a,b)=>a.m-b.m);
  let pens=null, win=us>them;
  if(us===them){ const pw=Math.min(.8,Math.max(.2,.5+(T-R)*.02)); win=Math.random()<pw;
    const a=3+Math.floor(Math.random()*3), b=a-1-(Math.random()<.4?1:0); pens= win?[a,b]:[b,a]; }
  return {us,them,goals,pens,win};
}
function simulate(){
  const T=teamRating(), res=[];
  for(const r of RIVALS){ const [name,R]=pick(r.pool); const m=playMatch(T,R); res.push({rd:r.rd,name,R,...m}); if(!m.win) break; }
  S.sim={res,T}; render();
  $('sim').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function renderSim(){
  const el=$('sim');
  if(!S.sim){ el.hidden=true; return; }
  el.hidden=false;
  const {res,T}=S.sim, lastM=res[res.length-1], champ=res.length===4&&lastM.win;
  const seven=res.some(m=>m.us-m.them>=7);
  const title = champ ? '¡Campeones de América!' : 'Afuera en '+(lastM.rd==='Final'?'la final':lastM.rd.toLowerCase());
  el.innerHTML=`<div class="verdict"><h2 class="${champ?'win':''}">${title}</h2>${seven?'<span class="seven">¡7 a 0!</span>':''}<span class="media">Media <strong>${Math.round(T)}</strong></span></div>
  <div class="matches">${res.map((m,i)=>`<div class="match${m.win?'':' lost'}" style="animation-delay:${i*120}ms">
    <span class="rd">${m.rd}</span>
    <div class="sc"><span>Lanús vs ${m.name}</span><strong>${m.us} – ${m.them}</strong></div>
    ${m.pens?`<span class="pk">Penales ${m.pens[0]}–${m.pens[1]}</span>`:''}
    <ul>${m.goals.map(g=>`<li>${g.m}' ${g.p.n}</li>`).join('')||'<li>Sin goles de Lanús</li>'}</ul></div>`).join('')}</div>
  <div class="sim-actions"><button class="btn" id="again">Simular de nuevo</button><button class="btn alt" id="newgame">Armar otro equipo</button><button class="ghost" id="copy">Copiar resultado</button></div>`;
}
function shareText(){
  const lines=SLOTS.map(s=>{const p=S.picks[s.id];return `${s.pos} ${p.n} (${p.year})`});
  const {res}=S.sim, lm=res[res.length-1], champ=res.length===4&&lm.win;
  return `El Once Granate · media ${Math.round(S.sim.T)}\n${lines.join('\n')}\n${champ?'Campeón de América':'Afuera en '+lm.rd}: `+res.map(m=>`${m.us}-${m.them} ${m.name}`).join(', ');
}

document.addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.id==='roll') roll();
  else if(t.id==='reset'||t.id==='newgame'){ S=fresh(); render(); window.scrollTo({top:0}); }
  else if(t.id==='again') simulate();
  else if(t.id==='copy'){ const txt=shareText();
    const done=()=>{t.textContent='Copiado'; setTimeout(()=>t.textContent='Copiar resultado',1600)};
    try{ navigator.clipboard.writeText(txt).then(done,()=>fallback(txt)); }catch(err){ fallback(txt); } }
  else if(t.dataset.place) place(t.dataset.place,t.dataset.slot);
  else if(t.dataset.k){ S.open = S.open===t.dataset.k?null:t.dataset.k; renderSquad(); renderPitch(); }
});
function fallback(txt){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='width:100%;height:160px;margin-top:8px';
  ta.setAttribute('aria-label','Resultado para copiar'); $('sim').appendChild(ta); ta.select(); }

function start(data){ S = data && data.picks ? data : fresh(); render(); }
start({});
