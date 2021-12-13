import { Color3, DynamicTexture, Mesh, Scene, SceneLoader, Skeleton, SkeletonViewer, StandardMaterial, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { useScene } from 'react-babylonjs';
import Subscription from '../util/subscriptionUtil';
import { Body, Face, FaceCaptureDimensions } from './BodyCapture';
import { FaceMeshIndices } from './FaceCaptureConst';

export const HeadBoneName = 'Head';
const updateFace = (scene: Scene, faceRef: React.MutableRefObject<{ face: Mesh, texture: DynamicTexture } | undefined>, player: Mesh, skeleton: Skeleton, face: Face) => {
  if (!faceRef.current) {
    faceRef.current = {
      face: new Mesh(`${player.name}-face`),
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

    var vertexData = new VertexData();
    vertexData.positions = face.mesh.positions;
    vertexData.normals = face.mesh.normals;
    vertexData.indices = FaceMeshIndices;
    if (face.texture) vertexData.uvs = face.texture.uvs;
    vertexData.applyToMesh(faceRef.current.face, true);

    const headBone = skeleton.bones[skeleton.getBoneIndexByName(HeadBoneName)];
    faceRef.current.face.attachToBone(headBone, player);

    faceRef.current.face.rotate(new Vector3(0, 1, 0), Math.PI);
    faceRef.current.face.translate(new Vector3(0, 0.1, -0.2), 1);
  } else {
    if (face.texture) {
      const img = new Image();
      img.onload = () => {
        faceRef.current?.texture.getContext().drawImage(img, 0, 0);
        faceRef.current?.texture.update();
      };
      img.src = face.texture.img;
    }
    faceRef.current.face.updateVerticesData(VertexBuffer.PositionKind, face.mesh.positions);
    faceRef.current.face.updateVerticesData(VertexBuffer.NormalKind, face.mesh.normals);
    if (face.texture) faceRef.current.face.updateVerticesData(VertexBuffer.UVKind, face.texture.uvs);
  }
}

export const Player = (props: {
  playerReady: (player: Mesh) => void;
  bodySubscription?: Subscription<Body>;
  debugSkeleton?: boolean;
}) => {
  const scene = useScene();
  const faceModelRef = useRef<{ face: Mesh, texture: DynamicTexture }>();
  useEffect(() => {
    SceneLoader.ImportMesh("", "assets/player/man/", "ManCasual3new.babylon", scene, (meshes, particleSystems, skeletons) => {
      let player = meshes[0] as Mesh;
      let skeleton = skeletons[0];
      if (props.debugSkeleton) {
        const skeletonViewer = new SkeletonViewer(skeleton, player, scene!, false, 3, {
          displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        });
        skeletonViewer.isEnabled = true;
      }
      player.skeleton = skeleton;

      skeleton.enableBlending(0.1);

      let sm = player.material as StandardMaterial;
      if (sm.diffuseTexture != null) {
        sm.backFaceCulling = true;
        sm.ambientColor = new Color3(1, 1, 1);
      }

      player.scaling = new Vector3(0.75, 0.75, 0.75);
      player.position = new Vector3(-8, 1, 25);
      player.checkCollisions = true;
      player.ellipsoid = new Vector3(0.5, 1, 0.5);
      player.ellipsoidOffset = new Vector3(0, 1, 0);

      const faceUnsubscribe = props.bodySubscription?.subscribe(body =>
        !!body.face && updateFace(scene!, faceModelRef, player, skeleton, body.face));

      props.playerReady(player);

      return () => {
        faceUnsubscribe?.();
      };
    });
  }, []);
  return null;
}
