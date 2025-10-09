import { VertexData } from '@babylonjs/core';
import { Quaternion, Vector3 } from 'babylonjs';
import { GameOptions } from '../../App';
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

// Rate limiting for face texture updates
let lastFaceTextureUpdate = 0;

export const captureFace = (results: Results, body: Body, options: GameOptions): boolean => {
  if (!results.faceLandmarks) return false;

  // Rate limit face texture updates to reduce CPU load (configurable Hz)
  const now = Date.now();
  const faceTextureUpdateInterval = 1000 / options.processingRate.current;
  const shouldUpdateTexture = (now - lastFaceTextureUpdate) >= faceTextureUpdateInterval;

  // Handle both HTMLVideoElement (new API) and HTMLCanvasElement (legacy API)
  let img: string | undefined;
  if (shouldUpdateTexture) {
    lastFaceTextureUpdate = now;

    if (results.image instanceof HTMLVideoElement) {
      // Create a temporary canvas to extract image from video
      const canvas = document.createElement('canvas');
      canvas.width = results.image.videoWidth;
      canvas.height = results.image.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(results.image, 0, 0);
        img = canvas.toDataURL('image/jpeg', 0.1);
      }
    } else if ((results.image as any).toDataURL) {
      // Legacy API with canvas
      img = (results.image as HTMLCanvasElement).toDataURL('image/jpeg', 0.1);
    }
  }

  const face: Face = {
    mesh: {
      positions: [], // TODO OPTIMIZE initialize with size
      normals: [], // TODO OPTIMIZE initialize with size
      indices: [],
    },
    // Only include texture if we have an image update
    texture: img ? {
      uvs: [], // TODO OPTIMIZE initialize with size
      img,
    } : undefined
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

  // Calculate 3D eye distance (including Z depth)
  // 3D distance is stable regardless of head tilt/rotation
  // 2D distance changes when head tilts due to perspective
  const eyeDistanceRaw = Math.sqrt(
    Math.pow(eyeRightLandmark.x - eyeLeftLandmark.x, 2) +
    Math.pow(eyeRightLandmark.y - eyeLeftLandmark.y, 2) +
    Math.pow(eyeRightLandmark.z - eyeLeftLandmark.z, 2)
  );
  const eyeDistance = Math.max(eyeDistanceRaw, 0.01); // Prevent division by zero

  // No quaternion rotation - we'll flip the geometry directly to avoid double-rotation
  const originRotation = Quaternion.Identity();
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

  // Scale entire mesh inversely proportional to eye distance
  // When closer to camera (larger eye distance), scale down
  // When farther from camera (smaller eye distance), scale up
  // This keeps the 3D head mesh at constant size regardless of camera distance
  const targetEyeDistance = 0.14; // Reference eye distance for normalization
  const scaleFactor = targetEyeDistance / eyeDistance;
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

    // Apply uniform scaling to all coordinates (X, Y, Z)
    // This maintains face proportions while normalizing size
    point.scaleInPlace(scaleFactor);

    // Mirror face horizontally (negate X only)
    // MediaPipe face landmarks need horizontal flip to face forward
    point.x = -point.x;

    face.mesh.positions.push(point.x, point.y, point.z);
    // Only add UVs if we have a texture
    if (face.texture) {
      face.texture.uvs.push(
        landmark.x,
        1 - landmark.y,
      );
    }
  });

  // Store the face mesh indices
  // The original indices work correctly with the X-axis flip
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
