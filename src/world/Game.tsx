import { ArcRotateCamera, Color3, Mesh, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { Engine, Scene } from 'react-babylonjs';
import { Provider } from 'react-redux';
import { CharacterController } from '../CharacterController';
import Subscription from '../util/subscriptionUtil';
import { Camera } from './Camera';
import { City } from './City';
import { Controller } from './Controller';
import FaceCapture, { Face } from './FaceCapture';
import { Friends } from './Friends';
import Network from './network/Network';
import { Player } from './Player';
import { store } from './store/store';

const Game = () => {
  const faceSubscription: Subscription<Face> = useMemo(() => new Subscription(), []);

  const [player, setPlayer] = useState<Mesh>();
  const playerCallback = useCallback(setPlayer, [setPlayer]);
  const [camera, setCamera] = useState<ArcRotateCamera>();
  const cameraCallback = useCallback(setCamera, [setCamera]);
  const [controller, setController] = useState<CharacterController>();
  const controllerCallback = useCallback(setController, [setController]);
  const [ground, setGround] = useState<Mesh>();
  const groundCallback = useCallback(setGround, [setGround]);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoCallback = useCallback(setVideo, [setVideo]);

  return (
    <>
      <video autoPlay ref={videoCallback} style={{ display: 'none' }} />
      <Engine antialias adaptToDeviceRatio canvasId='game'>
        <Scene>
          <Suspense fallback={false}>
            <Provider store={store}>
              <hemisphericLight name='lightHemi' intensity={1} direction={Vector3.Up()} />
              <pointLight name='lightPoint' position={new Vector3(80, 100, 100)} specular={Color3.Black()} diffuse={new Color3(255 / 255, 240 / 255, 221 / 255)} />
              {/* <lensRenderingPipeline name='lensRenderingPipeline' parameters={{
              edge_blur: 1.0,
              chromatic_aberration: 1.0,
              distortion: 1.0,
            }} /> */}
              <Player playerReady={playerCallback} faceSubscription={faceSubscription} />
              <Camera player={player} cameraReady={cameraCallback} />
              <City groundReady={groundCallback} />
              {!!player && !!camera && (
                <Controller player={player} camera={camera} controllerReady={controllerCallback} />
              )}
              {!!player && !!controller && (<Network player={player} controller={controller} faceSubscription={faceSubscription} />)}
              {!!player && !!video && (<FaceCapture player={player} videoElement={video} faceSubscription={faceSubscription} />)}
              <Friends />
            </Provider>
          </Suspense>
        </Scene>
      </Engine>
    </>
  );
}

export default Game;