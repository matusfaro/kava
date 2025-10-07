import { VertexData } from '@babylonjs/core';
import { Quaternion, Vector3 } from 'babylonjs';
import { Body, Face } from './BodyCapture';
import { FaceChin, FaceEyeLeft, FaceEyeRight, FaceMeshIndices } from './faceConst';

// Local type definitions for MediaPipe compatibility
interface Results {
  poseLandmarks: any[];
  faceLandmarks: any[];
  rightHandLandmarks?: any[];
  leftHandLandmarks?: any[];
  segmentationMask?: any;
  multiFaceGeometry?: any[];
  image: HTMLVideoElement | HTMLCanvasElement;
}

export const captureFace = (results: Results, body: Body): boolean => {
  if (!results.faceLandmarks) return false;

  // Handle both HTMLVideoElement (new API) and HTMLCanvasElement (legacy API)
  let img: string;
  if (results.image instanceof HTMLVideoElement) {
    // Create a temporary canvas to extract image from video
    const canvas = document.createElement('canvas');
    canvas.width = results.image.videoWidth;
    canvas.height = results.image.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(results.image, 0, 0);
      img = canvas.toDataURL('image/jpeg', 0.1);
    } else {
      return false;
    }
  } else if ((results.image as any).toDataURL) {
    // Legacy API with canvas
    img = (results.image as HTMLCanvasElement).toDataURL('image/jpeg', 0.1);
  } else {
    // Unknown image type
    return false;
  }

  const face: Face = {
    mesh: {
      positions: [], // TODO OPTIMIZE initialize with size
      normals: [], // TODO OPTIMIZE initialize with size
      indices: [],
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

  // Check if we have enough landmarks
  if (!results.faceLandmarks || results.faceLandmarks.length <= Math.max(FaceEyeLeft, FaceEyeRight, FaceChin)) {
    return false;
  }

  const eyeLeftLandmark = results.faceLandmarks[FaceEyeLeft];
  const eyeRightLandmark = results.faceLandmarks[FaceEyeRight];
  const chinLandmark = results.faceLandmarks[FaceChin];

  // Check if landmarks exist
  if (!eyeLeftLandmark || !eyeRightLandmark || !chinLandmark) {
    return false;
  }

  // Calculate eye center for centering the face
  const eyeCenter = new Vector3(
    (eyeLeftLandmark.x + eyeRightLandmark.x) / 2,
    (eyeLeftLandmark.y + eyeRightLandmark.y) / 2,
    (eyeLeftLandmark.z + eyeRightLandmark.z) / 2
  );

  // 180-degree rotation around Y-axis to flip face forward (face landmarks are backwards)
  const originRotation = Quaternion.RotationAxis(Vector3.Up(), Math.PI);
  face.mesh.q = {
    x: originRotation.x,
    y: originRotation.y,
    z: originRotation.z,
    w: originRotation.w,
  };

  // Position face in front of head (local space relative to head bone)
  // Lower position for better alignment with head
  const translation = new Vector3(0, 0.15, 0.15); // Y lowered ~50%, Z moved forward 5%
  face.mesh.p = { x: translation.x, y: translation.y, z: translation.z };

  // Scale face based on a fixed reference size
  // Use the raw landmark distance before 3D transformation to avoid perspective issues
  const eyeDistanceRaw = Math.sqrt(
    Math.pow(eyeRightLandmark.x - eyeLeftLandmark.x, 2) +
    Math.pow(eyeRightLandmark.y - eyeLeftLandmark.y, 2)
  );
  // Use a fixed scale that doesn't change with head tilt
  const scaleFactor = 0.14 / Math.max(eyeDistanceRaw, 0.1); // Clamp minimum to avoid division issues
  // debugAxesTool.update({ name: 'faceWorldForward', boneName: 'Head', direction: Vector3.Forward(), color: Color3.FromInts(0, 153, 0 /* Dark green */) });
  // debugAxesTool.update({ name: 'faceWorldUp', boneName: 'Head', direction: Vector3.Up(), color: Color3.FromInts(153, 0, 0 /* Dark red */) });
  // debugAxesTool.update({ name: 'faceWorldRight', boneName: 'Head', direction: Vector3.Right(), color: Color3.FromInts(0, 0, 153 /* Dark blue */) });
  // debugAxesTool.update({ name: 'faceRotForward', boneName: 'Head', direction: rotForward, color: Color3.Green() });
  // debugAxesTool.update({ name: 'faceRotUp', boneName: 'Head', direction: rotUp, color: Color3.Red() });
  // debugAxesTool.update({ name: 'faceRotRight', boneName: 'Head', direction: rotRight, color: Color3.Blue() });

  // Process original face landmarks
  results.faceLandmarks.forEach(landmark => {
    // Process landmarks without applying rotation (rotation handled by mesh quaternion)
    const point = new Vector3(landmark.x, landmark.y, landmark.z);
    point.subtractInPlace(eyeCenter);
    point.scaleInPlace(scaleFactor);
    // Invert z but don't add offset
    point.z = -point.z;
    face.mesh.positions.push(point.x, point.y, point.z);
    face.texture?.uvs.push(
      landmark.x,
      1 - landmark.y,
    );
  });

  // Store the face mesh indices
  face.mesh.indices = FaceMeshIndices;

  VertexData.ComputeNormals(
    face.mesh.positions,
    face.mesh.indices,
    face.mesh.normals, {
    useRightHandedSystem: false,
  });

  body.face = face;
  return true;
}
