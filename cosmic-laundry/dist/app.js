(() => {
 'use strict';
 const {collections,products}=window.CosmicCatalog;
 const main=document.querySelector('#main');
 const featured=collections.filter(c=>c.featured);
 let active=0, token=0, categoryToken=0, lastTrigger=null;
 let selectedFilter='all',searchTerm='',selectedSort='featured';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getProduct=id=>products.find(p=>p.id===id);
 const itemsFor=id=>products.filter(p=>p.collection===id);
 const url=c=>'#/laundry/'+c.id;
 const arrow=(direction='right')=>'<svg class="arrow-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(direction==='left'?'M19 12H5m6-6-6 6 6 6':direction==='down'?'M12 5v14m-6-6 6 6 6-6':'M5 12h14m-6-6 6 6-6 6')+'"/></svg>';
 const image=(source,alt,cls='',eager=false,small=false)=>'<img class="'+cls+'" src="'+source+'" alt="'+esc(alt)+'" width="1122" height="1402" loading="'+(eager?'eager':'lazy')+'" decoding="async"'+(eager?' fetchpriority="high"':'')+(source.includes('-480.webp')&&source.includes('/products/')?' srcset="'+source+' 480w, '+source.replace('-480.webp','.webp')+' 1122w" sizes="'+(alt?'(max-width:650px) 46vw, 30vw':'70px')+'"':'')+'>';
 const garment=(p,cls='',eager=false)=>image(p.image,p.name+' oversized T-shirt',cls,eager);
 const missing=()=>'<div class="missing-art"><span class="missing-orbit" aria-hidden="true"></span><p>Next in the wash.</p><span>Artwork coming soon</span></div>';
 const price=p=>typeof p.price==='number'?new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR',maximumFractionDigits:0}).format(p.price):'Price to be confirmed';
 function collectionCards(){return collections.map(c=>{
  const count=itemsFor(c.id).length;
  return '<a class="collection-card" href="'+url(c)+'" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'"><div class="collection-visual">'+(c.image?image(c.thumbnail,c.name+' featured tee'):missing())+'<span class="card-open" aria-hidden="true">'+arrow()+'</span></div><div class="collection-card-info"><h3>'+esc(c.name)+'</h3><span>'+(count?count+' '+(count===1?'design':'designs'):'Coming soon')+'</span></div></a>';
 }).join('');}
 function cards(list){return list.map(p=>'<button type="button" class="product-card" data-product-id="'+p.id+'" aria-label="Explore '+esc(p.name)+' tee in 3D"><div class="product-art">'+image(p.thumbnail,p.name+' oversized tee')+'<span class="product-3d-label" aria-hidden="true">Explore in 3D</span><span class="product-open" aria-hidden="true">+</span></div><div class="product-meta"><h2>'+esc(p.name)+'</h2><span>'+p.color+' · Oversized tee</span><p>'+price(p)+'</p></div></button>').join('');}
 function featuredInfo(c,p){return '<p class="feature-laundry">'+esc(c.name)+'</p><h2>'+esc(p.name)+'</h2><p class="feature-spec">'+p.color+' / Oversized tee</p><p class="feature-price">'+price(p)+'</p><button type="button" class="primary-link" data-product-id="'+p.id+'">Explore tee '+arrow()+'</button><a class="text-link" href="'+url(c)+'">Browse this Laundry</a>';}
 function renderHome(scroll=false){
  const c=featured[active],p=getProduct(c.featured);
  main.innerHTML='<section class="hero" data-hero style="--hero-tint:'+c.tint+';--accent:'+c.accent+'"><div class="hero-intro" data-hero-copy><p class="studio-label"><span aria-hidden="true"></span>The garment studio</p><h1>Not your<br>ordinary wash.</h1><p>Oversized tees.<br>Extraordinary characters.</p><a class="quiet-link" href="#/collections">Explore 7 Laundries '+arrow('down')+'</a></div><div class="hero-studio" data-hero-item data-depth><div class="orbital-track" aria-hidden="true"></div><div class="floor-shadow" aria-hidden="true"></div><button class="hero-step previous" data-hero-step="-1" aria-label="Previous featured tee">'+arrow('left')+'</button><button class="hero-product" data-product-id="'+p.id+'" aria-label="View '+esc(p.name)+' tee"><div class="hero-depth" data-depth-layer><div class="hero-float" data-float>'+garment(p,'hero-main-image',true)+'</div></div><span class="inspect-hint">Drag to rotate. Click to inspect. <span aria-hidden="true">+</span></span></button><button class="hero-step next" data-hero-step="1" aria-label="Next featured tee">'+arrow()+'</button></div><div class="feature-info" aria-live="polite">'+featuredInfo(c,p)+'</div><div class="hero-controls"><div class="selection-label">Featured designs<span>Choose your rotation</span></div><div class="hero-collections" aria-label="Choose featured Laundry">'+featured.map((c,i)=>'<button type="button" data-hero-select="'+i+'" aria-pressed="'+(i===active)+'">'+image(c.thumbnail,'')+'<span>'+esc(c.short)+'</span></button>').join('')+'</div></div></section><section class="collection-section" id="collections"><div class="section-heading"><div><p class="section-kicker">Find your world</p><h2>Seven Laundries.<br>One different kind of wardrobe.</h2></div><a class="quiet-link" href="#/all">View all tees '+arrow()+'</a></div><div class="collections-grid">'+collectionCards()+'</div></section><section class="editorial" data-scroll-section><div class="editorial-visual" data-depth><div class="editorial-scroll" data-scroll-art><div data-depth-layer>'+image('assets/products/a-bum.webp','A BUM oversized tee')+'</div></div></div><div class="editorial-copy"><p class="section-kicker">Introducing Bad Influence Laundry</p><h2>Good tee.<br>Questionable influence.</h2><p>A BUM. Will flex for protein.<br>The newest arrival in your rotation.</p><a class="primary-link" href="#/laundry/bad-influence">Enter Bad Influence '+arrow()+'</a></div></section>';
  if(scroll) requestAnimationFrame(()=>document.querySelector('#collections')?.scrollIntoView({behavior:'instant'}));
 }
 async function selectHero(index){
  active=(index+featured.length)%featured.length;
  const c=featured[active],p=getProduct(c.featured),target=main.querySelector('.hero-product');
  if(!target)return;
  const current=++token;
  main.querySelectorAll('[data-hero-select]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.heroSelect===active)));
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
  main.innerHTML='<div class="laundry-page" data-theme="'+c.theme+'" style="--card-tint:'+c.tint+';--accent:'+c.accent+'"><a class="breadcrumb" href="#/collections">'+arrow('left')+' All Laundries</a><section class="laundry-intro"><div class="laundry-copy"><p class="section-kicker">'+esc(c.tagline)+'</p><h1>'+esc(c.name)+'</h1><p>'+esc(c.description)+'</p>'+(p?'<div class="category-thumbnails" aria-label="Select a '+esc(c.short)+' design">'+list.map(p=>'<button type="button" data-category-select="'+p.id+'" aria-label="Show '+esc(p.name)+'" aria-pressed="'+(p.id===c.featured)+'">'+image(p.thumbnail,'')+'<span>'+esc(p.name)+'</span></button>').join('')+'</div>':'<a class="quiet-link" href="#/all">Explore available designs '+arrow()+'</a>')+'</div><div class="laundry-stage" data-depth><div class="theme-environment" aria-hidden="true"></div>'+(p?'<div class="floor-shadow" aria-hidden="true"></div><button class="category-garment" data-product-id="'+p.id+'" aria-label="View '+esc(p.name)+' tee"><div data-depth-layer><div data-float>'+garment(p,'',true)+'</div></div></button>':missing())+'</div>'+(p?'<div class="category-feature-info" aria-live="polite">'+categoryInfo(c,p)+'</div>':'')+'</section><section class="laundry-shop"><div class="shop-toolbar"><h2>'+ (p?'In this Laundry':'The next load is on its way')+'</h2><span>'+list.length+' '+(list.length===1?'design':'designs')+'</span></div>'+(list.length?'<div class="product-grid">'+cards(list)+'</div>':'<div class="empty-collection"><p>Bugs Bunny’s artwork has not been added yet.</p><a class="primary-link" href="#/collections">Explore the other Laundries '+arrow()+'</a></div>')+'</section><nav class="other-laundries" aria-label="Explore other Laundries"><h2>Another world awaits.</h2><div>'+collections.filter(x=>x.id!==c.id).map(x=>'<a href="'+url(x)+'">'+esc(x.short)+' '+arrow()+'</a>').join('')+'</div></nav></div>';
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
 function renderAbout(){main.innerHTML='<section class="about-page"><div><p class="section-kicker">Cosmic Laundry</p><h1>A different<br>kind of rotation.</h1><p>Oversized tees. Art with attitude. Characters with a world of their own.</p><p>Seven Laundries, each with its own personality. Find the one that feels like you.</p><a class="primary-link" href="#/collections">Explore the Laundries '+arrow()+'</a></div><div class="about-art" data-depth><div data-depth-layer>'+image('assets/products/back-white.webp','Supplied white tee with Cosmic Laundry back logo')+'</div></div></section>';}
 function renderNotFound(){main.innerHTML='<section class="route-page"><h1 class="all-title">A little off course.</h1><p>This Laundry could not be found.</p><a class="text-link" href="#/collections">Back to all Laundries</a></section>';}
 function route(){token++;categoryToken++;window.CosmicMotion?.destroy();const path=location.hash.slice(1)||'/';document.title='Cosmic Laundry | The garment studio';if(path==='/'||path==='/collections'||path==='main')renderHome(path==='/collections');else if(path.startsWith('/laundry/'))renderCollection(path.slice(9));else if(path==='/all')renderAll();else if(path==='/about')renderAbout();else renderNotFound();if(path!=='/collections')window.scrollTo({top:0,behavior:'instant'});window.CosmicMotion?.init(document);main.focus({preventScroll:true});document.querySelectorAll('.site-header nav a').forEach(a=>{const match=a.hash===location.hash||(a.hash==='#/collections'&&path.startsWith('/laundry/'));if(match)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
 document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('a[href="#main"]')){e.preventDefault();main.focus();return;}
   if(t.closest('a.brand')&&(location.hash===''||location.hash==='#/')){e.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  const step=t.closest('[data-hero-step]');if(step){selectHero(active+Number(step.dataset.heroStep));return;}
  const select=t.closest('[data-hero-select]');if(select){selectHero(Number(select.dataset.heroSelect));return;}
  const cat=t.closest('[data-category-select]');if(cat){selectCategory(cat.dataset.categorySelect);return;}
  const filter=t.closest('[data-filter]');if(filter){selectedFilter=filter.dataset.filter;updateAllProducts();return;}
  if(t.closest('[data-reset-filters]')){selectedFilter='all';searchTerm='';document.querySelector('#product-search').value='';updateAllProducts();document.querySelector('#product-search').focus();return;}
  const info=t.closest('[data-info]');if(info){lastTrigger=info;const fit=info.dataset.info==='fit';document.querySelector('#info-title').textContent=fit?'Fit & sizing':'Ordering & delivery';document.querySelector('#info-content').innerHTML=fit?'<p>These designs are shown on oversized T-shirts. Save a size preference in your preview bag.</p><p>Final garment measurements and size availability are not yet confirmed. The verified size guide will be available before ordering opens.</p>':'<p>This is the Cosmic Laundry store preview. You can inspect designs and save a selection to your preview bag.</p><p>Prices, stock, payment, delivery and returns information are awaiting confirmation. No orders or payments are taken here.</p>';document.querySelector('.info-dialog').showModal();}
  if(t.closest('.close-info'))document.querySelector('.info-dialog').close();
 });
 document.addEventListener('keydown',e=>{if(!e.target.closest('.hero-collections'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectHero(active+(e.key==='ArrowRight'?1:-1));const b=document.querySelector('[data-hero-select="'+active+'"]');b.focus({preventScroll:true});b.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}});
 document.addEventListener('input',e=>{if(e.target.id==='product-search'){searchTerm=e.target.value;updateAllProducts();}});
 document.addEventListener('change',e=>{if(e.target.id==='product-sort'){selectedSort=e.target.value;updateAllProducts();}});
 const infoDialog=document.querySelector('.info-dialog');infoDialog.addEventListener('close',()=>lastTrigger?.focus());infoDialog.addEventListener('click',e=>{if(e.target!==infoDialog)return;const b=infoDialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)infoDialog.close();});
 // Keep accessible text and space stable if a product image cannot be loaded.
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('main')){e.target.classList.add('image-unavailable');e.target.alt=e.target.alt||'Product image unavailable';}},true);
 window.CosmicCommerce.init({products,collections,onCollectionChange:id=>{location.hash='/laundry/'+id;}});
 window.addEventListener('hashchange',route);route();
})();
