import { Mesh, VertexData } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { Holistic, Results } from '@mediapipe/holistic';
import { Vector3 } from 'babylonjs';
import { useEffect } from 'react';
import Subscription from '../util/subscriptionUtil';
import { ShoulderMeshIndices } from './BodyCaptureConst';
import { FaceChin, FaceEyeLeft, FaceEyeRight, FaceMeshIndices } from './FaceCaptureConst';

export const FaceCaptureDimensions = { width: 1280, height: 720 };

export interface SkeletonUpdate {
  bones?: Array<{
    i: number; // bone index
    p?: Vector; // Position
    r?: Vector; // Rotation
  }>,
}

export interface Body {
  face?: Face,
  neck?: Neck,
  handLeft?: Hand,
  handRight?: Hand,
  pose?: Pose,
}
export interface Neck extends Orientation { };
export interface Vector { x: number, y: number, z: number };
export interface Orientation {
  position?: Vector;
  rotation?: Vector;
}
export interface Finger {
  proximal?: Orientation;
  middle?: Orientation;
  distal?: Orientation;
}
export interface Thumb {
  metacarpal?: Orientation;
  proximal?: Orientation;
  distal?: Orientation;
}
export interface Hand {
  hand?: Orientation;
  thumb?: Thumb;
  pointer?: Finger;
  middle?: Finger;
  ring?: Finger;
  little?: Finger;
}
export interface Pose {
  shoulder?: Orientation;
  armRightUpper?: Vector;
  armRightLower?: Vector;
  legRightUpper?: Vector;
  legRightLower?: Vector;
  footRight?: Vector;
  toesRight?: Vector;
  legLeftUpper?: Vector;
  legLeftLower?: Vector;
  footLeft?: Vector;
  toesLeft?: Vector;
}
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

const calcRotationAxis = (
  from: Vector,
  to: Vector,
  axisFrom: keyof Vector,
  axisTo: keyof Vector,
): number => Math.atan2(
  to[axisTo] - from[axisTo],
  to[axisFrom] - from[axisFrom],
);

const calcPosition = (
  from?: Vector,
  to?: Vector,
  invertY?: boolean,
): Vector | undefined => (!from || !to) ? undefined : {
  x: (to.x - from.x),
  y: invertY ? (from.y - to.y) : (to.y - from.y),
  z: (to.z - from.z),
};

const captureToPose = (results: Results): Pose | undefined => {
  return undefined;
  // const upperArm = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);
  // const lowerArm = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);
  // const shoulder = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);
  // const upperLeg = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);
  // const foot = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);
  // const toes = calcPosition(results.poseLandmarks?.[0], results.poseLandmarks?.[0], true);

  // if (!upperArm
  //   && !lowerArm
  //   && !shoulder
  //   && !upperLeg
  //   && !foot
  //   && !toes) return undefined;

  // return { upperArm, lowerArm, shoulder, upperLeg, foot, toes };
}

const captureToNeck = (results: Results): Neck | undefined => {
  const faceOriginLeft = results.faceLandmarks?.[FaceEyeLeft];
  const faceOriginRight = results.faceLandmarks?.[FaceEyeRight];
  const faceOriginBottom = results.faceLandmarks?.[FaceChin];
  const shoulderOriginLeft = results.poseLandmarks?.[ShoulderMeshIndices[0]];
  const shoulderOriginRight = results.poseLandmarks?.[ShoulderMeshIndices[1]];

  if (!faceOriginLeft
    || !faceOriginRight
    || !faceOriginBottom
    || !shoulderOriginLeft
    || !shoulderOriginRight) return undefined;

  const faceOrigin: Vector3 = new Vector3(
    (faceOriginLeft.x + faceOriginRight.x) / 2,
    (faceOriginLeft.y + faceOriginRight.y) / 2,
    (faceOriginLeft.z + faceOriginRight.z) / 2,
  );
  const shoulderOrigin: Vector3 = new Vector3(
    (shoulderOriginRight.x + shoulderOriginLeft.x) / 2,
    (shoulderOriginRight.y + shoulderOriginLeft.y) / 2,
    (shoulderOriginRight.z + shoulderOriginLeft.z) / 2,
  );

  const orientation: Orientation = {
    position: calcPosition(shoulderOrigin, faceOrigin, true),
    rotation: {
      x: calcRotationAxis(faceOrigin, faceOriginBottom, 'y', 'z'),
      y: calcRotationAxis(faceOriginLeft, faceOriginRight, 'x', 'z'),
      z: -calcRotationAxis(faceOriginLeft, faceOriginRight, 'x', 'y'),
    },
  };

  return orientation;
}

const captureToFace = (results: Results): Face | undefined => {
  if (!results.faceLandmarks) return undefined;

  // TODO this may be an img element instead of canvas in unknown cases
  const img = (results.image as HTMLCanvasElement).toDataURL('image/jpeg', 0.1);

  const face: Face = {
    mesh: {
      positions: [], // TODO OPTIMIZE initialize with size
      normals: [], // TODO OPTIMIZE initialize with size
    },
    texture: {
      uvs: [], // TODO OPTIMIZE initialize with size
      img,
    }
  };

  // TODO OPTIMIZE clip img using face oval to save space during transfer
  // for (const line of FACEMESH_FACE_OVAL) {
  //   const from = landmarks[line[0]];
  //   const to = landmarks[line[1]];
  //   snip snip...
  // }

  const originLeft = results.faceLandmarks[FaceEyeLeft];
  const originRight = results.faceLandmarks[FaceEyeRight];
  const origin = {
    x: (originLeft.x + originRight.x) / 2,
    y: (originLeft.y + originRight.y) / 2,
    z: (originLeft.z + originRight.z) / 2,
  };

  // Iterate over triangle faces, each having 3 edges
  results.faceLandmarks.forEach(landmark => {
    face.mesh.positions.push(
      landmark.x - origin.x,
      landmark.y - origin.y,
      landmark.z - origin.z,
    );
    face.texture?.uvs.push(
      landmark.x,
      1 - landmark.y,
    );
  });

  VertexData.ComputeNormals(
    face.mesh.positions,
    FaceMeshIndices,
    face.mesh.normals, {
    useRightHandedSystem: false,
  });

  return face;
}

const captureToBody = (results: Results): Body | undefined => {

  const face = captureToFace(results);
  const neck = captureToNeck(results);
  const pose = captureToPose(results);

  if (face || neck || pose) {
    return { face, neck, pose };
  }

  return undefined;
}

const FaceCapture = (props: {
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

    mediapipe.onResults(results => {
      const body = captureToBody(results);
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


export default FaceCapture;
