# Mona Lisa 3D Laundry prototype

Historical prototype notes. The current production garment viewer supersedes this implementation; see the volumetric-garment entry in `build-review.md` and `dist/3d/garment-contract.json`.

This version changes only the Mona Lisa preview surface on the home page. All six cards retain their existing order, dimensions, captions and routes. The other five previews await approval of this first prototype.

The live experience uses locally hosted Three.js 0.180.0 and GSAP 3.13.0. A connected front/back oversized garment mesh includes sleeves, sewn side/shoulder edges and an attached neckline band. Seven garments plus the featured shirt form one concentrated heap. Cotton bump mapping, physical sheen, studio environment lighting and real-time shadows are rendered in WebGL.

The resting vertices are baked by the offline position-based cloth solver in scripts/simulate-cloth.py. It preserves edge distances and settles successive garments against a collision height field of the previous garments. This is an approximate cloth solver, not Blender or a garment-manufacturing simulation. Blender installation was attempted but its download was stopped because of slow transfer. No Blender result is claimed.

The featured mesh blends from the settled pose through curved sleeve/body folding into its full shape. GSAP coordinates the rise, camera dolly, rotation, unfolding and reverse. Mouse exit returns it to the heap. Focus and Enter support keyboard operation; touch uses reveal then select. A Three.js raycast selects the actual shirt. Scene resources and tweens are disposed on route changes. Pixel ratio is capped, and off-screen/hidden scenes pause. Reduced-motion and the existing motion toggle produce an immediate stable reveal.

The source artwork configuration is dist/3d/mona-artwork.json. Its src is deliberately null until the user supplies the exact reference. When set, the original image becomes a front-only texture in the garment shader, keeping the source file, its aspect ratio and its original image data. The back stays plain. No substitute Mona Lisa artwork has been applied.

Checks: topology/triangle validity, finite positions and normals across folding, fold reversibility, concentrated pile bounds, binary cache counts, and the pending-artwork configuration. Offline model renders check the poses, not the production browser. Interactive browser QA and device performance remain unverified because the supported managed browser QA capability is unavailable.

To rebuild the cloth cache:
1. npm install (or the Sites dependency helper).
2. npm run prepare:3d
3. node scripts/prepare-cloth-simulation.mjs
4. python scripts/simulate-cloth.py (NumPy required)
5. npm run check:3d

Publishing uses the existing Sites project and preserves its owner-private audience. Shopify is not used.


## Renderer recovery (version 7)
The user screenshot verified that the client reached the previous error handler and showed the old cover image. The specific WebGL exception was not available from the screenshot or server logs. Added a Canvas 2D software projection of the same settled 3D mesh as a fallback when WebGL initialization throws. It has reduced mesh detail and lighting, supports unfold/retract and navigation, and is not visually equivalent to the GPU renderer. No video or static replacement is used. Exact reference artwork remains pending. The software path has been exercised with a native Canvas harness through drawing, unfolding and navigation, but this is not an in-browser test. Browser performance and the user’s specific failure require browser verification. Old cover artwork no longer disguises initialization errors. Entry script/styles are versioned.
