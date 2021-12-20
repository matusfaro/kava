import { VertexData } from '@babylonjs/core';
import { Results } from '@mediapipe/holistic';
import { Body, Face } from './BodyCapture';
import { FaceEyeLeft, FaceEyeRight, FaceMeshIndices } from './faceConst';

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

  body.face = face;
  return true;
}
