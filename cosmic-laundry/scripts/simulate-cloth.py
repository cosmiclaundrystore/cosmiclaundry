"""Offline position-based cloth settlement for the browser's original garment meshes.
Distance constraints preserve sewn panels; previous garments form a collision surface.
No photos, image generation, or videos are involved in the browser rendering.
"""
import json,numpy as np,time,pathlib
start=time.time();shapes=json.load(open('.sites-runtime/cloth-input.json'))
resolution=100;extent=2.4;step=2*extent/(resolution-1);floor=-1.49
height=np.full((resolution,resolution),floor,dtype=np.float32)
output=[];meta=[]
def sample(pos):
 ix=np.clip((pos[:,0]+extent)/step,0,resolution-1.01);iz=np.clip((pos[:,2]+extent)/step,0,resolution-1.01)
 a=ix.astype(int);b=iz.astype(int);u=ix-a;v=iz-b
 return height[a,b]*(1-u)*(1-v)+height[a+1,b]*u*(1-v)+height[a,b+1]*(1-u)*v+height[a+1,b+1]*u*v
for garment,s in enumerate(shapes):
 pos=np.array(s['positions'],dtype=np.float32).reshape(-1,3);faces=np.array(s['indices'],dtype=np.int32).reshape(-1,3)
 edges=np.unique(np.sort(np.vstack([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1),axis=0)
 lengths=np.linalg.norm(pos[edges[:,0]]-pos[edges[:,1]],axis=1)
 # Edge colouring permits vectorised Gauss-Seidel constraints without shared writes.
 used=[set() for _ in pos];batches=[]
 for e,(a,b) in enumerate(edges):
  forbidden=used[a]|used[b];c=0
  while c in forbidden:c+=1
  if c==len(batches):batches.append([])
  batches[c].append(e);used[a].add(c);used[b].add(c)
 batches=[np.array(b,np.int32) for b in batches]
 velocity=np.zeros_like(pos);dt=1/60
 # Raise the whole garment only enough to avoid spawning inside earlier layers.
 pos[:,1]+=max(0,float(np.max(sample(pos)+.012-pos[:,1])))+.10
 for frame in range(140 if garment<7 else 160):
  old=pos.copy();velocity[:,1]-=4.8*dt;pos+=velocity*dt
  for iteration in range(5):
   for batch in batches:
    a=edges[batch,0];b=edges[batch,1];delta=pos[b]-pos[a];dist=np.linalg.norm(delta,axis=1)
    correction=delta*((dist-lengths[batch])/np.maximum(dist,1e-7)*.46)[:,None]
    pos[a]+=correction;pos[b]-=correction
   ground=sample(pos)+.009;contact=pos[:,1]<ground;pos[contact,1]=ground[contact]
  velocity=(pos-old)/dt;velocity*=.84;velocity[contact,0]*=.7;velocity[contact,2]*=.7
 # Rasterise each triangle into the collision field for the next garment.
 for triangle in faces:
  verts=pos[triangle];xz=verts[:,[0,2]]
  lo=np.maximum(0,np.floor((xz.min(0)+extent)/step).astype(int));hi=np.minimum(resolution-1,np.ceil((xz.max(0)+extent)/step).astype(int))
  if np.any(lo>hi):continue
  x,z=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1),indexing='ij');px=x*step-extent;pz=z*step-extent
  a,b,c=xz;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-8:continue
  wa=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(pz-c[1]))/den;wb=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(pz-c[1]))/den;wc=1-wa-wb;inside=(wa>=-.02)&(wb>=-.02)&(wc>=-.02)
  values=wa*verts[0,1]+wb*verts[1,1]+wc*verts[2,1]
  xx=x[inside];zz=z[inside];height[xx,zz]=np.maximum(height[xx,zz],values[inside])
 inverse=np.array(s['inverse']).reshape(4,4).T;local=(np.column_stack([pos,np.ones(len(pos))])@inverse.T)[:,:3].astype('<f4')
 offset=sum(a.nbytes for a in output);output.append(local);meta.append({'detail':s['detail'],'color':s['color'],'vertexCount':len(pos),'byteOffset':offset,'byteLength':local.nbytes})
 print('Settled garment',garment+1,'vertices',len(pos),'bounds',pos.min(0).round(3),pos.max(0).round(3),'elapsed',round(time.time()-start),flush=True)
pathlib.Path('dist/3d/mona-cloth.bin').write_bytes(b''.join(x.tobytes() for x in output))
pathlib.Path('dist/3d/mona-cloth.json').write_text(json.dumps({'method':'Offline position-based cloth settlement; real 3D geometry rendered interactively with Three.js','garments':meta},indent=2)+'\n')
print('Cloth cache saved',sum(x.nbytes for x in output),'bytes',round(time.time()-start),'seconds',flush=True)
