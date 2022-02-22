import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { NormalizedLandmarkList, Results } from "@mediapipe/holistic";
import { GameOptions } from "../../App";
import { debugAxesTool } from "../DebugAxes";
import { SkeletonUpdate } from "./BodyCapture";
import { FaceChin, FaceEyeLeft, FaceEyeRight } from "./faceConst";
var Kalman = require('kalmanjs')

const ScaleMultiplier = 0.2;
export const VisibilityThreshold = -1;
// Preview properties: https://benwinding.github.io/kalmanjs-examples/examples/demo2-vue.html
const KalmanProps = {
  R: 0.01,
  Q: 2,
  A: 1.5,
  B: 1,
  C: 2
};

interface ResultsWrapped {
  getPoseLandmark(index: number): Vector3 | undefined;
  getFaceLandmark(index: number): Vector3 | undefined;
  raw: Results;
}
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
    r: ResultsWrapped,
    defParent?: BoneDefinition,
  ) => (BoneDefinition | undefined);
  children?: Array<BoneMapping>;
}

const boneHands: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'Hand.L' : 'Hand.R'],
  getDef: (r, defParent) => {
    const elbow = r.getPoseLandmark(isLeft ? 13 : 14);
    const wrist = r.getPoseLandmark(isLeft ? 15 : 16);
    const fingerIndex = r.getPoseLandmark(isLeft ? 19 : 20);
    const fingerLittle = r.getPoseLandmark(isLeft ? 17 : 18);
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
  getDef: (r, defParent) => {
    const shoulder = r.getPoseLandmark(isLeft ? 11 : 12);
    const elbow = r.getPoseLandmark(isLeft ? 13 : 14);
    const wrist = r.getPoseLandmark(isLeft ? 15 : 16);
    if (!shoulder || !elbow || !wrist) return undefined;
    const boneUp = elbow.subtract(shoulder).normalize();
    const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Up();
    const target = wrist.subtract(elbow);

    return [boneUp, boneBackward, target, undefined];
  },
  children: [boneHands[isLeft ? 0 : 1]],
}));
const boneUpperArms: BoneMapping[] = [true, false].map(isLeft => ({
  boneNames: [isLeft ? 'UpperArm.L' : 'UpperArm.R'],
  getDef: (r, defParent) => {
    const shoulderOther = r.getPoseLandmark(isLeft ? 12 : 11);
    const shoulder = r.getPoseLandmark(isLeft ? 11 : 12);
    const elbow = r.getPoseLandmark(isLeft ? 13 : 14);
    if (!shoulder || !shoulderOther || !elbow) return undefined;
    const boneUp = shoulder.subtract(shoulderOther).normalize();
    const boneBackward = defParent?.[0].normalizeToNew() || Vector3.Up();
    const target = elbow.subtract(shoulder);

    return [boneUp, boneBackward, target, undefined];
  },
  children: [boneLowerArms[isLeft ? 0 : 1]],
}));
const boneHead: BoneMapping = {
  boneNames: ['Head'],
  getDef: (r, defParent) => {
    const shoulderLeft = r.getPoseLandmark(11);
    const shoulderRight = r.getPoseLandmark(12);
    const eyeLeft = r.getFaceLandmark(FaceEyeLeft);
    const eyeRight = r.getFaceLandmark(FaceEyeRight);
    const chin = r.getFaceLandmark(FaceChin);
    if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight || !chin) return undefined;
    var boneUp, boneBackward;
    if (!defParent) {
      boneUp = Vector3.Up();
      boneBackward = Vector3.Backward();
    } else {
      boneUp = defParent[2].normalizeToNew();
      boneBackward = defParent[1];
    }

    const eyeCenter = Vector3.Center(eyeRight, eyeLeft);
    const target = eyeCenter.subtract(chin).normalize();
    const eyeLine = eyeRight.subtract(eyeLeft).normalize();
    const targetBackward = Vector3.Cross(eyeLine, target).normalize();

    return [boneUp, boneBackward, target, targetBackward];
  },
  children: [],
};
const boneNeck: BoneMapping = {
  boneNames: ['Neck'],
  getDef: (r, defParent) => {
    const shoulderLeft = r.getPoseLandmark(11);
    const shoulderRight = r.getPoseLandmark(12);
    const eyeLeft = r.getFaceLandmark(FaceEyeLeft);
    const eyeRight = r.getFaceLandmark(FaceEyeRight);
    if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight) return undefined;
    const boneUp = defParent?.[2]?.normalizeToNew() || Vector3.Up();
    const shoulder = shoulderRight.subtract(shoulderLeft).normalize();
    const boneBackward = Vector3.Cross(boneUp, shoulder).normalize();

    const eyeCenter = Vector3.Center(eyeRight, eyeLeft);
    const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
    const target = eyeCenter.subtract(shoulderCenter);

    return [boneUp, boneBackward, target, undefined];
  },
  children: [boneHead],
};
const boneBack: BoneMapping = {
  boneNames: ['Spine', 'Chest', 'UpperChest'],
  getDef: (r, defParent) => {
    const hipLeft = r.getPoseLandmark(23);
    const hipRight = r.getPoseLandmark(24);
    const shoulderLeft = r.getPoseLandmark(11);
    const shoulderRight = r.getPoseLandmark(12);
    if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) return undefined;
    const hip = hipRight.subtract(hipLeft).normalize();
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

const rootBone = boneBack;

export const allBoneNames: string[] = [];
const getAllBoneNames = (bone: BoneMapping) => {
  bone.boneNames.forEach(boneName => allBoneNames.push(boneName));
  bone.children?.forEach(bone => getAllBoneNames(bone));
}
getAllBoneNames(rootBone);

export class Capturer {
  options: GameOptions;
  bonePrevDef: { [boneName: string]: BoneDefinition } = {};
  readonly kalmanState: KalmanState = {};

  constructor(options: GameOptions) { this.options = options }

  capture(r: Results, updates: SkeletonUpdate, options: GameOptions): boolean {
    const cachedPoseLandmarks: { [index: number]: Vector3 } = {};
    const cachedFaceLandmarks: { [index: number]: Vector3 } = {};
    return this.captureBonesRecursively(
      {
        getPoseLandmark: index => this.getPoseLandmark(r, index, cachedPoseLandmarks),
        getFaceLandmark: index => this.getFaceLandmark(r, index, cachedFaceLandmarks),
        raw: r,
      },
      updates,
      options,
      false,
      rootBone);
  }

  captureBonesRecursively(r: ResultsWrapped, updates: SkeletonUpdate, options: GameOptions, changed: boolean, bone: BoneMapping, defParent?: BoneDefinition): boolean {
    const boneEnabled = !options.boneName.current || bone.boneNames.some(boneName => boneName === options.boneName.current);
    var def = boneEnabled ? bone.getDef(r, defParent) : undefined;
    const firstBoneName = bone.boneNames[bone.boneNames.length - 1];

    if (def !== undefined) {
      const [boneUp, boneBackward, target, targetBackward] = def;
      boneUp.normalize();
      boneBackward.normalize();
      targetBackward?.normalize();

      // Matrix.LookAtLH
      // https://stackoverflow.com/a/52551983
      // https://stackoverflow.com/questions/349050/calculating-a-lookat-matrix
      const rotUp = target.normalizeToNew();
      const rotRight = Vector3.Cross(rotUp, targetBackward || boneBackward).normalize();
      const rotForward = Vector3.Cross(rotRight, rotUp).normalize();

      // Normalize against local space of bone
      // https://stackoverflow.com/questions/22010632/one-vector3-related-to-a-plane-copy-it-to-another-plane
      const rotNormalUp = boneUp;
      const rotNormalRight = Vector3.Cross(rotNormalUp, boneBackward).normalize();
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

      if (this.options.boneDebug.current) {
        debugAxesTool.update({ name: 'worldForward' + firstBoneName, boneName: firstBoneName, direction: Vector3.Forward(), color: Color3.FromInts(0, 153, 0 /* Dark green */) });
        debugAxesTool.update({ name: 'worldUp' + firstBoneName, boneName: firstBoneName, direction: Vector3.Up(), color: Color3.FromInts(153, 0, 0 /* Dark red */) });
        debugAxesTool.update({ name: 'worldRight' + firstBoneName, boneName: firstBoneName, direction: Vector3.Right(), color: Color3.FromInts(0, 0, 153 /* Dark blue */) });
        debugAxesTool.update({ name: 'rotForward' + firstBoneName, boneName: firstBoneName, direction: rotForward, color: Color3.Green() });
        debugAxesTool.update({ name: 'rotUp' + firstBoneName, boneName: firstBoneName, direction: rotUp, color: Color3.Red() });
        debugAxesTool.update({ name: 'rotRight' + firstBoneName, boneName: firstBoneName, direction: rotRight, color: Color3.Blue() });
      }

      const rotationScaled = numBones === 1 ? rotation : rotation.scale(1 / numBones);
      const boneLengthScaled = numBones === 1 ? boneLength : boneLength / numBones;

      changed = true;
      bone.boneNames.forEach(boneName => updates.push({
        n: boneName,
        // s: boneLengthScaled, TODO fixup and re-enable scaling
        q: rotationScaled,
      }));
    }

    if (def) {
      this.bonePrevDef[firstBoneName] = def;
    } else {
      def = this.bonePrevDef[firstBoneName];
    }

    changed = bone.children?.map(childBone => this.captureBonesRecursively(
      r, updates, options, changed, childBone, def))
      .some(c => c) || changed;

    return changed;
  }

  getPoseLandmark(holistic: Results, index: number, cachedLandmarks: { [index: number]: Vector3 }): Vector3 | undefined {
    return this.getLandmark(holistic.poseLandmarks, index, 0, cachedLandmarks)
  }

  getFaceLandmark(holistic: Results, index: number, cachedLandmarks: { [index: number]: Vector3 }): Vector3 | undefined {
    return this.getLandmark(holistic.faceLandmarks, index, 1000, cachedLandmarks)
  }

  getLandmark(landmarklist: NormalizedLandmarkList | undefined, index: number, globalIndexOffset: number, cachedLandmarks: { [index: number]: Vector3 }): Vector3 | undefined {
    // Check cache
    var landmarkVector = cachedLandmarks[index];
    if (landmarkVector) return landmarkVector;

    const landmark = landmarklist?.[index];
    if (!landmark || ((landmark?.visibility || 0) < VisibilityThreshold)) return undefined;

    landmarkVector = new Vector3(
      landmark.x,
      1 - landmark.y, // Normalize from mediapipe to babylonjs
      1 - landmark.z, // Normalize from mediapipe to babylonjs
    );

    this.smoothLandmarkInPlace(index + globalIndexOffset, landmarkVector);

    cachedLandmarks[index] = landmarkVector;

    return landmarkVector;
  }

  /** https://github.com/wouterbulten/kalmanjs */
  smoothLandmarkInPlace(index: number, input: Vector3) {
    var state = this.kalmanState[index];
    if (!state) {
      state = [new Kalman(KalmanProps), new Kalman(KalmanProps), new Kalman(KalmanProps)];
      this.kalmanState[index] = state;
    }

    input.set(
      state[0].filter(input.x),
      state[1].filter(input.y),
      state[2].filter(input.z),
    );
  }
}


interface KalmanObject {
  filter(input: number): number;
};
type KalmanState = { [vectorId: number]: [KalmanObject, KalmanObject, KalmanObject] };
