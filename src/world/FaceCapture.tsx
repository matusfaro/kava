import { Mesh } from '@babylonjs/core';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';
import { useEffect } from 'react';
import Subscription from '../util/subscriptionUtil';

export interface Face {

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
    });

    faceMesh.onResults(async results => {
      props.faceSubscription.notify({
        // TODO
      });
      return new Promise(resolve => setTimeout(resolve, 1000))
    });

    const camera = new Camera(props.videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: props.videoElement });
      },
      width: 1280,
      height: 720
    });
    camera.start();

    return () => {
      faceMesh.close();
    };
  }, []);

  return null;
}


export default FaceCapture;
