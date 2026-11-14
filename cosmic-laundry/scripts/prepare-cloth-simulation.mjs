import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createGarmentData,deformGarment,PILE} from '../dist/3d/cloth.mjs';
const shapes=[];
for(const [i,p]of [...PILE,{x:0,y:-.85,z:.2,turn:.34,tilt:-1.47,roll:-.14,scale:.66,fold:1,color:0x282b28}].entries()){
 const detail=i<PILE.length?.6:1,data=createGarmentData(detail),matrix=new T.Matrix4().compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion().setFromEuler(new T.Euler(p.tilt,p.turn,p.roll,i<PILE.length?'YXZ':'XYZ')),new T.Vector3().setScalar(p.scale));
 const positions=deformGarment(data.positions,data.positions.slice(),p.fold,i+1);
 const attr=new T.BufferAttribute(positions,3);attr.applyMatrix4(matrix);
 shapes.push({positions:Array.from(positions),indices:Array.from(data.indices),inverse:matrix.clone().invert().toArray(),color:p.color,detail});
}
fs.mkdirSync('.sites-runtime',{recursive:true});fs.writeFileSync('.sites-runtime/cloth-input.json',JSON.stringify(shapes));
