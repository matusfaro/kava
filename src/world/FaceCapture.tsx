import { Mesh, VertexData } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { useEffect } from 'react';
import Subscription from '../util/subscriptionUtil';
import { FaceMeshIndices } from './FaceCaptureConst';

export const FaceCaptureDimensions = { width: 1280, height: 720 };

export interface Face {
  mesh: {
    positions: Array<number>;
    normals: Array<number>;
    transform?: number[];
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
      transform: results.multiFaceGeometry[0]
        ?.getPoseTransformMatrix()
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
  landmarks.forEach(landmark => {
    face.mesh.positions.push(
      landmark.x,
      landmark.y,
      landmark.z,
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
      refineLandmarks: false,
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
