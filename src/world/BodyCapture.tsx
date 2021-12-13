import { Mesh, VertexData } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { Holistic, Results } from '@mediapipe/holistic';
import { useEffect } from 'react';
import Subscription from '../util/subscriptionUtil';
import { FaceMeshIndices } from './FaceCaptureConst';

export const FaceCaptureDimensions = { width: 1280, height: 720 };

export interface Body {
  face?: Face,
  handLeft?: Hand,
  handRight?: Hand,
  pose?: Pose,
}
export interface Hand {
}
export interface Pose {
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

const captureToPose = (results: Results): Pose | undefined => {

  return undefined;
}

// TODO check if this is the lower part of the eye. If not, uncomment there:
// const FaceOriginLeft = 386; // FACEMESH_RIGHT_EYE[3][1]
// const FaceOriginRight = 159; // FACEMESH_LEFT_EYE[3][1]
const FaceOriginLeft = 374; // FACEMESH_RIGHT_EYE[11][1]
const FaceOriginRight = 145; // FACEMESH_LEFT_EYE[11][1]

const captureToFace = (results: Results): Face | undefined => {
  if (!results.faceLandmarks) return undefined;

  // console.log('debug img', (results.image as HTMLCanvasElement).toDataURL());
  // TODO this may be an img element instead of canvas in unknown cases
  console.log('debug img', results.image);
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

  const originLeft = results.faceLandmarks[FaceOriginLeft];
  const originRight = results.faceLandmarks[FaceOriginRight];
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
    face.mesh.normals);

  return face;
}

const captureToBody = (results: Results): Body | undefined => {
  const face = captureToFace(results);
  const pose = captureToPose(results);

  if (face || pose) {
    return { face, pose };
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

    mediapipe.onResults(async results => {
      const body = captureToBody(results);
      !!body && props.bodySubscription.notify(body);
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


export default FaceCapture;
