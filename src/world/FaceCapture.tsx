import { Mesh, VertexData } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh, FACEMESH_TESSELATION, Results } from '@mediapipe/face_mesh';
import { useEffect } from 'react';
import Subscription from '../util/subscriptionUtil';

export const FaceCaptureDimensions = { width: 1280, height: 720 };

export interface Face {
  mesh: {
    positions: Array<number>;
    normals: Array<number>;
    transform: number[];
  },
  texture?: {
    uvs: Array<number>;
    img: string;
  },
}

// var frameUntilTexture = -1;
const captureToFace = (results: Results): Face | undefined => {
  const captureTexture = true;
  // if (captureTexture) frameUntilTexture = 10;

  const landmarks = results.multiFaceLandmarks?.[0];
  if (!landmarks) return undefined;

  const face: Face = {
    mesh: {
      positions: [], // TODO OPTIMIZE initialize with size
      normals: [], // TODO OPTIMIZE initialize with size
      transform: results.multiFaceGeometry[0]!
        .getPoseTransformMatrix()
        .getPackedDataList(), // TODO OPTIMIZE precompute
    },
    texture: !captureTexture ? undefined : {
      uvs: [], // TODO OPTIMIZE initialize with size
      // TODO this may be an img element instead of canvas in unknown cases
      img: (results.image as HTMLCanvasElement).toDataURL('image/jpeg', 0.1),
    }
  };


  // TODO OPTIMIZE clip img using face oval to save space during transfer
  // for (const line of FACEMESH_FACE_OVAL) {
  //   const from = landmarks[line[0]];
  //   const to = landmarks[line[1]];
  //   snip snip...
  // }

  // Iterate over triangle faces, each having 3 edges
  for (var triangleNumber = 0; triangleNumber < FACEMESH_TESSELATION.length / 3; triangleNumber++) {
    const point1 = landmarks[FACEMESH_TESSELATION[triangleNumber * 3][0]];
    const point2 = landmarks[FACEMESH_TESSELATION[triangleNumber * 3 + 1][0]];
    const point3 = landmarks[FACEMESH_TESSELATION[triangleNumber * 3 + 2][0]];

    // TODO OPTIMIZE normalize this to look forward always
    // OR send the PoseTransformMatrix over to let receier do it. This way,
    // we can omit uvs as it can be easily calculated.
    face.mesh.positions.push(
      point1.x,
      point1.y,
      point1.z,
      point2.x,
      point2.y,
      point2.z,
      point3.x,
      point3.y,
      point3.z,
    );
    face.texture?.uvs.push(
      point1.x,
      1 - point1.y,
      point2.x,
      1 - point2.y,
      point3.x,
      1 - point3.y,
    );
  }

  const indices = Array.from(Array(face.mesh.positions.length / 3).keys());
  VertexData.ComputeNormals(
    face.mesh.positions,
    indices,
    face.mesh.normals)

  return face;
}

const FaceCapture = (props: {
  player: Mesh;
  videoElement: HTMLVideoElement;
  faceSubscription: Subscription<Face>;
}) => {
  useEffect(() => {
    console.log('face: starting');

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });
    faceMesh.setOptions({
      selfieMode: false,
      maxNumFaces: 1,
      minDetectionConfidence: 0.1,
      minTrackingConfidence: 0.1,
      enableFaceGeometry: true,
    });

    faceMesh.onResults(async results => {
      const face = captureToFace(results);
      !!face && props.faceSubscription.notify(face);
      return new Promise(resolve => setTimeout(resolve, 1000 / 30))
    });

    const camera = new Camera(props.videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: props.videoElement });
      },
      width: FaceCaptureDimensions.width,
      height: FaceCaptureDimensions.height,
    });
    camera.start();

    return () => {
      faceMesh.close();
    };
  }, []);

  return null;
}


export default FaceCapture;
