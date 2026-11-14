(() => {
 'use strict';
 const {collections,products}=window.CosmicCatalog;
 const main=document.querySelector('#main');
 const featured=collections.filter(c=>c.featured);
 let active=0, heroProductId=null, token=0, categoryToken=0, lastTrigger=null;
 // Hero arrows walk through every tee, collection by collection (featured tee first in each).
 const heroSequence=()=>featured.flatMap(c=>{const list=itemsFor(c.id);return [...list.filter(p=>p.id===c.featured),...list.filter(p=>p.id!==c.featured)];});
 let selectedFilter='all',searchTerm='',selectedSort='featured';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getProduct=id=>products.find(p=>p.id===id);
 const itemsFor=id=>products.filter(p=>p.collection===id);
 const url=c=>'#/laundry/'+c.id;
 const arrow=(direction='right')=>'<svg class="arrow-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(direction==='left'?'M19 12H5m6-6-6 6 6 6':direction==='down'?'M12 5v14m-6-6 6 6 6-6':'M5 12h14m-6-6 6 6-6 6')+'"/></svg>';
 const chevron=(direction='right')=>'<svg class="chevron-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(direction==='left'?'M15 5l-7 7 7 7':'M9 5l7 7-7 7')+'"/></svg>';
 const image=(source,alt,cls='',eager=false,small=false)=>'<img class="'+cls+'" src="'+source+'" alt="'+esc(alt)+'" width="1122" height="1402" loading="'+(eager?'eager':'lazy')+'" decoding="async"'+(eager?' fetchpriority="high"':'')+(source.includes('-480.webp')&&source.includes('/products/')?' srcset="'+source+' 480w, '+source.replace('-480.webp','.webp')+' 1122w" sizes="'+(alt?'(max-width:650px) 46vw, 30vw':'70px')+'"':'')+'>';
 const garment=(p,cls='',eager=false)=>image(p.image,p.name+' oversized T-shirt',cls,eager);
 const missing=()=>'<div class="missing-art"><span class="missing-orbit" aria-hidden="true"></span><p>Next in the wash.</p><span>Artwork coming soon</span></div>';
 const price=p=>typeof p.price==='number'?p.price.toLocaleString('en-US')+' LKR':'Price to be confirmed';
 function collectionCards(){return collections.map(c=>{
  const count=itemsFor(c.id).length;
  return '<a class="collection-card" href="'+url(c)+'" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'"><div class="collection-visual">'+(c.image?image(c.thumbnail,c.name+' featured tee'):missing())+'<span class="card-open" aria-hidden="true">'+arrow()+'</span></div><div class="collection-card-info"><h3>'+esc(c.name)+'</h3><span>'+(count?count+' '+(count===1?'design':'designs'):'Coming soon')+'</span></div></a>';
 }).join('');}
 function cards(list){return list.map(p=>'<button type="button" class="product-card" data-product-id="'+p.id+'" aria-label="Explore '+esc(p.name)+' tee in 3D"><div class="product-art">'+image(p.thumbnail,p.name+' oversized tee')+'<span class="product-3d-label" aria-hidden="true">Explore in 3D</span><span class="product-open" aria-hidden="true">+</span></div><div class="product-meta"><h2>'+esc(p.name)+'</h2><p class="product-price">'+price(p)+'</p><span>'+p.color+' · Oversized tee</span></div></button>').join('');}
 function featuredInfo(c,p){const list=itemsFor(c.id),n=list.length,i=Math.max(0,[...list.filter(x=>x.id===c.featured),...list.filter(x=>x.id!==c.featured)].findIndex(x=>x.id===p.id));return '<p class="feature-laundry">'+esc(c.name)+(n>1?'<span class="feature-count"> · '+(i+1)+' / '+n+'</span>':'')+'</p><h2>'+esc(p.name)+'</h2><p class="feature-spec">'+p.color+' / Oversized tee</p><a class="primary-link" href="'+url(c)+'">Explore Collection '+arrow()+'</a>';}
 // Hero strip: every tee, moving continuously. The list is rendered twice so the loop is seamless.
 let stopMarquee=()=>{};
 function heroMarquee(current){
  const seq=heroSequence();
  const item=(p,copy)=>'<button type="button" data-hero-product="'+p.id+'" aria-pressed="'+(!copy&&p.id===current.id)+'"'+(copy?' tabindex="-1" aria-hidden="true"':' aria-label="Show '+esc(p.name)+'"')+'>'+image(p.thumbnail,'')+'<span>'+esc(p.name)+'</span></button>';
  return '<div class="hero-collections hero-marquee" role="group" aria-label="Choose a tee"><div class="hero-marquee-track">'+seq.map(p=>item(p,false)).join('')+seq.map(p=>item(p,true)).join('')+'</div></div>';
 }
 function renderHome(scroll=false){
  const c=featured[active],p=(heroProductId&&getProduct(heroProductId)?.collection===c.id)?getProduct(heroProductId):getProduct(c.featured);
  main.innerHTML='<section class="hero" data-hero style="--hero-tint:'+c.tint+';--accent:'+c.accent+'"><div class="hero-intro" data-hero-copy><h1>Made to be worn.<br>Hard to ignore.</h1><p>Oversized tees.<br>Extraordinary characters.</p></div><div class="hero-studio" data-hero-item data-depth><div class="orbital-track" aria-hidden="true"></div><div class="floor-shadow" aria-hidden="true"></div><button class="hero-step previous" data-hero-step="-1" aria-label="Previous tee">'+arrow('left')+chevron('left')+'</button><button class="hero-product" data-product-id="'+p.id+'" aria-label="View '+esc(p.name)+' tee"><div class="hero-depth" data-depth-layer><div class="hero-float" data-float>'+garment(p,'hero-main-image',true)+'</div></div></button><button class="hero-step next" data-hero-step="1" aria-label="Next tee">'+arrow()+chevron('right')+'</button></div><div class="feature-info" aria-live="polite">'+featuredInfo(c,p)+'</div><div class="hero-controls"><div class="selection-label">Featured Collections<span>Choose your rotation</span></div>'+heroMarquee(p)+'</div></section>';
  if(scroll) requestAnimationFrame(()=>document.querySelector('#collections')?.scrollIntoView({behavior:'instant'}));
  stopMarquee=window.CosmicMarquee?.init(main.querySelector('.hero-marquee'))||(()=>{});
 }
 function stepHero(dir){
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
  main.querySelectorAll('[data-hero-select]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.heroSelect===active)));
  main.querySelectorAll('[data-hero-product]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.heroProduct===p.id&&!b.hasAttribute('aria-hidden'))));
  // Keep the new shopping action available immediately, independent of motion.
  main.querySelector('.feature-info').innerHTML=featuredInfo(c,p);
  target.dataset.productId=p.id;
  target.setAttribute('aria-label','View '+p.name+' tee');
  const update=()=>{
   if(current!==token||!target.isConnected)return;
   target.querySelector('.hero-float').innerHTML=garment(p,'hero-main-image',true);
   target.dataset.productId=p.id;target.setAttribute('aria-label','View '+p.name+' tee');
   main.querySelector('.hero').style.setProperty('--hero-tint',c.tint);
   main.querySelector('.hero').style.setProperty('--accent',c.accent);
  };
  if(window.CosmicMotion)await window.CosmicMotion.transition({out:target,in:target,update});else update();
 }
 function categoryInfo(c,p){return '<span class="featured-mark">Featured design</span><h2>'+esc(p.name)+'</h2><p>'+p.color+' / Oversized tee</p><button class="primary-link" type="button" data-product-id="'+p.id+'">Explore tee '+arrow()+'</button>';}
 function renderCollection(id){
  const c=collections.find(c=>c.id===id);if(!c){renderNotFound();return;}
  const list=itemsFor(id),p=getProduct(c.featured);document.title=c.name+' | Cosmic Laundry';
  main.innerHTML='<div class="laundry-page" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'"><a class="breadcrumb" href="#/all">'+arrow('left')+' All Laundries</a><section class="laundry-intro"><div class="laundry-copy"><p class="section-kicker">'+esc(c.tagline)+'</p><h1>'+esc(c.name)+'</h1><p>'+esc(c.description)+'</p>'+(p?'':'<a class="quiet-link" href="#/all">Explore available designs '+arrow()+'</a>')+'</div><div class="laundry-stage" data-depth><div class="theme-environment" aria-hidden="true"></div>'+(p?'<div class="floor-shadow" aria-hidden="true"></div><button class="category-garment" data-product-id="'+p.id+'" aria-label="View '+esc(p.name)+' tee"><div data-depth-layer><div data-float>'+garment(p,'',true)+'</div></div></button>':missing())+'</div>'+(p?'<div class="category-feature-info" aria-live="polite">'+categoryInfo(c,p)+'</div>':'')+'</section><section class="laundry-shop"><div class="shop-toolbar"><h2>'+ (p?'In this Laundry':'The next load is on its way')+'</h2><span>'+list.length+' '+(list.length===1?'design':'designs')+'</span></div>'+(list.length?'<div class="product-grid">'+cards(list)+'</div>':'<div class="empty-collection"><p>Bugs Bunny’s artwork has not been added yet.</p><a class="primary-link" href="#/collections">Explore the other Laundries '+arrow()+'</a></div>')+'</section></div>';
  startLaundryRotation(c,list);
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
  main.querySelectorAll('[data-category-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categorySelect===id)));
  main.querySelector('.category-feature-info').innerHTML=categoryInfo(c,p);
  target.dataset.productId=p.id;
  target.setAttribute('aria-label','View '+p.name+' tee');
  const update=()=>{if(current!==categoryToken||!target.isConnected)return;target.querySelector('[data-float]').innerHTML=garment(p,'',true);target.dataset.productId=id;target.setAttribute('aria-label','View '+p.name+' tee');};
  if(window.CosmicMotion)await window.CosmicMotion.transition({out:target,in:target,update});else update();
 }
 function renderAll(){main.innerHTML='<div class="route-page"><a class="breadcrumb" href="#/collections">'+arrow('left')+' All Laundries</a><h1 class="all-title">Your next rotation.</h1><label class="shop-search" for="product-search"><span>Search designs</span><input id="product-search" type="search" value="'+esc(searchTerm)+'" placeholder="Find a design or character" autocomplete="off"></label><div class="collection-filter-links" role="group" aria-label="Filter by Laundry"><button type="button" data-filter="all" aria-pressed="true">All tees</button>'+collections.map(c=>'<button type="button" data-filter="'+c.id+'" aria-pressed="false">'+esc(c.short)+'</button>').join('')+'</div><div class="shop-toolbar"><span id="product-count" role="status"></span><label class="sort-field" for="product-sort">Sort by <select id="product-sort"><option value="featured">Featured</option><option value="az">Name: A to Z</option><option value="za">Name: Z to A</option></select></label></div><section class="product-grid" id="all-products" aria-label="All graphic tees"></section></div>';document.querySelector('#product-sort').value=selectedSort;updateAllProducts();}
 function updateAllProducts(){const grid=document.querySelector('#all-products');if(!grid)return;const query=searchTerm.trim().toLowerCase();const list=products.filter(p=>(selectedFilter==='all'||p.collection===selectedFilter)&&(!query||(p.name+' '+collections.find(c=>c.id===p.collection).name).toLowerCase().includes(query)));if(selectedSort==='az')list.sort((a,b)=>a.name.localeCompare(b.name));if(selectedSort==='za')list.sort((a,b)=>b.name.localeCompare(a.name));document.querySelector('#product-count').textContent=list.length+' '+(list.length===1?'design':'designs');main.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===selectedFilter)));grid.innerHTML=list.length?cards(list):'<div class="empty-results"><h2>No designs found.</h2><p>Try another name or explore all tees.</p><button type="button" data-reset-filters>Reset filters</button></div>';}

 function renderNotFound(){main.innerHTML='<section class="route-page"><h1 class="all-title">A little off course.</h1><p>This Laundry could not be found.</p><a class="text-link" href="#/collections">Back to all Laundries</a></section>';}
 function route(){stopLaundryRotation();stopMarquee();stopMarquee=()=>{};token++;categoryToken++;window.CosmicMotion?.destroy();const path=location.hash.slice(1)||'/';document.title='Cosmic Laundry';const isHome=path==='/'||path==='/collections'||path==='main'||path==='/about';document.body.classList.toggle('is-home',isHome);if(isHome)renderHome(path==='/collections');else if(path.startsWith('/laundry/'))renderCollection(path.slice(9));else if(path==='/all')renderAll();else renderNotFound();if(path!=='/collections')window.scrollTo({top:0,behavior:'instant'});window.CosmicMotion?.init(document);main.focus({preventScroll:true});document.querySelectorAll('.site-header nav a').forEach(a=>{const match=a.hash===location.hash||(a.hash==='#/collections'&&path.startsWith('/laundry/'));if(match)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
 document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('a[href="#main"]')){e.preventDefault();main.focus();return;}
   if(t.closest('a.brand')&&(location.hash===''||location.hash==='#/')){e.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  const step=t.closest('[data-hero-step]');if(step){stepHero(Number(step.dataset.heroStep));return;}
  const select=t.closest('[data-hero-select]');if(select){selectHero(Number(select.dataset.heroSelect));return;}
   const pick=t.closest('[data-hero-product]');if(pick){const prod=getProduct(pick.dataset.heroProduct);if(prod)selectHero(featured.findIndex(c=>c.id===prod.collection),prod.id);return;}
  const cat=t.closest('[data-category-select]');if(cat){selectCategory(cat.dataset.categorySelect);return;}
  const filter=t.closest('[data-filter]');if(filter){selectedFilter=filter.dataset.filter;updateAllProducts();return;}
  if(t.closest('[data-reset-filters]')){selectedFilter='all';searchTerm='';document.querySelector('#product-search').value='';updateAllProducts();document.querySelector('#product-search').focus();return;}
  const info=t.closest('[data-info]');if(info){lastTrigger=info;const fit=info.dataset.info==='fit';document.querySelector('#info-title').textContent=fit?'Fit & sizing':'Ordering & delivery';document.querySelector('#info-content').innerHTML=fit?'<p>These designs are shown on oversized T-shirts. Save a size preference in your laundry basket.</p><p>Final garment measurements are being confirmed. When you send your laundry basket on WhatsApp, we’ll confirm your size with you.</p>':'<p>Add the tees you like to your laundry basket, then tap <strong>Get Your Laundry</strong> to send it to us on WhatsApp.</p><p>We’ll reply on WhatsApp to confirm price, availability, payment and delivery. No payment is taken on this website.</p>';document.querySelector('.info-dialog').showModal();}
  if(t.closest('.close-info'))document.querySelector('.info-dialog').close();
 });
 document.addEventListener('keydown',e=>{if(!e.target.closest('.hero-collections'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stepHero(e.key==='ArrowRight'?1:-1);requestAnimationFrame(()=>document.querySelector('[data-hero-product="'+heroProductId+'"]:not([aria-hidden])')?.focus({preventScroll:true}));}});
 document.addEventListener('input',e=>{if(e.target.id==='product-search'){searchTerm=e.target.value;updateAllProducts();}});
 document.addEventListener('change',e=>{if(e.target.id==='product-sort'){selectedSort=e.target.value;updateAllProducts();}});
 const infoDialog=document.querySelector('.info-dialog');infoDialog.addEventListener('close',()=>lastTrigger?.focus());infoDialog.addEventListener('click',e=>{if(e.target!==infoDialog)return;const b=infoDialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)infoDialog.close();});
 // Keep accessible text and space stable if a product image cannot be loaded.
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('main')){e.target.classList.add('image-unavailable');e.target.alt=e.target.alt||'Product image unavailable';}},true);
 window.CosmicCommerce.init({products,collections,onCollectionChange:id=>{location.hash='/laundry/'+id;}});
 window.addEventListener('hashchange',route);route();
})();
