import { Quaternion, Vector3 } from "@babylonjs/core";
import { Results } from "@mediapipe/holistic";
import { SkeletonUpdate } from "./BodyCapture";

const scaleMultiplier = 0.2;

type BoneDefinition = [
  y: Vector3, // Unit vector defining up direction from local space
  z: Vector3, // Unit vector defining which way bone naturally bends from local space
  target: Vector3, // Vector pointing to the end of the bone from local space
] | undefined;
interface BoneMapping {
  boneNames: Array<string>;
  getDef: (
    r: Results,
    rotationParent: Quaternion,
    defParent?: BoneDefinition,
  ) => BoneDefinition,
  children?: Array<BoneMapping>
}


const boneLowerArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'LowerArm.L' : 'LowerArm.R'],
  getDef: (r, rotationParent, defParent) => {
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    const wrist = getPoseLandmark(r, isLeft ? 15 : 16);
    if (!defParent || !shoulder || !elbow || !wrist) return undefined;
    const y = elbow?.subtract(shoulder).normalize();
    const z = Vector3.Cross(elbow, defParent[2]);
    const target = wrist.subtract(elbow);
    return [y, z, target];
  },
  children: [],
}));
const boneUpperArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'UpperArm.L' : 'UpperArm.R'],
  getDef: (r, rotationParent, defParent) => {
    const shoulder = getPoseLandmark(r, isLeft ? 11 : 12);
    const shoulderOther = getPoseLandmark(r, isLeft ? 12 : 11);
    const elbow = getPoseLandmark(r, isLeft ? 13 : 14);
    if (!rotationParent || !shoulder || !shoulderOther || !elbow) return undefined;
    const y = shoulder?.subtract(shoulderOther).normalize();
    const toHips = new Vector3();
    boneRootDirection.rotateByQuaternionToRef(rotationParent, toHips);
    toHips.negate().normalize();
    const z = toHips;
    const target = elbow.subtract(shoulder);
    return [y, z, target];
  },
  children: [boneLowerArms[isLeft ? 0 : 1]],
}));
const boneRootDirection = new Vector3(0, 1, 0);
const boneRoot: BoneMapping = {
  boneNames: ['Spine', 'Chest', 'UpperChest'],
  getDef: (r, parentRotation, defParent) => {
    const hipLeft = getPoseLandmark(r, 23);
    const hipRight = getPoseLandmark(r, 24);
    const shoulderLeft = getPoseLandmark(r, 11);
    const shoulderRight = getPoseLandmark(r, 12);
    if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) return undefined;
    const z = Vector3.Cross(hipLeft.subtract(hipRight), boneRootDirection).normalize();
    const target = calcCenter(shoulderLeft, shoulderRight).subtract(calcCenter(hipLeft, hipRight));
    return [boneRootDirection, z, target];
  },
  children: [...boneUpperArms],
};

export class Capturer {
  rotations: { [boneName: string]: Quaternion } = {};

  capture(r: Results, updates: SkeletonUpdate, changed: boolean = false, bone: BoneMapping = boneRoot, rotationParent: Quaternion = Quaternion.Identity(), defParent?: BoneDefinition): boolean {
    const rotation = this.rotations[bone.boneNames[0]] || Quaternion.Identity();
    const def = bone.getDef(r, rotationParent, defParent);

    if (def) {
      const [y, z, target] = def;
      const x = Vector3.Cross(y, z);
      const bendInZ = Math.PI / 2 - Vector3.GetAngleBetweenVectors(
        target, z, x);
      const bendInX = Math.PI / 2 - Vector3.GetAngleBetweenVectors(
        target,
        x,
        z.negate());

      const boneLength = target.length() * scaleMultiplier;

      const numBones = bone.boneNames.length;
      const rotation = Quaternion.FromEulerAngles(bendInX, 0, bendInZ);
      const rotationScaled = numBones === 1 ? rotation : Quaternion.FromEulerAngles(bendInX / numBones, 0, bendInZ / numBones);

      changed = true;
      bone.boneNames.forEach(boneName => updates.push({
        n: boneName,
        s: boneLength,
        q: rotationScaled,
      }));
      rotation
    } else {

    }

    changed = bone.children?.map(childBone => this.capture(r, updates, changed, childBone, rotation, def))
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
  return !landmark ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}

const getFaceLandmark = (holistic: Results, index: number): Vector3 | undefined => {
  const landmark = holistic.faceLandmarks?.[index];
  return !landmark ? undefined : new Vector3(landmark.x, 1 - landmark.y, landmark.z);
}
