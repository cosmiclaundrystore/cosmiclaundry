import type { CatalogData } from './types';

// Builds /catalog.js: the same script public/catalog.js used to be, with the data now coming from Supabase.
// The part after the data (image paths, colours, featured images) is copied verbatim from the original file.
const POST_PROCESSING = String.raw`
const IMG_VERSION='final16-2';
window.CosmicCatalog.products.forEach(p=>{
  // IMG_VERSION forces browsers to fetch fresh copies after the images change (bump it when you replace them).
  // Photos uploaded in the admin live in Supabase Storage (p.imageBase, a new folder per upload); the rest ship with the site.
  const img=(c,small)=>p.imageBase?p.imageBase+'-'+c+(small?'-480':'')+'.webp':'/assets/products/'+p.id+'-'+c+(small?'-480':'')+'.webp?v='+IMG_VERSION;
  const colors=[
    {id:'black',label:'Black',image:img('black'),thumbnail:img('black',true),backImage:'/assets/products/back-black.webp?v='+IMG_VERSION},
    {id:'white',label:'White',image:img('white'),thumbnail:img('white',true),backImage:'/assets/products/back-white.webp?v='+IMG_VERSION}
  ];
  // The custom tee has its own generated white mockups; keep uploaded admin photos authoritative.
  if(p.id==='custom-tee'&&!p.imageBase){
    colors[1].image='/assets/products/custom-tee-white-generated.webp';
    colors[1].thumbnail='/assets/products/custom-tee-white-generated-480.webp';
    colors[1].backImage='/assets/products/custom-tee-white-back-generated.webp';
  }
  const first=colors.find(c=>c.id===p.defaultColor)||colors[0];
  p.colors=[first,...colors.filter(c=>c!==first)];
  p.color='Black or White';
  p.image=first.image; p.thumbnail=first.thumbnail; p.detailImage=p.image; p.backImage=first.backImage;
  p.price=typeof p.price==='number'?p.price:null; p.stock=null;
});
// Prices are in the visitor's region currency (commerce.currency): 3,500 LKR, £20, $25.
window.CosmicCatalog.formatPrice=amount=>{
  const currency=window.CosmicCatalog.commerce?.currency||'LKR';
  if(currency==='LKR')return Math.round(amount).toLocaleString('en-US')+' LKR';
  const whole=Math.round(amount*100)%100===0;
  return new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency,minimumFractionDigits:whole?0:2,maximumFractionDigits:2}).format(amount);
};
window.CosmicCatalog.collections.forEach(c=>{
  const p=window.CosmicCatalog.products.find(p=>p.id===c.featured);
  c.image=p?.image||null; c.thumbnail=p?.thumbnail||null;
});
`;

// JSON is valid JavaScript; escaping "<" keeps text like "</script>" in product copy harmless.
function toScriptJson(value: unknown): string {
  return JSON.stringify(value, null, 1).replace(/</g, '\\u003c');
}

export function renderCatalogScript(catalog: CatalogData): string {
  return `/* Cosmic Laundry catalog, generated from Supabase. Edit products in the database, not here. */
window.CosmicCatalog = ${toScriptJson(catalog)};
${POST_PROCESSING}`;
}
