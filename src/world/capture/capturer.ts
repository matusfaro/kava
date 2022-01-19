import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { Results } from "@mediapipe/holistic";
import { SkeletonUpdate } from "./BodyCapture";
import { FaceChin, FaceEyeLeft, FaceEyeRight } from "./faceConst";

const scaleMultiplier = 0.2;

type BoneDefinition = [
  // Unit vector defining bone forward direction from local space
  boneForward: Vector3,
  // Unit vector defining bone up direction from local space
  boneUp: Vector3,
  // Vector pointing to the end of the bone from local space including magnitude
  target: Vector3,
  // Optional unit vector pointing to the up direction of the target
  // causing a twist of the bone. If omitted, there is no twist.
  targetUp: Vector3 | undefined,
] | undefined;
interface BoneMapping {
  boneNames: Array<string>;
  getDef: (
    r: Results,
    rotationParent: Quaternion,
    defParent?: BoneDefinition,
  ) => (BoneDefinition | undefined);
  children?: Array<BoneMapping>;
}

const worldUp = Vector3.Up();
const worldForward = Vector3.Forward();

const boneHands: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'Hand.L' : 'Hand.R'],
  getDef: (r, rotationParent, defParent) => {
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
    const fingerIndex = getPoseLandmark(r, isLeft ? 19 : 20);
    const fingerLittle = getPoseLandmark(r, isLeft ? 17 : 18);
    if (!elbow || !wrist || !fingerIndex || !fingerLittle) return undefined;

    const boneForward = wrist.subtract(elbow).normalize();
    const boneUp = defParent?.[1].normalizeToNew() || worldUp;

    const handCenter = Vector3.Center(fingerIndex, fingerLittle);
    const target = handCenter.subtract(wrist).normalize();
    const targetUp = Vector3.Cross(
      target,
      fingerIndex.subtract(fingerLittle).normalize());

    return [boneForward, boneUp, target, targetUp];
  },
  children: [],
}));
const boneLowerArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'LowerArm.L' : 'LowerArm.R'],
  getDef: (r, rotationParent, defParent) => {
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
    if (!defParent || !shoulder || !elbow || !wrist) return undefined;
    const boneForward = elbow.subtract(shoulder).normalize();
    const boneUp = defParent?.[1].normalizeToNew() || worldUp;
    const target = wrist.subtract(elbow).normalize();

    return [boneForward, boneUp, target, undefined];
  },
  children: [boneHands[isLeft ? 0 : 1]],
}));
const boneUpperArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'UpperArm.L' : 'UpperArm.R'],
  getDef: (r, rotationParent, defParent) => {
    const shoulderOther = getPoseLandmark(r, isLeft ? 12 : 11);
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    if (!rotationParent || !shoulder || !shoulderOther || !elbow) return undefined;
    const boneForward = shoulder.subtract(shoulderOther).normalize();
    const boneUp = defParent?.[0].normalizeToNew() || worldUp;
    const target = elbow.subtract(shoulder).normalize();

    return [boneForward, boneUp, target, undefined];
  },
  children: [boneLowerArms[isLeft ? 0 : 1]],
}));
const boneHead: BoneMapping = {
  boneNames: ['Head'],
  getDef: (r, parentRotation, defParent) => {
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    const eyeLeft = getFaceLandmark(r, FaceEyeLeft);
    const eyeRight = getFaceLandmark(r, FaceEyeRight);
    const chin = getFaceLandmark(r, FaceChin);
    if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight || !chin) return undefined;
    const boneForward = defParent?.[2] || worldUp;
    const boneUp = defParent?.[1] || worldForward; // Is this right?

    const eyeCenter = Vector3.Center(eyeLeft, eyeRight);
    const faceUp = eyeCenter.subtract(chin).normalize();
    const eyeLine = eyeRight.subtract(eyeLeft).normalize();
    const faceBack = Vector3.Cross(faceUp, eyeLine).normalize();

    return [boneForward, boneUp, faceUp, faceBack];
  },
  children: [],
};
const boneNeck: BoneMapping = {
  boneNames: ['Neck'],
  getDef: (r, parentRotation, defParent) => {
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    const eyeLeft = getFaceLandmark(r, FaceEyeLeft);
    const eyeRight = getFaceLandmark(r, FaceEyeRight);
    if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight) return undefined;
    const boneForward = defParent?.[2]?.normalizeToNew() || worldUp;
    const shoulder = shoulderRight.subtract(shoulderLeft).normalize();
    const boneUp = Vector3.Cross(shoulder, boneForward).normalize();

    const eyeCenter = Vector3.Center(eyeLeft, eyeRight);
    const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
    const target = eyeCenter.subtract(shoulderCenter);

    return [boneForward, boneUp, target, undefined];
  },
  children: [boneHead],
};
const boneSpine: BoneMapping = {
  boneNames: ['Spine', 'Chest', 'UpperChest'],
  getDef: (r, parentRotation, defParent) => {
    const hipLeft = getPoseLandmark(r, 23);
    const hipRight = getPoseLandmark(r, 24);
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) return undefined;
    const hip = hipRight.subtract(hipLeft);
    const shoulder = shoulderRight.subtract(shoulderLeft).normalize();
    const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
    const hipCenter = Vector3.Center(hipLeft, hipRight);

    const boneForward = worldUp;
    const boneUp = Vector3.Cross(hip, boneForward).normalize();
    const target = shoulderCenter.subtract(hipCenter).normalize();
    const targetUp = Vector3.Cross(target, shoulder).normalize().negate();

    return [boneForward, boneUp, target, targetUp];
  },
  children: [
    boneNeck,
    ...boneUpperArms,
  ],
};

export class Capturer {
  rotations: { [boneName: string]: Quaternion } = {};

  capture(r: Results, updates: SkeletonUpdate): boolean {
    return this.captureBonesRecursively(
      r,
      updates,
      false,
      boneSpine,
      // boneNeck,
      // boneUpperArms[0],
      Quaternion.Identity());
  }

  captureBonesRecursively(r: Results, updates: SkeletonUpdate, changed: boolean, bone: BoneMapping, rotationParent: Quaternion, defParent?: BoneDefinition): boolean {
    const rotation = this.rotations[bone.boneNames[0]] || Quaternion.Identity();
    const def = bone.getDef(r, rotationParent, defParent);

    if (def !== undefined) {
      const [boneForward, boneUp, target, targetUp] = def;

      // TODO rotate using this: https://stackoverflow.com/a/52551983
      // https://stackoverflow.com/questions/349050/calculating-a-lookat-matrix
      // Based on Matrix.LookAtLH
      const rotZ = target.normalizeToNew();
      const rotX = Vector3.Cross((targetUp || boneUp).normalizeToNew(), rotZ).normalize();
      const rotY = Vector3.Cross(rotZ, rotX).normalize();

      // Normalize against local space of bone
      // https://stackoverflow.com/questions/22010632/one-vector3-related-to-a-plane-copy-it-to-another-plane
      const rotLocalY = boneForward.normalizeToNew();
      const rotLocalZ = boneUp.normalizeToNew().negateInPlace();
      const rotLocalX = Vector3.Cross(rotLocalY, rotLocalZ).normalize();
      const rotLocalMatrix = Matrix.FromValues(
        rotLocalX._x, rotLocalY._x, rotLocalZ._x, 0.0,
        rotLocalX._y, rotLocalY._y, rotLocalZ._y, 0.0,
        rotLocalX._z, rotLocalY._z, rotLocalZ._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      ).transpose().invert();
      Vector3.TransformNormalToRef(rotX, rotLocalMatrix, rotX);
      Vector3.TransformNormalToRef(rotY, rotLocalMatrix, rotY);
      Vector3.TransformNormalToRef(rotZ, rotLocalMatrix, rotZ);

      const rotMatrix = Matrix.FromValues(
        rotX._x, rotY._x, rotZ._x, 0.0,
        rotX._y, rotY._y, rotZ._y, 0.0,
        rotX._z, rotY._z, rotZ._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      ).transpose();

      const boneLength = target.length() * scaleMultiplier;

      const numBones = bone.boneNames.length;
      const rotation = Quaternion.FromRotationMatrix(rotMatrix);

      // const debugBoneName = bone.boneNames[bone.boneNames.length - 1];
      // debugAxesTool.update({ name: 'worldForward' + debugBoneName, boneName: debugBoneName, direction: worldForward, color: Color3.Green() });
      // debugAxesTool.update({ name: 'worldUp' + debugBoneName, boneName: debugBoneName, direction: worldUp, color: Color3.Red() });
      // debugAxesTool.update({ name: 'targetNormalized' + debugBoneName, boneName: debugBoneName, direction: rotZ, color: Color3.Yellow() });

      // Old way of normalizing local space
      // const rotationLocal = Quaternion.FromRotationMatrix(rotLocalMatrix).conjugateInPlace();
      // rotation.multiplyInPlace(rotationLocal);

      const rotationScaled = numBones === 1 ? rotation : rotation.scale(1 / numBones);

      changed = true;
      bone.boneNames.forEach(boneName => updates.push({
        n: boneName,
        // s: boneLength, TODO reenable
        q: rotationScaled,
      }));
    }

    changed = bone.children?.map(childBone => this.captureBonesRecursively(
      r, updates, changed, childBone, rotation, def))
      .some(c => c) || changed;

    return changed;
  }
}

// TODO For fun, figure out a better way to define conditional return type here
// Idea is to have the return value as always defined if both args are alwasy defined
const calcCenter = <V1 extends Vector3 | undefined, V2 extends Vector3 | undefined>(left?: V1, right?: V2): V1 extends undefined
  ? Vector3 | undefined
  : (V2 extends undefined
    ? Vector3 | undefined
    : Vector3) =>
  (left === undefined || right === undefined) ? undefined as any : new Vector3(
    (right.x + left.x) / 2,
    (right.y + left.y) / 2,
    (right.z + left.z) / 2,
  );

const getPoseLandmark = (holistic: Results, index: number): Vector3 | undefined => {
  const landmark = holistic.poseLandmarks?.[index];
  return landmark === undefined ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}

const getFaceLandmark = (holistic: Results, index: number): Vector3 | undefined => {
  const landmark = holistic.faceLandmarks?.[index];
  return landmark === undefined ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}
