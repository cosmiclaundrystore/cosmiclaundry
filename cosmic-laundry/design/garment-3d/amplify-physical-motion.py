"""Post-bake art direction. Run AFTER scripts/build-garment.py, then validate-asset.py.

Keeps the settled base and original physical samples. Amplifies physical pose offsets
2.8x at hem/sleeves, tapering to 1x at pinned shoulder/collar. No live physics claim.
"""
from pathlib import Path
import bpy, numpy as np, json
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
out = root/"design/garment-3d"
bpy.ops.wm.open_mainfile(filepath=str(out/"garment-baked-cloth.blend"))
scene = bpy.context.scene
hero = bpy.data.objects["OversizedTee"]
physical = np.load(out/"cloth-sampled-positions.npz")["positions"]
base = physical[0]
t = np.clip((base[:,2]-.17)/.15,0,1)
t = t*t*(3-2*t)
amplitude = 1+1.8*(1-t)
directed = base[None,:,:] + (physical-base[None,:,:])*amplitude[None,:,None]
for index, state in enumerate(directed):
    hero.data.shape_keys.key_blocks[f"ClothPose_{index:02d}"].data.foreach_set("co",state.ravel())
hero.data.update()
np.savez_compressed(out/"cloth-art-directed-positions.npz",positions=directed,
                    amplification=amplitude,physicalSampleFrames=list(range(49,146,12)))

# Runtime assigns exact supplied front/back maps. Export three replaceable cotton slots.
links = []
for mat in hero.data.materials:
    p = mat.node_tree.nodes.get("Principled BSDF")
    for name in ("Base Color","Normal"):
        for link in list(p.inputs[name].links):
            links.append((mat.node_tree,link.from_socket,link.to_socket))
            mat.node_tree.links.remove(link)
for obj in bpy.context.selected_objects:
    obj.select_set(False)
hero.hide_set(False)
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(root/"dist/3d/oversized-tee.glb"),export_format="GLB",
    use_selection=True,export_animations=True,export_animation_mode="ACTIONS",
    export_morph=True,export_morph_normal=True,export_skins=False,
    export_materials="EXPORT",export_yup=True)
for tree,source,target in links:
    tree.links.new(source,target)
for name,frame,loc in [
    ("front-cloth-61.png",61,(0,-1.8,.06)),
    ("three-quarter-cloth-91.png",91,(1.2,-1.7,.22)),
    ("three-quarter-cloth-108.png",108,(1.2,-1.7,.22)),
    ("side-cloth-108.png",108,(1.8,-.04,.10))]:
    scene.frame_set(frame)
    scene.camera.location = loc
    scene.camera.rotation_euler = (Vector((0,0,-.015))-scene.camera.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath = str(out/name)
    bpy.ops.render.render(write_still=True)
    print("RENDER",name,flush=True)
scene.frame_set(1)
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=str(out/"garment-baked-cloth.blend"))
contract_path = root/"dist/3d/garment-contract.json"
contract = json.loads(contract_path.read_text())
contract["simulation"]["artDirection"] = {
    "method":"Amplify physical pose offsets from settled base with a smooth height taper",
    "maxAmplification":2.8,"shoulderAndCollarAmplification":1,
    "taperBlenderZRangeMeters":[.17,.32],
    "reproduction":"Run scripts/build-garment.py, then design/garment-3d/amplify-physical-motion.py, then validate-asset.py"}
contract["limits"].append("Cloth sample offsets are art-directed up to 2.8x below shoulders; this is baked playback")
contract["evidence"].extend(["three-quarter-cloth-108.png","side-cloth-108.png"])
for path in (contract_path,out/"authoring-contract.json"):
    path.write_text(json.dumps(contract,indent=2)+"\n")
print("AMPLIFICATION COMPLETE",float(np.linalg.norm(directed-base[None,:,:],axis=2).max()),flush=True)
