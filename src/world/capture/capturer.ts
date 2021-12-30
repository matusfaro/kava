import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { Results } from "@mediapipe/holistic";
import { debugAxesTool } from "../DebugAxes";
import { SkeletonUpdate } from "./BodyCapture";
import { FaceEyeLeft, FaceEyeRight } from "./faceConst";

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

// const boneHands: BoneMapping[] = [true, false].map(isLeft => ({
//   boneNames: [isLeft ? 'LowerArm.L' : 'LowerArm.R'],
//   getDef: (r, rotationParent, defParent) => {
//     const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
//     const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
//     const fingerThe = getPoseLandmark(r, isLeft ? 19 : 20);
//     const fingerLittle = getPoseLandmark(r, isLeft ? 17 : 18);
//     if (!elbow || !wrist || !fingerThe || !fingerLittle) return undefined;

//     TODO TODO TODO 

//     // TODO need to add an extra y rotation into BoneDefinition to account for cases like hands

//     const y = elbow?.subtract(shoulder).normalize();
//     const z = Vector3.Cross(elbow, defParent[2]);
//     const target = wrist.subtract(elbow);
//     return [y, z, target];
//   },
//   children: [],
// }));
const boneLowerArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'LowerArm.L' : 'LowerArm.R'],
  getDef: (r, rotationParent, defParent) => {
    // TODO
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
    if (!defParent || !shoulder || !elbow || !wrist) return undefined;
    const y = elbow?.subtract(shoulder).normalize();
    const z = Vector3.Cross(elbow, defParent[2]);
    const yTarget = wrist.subtract(elbow);
    return [y, z, yTarget, undefined];
  },
  children: [],
}));
const boneUpperArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'UpperArm.L' : 'UpperArm.R'],
  getDef: (r, rotationParent, defParent) => {
    // TODO
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const shoulderOther = getPoseLandmark(r, isLeft ? 12 : 11);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    if (!rotationParent || !shoulder || !shoulderOther || !elbow) return undefined;
    const y = shoulder?.subtract(shoulderOther).normalize();
    const toHips = new Vector3();
    worldUp.rotateByQuaternionToRef(rotationParent, toHips);
    toHips.negate().normalize();
    const z = toHips;
    const yTarget = elbow.subtract(shoulder);
    return [y, z, yTarget, undefined];
  },
  children: [boneLowerArms[isLeft ? 0 : 1]],
}));
const boneHead: BoneMapping = {
  boneNames: ['Head'],
  getDef: (r, parentRotation, defParent) => {
    // TODO
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    const eyeLeft = getPoseLandmark(r, 2);
    const eyeRight = getPoseLandmark(r, 5);
    const nose = getPoseLandmark(r, 0);
    if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight || !nose) return undefined;
    const shoulder = shoulderRight.subtract(shoulderLeft);
    const up = defParent?.[3] || worldUp;
    const forward = Vector3.Cross(shoulder, up).normalize().negate();

    const target = calcCenter(shoulderLeft, shoulderRight).subtract(nose);

    return [up, forward, target, undefined];
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
    const boneForward = defParent?.[3] || worldUp;
    const boneUp = Vector3.Cross(shoulderRight.subtract(shoulderLeft), boneForward).normalize();

    const eyeCenter = Vector3.Center(eyeLeft, eyeRight);
    const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
    const target = eyeCenter.subtract(shoulderCenter);

    return [boneForward, boneUp, target, undefined];
  },
  // children: [boneHead],
};
const boneSpine: BoneMapping = {
  boneNames: ['Spine', 'Chest', 'UpperChest'],
  getDef: (r, parentRotation, defParent) => {
    // TODO
    const hipLeft = getPoseLandmark(r, 23);
    const hipRight = getPoseLandmark(r, 24);
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) return undefined;
    const hip = hipRight.subtract(hipLeft);
    const z = Vector3.Cross(worldUp, hip).normalize();
    const y = Vector3.Cross(hip, z).normalize();
    const yTarget = calcCenter(shoulderLeft, shoulderRight).subtract(calcCenter(hipLeft, hipRight));
    const shoulder = shoulderRight.subtract(shoulderLeft);
    const zTarget = Vector3.Cross(yTarget, shoulder).normalize();
    return [y, z, yTarget, zTarget];
  },
  // children: [...boneUpperArms],
};

export class Capturer {
  rotations: { [boneName: string]: Quaternion } = {};

  capture(r: Results, updates: SkeletonUpdate): boolean {
    return this.captureBonesRecursively(
      r,
      updates,
      false,
      boneNeck,
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

      const rotLocalZ = boneForward;
      const rotLocalX = Vector3.Cross(boneUp, rotLocalZ).normalize();
      const rotLocalY = Vector3.Cross(rotLocalZ, rotLocalX).normalize();
      const rotLocalMatrix = Matrix.FromValues(
        rotLocalX._x, rotLocalY._x, rotLocalZ._x, 0.0,
        rotLocalX._y, rotLocalY._y, rotLocalZ._y, 0.0,
        rotLocalX._z, rotLocalY._z, rotLocalZ._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
      const rotationLocal = Quaternion.FromRotationMatrix(rotLocalMatrix).conjugateInPlace();


      // const worldBoneCross = Vector3.Cross(worldForward, boneForward).normalize();
      // const boneForwardNormalizeAngle = Vector3.GetAngleBetweenVectors(worldForward, boneForward, worldBoneCross);

      // const boneForwardDot = Vector3.Dot(worldForward, boneForward);
      // const rotZ = boneForwardNormalizeAngle > 0
      //   ? Vector3.TransformNormal(
      //     target.normalizeToNew(),
      //     Matrix.RotationAxis(
      //       worldBoneCross,
      //       boneForwardNormalizeAngle))
      //     .normalize()
      //   : target.normalizeToNew();

      const rotZ = target.normalizeToNew();
      const rotX = Vector3.Cross(targetUp || boneUp, rotZ).normalize();
      const rotY = Vector3.Cross(rotZ, rotX).normalize();

      // const rotXSquareLength = rotX.lengthSquared();
      // if (rotXSquareLength === 0) {
      //   rotX.x = 1.0;
      // } else {
      //   rotX.normalizeFromLength(Math.sqrt(rotXSquareLength));
      // }

      const rotMatrix = Matrix.FromValues(
        rotX._x, rotY._x, rotZ._x, 0.0,
        rotX._y, rotY._y, rotZ._y, 0.0,
        rotX._z, rotY._z, rotZ._z, 0.0,
        0.0, 0.0, 0.0, 1.0
      );

      const boneLength = target.length() * scaleMultiplier;

      const numBones = bone.boneNames.length;
      const rotation = Quaternion.FromRotationMatrix(rotMatrix);
      debugAxesTool.update({ name: 'rotX', boneName: 'Neck', direction: rotX.scale(5), color: Color3.Purple() });
      debugAxesTool.update({ name: 'rotY', boneName: 'Neck', direction: rotY.scale(5), color: Color3.Teal() });
      // debugAxesTool.update({ name: 'rotZ', boneName: 'Neck', direction: rotZ.scale(5), color: Color3.Purple() });
      // debugAxesTool.update({ name: 'rotLocalX', boneName: 'Neck', direction: rotLocalX.scale(5), color: Color3.Teal() });
      // debugAxesTool.update({ name: 'rotLocalY', boneName: 'Neck', direction: rotLocalY.scale(5), color: Color3.Teal() });
      // debugAxesTool.update({ name: 'rotLocalZ', boneName: 'Neck', direction: rotLocalZ.scale(5), color: Color3.Teal() });
      debugAxesTool.update({ name: 'boneForward', boneName: 'Neck', direction: boneForward, color: Color3.Green() });
      debugAxesTool.update({ name: 'boneUp', boneName: 'Neck', direction: boneUp, color: Color3.Red() });
      debugAxesTool.update({ name: 'target', boneName: 'Neck', direction: target, color: Color3.Blue() });
      targetUp && debugAxesTool.update({ name: 'targetUp', boneName: 'Neck', direction: targetUp, color: Color3.Black() });
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
