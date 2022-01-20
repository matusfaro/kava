import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { Results } from "@mediapipe/holistic";
import { debugAxesTool } from "../DebugAxes";
import { SkeletonUpdate } from "./BodyCapture";
import { FaceChin, FaceEyeLeft, FaceEyeRight } from "./faceConst";

const ScaleMultiplier = 0.2;
const VisibilityThreshold = -1;
const BoneDebugAxesEnabled = false;

type BoneDefinition = [
  // Unit vector defining bone up direction from local space
  boneUp: Vector3,
  // Unit vector defining bone backward direction from local space
  boneBackward: Vector3,
  // Vector pointing to the end of the bone from local space including magnitude
  target: Vector3,
  // Optional unit vector pointing to the backward direction of the target
  // causing a twist of the bone. If omitted, there is no twist.
  targetBackward: Vector3 | undefined,
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

const boneHands: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'Hand.L' : 'Hand.R'],
  getDef: (r, rotationParent, defParent) => {
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
    const fingerIndex = getPoseLandmark(r, isLeft ? 19 : 20);
    const fingerLittle = getPoseLandmark(r, isLeft ? 17 : 18);
    if (!elbow || !wrist || !fingerIndex || !fingerLittle) return undefined;

    const boneUp = wrist.subtract(elbow).normalize();
    const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Up();

    const handCenter = Vector3.Center(fingerIndex, fingerLittle);
    const target = handCenter.subtract(wrist);
    const fingers = (isLeft
      ? fingerLittle.subtract(fingerIndex)
      : fingerIndex.subtract(fingerLittle)).normalize()
    const targetBackward = Vector3.Cross(target.normalizeToNew(), fingers);

    return [boneUp, boneBackward, target, targetBackward];
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
    const boneUp = elbow.subtract(shoulder).normalize();
    const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Up();
    const target = wrist.subtract(elbow);

    return [boneUp, boneBackward, target, undefined];
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
    const boneUp = shoulder.subtract(shoulderOther).normalize();
    const boneBackward = defParent?.[0].normalizeToNew() || Vector3.Forward();
    const target = elbow.subtract(shoulder);

    return [boneUp, boneBackward, target, undefined];
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
    const boneUp = defParent?.[2] || Vector3.Up();
    const boneBackward = defParent?.[1] || Vector3.Forward(); // Is this right?

    const eyeCenter = Vector3.Center(eyeLeft, eyeRight);
    const target = eyeCenter.subtract(chin);
    const eyeLine = eyeRight.subtract(eyeLeft).normalize();
    const targetBackward = Vector3.Cross(eyeLine, target).normalize();

    return [boneUp, boneBackward, target, targetBackward];
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
    const boneUp = defParent?.[2]?.normalizeToNew() || Vector3.Up();
    const shoulder = shoulderRight.subtract(shoulderLeft).normalize();
    const boneBackward = Vector3.Cross(shoulder, boneUp).normalize();

    const eyeCenter = Vector3.Center(eyeLeft, eyeRight);
    const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
    const target = eyeCenter.subtract(shoulderCenter);

    return [boneUp, boneBackward, target, undefined];
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

    const boneUp = Vector3.Up();
    const boneBackward = Vector3.Cross(hip, boneUp).normalize();
    const target = shoulderCenter.subtract(hipCenter);
    const targetBackward = Vector3.Cross(shoulder, target.normalizeToNew()).normalize();

    return [boneUp, boneBackward, target, targetBackward];
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
      const [boneUp, boneBackward, target, targetBackward] = def;
      boneUp.normalize();
      boneBackward.normalize();
      targetBackward?.normalize();

      // Matrix.LookAtLH
      // https://stackoverflow.com/a/52551983
      // https://stackoverflow.com/questions/349050/calculating-a-lookat-matrix
      const rotUp = target.normalizeToNew();
      const rotRight = Vector3.Cross(targetBackward || boneBackward, rotUp).normalize();
      const rotForward = Vector3.Cross(rotRight, rotUp).normalize();

      // Normalize against local space of bone
      // https://stackoverflow.com/questions/22010632/one-vector3-related-to-a-plane-copy-it-to-another-plane
      const rotNormalUp = boneUp;
      const rotNormalRight = Vector3.Cross(boneBackward, rotNormalUp).normalize();
      const rotNormalForward = Vector3.Cross(rotNormalRight, rotNormalUp).normalize();
      const rotLocalMatrix = Matrix.FromValues(
        rotNormalRight._x, rotNormalUp._x, rotNormalForward._x, 0.0,
        rotNormalRight._y, rotNormalUp._y, rotNormalForward._y, 0.0,
        rotNormalRight._z, rotNormalUp._z, rotNormalForward._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      ).transpose().invert().getRotationMatrix();
      Vector3.TransformNormalToRef(rotRight, rotLocalMatrix, rotRight);
      Vector3.TransformNormalToRef(rotUp, rotLocalMatrix, rotUp);
      Vector3.TransformNormalToRef(rotForward, rotLocalMatrix, rotForward);

      const rotMatrix = Matrix.FromValues(
        rotRight._x, rotUp._x, rotForward._x, 0.0,
        rotRight._y, rotUp._y, rotForward._y, 0.0,
        rotRight._z, rotUp._z, rotForward._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      ).transpose().getRotationMatrix();

      const boneLength = target.length() * ScaleMultiplier;

      const numBones = bone.boneNames.length;
      const rotation = Quaternion.FromRotationMatrix(rotMatrix);

      if (BoneDebugAxesEnabled) {
        const debugBoneName = bone.boneNames[bone.boneNames.length - 1];
        debugAxesTool.update({ name: 'worldForward' + debugBoneName, boneName: debugBoneName, direction: Vector3.Forward(), color: Color3.Green() });
        debugAxesTool.update({ name: 'worldUp' + debugBoneName, boneName: debugBoneName, direction: Vector3.Up(), color: Color3.Red() });
        debugAxesTool.update({ name: 'worldRight' + debugBoneName, boneName: debugBoneName, direction: Vector3.Right(), color: Color3.Blue() });
        debugAxesTool.update({ name: 'rotForward' + debugBoneName, boneName: debugBoneName, direction: rotForward, color: Color3.FromInts(0, 153, 0 /* Dark green */) });
        debugAxesTool.update({ name: 'rotUp' + debugBoneName, boneName: debugBoneName, direction: rotUp, color: Color3.FromInts(153, 0, 0 /* Dark red */) });
        debugAxesTool.update({ name: 'rotRight' + debugBoneName, boneName: debugBoneName, direction: rotRight, color: Color3.FromInts(0, 0, 153 /* Dark blue */) });
      }

      // Old way of normalizing local space
      // const rotationLocal = Quaternion.FromRotationMatrix(rotLocalMatrix).conjugateInPlace();
      // rotation.multiplyInPlace(rotationLocal);

      const rotationScaled = numBones === 1 ? rotation : rotation.scale(1 / numBones);

      changed = true;
      bone.boneNames.forEach(boneName => updates.push({
        n: boneName,
        s: boneLength,
        q: rotationScaled,
      }));
    }

    changed = bone.children?.map(childBone => this.captureBonesRecursively(
      r, updates, changed, childBone, rotation, def))
      .some(c => c) || changed;

    return changed;
  }
}

const getPoseLandmark = (holistic: Results, index: number): Vector3 | undefined => {
  const landmark = holistic.poseLandmarks?.[index];
  return !landmark || ((landmark?.visibility || 0) < VisibilityThreshold)
    ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}

const getFaceLandmark = (holistic: Results, index: number): Vector3 | undefined => {
  const landmark = holistic.faceLandmarks?.[index];
  return !landmark || ((landmark.visibility || 0) < VisibilityThreshold)
    ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}
