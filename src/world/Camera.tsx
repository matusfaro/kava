import { ArcRotateCamera, Mesh, Vector3 } from '@babylonjs/core';
import React, { useRef } from 'react';
import { useCanvas } from 'react-babylonjs';


export const Camera = (props: {
  player?: Mesh,
  cameraReady: (camera: ArcRotateCamera) => void,
}) => {
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const canvas = useCanvas();
  if (!!props.player && !!cameraRef.current && !!canvas) {
    cameraRef.current.alpha = -props.player.rotation.y - 4.69
    cameraRef.current.target = new Vector3(
      props.player.position.x,
      props.player.position.y + 1,
      props.player.position.z);
    cameraRef.current.attachControl(canvas, false);
  }
  return (
    <arcRotateCamera
      name='player-camera'
      ref={(c: ArcRotateCamera) => {
        if (!cameraRef.current) {
          cameraRef.current = c;
          props.cameraReady(c);
        }
      }}
      alpha={cameraRef.current ? cameraRef.current.alpha : 0}
      beta={cameraRef.current ? cameraRef.current.beta : Math.PI / 2.5}
      target={cameraRef.current ? cameraRef.current.target : Vector3.Zero()}
      position={cameraRef.current?.position}
      wheelPrecision={15}
      checkCollisions
      keysLeft={[]}
      keysRight={[]}
      keysUp={[]}
      keysDown={[]}
      lowerRadiusLimit={2}
      upperRadiusLimit={20}
      radius={cameraRef.current ? cameraRef.current.radius : 20}
    />
  );
};
