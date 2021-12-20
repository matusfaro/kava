import { Color3, DynamicTexture, Mesh, Quaternion, Scene, SceneLoader, Skeleton, SkeletonViewer, StandardMaterial, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { useScene } from 'react-babylonjs';
import Subscription from '../util/subscriptionUtil';
import { Body, Face, FaceCaptureDimensions, SkeletonUpdate, Vector } from './capture/BodyCapture';
import { FaceMeshIndices } from './capture/faceConst';

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
    // TODO the back is actually the front, fix it and turn this on
    material.backFaceCulling = false;

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

    faceRef.current.face.translate(new Vector3(0, 0.15, 0.11), 1);
    faceRef.current.face.scaling = new Vector3(1, 0.6, 0.6);
    const headBone = skeleton.bones[skeleton.getBoneIndexByName(HeadBoneName)];
    faceRef.current.face.attachToBone(headBone, player);
    headBone.scaling = new Vector3(3, 3, 3);
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

export const NeckPositionBase: Vector = { x: 0, y: 0, z: 0 };
export const NeckBoneName = 'Neck';
const updateSkeleton = (updates: SkeletonUpdate, skeleton: Skeleton) => {
  for (const update of updates) {
    const boneIndex = skeleton.getBoneIndexByName(update.n);
    if (boneIndex === -1) continue;
    const bone = skeleton.bones[boneIndex];
    if (!bone) continue;
    update.p && bone.setPosition(new Vector3(update.p.x, update.p.y, update.p.z));
    update.r && bone.setRotation(new Vector3(update.r.x, update.r.y, update.r.z));
    update.q && bone.setRotationQuaternion(new Quaternion(update.q.x, update.q.y, update.q.z, update.q.w));
    update.s !== undefined && bone.setScale(new Vector3(update.s, update.s, update.s));
  }
};

export const Player = (props: {
  playerReady: (player: Mesh) => void;
  bodySubscription?: Subscription<Body>;
  faceSubscription?: Subscription<Face>;
  debugSkeleton?: boolean;
}) => {
  const scene = useScene();
  const faceModelRef = useRef<{ face: Mesh, texture: DynamicTexture }>();
  useEffect(() => {
    SceneLoader.ImportMesh('', 'assets/player/man/', 'ManCasual3new.babylon', scene, (meshes, particleSystems, skeletons) => {
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

      const bodyUnsubscribe = props.bodySubscription?.subscribe(body => {
        if (!scene) return;
        // !!body.face && updateFace(scene, faceModelRef, player, skeleton, body.face);
        updateSkeleton(body.skeleton, skeleton);
      });

      const faceUnsubscribe = props.faceSubscription?.subscribe(face =>
        !!face && updateFace(scene!, faceModelRef, player, skeleton, face));

      props.playerReady(player);

      return () => {
        bodyUnsubscribe?.();
        faceUnsubscribe?.();
      };
    });
  }, []);
  return null;
}
