import { Mesh } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { Holistic, Results } from '@mediapipe/holistic';
import { useEffect } from 'react';
import Subscription from '../../util/subscriptionUtil';
import { Capturer } from './capturer';
import { captureFace } from './face';
import { captureHand } from './hand';
import { capturePose } from './pose';

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
  changed = capturePose(results, body.skeleton) || changed;
  changed = captureFace(results, body) || changed;
  changed = captureHand(results, body.skeleton) || changed;
  changed = capturer.capture(results, body.skeleton) || changed;

  return changed ? body : undefined;
}

const BodyCapture = (props: {
  player: Mesh;
  videoElement: HTMLVideoElement;
  bodySubscription: Subscription<Body>;
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
      return new Promise(resolve => setTimeout(resolve, 1000 / 30))
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
