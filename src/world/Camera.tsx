import { ArcRotateCamera, Mesh, Vector3 } from '@babylonjs/core';
import React, { useEffect, useRef, useState } from 'react';
import { useCanvas, useScene } from 'react-babylonjs';


export const Camera = (props: {
  player?: Mesh,
  cameraReady: (camera: ArcRotateCamera) => void,
}) => {
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const canvas = useCanvas();
  const scene = useScene();

  // Track camera ready state
  const [cameraReady, setCameraReady] = useState(false);

  // Attach camera controls when ready
  useEffect(() => {
    if (!props.player || !canvas || !scene || !cameraRef.current) return;

    console.log('Setting up camera controls', {
      hasPlayer: !!props.player,
      hasCamera: !!cameraRef.current,
      playerPosition: props.player.position
    });

    // Attach controls - CharacterController will handle camera positioning
    cameraRef.current.attachControl(canvas, false);
  }, [props.player, canvas, scene, cameraReady]);
  return (
    <arcRotateCamera
      name='player-camera'
      ref={(c: ArcRotateCamera) => {
        if (!cameraRef.current && c) {
          cameraRef.current = c;
          props.cameraReady(c);
          setCameraReady(true);
        }
      }}
      alpha={cameraRef.current ? cameraRef.current.alpha : -Math.PI / 2}
      beta={cameraRef.current ? cameraRef.current.beta : Math.PI / 2.5}
      target={props.player ? new Vector3(props.player.position.x, props.player.position.y + 1, props.player.position.z) : new Vector3(-8, 2, 25)}
      position={cameraRef.current?.position}
      wheelPrecision={15}
      checkCollisions
      keysLeft={[]}
      keysRight={[]}
      keysUp={[]}
      keysDown={[]}
      lowerRadiusLimit={2}
      upperRadiusLimit={20}
      radius={cameraRef.current ? cameraRef.current.radius : 10}
    />
  );
};
