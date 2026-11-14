import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createGarmentData,deformGarment,PILE} from '../dist/3d/cloth.mjs';
import {readFile} from 'node:fs/promises';
const data=createGarmentData(1);
test('garment geometry has valid triangles and an open neckline',()=>{
 assert(data.positions.length/3<15000);assert.equal(data.uv.length/2,data.positions.length/3);
 assert(data.indices.every(i=>i<data.positions.length/3));
 for(let i=0;i<data.indices.length;i+=3){
  const [a,b,c]=Array.from(data.indices.slice(i,i+3),n=>new THREE.Vector3().fromArray(data.positions,n*3));
  const area=b.clone().sub(a).cross(c.clone().sub(a)).length();assert(area>1e-8,'zero area triangle');
 }
 // No cloth crosses the open front neckline; centre of the neck is not capped.
 assert(!Array.from({length:data.positions.length/3},(_,i)=>data.positions.slice(i*3,i*3+3)).some(([x,y,z])=>Math.abs(x)<.2&&y>1.13));
});
test('folding is reversible and positions and normals remain finite throughout reveal',()=>{
 const out=data.positions.slice();
 for(let step=0;step<=20;step++){
  const fold=step/20;deformGarment(data.positions,out,fold,0,.3,1.4);assert(out.every(Number.isFinite));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(out.slice(),3));g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeVertexNormals();assert(g.attributes.normal.array.every(Number.isFinite));g.dispose();
 }
 const original=deformGarment(data.positions,out,0).slice();deformGarment(data.positions,out,1);deformGarment(data.positions,out,0);assert.deepEqual(out,original);
 const bounds=(fold)=>{deformGarment(data.positions,out,fold);const box=new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(out,3));return box.getSize(new THREE.Vector3());};
 assert(bounds(1).x<bounds(0).x*.75);assert(bounds(1).y<bounds(0).y*.75);assert(bounds(1).z>bounds(0).z*2);
});
test('pile consists of seven overlapping garments in one concentrated heap',()=>{
 assert.equal(PILE.length,7);assert(PILE.every(p=>Math.abs(p.x)<.5&&Math.abs(p.z)<.4&&p.fold>.7));
 const geometry=createGarmentData(.6),all=new THREE.Box3();
 for(const [i,p] of PILE.entries()){
  const out=deformGarment(geometry.positions,geometry.positions.slice(),p.fold,i+1);
  const m=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tilt,p.turn,p.roll,'YXZ')),new THREE.Vector3(p.scale,p.scale,p.scale));
  all.union(new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(out,3)).applyMatrix4(m));
 }
 assert(all.getSize(new THREE.Vector3()).x<3.8);console.log('Pile bounds:',all.min.toArray(),all.max.toArray());
});
test('exact artwork remains unset until the user supplies the reference',async()=>{
 const config=JSON.parse(await readFile(new URL('../dist/3d/mona-artwork.json',import.meta.url),'utf8'));assert.equal(config.src,null);assert.equal(config.status,'awaiting-user-reference');
});
test('settled cache matches the mesh topology and has finite coordinates',async()=>{
 const meta=JSON.parse(await readFile(new URL('../dist/3d/mona-cloth.json',import.meta.url),'utf8'));
 const file=await readFile(new URL('../dist/3d/mona-cloth.bin',import.meta.url));
 assert.equal(meta.garments.length,8);
 for(const g of meta.garments){
  assert.equal(createGarmentData(g.detail).positions.length,g.vertexCount*3);assert.equal(g.byteLength,g.vertexCount*12);
  const points=new Float32Array(file.buffer,file.byteOffset+g.byteOffset,g.vertexCount*3);assert(points.every(Number.isFinite));
 }
 assert(file.byteLength<600000);
});
