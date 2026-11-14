export const laundries = [
 {id:'mona-lisa',name:'Mona Lisa’s Laundry',short:'Mona Lisa',theme:'mona',code:'01',note:'VINTAGE STUDIES',description:'Classic art. Different attitude.',cover:'mona-animated.webp',alt:'An illustrated Mona Lisa in her vintage frame',hasChildren:true},
 {id:'family-guy',name:'Family Guy Laundry',short:'Family Guy',theme:'family',code:'02',note:'QUAHOG DAYS',description:'A little suburban chaos.',cover:'family-animated.webp',alt:'Peter, Lois, Chris, Meg, Stewie and Brian Griffin',cutout:true},
 {id:'rick-and-morty',name:'Rick and Morty Laundry',short:'Rick & Morty',theme:'rick',code:'03',note:'OFF-WORLD',description:'A different dimension.',cover:'rick-animated.webp',alt:'Rick and Morty reacting with their hands in the air',cutout:true},
 {id:'spongebob',name:'SpongeBob Laundry',short:'SpongeBob',theme:'sponge',code:'04',note:'BIKINI BOTTOM',description:'Below the surface.',cover:'sponge-animated.webp',alt:'SpongeBob and Patrick in Bikini Bottom'},
 {id:'gym',name:'Gym Laundry',short:'Gym',theme:'gym',code:'05',note:'HEAVY ROTATION',description:'Made for your rotation.',cover:'gym-animated.webp',alt:'An animated planet lifting dumbbells'},
 {id:'sri-lankan',name:'Sri Lankan Laundry',short:'Sri Lankan',theme:'island',code:'06',note:'ISLAND ROOTS',description:'A little closer to home.',cover:'island-animated.webp',alt:'An illustrated Sri Lankan tuk-tuk and driver by the coast'}
];
// These are provisional sub-laundry labels, not confirmed product names.
export const monaLaundries = [1,2,3].map(n=>({id:`laundry-0${n}`,name:`Laundry 0${n}`,note:'NAME TO BE CONFIRMED',study:n}));
export function resolveRoute(hash) {
 const parts=String(hash||'').replace(/^#\/?/,'').split('/').filter(Boolean);
 if (!parts.length || parts[0]==='home' || parts[0]==='shop') return {kind:'home'};
 if(parts[0]==='prelaunch') return {kind:'prelaunch'};
 if(parts[0]!=='laundry') return {kind:'home'};
 const laundry=laundries.find(l=>l.id===parts[1]);
 if(!laundry)return {kind:'home'};
 if(laundry.hasChildren){
  const child=monaLaundries.find(c=>c.id===parts[2]);
  return child?{kind:'products',laundry,child}:{kind:'children',laundry};
 }
 return {kind:'products',laundry};
}
export function getProducts(laundry,child) {
 return [1,2,3,4].map(n=>({id:`${laundry.id}/${child?.id||'preview'}/${n}`,number:n,name:`Placeholder 0${n}`,image:`/assets/study-0${n}.svg`,laundry:laundry.name,child:child?.name||'',theme:laundry.theme}));
}
export const products=laundries.flatMap(l=>l.hasChildren?monaLaundries.flatMap(c=>getProducts(l,c)):getProducts(l));
export function productById(id){return products.find(p=>p.id===id);}
