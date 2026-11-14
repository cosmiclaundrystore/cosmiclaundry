/* True garment geometry with original-photo maps and a baked cloth clip.
 * Geometry is shared; materials, maps, morph weights and mixers are view-owned.
 */
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

let sharedAsset;
const modelURL = new URL('./oversized-tee.glb', import.meta.url).href;
const getAsset = () => sharedAsset ||= new GLTFLoader().loadAsync(modelURL).catch(error => {
  sharedAsset = null; throw error;
});

function photoTexture(url, anisotropy, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let finished = false;
    const abort = () => {
      if (finished) return;
      finished = true; image.onload = image.onerror = null; image.src = '';
      reject(new DOMException('Product selection changed', 'AbortError'));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', abort);
      const texture = new THREE.Texture(image);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      texture.name = url;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', abort);
      reject(new Error('The original garment artwork could not be loaded.'));
    };
    image.src = new URL(url, document.baseURI).href;
  });
}

export async function createGarment(product, renderer, { signal } = {}) {
  if (!product?.image || !product?.backImage) throw new Error('Garment images are missing.');
  const dark = product.color.toLowerCase() === 'black';
  const fabricColor = new THREE.Color(dark ? '#1b1c20' : '#e6e5e0');
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const results = await Promise.allSettled([
    getAsset(),
    photoTexture(product.image, anisotropy, signal),
    photoTexture(product.backImage, anisotropy, signal),
  ]);
  if (signal?.aborted || results.some(result => result.status === 'rejected')) {
    results.slice(1).forEach(result => { if (result.status === 'fulfilled') result.value.dispose(); });
    throw signal?.aborted ? new DOMException('Product selection changed', 'AbortError')
      : results.find(result => result.status === 'rejected').reason;
  }
  const [asset, front, back] = results.map(result => result.value);
  const model = asset.scene.clone(true);
  const materials = new Set(), meshes = [], names = new Set();
  let morphTargets = 0;
  const disposeMaterials = () => {
    materials.forEach(material => material.dispose()); front.dispose(); back.dispose();
  };
  try {
    model.traverse(object => {
      if (!object.isMesh) return;
      meshes.push(object);
      if (!object.geometry.attributes.uv) throw new Error('Garment UV coordinates are missing.');
      morphTargets += object.geometry.morphAttributes.position?.length || 0;
      if (object.morphTargetInfluences) object.morphTargetInfluences = [...object.morphTargetInfluences];
      const replace = original => {
        names.add(original.name);
        const map = original.name === 'FabricFront' ? front : original.name === 'FabricBack' ? back : null;
        const material = new THREE.MeshStandardMaterial({
          name: original.name, color: map ? '#ffffff' : fabricColor, map,
          roughness: .88, metalness: 0, side: THREE.DoubleSide,
        });
        if (map) {
          // Preserve the actual source image; fill only transparent image
          // texels with matching fabric. The cloth remains physically opaque.
          material.onBeforeCompile = shader => {
            shader.uniforms.fabricPadding = { value: fabricColor };
            shader.fragmentShader = 'uniform vec3 fabricPadding;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
              #ifdef USE_MAP
                vec4 sourceTexel = texture2D(map, vMapUv);
                diffuseColor *= vec4(mix(fabricPadding, sourceTexel.rgb, sourceTexel.a), 1.0);
              #endif
            `);
          };
          material.customProgramCacheKey = () => 'original-photo-opaque-fabric-v1';
        }
        materials.add(material); return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
      object.frustumCulled = false;
    });
    if (!meshes.length || !names.has('FabricFront') || !names.has('FabricBack')) {
      throw new Error('The garment material contract does not match.');
    }
    const box = new THREE.Box3().setFromObject(model);
    const dimensions = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(dimensions.y) || dimensions.y <= 0 || dimensions.z < .01) {
      throw new Error('The garment must have usable three-dimensional bounds.');
    }
    const normalized = new THREE.Group(); normalized.add(model);
    model.position.sub(center);
    normalized.scale.setScalar(3.05 / dimensions.y);
    const pivot = new THREE.Group(); pivot.add(normalized);
    const mixer = new THREE.AnimationMixer(model);
    const clip = asset.animations.find(item => item.name === 'ClothIdle') || asset.animations[0];
    if (!clip || !morphTargets) throw new Error('The garment cloth animation is missing.');
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity).play(); mixer.update(0);
    let disposed = false;
    return {
      object: pivot, width: dimensions.x * 3.05 / dimensions.y, height: 3.05,
      depth: dimensions.z * 3.05 / dimensions.y,
      update(delta) { if (!disposed) mixer.update(delta); },
      stats() {
        return {
          clip: clip.name, clipTime: Number(action.time.toFixed(3)),
          clipDuration: clip.duration, morphTargets,
          morphWeights: meshes.find(mesh => mesh.morphTargetInfluences)?.morphTargetInfluences?.map(value => Number(value.toFixed(3))) || [],
          materialSlots: [...names],
          assetBounds: dimensions.toArray().map(value => Number(value.toFixed(4))),
          deformation: 'baked-cloth',
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(model);
        disposeMaterials(); pivot.removeFromParent();
      },
    };
  } catch (error) { disposeMaterials(); throw error; }
}
