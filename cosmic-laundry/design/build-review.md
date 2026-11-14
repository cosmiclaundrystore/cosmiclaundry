# Cosmic Laundry build review

## Volumetric garments and 360-degree cloth update — 20 October 2026

This update supersedes the photo-based showroom described in the historical entries below. The existing midnight-blue theme and all eight original designs remain. Homepage and Laundry featured stages now load an authored, full-volume garment mesh, with open neckline, sleeve cuffs, hem, interior thickness, and separate front/back material regions. Every product opens the same interactive geometry in its product viewer; the original image remains accessible through Photo detail.

The garment uses a Blender-authored cloth simulation baked into a looping GLB morph animation. Sampled motion is art-directed with a tapered amplitude increase below the supported shoulders, making the lower fabric movement visible while preserving the printed chest. The browser plays these deformations and allows continuous full-turn rotation; it does not solve cloth physics or simulate grabbing fabric live. The geometry is a visual reconstruction from supplied photographs, not a measured production pattern. Original product image files are used without repainting. Shared color-matched back references retain their provenance label.

Controls include unrestricted horizontal drag, restrained vertical tilt, left/right 90-degree turns, Front and Back shortcuts, automatic full rotation, and a local motion pause. Keyboard arrows, Home and End provide equivalent views. Global pause and reduced-motion preferences stop automatic rotation and cloth playback while keeping manual inspection available.

Runtime loads one reusable GLB, owns each view's material/texture instances, cancels stale product texture loads, and releases modal resources on close. The original photo stays visible until the complete 3D view is ready, and returns if WebGL or asset loading fails. Hidden tabs, offscreen stages, and background views behind dialogs suspend their render loop.

Source: `scripts/build-garment.py`, `design/garment-3d/`, and `dist/3d/garment-contract.json`. Runtime: `dist/showroom.js`, `dist/3d/garment-runtime.js`, and pinned Three.js r180 loader helpers.

Final asset: 3,954,276 bytes, 28,672 triangles, three material primitives, nine morph targets per primitive, and a 5.0417-second clip with matching loop endpoints. Maximum sampled displacement after tapered art direction is 17.215 mm. Binary checks and Khronos glTF validation pass with zero errors or warnings. The saved Blender project uses relative artwork references; the post-bake amplification script is retained alongside the physical simulation samples.

Verified in installed Chrome 155: all eight original front maps and color-matched backs render on genuine volume; the baked clip and morph weights change over time; full 360-degree manual views work while motion is paused or reduced. Native mouse and emulated touch drag, pointer cancellation, lost capture, vertical touch scrolling, photo/3D mode switching, rapid selections, and repeated modal/route cleanup passed. A closed-dialog recreation issue found during resize testing was fixed and retested. Deliberately failed GLB, back texture, and WebGL initialization requests preserve usable original-photo inspection. No JavaScript page errors occurred in normal flows.

Verification limits: touch and responsive layouts were browser-emulated on the available Windows machine, not measured on a physical phone. The tab-visibility handler passed synthetic hidden/visible checks, but the headless browser kept the actual tab visible. No cross-browser compatibility, real-device frame-rate, manufacturing-dimension, or live-cloth-physics claim is made.

## Midnight theme and orbital showroom update — 20 October 2026

Updated the existing Site with a consistent deep-blue palette, locally hosted Space Grotesk and Instrument Serif, the supplied white logo, brighter garment stages, and matching product and bag dialogs. All seven Laundry identities and original product photographs are preserved.

The new optional showroom loads the existing locally vendored Three.js module. Real 3D rings and orbiting points surround the garment photograph. Dragging or keyboard/button controls turn the photograph within a front-facing range of ±24 degrees; Front resets it, and Orbit controls automatic movement. Product changes use rotational entry/exit transitions. The garment itself remains the supplied photographic cutout, not a volumetric mesh or physically simulated cloth.

Runtime safeguards include one active showroom, bounded pixel ratio, a 30fps ceiling on the decorative WebGL render (independent of DOM interpolation), offscreen/tab/dialog suspension, full route cleanup, and an operable CSS fallback. No new package dependencies were added.

Verified in installed Chrome with Playwright: all seven routes and the homepage at 1440px and 390px widths, no document overflow or missing main garment images, rapid category and homepage selection, interrupted navigation, product inspection/back reference/zoom, search/filter/sort, keyboard focus, preview bag quantity/removal/undo/persistence, and mobile product/bag flows. Rotation bounds, keyboard reset, persistent global pause, and emulated reduced-motion behavior passed. Scene lifecycle checks covered offscreen suspension, context loss/restoration, and repeated route cleanup; the scene reported 5 draw calls, 4 geometries and 0 texture allocations. These are renderer diagnostics, not a physical-device performance benchmark.

Desktop and mobile screenshot review confirmed readable navy surfaces, distinct black garment silhouettes, preserved artwork and clear controls. The existing unconfirmed commerce data and missing Bugs Bunny artwork remain as described below.

Final focused checks verified native mouse dragging and release outside the garment, pointer cancellation, emulated touch dragging with vertical scrolling preserved, and reachable 44px controls at 390/768/1024/1440px. Native image dragging is suppressed, and touch capture transfer no longer cancels a gesture prematurely. A deliberately failed garment request left product actions usable, and the detail retry recovered when the request was restored. No JavaScript page errors were recorded.

## Previous build evidence

Reviewed 20 October 2026. Existing Site: `appgprj_6ac6a8478ec48191b3da48a4b9382578`.

## Implemented scope

- Seven themed Laundry routes, including Bad Influence and the artwork-pending Bugs Bunny page.
- Eight front designs from the latest ten attachments: three Mona Lisa designs, Megatron Griffin, Get Schwifty, BOBLIFTSCRAZY, Popeye, and A BUM. The other two attachments are shared black/white back references, clearly labelled as references.
- Original transparent garment sources retained separately from optimized WebP detail and thumbnail exports. Asset preparation verified unchanged detail alpha.
- Product-led floating cutout showroom, immediate product actions, selected-garment transitions, and consistent themed pages.
- Preview product inspection, artwork zoom, back references, pictured color, unconfirmed size preferences, local bag persistence, quantity editing, removal, undo, and copy selection.

## Verification evidence

Source review and validation:

- JavaScript parse checks passed for app, catalog, commerce, and motion.
- Catalog validation found exactly seven categories and eight front products, unique product IDs, valid category assignments and featured IDs, and existing image/detail/thumbnail/back-reference files.
- Product prices remain null; no sales ranking, stock, garment measurements or shipping claims were invented.
- Native dialogs, labelled controls, keyboard focus styling, skip navigation, and motion cleanup are present.
- Optimized active product/logo detail and thumbnail images total approximately 2.5 MB. Product cards use lazy-loaded thumbnails; the active main image loads eagerly.

The main implementation agent exercised the following in the cloud browser at the running Sites preview:

- All seven Laundry routes and their themes.
- Homepage featured selection and rapid Mona Lifta-to-Mona Splita category selection.
- Artwork zoom and the shared back-reference label.
- Preferred-size preview-bag saving, quantity changes, removal, undo, and localStorage persistence after reload.
- Search for Mona returning three designs, Bad Influence filter returning A BUM, and name sorting.
- Mouse interaction, keyboard ArrowRight/Enter/Escape, and the pause-motion control.
- Desktop page at 1363px without horizontal overflow; a 390px iframe responsive-layout check (375px content with scrollbar) without horizontal overflow.

Independent visual review inspected the resulting desktop showroom, mobile showroom, mobile Laundry grid, and mobile preview-bag screenshots. Garment artwork remained intact and proportionate, both black and white garments had usable background contrast, and controls were visible. The initial undersized mobile featured labels were replaced with a horizontal chooser using 12px labels. No blocking visual defect was found in those captures.

## Verification limits

- The mobile check used a narrow browser iframe, not a physical phone or a full touch-device emulation. Real-device touch performance and cross-browser behavior are not established.
- Reduced-motion handling was reviewed in code; the browser's operating-system reduced-motion preference was not emulated. The manual pause control was tested.
- Loading/error/retry and static fallback behavior were reviewed in code; a deliberately failed image/network request was not exercised in the browser.
- No numeric frame-rate, memory, Core Web Vitals or automated accessibility score is claimed.
- Presentation preserves the supplied photographic mockups with restrained perspective and depth. It is not a reconstructed volumetric garment, cloth simulation, or 360-degree model. A faithful garment mesh and print texture sources are needed for that extension.

## Remaining store dependencies

- The actual Bugs Bunny T-shirt artwork.
- Verified prices, size/color variants, stock, garment measurements and size chart.
- Payment/checkout integration and verified delivery, returns and contact information.
- Sales data before labelling featured selections as best sellers.

The bag is a local preview selection and does not reserve stock, place an order or take payment. Checkout is visibly unavailable. Shared back photos do not establish a unique confirmed back for every individual design.
