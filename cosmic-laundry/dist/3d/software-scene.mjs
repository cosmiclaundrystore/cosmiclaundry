import {Matrix4,Euler,Vector3,PerspectiveCamera,Color} from '../vendor/three.module.js';
import {createGarmentData,deformGarment,PILE,clamp} from './cloth.mjs';
// Live CPU projection of the same cloth meshes for browsers without usable WebGL.
// No video, screenshot, CSS garment, or image sequence is used.
export async function mountSoftwareLaundry(card,{navigate,announce=()=>{}}={}){
 const cover=card.querySelector('[data-laundry-3d]'),hint=cover.querySelector('.prototype-hint');
 cover.querySelectorAll('canvas').forEach(c=>c.remove());
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw new Error('Canvas rendering is unavailable');
 canvas.className='laundry-webgl';canvas.setAttribute('aria-hidden','true');cover.prepend(canvas);
 const abort=new AbortController(),signal=abort.signal;
 const [meta,buffer]=await Promise.all([fetch('/3d/mona-cloth.json').then(r=>{if(!r.ok)throw Error('Cloth data unavailable');return r.json();}),fetch('/3d/mona-cloth.bin').then(r=>{if(!r.ok)throw Error('Cloth mesh unavailable');return r.arrayBuffer();})]);
 const items=meta.garments.map((g,i)=>{
  const data=createGarmentData(i===PILE.length?.25:.1),rest=new Float32Array(buffer,g.byteOffset,data.positions.length);
  const color=new Color(i===PILE.length?'#282b28':PILE[i].color);
  return {data,rest,out:rest.slice(),projected:new Float32Array(rest.length),world:new Float32Array(rest.length),color,featured:i===PILE.length};
 });
 const camera=new PerspectiveCamera(35,1.5,.1,30),target=new Vector3(),matrix=new Matrix4(),v=new Vector3(),scale=new Vector3(),euler=new Euler(),position=new Vector3();
 let progress=0,goal=0,raf=0,last=0,disposed=false,visible=true,entering=false,touchOpen=false,hover=false,width=600,height=400,shirtBounds=null;
 const touch=()=>matchMedia('(hover: none), (pointer: coarse)').matches;
 const motion=()=>document.body.dataset.motion!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const smooth=t=>t*t*(3-2*t);
 function request(){if(!raf&&!disposed&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
 function updateHint(){hint.textContent=entering?'OPENING LAUNDRY…':goal?(touch()?'TAP SHIRT TO ENTER':'CLICK SHIRT TO ENTER'):(touch()?'TAP TO UNFOLD':'HOVER TO UNFOLD');}
 function reveal(){goal=1;updateHint();request();}
 function retract(){if(entering)return;goal=0;hover=touchOpen=false;updateHint();request();}
 function draw(now){
  raf=0;if(disposed||!visible||document.hidden)return;
  const dt=Math.min((now-last)/1000||.033,.05);last=now;
  progress=motion()?clamp(progress+Math.sign(goal-progress)*Math.min(Math.abs(goal-progress),dt/(goal?1.7:1.35))):goal;
  const p=smooth(progress),fold=1-smooth(clamp((progress-.12)/.88));
  camera.aspect=width/height;camera.position.set(0,1.22,4.8+.9*p);camera.lookAt(target.set(0,-.91+.69*p,0));camera.updateProjectionMatrix();camera.updateMatrixWorld();
  ctx.fillStyle='#e8e4de';ctx.fillRect(0,0,width,height);
  const shadow=ctx.createRadialGradient(width*.5,height*.75,2,width*.5,height*.75,width*.38);shadow.addColorStop(0,'rgba(55,47,38,.28)');shadow.addColorStop(1,'rgba(55,47,38,0)');ctx.fillStyle=shadow;ctx.save();ctx.translate(0,height*.4);ctx.scale(1,.5);ctx.fillRect(0,0,width,height);ctx.restore();
  const triangles=[];shirtBounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(let k=0;k<items.length;k++){
   const item=items[k],featured=item.featured;
   if(featured){deformGarment(item.data.positions,item.out,fold,0,Math.sin(progress*Math.PI)*.3,now*.001);const blend=smooth(fold);for(let n=0;n<item.out.length;n++)item.out[n]=item.out[n]*(1-blend)+item.rest[n]*blend;
    position.set(0,-.85+1.14*p,.2+.5*p);euler.set(-1.47+1.31*p,.34*(1-p),-.14*(1-p),'XYZ');scale.setScalar(.66+.28*p);
   }else{const a=PILE[k];position.set(a.x,a.y,a.z);euler.set(a.tilt,a.turn,a.roll,'YXZ');scale.setScalar(a.scale);}
   matrix.makeRotationFromEuler(euler);matrix.scale(scale);matrix.setPosition(position);
   for(let n=0;n<item.out.length;n+=3){v.fromArray(item.out,n).applyMatrix4(matrix);v.toArray(item.world,n);v.project(camera);item.projected[n]=(v.x*.5+.5)*width;item.projected[n+1]=(-v.y*.5+.5)*height;item.projected[n+2]=v.z;
    if(featured){shirtBounds.minX=Math.min(shirtBounds.minX,item.projected[n]);shirtBounds.maxX=Math.max(shirtBounds.maxX,item.projected[n]);shirtBounds.minY=Math.min(shirtBounds.minY,item.projected[n+1]);shirtBounds.maxY=Math.max(shirtBounds.maxY,item.projected[n+1]);}
   }
   const ids=item.data.indices,w=item.world,s=item.projected;
   for(let n=0;n<ids.length;n+=3){const a=ids[n]*3,b=ids[n+1]*3,c=ids[n+2]*3;
    // Drop subpixel faces; visible triangles retain their true depth and folds.
    const area=(s[b]-s[a])*(s[c+1]-s[a+1])-(s[b+1]-s[a+1])*(s[c]-s[a]);if(Math.abs(area)<.18)continue;
    const ax=w[b]-w[a],ay=w[b+1]-w[a+1],az=w[b+2]-w[a+2],bx=w[c]-w[a],by=w[c+1]-w[a+1],bz=w[c+2]-w[a+2];
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,len=Math.hypot(nx,ny,nz)||1;
    const light=.48+.52*Math.abs((nx*-.4+ny*.75+nz*.5)/len);
    triangles.push({item,a,b,c,z:(s[a+2]+s[b+2]+s[c+2])/3,shade:Math.round(light*18)/18});
   }
  }
  triangles.sort((a,b)=>b.z-a.z);
  for(const t of triangles){const s=t.item.projected,c=t.item.color;ctx.fillStyle=`rgb(${Math.round((c.r**(1/2.2))*255*t.shade)} ${Math.round((c.g**(1/2.2))*255*t.shade)} ${Math.round((c.b**(1/2.2))*255*t.shade)})`;ctx.beginPath();ctx.moveTo(s[t.a],s[t.a+1]);ctx.lineTo(s[t.b],s[t.b+1]);ctx.lineTo(s[t.c],s[t.c+1]);ctx.closePath();ctx.fill();}
  if(progress!==goal)request();
 }
 function enter(){if(entering)return;entering=true;updateHint();navigate?.(card.getAttribute('href'));}
 card.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!touch()){hover=true;reveal();}},{signal});
 card.addEventListener('pointerleave',()=>{if(!touchOpen)retract();},{signal});
 card.addEventListener('focus',()=>{hover=true;reveal();},{signal});card.addEventListener('blur',()=>{if(!touchOpen)retract();},{signal});
 card.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(e.detail!==0&&!cover.contains(e.target))return;e.preventDefault();if(touch()&&!touchOpen){touchOpen=true;reveal();announce('T-shirt unfolding. Tap the shirt to enter.');return;}if(progress<.98){reveal();return;}const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*width,y=(e.clientY-r.top)/r.height*height;if(e.detail===0||(x>=shirtBounds.minX&&x<=shirtBounds.maxX&&y>=shirtBounds.minY&&y<=shirtBounds.maxY))enter();},{signal});
 document.addEventListener('pointerdown',e=>{if(touchOpen&&!card.contains(e.target))retract();},{signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')retract();},{signal});
 document.addEventListener('cosmic:motion',request,{signal});document.addEventListener('visibilitychange',request,{signal});
 const resize=new ResizeObserver(()=>{const r=cover.getBoundingClientRect();width=Math.max(1,Math.round(Math.min(r.width,650)));height=Math.max(1,Math.round(width*r.height/r.width));canvas.width=width;canvas.height=height;request();});resize.observe(cover);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();},{rootMargin:'80px'});observer.observe(cover);
 cover.dataset.three='ready';cover.dataset.renderer='software';updateHint();request();
 return ()=>{disposed=true;abort.abort();resize.disconnect();observer.disconnect();cancelAnimationFrame(raf);canvas.remove();};
}
