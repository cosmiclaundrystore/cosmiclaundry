"""Cosmic Laundry authored garment + Blender cloth -> compact GLTF morph loop.

Run using Blender 5.2 background Python. All source/reference images are read-only.
Preview: blender -b --python scripts/build-garment.py -- --preview
Full: blender -b --python scripts/build-garment.py
"""
import bpy, bmesh, math, json, sys, time
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "design/garment-3d"
OUT.mkdir(parents=True, exist_ok=True)
WEB = ROOT / "dist/3d"
PREVIEW = "--preview" in sys.argv
START = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 121
scene.gravity = (0, 0, -1.4)

verts, faces, mats, info = [], [], [], []
weld = {}
def vert(x, depth, h, tag="body", force_new=False):
    # Blender -Y front, +Z up; glTF exporter produces +Z front and +Y up.
    # Reference silhouette is long/narrow: pixel-space artwork must keep its aspect ratio.
    co = (x*.74, -depth*.90, (h-.375)*1.12)
    key = tuple(round(v, 7) for v in co)
    if not force_new and key in weld:
        return weld[key]
    idx = len(verts)
    verts.append(co)
    info.append((x, h, depth, tag))
    weld[key] = idx
    return idx

def face(ids, mat):
    if len(set(ids)) < 3:
        return
    faces.append(ids)
    mats.append(mat)

NX, NY = 24, 28
ARM = 19
RNECK = .135416666667
panels = {}
for side in (1, -1):
    grid = []
    for k in range(NY+1):
        t = k/NY
        width = .318-.014*math.sin(math.pi*t)+.007*t
        row = []
        for j in range(NX+1):
            q = j/NX*2-1
            x = q*width
            tx = q*.325
            a = abs(tx)
            if a <= RNECK+.00001:
                neck = math.sqrt(max(0, 1-(a/RNECK)**2))
                top_h = .75-(.075 if side == 1 else .018)*neck
                top_d = side*(.085 if side == 1 else .072)*neck
            else:
                top_h = .75-(a-RNECK)/(.325-RNECK)*.095
                top_d = 0
            h = t*top_h
            # Broad, relaxed torso with distinct rounded side seams.
            cross = max(0, 1-q*q)**.40
            torso_d = side*(.075+.019*math.sin(t*math.pi))*cross
            arm_t = max(0, (k-ARM)/(NY-ARM))
            arm_d = side*.071*math.sin(arm_t*math.pi) if k >= ARM else 0
            d = torso_d + arm_d*abs(q)**6
            top_blend = max(0, (t-.82)/.18)
            d = d*(1-top_blend)+top_d*top_blend
            # Small fabric folds around lower sides; the printed chest stays calm.
            edge = min(1, max(0, (abs(x)-.13)/.13))
            lower = max(0, 1-h/.30)
            d += side*(.005*math.sin(x*59+h*17)*edge*math.sin(t*math.pi)
                       + .004*math.sin(h*46+x*12)*lower*cross)
            h += .0035*math.sin(x*23+.5)*max(0, 1-t*8)
            if j in (0, NX) and k <= ARM:
                d = 0
            if k == NY and abs(tx) >= RNECK-.00001:
                d = 0
            row.append(vert(x, d, h))
        grid.append(row)
    panels[side] = grid
    for k in range(NY):
        for j in range(NX):
            ids = [grid[k][j], grid[k][j+1], grid[k+1][j+1], grid[k+1][j]]
            face(ids if side == 1 else ids[::-1], 2 if k == 0 else (0 if side == 1 else 1))

# Sleeves grow from the exact open armhole boundaries: no disconnected cutouts.
sleeve_rings = []
for sign in (-1, 1):
    j = 0 if sign == -1 else NX
    edge = ([panels[1][k][j] for k in range(ARM, NY+1)] +
            [panels[-1][k][j] for k in range(NY-1, ARM, -1)])
    count = len(edge)
    prev = edge
    for step in range(1, 11):
        t = step/10
        ring = []
        for n, idx in enumerate(edge):
            x0, h0, d0, _ = info[idx]
            cy = (.655 + (ARM/NY)*.655)/2
            vertical = h0-cy
            # A dropped sleeve with a circular cuff lying across its outward/down axis.
            x1 = sign*(.449 + vertical*.73)
            h1 = .371 + vertical*.69
            d1 = d0*1.08
            x = x0*(1-t)+x1*t
            h = h0*(1-t)+h1*t
            d = d0*(1-t)+d1*t
            d += math.copysign(1, d0 or 1)*.003*math.sin(t*13+n*.6)*math.sin(math.pi*t)
            ring.append(vert(x, d, h, "sleeve"))
        for n in range(count):
            nn = (n+1)%count
            mi = 0 if n < NY-ARM else 1
            ids = [prev[n], ring[n], ring[nn], prev[nn]]
            face(ids if sign == 1 else ids[::-1], 2 if step == 10 else mi)
        prev = ring
    sleeve_rings.append(prev)

# Continuous ribbed collar band, attached to the neckline, with a true open hole.
neck_j = [j for j in range(NX+1) if abs((j/NX*2-1)*.325) <= RNECK+.00001]
neck = ([panels[1][NY][j] for j in neck_j] +
        [panels[-1][NY][j] for j in neck_j[-2:0:-1]])
prev = neck
for step in range(1, 4):
    t = step/3
    ring = []
    for idx in neck:
        x, h, d, _ = info[idx]
        ring.append(vert(x*(1-.075*t), d*(1-.12*t), h+.013*t, "collar"))
    for n in range(len(neck)):
        nn = (n+1)%len(neck)
        face([prev[n], prev[nn], ring[nn], ring[n]], 2)
    prev = ring

mesh = bpy.data.meshes.new("OversizedTee_SewnQuadTopology")
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new("OversizedTee_ClothSource", mesh)
scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
for poly, mi in zip(mesh.polygons, mats):
    poly.material_index = mi
    poly.use_smooth = True
# Recalculate consistent outward normals without altering topology.
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
uv = mesh.uv_layers.new(name="ArtworkUV")
for poly in mesh.polygons:
    for li in poly.loop_indices:
        vi = mesh.loops[li].vertex_index
        x, h, d, tag = info[vi]
        # Primary source-art projection. Back horizontal reversal ensures text reads correctly.
        u = .5 + (x if poly.material_index != 1 else -x)/1.13
        v = .10 + h/.915
        uv.data[li].uv = (u, v)

def material(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = .86
    p.inputs["Metallic"].default_value = 0
    p.inputs["Sheen Weight"].default_value = .025
    p.inputs["Sheen Roughness"].default_value = .68
    return m
for name in ("FabricFront", "FabricBack", "FabricTrim"):
    mesh.materials.append(material(name, (.12,.13,.15)))

# Weighted shoulder/collar suspension; low spring support keeps this an empty display tee.
pins = obj.vertex_groups.new(name="ShoulderSupport")
for i, (x,h,d,tag) in enumerate(info):
    w = .015
    if h > .585:
        w = .22+.78*min(1, (h-.585)/.075)
    elif h > .48:
        w = .025+.195*(h-.48)/.105
    if tag == "collar":
        w = 1
    if tag == "sleeve":
        w *= .25
    pins.add([i], w, "REPLACE")

cloth = obj.modifiers.new("PhysicalCotton_Cloth", "CLOTH")
cs = cloth.settings
cs.quality = 9
cs.mass = .24
cs.tension_stiffness = 32
cs.compression_stiffness = 32
cs.shear_stiffness = 18
cs.bending_stiffness = .38
cs.tension_damping = 7
cs.compression_damping = 7
cs.shear_damping = 7
cs.bending_damping = .8
cs.air_damping = 4
cs.vertex_group_mass = pins.name
cs.pin_stiffness = 12
cs.effector_weights.gravity = 1
cloth.collision_settings.use_self_collision = True
cloth.collision_settings.self_distance_min = .0025
cloth.collision_settings.self_friction = 5
cloth.collision_settings.collision_quality = 4
cloth.point_cache.frame_start = 1
cloth.point_cache.frame_end = 150
sub = obj.modifiers.new("CottonSmoothSurface", "SUBSURF")
sub.levels = sub.render_levels = 1
thick = obj.modifiers.new("FabricThickness_1p2mm", "SOLIDIFY")
thick.thickness = .0012
thick.offset = 0
thick.use_even_offset = True
thick.material_offset = 2
thick.material_offset_rim = 2

# A low, varying cross breeze creates secondary folds in the hanging cloth.
bpy.ops.object.effector_add(type="WIND", location=(-1, -1, .0))
wind = bpy.context.object
wind.name = "GentleCrossBreeze"
direction = Vector((.35, .85, .06))
wind.rotation_euler = direction.to_track_quat("Z","Y").to_euler()
wind.field.noise = .6
for f, strength in ((1,.6),(25,1.7),(49,.5),(73,2.2),(97,.8),(121,1.8),(145,.6)):
    wind.field.strength = strength*7
    wind.field.keyframe_insert("strength", frame=f)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("NavyStudioWorld")
scene.world.color = (.12,.12,.12)
world = scene.world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.035,.055,.10,1)
world.node_tree.nodes["Background"].inputs[1].default_value = .55
scene.view_settings.view_transform = "AgX"
def area(name, loc, power, color, size):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.object
    o.name = name
    o.data.energy = power
    o.data.color = color
    o.data.shape = "DISK"
    o.data.size = size
    o.rotation_euler = (Vector((0,0,0))-o.location).to_track_quat("-Z","Y").to_euler()
area("SoftboxKey",(-1.1,-1.4,1.4),70,(.83,.90,1),1.3)
area("SoftboxFill",(1.2,-.4,.4),40,(.6,.75,1),1.1)
area("RearRim",(.7,.9,.9),75,(.32,.48,1),.9)
bpy.ops.object.camera_add(location=(.35,-1.65,.18))
camera = bpy.context.object
camera.name = "InspectionCamera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1.27
scene.camera = camera

def frame_camera(loc):
    camera.location = loc
    camera.rotation_euler = (Vector((0,0,-.015))-camera.location).to_track_quat("-Z","Y").to_euler()

def render(name, loc):
    frame_camera(loc)
    scene.render.filepath = str(OUT/name)
    bpy.ops.render.render(write_still=True)
    print("RENDER", name, flush=True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"garment-source.blend"))

if PREVIEW:
    # Short representative supported animation before the full sequential bake.
    samples = {}
    for f in range(1, 22):
        scene.frame_set(f)
        dep = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dep)
        me = ev.to_mesh()
        if f in (1,21):
            samples[f] = np.array([v.co[:] for v in me.vertices], dtype=np.float32)
            if f == 1:
                export_mesh = me.copy()
        ev.to_mesh_clear()
        if f%5 == 0:
            print("SMOKE FRAME",f,round(time.time()-START,1),flush=True)
    obj.hide_render = True
    obj.hide_set(True)
    hero = bpy.data.objects.new("OversizedTee", export_mesh)
    scene.collection.objects.link(hero)
    hero.shape_key_add(name="Basis")
    sk = hero.shape_key_add(name="ClothPreview")
    sk.data.foreach_set("co", samples[21].ravel())
    for f,val in ((1,0),(25,1),(49,0)):
        sk.value = val
        sk.keyframe_insert("value",frame=f)
    hero.data.shape_keys.animation_data.action.name = "ClothPreview"
    scene.frame_end = 49
    scene.frame_set(1)
    render("preview-front.png",(0,-1.8,.08))
    render("preview-side.png",(1.65,-.55,.12))
    for x in bpy.context.selected_objects:
        x.select_set(False)
    hero.select_set(True)
    bpy.context.view_layer.objects.active = hero
    bpy.ops.export_scene.gltf(filepath=str(OUT/"tee-preview.glb"),export_format="GLB",
        use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
        export_morph=True, export_morph_normal=True, export_skins=False,
        export_materials="EXPORT", export_yup=True)
    print("PREVIEW COMPLETE",len(export_mesh.vertices),len(export_mesh.polygons),flush=True)
    sys.exit(0)

# Sequential cloth evaluation retains vertex correspondence through subdivision/thickness.
sample_frames = list(range(49,146,12))
states = []
for f in range(1,146):
    scene.frame_set(f)
    dep = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dep)
    me = ev.to_mesh()
    if f in sample_frames:
        states.append(np.array([v.co[:] for v in me.vertices], dtype=np.float32))
        if len(states) == 1:
            export_mesh = me.copy()
    ev.to_mesh_clear()
    if f%12 == 0 or f in sample_frames:
        print("CLOTH FRAME", f, "SECONDS", round(time.time()-START,1), flush=True)
np.savez_compressed(OUT/"cloth-sampled-positions.npz", frames=sample_frames, positions=np.array(states))
obj.hide_render = True
obj.hide_set(True)
hero = bpy.data.objects.new("OversizedTee", export_mesh)
scene.collection.objects.link(hero)
hero.shape_key_add(name="Basis")
for i,state in enumerate(states):
    sk = hero.shape_key_add(name=f"ClothPose_{i:02d}")
    sk.data.foreach_set("co",state.ravel())
    for step in range(len(states)+1):
        sk.value = 1 if step%len(states) == i else 0
        sk.keyframe_insert("value", frame=1+step*120/len(states))
action = hero.data.shape_keys.animation_data.action
action.name = "ClothIdle"
# Smooth interpolation within sampled physical poses, with identical start/end weights.
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                for key in fc.keyframe_points:
                    key.interpolation = "BEZIER"
                    key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
scene.frame_start = 1
scene.frame_end = 121
scene.frame_set(1)
for x in bpy.context.selected_objects:
    x.select_set(False)
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
# Plain cotton materials export as replaceable slots; source mockups stay external.
bpy.ops.export_scene.gltf(filepath=str(WEB/"oversized-tee.glb"),export_format="GLB",
    use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
    export_morph=True, export_morph_normal=True, export_skins=False,
    export_materials="EXPORT", export_yup=True)

def add_reference_photo(mat, filename):
    tree = mat.node_tree
    p = tree.nodes.get("Principled BSDF")
    image = tree.nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(str(ROOT/"design/source-assets"/filename))
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[1].default_value = (.012,.012,.013,1)
    tree.links.new(image.outputs["Alpha"],mix.inputs[0])
    tree.links.new(image.outputs["Color"],mix.inputs[2])
    tree.links.new(mix.outputs[0],p.inputs["Base Color"])
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 750
    noise.inputs["Detail"].default_value = 1
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .12
    bump.inputs["Distance"].default_value = .00022
    tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"],p.inputs["Normal"])
add_reference_photo(hero.data.materials[0],"tren-lisa.png")
add_reference_photo(hero.data.materials[1],"back-black.png")
hero.data.materials[2].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.013,.014,.016,1)
for name, frame, loc in [
    ("front-cloth-01.png",1,(0,-1.8,.06)),
    ("three-quarter-cloth-01.png",1,(1.2,-1.7,.22)),
    ("side-cloth-01.png",1,(1.8,-.04,.10)),
    ("back-cloth-01.png",1,(0,1.8,.08)),
    ("front-cloth-61.png",61,(0,-1.8,.06)),
    ("three-quarter-cloth-91.png",91,(1.2,-1.7,.22))]:
    scene.frame_set(frame)
    render(name,loc)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"garment-baked-cloth.blend"))

bounds_min = np.min(np.array(states),axis=(0,1))
bounds_max = np.max(np.array(states),axis=(0,1))
contract = {
    "asset": "oversized-tee.glb", "source": "design/garment-3d/garment-baked-cloth.blend",
    "blenderVersion": bpy.app.version_string, "units": "meters",
    "axes": {"up":"+Y","front":"+Z","right":"+X"},
    "pivot": "approximate garment center; undeformed hem at y=-.42",
    "materials": ["FabricFront","FabricBack","FabricTrim"],
    "uv": {"imageSize":[1122,1402],"front":"u=.5+x/.8362; Blender v=.10+(y/1.12+.375)/.915",
           "back":"u=.5-x/.8362; Blender v=.10+(y/1.12+.375)/.915",
           "gltfTextureFlipY":False,"sourceImages":"Unmodified original full-frame mockups",
           "requirement":"Opaque material, alpha composite source RGB over matching cotton color"},
    "clip": {"name":"ClothIdle","durationSeconds":5,"frames":[1,121],
             "morphTargets":len(states),"loop":"identical endpoint weights; smooth interpolation",
             "simulationSampleFrames":sample_frames},
    "geometry": {"simulationVertices":len(mesh.vertices),"simulationFaces":len(mesh.polygons),
                 "exportVerticesBeforeUVSplits":len(export_mesh.vertices),
                 "exportFaces":len(export_mesh.polygons),"thicknessMeters":.0012,
                 "dimensionsXYZMeters":[float(bounds_max[0]-bounds_min[0]),
                                         float(bounds_max[2]-bounds_min[2]),
                                         float(bounds_max[1]-bounds_min[1])]},
    "simulation": {"solver":"Blender Cloth","quality":9,"selfCollision":True,
                   "support":"Weighted shoulder and collar suspension","gravityMS2":1.4,
                   "note":"Offline physical cloth samples replayed as morphs; not live browser physics"},
    "provenance": {"mesh":"Original authored project garment geometry",
                   "artwork":"Existing user-supplied project mockups; source files unchanged",
                   "license":"No third-party model purchased or downloaded; artwork rights not independently verified"},
    "limits": ["Approximate dimensions inferred from photo, no measurement specification supplied",
               "Source mockups contain baked lighting/folds; source print layers were unavailable",
               "Side, inside and trim are modeled interpretations of supplied front/back views",
               "The 5-second loop interpolates physical samples and joins last sample to first"],
    "evidence": ["front-cloth-01.png","three-quarter-cloth-01.png","side-cloth-01.png",
                 "back-cloth-01.png","front-cloth-61.png","three-quarter-cloth-91.png"],
    "bytes": (WEB/"oversized-tee.glb").stat().st_size,
}
(WEB/"garment-contract.json").write_text(json.dumps(contract,indent=2)+"\n")
(OUT/"authoring-contract.json").write_text(json.dumps(contract,indent=2)+"\n")
print("COMPLETE",json.dumps(contract["geometry"]),contract["bytes"],round(time.time()-START,1),flush=True)
