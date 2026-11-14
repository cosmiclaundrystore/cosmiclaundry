import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
for(const [from,to] of [
 ['node_modules/three/build/three.module.min.js','three.module.js'],
 ['node_modules/three/build/three.core.min.js','three.core.js'],
 ['node_modules/three/LICENSE','THREE-LICENSE.txt'],
 ['node_modules/gsap/dist/gsap.min.js','gsap.min.js']
]) await copyFile(from,'dist/vendor/'+to);
// Three's two-part ESM build keeps its relative core import local.
import {readFile,writeFile} from 'node:fs/promises';
const path='dist/vendor/three.module.js';
await writeFile(path,(await readFile(path,'utf8')).replaceAll('./three.core.min.js','./three.core.js'));
console.log('Pinned Three.js and GSAP bundles copied locally.');

await writeFile("dist/vendor/GSAP-LICENSE.txt","GSAP 3.13.0. Copyright 2025 GreenSock. All rights reserved.\nSubject to the terms at https://gsap.com/standard-license\nOriginal package: https://www.npmjs.com/package/gsap/v/3.13.0\n");
