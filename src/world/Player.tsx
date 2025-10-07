import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  Skeleton,
  SkeletonViewer,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  VertexData,
  Axis,
  AbstractMesh
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import React, { useEffect, useRef, useState } from 'react';
import { useScene } from 'react-babylonjs';
import { GameOptions } from '../App';
import Subscription from '../util/subscriptionUtil';
import { Body, Face, FaceCaptureDimensions, SkeletonUpdate, Vector } from './capture/BodyCapture';

export const HeadBoneName = 'Head';

const updateFace = (scene: Scene, faceRef: React.MutableRefObject<{ face: Mesh, texture: DynamicTexture } | undefined>, player: Mesh, skeleton: Skeleton, face: Face, headMeshes?: AbstractMesh[]) => {
  if (!faceRef.current) {
    faceRef.current = {
      face: new Mesh(`${player.name}-face`),
      texture: new DynamicTexture(`${player.name}-face`, FaceCaptureDimensions, scene, false),
    };
    const material = new StandardMaterial(`${player.name}-face`, scene);
    material.diffuseTexture = faceRef.current.texture;
    material.specularColor = new Color3(0, 0, 0); // No specular on the face
    faceRef.current.face.material = material;

    // Hide head meshes when face is created
    if (headMeshes && headMeshes.length > 0) {
      console.log('Hiding head meshes now that face is present');
      headMeshes.forEach(mesh => {
        mesh.visibility = 0;
        mesh.isVisible = false;
      });
    }

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
    vertexData.indices = face.mesh.indices; // Use extended indices from face mesh
    if (face.texture) vertexData.uvs = face.texture.uvs;
    vertexData.applyToMesh(faceRef.current.face, true);

    // Set rotation if provided
    if (face.mesh.q) {
      faceRef.current.face.rotationQuaternion = new Quaternion(
        face.mesh.q.x, face.mesh.q.y, face.mesh.q.z, face.mesh.q.w);
    }

    // Set local position before attaching (this becomes relative to parent)
    if (face.mesh.p) {
      faceRef.current.face.position.x = face.mesh.p.x;
      faceRef.current.face.position.y = face.mesh.p.y;
      faceRef.current.face.position.z = face.mesh.p.z;
    }

    // Apply mesh scaling
    faceRef.current.face.scaling = new Vector3(1, 0.6, 0.6);

    // Now attach to head bone - position becomes relative to bone
    const headBone = skeleton.bones[skeleton.getBoneIndexByName(HeadBoneName)];
    faceRef.current.face.attachToBone(headBone, player);

    // Keep head bone at normal scale
    headBone.scaling = new Vector3(1, 1, 1);
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
const updateSkeleton = (updates: SkeletonUpdate, skeleton: Skeleton, options: GameOptions) => {
  for (const update of updates) {
    const boneIndex = skeleton.getBoneIndexByName(update.n);
    if (boneIndex === -1) continue;
    const bone = skeleton.bones[boneIndex];
    if (!bone) continue;
    options.skeletonScaling.current && update.p && bone.setPosition(new Vector3(update.p.x, update.p.y, update.p.z));
    options.skeletonScaling.current && update.s !== undefined && bone.setScale(new Vector3(update.s, update.s, update.s));
    options.skeletonRotations.current && update.r && bone.setRotation(new Vector3(update.r.x, update.r.y, update.r.z));
    options.skeletonRotations.current && update.q && bone.setRotationQuaternion(new Quaternion(update.q.x, update.q.y, update.q.z, update.q.w));
  }
};

export const Player = (props: {
  name: string;
  playerReady: (player: Mesh) => void;
  bodySubscription?: Subscription<Body>;
  faceSubscription?: Subscription<Face>;
  options: GameOptions;
}) => {
  const scene = useScene();
  const faceModelRef = useRef<{ face: Mesh, texture: DynamicTexture } | undefined>(undefined);
  const headMeshesRef = useRef<AbstractMesh[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!scene) {
      console.log('Scene not ready yet for Player import');
      return;
    }

    if (isInitialized) {
      console.log('Player already initialized');
      return;
    }
    // Create a simple box mesh to act as the player root for CharacterController
    const player = MeshBuilder.CreateBox(props.name, { size: 1 }, scene);
    player.visibility = 0; // Make the box invisible
    player.isPickable = false;

    // Create a completely transparent material
    const invisibleMat = new StandardMaterial('playerInvisibleMat', scene);
    invisibleMat.alpha = 0;
    invisibleMat.transparencyMode = 2; // ALPHA_BLEND
    player.material = invisibleMat;

    // Set up player properties immediately
    player.scaling = new Vector3(0.75, 0.75, 0.75);
    player.position = new Vector3(10, 15, 28);
    player.checkCollisions = true;
    player.ellipsoid = new Vector3(0.5, 1, 0.5);
    player.ellipsoidOffset = new Vector3(0, 1, 0);

    // Mark as initialized and notify that player is ready
    setIsInitialized(true);
    console.log('Player root created, loading character model...');
    props.playerReady(player);

    // Load the character model asynchronously
    const loadCharacterModel = async () => {
      try {
        const result = await ImportMeshAsync('assets/player/man/ManCasual3new.babylon', scene);
        const { meshes, skeletons } = result;

        console.log('Loaded meshes:', meshes.map(m => ({
          name: m.name,
          type: m.getClassName(),
          isMesh: m instanceof Mesh,
          hasGeometry: (m as any).geometry ? true : false
        })));

        // Attach all loaded meshes to our player root
        meshes.forEach(mesh => {
          if (!mesh.parent) {
            mesh.parent = player;
          }
          // Check if this is specifically a head mesh
          const meshName = mesh.name ? mesh.name.toLowerCase() : '';

          // Store head-related meshes to hide later when face appears
          if (meshName && !mesh.skeleton && (
            meshName === 'head' ||
            meshName === 'hair' ||
            meshName.includes('head_') ||
            meshName.includes('hair_') ||
            meshName.includes('beard') ||
            meshName.includes('eyebrow')
          )) {
            headMeshesRef.current.push(mesh);
            console.log('Found head component to hide when face appears:', mesh.name);
          } else if (mesh.skeleton && mesh instanceof Mesh) {
            // This is the main body mesh with skeleton
            console.log('Main body mesh with skeleton:', mesh.name);
          }
        });

        console.log(`Created player root box: ${player.name}, with ${meshes.length} child meshes`);
        let skeleton = skeletons[0];

        // Find the actual character mesh for skeleton viewer
        const characterMesh = meshes.find(m => m instanceof Mesh && m.skeleton) as Mesh;

        if (props.options.boneDebug.current && characterMesh) {
          const skeletonViewer = new SkeletonViewer(skeleton, characterMesh, scene!, false, 3, {
            displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
          });
          skeletonViewer.isEnabled = true;
        }

        // Store skeleton reference on the character mesh if it exists
        if (characterMesh) {
          characterMesh.skeleton = skeleton;
          skeleton.enableBlending(0.1);

          // Check if the mesh has a material before accessing it
          if (characterMesh.material && characterMesh.material instanceof StandardMaterial) {
            const sm = characterMesh.material as StandardMaterial;
            if (sm.diffuseTexture != null) {
              sm.backFaceCulling = true;
              sm.ambientColor = new Color3(1, 1, 1);
            }
          }
        } else if (skeleton) {
          // If no specific character mesh found, just enable blending on the skeleton
          skeleton.enableBlending(0.1);
        }

        const bodyUnsubscribe = props.bodySubscription?.subscribe(body => {
          if (!scene) return;
          props.options.renderFace.current && !!body.face && updateFace(scene, faceModelRef, player, skeleton, body.face, headMeshesRef.current);
          updateSkeleton(body.skeleton, skeleton, props.options);
        });

        const faceUnsubscribe = props.faceSubscription?.subscribe(face =>
          !!face && updateFace(scene!, faceModelRef, player, skeleton, face, headMeshesRef.current));

        // Don't call playerReady again - it was already called after creating the box

        return () => {
          bodyUnsubscribe?.();
          faceUnsubscribe?.();
        };
      } catch (error) {
        console.error('Failed to load character model:', error);
      }
    };

    loadCharacterModel();
  }, [scene, isInitialized]);
  return null;
}
