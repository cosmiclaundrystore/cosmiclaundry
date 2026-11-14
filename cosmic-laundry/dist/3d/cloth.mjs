import {ShapeUtils,Vector2} from '../vendor/three.module.js';
/* Original oversized garment mesh. Coordinates are in garment space:
   x = width, y = height, +z = the front. No imagery is used for the pile. */
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export function createGarmentData(detail=1){
 const contour=[[-.88,-1.22],[.88,-1.22],[.88,.39],[1.57,.29],[1.57,.78],[.88,1.1],[.31,1.1]];
 for(let i=1;i<=12;i++){const t=i/12*Math.PI;contour.push([.31*Math.cos(t),1.1-.255*Math.sin(t)]);}
 const neckEnd=contour.length-1;
 contour.push([-.88,1.1],[-1.57,.78],[-1.57,.29],[-.88,.39]);
 const n=contour.length,points=[],uv=[],faces=[];
 for(const side of [1,-1])for(let i=0;i<n;i++){
  const [x,fy]=contour[i];const y=side<0&&i>=6&&i<=neckEnd?1.1-(1.1-fy)*.45:fy;
  points.push([x,y,side*.05]);uv.push([.5+x/3.14,(y+1.22)/2.32]);
 }
 const tris=ShapeUtils.triangulateShape(contour.map(p=>new Vector2(...p)),[]);
 for(const t of tris){
  const [a,b,c]=t;const pa=contour[a],pb=contour[b],pc=contour[c];
  const forward=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])>0;
  const f=forward?[a,b,c]:[a,c,b];faces.push(f,[f[0]+n,f[2]+n,f[1]+n]);
 }
 // Sew the panels into one continuous garment, leaving neckline, cuffs and hem open.
 for(let i=0;i<n;i++){
  const j=(i+1)%n;
  if(i===0||i===3||i===neckEnd+2||(i>=6&&i<neckEnd))continue;
  faces.push([i,i+n,j],[j,i+n,j+n]);
 }
 // The neck band shares its inner edge with the shirt, so it stays attached during simulation.
 const loop=[];for(let i=6;i<=neckEnd;i++)loop.push(i);for(let i=neckEnd;i>=6;i--)loop.push(i+n);
 const outer=[];
 for(const i of loop){const [x,y,z]=points[i],t=Math.acos(Math.max(-1,Math.min(1,x/.31)));outer.push(points.length);points.push([x+.028*Math.cos(t),y-.028*Math.sin(t),z+Math.sign(z)*.013]);uv.push(uv[i].slice());}
 for(let i=0;i<loop.length;i++){const j=(i+1)%loop.length;faces.push([loop[i],outer[i],loop[j]],[loop[j],outer[i],outer[j]]);}
 const levels=detail>=.9?4:detail>=.5?3:detail>=.2?2:1;
 for(let level=0;level<levels;level++){
  const cache=new Map(),next=[];
  const mid=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(cache.has(key))return cache.get(key);const i=points.length;points.push(points[a].map((v,j)=>(v+points[b][j])*.5));uv.push(uv[a].map((v,j)=>(v+uv[b][j])*.5));cache.set(key,i);return i;};
  for(const [a,b,c]of faces){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);}faces.splice(0,faces.length,...next);
 }
 for(const p of points){const [x,y,z]=p;if(Math.abs(z)>.044&&Math.abs(x)<.87){const height=Math.max(0,Math.min(1,(y+1.22)/2.32));p[2]+=Math.sign(z)*.07*(1-(x/.9)**2)*Math.sin(height*Math.PI);}}
 return {positions:new Float32Array(points.flat()),uv:new Float32Array(uv.flat()),indices:new Uint32Array(faces.flat())};
}
export function deformPoint(x,y,z,fold,seed=0,ripple=0,time=0,out=null,offset=0){
 const originalX=x,originalY=y;
 y+=.018*Math.sin(x*6.3+.7)*clamp((-y-.8)/.42);
 // Two sleeve hinges fold in toward the chest while the lower body folds up.
 if(Math.abs(x)>.73){
  const sign=Math.sign(x),distance=Math.abs(x)-.73,curvature=fold*2.4/.84;
  if(curvature>.0001){x=sign*(.73+Math.sin(curvature*distance)/curvature);z+=(1-Math.cos(curvature*distance))/curvature;}
  y-=fold*.045*Math.sin(distance*4);
 }
 if(y<-.12){
  const distance=-.12-y,curvature=fold*2.52/1.1;
  if(curvature>.0001){y=-.12-Math.sin(curvature*distance)/curvature;z+=(1-Math.cos(curvature*distance))/curvature;}
 }
 const phase=seed*1.173;
 // Broad drape plus smaller fabric wrinkles; folded garments stay a single connected mesh.
 const edge=Math.max(0,1-Math.abs(originalX)/1.7);
 z+=edge*(.022*Math.sin(originalX*13+originalY*9+phase)+.014*Math.sin(originalY*21-originalX*5+phase));
 z+=fold*(.09*Math.sin(originalX*4+originalY*5+phase)+.038*Math.sin(originalX*12-originalY*10+phase));
 x+=fold*.055*Math.sin(originalY*7+phase);y+=fold*.042*Math.sin(originalX*8-originalY*4+phase);
 z+=ripple*.04*Math.sin(originalY*6-time*4)*clamp((1.1-originalY)/2.3);
 if(out){out[offset]=x;out[offset+1]=y;out[offset+2]=z;return out;}
 return [x,y,z];
}
export function deformGarment(base,out,fold,seed=0,ripple=0,time=0){
 for(let i=0;i<base.length;i+=3){deformPoint(base[i],base[i+1],base[i+2],fold,seed,ripple,time,out,i);}
 return out;
}
export const PILE=[
 {x:-.38,y:-1.36,z:.05,turn:.7,tilt:-1.47,roll:.12,scale:.78,fold:.88,color:0xd5c7b2},
 {x:.31,y:-1.31,z:.03,turn:-.55,tilt:-1.61,roll:-.15,scale:.77,fold:.76,color:0x373b36},
 {x:-.12,y:-1.22,z:-.33,turn:1.8,tilt:-1.47,roll:.13,scale:.73,fold:.83,color:0xe9e2d7},
 {x:.39,y:-1.15,z:.12,turn:-1.4,tilt:-1.59,roll:-.07,scale:.69,fold:.79,color:0x9e9987},
 {x:-.39,y:-1.11,z:.21,turn:.4,tilt:-1.41,roll:.08,scale:.68,fold:.71,color:0xbeb09a},
 {x:.09,y:-1.02,z:-.09,turn:-.3,tilt:-1.60,roll:.04,scale:.72,fold:.89,color:0xe7e0d4},
 {x:-.13,y:-.96,z:.16,turn:1.1,tilt:-1.44,roll:-.06,scale:.62,fold:.86,color:0x515745}
];
