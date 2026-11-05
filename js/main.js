const YEARS = Object.keys(DATA).map(Number).sort((a,b)=>a-b);
const BUDGET = 150, REROLLS = 3, MIN_PRICE = 0.5, PEN = 6;
/* Compra de jugadores suspendida: sin presupuesto ni precios. Poné true para volver a activarla. */
const PURCHASE = false;

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
  isf96:{n:'Independiente Santa Fe',y:1996,c:'COL',r:73},
  pon13:{n:'Ponte Preta',y:2013,c:'BRA',r:73},
  kas14:{n:'Kashiwa Reysol',y:2014,c:'JPN',r:74},
  cam97:{n:'Atlético Mineiro',y:1997,c:'BRA',r:75},
  rac16:{n:'Racing',y:2016,c:'ARG',r:77},
  slo16:{n:'San Lorenzo',y:2016,c:'ARG',r:78},
  dyj20:{n:'Defensa y Justicia',y:2020,c:'ARG',r:78},
  cam25:{n:'Atlético Mineiro',y:2025,c:'BRA',r:80},
  cam14:{n:'Atlético Mineiro',y:2014,c:'BRA',r:81},
  riv17:{n:'River',y:2017,c:'ARG',r:81},
  boc07:{n:'Boca',y:2007,c:'ARG',r:83},
  gre17:{n:'Grêmio',y:2017,c:'BRA',r:84},
  fla26:{n:'Flamengo',y:2026,c:'BRA',r:85}
};
const ROUNDS = [
  {rd:'16avos',  pool:['isf96','pon13','kas14','cam97']},
  {rd:'Octavos', pool:['rac16','slo16','dyj20','cam97']},
  {rd:'Cuartos', pool:['cam25','cam14','riv17','dyj20']},
  {rd:'Semifinal',pool:['riv17','boc07','cam14','gre17']},
  {rd:'Final',   pool:['fla26','gre17','boc07']}
];

/* Copa Granate: tu 11 contra los planteles de Lanús, del peor al mejor.
   La fuerza de cada plantel sale de su mejor 4-3-3 + DT, con las mismas valoraciones ocultas. */
const LANUS_HANDICAP = 3.5;  // los planteles rivales juegan un poco por debajo de su mejor 11, para ganar ~1 de cada 5
function squadRating(y){
  const NEED={POR:1,LD:1,DFC:2,LI:1,MC:3,EI:1,DC:1,ED:1};
  const ps=DATA[y].jugadores.slice().sort((a,b)=>b.r-a.r), used=new Set(), xi=[];
  for(const [pos,k] of Object.entries(NEED)){
    let c=0; for(const p of ps){ if(c===k) break; if(fit(pos,p.p)===0 && !used.has(p.n)){ used.add(p.n); xi.push(p.r); c++; } }
    while(c<k){ const p=ps.find(q=>!used.has(q.n)); if(!p) break; used.add(p.n); xi.push(p.r-PEN); c++; }
  }
  const dt=Math.max(...DATA[y].dt.map(d=>d.r));
  return xi.reduce((a,b)=>a+b,0)/xi.length*.85 + dt*.15;
}
const BY_STRENGTH = YEARS.slice().sort((a,b)=>squadRating(a)-squadRating(b));
YEARS.forEach(y=>{ CUP_TEAMS['lan'+y]={n:'Lanús',y,c:'DT '+DATA[y].dt.map(d=>d.n.split(' ').slice(-1)[0]).join(' / '),r:squadRating(y)-LANUS_HANDICAP}; });
const LANUS_ROUNDS = (()=>{ // reparte los planteles en 5 rondas: los más flojos en 16avos, los mejores en la final
  const n=BY_STRENGTH.length, cuts=[0,.25,.42,.58,.75,1].map(f=>Math.round(f*n));
  return ROUNDS.map((r,i)=>({rd:r.rd,pool:BY_STRENGTH.slice(cuts[i],cuts[i+1]).map(y=>'lan'+y)}));
})();
const CUP_MODES = {
  hist: {name:'Copa Internacional', desc:'Contra rivales que Lanús enfrentó en finales y partidos históricos.', rounds:ROUNDS},
  lanus:{name:'Copa Granate', desc:'Tu 11 contra los planteles de Lanús: arrancás con los más flojos y en la final te espera uno de los mejores.', rounds:LANUS_ROUNDS}
};

let S;
const MAX_USES = 2;
/* Camisetas por temporada: img/camisetas/AÑO.png (si falta alguna, no se muestra nada) */
const KITS = window.KITS || {};
const HAS_KIT = window.KITS ? (y=>!!KITS[y]) : (y=>true);
const kitSrc = y => KITS[y] || `img/camisetas/${y}.png`;
const kitImg = (y,cls='kit') => HAS_KIT(y) ? `<img class="${cls}" src="${kitSrc(y)}" alt="Camiseta ${y}" onerror="this.remove()">` : '';
function showKit(el,y){ if(!y||!HAS_KIT(y)){ el.hidden=true; el.removeAttribute('src'); return; } el.onerror=()=>{el.hidden=true}; el.src=kitSrc(y); el.alt='Camiseta '+y; el.hidden=false; }
function fresh(f){return {formation:f||'4-3-3',picks:{},uses:{},rerolls:REROLLS,season:null,open:null,cup:null,msg:null}}
const usesOf = y => (S.uses||{})[y]||0;

const $ = id => document.getElementById(id);
const fmt = n => '€' + n.toFixed(1).replace('.',',') + ' M';
const last = n => { const p = n.split(' '); return p.length>2 && /^(de|la)$/i.test(p[p.length-2]) ? p.slice(-3).join(' ') : p[p.length-1]; };
const key = p => p.n+'|'+p.p;
const pick = a => a[Math.floor(Math.random()*a.length)];

/* Un jugador puede tener varios puestos ("LD/DFC/MC"): en todos juega sin penalización. El primero es el principal. */
function posList(p){ return String(p).split('/'); }
function mainPos(p){ return posList(p)[0]; }
function fit(slotPos,p){
  const L=posList(p);
  if(slotPos==='DT'||L.includes('DT')) return (slotPos==='DT'&&L.includes('DT'))?0:null;
  if(L.includes(slotPos)) return 0;
  return null; // sin puestos parecidos: solo juega donde figura en el Excel
}
const nPicks = () => Object.keys(S.picks).length;
const complete = () => nPicks()===12;
const spent = () => Object.values(S.picks).reduce((a,p)=>a+p.$,0);
const left = () => BUDGET - spent();
const emptySlots = () => slots().filter(s=>!S.picks[s.id]);
const usedNames = () => new Set(Object.values(S.picks).map(p=>p.n));
const afford = price => !PURCHASE || price <= left() - MIN_PRICE*(emptySlots().length-1) + 1e-9;
function status(pl){
  if(usedNames().has(pl.n)) return {ok:false,why:'Ya está en tu equipo'};
  const seen=new Set(), L=posList(pl.p), ord=x=>{ const i=L.indexOf(x===('MC')&&!L.includes('MC')?'MCO':x); return i<0?99:i; };
  const opts = emptySlots().map(s=>({s,pen:fit(s.pos,pl.p)})).filter(o=>o.pen!==null && !seen.has(o.s.pos) && seen.add(o.s.pos)).sort((a,b)=>a.pen-b.pen || ord(a.s.pos)-ord(b.s.pos));
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
  const L=posList(p); if(slotPos==='DT'||L.includes('DT')||slotPos==='POR'||L.includes('POR')) return null; return FAR; }
function reassign(f){
  const target = buildSlots(f), players = Object.values(S.picks);
  let best=null, bestPen=Infinity;
  const order = players.slice().sort((a,b)=>target.filter(s=>fit(s.pos,a.p)!==null).length - target.filter(s=>fit(s.pos,b.p)!==null).length);
  const fitR = (sp,pp) => fit(sp,pp);
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
  if(f===S.formation || cupStarted()) return;
  const next = reassign(f);
  if(!next){ S.msg=`Tus jugadores no entran en el ${f}: cada uno solo juega en los puestos que tiene. Elegí la formación antes de armar o empezá de nuevo.`; render(); return; }
  const far=Object.values(next).filter(p=>p.pen>=FAR).map(p=>last(p.n));
  S.formation=f; S.picks=next; S.cup=null;
  S.msg = far.length ? `En el ${f}, ${far.join(' y ')} ${far.length>1?'juegan':'juega'} muy fuera de puesto.` : null;
  render();
}

/* Nivel del equipo: se calcula con las valoraciones ocultas y solo se muestra el nombre */
const LEVELS = [
  {max:78,  n:'Pelea el descenso', d:'Hay que sumar de a uno para mantener la categoría.'},
  {max:81,  n:'Mitad de tabla',    d:'Un equipo correcto: le gana a los de abajo y sufre con los de arriba.'},
  {max:84,  n:'Entra a copas',     d:'Le alcanza para clasificar y jugar afuera.'},
  {max:87,  n:'Candidato',         d:'Pelea el campeonato hasta la última fecha.'},
  {max:999, n:'Equipo de época',   d:'Un once para recordar durante años.'}
];
const levelOf = T => LEVELS.findIndex(l=>T<l.max);
function renderLevel(){
  const el=$('level'), T=teamRating();
  if(T===null){ el.className='level'; el.innerHTML='<span class="lab">Nivel</span><b>—</b><small>Fichá jugadores para ver el nivel de tu equipo.</small>'; return; }
  const i=levelOf(T), L=LEVELS[i], parcial=!complete();
  el.className='level l'+i;
  el.innerHTML=`<span class="lab">Nivel${parcial?' hasta ahora':''}</span><b>${L.n}</b>
    <span class="meter" aria-hidden="true">${LEVELS.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</span><small>${L.d}</small>`;
}

/* ---- render ---- */
function renderFormations(){
  const box=$('formations');
  const lock=cupStarted();
  box.innerHTML=Object.keys(FORMATIONS).map(f=>`<button class="fm${f===S.formation?' on':''}" data-f="${f}" aria-pressed="${f===S.formation}" ${lock&&f!==S.formation?'disabled':''}>${f}</button>`).join('')
    + (lock?'<span class="locked-note">La formación queda fija mientras jugás la copa.</span>':'');
}
function renderPitch(){
  const pitch=$('pitch'), rows=FORMATIONS[S.formation];
  pitch.querySelectorAll('.row').forEach(r=>r.remove());
  pitch.style.gridTemplateRows=`repeat(${rows.length},minmax(92px,1fr))`;
  const all=slots();
  rows.forEach((_,ri)=>{ const row=document.createElement('div'); row.className='row';
    all.filter(s=>s.row===ri).forEach(s=>row.appendChild(slotEl(s))); pitch.appendChild(row); });
  const b=$('bench'); b.innerHTML='<span class="lbl">Banco</span>'; b.appendChild(slotEl(all[all.length-1]));
  $('media').textContent = nPicks()+'/12';
  $('fmTitle').textContent='Tu equipo · '+S.formation;
}
function slotEl(s){
  const p=S.picks[s.id];
  const openPl = S.open && S.season ? seasonPlayers(S.season).find(x=>key(x)===S.open) : null;
  const hint = openPl && !p && fit(s.pos,openPl.p)!==null;
  // los lugares donde puede jugar el jugador elegido se vuelven botones: un click y queda ubicado ahí
  const d=document.createElement(hint?'button':'div');
  if(hint){ d.type='button'; d.dataset.put=s.id; d.dataset.who=S.open; d.setAttribute('aria-label',`Poner a ${openPl.n} de ${s.pos}`); }
  d.className='slot'+(p?' filled':'')+(hint?' hint':'');
  d.innerHTML = p
    ? `<div class="disc">${s.pos}</div><div class="nm">${last(p.n)}</div><div class="yr">${p.year}${p.pen?` <span class="pen">fuera de puesto</span>`:''}</div>`
    : `<div class="disc">${s.pos}</div><div class="nm"></div>`;
  return d;
}
/* mini cancha: misma formación en chiquito, para ver cómo queda el equipo sin bajar hasta la cancha */
function renderMini(){
  const rows=FORMATIONS[S.formation], all=slots(), dt=all[all.length-1];
  const openPl = S.open && S.season ? seasonPlayers(S.season).find(x=>key(x)===S.open) : null;
  const spot=s=>{ const p=S.picks[s.id], hint=openPl && !p && fit(s.pos,openPl.p)!==null;
    const cls='ms'+(p?' filled':'')+(hint?' hint':''), inner=`<i>${s.pos}</i><span>${p?last(p.n):''}</span>`;
    return hint ? `<button type="button" class="${cls}" data-put="${s.id}" data-who="${S.open}" aria-label="Poner a ${openPl.n} de ${s.pos}">${inner}</button>`
                : `<div class="${cls}">${inner}</div>`; };
  $('miniRows').innerHTML = rows.map((_,ri)=>`<div class="mini-row">${all.filter(s=>s.row===ri).map(spot).join('')}</div>`).join('');
  const d=S.picks[dt.id], dHint=openPl && !d && fit(dt.pos,openPl.p)!==null;
  $('miniDt').innerHTML = dHint ? `<button type="button" class="mdt hint" data-put="${dt.id}" data-who="${S.open}">Poner de DT</button>`
                                : `<span class="mdt">DT: <b>${d?last(d.n):'—'}</b></span>`;
  $('miniCount').textContent=nPicks()+'/12';
  syncMini();
}
let miniSmall=false;
let pitchSeen=true, deskSeen=false;
function syncMini(){ const m=$('mini'); if(!m) return;
  m.hidden = !(matchMedia('(max-width:900px)').matches && !pitchSeen && deskSeen && !complete()); }
function renderMoney(){
  $('moneyPanel').hidden = !PURCHASE; if(!PURCHASE) return;
  const sp=spent(), l=left(), n=nPicks();
  $('left').textContent=fmt(l); $('left').classList.toggle('low', l<20 && n<12);
  $('count').textContent=n+'/12'; $('spent').textContent='Gastado '+fmt(sp);
  $('rerolls').textContent=S.rerolls+(S.rerolls===1?' repetición':' repeticiones');
  $('barfill').style.width=Math.min(100,sp/BUDGET*100)+'%';
}
function renderSteps(){
  $('st1').classList.toggle('on', !S.season && !complete());
  $('st2').classList.toggle('on', !!S.season);
  $('st3').classList.toggle('on', complete());
}
function syncFab(){ const f=$('fab'); if(!f) return; $('fabTxt').textContent=$('rollTxt').textContent; f.disabled=$('roll').disabled; f.hidden=!fabWanted;
  // el botón late solo cuando el siguiente paso es tirar el dado
  // anima el botón mientras espera que tires, y también "Ir a la copa" hasta que entrás a la copa
  const wait=(!S.season && !complete()) || (complete() && !S.cup); $('roll').classList.toggle('attn',wait); f.classList.toggle('attn',wait); }
let fabWanted=false;
function renderDice(){
  const yr=$('yr'), btn=$('roll'), note=$('note');
  note.classList.remove('alert');
  if(complete()){
    yr.textContent='LISTO'; yr.classList.remove('idle'); showKit($('yrKit'),null); $('dtline').textContent='Tu equipo está completo';
    $('rollTxt').textContent = S.cup ? 'Ver la copa' : 'Ir a la copa'; btn.disabled=false;
    note.textContent= S.msg || 'Copa de eliminación directa desde 16avos contra rivales históricos de Lanús.';
    note.classList.toggle('alert',!!S.msg);
    return;
  }
  if(S.msg){ note.textContent=S.msg; note.classList.add('alert'); }
  if(!S.season){
    yr.textContent='????'; yr.classList.add('idle'); showKit($('yrKit'),null); $('dtline').textContent='Tirá el dado para sortear un plantel';
    $('rollTxt').textContent='Tirar'; btn.disabled=false;
    if(!S.msg) note.textContent='Cada tirada te da un plantel. Elegís un solo jugador (o el DT) y volvés a tirar. Cada plantel se puede usar hasta 2 veces.';
    return;
  }
  yr.textContent=S.season; yr.classList.remove('idle'); showKit($('yrKit'),S.season);
  $('dtline').innerHTML='DT: '+DATA[S.season].dt.map(d=>d.n).join(' / ')+(usesOf(S.season)?` · <span class="uses">Última vez que podés usar este plantel</span>`:'');
  if(!seasonPlayable(S.season)){
    $('rollTxt').textContent='Tirar gratis'; btn.disabled=false;
    note.textContent='En este plantel no hay nadie que puedas fichar. Volvé a tirar sin gastar repeticiones.'; note.classList.add('alert');
  } else {
    $('rollTxt').textContent='Repetir ('+S.rerolls+')'; btn.disabled = S.rerolls<=0;
    if(!S.msg) note.textContent = S.rerolls>0 ? '¿No te gusta este plantel? Podés repetir la tirada, pero son limitadas.' : 'No te quedan repeticiones: elegí a alguien de este plantel.';
  }
}
function renderSquad(){
  const box=$('squad');
  $('squadHint').hidden=true;
  if(!S.season){ $('sqTitle').textContent='Plantel'; box.innerHTML=`<p class="empty">${complete()?'Equipo completo. Ahora jugá la copa.':'Tirá el dado para sortear un plantel.'}</p>`; return; }
  $('sqTitle').innerHTML='Plantel '+S.season+kitImg(S.season,'kit kit-sm');
  const prevScroll = box.querySelector('.squad-list')?.scrollTop ?? 0;
  const list=seasonPlayers(S.season).map(p=>({p,st:status(p)}));
  let html='';
  ORDER.forEach(pos=>{
    const g=list.filter(x=>mainPos(x.p.p)===pos).sort((a,b)=>a.p.n.localeCompare(b.p.n,'es'));
    if(!g.length) return;
    html+=`<div class="grp">${POS_NAME[pos]}</div>`;
    g.forEach(({p,st})=>{
      const k=key(p), open=S.open===k && st.ok;
      html+=`<div class="pl"><button data-k="${k}" ${st.ok?'':'disabled'} aria-expanded="${open}">
        <span class="who"><b>${p.n}</b><small>${st.ok?posList(p.p).map(x=>POS_NAME[x]).join(' · '):st.why}</small></span>
        <span class="pos">${p.p}</span>${PURCHASE?`<span class="price">${fmt(p.$)}</span>`:''}</button>`;
      if(open) html+=`<div class="chips">`+st.opts.map(o=>`<button class="chip${o.pen?' pen':''}" data-place="${k}" data-pos="${o.s.pos}">${o.s.pos==='DT'?'Ponerlo de DT':'Ponerlo de '+o.s.pos}${o.pen?' (fuera de puesto)':''}</button>`).join('')+`<span class="tap">O tocá el lugar resaltado en la cancha.</span></div>`;
      html+=`</div>`;
    });
  });
  box.innerHTML='<div class="squad-list" id="squadList" tabindex="0" aria-label="Jugadores del plantel">'+html+'</div>';
  const sl=$('squadList'); sl.scrollTop = S.open ? prevScroll : 0;
  $('squadHint').hidden = sl.scrollHeight <= sl.clientHeight;
}
function render(){ try{ renderAll(); } finally { syncFab(); maybeSummary(); } }
function renderAll(){ renderLevel(); renderFormations(); renderPitch(); renderMoney(); renderSteps(); renderDice(); renderSquad(); renderCup(); renderMini(); }

/* ---- acciones ---- */
function roll(){
  if(complete()){ if(!S.cup) newCup(); render(); $('cup').scrollIntoView({behavior:smooth(),block:'start'}); return; }
  if(S.season && seasonPlayable(S.season)){ if(S.rerolls<=0) return; S.rerolls--; }
  const opts=YEARS.filter(y=>y!==S.season && usesOf(y)<MAX_USES);
  if(!opts.length) return;
  S.season=opts[Math.floor(Math.random()*opts.length)]; S.open=null; S.msg=null;
  const box=$('seasonBox'); box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
  render();
}
function place(k,pos,slotId){
  const p=seasonPlayers(S.season).find(x=>key(x)===k);
  const s=slotId ? emptySlots().find(x=>x.id===slotId) : emptySlots().find(x=>x.pos===pos);
  if(p && s && (fit(s.pos,p.p)===null || !status(p).ok)) return;
  if(!p||!s) return;
  S.picks[s.id]={...p,year:S.season,pen:fit(s.pos,p.p)};
  S.uses=S.uses||{}; S.uses[S.season]=usesOf(S.season)+1;
  S.season=null; S.open=null; render();
  if(complete()) $('roll').focus();
}
const GAME_URL='https://nibra3.github.io/11granate/';
const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';

/* ---- copa ---- */
function newCup(mode){
  mode = mode || (S.cup&&S.cup.mode) || S.cupMode || 'hist';
  S.cupMode = mode;
  const used=new Set(), rivals=CUP_MODES[mode].rounds.map(r=>{ const k=pick(r.pool.filter(x=>!used.has(x))); used.add(k); return k; });
  S.cup={mode,rivals,results:[]};
}
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random()}while(p>L);return k-1}
function scorer(){
  const w=[];
  slots().forEach(s=>{const p=S.picks[s.id]; if(!p||s.pos==='DT') return;
    const base={DC:6,EI:3.5,ED:3.5,MCO:2.6,MC:posList(p.p).includes('MCO')?2.6:1.2,DFC:.6,LI:.7,LD:.7,POR:0}[s.pos];
    w.push([p,base*(0.6+(p.r-p.pen)/100)]);});
  let t=w.reduce((a,x)=>a+x[1],0)*Math.random();
  for(const [p,x] of w){t-=x; if(t<=0) return p;}
  return w[0][0];
}
/* ---- chances de levantar la copa según el nivel del equipo ----
   Pelea el descenso 1 de cada 6 · Mitad de tabla 2/6 · Entra a copas 3/6 · Candidato 4/6 · Equipo de época 5/6.
   Primero se decide si ganás cada partido (los rivales más fuertes cuestan un poco más) y después se arma un resultado creíble. */
const CUP_TARGET = [1/6, 2/6, 3/6, 4/6, 5/6];          // uno por cada nivel de LEVELS
const RIVAL_WEIGHT = 25;                                 // cuánto pesa el rival: más chico = más diferencia entre rivales flojos y fuertes
const allRivals = mode => CUP_MODES[mode].rounds.flatMap(r=>r.pool.map(k=>CUP_TEAMS[k].r));
const rivalFactor = (mode,R) => { const a=allRivals(mode), avg=a.reduce((x,y)=>x+y,0)/a.length; return Math.exp((avg-R)/RIVAL_WEIGHT); };
const winP = (q,mode,R) => Math.min(.995, q*rivalFactor(mode,R));
// para cada copa y nivel busca la chance base por partido que da la chance de copa pedida
const CUP_Q = {};
for(const mode of Object.keys(CUP_MODES)){
  CUP_Q[mode] = CUP_TARGET.map(target=>{ let lo=0, hi=3;
    for(let it=0; it<40; it++){ const q=(lo+hi)/2;
      const P=CUP_MODES[mode].rounds.reduce((acc,r)=>acc*r.pool.reduce((s,k)=>s+winP(q,mode,CUP_TEAMS[k].r),0)/r.pool.length,1);
      if(P<target) lo=q; else hi=q; }
    return (lo+hi)/2; });
}
function matchWinChance(T,R){
  const mode=(S&&S.cup&&S.cup.mode)||'hist';
  return winP(CUP_Q[mode][levelOf(T)], mode, R);
}
function playMatch(T,R){
  const win = Math.random() < matchWinChance(T,R);
  // marcador: goles con un modelo de Poisson, quedándonos con uno que cuadre con quién gana
  const d=(T-R)/12; let us, them;
  for(let n=0;;n++){ us=poisson(1.35*Math.exp(d)); them=poisson(1.35*Math.exp(-d));
    if(us===them ? Math.random()<.35 : (win ? us>them : us<them)) break; // empates (penales) solo a veces
    if(n>200){ us=win?1:0; them=win?0:1; break; } }
  const goals=[]; for(let i=0;i<us;i++) goals.push({m:1+Math.floor(Math.random()*90),p:scorer()});
  goals.sort((a,b)=>a.m-b.m);
  const against=[]; for(let i=0;i<them;i++) against.push(1+Math.floor(Math.random()*90)); // minutos de los goles del rival
  against.sort((a,b)=>a-b);
  let pens=null;
  if(us===them){ const a=3+Math.floor(Math.random()*3), b=a-1-(Math.random()<.4?1:0); pens= win?[a,b]:[b,a]; }
  return {us,them,goals,against,pens,win};
}
const cupStarted = () => !!(S.cup && (S.cup.results.length || LIVE));
const cupOver = () => S.cup && (S.cup.results.length===ROUNDS.length || S.cup.results.some(r=>!r.win));

/* Cómo se juegan los partidos: resultado directo o minuto a minuto (ms por minuto de juego) */
const SPEEDS = {
  auto: {n:'Resultado directo'},
  slow: {n:'Lento',      ms:330},  // ~30 segundos por partido
  fast: {n:'Rápido',     ms:110},  // ~10 segundos
  xfast:{n:'Muy rápido', ms:35}    // ~3 segundos
};
let SPEED = 'auto';
try{ const s=localStorage.getItem('11g-speed'); if(SPEEDS[s]) SPEED=s; }catch(e){}
function setSpeed(s){
  if(!SPEEDS[s]) return; SPEED=s;
  try{ localStorage.setItem('11g-speed',s); }catch(e){}
  if(LIVE){ if(s==='auto') finishLive(); else { clearInterval(LIVE.timer); LIVE.timer=setInterval(tick,SPEEDS[s].ms); } }
  render();
}

/* Partido en vivo: el reloj avanza de a un minuto y los goles aparecen cuando llegan */
let LIVE = null;
function playNext(){
  if(!S.cup||cupOver()||LIVE) return;
  const i=S.cup.results.length, R=CUP_TEAMS[S.cup.rivals[i]].r;
  const m=playMatch(teamRating(),R);
  if(SPEED==='auto'){ S.cup.results.push(m); render(); return; }
  LIVE={i,m,min:0,timer:setInterval(tick,SPEEDS[SPEED].ms)};
  render();
}
function tick(){
  if(!LIVE) return;
  LIVE.min++;
  if(LIVE.min>=90){ finishLive(); return; }
  updateLive();
}
function finishLive(){
  if(!LIVE) return;
  clearInterval(LIVE.timer);
  const m=LIVE.m; LIVE=null;
  if(S.cup) S.cup.results.push(m);
  render();
}
function stopLive(){ if(LIVE){ clearInterval(LIVE.timer); LIVE=null; } }
function liveFeed(){
  const {m,min}=LIVE, rival=CUP_TEAMS[S.cup.rivals[LIVE.i]];
  const ev=[...m.goals.filter(g=>g.m<=min).map(g=>({m:g.m,t:last(g.p.n),mine:true})),
            ...m.against.filter(x=>x<=min).map(x=>({m:x,t:'Gol de '+rival.n,mine:false}))].sort((a,b)=>a.m-b.m);
  return {us:m.goals.filter(g=>g.m<=min).length, them:m.against.filter(x=>x<=min).length,
    html: ev.map(e=>`<li class="${e.mine?'mine':'theirs'}">${e.m}' ${e.t}</li>`).join('') || '<li>Todavía no hay goles</li>'};
}
/* Cada minuto solo se actualizan el reloj, el marcador y los goles (no toda la copa), así los botones siguen andando */
function updateLive(){
  const f=liveFeed(), q=id=>document.getElementById(id);
  if(!q('liveClock')) return;
  q('liveClock').textContent=LIVE.min+"'";
  q('liveUs').textContent=f.us; q('liveThem').textContent=f.them;
  q('liveGoals').innerHTML=f.html;
}
function playAll(){ finishLive(); while(S.cup && !cupOver()){ const i=S.cup.results.length; S.cup.results.push(playMatch(teamRating(),CUP_TEAMS[S.cup.rivals[i]].r)); } render(); }

function renderCup(){
  const el=$('cup');
  if(!complete()||!S.cup){ el.hidden=true; return; }
  el.hidden=false;
  const T=teamRating(), res=S.cup.results, over=cupOver();
  const champ = res.length===ROUNDS.length && res.every(r=>r.win);
  const lost = res.find(r=>!r.win), lostIdx=res.indexOf(lost);
  const mode=S.cup.mode||'hist', M=CUP_MODES[mode];
  let title=M.name, sub=`${M.desc} Tu equipo: ${LEVELS[levelOf(T)].n}.`;
  if(champ){ title='¡Campeones!'; sub='Ganaste las cinco llaves.'; }
  else if(lost){ title='Afuera en '+(ROUNDS[lostIdx].rd==='Final'?'la final':ROUNDS[lostIdx].rd.toLowerCase()); sub=`Te eliminó ${CUP_TEAMS[S.cup.rivals[lostIdx]].n} ${CUP_TEAMS[S.cup.rivals[lostIdx]].y}.`; }
  const nextRd = !over ? ROUNDS[res.length].rd : null;
  const started=cupStarted();
  if(LIVE){ sub=`Se está jugando ${ROUNDS[LIVE.i].rd==='Final'?'la final':ROUNDS[LIVE.i].rd.toLowerCase()} contra ${CUP_TEAMS[S.cup.rivals[LIVE.i]].n} ${CUP_TEAMS[S.cup.rivals[LIVE.i]].y}.`; }
  const tabs=`<div class="cupmodes" role="group" aria-label="Elegí la copa">${Object.entries(CUP_MODES).map(([k,v])=>`<button class="cupmode${k===mode?' on':''}" data-mode="${k}" aria-pressed="${k===mode}" ${started&&k!==mode?'disabled':''}>${v.name}</button>`).join('')}</div>`;
  const speeds=`<div class="speeds" role="group" aria-label="Cómo se juegan los partidos"><span class="lab">Partidos</span>${Object.entries(SPEEDS).map(([k,v])=>
    `${k==='slow'?'<span class="sep">Minuto a minuto:</span>':''}<button class="speed${k===SPEED?' on':''}" data-speed="${k}" aria-pressed="${k===SPEED}">${v.n}</button>`).join('')}</div>`;
  const lv = LIVE ? liveFeed() : null;
  /* Los botones van arriba del fixture para no tener que bajar hasta el final en el celu */
  const actions=`<div class="sim-actions">${LIVE?`<button class="btn" id="skip">Ver el resultado</button>`
    :!over?`<button class="btn" id="next">Jugar ${nextRd}</button><button class="btn alt" id="all">Simular hasta el final</button>`
    :`<button class="btn" id="newgame">Empezar de nuevo</button>`}
    ${LIVE?'':'<button class="ghost" id="shot">Compartir imagen</button>'}</div>`;
  el.innerHTML=tabs+speeds+`<div class="verdict"><div><h2 class="${champ?'win':''}">${title}</h2><p class="note">${sub}</p></div></div>
  ${actions}
  <ol class="bracket">${ROUNDS.map((r,i)=>{
    const t=CUP_TEAMS[S.cup.rivals[i]], m=res[i], live=LIVE&&LIVE.i===i;
    const state = live ? 'live' : m ? (m.win?'won':'lost') : (lost||i>res.length ? 'locked' : 'next');
    const shown = m || live || state==='next' || !lost;
    return `<li class="tie ${state}">
      <span class="rd">${r.rd}${live?` <span class="clock">En vivo · <b id="liveClock">${LIVE.min}'</b></span>`:''}</span>
      <div class="sc"><span class="team">${mode==='lanus'?'Tu 11':'Lanús'}</span><strong${live?' id="liveUs"':''}>${live?lv.us:m?m.us:''}</strong></div>
      <div class="sc"><span class="team">${shown?`${t.n} <em>${t.y}</em>${String(S.cup.rivals[i]).startsWith('lan')?kitImg(t.y,'kit kit-xs'):''}`:'—'}</span><strong${live?' id="liveThem"':''}>${live?lv.them:m?m.them:''}</strong></div>
      <span class="pk">${m&&m.pens?`Penales ${m.pens[0]}–${m.pens[1]}`:shown?t.c:''}</span>
      ${live?`<ul id="liveGoals" aria-live="polite">${lv.html}</ul>`
        :m?`<ul>${m.goals.map(g=>`<li>${g.m}' ${last(g.p.n)}</li>`).join('')||'<li>Sin goles tuyos</li>'}</ul>`:''}
    </li>`;}).join('')}</ol>`;
}
/* ---- resumen al terminar la copa ---- */
function maybeSummary(){
  if(!S.cup || LIVE || !cupOver() || S.cup.summaryShown) return;
  S.cup.summaryShown=true;
  setTimeout(openSummary, 450); // un respiro para que se vea el último resultado
}
function openSummary(){
  if(!S.cup) return;
  const res=S.cup.results, champ=res.length===ROUNDS.length && res.every(r=>r.win);
  const lostI=res.findIndex(r=>!r.win), T=teamRating(), L=LEVELS[levelOf(T)];
  const gf=res.reduce((a,m)=>a+m.us,0), gc=res.reduce((a,m)=>a+m.them,0), won=res.filter(r=>r.win).length;
  const pens=res.filter(m=>m.pens).length;
  const rdName=i=>ROUNDS[i].rd==='Final'?'la final':ROUNDS[i].rd.toLowerCase();
  const rival=i=>CUP_TEAMS[S.cup.rivals[i]];
  const title = champ ? '¡Campeón!' : 'Afuera en '+rdName(lostI);
  const sub = champ ? (res.every(m=>!m.pens)?'Campaña perfecta · ganaste las 5 llaves':'Ganaste las 5 llaves')
                    : `Te eliminó ${rival(lostI).n} ${rival(lostI).y}`;
  // goleadores de la copa
  const tally={};
  res.forEach(m=>m.goals.forEach(g=>{ if(!g.p) return; const k=g.p.n+'|'+g.p.year; (tally[k]=tally[k]||{p:g.p,n:0}).n++; }));
  const tops=Object.values(tally).sort((a,b)=>b.n-a.n);
  const boot = tops.length
    ? `<div class="sum-boot"><span class="lab">Bota de oro</span><b>${last(tops[0].p.n)} <em>${tops[0].n}</em></b>`
      +`<small>${tops[0].p.year}${tops[1]?` · Lo sigue ${last(tops[1].p.n)} con ${tops[1].n}`:''}</small></div>`
    : `<div class="sum-boot"><span class="lab">Bota de oro</span><b>Desierta</b><small>Tu equipo no metió goles en la copa</small></div>`;
  // los 3 mejores del equipo van en dorado
  const list=slots().map(sl=>({sl,p:S.picks[sl.id]})).filter(x=>x.p);
  const best=new Set(list.filter(x=>x.sl.pos!=='DT').map(x=>x.p).sort((a,b)=>(b.r-b.pen)-(a.r-a.pen)).slice(0,3));
  const goalsOf=p=>tally[p.n+'|'+p.year]?.n||0;
  const rows=list.map(({sl,p})=>`<li class="${best.has(p)?'star':''}"><span class="ps">${sl.pos}</span><span class="nm">${p.n}</span>`
    +`${goalsOf(p)?`<span class="gl" title="Goles en la copa">⚽ ${goalsOf(p)}</span>`:''}<span class="yr">${p.year}</span></li>`).join('');
  $('sumBox').innerHTML=`
    <div class="sum-top"><span>11 GRANATE</span><span>${CUP_MODES[S.cup.mode||'hist'].name} · ${S.formation}</span></div>
    <h2 id="sumTitle" class="${champ?'win':''}">${title}</h2>
    <p class="sum-sub">${sub}</p>
    <div class="sum-level"><span class="lab">Nivel del equipo</span><b>${L.n}</b><small>${L.d}</small></div>
    <div class="sum-stats">
      <div><b>${gf}</b><span>Goles a favor</span></div>
      <div><b>${gc}</b><span>En contra</span></div>
      <div><b>${won}/${res.length}</b><span>Ganados</span></div>
      <div><b>${pens}</b><span>Por penales</span></div>
    </div>
    ${boot}
    <p class="sum-legend"><span class="dot"></span> Los 3 mejores de tu equipo</p>
    <ol class="sum-list">${rows}</ol>
    <div class="sum-actions">
      <button class="btn" id="sumShare">Compartir imagen</button>
      <button class="btn alt" id="sumAgain">Empezar de nuevo</button>
      <button class="ghost" id="sumClose">Cerrar</button>
    </div>
    <p class="sum-foot">nibra3.github.io/11granate · armá el tuyo</p>`;
  $('summary').hidden=false; $('summary').scrollTop=0; $('sumClose').focus({preventScroll:true});
}
function shareText(){
  const lines=slots().map(s=>{const p=S.picks[s.id];return `${s.pos} ${p.n} (${p.year})`});
  const res=S.cup?S.cup.results:[];
  return `11 Granate · ${S.formation}\n${lines.join('\n')}\n`+
    res.map((m,i)=>`${ROUNDS[i].rd}: Lanús ${m.us}-${m.them} ${CUP_TEAMS[S.cup.rivals[i]].n} ${CUP_TEAMS[S.cup.rivals[i]].y}${m.pens?` (pen ${m.pens[0]}-${m.pens[1]})`:''}`).join('\n')+
    `\n\nArmá el tuyo acá: ${GAME_URL}`;
}
function fallback(txt){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='width:100%;height:160px;margin-top:8px';
  ta.setAttribute('aria-label','Resultado para copiar'); $('cup').appendChild(ta); ta.select(); }

document.addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.id==='roll') roll();
  else if(t.id==='fab'){ const had=complete(); roll();
    if(!had && S.season){ const sq=document.querySelector('.squad'); const r=sq.getBoundingClientRect(); if(r.top<0||r.top>innerHeight*.6) sq.scrollIntoView({behavior:smooth(),block:'start'}); } }
  else if(t.dataset.f) setFormation(t.dataset.f);
  else if(t.id==='reset'||t.id==='newgame'){ stopLive(); S=fresh(S.formation); render(); window.scrollTo({top:0}); }
  else if(t.id==='next') playNext();
  else if(t.id==='all') playAll();
  else if(t.id==='skip') finishLive();
  else if(t.dataset.speed) setSpeed(t.dataset.speed);
  else if(t.dataset.mode){ if(!cupStarted()){ newCup(t.dataset.mode); render(); } }
  else if(t.id==='shot') openShare();
  else if(t.id==='sumShare'){ $('summary').hidden=true; openShare(); }
  else if(t.id==='sumClose') $('summary').hidden=true;
  else if(t.id==='sumAgain'){ $('summary').hidden=true; stopLive(); S=fresh(S.formation); render(); window.scrollTo({top:0}); }
  else if(t.id==='shareNative') nativeShare();
  else if(t.id==='shareClose') $('share').hidden=true;
  else if(t.dataset.put) place(t.dataset.who,null,t.dataset.put);
  else if(t.dataset.place) place(t.dataset.place,t.dataset.pos);
  else if(t.dataset.k){ S.open = S.open===t.dataset.k?null:t.dataset.k; renderSquad(); renderPitch(); renderMini(); }
  else if(t.id==='miniGo') document.querySelector('.pitch-card').scrollIntoView({behavior:smooth(),block:'start'});
  else if(t.id==='miniToggle'){ miniSmall=!miniSmall; $('mini').classList.toggle('small',miniSmall); t.textContent=miniSmall?'+':'–'; t.setAttribute('aria-label',miniSmall?'Agrandar la mini cancha':'Achicar la mini cancha'); }
  else if(t.id==='copyLink') copyLink(t);
});

/* ---- imagen para compartir (1080×1350, formato vertical para WhatsApp e Instagram) ---- */
let shareBlob=null;
async function makeShareImage(noCrest){
  try{ await Promise.all(['96px Anton','600 26px "Hanken Grotesk"','500 20px "IBM Plex Mono"'].map(f=>document.fonts.load(f))); }catch(e){}
  const W=1080,H=1350,c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'), css=getComputedStyle(document.documentElement);
  const tok=n=>css.getPropertyValue(n).trim();
  const BG=tok('--paper')||'#140B0E', CARD=tok('--card')||'#221317', INK=tok('--ink')||'#F3E9DC', MUTED=tok('--muted')||'#B5A39E';
  const GR=tok('--granate')||'#570303', GRD=tok('--granate-dark')||'#3A0202', FIELD=tok('--field')||'#1A0F12';
  const DISP='Anton, Impact, "Arial Narrow", sans-serif', BODY='"Hanken Grotesk", system-ui, sans-serif', MONO='"IBM Plex Mono", monospace';
  const fitText=(txt,max,size,weight,fam)=>{ let s=size; do{ x.font=`${weight} ${s}px ${fam}`; s--; }while(x.measureText(txt).width>max && s>12); return txt; };

  x.fillStyle=BG; x.fillRect(0,0,W,H);

  // título con escudo
  let tx=70; const crest=$('crest');
  if(!noCrest && crest && !crest.hidden && crest.complete && crest.naturalWidth){ const h=104, w=h*crest.naturalWidth/crest.naturalHeight; x.drawImage(crest,70,58,w,h); tx=70+w+24; }
  x.textBaseline='alphabetic'; x.font=`104px ${DISP}`; x.fillStyle=INK; x.fillText('11 ',tx,156);
  { const gx=tx+x.measureText('11 ').width; x.lineWidth=4; x.strokeStyle='#FFFFFF'; x.strokeText('GRANATE',gx,156); x.fillStyle='#641C34'; x.fillText('GRANATE',gx,156); }

  // formación y nivel
  const T=teamRating(), L=LEVELS[levelOf(T)];
  x.font=`500 30px ${MONO}`; x.fillStyle=MUTED; x.fillText(S.formation,70,222);
  const fw=x.measureText(S.formation).width;
  x.font=`600 30px ${BODY}`; x.fillStyle=INK; x.fillText('·  '+L.n,70+fw+18,222);

  // cancha
  const P={x:70,y:262,w:940,h:780};
  for(let i=0;i<10;i++){ x.fillStyle=i%2?'#286F3E':'#2E7D46'; x.fillRect(P.x,P.y+i*P.h/10,P.w,P.h/10+1); }
  x.strokeStyle='rgba(255,255,255,.7)'; x.lineWidth=5;
  x.strokeRect(P.x+12,P.y+12,P.w-24,P.h-24);
  x.beginPath(); x.moveTo(P.x+12,P.y+P.h/2); x.lineTo(P.x+P.w-12,P.y+P.h/2); x.stroke();
  x.beginPath(); x.arc(P.x+P.w/2,P.y+P.h/2,86,0,Math.PI*2); x.stroke();
  const bw=420,bh=120; x.strokeRect(P.x+(P.w-bw)/2,P.y+12,bw,bh); x.strokeRect(P.x+(P.w-bw)/2,P.y+P.h-12-bh,bw,bh);
  x.strokeStyle=INK; x.lineWidth=2; x.strokeRect(P.x,P.y,P.w,P.h);

  const rows=FORMATIONS[S.formation], all=slots(), n=rows.length;
  const gap=(P.h-190)/(n-1), k=Math.min(1,gap/185);
  const drawPlayer=(cx,cy,pos,p,maxW)=>{
    const r=40*k;
    x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fillStyle=GR; x.fill(); x.lineWidth=3; x.strokeStyle=INK; x.stroke();
    x.textAlign='center'; x.textBaseline='middle'; x.fillStyle=INK; x.font=`600 ${Math.round(22*k)}px ${MONO}`; x.fillText(pos,cx,cy+1);
    x.textBaseline='alphabetic';
    const nm=last(p.n); fitText(nm,maxW,Math.round(28*k),700,BODY); x.fillStyle=INK; x.fillText(nm,cx,cy+r+34*k);
    x.font=`500 ${Math.round(22*k)}px ${MONO}`; x.fillStyle='#E8F0EA'; x.fillText(String(p.year),cx,cy+r+62*k);
    x.textAlign='left';
  };
  rows.forEach((row,ri)=>{
    const cy=P.y+70+ri*gap;
    const rs=all.filter(s=>s.row===ri);
    rs.forEach((s,k)=>{ const cx=P.x+(k+0.5)*P.w/rs.length; drawPlayer(cx,cy,s.pos,S.picks[s.id],P.w/rs.length-16); });
  });

  // DT
  const dt=S.picks.dt1;
  x.font=`32px ${DISP}`; x.fillStyle=MUTED; x.fillText('DT',70,1104);
  x.font=`700 34px ${BODY}`; x.fillStyle=INK; x.fillText(dt.n,128,1104);
  const dw=x.measureText(dt.n).width; x.font=`500 26px ${MONO}`; x.fillStyle=MUTED; x.fillText(String(dt.year),128+dw+16,1104);

  // copa
  x.fillStyle=CARD; x.fillRect(70,1136,940,150);
  x.fillStyle=GR; x.fillRect(70,1136,12,150);
  const res=S.cup?S.cup.results:[], lastI=res.length-1;
  let head='Copa sin jugar', line='';
  if(res.length){
    const champ=res.length===ROUNDS.length && res.every(r=>r.win);
    const r=CUP_TEAMS[S.cup.rivals[lastI]];
    head = champ ? '¡CAMPEÓN DE LA COPA!' : (res[lastI].win ? `En carrera: ${ROUNDS[lastI].rd} superados` : `Afuera en ${ROUNDS[lastI].rd==='Final'?'la final':ROUNDS[lastI].rd.toLowerCase()} con ${r.n} ${r.y}`);
    line = CUP_MODES[S.cup.mode||'hist'].name+':  '+res.map((m,i)=>`${ROUNDS[i].rd} ${m.us}-${m.them}${m.pens?' (pen)':''}`).join('  ·  ');
  }
  head=head.toUpperCase(); fitText(head,880,42,'400',DISP); x.fillStyle=INK; x.fillText(head,104,1196);
  fitText(line,880,26,'500',MONO); x.fillStyle=MUTED; x.fillText(line,104,1250);

  x.font=`500 24px ${BODY}`; x.fillStyle=MUTED; x.textAlign='right'; x.fillText('Armá el tuyo en nibra3.github.io/11granate',1010,1322); x.textAlign='left';
  return c;
}
async function openShare(){
  let c=await makeShareImage(), url;
  // abierto como archivo local, el navegador no deja exportar la imagen con el escudo: se genera sin él
  try{ url=c.toDataURL('image/png'); }catch(e){ c=await makeShareImage(true); url=c.toDataURL('image/png'); }
  $('shareImg').src=url; $('shareDl').href=url;
  shareBlob=await new Promise(r=>c.toBlob(r,'image/png'));
  let canShare=false;
  try{ canShare=!!(navigator.canShare && navigator.canShare({files:[new File([shareBlob],'11-granate.png',{type:'image/png'})]})); }catch(e){}
  $('shareNative').hidden=!canShare;
  $('share').hidden=false; $('shareClose').focus();
}
async function copyLink(btn){
  const txt='Mirá el 11 Granate que armé. Armá el tuyo acá: '+GAME_URL;
  try{ await navigator.clipboard.writeText(txt); btn.textContent='¡Enlace copiado!'; }
  catch(e){ btn.textContent=GAME_URL; }
  setTimeout(()=>btn.textContent='Copiar enlace',2000);
}
async function nativeShare(){
  try{ await navigator.share({files:[new File([shareBlob],'11-granate.png',{type:'image/png'})],title:'11 Granate',text:'Mirá el 11 Granate que armé. Armá el tuyo acá: '+GAME_URL}); }catch(e){}
}
document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return; if(!$('share').hidden) $('share').hidden=true; else if(!$('summary').hidden) $('summary').hidden=true; });
$('summary').addEventListener('click',e=>{ if(e.target.id==='summary') $('summary').hidden=true; });
$('share').addEventListener('click',e=>{ if(e.target.id==='share') $('share').hidden=true; });

// el título lleva al inicio y arranca una partida nueva, igual que "Empezar de nuevo"
document.getElementById('home').addEventListener('click',e=>{ e.preventDefault(); stopLive(); S=fresh(S.formation); render(); $('share').hidden=true; window.scrollTo({top:0,behavior:smooth()}); });
// el botón flotante aparece solo cuando el botón original de tirar no se ve
if('IntersectionObserver' in window){
  new IntersectionObserver(es=>{ fabWanted=!es[0].isIntersecting; syncFab(); },{threshold:0}).observe(document.getElementById('roll'));
  // la mini cancha se muestra cuando la cancha grande salió de pantalla y estás en la parte del plantel
  new IntersectionObserver(es=>{ pitchSeen=es[0].isIntersecting; syncMini(); },{threshold:0,rootMargin:'-80px 0px 0px 0px'}).observe(document.getElementById('pitch'));
  new IntersectionObserver(es=>{ deskSeen=es[0].isIntersecting; syncMini(); },{threshold:0}).observe(document.querySelector('.desk'));
  matchMedia('(max-width:900px)').addEventListener?.('change',syncMini);
}
function start(data){ S = data && data.picks && data.formation && FORMATIONS[data.formation] ? data : fresh(); S.uses=S.uses||{}; render(); }
start({});
