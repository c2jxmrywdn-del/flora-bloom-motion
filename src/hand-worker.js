import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let landmarker = null;
let busy = false;

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type === 'init') {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
      );
      const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath, delegate: 'GPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      } catch (gpuError) {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath, delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      }
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: error?.message || 'Could not load the hand landmark model.' });
    }
    return;
  }
  if (data.type === 'frame' && landmarker && !busy) {
    busy = true;
    const bitmap = data.bitmap;
    const timestamp = data.timestamp;
    const started = performance.now();
    try {
      const result = landmarker.detectForVideo(bitmap, timestamp);
      const points = result?.landmarks?.[0] || null;
      const handCategory = result?.handedness?.[0]?.[0] || result?.handedness?.[0] || null;
      self.postMessage({
        type: 'result',
        points,
        confidence: Number(handCategory?.score ?? 0),
        handedness: handCategory?.categoryName || 'Unknown',
        latency: performance.now() - started,
        timestamp,
      });
    } catch (error) {
      self.postMessage({ type: 'frame-error', message: error?.message || 'Frame analysis failed.' });
    } finally {
      bitmap?.close?.();
      busy = false;
    }
  } else if (data.type === 'frame') {
    data.bitmap?.close?.();
  }
};