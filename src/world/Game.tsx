import { ArcRotateCamera, Color3, Mesh, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { Engine, Scene } from 'react-babylonjs';
import { Provider } from 'react-redux';
import { GameOptions } from '../App';
import { CharacterController } from '../CharacterController';
import Subscription from '../util/subscriptionUtil';
import { Camera } from './Camera';
import BodyCapture, { Body } from './capture/BodyCapture';
import { City } from './City';
import { Controller } from './Controller';
import { DebugAxes } from './DebugAxes';
import { Friends } from './Friends';
import './game.css';
import { Joystick } from './Joystick';
import Network from './network/Network';
import { Player } from './Player';
import { store } from './store/store';

const Game = (props: {
  enableVideo?: boolean;
  webcamCanvasRef: React.RefObject<HTMLCanvasElement>;
  options: GameOptions;
}) => {
  const faceSubscription: Subscription<Body> = useMemo(() => new Subscription(), []);

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
      {props.enableVideo && (<video autoPlay muted ref={videoCallback} style={{ display: 'none' }} />)}
      {!!controller && (<Joystick controller={controller} />)}
      <Engine antialias adaptToDeviceRatio canvasId='game'>
        <Scene>
          <Suspense fallback={false}>
            <Provider store={store}>
              <hemisphericLight name='lightHemi' intensity={1} direction={Vector3.Up()} />
              <pointLight name='lightPoint' position={new Vector3(80, 100, 100)} specular={Color3.Black()} diffuse={new Color3(255 / 255, 240 / 255, 221 / 255)} />
              <Player key='playerSelf' name='playerSelf' playerReady={playerCallback} bodySubscription={faceSubscription} options={props.options} />
              <Camera player={player} cameraReady={cameraCallback} />
              <City groundReady={groundCallback} />
              {/* <box name='ground' width={100} depth={100} height={1} checkCollisions /> */}
              {!!player && !!camera && (
                <Controller player={player} camera={camera} controllerReady={controllerCallback} />
              )}
              {!!player && !!controller && (<Network player={player} controller={controller} bodySubscription={faceSubscription} />)}
              {!!player && !!video && (<BodyCapture player={player} videoElement={video} bodySubscription={faceSubscription} options={props.options} webcamCanvasRef={props.webcamCanvasRef} />)}
              <Friends options={props.options} />
              <DebugAxes />
            </Provider>
          </Suspense>
        </Scene>
      </Engine>
    </>
  );
}

export default Game;