import { ArcRotateCamera, Mesh, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import React, { Suspense, useCallback, useState } from 'react';
import { Engine, Scene } from 'react-babylonjs';
import { Provider } from 'react-redux';
import { CharacterController } from '../CharacterController';
import { Camera } from './Camera';
import { City } from './City';
import { Controller } from './Controller';
import { Friends } from './Friends';
import Network from './network/Network';
import { Player } from './Player';
import { store } from './store/store';

const Game = () => {
  const [player, setPlayer] = useState<Mesh>();
  const playerCallback = useCallback(setPlayer, [setPlayer]);
  const [camera, setCamera] = useState<ArcRotateCamera>();
  const cameraCallback = useCallback(setCamera, [setCamera]);
  const [controller, setController] = useState<CharacterController>();
  const controllerCallback = useCallback(setController, [setController]);
  const [ground, setGround] = useState<Mesh>();
  const groundCallback = useCallback(setGround, [setGround]);

  return (
    <Engine antialias adaptToDeviceRatio canvasId='game'>
      <Scene>
        <Suspense fallback={false}>
          <Provider store={store}>
            <hemisphericLight name='light1' intensity={0.7} direction={Vector3.Up()} />
            <Player playerReady={playerCallback} />
            <Camera player={player} cameraReady={cameraCallback} />
            <City groundReady={groundCallback} />
            {!!player && (<Network player={player} />)}
            {!!player && !!camera && (
              <Controller player={player} camera={camera} controllerReady={controllerCallback} />
            )}
            <Friends />
          </Provider>
        </Suspense>
      </Scene>
    </Engine>
  );
}

export default Game;