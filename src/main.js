// Lab 1 starter: a Three.js scene that renders in a normal browser and, on
// XR-capable devices, lets you tap to place an object on a real surface.
// Read top to bottom — setup, scene contents, then the per-frame loop.

import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene + camera. Camera starts at eye height (1.6 m) so the desktop view and
// the AR view roughly agree.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera.position.set(0, 1.6, 3);

// alpha: true keeps the canvas transparent so the camera feed shows through in
// AR. xr.enabled is what lets Three.js drive a WebXR session.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// The AR button enters the immersive session. 'hit-test' is required (no
// hit-test, no tap-to-place); the optional features degrade gracefully if the
// device lacks them. The button greys out on hardware with no AR support.
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['anchors', 'plane-detection', 'light-estimation'],
  }),
);

// Lighting. MeshStandardMaterial is unlit without a light in the scene.
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(1, 2, 1);
scene.add(dir);

// A stand-in floor for the desktop/orbit view. Hidden once an AR session
// starts, since the real room then provides the ground.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x202020 }),
);
ground.rotation.x = -Math.PI / 2;
ground.name = 'ground-fallback';
scene.add(ground);

// The placeable object (lab task 4): a glTF model loaded with GLTFLoader.
// `model` is a parent Group we move on tap; the loaded glTF is added inside it,
// pre-scaled and floor-aligned so it sits cleanly on whatever surface we place
// it on. The Group exists immediately so the rest of the code (rotation, tap
// handler) can reference it before the async load finishes.
const model = new THREE.Group();
model.position.set(0, 1, 0); // desktop view: float at eye height until placed
scene.add(model);

const TARGET_HEIGHT = 0.2; // metres — keep the duck a tabletop-friendly size
new GLTFLoader().load(
  'models/Duck.glb',
  (gltf) => {
    const duck = gltf.scene;

    // The raw Duck model is ~1.7 m tall and centred on its own origin. Measure
    // it, then scale uniformly to TARGET_HEIGHT and shift it up so its feet sit
    // at the group's origin (y = 0). Placing the group on a surface then lands
    // the duck on that surface instead of half-sunk into it.
    const box = new THREE.Box3().setFromObject(duck);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = TARGET_HEIGHT / size.y;
    duck.scale.setScalar(scale);
    duck.position.set(
      -center.x * scale,
      -box.min.y * scale, // bottom of the model to y = 0
      -center.z * scale,
    );

    model.add(duck);
  },
  undefined,
  (err) => console.error('Failed to load Duck.glb', err),
);

// The reticle marks where a tap would place the object. We drive its transform
// straight from the hit-test pose matrix, so matrixAutoUpdate is off to stop
// Three.js from overwriting it from position/rotation each frame.
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// Non-XR fallback (lab task 5): drag to orbit the scene on a desktop.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();

// In an XR session a 'select' event fires on tap / trigger. If the reticle is
// showing a valid surface, snap the model to that spot. We also copy the
// reticle's orientation so the duck stands upright on tilted surfaces.
const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (reticle.visible) {
    model.position.setFromMatrixPosition(reticle.matrix);
    model.visible = true;
  }
});
scene.add(controller);

// Set up once the session begins, torn down when it ends (next handler).
let hitTestSource = null;
let localSpace = null;

renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  ground.visible = false;
  // Hide the duck until the first tap places it on a real surface — a model
  // floating at desktop eye height looks out of place in the room.
  model.visible = false;
  // 'viewer' space tracks the device; casting a ray from it gives us the
  // hit-test source. 'local' is a fixed world frame we read placed poses in.
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  localSpace = await session.requestReferenceSpace('local');
});

renderer.xr.addEventListener('sessionend', () => {
  hitTestSource = null;
  localSpace = null;
  reticle.visible = false;
  ground.visible = true;
  // Restore the desktop/orbit view: duck back at eye height, visible again.
  model.position.set(0, 1, 0);
  model.visible = true;
});

// The render loop. WebXR passes an XRFrame; outside XR it's undefined, so the
// hit-test block is skipped and we just render the spinning cube.
renderer.setAnimationLoop((_time, frame) => {
  model.rotation.y += 0.01;

  if (frame && hitTestSource && localSpace) {
    // Ray from the device into the room; first result is the nearest surface.
    const results = frame.getHitTestResults(hitTestSource);
    if (results.length) {
      const pose = results[0].getPose(localSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    } else {
      reticle.visible = false; // no surface found this frame
    }
  }

  renderer.render(scene, camera);
});

// Keep the projection and canvas in sync with the window size.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
