const YEARS = Object.keys(DATA).map(Number).sort((a,b)=>a-b);
const BUDGET = 150, REROLLS = 3, MIN_PRICE = 0.5, PEN = 6;

/* Formaciones: filas de arriba (ataque) hacia abajo (arquero). El DT va aparte, en el banco. */
const FORMATIONS = {
  '4-3-3':   [['EI','DC','ED'],['MC','MC','MC'],['LI','DFC','DFC','LD'],['POR']],
  '4-4-2':   [['DC','DC'],['EI','MC','MC','ED'],['LI','DFC','DFC','LD'],['POR']],
  '4-2-3-1': [['DC'],['EI','MCO','ED'],['MC','MC'],['LI','DFC','DFC','LD'],['POR']],
  '4-3-1-2': [['DC','DC'],['MCO'],['MC','MC','MC'],['LI','DFC','DFC','LD'],['POR']],
  '4-1-4-1': [['DC'],['EI','MC','MC','ED'],['MC'],['LI','DFC','DFC','LD'],['POR']],
  '3-5-2':   [['DC','DC'],['LI','MC','MCO','MC','LD'],['DFC','DFC','DFC'],['POR']],
  '3-4-3':   [['EI','DC','ED'],['LI','MC','MC','LD'],['DFC','DFC','DFC'],['POR']],
  '5-3-2':   [['DC','DC'],['MC','MC','MC'],['LI','DFC','DFC','DFC','LD'],['POR']],
  '5-4-1':   [['DC'],['EI','MC','MC','ED'],['LI','DFC','DFC','DFC','LD'],['POR']]
};
function buildSlots(f){
  const rows = FORMATIONS[f], out = [], count = {};
  rows.forEach((row,ri)=>row.forEach(pos=>{ count[pos]=(count[pos]||0)+1; out.push({id:pos.toLowerCase()+count[pos],pos,row:ri}); }));
  out.push({id:'dt1',pos:'DT',row:-1});
  return out;
}
const slots = () => buildSlots(S.formation);

const POS_NAME = {POR:'Arquero',LD:'Lateral derecho',DFC:'Central',LI:'Lateral izquierdo',MC:'Mediocampista',MCO:'Enganche',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Centrodelantero',DT:'Director técnico'};
const ORDER = ['DT','POR','LD','DFC','LI','MC','MCO','EI','ED','DC'];
/* Puestos donde un jugador puede rendir fuera de su posición natural (con −6) */
const ADJ = {EI:['ED','DC','MCO'],ED:['EI','DC','MCO'],DC:['EI','ED','MCO'],MC:['DFC'],MCO:['MC','EI','ED','DC'],DFC:['MC','LD','LI'],LI:['LD','EI'],LD:['LI','ED'],POR:[],DT:[]};

/* Copa: de 16avos a la final. Cada ronda sortea un rival de su bolsa, sin repetir. */
const CUP_TEAMS = {
  isf96:{n:'Independiente Santa Fe',y:1996,c:'COL',r:70},
  pon13:{n:'Ponte Preta',y:2013,c:'BRA',r:70},
  kas14:{n:'Kashiwa Reysol',y:2014,c:'JPN',r:71},
  cam97:{n:'Atlético Mineiro',y:1997,c:'BRA',r:72},
  rac16:{n:'Racing',y:2016,c:'ARG',r:75},
  slo16:{n:'San Lorenzo',y:2016,c:'ARG',r:76},
  dyj20:{n:'Defensa y Justicia',y:2020,c:'ARG',r:76},
  cam25:{n:'Atlético Mineiro',y:2025,c:'BRA',r:78},
  cam14:{n:'Atlético Mineiro',y:2014,c:'BRA',r:79},
  riv17:{n:'River',y:2017,c:'ARG',r:79},
  boc07:{n:'Boca',y:2007,c:'ARG',r:81},
  gre17:{n:'Grêmio',y:2017,c:'BRA',r:82},
  fla26:{n:'Flamengo',y:2026,c:'BRA',r:84}
};
const ROUNDS = [
  {rd:'16avos',  pool:['isf96','pon13','kas14','cam97']},
  {rd:'Octavos', pool:['rac16','slo16','dyj20','cam97']},
  {rd:'Cuartos', pool:['cam25','cam14','riv17','dyj20']},
  {rd:'Semifinal',pool:['riv17','boc07','cam14','gre17']},
  {rd:'Final',   pool:['fla26','gre17','boc07']}
];

let S;
function fresh(f){return {formation:f||'4-3-3',picks:{},rerolls:REROLLS,season:null,open:null,cup:null,msg:null}}

const $ = id => document.getElementById(id);
const fmt = n => '€' + n.toFixed(1).replace('.',',') + ' M';
const last = n => { const p = n.split(' '); return p.length>2 && /^(de|la)$/i.test(p[p.length-2]) ? p.slice(-3).join(' ') : p[p.length-1]; };
const key = p => p.n+'|'+p.p;
const pick = a => a[Math.floor(Math.random()*a.length)];

function fit(slotPos,p){
  if(slotPos==='DT'||p==='DT') return slotPos===p?0:null;
  if(slotPos===p) return 0;
  if(slotPos==='MC' && p==='MCO') return 0;
  return ADJ[slotPos].includes(p)?PEN:null;
}
const nPicks = () => Object.keys(S.picks).length;
const complete = () => nPicks()===12;
const spent = () => Object.values(S.picks).reduce((a,p)=>a+p.$,0);
const left = () => BUDGET - spent();
const emptySlots = () => slots().filter(s=>!S.picks[s.id]);
const usedNames = () => new Set(Object.values(S.picks).map(p=>p.n));
const afford = price => price <= left() - MIN_PRICE*(emptySlots().length-1) + 1e-9;
function status(pl){
  if(usedNames().has(pl.n)) return {ok:false,why:'Ya está en tu equipo'};
  const seen=new Set();
  const opts = emptySlots().map(s=>({s,pen:fit(s.pos,pl.p)})).filter(o=>o.pen!==null && !seen.has(o.s.pos) && seen.add(o.s.pos)).sort((a,b)=>a.pen-b.pen);
  if(!opts.length) return {ok:false,why:'Puesto ocupado'};
  if(!afford(pl.$)) return {ok:false,why:'No te alcanza'};
  return {ok:true,opts};
}
const seasonPlayers = y => [...DATA[y].dt, ...DATA[y].jugadores];
const seasonPlayable = y => seasonPlayers(y).some(p=>status(p).ok);

function teamRating(){
  const xi = slots().filter(s=>s.pos!=='DT'&&S.picks[s.id]).map(s=>S.picks[s.id].r - S.picks[s.id].pen);
  if(!xi.length) return null;
  const avg = xi.reduce((a,b)=>a+b,0)/xi.length;
  return S.picks.dt1 ? avg*0.85 + S.picks.dt1.r*0.15 : avg;
}

/* Cambiar de formación: reacomoda a los ya fichados buscando la menor penalización */
const FAR = 12;
function fitLoose(slotPos,p){ const x=fit(slotPos,p); if(x!==null) return x;
  if(slotPos==='DT'||p==='DT'||slotPos==='POR'||p==='POR') return null; return FAR; }
function reassign(f){
  const target = buildSlots(f), players = Object.values(S.picks);
  let best=null, bestPen=Infinity;
  const order = players.slice().sort((a,b)=>target.filter(s=>fit(s.pos,a.p)!==null).length - target.filter(s=>fit(s.pos,b.p)!==null).length);
  const fitR = (sp,pp) => fitLoose(sp,pp);
  (function go(i,used,acc,pen){
    if(pen>=bestPen) return;
    if(i===order.length){ best={...acc}; bestPen=pen; return; }
    const p=order[i];
    for(const s of target){ if(used.has(s.id)) continue; const x=fitR(s.pos,p.p); if(x===null) continue;
      used.add(s.id); acc[s.id]={...p,pen:x}; go(i+1,used,acc,pen+x); used.delete(s.id); delete acc[s.id]; }
  })(0,new Set(),{},0);
  return best;
}
function setFormation(f){
  if(f===S.formation) return;
  const next = reassign(f);
  if(!next){ S.msg=`Tus jugadores no entran en el ${f}. Probá otra formación o empezá de nuevo.`; render(); return; }
  const far=Object.values(next).filter(p=>p.pen>=FAR).map(p=>last(p.n));
  S.formation=f; S.picks=next; S.cup=null;
  S.msg = far.length ? `En el ${f}, ${far.join(' y ')} ${far.length>1?'juegan':'juega'} muy fuera de puesto (−${FAR}).` : null;
  render();
}

/* ---- render ---- */
function renderFormations(){
  const box=$('formations');
  box.innerHTML=Object.keys(FORMATIONS).map(f=>`<button class="fm${f===S.formation?' on':''}" data-f="${f}" aria-pressed="${f===S.formation}">${f}</button>`).join('');
}
function renderPitch(){
  const pitch=$('pitch'), rows=FORMATIONS[S.formation];
  pitch.querySelectorAll('.row').forEach(r=>r.remove());
  pitch.style.gridTemplateRows=`repeat(${rows.length},minmax(92px,1fr))`;
  const all=slots();
  rows.forEach((_,ri)=>{ const row=document.createElement('div'); row.className='row';
    all.filter(s=>s.row===ri).forEach(s=>row.appendChild(slotEl(s))); pitch.appendChild(row); });
  const b=$('bench'); b.innerHTML='<span class="lbl">Banco</span>'; b.appendChild(slotEl(all[all.length-1]));
  const t=teamRating(); $('media').textContent = t===null?'–':Math.round(t);
  $('fmTitle').textContent='Tu equipo · '+S.formation;
}
function slotEl(s){
  const p=S.picks[s.id], d=document.createElement('div');
  const openPl = S.open && S.season ? seasonPlayers(S.season).find(x=>key(x)===S.open) : null;
  const hint = openPl && !p && fit(s.pos,openPl.p)!==null;
  d.className='slot'+(p?' filled':'')+(p&&p.r>=88?' top':'')+(hint?' hint':'');
  d.innerHTML = p
    ? `<div class="disc" title="Valoración">${p.r - p.pen}</div><div class="nm">${last(p.n)}</div><div class="yr">${p.year}${p.pen?` <span class="pen">−${p.pen}</span>`:''}</div>`
    : `<div class="disc">${s.pos}</div><div class="nm"></div>`;
  return d;
}
function renderMoney(){
  const sp=spent(), l=left(), n=nPicks();
  $('left').textContent=fmt(l); $('left').classList.toggle('low', l<20 && n<12);
  $('count').textContent=n+'/12'; $('spent').textContent='Gastado '+fmt(sp);
  $('rerolls').textContent=S.rerolls+(S.rerolls===1?' retirada':' retiradas');
  $('barfill').style.width=Math.min(100,sp/BUDGET*100)+'%';
}
function renderSteps(){
  $('st1').classList.toggle('on', !S.season && !complete());
  $('st2').classList.toggle('on', !!S.season);
  $('st3').classList.toggle('on', complete());
}
function renderDice(){
  const yr=$('yr'), btn=$('roll'), note=$('note');
  note.classList.remove('alert');
  if(complete()){
    yr.textContent='LISTO'; yr.classList.remove('idle'); $('dtline').textContent='Tu equipo está completo';
    $('rollTxt').textContent = S.cup ? 'Ver la copa' : 'Ir a la copa'; btn.disabled=false;
    note.textContent= S.msg || 'Copa de eliminación directa desde 16avos contra rivales históricos de Lanús.';
    note.classList.toggle('alert',!!S.msg);
    return;
  }
  if(S.msg){ note.textContent=S.msg; note.classList.add('alert'); }
  if(!S.season){
    yr.textContent='????'; yr.classList.add('idle'); $('dtline').textContent='Tirá el dado para sortear un plantel';
    $('rollTxt').textContent='Tirar'; btn.disabled=false;
    if(!S.msg) note.textContent='Cada tirada te da un plantel. Elegís un solo jugador (o el DT) y volvés a tirar.';
    return;
  }
  yr.textContent=S.season; yr.classList.remove('idle');
  $('dtline').textContent='DT: '+DATA[S.season].dt.map(d=>d.n).join(' / ');
  if(!seasonPlayable(S.season)){
    $('rollTxt').textContent='Tirar gratis'; btn.disabled=false;
    note.textContent='En este plantel no hay nadie que puedas fichar. Volvé a tirar sin gastar retiradas.'; note.classList.add('alert');
  } else {
    $('rollTxt').textContent='Retirar ('+S.rerolls+')'; btn.disabled = S.rerolls<=0;
    if(!S.msg) note.textContent = S.rerolls>0 ? '¿No te gusta este plantel? Podés retirar, pero son limitadas.' : 'No te quedan retiradas: elegí a alguien de este plantel.';
  }
}
function renderSquad(){
  const box=$('squad');
  if(!S.season){ $('sqTitle').textContent='Plantel'; box.innerHTML=`<p class="empty">${complete()?'Equipo completo. Ahora jugá la copa.':'Todavía no salió ninguna temporada.'}</p>`; return; }
  $('sqTitle').textContent='Plantel '+S.season;
  const list=seasonPlayers(S.season).map(p=>({p,st:status(p)}));
  let html='';
  ORDER.forEach(pos=>{
    const g=list.filter(x=>x.p.p===pos).sort((a,b)=>b.p.r-a.p.r);
    if(!g.length) return;
    html+=`<div class="grp">${POS_NAME[pos]}</div>`;
    g.forEach(({p,st})=>{
      const k=key(p), open=S.open===k && st.ok, cls=p.r>=85?'hi':p.r>=75?'mid':'';
      html+=`<div class="pl"><button data-k="${k}" ${st.ok?'':'disabled'} aria-expanded="${open}">
        <span class="rt ${cls}">${p.r}</span>
        <span class="who"><b>${p.n}</b><small>${st.ok?POS_NAME[p.p]:st.why}</small></span>
        <span class="pos">${p.p}</span><span class="price">${fmt(p.$)}</span></button>`;
      if(open) html+=`<div class="chips">`+st.opts.map(o=>`<button class="chip${o.pen?' pen':''}" data-place="${k}" data-pos="${o.s.pos}">${o.s.pos==='DT'?'Ponerlo de DT':'Ponerlo de '+o.s.pos}${o.pen?' (−'+o.pen+')':''}</button>`).join('')+`</div>`;
      html+=`</div>`;
    });
  });
  box.innerHTML=html;
}
function render(){ renderFormations(); renderPitch(); renderMoney(); renderSteps(); renderDice(); renderSquad(); renderCup(); }

/* ---- acciones ---- */
function roll(){
  if(complete()){ if(!S.cup) newCup(); render(); $('cup').scrollIntoView({behavior:smooth(),block:'start'}); return; }
  if(S.season && seasonPlayable(S.season)){ if(S.rerolls<=0) return; S.rerolls--; }
  const opts=YEARS.filter(y=>y!==S.season);
  S.season=opts[Math.floor(Math.random()*opts.length)]; S.open=null; S.msg=null;
  const box=$('seasonBox'); box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
  render();
}
function place(k,pos){
  const p=seasonPlayers(S.season).find(x=>key(x)===k);
  const s=emptySlots().find(x=>x.pos===pos);
  if(!p||!s) return;
  S.picks[s.id]={...p,year:S.season,pen:fit(s.pos,p.p)};
  S.season=null; S.open=null; render();
  if(complete()) $('roll').focus();
}
const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';

/* ---- copa ---- */
function newCup(){
  const used=new Set(), rivals=ROUNDS.map(r=>{ const k=pick(r.pool.filter(x=>!used.has(x))); used.add(k); return k; });
  S.cup={rivals,results:[]};
}
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random()}while(p>L);return k-1}
function scorer(){
  const w=[];
  slots().forEach(s=>{const p=S.picks[s.id]; if(!p||s.pos==='DT') return;
    const base={DC:6,EI:3.5,ED:3.5,MCO:2.6,MC:p.p==='MCO'?2.6:1.2,DFC:.6,LI:.7,LD:.7,POR:0}[s.pos];
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
const cupOver = () => S.cup && (S.cup.results.length===ROUNDS.length || S.cup.results.some(r=>!r.win));
function playNext(){
  if(!S.cup||cupOver()) return;
  const i=S.cup.results.length, R=CUP_TEAMS[S.cup.rivals[i]].r;
  S.cup.results.push(playMatch(teamRating(),R)); renderCup();
}
function playAll(){ while(S.cup && !cupOver()) playNext(); }

function renderCup(){
  const el=$('cup');
  if(!complete()||!S.cup){ el.hidden=true; return; }
  el.hidden=false;
  const T=teamRating(), res=S.cup.results, over=cupOver();
  const champ = res.length===ROUNDS.length && res.every(r=>r.win);
  const lost = res.find(r=>!r.win), lostIdx=res.indexOf(lost);
  const seven = res.some(m=>m.us-m.them>=7);
  let title='Copa Granate', sub=`Media de tu equipo: ${Math.round(T)}. Eliminación directa, empate se define por penales.`;
  if(champ){ title='¡Campeones!'; sub='Ganaste las cinco llaves.'; }
  else if(lost){ title='Afuera en '+(ROUNDS[lostIdx].rd==='Final'?'la final':ROUNDS[lostIdx].rd.toLowerCase()); sub=`Te eliminó ${CUP_TEAMS[S.cup.rivals[lostIdx]].n} ${CUP_TEAMS[S.cup.rivals[lostIdx]].y}.`; }
  const nextRd = !over ? ROUNDS[res.length].rd : null;
  el.innerHTML=`<div class="verdict"><div><h2 class="${champ?'win':''}">${title}</h2><p class="note">${sub}</p></div>${seven?'<span class="seven">¡7 a 0!</span>':''}</div>
  <ol class="bracket">${ROUNDS.map((r,i)=>{
    const t=CUP_TEAMS[S.cup.rivals[i]], m=res[i];
    const state = m ? (m.win?'won':'lost') : (lost||i>res.length ? 'locked' : 'next');
    const shown = m || state==='next' || !lost;
    return `<li class="tie ${state}">
      <span class="rd">${r.rd}</span>
      <div class="sc"><span class="team">Lanús</span><strong>${m?m.us:''}</strong></div>
      <div class="sc"><span class="team">${shown?`${t.n} <em>${t.y}</em>`:'—'}</span><strong>${m?m.them:''}</strong></div>
      <span class="pk">${m&&m.pens?`Penales ${m.pens[0]}–${m.pens[1]}`:shown?`${t.c} · media ${t.r}`:''}</span>
      ${m?`<ul>${m.goals.map(g=>`<li>${g.m}' ${last(g.p.n)}</li>`).join('')||'<li>Sin goles de Lanús</li>'}</ul>`:''}
    </li>`;}).join('')}</ol>
  <div class="sim-actions">${!over?`<button class="btn" id="next">Jugar ${nextRd}</button><button class="btn alt" id="all">Simular hasta el final</button>`
    :`<button class="btn" id="again">Jugar otra copa</button><button class="btn alt" id="newgame">Armar otro equipo</button>`}
    <button class="ghost" id="copy">Copiar resultado</button></div>`;
}
function shareText(){
  const lines=slots().map(s=>{const p=S.picks[s.id];return `${s.pos} ${p.n} (${p.year})`});
  const res=S.cup?S.cup.results:[];
  return `Once Granate ${S.formation} · media ${Math.round(teamRating())}\n${lines.join('\n')}\n`+
    res.map((m,i)=>`${ROUNDS[i].rd}: Lanús ${m.us}-${m.them} ${CUP_TEAMS[S.cup.rivals[i]].n} ${CUP_TEAMS[S.cup.rivals[i]].y}${m.pens?` (pen ${m.pens[0]}-${m.pens[1]})`:''}`).join('\n');
}
function fallback(txt){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='width:100%;height:160px;margin-top:8px';
  ta.setAttribute('aria-label','Resultado para copiar'); $('cup').appendChild(ta); ta.select(); }

document.addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.id==='roll') roll();
  else if(t.dataset.f) setFormation(t.dataset.f);
  else if(t.id==='reset'||t.id==='newgame'){ S=fresh(S.formation); render(); window.scrollTo({top:0}); }
  else if(t.id==='next') playNext();
  else if(t.id==='all') playAll();
  else if(t.id==='again'){ newCup(); render(); }
  else if(t.id==='copy'){ const txt=shareText();
    const done=()=>{t.textContent='Copiado'; setTimeout(()=>t.textContent='Copiar resultado',1600)};
    try{ navigator.clipboard.writeText(txt).then(done,()=>fallback(txt)); }catch(err){ fallback(txt); } }
  else if(t.dataset.place) place(t.dataset.place,t.dataset.pos);
  else if(t.dataset.k){ S.open = S.open===t.dataset.k?null:t.dataset.k; renderSquad(); renderPitch(); }
});

function start(data){ S = data && data.picks && data.formation && FORMATIONS[data.formation] ? data : fresh(); render(); }
start({});
