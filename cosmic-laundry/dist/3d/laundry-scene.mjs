import * as THREE from '../vendor/three.module.js';
import '../vendor/gsap.min.js';
import {RoomEnvironment} from './RoomEnvironment.mjs';
import {createGarmentData,deformGarment,PILE,clamp} from './cloth.mjs';
const gsap=window.gsap;

function cottonTexture(){
 const size=256,bytes=new Uint8Array(size*size*4);
 let seed=77;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  seed=(1664525*seed+1013904223)>>>0;
  const warp=Math.sin(x*Math.PI)*.5+Math.sin((x+.5)*Math.PI/2)*7;
  const weft=Math.cos(y*Math.PI/2)*8;
  const n=128+warp+weft+((seed>>>24)/255-.5)*16;
  const i=(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=n;bytes[i+3]=255;
 }
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(7,10);texture.needsUpdate=true;
 return texture;
}
function garment(material,detail,fold,seed,rest=null,staticCloth=false){
 const data=createGarmentData(detail),positions=data.positions.slice();
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
 const update=(f,ripple=0,time=0)=>{
  if(staticCloth&&rest&&rest.length===positions.length)positions.set(rest);
  else{deformGarment(data.positions,positions,f,seed,ripple,time);if(rest&&rest.length===positions.length){const blend=f*f*(3-2*f);for(let i=0;i<positions.length;i++)positions[i]=positions[i]*(1-blend)+rest[i]*blend;}}
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 };
 update(fold);return {mesh,update,base:data.positions};
}
let clothAssetPromise;
async function loadSettledCloth(){
 if(!clothAssetPromise)clothAssetPromise=(async()=>{
  const [metadataResponse,binaryResponse]=await Promise.all([fetch('/3d/mona-cloth.json'),fetch('/3d/mona-cloth.bin')]);
  if(!metadataResponse.ok||!binaryResponse.ok)throw new Error('Cloth cache unavailable');
  const metadata=await metadataResponse.json(),buffer=await binaryResponse.arrayBuffer();
  if(metadata.garments.length!==PILE.length+1)throw new Error('Invalid cloth cache');
  return metadata.garments.map(g=>{
   if(g.byteLength!==g.vertexCount*12||g.byteOffset+g.byteLength>buffer.byteLength)throw new Error('Invalid cloth geometry');
   return new Float32Array(buffer,g.byteOffset,g.vertexCount*3);
  });
 })().catch(error=>{clothAssetPromise=null;console.warn(error);return null;});
 return clothAssetPromise;
}
async function applyExactArtwork(config,featured){
 if(!config.src)return null;
 const texture=await new THREE.TextureLoader().loadAsync(config.src);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const ratio=texture.image.width/texture.image.height;let width=config.printWidth,height=width/ratio;
 if(height>config.maxPrintHeight){height=config.maxPrintHeight;width=height*ratio;}
 const base=featured.base,mask=new Float32Array(base.length/3);
 for(let i=0;i<mask.length;i++)mask[i]=base[i*3+2]>.04?1:0;
 featured.mesh.geometry.setAttribute('printFront',new THREE.BufferAttribute(mask,1));
 const rect=new THREE.Vector4(.5-width/6.28,(config.printTop-height+1.22)/2.32,width/3.14,height/2.32);
 featured.mesh.material.onBeforeCompile=shader=>{
  shader.uniforms.artworkMap={value:texture};shader.uniforms.artworkRect={value:rect};
  shader.vertexShader='attribute float printFront; varying float vPrintFront; varying vec2 vPrintUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPrintFront=printFront; vPrintUv=uv;');
  shader.fragmentShader='uniform sampler2D artworkMap; uniform vec4 artworkRect; varying float vPrintFront; varying vec2 vPrintUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 artworkUv=(vPrintUv-artworkRect.xy)/artworkRect.zw;
   if(vPrintFront>.8 && artworkUv.x>=0. && artworkUv.x<=1. && artworkUv.y>=0. && artworkUv.y<=1.){
    vec4 artwork=texture2D(artworkMap,artworkUv);diffuseColor.rgb=mix(diffuseColor.rgb,artwork.rgb,artwork.a);
   }`);
 };
 featured.mesh.material.customProgramCacheKey=()=>config.src;featured.mesh.material.needsUpdate=true;
 return {texture};
}

export async function mountLaundryPrototype(card,{navigate,announce=()=>{}}={}){
 const cover=card.querySelector('[data-laundry-3d]'),hint=cover.querySelector('.prototype-hint');
 const abort=new AbortController(),signal=abort.signal;
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(error){throw new Error('Interactive 3D is unavailable on this device.',{cause:error});}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1.3:1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.className='laundry-webgl';canvas.setAttribute('aria-hidden','true');cover.prepend(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e4de');
 const camera=new THREE.PerspectiveCamera(35,1.5,.1,30);camera.position.set(0,1.22,4.8);const cameraTarget=new THREE.Vector3(0,-.91,0);camera.lookAt(cameraTarget);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0xbab0a2,2.1));
 const key=new THREE.DirectionalLight(0xfff8eb,3.8);key.position.set(-3.6,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.025;key.shadow.bias=-.0003;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xe9efff,2.0);fill.position.set(4,2.3,2);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(1,3,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xe8e4de,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.52;floor.receiveShadow=true;scene.add(floor);
 const weave=cottonTexture(),materials=[];
 const makeMaterial=color=>{const m=new THREE.MeshPhysicalMaterial({color,roughness:.94,metalness:0,sheen:.85,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.32),sheenRoughness:.88,bumpMap:weave,bumpScale:.013,side:THREE.DoubleSide});materials.push(m);return m;};
 let config={src:null,shirtColor:'#282b28',printWidth:.93,printTop:.48,maxPrintHeight:1.34};
 try{const response=await fetch('/3d/mona-artwork.json',{signal});if(response.ok)config={...config,...await response.json()};}catch{}
 const settled=await loadSettledCloth();
 const pile=new THREE.Group();scene.add(pile);
 PILE.forEach((p,i)=>{
  const cloth=garment(makeMaterial(p.color),.6,p.fold,i+1,settled?.[i],true),g=new THREE.Group();
  g.add(cloth.mesh);g.position.set(p.x,p.y,p.z);g.rotation.order='YXZ';g.rotation.set(p.tilt,p.turn,p.roll);g.scale.setScalar(p.scale);pile.add(g);
 });
 const featured=garment(makeMaterial(config.shirtColor),1,1,0,settled?.[PILE.length]),root=new THREE.Group();root.add(featured.mesh);scene.add(root);
 const state={fold:1,parallaxX:0,parallaxY:0},rest={y:-.85,z:.2,scale:.66,x:-1.47,turn:.34,roll:-.14};
 root.position.set(0,rest.y,rest.z);root.rotation.set(rest.x,rest.turn,rest.roll);root.scale.setScalar(rest.scale);
 let artwork=null;
 if(config.src){try{artwork=await applyExactArtwork(config,featured);}catch{announce('The artwork could not load. The 3D garment preview is still available.');}}
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),rotationTarget=new THREE.Vector2();
 let disposed=false,visible=true,hover=false,touchOpen=false,entering=false,ready=false,raf=0,lastFold=-1,lastRipple=-1,dirty=true,resumeTimeline=false,enterTimeline=null;
 const motion=()=>document.body.dataset.motion!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const touch=()=>matchMedia('(hover: none), (pointer: coarse)').matches;
 function setHint(){
  hint.textContent=entering?'OPENING LAUNDRY…':hover||touchOpen?(touch()?'TAP SHIRT TO ENTER':'CLICK SHIRT TO ENTER'):(touch()?'TAP TO UNFOLD':'HOVER TO UNFOLD');
  cover.dataset.reveal=hover||touchOpen?'open':'closed';
 }
 function request(){dirty=true;if(!raf&&visible&&!document.hidden&&!disposed)raf=requestAnimationFrame(draw);}
 const timeline=gsap.timeline({paused:true,onUpdate:request,onComplete(){ready=true;setHint();request();},onReverseComplete(){ready=false;touchOpen=false;setHint();request();}});
 timeline.to(camera.position,{z:5.7,duration:1.62,ease:'power3.inOut'},0)
 .to(cameraTarget,{y:-.22,duration:1.62,ease:'power3.inOut'},0)
 .to(root.position,{y:.29,z:.7,duration:1.62,ease:'power3.inOut'},0)
 .to(root.rotation,{x:-.5,y:-.34,z:.035,duration:.82,ease:'power2.inOut'},0)
 .to(state,{fold:.3,duration:.74,ease:'sine.inOut'},.32)
 .to(state,{fold:0,duration:.64,ease:'sine.inOut'},1.06)
 .to(root.rotation,{x:-.16,y:0,z:0,duration:.88,ease:'power2.inOut'},.82)
 .to(root.scale,{x:.94,y:.94,z:.94,duration:1.48,ease:'power2.inOut'},.16);
 function reveal(){if(entering)return;ready=false;setHint();if(motion())timeline.timeScale(1).play();else{timeline.progress(1).pause();ready=true;}request();}
 function retract(){if(entering)return;hover=false;touchOpen=false;ready=false;setHint();if(motion())timeline.timeScale(1.2).reverse();else timeline.progress(0).pause();rotationTarget.set(0,0);state.parallaxX=state.parallaxY=0;request();}
 function draw(now){
  raf=0;if(disposed||!visible||document.hidden)return;
  const animating=timeline.isActive()||entering;
  const floating=ready&&(hover||touchOpen)&&motion()&&!entering;
  const t=now*.001;
  const ripple=animating&&!entering&&state.fold>.02&&state.fold<.98?Math.sin(timeline.progress()*Math.PI):0;
  if(Math.abs(state.fold-lastFold)>.00005||Math.abs(ripple-lastRipple)>.0001 ){featured.update(state.fold,ripple,t);lastFold=state.fold;lastRipple=ripple;}
  if(ready&&!entering){
   state.parallaxX+=(rotationTarget.x-state.parallaxX)*.075;state.parallaxY+=(rotationTarget.y-state.parallaxY)*.075;
   root.rotation.y=state.parallaxX;root.rotation.x=-.16+state.parallaxY;
   root.position.y=.29+(floating?Math.sin(t*1.7)*.024:0);
  }
  camera.lookAt(cameraTarget);renderer.render(scene,camera);dirty=false;
  if(animating||floating||(ready&&(Math.abs(state.parallaxX-rotationTarget.x)>.0002||Math.abs(state.parallaxY-rotationTarget.y)>.0002)))raf=requestAnimationFrame(draw);
 }
 function hitShirt(event){
  const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
  scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(featured.mesh).length>0;
 }
 function enter(){
  if(entering)return;entering=true;ready=false;timeline.pause();setHint();
  const complete=()=>navigate?.(card.getAttribute('href'));
  if(!motion()){complete();return;}
  enterTimeline=gsap.timeline({onUpdate:request,onComplete:complete})
   .to(root.position,{z:1.8,y:.42,duration:.48,ease:'power2.in'},0)
   .to(root.scale,{x:1.12,y:1.12,z:1.12,duration:.48,ease:'power2.in'},0)
   .to(canvas,{opacity:0,duration:.19,ease:'sine.in'},.32);
  request();
 }
 card.addEventListener('pointerenter',event=>{if(event.pointerType==='touch'||touch())return;hover=true;reveal();},{signal});
 card.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&!touchOpen)retract();},{signal});
 card.addEventListener('pointermove',event=>{
  if(!ready||touch()||!motion())return;const r=cover.getBoundingClientRect();
  rotationTarget.set(clamp((event.clientX-r.left)/r.width-.5,-.5,.5)*.16,clamp((event.clientY-r.top)/r.height-.5,-.5,.5)*.07);request();
 },{signal});
 card.addEventListener('focus',()=>{hover=true;reveal();},{signal});
 card.addEventListener('blur',()=>{if(!touchOpen)retract();},{signal});
 card.addEventListener('click',event=>{
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  // Captions retain their ordinary link behaviour. The 3D surface is a two-stage touch target.
  if(event.detail!==0&&!cover.contains(event.target))return;
  event.preventDefault();
  if(event.detail===0){if(ready)enter();else{hover=true;reveal();}return;}
  if(touch()&&!touchOpen){touchOpen=true;hover=false;reveal();announce('T-shirt unfolding. Tap the shirt again to open Mona Lisa’s Laundry.');return;}
  if(ready&&hitShirt(event)){enter();return;}
  if(!ready){hover=true;reveal();}
 },{signal});
 document.addEventListener('pointerdown',event=>{if(touchOpen&&!card.contains(event.target))retract();},{signal});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!entering)retract();},{signal});
 document.addEventListener('cosmic:motion',()=>{if(!motion()){timeline.progress(hover||touchOpen?1:0).pause();ready=hover||touchOpen;rotationTarget.set(0,0);}request();},{signal});
 const resize=new ResizeObserver(()=>{const r=cover.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();request();}});resize.observe(cover);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){resumeTimeline=timeline.isActive();timeline.pause();cancelAnimationFrame(raf);raf=0;}else{if(resumeTimeline){timeline.resume();resumeTimeline=false;}request();}},{rootMargin:'80px'});observer.observe(cover);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){resumeTimeline=timeline.isActive();timeline.pause();cancelAnimationFrame(raf);raf=0;}else{if(resumeTimeline){timeline.resume();resumeTimeline=false;}request();}},{signal});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cover.dataset.three='failed';hint.textContent='3D UNAVAILABLE · OPEN LAUNDRY ↗';abort.abort();cancelAnimationFrame(raf);raf=0;},{signal});
 cover.dataset.three='ready';setHint();request();
 card.setAttribute('aria-description','Interactive 3D prototype. Hover or focus to unfold the shirt; select the shirt to enter. On touch screens, tap to unfold, then tap the shirt to enter. Artwork is awaiting your reference image.');
 return ()=>{
  disposed=true;enterTimeline?.kill();abort.abort();resize.disconnect();observer.disconnect();cancelAnimationFrame(raf);timeline.kill();gsap.killTweensOf(camera.position);gsap.killTweensOf(cameraTarget);gsap.killTweensOf(root.position);gsap.killTweensOf(root.scale);gsap.killTweensOf(root.rotation);gsap.killTweensOf(state);gsap.killTweensOf(canvas);
  scene.traverse(object=>{if(object.isMesh)object.geometry.dispose();});materials.forEach(m=>m.dispose());floor.material.dispose();weave.dispose();environment.dispose();artwork?.texture.dispose();renderer.dispose();canvas.remove();
 };
}
