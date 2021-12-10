import { Mesh, SceneLoader, StandardMaterial, Vector3 } from '@babylonjs/core';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { useEffect } from 'react';
import { useScene } from 'react-babylonjs';
import Subscription from '../util/subscriptionUtil';
import { Face } from './FaceCapture';

export const Player = (props: {
  playerReady: (player: Mesh) => void;
  faceSubscription?: Subscription<Face>;
}) => {
  const scene = useScene();
  useEffect(() => {
    SceneLoader.ImportMesh("", "assets/player/", "Vincent.babylon", scene, (meshes, particleSystems, skeletons) => {
      let player = meshes[0] as Mesh;
      let skeleton = skeletons[0];
      player.skeleton = skeleton;

      skeleton.enableBlending(0.1);

      let sm = player.material as StandardMaterial;
      if (sm.diffuseTexture != null) {
        sm.backFaceCulling = true;
        sm.ambientColor = new Color3(1, 1, 1);
      }

      player.position = new Vector3(0, 30, 0);
      player.checkCollisions = true;
      player.ellipsoid = new Vector3(0.5, 1, 0.5);
      player.ellipsoidOffset = new Vector3(0, 1, 0);

      props.playerReady(player);
    });
  }, []);
  return null;
}
