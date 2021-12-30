import { Mesh } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import drawingUtils from '@mediapipe/drawing_utils';
import { FACEMESH_FACE_OVAL, FACEMESH_LEFT_EYE, FACEMESH_LEFT_EYEBROW, FACEMESH_LIPS, FACEMESH_RIGHT_EYE, FACEMESH_RIGHT_EYEBROW, FACEMESH_TESSELATION, HAND_CONNECTIONS, Holistic, NormalizedLandmark, POSE_CONNECTIONS, POSE_LANDMARKS, POSE_LANDMARKS_LEFT, POSE_LANDMARKS_RIGHT, Results } from '@mediapipe/holistic';
import { useEffect } from 'react';
import Subscription from '../../util/subscriptionUtil';
import { Capturer } from './capturer';
import { captureFace } from './face';

export const FaceCaptureDimensions = { width: 1280, height: 720 };

// TODO convert these into number arrays
export type SkeletonUpdate = Array<{
  n: string; // bone name
  p?: Vector; // Deprecated position
  r?: Vector;  // Deprecated euler rotation
  q?: Quater; // Rotation (Quaternion)
  s?: number; // Scaling length
}>;

export interface Body {
  skeleton: SkeletonUpdate,
  face?: Face,
  webcamCanvasRef?: React.RefObject<HTMLCanvasElement>;
}
export interface Vector { x: number, y: number, z: number };
export interface Quater { x: number, y: number, z: number, w: number };
export interface Face {
  mesh: {
    positions: Array<number>;
    normals: Array<number>;
  },
  texture?: {
    uvs: Array<number>;
    img: string;
  },
}

const captureToBody = (results: Results, capturer: Capturer): Body | undefined => {
  const body: Body = { skeleton: [] };

  var changed = false;
  changed = captureFace(results, body) || changed;
  changed = capturer.capture(results, body.skeleton) || changed;

  return changed ? body : undefined;
}


const connect = (
  ctx: CanvasRenderingContext2D,
  connectors: Array<[NormalizedLandmark, NormalizedLandmark]>): void => {
  const canvas = ctx.canvas;
  for (const connector of connectors) {
    const from = connector[0];
    const to = connector[1];
    if (from && to) {
      if (from.visibility && to.visibility &&
        (from.visibility < 0.1 || to.visibility < 0.1)) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
      ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
      ctx.stroke();
    }
  }
}
const debugFace = false;
const debugHands = false;
const captureDebug = (results: Results, debugRef?: React.RefObject<boolean>, webcamCanvasRef?: React.RefObject<HTMLCanvasElement>) => {
  if (!debugRef?.current || !webcamCanvasRef?.current) return;

  const canvasElement = webcamCanvasRef.current;
  if (!canvasElement) return;
  const canvasCtx = canvasElement.getContext('2d');
  if (!canvasCtx) return;

  // Draw the overlays.
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.drawImage(
    results.image, 0, 0, canvasElement.width, canvasElement.height);

  // Connect elbows to hands. Do this first so that the other graphics will draw
  // on top of these marks.
  canvasCtx.lineWidth = 1;
  if (results.poseLandmarks) {
    if (results.rightHandLandmarks) {
      canvasCtx.strokeStyle = 'white';
      connect(canvasCtx, [[
        results.poseLandmarks[POSE_LANDMARKS.RIGHT_ELBOW],
        results.rightHandLandmarks[0]
      ]]);
    }
    if (results.leftHandLandmarks) {
      canvasCtx.strokeStyle = 'white';
      connect(canvasCtx, [[
        results.poseLandmarks[POSE_LANDMARKS.LEFT_ELBOW],
        results.leftHandLandmarks[0]
      ]]);
    }

    // Pose...
    drawingUtils.drawConnectors(
      canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
      { color: 'white' });
    drawingUtils.drawLandmarks(
      canvasCtx,
      Object.values(POSE_LANDMARKS_LEFT)
        .map(index => results.poseLandmarks[index]),
      { color: 'white', fillColor: 'rgb(255,138,0)', radius: 1 });
    drawingUtils.drawLandmarks(
      canvasCtx,
      Object.values(POSE_LANDMARKS_RIGHT)
        .map(index => results.poseLandmarks[index]),
      { color: 'white', fillColor: 'rgb(0,217,231)', radius: 1 });
  }

  // Hands...
  if (debugHands) {
    if (results.leftHandLandmarks) {
      drawingUtils.drawConnectors(
        canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
        { color: 'white' });
      drawingUtils.drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: 'white',
        fillColor: 'rgb(0,217,231)',
        lineWidth: 2,
        radius: (data: drawingUtils.Data) => {
          return drawingUtils.lerp(data.from!.z!, -0.15, .1, 10, 1);
        }
      });
    }
    if (results.leftHandLandmarks) {
      drawingUtils.drawConnectors(
        canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
        { color: 'white' });
      drawingUtils.drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: 'white',
        fillColor: 'rgb(255,138,0)',
        lineWidth: 2,
        radius: (data: drawingUtils.Data) => {
          return drawingUtils.lerp(data.from!.z!, -0.15, .1, 10, 1);
        }
      });
    }
  }

  // Face...
  if (debugFace && results.faceLandmarks) {
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION,
      { color: '#C0C0C070', lineWidth: 1 });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYE,
      { color: 'rgb(0,217,231)' });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYEBROW,
      { color: 'rgb(0,217,231)' });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYE,
      { color: 'rgb(255,138,0)' });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYEBROW,
      { color: 'rgb(255,138,0)' });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_FACE_OVAL,
      { color: '#E0E0E0', lineWidth: 2 });
    drawingUtils.drawConnectors(
      canvasCtx, results.faceLandmarks, FACEMESH_LIPS,
      { color: '#E0E0E0', lineWidth: 2 });
  }

  canvasCtx.restore();
}

const BodyCapture = (props: {
  player: Mesh;
  videoElement: HTMLVideoElement;
  bodySubscription: Subscription<Body>;
  debugRef: React.RefObject<boolean>;
  webcamCanvasRef: React.RefObject<HTMLCanvasElement>;
}) => {
  useEffect(() => {
    const mediapipe = new Holistic({
      locateFile: (file) => `/assets/mediapipe/${file}`,
      // locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    mediapipe.setOptions({
      selfieMode: false,
      modelComplexity: 2, // Adjust for performance  https://google.github.io/mediapipe/solutions/holistic.html#model_complexity
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      enableFaceGeometry: false,
    });

    const capturer = new Capturer();
    mediapipe.onResults(results => {
      const body = captureToBody(results, capturer);
      !!body && props.bodySubscription.notify(body);
      captureDebug(results, props.debugRef, props.webcamCanvasRef)
      return new Promise(resolve => setTimeout(resolve, 1000 / 3))
    });

    const camera = new Camera(props.videoElement, {
      onFrame: () => mediapipe.send({ image: props.videoElement }),
      width: FaceCaptureDimensions.width,
      height: FaceCaptureDimensions.height,
    });

    mediapipe.initialize().then(() => {
      camera.start();
    });

    return () => {
      mediapipe.close();
    };
  }, []);

  return null;
}


export default BodyCapture;
