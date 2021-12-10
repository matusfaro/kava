import { Color3, DynamicTexture, Matrix, Mesh, Scene, SceneLoader, Skeleton, SkeletonViewer, StandardMaterial, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { useScene } from 'react-babylonjs';
import Subscription from '../util/subscriptionUtil';
import { Face, FaceCaptureDimensions } from './FaceCapture';

const PlayerFaceBoneIndex = 9;
const updateFace = (scene: Scene, faceRef: React.MutableRefObject<{ face: Mesh, texture: DynamicTexture } | undefined>, player: Mesh, skeleton: Skeleton, face: Face) => {
  if (!faceRef.current) {
    faceRef.current = {
      face: new Mesh(`${player.name}-face`, scene),
      texture: new DynamicTexture(`${player.name}-face`, FaceCaptureDimensions, scene, false),
    };
    const material = new StandardMaterial(`${player.name}-face`, scene);
    material.diffuseTexture = faceRef.current.texture;
    faceRef.current.face.material = material;

    if (face.texture) {
      const img = new Image();
      img.onload = () => {
        faceRef.current?.texture.getContext().drawImage(img, 0, 0);
        faceRef.current?.texture.update();
      };
      img.src = face.texture.img;
    }

    faceRef.current.face.bakeTransformIntoVertices(Matrix.FromArray(face.mesh.transform, 0));

    var vertexData = new VertexData();
    vertexData.positions = face.mesh.positions;
    vertexData.normals = face.mesh.normals;
    vertexData.indices = Array.from(Array(face.mesh.positions.length / 3).keys());
    if (face.texture) vertexData.uvs = face.texture.uvs;
    vertexData.applyToMesh(faceRef.current.face, true);

    faceRef.current.face.attachToBone(skeleton.bones[PlayerFaceBoneIndex], player);
  } else {
    if (face.texture) {
      const img = new Image();
      img.onload = () => {
        faceRef.current?.texture.getContext().drawImage(img, 0, 0);
        faceRef.current?.texture.update();
      };
      img.src = face.texture.img;
    }

    faceRef.current.face.bakeTransformIntoVertices(Matrix.FromArray(face.mesh.transform, 0));

    faceRef.current.face.updateVerticesData(VertexBuffer.PositionKind, face.mesh.positions);
    faceRef.current.face.updateVerticesData(VertexBuffer.NormalKind, face.mesh.normals);
    if (face.texture) faceRef.current.face.updateVerticesData(VertexBuffer.UVKind, face.texture.uvs);
  }
}

export const Player = (props: {
  playerReady: (player: Mesh) => void;
  faceSubscription?: Subscription<Face>;
  debugSkeleton?: boolean;
}) => {
  const scene = useScene();
  const faceModelRef = useRef<{ face: Mesh, texture: DynamicTexture }>();
  useEffect(() => {
    SceneLoader.ImportMesh("", "assets/player/", "Vincent.babylon", scene, (meshes, particleSystems, skeletons) => {
      let player = meshes[0] as Mesh;
      let skeleton = skeletons[0];
      if (props.debugSkeleton) {
        const skeletonViewer = new SkeletonViewer(skeleton, player, scene!);
        skeletonViewer.isEnabled = true;
        skeletonViewer.color = Color3.Red();
      }
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

      const faceUnsubscribe = props.faceSubscription?.subscribe(faceData =>
        updateFace(scene!, faceModelRef, player, skeleton, faceData));

      props.playerReady(player);

      return () => {
        faceUnsubscribe?.();
      };
    });
  }, []);
  return null;
}
