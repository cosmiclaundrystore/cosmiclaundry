/* Source: the latest product mockups. No sales or stock data is available.
   Featured IDs are curated/configurable; all prices stay null until verified. */
window.CosmicCatalog = {
  collections: [
    {id:'mona-lisa',name:'Mona Lisa’s Laundry',short:'Mona Lisa',tagline:'Classic art. Different attitude.',description:'Tren Lisa, Mona Lifta and Mona Splita. Three familiar faces with a little extra attitude.',featured:'tren-lisa',tint:'#132b47',accent:'#d1c5ad',theme:'mona'},
    {id:'family-guy',name:'Family Guy’s Laundry',short:'Family Guy',tagline:'Straight out of Quahog.',description:'A little deadpan. A lot of character. Meet the Megatron Griffin tee.',featured:'megatron',tint:'#132e4c',accent:'#adcfff',theme:'family'},
    {id:'rick-and-morty',name:'Rick and Morty’s Laundry',short:'Rick & Morty',tagline:'A different dimension.',description:'Get Schwifty. A familiar duo, a portal, and a very different state of mind.',featured:'rick-and-morty',tint:'#102d40',accent:'#a4d5c3',theme:'rick'},
    {id:'spongebob',name:'SpongeBob’s Laundry',short:'SpongeBob',tagline:'Below the surface.',description:'Bikini Bottom Fitness is open. Meet the BOBLIFTSCRAZY tee.',featured:'spongebob',tint:'#12334b',accent:'#a2d9eb',theme:'sponge'},

    {id:'popeye',name:'Popeye’s Laundry',short:'Popeye',tagline:'Every day is arm day.',description:'A sailor with a strong point of view. Classic Popeye, in your rotation.',featured:'popeye',tint:'#102a48',accent:'#b8ccec',theme:'popeye'},
    {id:'bad-influence',name:'Bad Influence Laundry',short:'Bad Influence',tagline:'A little less well behaved.',description:'Big graphics. A sense of humor. A BUM leads this new Laundry.',featured:'a-bum',tint:'#202c49',accent:'#c8c0e7',theme:'bad'}
  ],
  products: [
    {id:'tren-lisa',name:'Tren Lisa',collection:'mona-lisa',asset:'tren-lisa',color:'Black',description:'The Tren Lisa artwork on a black oversized tee.'},
    {id:'mona-lifta',name:'Mona Lifta',collection:'mona-lisa',asset:'mona-lifta',color:'Black',description:'Mona Lisa, with a little extra strength. The Mona Lifta design on black.'},
    {id:'mona-splita',name:'Mona Splita',collection:'mona-lisa',asset:'mona-splita',color:'Black',description:'The Mona Splita design on a black oversized tee.'},
    {id:'megatron',name:'Megatron Griffin',collection:'family-guy',asset:'megatron',color:'White',description:'Megatron Griffin artwork on a white oversized tee.'},
    {id:'rick-and-morty',name:'Get Schwifty',collection:'rick-and-morty',asset:'rick-morty',color:'Black',description:'Rick and Morty surrounded by the colorful portal print on black.'},
    {id:'spongebob',name:'BOBLIFTSCRAZY',collection:'spongebob',asset:'spongebob',color:'White',description:'The Bikini Bottom Fitness artwork on a white oversized tee.'},
    {id:'popeye',name:'Everyday’s Arm Day',collection:'popeye',asset:'popeye',color:'White',description:'The Popeye arm-day artwork on a white oversized tee.'},
    {id:'a-bum',name:'A BUM',collection:'bad-influence',asset:'a-bum',color:'White',description:'Will flex for protein. The A BUM design on a white oversized tee.'}
  ],
  commerce: {mode:'preview',currency:'LKR',checkoutUrl:null},
  featuredLabel:'Featured designs'
};
window.CosmicCatalog.products.forEach(p=>{
  p.image='assets/products/'+p.asset+'.webp'; p.thumbnail='assets/products/'+p.asset+'-480.webp';
  p.detailImage=p.image; p.price=null; p.stock=null;
  p.colors=[{id:'pictured',label:p.color}];
  p.backImage='assets/products/back-'+p.color.toLowerCase()+'.webp';
});
window.CosmicCatalog.collections.forEach(c=>{
  const p=window.CosmicCatalog.products.find(p=>p.id===c.featured);
  c.image=p?.image||null; c.thumbnail=p?.thumbnail||null;
});
