/* WealthPilot: transparent, browser-only investment research interface.
   Scores are heuristic, based on historical prices—not valuations or forecasts. */
(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const catalog = Array.isArray(window.WEALTHPILOT_CATALOG) ? window.WEALTHPILOT_CATALOG : [];
  const names = {alles:'Alles',etf:'ETF’s',aandelen:'Aandelen',obligaties:'Obligaties',vastgoed:'Vastgoed',goud:'Goud',crypto:'Crypto'};
  const riskNames = {defensief:'Defensief',gebalanceerd:'Gebalanceerd',groei:'Groeigericht'};
  const categoryIcons = {etf:'ETF',aandelen:'A',obligaties:'B',vastgoed:'V',goud:'Au',crypto:'₿'};
  const save = (key,value) => {try{localStorage.setItem('wp-'+key,JSON.stringify(value));}catch(e){}};
  const getSaved = (key,fallback) => {try{const v=JSON.parse(localStorage.getItem('wp-'+key));return v===null?fallback:v;}catch(e){return fallback;}};
  const state = {tab:'radar',category:'alles',risk:getSaved('risk','gebalanceerd'),horizon:getSaved('horizon',10),favorites:getSaved('favorites',[]),search:'',market:[],snapshot:null,fetching:false,modal:null,startCapital:getSaved('capital',5000),monthly:getSaved('monthly',250),calculatorYears:getSaved('years',10),offlineMode:true};
  if(!riskNames[state.risk]) state.risk='gebalanceerd';
  if(![5,10,15,20].includes(Number(state.horizon)))state.horizon=10;
  if(!Array.isArray(state.favorites))state.favorites=[];

  const icons = {
    chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.85"><path d="M3 17l6-6 4 3 7-8"/><path d="M16 6h4v4"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="M20 11a8 8 0 0 0-14.2-5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.2 5L21 15"/><path d="M21 20v-5h-5"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="m12 2 3.1 6.3 7 .99-5 4.9 1.18 6.95L12 17.9l-6.28 3.26 1.19-6.95-5-4.9 7-.99Z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
    info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7h.01"/></svg>',
    chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z"/><path d="M4 17a2 2 0 0 1 2-2h13"/><path d="M9 7h6"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };
  const esc = val => String(val ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hasData = a => a && Number.isFinite(a.price) && Number.isFinite(a.change12m);
  const nf=(v,max=0) => new Intl.NumberFormat('nl-BE',{maximumFractionDigits:max,minimumFractionDigits:0}).format(v);
  const euro=v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR',maximumFractionDigits:2,minimumFractionDigits:2}).format(v) : '—';
  const pct=(v,dec=1) => Number.isFinite(v) ? `${v>0?'+':''}${nf(v,dec)}%` : '—';
  const price=a => Number.isFinite(a.price) ? new Intl.NumberFormat('nl-BE',{style:'currency',currency:a.currency||'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(a.price) : '—';
  const cls=v => !Number.isFinite(v)?'neutral':v>0.001?'positive':v<-.001?'negative':'neutral';
  const saved=ticker => state.favorites.includes(ticker);
  const riskWord = a => {
    if(!hasData(a)) return a.category==='crypto'?'Zeer hoog':a.category==='obligaties'?'Gematigd':a.category==='goud'?'Wisselend':'Variabel';
    if(a.category==='crypto'||a.volatility>42) return 'Zeer hoog';
    if(a.volatility>27) return 'Hoog';
    if(a.volatility>17) return 'Gemiddeld';
    return 'Lager*';
  };
  const daysOld = date => {
    if(!date) return Infinity;
    const last = new Date(`${date}T20:00:00Z`);
    return Math.max(0,Math.floor((Date.now()-last.getTime())/86400000));
  };
  const freshness = () => {
    if(!state.market.length) return {status:'offline',text:'Nog geen echte beursgegevens · activeer de dagelijkse gegevensfeed'};
    const age=daysOld(state.snapshot?.latestTradingDay);
    const label=state.snapshot?.latestTradingDay ? new Intl.DateTimeFormat('nl-BE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${state.snapshot.latestTradingDay}T12:00:00Z`)):'onbekend';
    return age>6?{status:'stale',text:`Oudere koersen · laatste beursdag ${label} · updates controleren`}:{status:'fresh',text:`Laatste beursdag ${label} · dagelijkse slotkoersen (niet realtime)`};
  };
  const isCategoryAllowed=(a) => state.risk!=='defensief'||a.category!=='crypto';
  function score(a){
    if(!hasData(a)) return null;
    const risk=state.risk;
    let s=62;
    const r12=clamp(a.change12m,-32,40),r6=clamp(a.change6m??0,-24,30),trend=clamp(a.above200d??0,-28,24);
    const horizonBonus=Number(state.horizon)>=15?1.12:Number(state.horizon)<=5?.84:1;
    s+=r12*.30*horizonBonus+r6*.20+trend*.14;
    const drawdown=Math.abs(Math.min(0,a.drawdown??0));
    const vol=a.volatility??30;
    const target=risk==='defensief'?12:risk==='gebalanceerd'?23:37;
    s-=Math.max(0,vol-target)*(risk==='defensief'?.43:risk==='gebalanceerd'?.30:.17);
    s-=Math.max(0,drawdown-12)*.17;
    if(a.change6m>0&&a.above200d>0&&a.change1m<0&&a.change1m>-12)s+=3.4;
    const bias = {
      defensief:{etf:4,aandelen:-9,obligaties:11,vastgoed:-4,goud:1,crypto:-30},
      gebalanceerd:{etf:7,aandelen:0,obligaties:6,vastgoed:-1,goud:1,crypto:-16},
      groei:{etf:5,aandelen:4,obligaties:-7,vastgoed:0,goud:-3,crypto:-7}
    };
    s+=(bias[risk]?.[a.category]??0);
    if(a.category==='etf'&&a.family==='global')s+=5;
    if(a.category==='aandelen'&&a.family==='conglomerate')s+=2;
    if(risk==='defensief'&&a.category==='crypto')s-=18;
    return Math.round(clamp(s,15,94));
  }
  function rankedCandidates(){
    const data = state.market.length ? state.market : catalog;
    const search=state.search.toLocaleLowerCase('nl-BE').trim();
    return data.filter(a=>(state.category==='alles'||a.category===state.category) && ( !search || [a.name,a.ticker,a.focus,a.category].join(' ').toLocaleLowerCase('nl-BE').includes(search)))
      .filter(isCategoryAllowed)
      .map(a=>({...a,match:score(a)}))
      .sort((a,b)=>(b.match??-1)-(a.match??-1)||a.name.localeCompare(b.name));
  }
  function takeTop(items){
    if(!state.market.length){
      // Not a real recommendation/ranking; simply demonstrate broad research scope.
      const choices=['VWCE.DE','SPYI.DE','EUNA.DE','SXR8.DE','ASML.AS','MSFT','GOOGL','SU.PA','4GLD.DE','O'];
      return [...items].sort((a,b)=>(choices.indexOf(a.ticker)===-1?999:choices.indexOf(a.ticker))-(choices.indexOf(b.ticker)===-1?999:choices.indexOf(b.ticker))).slice(0,10);
    }
    if(state.category!=='alles'||state.search) return items.slice(0,10);
    const limits = {
      defensief:{etf:4,aandelen:2,obligaties:3,vastgoed:1,goud:1,crypto:0},
      gebalanceerd:{etf:4,aandelen:4,obligaties:2,vastgoed:2,goud:1,crypto:0},
      groei:{etf:4,aandelen:5,obligaties:1,vastgoed:2,goud:1,crypto:1}
    }[state.risk];
    const result=[],categories={},families={};
    const pool=items.slice();
    while(result.length<10&&pool.length){
      let winner=-1, high=-Infinity;
      for(let i=0;i<pool.length;i++){
        const a=pool[i],cat=a.category;
        if((categories[cat]||0)>=limits[cat])continue;
        const adjustment=(categories[cat]||0)*2.8+(families[a.family]||0)*8.5;
        const adjusted=a.match-adjustment;
        if(adjusted>high){high=adjusted;winner=i;}
      }
      if(winner<0)break;
      const item=pool.splice(winner,1)[0];
      result.push(item);
      categories[item.category]=(categories[item.category]||0)+1;
      families[item.family]=(families[item.family]||0)+1;
    }
    return result;
  }
  function why(a){
    if(!hasData(a))return a.description;
    const parts=[];
    if(a.category==='etf'&&a.family==='global')parts.push('brede wereldspreiding');
    else if(a.category==='obligaties')parts.push('obligatieblootstelling');
    else parts.push(a.focus.toLocaleLowerCase('nl-BE'));
    if(a.above200d>3)parts.push('opwaartse langetermijntrend');
    else if(a.above200d<-4)parts.push('koers onder 200-daags gemiddelde');
    if(a.change1m<0&&a.change1m>-12&&a.change6m>0)parts.push('recente terugval na eerdere stijging');
    return parts.join(' · ');
  }
  function sparkline(a,large=false){
    const v=Array.isArray(a.history)?a.history.filter(x=>Number.isFinite(x)):[];
    if(v.length<4)return '<div class="trend-empty">Nog geen grafiek</div>';
    const width=large?460:110,height=large?105:43,pad=large?5:3;
    const min=Math.min(...v),max=Math.max(...v);const range=Math.max(.0001,max-min);
    const points=v.map((x,i)=>`${(pad+(i/(v.length-1))*(width-2*pad)).toFixed(1)},${(height-pad-((x-min)/range)*(height-2*pad)).toFixed(1)}`).join(' ');
    const color=v[v.length-1]>=v[0]?'#1b9e86':'#d76d70';
    const last=points.split(' ').pop().split(',');
    return `<svg class="trend" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Historische koersontwikkeling laatste 12 maanden"><polyline fill="none" stroke="${color}" stroke-width="${large?2.2:1.9}" stroke-linejoin="round" stroke-linecap="round" points="${points}"/><circle cx="${last[0]}" cy="${last[1]}" r="${large?3.5:2.5}" fill="${color}"/></svg>`;
  }
  function categoryLogo(a){
    const acronym=(categoryIcons[a.category]||'A');
    return `<div class="asset-logo ${esc(a.category)}" aria-hidden="true">${acronym}</div>`;
  }
  function assetCard(a,index){
    const valid=hasData(a),isFav=saved(a.ticker);
    const scoreTxt=valid?`<span class="score-num">${a.match??score(a)}</span><span class="score-unit">/ 100</span>`:'<span class="score-num placeholder">—</span>';
    const desc=valid?'Interessescore':'Geen koersdata';
    return `<article class="asset-card" data-action="detail" data-ticker="${esc(a.ticker)}" role="button" tabindex="0" aria-label="Details ${esc(a.name)}">
      <div class="asset-head">${state.market.length?`<span class="asset-rank">${String(index+1).padStart(2,'0')}</span>`:''}${categoryLogo(a)}<div class="asset-title"><h3>${esc(a.name)}</h3><p>${esc(a.ticker)} &nbsp;·&nbsp; ${esc(names[a.category]||a.category)} &nbsp;·&nbsp; ${esc(a.focus)}</p></div><button class="star ${isFav?'saved':''}" type="button" data-action="favorite" data-ticker="${esc(a.ticker)}" aria-label="${isFav?'Uit favorieten verwijderen':'Bewaren in favorieten'}" aria-pressed="${isFav}">${icons.star}</button></div>
      <div class="asset-mid"><div class="asset-scoreline"><div class="score-inline">${scoreTxt}</div><span class="score-descr">${desc}</span></div>${sparkline(a)}</div>
      <div class="asset-metrics"><div><span class="metric-label">12 maanden</span><strong class="metric-value ${cls(a.change12m)}">${pct(a.change12m)}</strong></div><div><span class="metric-label">Risico</span><strong class="metric-value">${riskWord(a)}</strong></div><div><span class="metric-label">Laatste koers</span><strong class="metric-value">${price(a)}</strong></div></div>
      <div class="asset-bottom"><span class="reason">${esc(why(a))}</span><span class="more">Bekijk analyse ›</span></div>
    </article>`;
  }
  function header(){return `<div class="topbar"><div class="brand"><div class="logo" aria-hidden="true">${icons.chart}</div><div class="wordmark">wealth<span>pilot</span></div></div><div class="top-actions"><button type="button" class="icon-button" data-action="help" aria-label="Uitleg en installeren">${icons.info}</button><button type="button" class="icon-button ${state.fetching?'refresh-spin':''}" data-action="refresh" aria-label="Laatste gepubliceerde beursdata ophalen">${icons.refresh}</button></div></div>`;}
  function home(){
    const freshnessValue=freshness(),choices=takeTop(rankedCandidates()),count=state.market.length||catalog.length,quoted=state.market.length>0;
    return `${header()}<section class="hero"><div class="eyebrow">JE PERSOONLIJKE BELEGGINGSRADAR</div><h1>Groei begint met overzicht.</h1><p>De interessantste kandidaten om verder te onderzoeken. Gebouwd voor jaren, niet voor minuten.</p><div class="hero-meta"><span>${count} beleggingen in de radar</span><span class="hero-pill">HORIZON ${Number(state.horizon)} JAAR</span></div></section>
      <div class="statusbar"><span class="dot ${freshnessValue.status==='fresh'?'':freshnessValue.status}"></span><span>${esc(freshnessValue.text)}</span></div>
      ${!quoted?`<div class="notice">${icons.info}<span><strong>Voorbeeldselectie, geen actuele top 10.</strong> De app bevat al een beleggingencatalogus. De echte scores, grafieken en rangschikking verschijnen zodra de marktdataverbinding op GitHub Pages draait.</span></div>`:''}
      <div class="section-head"><div><h2>${state.category==='alles'?'De top 10':`Top 10 · ${names[state.category]}`}</h2><p>${quoted?'Gerangschikt op trends, spreiding en risico':'Voorbeeld van de beleggingen die worden opgevolgd'}</p></div><button type="button" class="text-link" data-action="method">Hoe werkt dit? ›</button></div>
      <div class="controls"><label class="control"><div><span class="control-label">Jouw risicoprofiel</span><select id="risk-input" data-setting="risk" aria-label="Risicoprofiel"><option value="defensief" ${state.risk==='defensief'?'selected':''}>Defensief</option><option value="gebalanceerd" ${state.risk==='gebalanceerd'?'selected':''}>Gebalanceerd</option><option value="groei" ${state.risk==='groei'?'selected':''}>Groeigericht</option></select></div><span class="chevron">⌄</span></label><label class="control"><div><span class="control-label">Beleggingshorizon</span><select id="horizon-input" data-setting="horizon" aria-label="Beleggingshorizon"><option value="5" ${state.horizon==5?'selected':''}>5 jaar</option><option value="10" ${state.horizon==10?'selected':''}>10 jaar</option><option value="15" ${state.horizon==15?'selected':''}>15 jaar</option><option value="20" ${state.horizon==20?'selected':''}>20 jaar</option></select></div><span class="chevron">⌄</span></label></div>
      <div class="filters" role="group" aria-label="Beleggingstype">${Object.entries(names).map(([key,value])=>`<button type="button" class="pill ${state.category===key?'active':''}" data-action="category" data-category="${key}" aria-pressed="${state.category===key}">${value}</button>`).join('')}</div>
      <label class="search-wrap">${icons.search}<input id="search-field" placeholder="Zoek een aandeel, ETF, ticker…" type="search" autocomplete="off" value="${esc(state.search)}" aria-label="Zoek beleggingen"></label>
      <div class="list-subhead"><span id="result-label">${quoted?'Analyses op basis van slotkoersen':'Onderzoeksuniversum zonder actuele rangschikking'}</span><b id="count-label">${choices.length} getoond</b></div>
      <div class="cards" id="asset-list">${choices.length?choices.map(assetCard).join(''):`<div class="empty"><h3>Geen resultaten</h3><p>Probeer een andere zoekterm of categorie.</p></div>`}</div>
      <p class="note">Geen persoonlijk koopadvies · Geen garantie op rendement · Historische prestaties voorspellen de toekomst niet. De score gebruikt geen bedrijfswaarderingen.</p>`;
  }
  function favoritesView(){
    const all=state.market.length?state.market:catalog;
    const favs=state.favorites.map(t=>all.find(a=>a.ticker===t)).filter(Boolean);
    return `${header()}<div class="eyebrow">JOUW PERSOONLIJKE LIJST</div><h1 style="font-size:30px;margin:9px 0 0">Bewaard</h1><p class="intro-line">Volg interessante beleggingen zonder direct te kopen. Je bewaarlijst blijft lokaal op deze iPhone staan.</p>
    <div class="stats"><div class="stat"><strong>${favs.length}</strong><span>Bewaard</span></div><div class="stat"><strong>${new Set(favs.map(x=>x.category)).size}</strong><span>Categorieën</span></div><div class="stat"><strong>${favs.filter(hasData).length}</strong><span>Met koersdata</span></div></div>
    ${favs.length?`<div class="cards">${favs.map((a,i)=>assetCard({...a,match:score(a)},i)).join('')}</div>`:`<div class="empty">${icons.star}<h3>Nog niets bewaard</h3><p>Tik op het sterretje bij een ETF, aandeel of andere belegging om een persoonlijke volglijst aan te leggen.</p><button class="primary-button secondary-button" data-action="tab" data-tab="radar">Ontdek beleggingen</button></div>`}
    <p class="note">Je gegevens blijven in je browser. Deze app koppelt niet aan een broker en voert geen transacties uit.</p>`;
  }
  function projectedValue(initial,monthly,years,annual){
    const r=Math.pow(1+annual,1/12)-1,n=years*12;
    return initial*Math.pow(1+r,n)+monthly*(Math.pow(1+r,n)-1)/r;
  }
  function insight(){
    const count=state.market.length,values=[.03,.05,.07].map(rate=>projectedValue(Math.max(0,+state.startCapital||0),Math.max(0,+state.monthly||0),Math.max(1,+state.calculatorYears||1),rate));
    const total=Math.max(0,+state.startCapital||0)+Math.max(0,+state.monthly||0)*12*(Math.max(1,+state.calculatorYears||1));
    return `${header()}<div class="eyebrow">INZICHT EN SIMULATIE</div><h1 style="font-size:30px;margin:9px 0 0">Denk in jaren.</h1><p class="intro-line">Een sterke belegging bouw je meestal met spreiding, discipline en tijd — niet door elke koersbeweging te volgen.</p>
    <section class="small-card"><div class="eyebrow">VERMOGENSSIMULATOR</div><h3 style="margin-top:6px">Wat kan periodiek beleggen opbouwen?</h3><p>Voorbeeldberekening met vaste jaarlijkse groeipercentages, zonder garantie.</p><div class="form-row"><label for="cap-input">Startbedrag (€)</label><input data-calc="startCapital" id="cap-input" type="number" min="0" max="100000000" step="500" value="${state.startCapital}"></div><div class="form-row"><label for="month-input">Per maand (€)</label><input data-calc="monthly" id="month-input" type="number" min="0" max="10000000" step="50" value="${state.monthly}"></div><div class="form-row"><label for="years-input">Aantal jaren</label><input data-calc="calculatorYears" id="years-input" type="number" min="1" max="50" step="1" value="${state.calculatorYears}"></div><div class="mini-divider"></div><div class="key-value"><span>Totaal zelf ingelegd</span><b id="own-invested">${euro(total)}</b></div><div class="scenario-row" id="scenarios">${[3,5,7].map((p,i)=>`<div class="scenario"><span>${p}% per jaar</span><strong>${euro(values[i]).replace(/,00(?=\s*€)/,'')}</strong><small>hypothetisch</small></div>`).join('')}</div><p class="source">Vereenvoudigde samengestelde-rente-berekening. Geen verwachting, inflatiecorrectie, belasting of transactiekosten. In werkelijkheid wisselen rendementen en zijn verliezen mogelijk.</p></section>
    <section class="small-card"><div class="eyebrow">HET MODEL</div><h3 style="margin-top:7px">Hoe wordt de top 10 gekozen?</h3><p>De app rangschikt ${count||'maximaal 40'} beleggingen op een transparante interesse-indicatie. De score is geen koop- of waardeoordeel.</p><ol class="method-list"><li><b>Koersontwikkeling:</b> prestaties over 6 en 12 maanden en positie tegenover het 200-daags gemiddelde.</li><li><b>Risico:</b> koersschommelingen en afstand tot recente toppen worden meegewogen.</li><li><b>Persoonlijke afstemming:</b> defensief, gebalanceerd of groei en de gekozen horizon beïnvloeden de score.</li><li><b>Spreiding:</b> de algemene top 10 beperkt dubbels en overconcentratie in één beleggingscategorie.</li></ol><div class="mini-divider"></div><p><b>Belangrijke beperking:</b> er worden geen koers-winstverhoudingen, cashflowwaarderingen, schuldratio’s, ETF-kosten of actuele nieuwsrisico’s beoordeeld. Een sterk koersverloop maakt een belegging dus niet automatisch aantrekkelijk geprijsd.</p></section>
    <section class="small-card"><div class="eyebrow">GEGEVENS</div><h3 style="margin-top:6px">Databron en verversing</h3><div class="key-value"><span>Instrumenten met koersdata</span><b>${state.market.length} / ${catalog.length}</b></div><div class="key-value"><span>Laatste beursdag</span><b>${esc(state.snapshot?.latestTradingDay||'Nog niet geladen')}</b></div><div class="key-value"><span>Bron</span><b>Yahoo Finance / yfinance</b></div><p>Marktdata worden na het publiceren normaal iedere beursnacht opgehaald. Een update kan vertraagd zijn of mislukken. De verversknop controleert of een nieuwe snapshot is gepubliceerd; hij haalt geen intraday-beursdata op.</p><button type="button" class="primary-button secondary-button" data-action="refresh">Controleer op nieuwe gegevens</button></section>
    <p class="note">Voor Belgische beleggers: bekijk altijd de productdocumentatie, brokerbeschikbaarheid, fiscaliteit en risico’s vóór je belegt.</p>`;
  }
  function details(ticker){
    const a=(state.market.length?state.market:catalog).find(x=>x.ticker===ticker)||catalog.find(x=>x.ticker===ticker);
    if(!a)return '';
    const valid=hasData(a),m=score(a);
    return `<div class="modal-layer" data-action="close-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="Analyse ${esc(a.name)}"><div class="grabber"></div><div class="modal-header"><div class="modal-title">${categoryLogo(a)}<div><h2>${esc(a.name)}</h2><p>${esc(a.ticker)} · ${esc(names[a.category]||a.category)} · ${esc(a.currency)}</p></div></div><button class="close-btn" data-action="close" aria-label="Sluiten">×</button></div>
    <div class="modal-chart"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="eyebrow">KOERSVERLOOP · CA. 12 MAANDEN</span><strong class="${cls(a.change12m)}" style="font-size:12px">${pct(a.change12m)}</strong></div>${valid?sparkline(a,true):'<div style="height:90px;display:grid;place-items:center;color:#acb7c5;font-size:12px">Nog geen koersgrafiek beschikbaar</div>'}</div>
    <div class="modal-metrics"><div class="modal-metric"><span>Interessescore</span><strong>${m===null?'—':m+' / 100'}</strong></div><div class="modal-metric"><span>Laatste koers</span><strong>${price(a)}</strong></div><div class="modal-metric"><span>Koers in euro</span><strong>${euro(a.priceEUR)}</strong></div><div class="modal-metric"><span>Risicoklasse*</span><strong>${riskWord(a)}</strong></div><div class="modal-metric"><span>Laatste 6 maanden</span><strong class="${cls(a.change6m)}">${pct(a.change6m)}</strong></div><div class="modal-metric"><span>Vanaf 12m top</span><strong class="${cls(a.drawdown)}">${pct(a.drawdown)}</strong></div><div class="modal-metric"><span>Jaarlijkse volatiliteit*</span><strong>${pct(a.volatility)}</strong></div><div class="modal-metric"><span>T.o.v. 200d gemiddelde</span><strong class="${cls(a.above200d)}">${pct(a.above200d)}</strong></div></div>
    <div class="modal-section"><h3>Waarom bekijken?</h3><p>${esc(a.description)} ${valid?`De score weerspiegelt onder meer ${esc(why(a))}.`:'Er zijn nog geen recente beursgegevens beschikbaar voor een onderbouwde scoreschatting.'}</p></div>
    <div class="modal-section"><h3>Waar moet je op letten?</h3><p>${esc(a.caution)} ${a.currency==='USD'?'De waarde in euro wordt bovendien beïnvloed door de EUR/USD-wisselkoers.':''}</p></div>
    <div class="modal-section"><h3>Praktische informatie</h3><p>De getoonde koers is indicatief en kan vertraagd zijn. Bij een ETF of ETC: controleer ISIN, distributiebeleid, fondskosten, beursnotering en fiscaliteit bij jouw broker.</p></div>
    <button type="button" class="primary-button ${saved(a.ticker)?'secondary-button':''}" data-action="favorite" data-ticker="${esc(a.ticker)}">${saved(a.ticker)?'★ Verwijderen uit bewaarlijst':'☆ Bewaar in mijn lijst'}</button>
    <p class="modal-foot">* Volatiliteit en risicoklasse zijn ruwe indicatoren, geen gereguleerde risicoclassificatie. Een daling van 100% blijft voor bepaalde activa mogelijk. Historische prestaties bieden geen garantie voor toekomstige resultaten.</p></section></div>`;
  }
  function help(){
    return `<div class="modal-layer" data-action="close-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="WealthPilot installeren"><div class="grabber"></div><div class="modal-header"><h2>WealthPilot op je iPhone</h2><button class="close-btn" data-action="close">×</button></div><div class="modal-section"><h3>1 · Publiceer de app</h3><p>Upload alle bestanden naar een GitHub-repository en kies bij Settings → Pages de bron <b>GitHub Actions</b>. Start daarna de workflow 'WealthPilot · beursdata en iPhone-app' onder Actions. Open de gepubliceerde GitHub Pages-link in Safari.</p></div><div class="modal-section"><h3>2 · Zet hem op je beginscherm</h3><p>Open de website in Safari → tik op Deel → <b>Zet op beginscherm</b> (of 'Add to Home Screen') → Voeg toe. Je krijgt een app-icoon en een scherm zonder browserbalk.</p></div><div class="modal-section"><h3>3 · Gebruik de radar</h3><p>De nachtelijke workflow haalt na beursafsluiting gegevens op. De vernieuwknop controleert alleen op een recentere gepubliceerde versie. Je favorieten en risicoprofiel blijven op dit toestel bewaard.</p></div><div class="modal-section"><h3>Belangrijk</h3><p>WealthPilot koopt niets en is geen financieel adviseur. De top 10 is een transparant, koersgebaseerd startpunt voor eigen onderzoek, niet een volledige fundamentele analyse. De feed kan tijdelijk uitvallen.</p></div></section></div>`;
  }
  function modal(){return state.modal === 'help'||state.modal==='method'?help():state.modal?.startsWith('detail:')?details(state.modal.slice(7)):'';}
  function nav(){return `<nav class="bottom-nav" aria-label="Navigatie"><div class="nav-inner">${[['radar',icons.chart,'Radar'],['favorites',icons.star,'Bewaard'],['insight',icons.book,'Inzicht']].map(([key,icon,label])=>`<button class="nav-item ${state.tab===key?'active':''}" data-action="tab" data-tab="${key}" aria-current="${state.tab===key?'page':'false'}">${icon}<span>${label}</span></button>`).join('')}</div></nav>`;}
  function render(){
    const app=$('#app');
    app.innerHTML=`<main class="main">${state.tab==='radar'?home():state.tab==='favorites'?favoritesView():insight()}</main>${nav()}${modal()}`;
    document.body.style.overflow=state.modal?'hidden':'';
  }
  function renderCardArea(){
    if(state.tab!=='radar')return;
    const el=$('#asset-list');if(!el)return;
    const c=takeTop(rankedCandidates());
    el.innerHTML=c.length?c.map(assetCard).join(''):'<div class="empty"><h3>Geen resultaten</h3><p>Probeer een andere zoekterm of categorie.</p></div>';
    if($('#count-label'))$('#count-label').textContent=`${c.length} getoond`;
  }
  async function refresh(){
    if(state.fetching)return;
    state.fetching=true;render();
    try{
      const response=await fetch(`./data/market.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Netwerkrespons '+response.status);
      const data=await response.json();
      if(Array.isArray(data.instruments)&&data.instruments.length>=8){
        state.snapshot=data;
        state.market=data.instruments.filter(hasData).map(x=>({...catalog.find(c=>c.ticker===x.ticker),...x}));
        state.offlineMode=false;
      }else if(!state.market.length){
        state.snapshot=data;
        state.offlineMode=true;
      }
    }catch(err){console.warn('Geen nieuwe marktgegevens:',err.message);}
    state.fetching=false;render();
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target)return;
    const action=target.dataset.action;
    if(action==='close-layer'&&event.target!==target)return;
    if(action==='favorite'){
      event.stopPropagation();const ticker=target.dataset.ticker;
      state.favorites=saved(ticker)?state.favorites.filter(t=>t!==ticker):[...state.favorites,ticker];
      save('favorites',state.favorites);render();return;
    }
    if(action==='tab'){
      state.tab=target.dataset.tab;state.category='alles';state.search='';state.modal=null;render();window.scrollTo(0,0);return;
    }
    if(action==='category'){state.category=target.dataset.category;render();return;}
    if(action==='detail'){state.modal=`detail:${target.dataset.ticker}`;render();return;}
    if(action==='close'||action==='close-layer'){state.modal=null;render();return;}
    if(action==='help'||action==='method'){state.modal='help';render();return;}
    if(action==='refresh'){refresh();return;}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.modal){state.modal=null;render();return;}
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('.asset-card')){
      event.preventDefault();state.modal='detail:'+event.target.dataset.ticker;render();
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.dataset.setting){
      const k=event.target.dataset.setting;state[k]=k==='horizon'?Number(event.target.value):event.target.value;
      save(k,state[k]);render();
    }
    if(event.target.dataset.calc){
      const k=event.target.dataset.calc;let val=Number(event.target.value);
      if(!Number.isFinite(val)) val=0;
      state[k]=clamp(val,k==='calculatorYears'?1:0,k==='calculatorYears'?50:100000000);
      save(k,state[k]);render();
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='search-field'){state.search=event.target.value;renderCardArea();}
  });
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();refresh();
})();
