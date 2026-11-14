/* Cosmic Laundry catalog — 16 designs from the final16-2 artwork, each in Black and White.
   COLLECTIONS: `featured` is the tee shown first for that Laundry (hero picker, cards, Laundry page).
   PRODUCTS: `defaultColor` is the colour shown first ('black' or 'white').
   PRICES: each product's `price` is in LKR — edit the number on that product's line.
           Remove it (or set null) to show "Price to be confirmed".
   IMAGES: assets/products/<id>-black.webp, <id>-white.webp (+ -480 thumbnails), made from final16-2/. */
window.CosmicCatalog = {
  collections: [
    {id:'mona-lisa',name:'Mona Lisa’s Laundry',short:'Mona Lisa',tagline:'Classic art. Different attitude.',description:'Tren Lisa, Mona Lifta and Mona Splita. Three familiar faces with a little extra attitude.',featured:'tren-lisa',tint:'#132b47',accent:'#d1c5ad',theme:'mona'},
    {id:'family-guy',name:'Family Guy’s Laundry',short:'Family Guy',tagline:'Straight out of Quahog.',description:'A little deadpan. A lot of character. Megatron Griffin and a Stewie who doesn’t need it to make sense.',featured:'megatron',tint:'#132e4c',accent:'#adcfff',theme:'family'},
    {id:'rick-and-morty',name:'Rick and Morty’s Laundry',short:'Rick & Morty',tagline:'A different dimension.',description:'Get Schwifty. A familiar duo, a portal, and a very different state of mind.',featured:'rick-and-morty',tint:'#102d40',accent:'#a4d5c3',theme:'rick'},
    {id:'spongebob',name:'SpongeBob’s Laundry',short:'SpongeBob',tagline:'Below the surface.',description:'Bikini Bottom, but make it a lifestyle. SpongeBob, Plankton, Larry, Mr. Krabs and a goofy goober or two.',featured:'spongebob',tint:'#12334b',accent:'#a2d9eb',theme:'sponge'},
    {id:'popeye',name:'Popeye’s Laundry',short:'Popeye',tagline:'Every day is arm day.',description:'A sailor with a strong point of view. Classic Popeye, in your rotation.',featured:'popeye',tint:'#102a48',accent:'#b8ccec',theme:'popeye'},
    {id:'bad-influence',name:'Bad Influence Laundry',short:'Bad Influence',tagline:'A little less well behaved.',description:'Big graphics. A sense of humor. A BUM leads this Laundry.',featured:'a-bum',tint:'#202c49',accent:'#c8c0e7',theme:'bad'},
    {id:'jujutsu-kaisen',name:'Jujutsu Kaisen Laundry',short:'Jujutsu Kaisen',tagline:'Throughout heaven and earth.',description:'Gojo, Sukuna and Toji. Three of the strongest, with the confidence to match.',featured:'nah-id-win',tint:'#1d2147',accent:'#c5b6f2',theme:'jjk'}
  ],
  products: [
    // Mona Lisa
    {id:'tren-lisa',name:'Tren Lisa',collection:'mona-lisa',defaultColor:'black',description:'The Tren Lisa artwork on an oversized tee.',price:3500},
    {id:'mona-lifta',name:'Mona Lifta',collection:'mona-lisa',defaultColor:'black',description:'Mona Lisa, with a little extra strength. The Mona Lifta design on an oversized tee.',price:3500},
    {id:'mona-splita',name:'Mona Splita',collection:'mona-lisa',defaultColor:'black',description:'The Mona Splita design on an oversized tee.',price:3500},
    // Family Guy
    {id:'megatron',name:'Megatron Griffin',collection:'family-guy',defaultColor:'white',description:'Megatron Griffin artwork on an oversized tee.',price:3500},
    {id:'stewie',name:'It Doesn’t Have to Make Sense',collection:'family-guy',defaultColor:'black',description:'Stewie, flexing. It doesn’t have to make sense when you look like this.',price:3500},
    // Rick and Morty
    {id:'rick-and-morty',name:'Get Schwifty',collection:'rick-and-morty',defaultColor:'black',description:'Rick and Morty surrounded by the colorful portal print.',price:3500},
    // SpongeBob
    {id:'spongebob',name:'BOBLIFTSCRAZY',collection:'spongebob',defaultColor:'white',description:'The Bikini Bottom Fitness artwork on an oversized tee.',price:3500},
    {id:'i-went-to-college',name:'I Went to College',collection:'spongebob',defaultColor:'black',description:'Plankton, graduate. A tee for anyone who did the reading.',price:3500},
    {id:'livin-like-larry',name:'Livin’ Like Larry',collection:'spongebob',defaultColor:'black',description:'Larry the Lobster, sun, surf and very big arms.',price:3500},
    {id:'i-like-money',name:'I Like Money',collection:'spongebob',defaultColor:'white',description:'Mr. Krabs says it best. I like money.',price:3500},
    {id:'goofy-goober',name:'I’m a Goofy Goober',collection:'spongebob',defaultColor:'black',description:'SpongeBob on guitar, full Goofy Goober rock mode.',price:3500},
    // Popeye
    {id:'popeye',name:'Everyday’s Arm Day',collection:'popeye',defaultColor:'white',description:'The Popeye arm-day artwork on an oversized tee.',price:3500},
    // Bad Influence
    {id:'a-bum',name:'A BUM',collection:'bad-influence',defaultColor:'white',description:'Will flex for protein. The A BUM design on an oversized tee.',price:3500},
    // Jujutsu Kaisen
    {id:'nah-id-win',name:'Nah, I’d Win',collection:'jujutsu-kaisen',defaultColor:'black',description:'Gojo Satoru, unbothered. Nah, I’d win.',price:3500},
    {id:'know-your-place',name:'Know Your Place',collection:'jujutsu-kaisen',defaultColor:'black',description:'Sukuna on his throne. Know your place, you fool.',price:3500},
    {id:'dont-work-for-free',name:'I Don’t Work for Free',collection:'jujutsu-kaisen',defaultColor:'black',description:'Toji Fushiguro. I don’t work for free.',price:3500}
  ],
  commerce: {mode:'preview',currency:'LKR',checkoutUrl:null},
  featuredLabel:'Featured Collections'
};
const IMG_VERSION='final16-2';
window.CosmicCatalog.products.forEach(p=>{
  // IMG_VERSION forces browsers to fetch fresh copies after the images change (bump it when you replace them).
  const img=(c,small)=>'assets/products/'+p.id+'-'+c+(small?'-480':'')+'.webp?v='+IMG_VERSION;
  const colors=[
    {id:'black',label:'Black',image:img('black'),thumbnail:img('black',true),backImage:'assets/products/back-black.webp?v='+IMG_VERSION},
    {id:'white',label:'White',image:img('white'),thumbnail:img('white',true),backImage:'assets/products/back-white.webp?v='+IMG_VERSION}
  ];
  const first=colors.find(c=>c.id===p.defaultColor)||colors[0];
  p.colors=[first,...colors.filter(c=>c!==first)];
  p.color='Black or White';
  p.image=first.image; p.thumbnail=first.thumbnail; p.detailImage=p.image; p.backImage=first.backImage;
  p.price=typeof p.price==='number'?p.price:null; p.stock=null;
});
window.CosmicCatalog.collections.forEach(c=>{
  const p=window.CosmicCatalog.products.find(p=>p.id===c.featured);
  c.image=p?.image||null; c.thumbnail=p?.thumbnail||null;
});
