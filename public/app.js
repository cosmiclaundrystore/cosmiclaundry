(() => {
 'use strict';
 const {collections,products}=window.CosmicCatalog;
 const main=document.querySelector('#main');
 // Home page hero and tee strip: Laundries with a featured tee, except those switched off for the home page (onHome:false, e.g. Custom).
 const featured=collections.filter(c=>c.featured&&c.onHome!==false);
 let active=0, heroProductId=null, token=0, categoryToken=0, lastTrigger=null;
 // Hero arrows walk through every tee, collection by collection (featured tee first in each).
 const heroSequence=()=>featured.flatMap(c=>{const list=itemsFor(c.id);return [...list.filter(p=>p.id===c.featured),...list.filter(p=>p.id!==c.featured)];});
 let selectedFilter='all',searchTerm='',selectedSort='featured';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getProduct=id=>products.find(p=>p.id===id);
 const itemsFor=id=>products.filter(p=>p.collection===id);
 // Clean links: /laundries (every tee), /laundries/<id> (a Laundry), /tees/<id> (a tee, opened over its Laundry).
 const url=c=>'/laundries/'+c.id;
 const teeUrl=p=>'/tees/'+p.id;
 const arrow=(direction='right')=>'<svg class="arrow-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(direction==='left'?'M19 12H5m6-6-6 6 6 6':direction==='down'?'M12 5v14m-6-6 6 6 6-6':'M5 12h14m-6-6 6 6-6 6')+'"/></svg>';
 const chevron=(direction='right')=>'<svg class="chevron-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(direction==='left'?'M15 5l-7 7 7 7':'M9 5l7 7-7 7')+'"/></svg>';
 const image=(source,alt,cls='',eager=false,small=false)=>'<img class="'+cls+'" src="'+source+'" alt="'+esc(alt)+'" width="1122" height="1402" loading="'+(eager?'eager':'lazy')+'" decoding="async"'+(eager?' fetchpriority="high"':'')+(source.includes('-480.webp')&&source.includes('/products/')?' srcset="'+source+' 480w, '+source.replace('-480.webp','.webp')+' 1122w" sizes="'+(alt?'(max-width:650px) 46vw, 30vw':'70px')+'"':'')+'>';
 const garment=(p,cls='',eager=false)=>image(p.image,p.name+' oversized T-shirt',cls,eager);
 const missing=()=>'<div class="missing-art"><span class="missing-orbit" aria-hidden="true"></span><p>Next in the wash.</p><span>Artwork coming soon</span></div>';
 const price=p=>typeof p.price==='number'?window.CosmicCatalog.formatPrice(p.price):'Price to be confirmed';
 function collectionCards(){return collections.map(c=>{
  const count=itemsFor(c.id).length;
  return '<a class="collection-card" href="'+url(c)+'" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'"><div class="collection-visual">'+(c.image?image(c.thumbnail,c.name+' featured tee'):missing())+'<span class="card-open" aria-hidden="true">'+arrow()+'</span></div><div class="collection-card-info"><h3>'+esc(c.name)+'</h3><span>'+(count?count+' '+(count===1?'design':'designs'):'Coming soon')+'</span></div></a>';
 }).join('');}
 function cards(list){return list.flatMap(p=>p.collection==='custom'?p.colors.map(color=>({...p,thumbnail:color.thumbnail,color:color.label,cardColor:color.id})):p).map(p=>'<button type="button" class="product-card" data-product-id="'+p.id+'"'+(p.cardColor?' data-product-color="'+esc(p.cardColor)+'"':'')+' aria-label="Explore '+esc(p.name)+(p.cardColor?' '+esc(p.color):'')+' tee in 3D"><div class="product-art">'+image(p.thumbnail,p.name+' '+(p.cardColor?p.color+' ':'')+'oversized tee')+'<span class="product-3d-label" aria-hidden="true">Explore in 3D</span><span class="product-open" aria-hidden="true">+</span></div><div class="product-meta"><h2>'+esc(p.name)+'</h2><p class="product-price">'+price(p)+'</p><span>'+p.color+' · Oversized tee</span></div></button>').join('');}
 function featuredInfo(c,p){const list=itemsFor(c.id),n=list.length,i=Math.max(0,[...list.filter(x=>x.id===c.featured),...list.filter(x=>x.id!==c.featured)].findIndex(x=>x.id===p.id));return '<p class="feature-laundry">'+esc(c.name)+(n>1?'<span class="feature-count"> · '+(i+1)+' / '+n+'</span>':'')+'</p><h2>'+esc(p.name)+'</h2><p class="feature-price">'+price(p)+'</p><p class="feature-spec">'+p.color+' / Oversized tee</p>';}
 // Hero strip: every tee, moving continuously. The list is rendered twice so the loop is seamless.
 let stopMarquee=()=>{};
 function heroMarquee(current){
  const seq=heroSequence();
  const item=(p,copy)=>'<button type="button" data-hero-product="'+p.id+'" aria-pressed="'+(!copy&&p.id===current.id)+'"'+(copy?' tabindex="-1" aria-hidden="true"':' aria-label="Show '+esc(p.name)+'"')+'>'+image(p.thumbnail,'')+'<span>'+esc(p.name)+'</span></button>';
  return '<div class="hero-collections hero-marquee" role="group" aria-label="Choose a tee"><div class="hero-marquee-track">'+seq.map(p=>item(p,false)).join('')+seq.map(p=>item(p,true)).join('')+'</div></div>';
 }
 // Inclined orbital planes, each with two independently moving satellites.
 // Flat, tilted ovals that cross each other, like real orbits. Shared by the home hero and every Laundry.
 const ORBIT_PLANES=[
  [108,24,-8],[104,28,-5],[100,32,-2],[96,36,2],
  [92,40,6],[88,44,10],[106,30,-19],[102,34,20],
  [100,38,-42],[96,34,48],[94,30,-66],[90,28,73]
 ];
 function heroOrbits(){return renderOrbits(ORBIT_PLANES);}
 // Each Laundry's orbit colour and speed (the ring shapes are the shared ORBIT_PLANES).
 const laundryOrbits = {
  'mona-lisa': { color: '#8e6840', speed: 40 },
  'family-guy': { color: '#697b68', speed: 31 },
  'rick-and-morty': { color: '#53854d', speed: 17 },
  'spongebob': { color: '#527e94', speed: 36 },
  'popeye': { color: '#506f8b', speed: 42 },
  'bad-influence': { color: '#7e6052', speed: 23 },
  'jujutsu-kaisen': { color: '#715b91', speed: 27 },
  'attack-on-titan': { color: '#79764a', speed: 46 },
  'bleach': { color: '#546b83', speed: 19 },
  'demon-slayer': { color: '#a45f45', speed: 22 },
  'naruto': { color: '#a67a3b', speed: 25 },
  'one-punch-man': { color: '#a65f50', speed: 16 },
  'pink-panther': { color: '#b0476f', speed: 29 },
 };
 function collectionOrbits(collectionId, productCount){
  if(!productCount)return '';
  // As many oval orbits as the Laundry has tees; each Laundry keeps its own colour and speed.
  let profile = Object.hasOwn(laundryOrbits, collectionId) ? laundryOrbits[collectionId] : null;
  if(!profile){
   // Admin-created collections get a stable speed from their slug.
   const seed = Array.from(collectionId).reduce((hash, char) => (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0, 0);
   profile = { speed: 26 + seed % 13, color: '#77796b' };
  }
  // Custom Laundry displays each color as a tee, so give each color its own orbit.
  const orbitCount=collectionId==='custom'?itemsFor(collectionId).reduce((count,p)=>count+p.colors.length,0):productCount;
  return renderOrbits(collectionPlanes(orbitCount), profile.speed, profile.color);
 }
 // One tilted oval per tee in the Laundry (3 tees -> 3 orbits). The first 12 are the home hero's shapes;
 // bigger Laundries repeat them turned a little further each round, so no two orbits lie on top of each other.
 // Order that puts clearly different tilts first, so a Laundry with only 2–3 tees still looks like crossing orbits.
 const SPREAD=[0,9,8,3,10,11,6,7,4,1,5,2];
 function collectionPlanes(count){
  return Array.from({length:count},(_,i)=>{
   const [w,h,tilt]=ORBIT_PLANES[SPREAD[i%SPREAD.length]],round=Math.floor(i/SPREAD.length);
   if(!round)return [w,h,tilt];
   const shrink=1-Math.min(.3,round*.025);
   return [w*shrink,h*shrink,tilt+(round%2?1:-1)*(4+round*3)];
  });
 }
 function renderOrbits(planes, speed=24, color){
  const density = color && planes.length > 12 ? ' orbit-dense' : '';
  return '<div class="orbital-track'+density+'" aria-hidden="true"'+(color?' style="--orbit-ink:'+color+'"':'')+'>'+planes.map(([w,h,tilt,x=50,y=49,stroke='solid'],i)=>
   '<span class="orbit-plane" style="--orbit-w:'+w+'%;--orbit-h:'+h+'%;--orbit-tilt:'+tilt+'deg;--orbit-x:'+x+'%;--orbit-y:'+y+'%;--orbit-stroke:'+stroke+';--orbit-size:'+(4+i%4*2)+'px;--orbit-speed:'+(speed+i*3)+'s;--orbit-delay:-'+(i*7+3)+'s;--orbit-direction:'+(i%2?'reverse':'normal')+'"></span>'
  ).join('')+'</div>';
 }
 // Sample only the print area, ignoring neutral fabric and transparent pixels.
 // Tiny cached samples keep this enhancement independent of product navigation.
 const heroPalettes=new Map();
 function tintHeroFromPrint(){
  const hero=main.querySelector('.hero, .laundry-page'),img=hero?.querySelector('.hero-main-image, .category-garment img');
  if(!img)return;
  const apply=()=>{
   if(!img.isConnected||hero.querySelector('.hero-main-image, .category-garment img')!==img)return;
   const source=img.currentSrc||img.src;
   let palette=heroPalettes.get(source);
   if(!palette){
    try{
     const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     ctx.drawImage(img,img.naturalWidth*.28,img.naturalHeight*.2,img.naturalWidth*.44,img.naturalHeight*.55,0,0,32,32);
     const pixels=ctx.getImageData(0,0,32,32).data,bins=Array.from({length:12},()=>({r:0,g:0,b:0,w:0}));
     for(let i=0;i<pixels.length;i+=4){
      const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255;
      const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
      if(pixels[i+3]<200||max<.18||delta<.1)continue;
      let hue=max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
      hue=(hue*60+360)%360;
      const bin=bins[Math.floor(hue/30)],weight=delta;
      bin.r+=r*255*weight;bin.g+=g*255*weight;bin.b+=b*255*weight;bin.w+=weight;
     }
     const ranked=bins.filter(bin=>bin.w>0).sort((a,b)=>b.w-a.w);
     palette=ranked.slice(0,2).map(bin=>'rgb('+[bin.r,bin.g,bin.b].map(v=>Math.round(v/bin.w)).join(',')+')');
     if(!palette.length)palette=['#b4aea1'];
     heroPalettes.set(source,palette);
    }catch{palette=['#b4aea1'];}
   }
   document.body.style.setProperty('--hero-wash-primary',palette[0]);
   document.body.style.setProperty('--hero-wash-secondary',palette[1]||palette[0]);
  };
  if(img.complete&&img.naturalWidth)apply();else img.addEventListener('load',apply,{once:true});
 }
 function renderHome(scroll=false){
  const c=featured[active],p=(heroProductId&&getProduct(heroProductId)?.collection===c.id)?getProduct(heroProductId):getProduct(c.featured);
  main.innerHTML='<section class="hero" data-hero style="--hero-tint:'+c.tint+';--accent:'+c.accent+'"><div class="hero-intro" data-hero-copy><h1>Made to be worn.<br><em>Hard to ignore.</em></h1><p>Oversized tees.<br>Extraordinary characters.</p></div><div class="hero-studio" data-hero-item data-depth>'+heroOrbits()+'<div class="floor-shadow" aria-hidden="true"></div><button class="hero-step previous" data-hero-step="-1" aria-label="Previous tee">'+arrow('left')+chevron('left')+'</button><button class="hero-product" data-hero-collection="'+c.id+'" aria-label="Explore '+esc(c.name)+'"><div class="hero-depth" data-depth-layer><div class="hero-float" data-float>'+garment(p,'hero-main-image',true)+'</div></div></button><button class="hero-step next" data-hero-step="1" aria-label="Next tee">'+arrow()+chevron('right')+'</button></div><div class="feature-info" aria-live="polite">'+featuredInfo(c,p)+'</div><div class="hero-controls"><div class="selection-label">Featured Collections<span>Choose your rotation</span></div>'+heroMarquee(p)+'</div></section>';
  if(scroll) requestAnimationFrame(()=>document.querySelector('#collections')?.scrollIntoView({behavior:'instant'}));
  stopMarquee=window.CosmicMarquee?.init(main.querySelector('.hero-marquee'))||(()=>{});
  tintHeroFromPrint();
  scheduleHeroAuto();
 }
 // Hero: move to the next tee (in strip order) every 8 seconds. Any manual change (arrows, strip, keys)
 // restarts the 8-second countdown. Pauses while hovering the tee, with a window open, in a hidden tab,
 // or with reduced/paused motion.
 const HERO_AUTO_MS=8000;let heroAutoTimer=0;
 function stopHeroAuto(){clearTimeout(heroAutoTimer);heroAutoTimer=0;}
 function scheduleHeroAuto(){
  stopHeroAuto();
  heroAutoTimer=setTimeout(()=>{
   const studio=main.querySelector('.hero-studio');if(!studio)return;
   const blocked=document.hidden||studio.matches(':hover')||document.querySelector('dialog[open]')||matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.hasAttribute('data-motion-paused');
   if(!blocked)stepHero(1,true);
   scheduleHeroAuto();
  },HERO_AUTO_MS);
 }
 function stepHero(dir,auto=false){
  if(!auto)scheduleHeroAuto();
  const seq=heroSequence();if(!seq.length)return;
  const current=heroProductId||featured[active].featured;
  const i=Math.max(0,seq.findIndex(p=>p.id===current));
  const next=seq[(i+dir+seq.length)%seq.length];
  selectHero(featured.findIndex(c=>c.id===next.collection),next.id);
 }
 async function selectHero(index,productId){
  active=(index+featured.length)%featured.length;
  const c=featured[active],chosen=productId&&getProduct(productId),p=chosen&&chosen.collection===c.id?chosen:getProduct(c.featured),target=main.querySelector('.hero-product');
  heroProductId=p.id;
  if(!target)return;
  const current=++token;
  // Decode before fading so a cold image cache cannot leave an empty stage.
  const incoming=new Image();incoming.src=p.image;
  try{await incoming.decode();}catch{ /* Keep the existing image on load failure. */ return; }
  if(current!==token||!target.isConnected)return;
  main.querySelectorAll('[data-hero-select]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.heroSelect===active)));
  main.querySelectorAll('[data-hero-product]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.heroProduct===p.id&&!b.hasAttribute('aria-hidden'))));
  // Keep the new shopping action available immediately, independent of motion.
  main.querySelector('.feature-info').innerHTML=featuredInfo(c,p);
  target.dataset.heroCollection=c.id;
  target.setAttribute('aria-label','Explore '+c.name);
  const update=()=>{
   if(current!==token||!target.isConnected)return;
   target.querySelector('.hero-float').innerHTML=garment(p,'hero-main-image',true);
   tintHeroFromPrint();
   target.dataset.heroCollection=c.id;target.setAttribute('aria-label','Explore '+c.name);
   main.querySelector('.hero').style.setProperty('--hero-tint',c.tint);
   main.querySelector('.hero').style.setProperty('--accent',c.accent);
  };
  if(window.CosmicMotion)await window.CosmicMotion.transition({out:target,in:target,update,crossfade:true});else update();
 }
 // Custom Laundry: customers upload their own design in the tee window, then buy it like any tee.
 const uploadIcon='<svg class="upload-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';
 function customInfo(p){return '<span class="featured-mark">Made to order</span><h2>'+esc(p.name)+'</h2><p class="feature-price">'+price(p)+'</p><p>Upload your PNG and tell us how you want it, then check out as usual.</p><button class="primary-link upload-design" type="button" data-product-id="'+p.id+'">'+uploadIcon+' Upload your design</button>';}
 function categoryInfo(c,p){if(c.id==='custom')return customInfo(p);return '<span class="featured-mark">Featured design</span><h2>'+esc(p.name)+'</h2><p>'+p.color+' / Oversized tee</p><button class="primary-link" type="button" data-product-id="'+p.id+'">Explore tee '+arrow()+'</button>';}
 // One shop page: the same search box and Laundry chips sit on top of "All tees" (/laundries) and of each
 // Laundry (/laundries/<id>, which adds its hero with the rotating tees). Choosing a chip switches in place.
 function shopTop(selected){
  // A–Z, with the made-to-order Custom Laundry always last.
  const sortedCollections = [...collections].sort((a, b) => (a.id === 'custom') - (b.id === 'custom') || a.short.localeCompare(b.short, 'en'));
  return '<div class="shop-top"><label class="shop-search" for="product-search"><span>Search designs</span><input id="product-search" type="search" value="'+esc(searchTerm)+'" placeholder="Find a design or character" autocomplete="off"></label>'+
   '<div class="collection-filter-links" role="group" aria-label="Choose a Laundry"><button type="button" data-filter="all" aria-pressed="'+(selected==='all')+'">All tees</button>'+
   sortedCollections.map(c=>'<button type="button" data-filter="'+c.id+'" aria-pressed="'+(selected===c.id)+'">'+esc(c.short)+'</button>').join('')+'</div></div>';
 }
 function revealSelectedChip(){const chip=main.querySelector('.collection-filter-links [aria-pressed="true"]');chip?.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});}
 function renderCollection(id){
  const c=collections.find(c=>c.id===id);if(!c){renderNotFound();return;}
  const list=itemsFor(id),p=getProduct(c.featured);document.title=c.name+' | Cosmic Laundry';
  main.innerHTML='<div class="laundry-page" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'">'+shopTop(c.id)+'<section class="laundry-intro" data-hero><div class="laundry-copy" data-hero-copy><p class="section-kicker">'+esc(c.tagline)+'</p><h1>'+esc(c.name)+'</h1><p>'+esc(c.description)+'</p>'+(p?'':'<a class="quiet-link" href="/laundries">Explore available designs '+arrow()+'</a>')+'</div><div class="laundry-stage" data-depth data-hero-item>'+collectionOrbits(c.id,list.length)+(p?'<div class="floor-shadow" aria-hidden="true"></div><button class="category-garment" data-product-id="'+p.id+'" aria-label="View '+esc(p.name)+' tee"><div data-depth-layer><div data-float>'+garment(p,'',true)+'</div></div></button>':missing())+'</div>'+(p?'<div class="category-feature-info" aria-live="polite">'+categoryInfo(c,p)+'</div>':'')+'</section><section class="laundry-shop"><div class="shop-toolbar"><h2>'+ (p?'In this Laundry':'The next load is on its way')+'</h2><span>'+list.length+' '+(list.length===1?'design':'designs')+'</span></div>'+(list.length?'<div class="product-grid">'+cards(list)+'</div>':'<div class="empty-collection"><p>Bugs Bunny’s artwork has not been added yet.</p><a class="primary-link" href="/laundries">Explore the other Laundries '+arrow()+'</a></div>')+'</section></div>';
  tintHeroFromPrint();
  startLaundryRotation(c,list);revealSelectedChip();
 }
 // Laundry pages: the featured tee switches to the next tee in that Laundry every 4 seconds.
 // Pauses while the tab is hidden, a window is open, the pointer is over the tee, or motion is reduced/paused.
 let laundryTimer=0;
 function stopLaundryRotation(){clearInterval(laundryTimer);laundryTimer=0;}
 function startLaundryRotation(c,list){
  stopLaundryRotation();
  const order=[...list.filter(p=>p.id===c.featured),...list.filter(p=>p.id!==c.featured)];
  if(order.length<2)return;
  const stage=main.querySelector('.laundry-stage');let hovering=false,i=0;
  stage?.addEventListener('pointerenter',()=>{hovering=true;});stage?.addEventListener('pointerleave',()=>{hovering=false;});
  laundryTimer=setInterval(()=>{
   if(!stage?.isConnected){stopLaundryRotation();return;}
   if(document.hidden||hovering||document.querySelector('dialog[open]')||matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.hasAttribute('data-motion-paused'))return;
   i=(i+1)%order.length;selectCategory(order[i].id);
  },4000);
 }
 async function selectCategory(id){
  const p=getProduct(id),target=main.querySelector('.category-garment');if(!p||!target)return;
  const c=collections.find(c=>c.id===p.collection),current=++categoryToken;
  const incoming=new Image();incoming.src=p.image;
  try{await incoming.decode();}catch{return;}
  if(current!==categoryToken||!target.isConnected)return;
  main.querySelectorAll('[data-category-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categorySelect===id)));
  main.querySelector('.category-feature-info').innerHTML=categoryInfo(c,p);
  target.dataset.productId=p.id;
  target.setAttribute('aria-label','View '+p.name+' tee');
  const update=()=>{if(current!==categoryToken||!target.isConnected)return;target.querySelector('[data-float]').innerHTML=garment(p,'',true);tintHeroFromPrint();target.dataset.productId=id;target.setAttribute('aria-label','View '+p.name+' tee');};
  if(window.CosmicMotion)await window.CosmicMotion.transition({out:target,in:target,update,crossfade:true});else update();
 }
 function renderAll(){document.title='All Laundries | Cosmic Laundry';selectedFilter='all';main.innerHTML='<div class="route-page"><h1 class="cl-sr-only">All Laundries</h1>'+shopTop('all')+'<div class="shop-toolbar"><span id="product-count" role="status"></span><label class="sort-field" for="product-sort">Sort by <select id="product-sort"><option value="featured">Featured</option><option value="az">Name: A to Z</option><option value="za">Name: Z to A</option></select></label></div><section class="product-grid" id="all-products" aria-label="All graphic tees"></section></div>';document.querySelector('#product-sort').value=selectedSort;updateAllProducts();revealSelectedChip();}
 // All tees: every ready-made tee. The made-to-order Custom tee only shows under its own Custom chip.
 function updateAllProducts(){const grid=document.querySelector('#all-products');if(!grid)return;const query=searchTerm.trim().toLowerCase();const list=products.filter(p=>p.collection!=='custom'&&(selectedFilter==='all'||p.collection===selectedFilter)&&(!query||(p.name+' '+collections.find(c=>c.id===p.collection).name).toLowerCase().includes(query)));if(selectedSort==='az')list.sort((a,b)=>a.name.localeCompare(b.name));if(selectedSort==='za')list.sort((a,b)=>b.name.localeCompare(a.name));document.querySelector('#product-count').textContent=list.length+' '+(list.length===1?'design':'designs');main.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===selectedFilter)));grid.innerHTML=list.length?cards(list):'<div class="empty-results"><h2>No designs found.</h2><p>Try another name or explore all tees.</p><button type="button" data-reset-filters>Reset filters</button></div>';}

 function renderNotFound(){main.innerHTML='<section class="route-page"><h1 class="all-title">A little off course.</h1><p>'+(location.pathname.startsWith('/tees/')?'This tee could not be found.':location.pathname.startsWith('/laundries/')?'This Laundry could not be found.':'This page could not be found.')+'</p><a class="text-link" href="/laundries">Back to all Laundries</a></section>';}
 // ---------- Routing (History API) ----------
 // Old #/ links (shared before the clean URLs) are rewritten to their clean address.
 function legacyPath(hash){
  const h=hash.replace(/^#/,'');
  if(h==='/'||h==='/collections'||h==='/about'||h==='main')return '/';
  if(h==='/all')return '/laundries';
  if(h.startsWith('/laundry/'))return '/laundries/'+h.slice(9);
  return null;
 }
 const cleanPath=()=>location.pathname.replace(/\/+$/,'')||'/';
 // A tee link shows its Laundry page with the tee open on top.
 const teeId=path=>path.startsWith('/tees/')?decodeURIComponent(path.slice(6)):null;
 const pageFor=path=>{const id=teeId(path);if(id===null)return path;const p=getProduct(id);return p?url({id:p.collection}):path;};
 let renderedPage=null, pageTitle='Cosmic Laundry', openTee=null, teePushed=false;
 function render(page){
  stopLaundryRotation();stopHeroAuto();stopMarquee();stopMarquee=()=>{};token++;categoryToken++;window.CosmicMotion?.destroy();
  document.title='Cosmic Laundry';
  const isHome=page==='/';
  document.body.classList.toggle('is-home',isHome);
  document.body.classList.toggle('is-collection',page.startsWith('/laundries/'));
  document.body.classList.toggle('is-catalog',page==='/laundries');
  if(isHome)renderHome();
  else if(page.startsWith('/laundries/'))renderCollection(decodeURIComponent(page.slice(11)));
  else if(page==='/laundries')renderAll();
  else renderNotFound();
  window.scrollTo({top:0,behavior:'instant'});
  window.CosmicMotion?.init(document);main.focus({preventScroll:true});
  renderedPage=page;pageTitle=document.title;
  document.querySelectorAll('.site-header nav a').forEach(a=>{const href=a.getAttribute('href');const match=href===page||(href==='/laundries'&&page.startsWith('/laundries/'));if(match)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.dispatchEvent(new CustomEvent('cosmic:navigate',{detail:{path:page}}));
 }
 function route(){
  const path=cleanPath(),page=pageFor(path),id=teeId(path);
  if(page!==renderedPage)render(page);
  const p=id!==null&&getProduct(id);
  if(p){if(openTee!==p.id){openTee=p.id;window.CosmicCommerce.openProduct(p.id,null);}document.title=p.name+' | Cosmic Laundry';}
  else{if(openTee){openTee=null;teePushed=false;window.CosmicCommerce.close();}document.title=pageTitle;}
 }
 function navigate(path){
  if(path===cleanPath()&&!openTee){window.scrollTo({top:0,behavior:'instant'});return;}
  if(openTee){openTee=null;teePushed=false;window.CosmicCommerce.close();}
  history.pushState(null,'',path);route();
 }
 // Opening a tee gives it its own link; closing it goes back to the page underneath.
 function onTeeOpen(id){
  if(openTee===id)return;
  openTee=id;const p=getProduct(id);
  if(p){teePushed=true;history.pushState({tee:id},'',teeUrl(p));document.title=p.name+' | Cosmic Laundry';}
 }
 function onTeeClose(){
  if(!openTee)return;
  openTee=null;document.title=pageTitle;
  if(teePushed){teePushed=false;history.back();}
  else history.replaceState(null,'',renderedPage);
 }
 document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('a[href="#main"]')){e.preventDefault();main.focus();return;}
   if(t.closest('a.brand')&&cleanPath()==='/'&&!openTee){e.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  // Shop links move between pages without reloading; /checkout, /admin and other sites load normally.
  const link=t.closest('a[href]');
  if(link&&!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!link.target&&!link.hasAttribute('download')){
   const to=new URL(link.href,location.href);
   if(to.origin===location.origin&&/^\/(laundries(\/[^/]+)?|tees\/[^/]+)?\/?$/.test(to.pathname)&&!to.hash){e.preventDefault();navigate(to.pathname.replace(/\/+$/,'')||'/');return;}
  }
  // Home hero: the tee opens its Laundry.
  const heroTee=t.closest('[data-hero-collection]');if(heroTee){navigate(url({id:heroTee.dataset.heroCollection}));return;}
  const step=t.closest('[data-hero-step]');if(step){stepHero(Number(step.dataset.heroStep));return;}
  const select=t.closest('[data-hero-select]');if(select){selectHero(Number(select.dataset.heroSelect));return;}
   const pick=t.closest('[data-hero-product]');if(pick){const prod=getProduct(pick.dataset.heroProduct);if(prod){scheduleHeroAuto();selectHero(featured.findIndex(c=>c.id===prod.collection),prod.id);}return;}
  const cat=t.closest('[data-category-select]');if(cat){selectCategory(cat.dataset.categorySelect);return;}
  const customColor=t.closest('[data-custom-color]');if(customColor){
   const p=getProduct(customColor.dataset.customProduct),color=p?.colors.find(c=>c.id===customColor.dataset.customColor),target=main.querySelector('.category-garment');
   if(color&&target){target.querySelector('[data-float]').innerHTML=garment({...p,image:color.image,name:p.name+' '+color.label},'',true);target.dataset.productColor=color.id;main.querySelectorAll('[data-custom-color]').forEach(b=>b.setAttribute('aria-pressed',String(b===customColor)));}
   return;
  }
  const filter=t.closest('[data-filter]');if(filter){const f=filter.dataset.filter;searchTerm='';navigate(f==='all'?'/laundries':url({id:f}));return;}
  if(t.closest('[data-reset-filters]')){selectedFilter='all';searchTerm='';document.querySelector('#product-search').value='';updateAllProducts();document.querySelector('#product-search').focus();return;}
  const info=t.closest('[data-info]');if(info){lastTrigger=info;const fit=info.dataset.info==='fit';document.querySelector('#info-title').textContent=fit?'Fit & sizing':'Ordering & delivery';document.querySelector('#info-content').innerHTML=fit?'<p>These designs are shown on oversized T-shirts. Save a size preference in your laundry basket.</p><p>Final garment measurements are being confirmed. When you send your laundry basket on WhatsApp, we’ll confirm your size with you.</p>':'<p>Add the tees you like to your laundry basket, then tap <strong>Get Your Laundry</strong> to send it to us on WhatsApp.</p><p>We’ll reply on WhatsApp to confirm price, availability, payment and delivery. No payment is taken on this website.</p>';document.querySelector('.info-dialog').showModal();}
  if(t.closest('.close-info'))document.querySelector('.info-dialog').close();
 });
 window.addEventListener('popstate',route);
 window.addEventListener('hashchange',()=>{const to=legacyPath(location.hash);if(to){history.replaceState(null,'',to);route();}});
 document.addEventListener('keydown',e=>{if(!e.target.closest('.hero-collections'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stepHero(e.key==='ArrowRight'?1:-1);requestAnimationFrame(()=>document.querySelector('[data-hero-product="'+heroProductId+'"]:not([aria-hidden])')?.focus({preventScroll:true}));}});
 document.addEventListener('input',e=>{if(e.target.id!=='product-search')return;searchTerm=e.target.value;
  // Searching from a Laundry searches every tee: switch to All tees and keep typing in the new box.
  if(renderedPage!=='/laundries'){navigate('/laundries');const box=document.querySelector('#product-search');if(box){box.focus({preventScroll:true});box.setSelectionRange(box.value.length,box.value.length);}return;}
  updateAllProducts();});
 document.addEventListener('change',e=>{if(e.target.id==='product-sort'){selectedSort=e.target.value;updateAllProducts();}});
 const infoDialog=document.querySelector('.info-dialog');infoDialog.addEventListener('close',()=>lastTrigger?.focus());infoDialog.addEventListener('click',e=>{if(e.target!==infoDialog)return;const b=infoDialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)infoDialog.close();});
 // Keep accessible text and space stable if a product image cannot be loaded.
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('main')){e.target.classList.add('image-unavailable');e.target.alt=e.target.alt||'Product image unavailable';}},true);
 // Shopping region (LK / UK / US): shows the current one, and switching reloads the page so every price,
 // the basket total and checkout use the new currency. The basket itself (tees, colours, sizes) is kept.
 const REGION_COOKIE='cl_region';
 const currentRegion=window.CosmicCatalog.commerce?.region||(document.cookie.match(/(?:^|; )cl_region=(LK|UK|US)/)||[])[1]||'LK';
 document.querySelectorAll('[data-region-switch] [data-region]').forEach(b=>b.setAttribute(b.getAttribute('role')==='menuitemradio'?'aria-checked':'aria-pressed',String(b.dataset.region===currentRegion)));
 // Header dropdown: shows the current region's flag and code; opens a small list of regions.
 const regionMenu=document.querySelector('[data-region-menu]');
 if(regionMenu){
  const button=regionMenu.querySelector('.region-menu-button'),list=regionMenu.querySelector('.region-menu-list');
  const current=list.querySelector('[data-region="'+currentRegion+'"]');
  if(current){regionMenu.querySelector('[data-region-flag]').innerHTML=current.querySelector('.region-flag').outerHTML;regionMenu.querySelector('[data-region-code]').textContent=currentRegion;button.setAttribute('aria-label','Shopping region: '+current.querySelector('.region-option-name').textContent+', prices in '+current.querySelector('.region-option-currency').textContent);}
  const items=()=>[...list.querySelectorAll('[data-region]')];
  const open=()=>{list.hidden=false;button.setAttribute('aria-expanded','true');(list.querySelector('[aria-checked="true"]')||items()[0]).focus();};
  const close=(focus)=>{if(list.hidden)return;list.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus();};
  button.addEventListener('click',()=>list.hidden?open():close(false));
  document.addEventListener('click',e=>{if(!regionMenu.contains(e.target))close(false);});
  regionMenu.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();close(true);return;}
   if(list.hidden&&(e.key==='ArrowDown'||e.key==='ArrowUp')&&e.target===button){e.preventDefault();open();return;}
   if(!list.hidden&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();const all=items(),i=all.indexOf(document.activeElement);all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length].focus();}
  });
  regionMenu.addEventListener('focusout',e=>{if(!regionMenu.contains(e.relatedTarget))close(false);});
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-region-switch] [data-region]');if(!b)return;
  if(b.dataset.region===currentRegion)return;
  document.cookie=REGION_COOKIE+'='+b.dataset.region+'; path=/; max-age=31536000; samesite=lax';
  location.reload();
 });
 window.CosmicCommerce.init({products,collections,onCollectionChange:id=>navigate('/laundries/'+id),onProductOpen:onTeeOpen,onProductClose:onTeeClose});
 {const to=legacyPath(location.hash);if(to)history.replaceState(null,'',to);}
 route();
})();
