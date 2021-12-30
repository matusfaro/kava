import { Vector3 } from '@babylonjs/core';
import { Results } from '@mediapipe/holistic';
import { SkeletonUpdate, Vector } from './BodyCapture';
import { FaceChin, FaceEyeLeft, FaceEyeRight } from './faceConst';

// DEPRECATED
export const capturePose = (holistic: Results, out: SkeletonUpdate): boolean => {

  return captureNeck(holistic, out);
}

const captureNeck = (holistic: Results, out: SkeletonUpdate): boolean => {
  const faceOriginLeft = holistic.faceLandmarks?.[FaceEyeLeft];
  const faceOriginRight = holistic.faceLandmarks?.[FaceEyeRight];
  const faceOriginBottom = holistic.faceLandmarks?.[FaceChin];
  const shoulderOriginLeft = holistic.poseLandmarks?.[11];
  const shoulderOriginRight = holistic.poseLandmarks?.[12];
  if (!faceOriginLeft
    || !faceOriginRight
    || !faceOriginBottom
    || !shoulderOriginLeft
    || !shoulderOriginRight) return false;

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

  out.push({
    n: 'Neck',
    p: calcPosition(shoulderOrigin, faceOrigin, true),
  });
  out.push({
    n: 'Head',
    r: {
      x: calcRotationAxis(faceOrigin, faceOriginBottom, 'y', 'z'),
      y: calcRotationAxis(faceOriginLeft, faceOriginRight, 'x', 'z'),
      z: -calcRotationAxis(faceOriginLeft, faceOriginRight, 'x', 'y'),
    },
  });

  return true;
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
  from: Vector,
  to: Vector,
  invertY?: boolean,
): Vector => ({
  x: to.x - from.x,
  y: invertY ? (from.y - to.y) : (to.y - from.y),
  z: to.z - from.z,
});
