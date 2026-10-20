# FLORA — Bloom in Motion

> **Live website:** [flora-gesture-garden.lovable.app](https://flora-gesture-garden.lovable.app/)

[Open the live garden ↗](https://flora-gesture-garden.lovable.app/)

An interactive 3D botanical experience built with Three.js and MediaPipe Tasks Vision Hand Landmarker. The app runs its hand-landmark model in a dedicated browser worker and sends only landmark measurements to the renderer; it does not upload or store camera frames.

## Run locally

Requires Node.js 20+ and an internet connection for the first dependency install and for the pinned MediaPipe WASM/model assets.

```bash
npm install
npm run dev
```

Open the HTTPS deployment or the `http://localhost:5173` development URL. Camera APIs require a secure context (`localhost` is allowed). Click **Activate hand tracking** and grant browser camera permission. The live guide card advances through permission, model loading, hand placement and live gesture tips; it shows a progress meter and context-sensitive coaching in English or Chinese.

## Controls

- **Open palm mode:** finger extension maps continuously to flower bloom. The live guide explains whether to spread or fold fingers based on the current tracking signal.
- **Pinch mode:** thumb–index pinch distance maps continuously to bloom; the live guide tells you how to adjust thumb/index distance.
- **Shortcuts mode:** hold a fist to close; open palm to bloom; V sign to change environment; thumb-up toggles pollen; swipe left/right switches flowers. The live guide names the gesture it sees and describes the expected action.
- **Manual mode / Demo Gesture:** controls the same animated petal geometry without camera access.
- Drag on the 3D flower to rotate; X/Y/Z sliders set exact object rotation; mouse wheel zooms.
- Arrow keys switch flowers; Space toggles bloom; R resets rotation; keys 1–4 switch environments.

## ML notes

The `src/hand-worker.js` module loads the pinned `@mediapipe/tasks-vision@0.10.22` WASM package and the public Hand Landmarker task asset, then performs video-mode inference from transferable `ImageBitmap` frames. GPU delegate initialization falls back to CPU if it fails. The app applies temporal gesture confirmation and exponential smoothing to derived hand features. Inference latency depends on hardware and browser; the target is approximately 25 inference frames per second, not a guaranteed fixed rate.

## 3D notes and limits

Flowers are articulated procedural 3D meshes so petal motion is deterministic and editable. The four environments are procedural stage treatments. A real 3D Gaussian Splatting asset is **not** included; the UI marks the splat environment as optional/not loaded. Petal arrangements are layered to reduce visible clipping, but this is not a collision-simulated botanical model and cannot guarantee zero interpenetration at every rotation/opening state.

## Deploy

Build with `npm run build`; publish the generated `dist/` directory to Cloudflare Pages, Vercel, or any static HTTPS host. There is no server, database, analytics tracker, or paid API requirement. The Google Fonts stylesheet is optional cosmetic styling.

## Camera and gesture guidance

The browser asks for camera access only after **Activate hand tracking** is clicked. The preview draws the detected 21-point hand skeleton and updates the recognition confidence, inference latency and FPS. The live guide is state-aware: it explains permission steps, model loading, how to position the hand, how to use Open Palm and Pinch modes, shortcut gestures, and recovery steps for denied permissions or a failed model load. Camera tracks are released by **Stop camera** or when leaving the page. In Manual mode, the camera can remain on for viewing but is not used to drive the bloom.