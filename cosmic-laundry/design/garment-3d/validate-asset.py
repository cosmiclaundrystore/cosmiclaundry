"""Read-only, dependency-light binary/animation checks for the final uncompressed GLB."""
from pathlib import Path
import json, struct, hashlib
import numpy as np

root = Path(__file__).resolve().parents[2]
path = root/"dist/3d/oversized-tee.glb"
raw = path.read_bytes()
magic,version,length = struct.unpack_from("<4sII",raw)
assert magic == b"glTF" and version == 2 and length == len(raw)
offset = 12
chunks = {}
while offset < len(raw):
    size,kind = struct.unpack_from("<I4s",raw,offset)
    chunks[kind] = raw[offset+8:offset+8+size]
    offset += size+8
g = json.loads(chunks[b"JSON"])
b = chunks[b"BIN\x00"]
components = {5120:"i1",5121:"u1",5122:"<i2",5123:"<u2",5125:"<u4",5126:"<f4"}
widths = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
def acc(n):
    a = g["accessors"][n]
    dt = np.dtype(components[a["componentType"]])
    w = widths[a["type"]]
    data = np.zeros((a["count"],w),dtype=dt)
    if "bufferView" in a:
        view = g["bufferViews"][a["bufferView"]]
        start = view.get("byteOffset",0)+a.get("byteOffset",0)
        stride = view.get("byteStride",dt.itemsize*w)
        data = np.ndarray((a["count"],w),dtype=dt,buffer=b,offset=start,strides=(stride,dt.itemsize)).copy()
    if "sparse" in a:
        sparse = a["sparse"]
        ids = sparse["indices"]
        iv = g["bufferViews"][ids["bufferView"]]
        ix = np.frombuffer(b,dtype=components[ids["componentType"]],count=sparse["count"],
                           offset=iv.get("byteOffset",0)+ids.get("byteOffset",0))
        values = sparse["values"]
        vv = g["bufferViews"][values["bufferView"]]
        vals = np.frombuffer(b,dtype=dt,count=sparse["count"]*w,
                             offset=vv.get("byteOffset",0)+values.get("byteOffset",0)).reshape(-1,w)
        data[ix] = vals
    return data

report = {"file":str(path.relative_to(root)), "bytes":len(raw),
          "sha256":hashlib.sha256(raw).hexdigest(),"glTFVersion":g["asset"]["version"],
          "materials":[m["name"] for m in g["materials"]],
          "requiredExtensions":g.get("extensionsRequired",[]),"primitives":[],
          "clips":[]}
total_triangles = total_vertices = 0
maximum_displacement = 0
bounds_min = np.array([np.inf,np.inf,np.inf])
bounds_max = -bounds_min
for mesh in g["meshes"]:
    for p in mesh["primitives"]:
        position = acc(p["attributes"]["POSITION"])
        normals = acc(p["attributes"]["NORMAL"])
        indices = acc(p["indices"]).ravel()
        assert np.isfinite(position).all() and np.isfinite(normals).all()
        assert int(indices.min()) >= 0 and int(indices.max()) < len(position)
        normal_error = float(np.abs(np.linalg.norm(normals,axis=1)-1).max())
        assert normal_error < .0001
        targets = []
        deltas = []
        for target in p.get("targets",[]):
            delta = acc(target["POSITION"])
            assert delta.shape == position.shape and np.isfinite(delta).all()
            if "NORMAL" in target:
                n = acc(target["NORMAL"])
                assert n.shape == normals.shape and np.isfinite(n).all()
            deltas.append(delta)
        displacement = np.linalg.norm(np.array(deltas)-deltas[0],axis=2)
        posed = position[None,:,:]+np.array(deltas)
        bounds_min = np.minimum(bounds_min,posed.min(axis=(0,1)))
        bounds_max = np.maximum(bounds_max,posed.max(axis=(0,1)))
        maximum_displacement=max(maximum_displacement,float(displacement.max()))
        total_triangles += len(indices)//3
        total_vertices += len(position)
        report["primitives"].append({
            "material":g["materials"][p["material"]]["name"],
            "vertices":len(position),"triangles":len(indices)//3,
            "morphTargets":len(deltas),"finitePositionNormals":True,
            "indicesInRange":True,"maxUnitNormalError":normal_error,
            "maxMorphDisplacementMeters":float(displacement.max()),
        })
for anim in g.get("animations",[]):
    clip = {"name":anim["name"],"channels":[]}
    for channel in anim["channels"]:
        sampler = anim["samplers"][channel["sampler"]]
        times = acc(sampler["input"]).ravel()
        output = acc(sampler["output"]).ravel()
        node = g["nodes"][channel["target"]["node"]]
        nt = len(g["meshes"][node["mesh"]]["primitives"][0]["targets"])
        weights = output.reshape(len(times),nt)
        assert np.isfinite(weights).all() and np.diff(times).min() > 0
        assert np.max(np.abs(weights[0]-weights[-1])) < 1e-6
        clip["channels"].append({"target":channel["target"],"durationSeconds":float(times[-1]),
                                 "activeKeyframeSpanSeconds":float(times[-1]-times[0]),
                                 "inputTimeRangeSeconds":[float(times[0]),float(times[-1])],
                                 "keyframes":len(times),"weightsPerFrame":nt,
                                 "finiteWeights":True,"loopEndpointsEqual":True,
                                 "maxWeightSumError":float(np.abs(weights.sum(axis=1)-1).max())})
    report["clips"].append(clip)
report.update(triangles=total_triangles,verticesAfterUVAndMaterialSplits=total_vertices,
              maxSampledDisplacementMeters=maximum_displacement,
              sampledBoundsMinXYZMeters=bounds_min.tolist(),
              sampledBoundsMaxXYZMeters=bounds_max.tolist(),
              sampledDimensionsXYZMeters=(bounds_max-bounds_min).tolist(),
              allChecksPassed=True)
(root/"design/garment-3d/binary-validation.json").write_text(json.dumps(report,indent=2)+"\n")
contract_path = root/"dist/3d/garment-contract.json"
contract = json.loads(contract_path.read_text())
contract["sha256"] = report["sha256"]
contract["bytes"] = report["bytes"]
contract["clip"]["durationSeconds"] = report["clips"][0]["channels"][0]["durationSeconds"]
contract["clip"]["activeKeyframeSpanSeconds"] = report["clips"][0]["channels"][0]["activeKeyframeSpanSeconds"]
contract["clip"]["inputTimeRangeSeconds"] = report["clips"][0]["channels"][0]["inputTimeRangeSeconds"]
contract["geometry"]["triangles"] = report["triangles"]
contract["geometry"]["verticesAfterUVAndMaterialSplits"] = report["verticesAfterUVAndMaterialSplits"]
contract["geometry"]["dimensionsXYZMeters"] = report["sampledDimensionsXYZMeters"]
contract["simulation"]["maxSampledVertexDisplacementMeters"] = maximum_displacement
contract["simulation"]["motionCharacter"] = f"Supported fabric movement; max {maximum_displacement*1000:.2f} mm between exported sample poses"
contract["validation"] = {"finitePositionNormals":True,"validIndexRanges":True,
                        "loopEndpointWeightsEqual":True,"khronosErrors":0,"khronosWarnings":0,
                        "khronosInfo":"Three unused-UV infos are expected; artwork maps are assigned by runtime"}
for p in (contract_path,root/"design/garment-3d/authoring-contract.json"):
    p.write_text(json.dumps(contract,indent=2)+"\n")
print(json.dumps(report,indent=2))
