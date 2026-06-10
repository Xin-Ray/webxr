# Lab 1 Writeup — Hello WebXR (Tap-to-Place glTF)

**Live URL:** https://xin-ray.github.io/webxr/
**Repository:** https://github.com/Xin-Ray/webxr
**Demo video:** `demo.mp4` (recorded on device — see "Recording the demo" below)

## What it does

A WebXR experience built with Vite + Three.js:

- **In a normal browser** it renders a rubber-duck glTF model on a dark ground
  plane. The duck slowly spins, and you can drag to orbit the camera.
- **On an AR-capable device** (Quest 2/3/Pro, Android + ARCore, or the iOS
  WebXR Viewer app) tapping the **AR** button enters an immersive session. A
  white reticle tracks real surfaces via WebXR hit-testing; tapping places the
  duck on the surface under the reticle. Tap again to move it.

## What I changed from the starter

The starter rendered a rotating blue cube. For Lab 1 I:

1. **Replaced the cube with a glTF model** — a rubber duck
   (`public/models/Duck.glb`, the Khronos sample asset, ~120 KB). It is loaded
   asynchronously with Three.js `GLTFLoader`.
2. **Normalised the model on load** — the raw Duck is ~1.7 m tall and centred on
   its own origin. After loading I measure its bounding box, scale it uniformly
   to a tabletop-friendly 0.2 m, and shift it so its feet sit at the parent
   group's origin (`y = 0`). Placing the group on a surface then lands the duck
   *on* that surface rather than half-sunk into it.
3. **Kept the model in a parent `Group`** so the rest of the code (idle spin, the
   `select` tap handler) can reference it immediately, before the async load
   finishes.
4. **Tap-to-place** — on the XR `select` event, if the reticle is showing a
   valid surface, the duck group snaps to the reticle's position and is made
   visible.
5. **AR session polish** — the duck is hidden when an AR session starts (a model
   floating at desktop eye height looks wrong in a real room) and only appears
   after the first placement. On session end the desktop/orbit view is restored.

## How it works (technical notes)

- **Hit-testing:** on `sessionstart` the app requests a `viewer` reference space,
  creates a hit-test source from it, and requests a `local` space to read poses
  in. Each XR frame, the first hit-test result drives the reticle's transform
  matrix (with `matrixAutoUpdate = false` so Three.js doesn't overwrite it).
- **Transparent canvas:** the `WebGLRenderer` uses `alpha: true` so the device
  camera feed shows through in AR. `renderer.xr.enabled = true` lets Three.js
  drive the WebXR session.
- **Desktop fallback:** `OrbitControls` provides drag-to-orbit when not in XR.
  The `AR` button greys out (shows "AR NOT SUPPORTED") on hardware without AR —
  expected on a desktop browser.
- **Single render loop:** `setAnimationLoop` receives an `XRFrame` only inside an
  XR session; outside XR the hit-test block is skipped and it just renders the
  spinning duck.

## Build & deploy

- `npm install && npm run dev -- --host` for local dev (HTTPS via
  `@vitejs/plugin-basic-ssl`, required by WebXR).
- `npm run build` produces `dist/`. The `public/models/Duck.glb` asset is copied
  into `dist/models/` automatically, so the model ships with the build.
- Deployed to **GitHub Pages** via the included
  `.github/workflows/deploy.yml`, which runs `npm ci && npm run build` and
  publishes `dist/` on every push to `main`. `base: './'` in `vite.config.js`
  gives relative asset URLs so it works from the `…github.io/webxr/` sub-path.

## Testing done

- `npm run build` compiles cleanly (10 modules, ~590 KB JS / 149 KB gzipped).
- Rendered the desktop view in headless Chrome (SwiftShader WebGL) to confirm the
  duck loads, is correctly scaled, and sits on the ground plane.
- AR hit-test / tap-to-place must be verified on a real device (see below).

## Recording the demo

The AR flow only runs on real hardware. To record `demo.mp4`:

1. Open the live URL (or the local HTTPS dev URL) on a Quest or an Android
   Chrome device. See the README for USB port-forwarding / tunnel options.
2. Tap **AR**, point at a flat surface until the reticle appears, and tap to
   place the duck. Move around to show it staying anchored.
3. Use the device's screen recorder (Quest: built-in recorder; Android: system
   screen recording) and export as `demo.mp4`.

## Known limitations

- iOS Safari has no WebXR support; the WebXR Viewer app is required on iOS.
- The duck does not cast shadows and uses scene lighting rather than AR
  light-estimation, so it won't match room lighting precisely.
- Each tap repositions the single duck; there is no multi-object placement.
