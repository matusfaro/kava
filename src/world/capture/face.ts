import { VertexData } from '@babylonjs/core';
import { Results } from '@mediapipe/holistic';
import { Matrix, Quaternion, Vector3 } from 'babylonjs';
import { Body, Face } from './BodyCapture';
import { FaceChin, FaceEyeLeft, FaceEyeRight, FaceMeshIndices } from './faceConst';

export const captureFace = (results: Results, body: Body): boolean => {
  if (!results.faceLandmarks) return false;

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

  const eyeLeftLandmark = results.faceLandmarks[FaceEyeLeft];
  const eyeLeft = new Vector3(eyeLeftLandmark.x, eyeLeftLandmark.y, eyeLeftLandmark.z);
  const eyeRightLandmark = results.faceLandmarks[FaceEyeRight];
  const eyeRight = new Vector3(eyeRightLandmark.x, eyeRightLandmark.y, eyeRightLandmark.z);
  const chinLandmark = results.faceLandmarks[FaceChin];
  const chin = new Vector3(chinLandmark.x, chinLandmark.y, chinLandmark.z);
  const eyeCenter = Vector3.Center(eyeLeft, eyeRight);

  // Rotation to match correct front
  const originRotation = Quaternion.RotationAxis(Vector3.Up(), Math.PI);
  // Rotation normalization
  face.mesh.q = {
    x: originRotation.x,
    y: originRotation.y,
    z: originRotation.z,
    w: originRotation.w,
  };

  // Translate to fit front of Head 
  const translation = new Vector3(0, 0.15, 0.5);
  face.mesh.p = { x: translation.x, y: translation.y, z: translation.z };

  // Scale face to always be same size regardless how far away from camera it is
  const eyeDistance = Vector3.Distance(eyeRight, eyeLeft);
  const scaleFactor = 0.07 / eyeDistance;

  // Rotate face landmarks to face forward
  const rotUp = chin.subtract(eyeCenter).normalize();
  const rotRight = eyeRight.subtract(eyeLeft).normalize();
  const rotForward = Vector3.Cross(rotRight, rotUp).normalize();
  const inPlaceRotation = Quaternion.FromRotationMatrix(Matrix.FromValues(
    rotRight._x, rotUp._x, rotForward._x, 0.0,
    rotRight._y, rotUp._y, rotForward._y, 0.0,
    rotRight._z, rotUp._z, rotForward._z, 0.0,
    0.0, 0.0, 0.0, 1.0
  ).getRotationMatrix()).normalize();
  // debugAxesTool.update({ name: 'faceWorldForward', boneName: 'Head', direction: Vector3.Forward(), color: Color3.FromInts(0, 153, 0 /* Dark green */) });
  // debugAxesTool.update({ name: 'faceWorldUp', boneName: 'Head', direction: Vector3.Up(), color: Color3.FromInts(153, 0, 0 /* Dark red */) });
  // debugAxesTool.update({ name: 'faceWorldRight', boneName: 'Head', direction: Vector3.Right(), color: Color3.FromInts(0, 0, 153 /* Dark blue */) });
  // debugAxesTool.update({ name: 'faceRotForward', boneName: 'Head', direction: rotForward, color: Color3.Green() });
  // debugAxesTool.update({ name: 'faceRotUp', boneName: 'Head', direction: rotUp, color: Color3.Red() });
  // debugAxesTool.update({ name: 'faceRotRight', boneName: 'Head', direction: rotRight, color: Color3.Blue() });

  // Iterate over triangle faces, each having 3 edges
  results.faceLandmarks.forEach(landmark => {
    const point = new Vector3(landmark.x, landmark.y, landmark.z);
    point.subtractInPlace(eyeCenter);
    point.rotateByQuaternionToRef(inPlaceRotation, point);
    point.scaleInPlace(scaleFactor);
    point.z = 1 - point.z;
    face.mesh.positions.push(point.x, point.y, point.z);
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

  body.face = face;
  return true;
}
