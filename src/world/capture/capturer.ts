import {Color3, Matrix, Quaternion, Vector3} from "@babylonjs/core";
import {GameOptions} from "../../App";
import {debugAxesTool} from "../DebugAxes";
import {SkeletonUpdate} from "./BodyCapture";
import {FaceChin, FaceEyeLeft, FaceEyeRight} from "./faceConst";

var Kalman = require('kalmanjs')

// Local type definitions for MediaPipe compatibility
interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

type NormalizedLandmarkList = NormalizedLandmark[];

interface Results {
    poseLandmarks: NormalizedLandmarkList;
    faceLandmarks: NormalizedLandmarkList;
    rightHandLandmarks?: NormalizedLandmarkList;
    leftHandLandmarks?: NormalizedLandmarkList;
    segmentationMask?: any;
    multiFaceGeometry?: any[];
    image: HTMLVideoElement | HTMLCanvasElement;
}

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

    getLeftHandLandmark(index: number): Vector3 | undefined;

    getRightHandLandmark(index: number): Vector3 | undefined;

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

// MediaPipe Pose Landmark Indices:
// Upper body: 11,12 (shoulders), 13,14 (elbows), 15,16 (wrists)
// Hands: 17,18 (pinky), 19,20 (index finger)
// Lower body: 23,24 (hips), 25,26 (knees), 27,28 (ankles)
// Feet: 29,30 (heels), 31,32 (foot index/toes)

const boneFeet: BoneMapping[] = [true, false].map(isLeft => ({
    boneNames: [isLeft ? 'Toes.L' : 'Toes.R'],
    getDef: (r, defParent) => {
        const ankle = r.getPoseLandmark(isLeft ? 27 : 28);
        const heel = r.getPoseLandmark(isLeft ? 29 : 30);
        const footIndex = r.getPoseLandmark(isLeft ? 31 : 32);
        if (!ankle || !heel || !footIndex) return undefined;

        // Foot bone up direction points from ankle toward knee (inherited from parent)
        const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();
        const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Forward();

        // Target points from ankle to toe
        const target = footIndex.subtract(ankle);

        // Calculate foot's natural cross direction for twist
        const heelToToe = footIndex.subtract(heel).normalize();
        const targetBackward = Vector3.Cross(target.normalizeToNew(), heelToToe);

        return [boneUp, boneBackward, target, targetBackward];
    },
    children: [],
}));

const boneLowerLegs: BoneMapping[] = [true, false].map(isLeft => ({
    boneNames: [isLeft ? 'Foot.L' : 'Foot.R', isLeft ? 'LowerLeg.L' : 'LowerLeg.R'],
    getDef: (r, defParent) => {
        const knee = r.getPoseLandmark(isLeft ? 25 : 26);
        const ankle = r.getPoseLandmark(isLeft ? 27 : 28);
        const heel = r.getPoseLandmark(isLeft ? 29 : 30);
        if (!knee || !ankle || !heel) return undefined;

        // Bone up points from knee to hip (from parent)
        const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();
        const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Forward();

        // Target from knee to ankle
        const target = ankle.subtract(knee);

        return [boneUp, boneBackward, target, undefined];
    },
    children: [boneFeet[isLeft ? 0 : 1]],
}));

const boneUpperLegs: BoneMapping[] = [true, false].map(isLeft => ({
    boneNames: [isLeft ? 'UpperLeg.L' : 'UpperLeg.R'],
    getDef: (r, defParent) => {
        const hipLeft = r.getPoseLandmark(23);
        const hipRight = r.getPoseLandmark(24);
        const hip = r.getPoseLandmark(isLeft ? 23 : 24);
        const knee = r.getPoseLandmark(isLeft ? 25 : 26);
        if (!hip || !hipLeft || !hipRight || !knee) return undefined;

        // Bone up: direction along spine (from hips upward)
        // This is the parent's target direction (hip→shoulder), which points upward
        const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();

        // Bone backward: inherited from spine (forward/backward orientation)
        const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Forward();

        // Target: from hip to knee (thigh direction)
        const target = knee.subtract(hip);

        // Target backward: use hip line to define leg's lateral orientation
        const hipLine = hipRight.subtract(hipLeft).normalize();
        // Cross product of target with hip line gives the knee's bend direction
        const targetBackward = Vector3.Cross(target.normalizeToNew(), hipLine);

        // Debug logging for left leg
        if (isLeft && Math.random() < 0.01) { // Log 1% of frames
            console.log('=== Left Upper Leg Debug ===');
            console.log('Hip:', hip.toString());
            console.log('Knee:', knee.toString());
            console.log('Target (hip→knee):', target.toString());
            console.log('Target normalized:', target.normalizeToNew().toString());
            console.log('Hip line:', hipLine.toString());
            console.log('Target backward:', targetBackward.toString());
            console.log('Bone up:', boneUp.toString());
            console.log('Bone backward:', boneBackward.toString());
        }

        return [boneUp, boneBackward, target, targetBackward];
    },
    children: [boneLowerLegs[isLeft ? 0 : 1]],
}));

// MediaPipe hand landmark indices:
// 0: WRIST
// 1-4: THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP
// 5-8: INDEX_FINGER_MCP, PIP, DIP, TIP
// 9-12: MIDDLE_FINGER_MCP, PIP, DIP, TIP
// 13-16: RING_FINGER_MCP, PIP, DIP, TIP
// 17-20: PINKY_MCP, PIP, DIP, TIP

// Helper to create finger bone mapping (3 bones per finger)
const createFingerBones = (
    isLeft: boolean,
    fingerName: string,
    mcp: number, // Metacarpophalangeal joint (knuckle)
    pip: number, // Proximal interphalangeal joint
    dip: number, // Distal interphalangeal joint
    tip: number  // Fingertip
): BoneMapping[] => {
    const prefix = isLeft ? '.L' : '.R';

    // Bone 2: DIP to TIP (fingertip segment)
    const bone2: BoneMapping = {
        boneNames: [`${fingerName}02${prefix}`],
        getDef: (r, defParent) => {
            const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
            const jointDip = getHandLandmark(dip);
            const jointTip = getHandLandmark(tip);
            if (!jointDip || !jointTip) return undefined;

            const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();
            const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Forward();
            const target = jointTip.subtract(jointDip); // Scaling applied via bone length field

            return [boneUp, boneBackward, target, undefined];
        },
        children: [],
    };

    // Bone 1: PIP to DIP (middle segment)
    const bone1: BoneMapping = {
        boneNames: [`${fingerName}01${prefix}`],
        getDef: (r, defParent) => {
            const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
            const jointPip = getHandLandmark(pip);
            const jointDip = getHandLandmark(dip);
            if (!jointPip || !jointDip) return undefined;

            const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();
            const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Forward();
            const target = jointDip.subtract(jointPip); // Scaling applied via bone length field

            return [boneUp, boneBackward, target, undefined];
        },
        children: [bone2],
    };

    // Bone 0: MCP to PIP (base segment from knuckle)
    const bone0: BoneMapping = {
        boneNames: [`${fingerName}${prefix}`],
        getDef: (r, defParent) => {
            // VERIFICATION: Check if we're using the correct hand for left/right
            const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
            const wrist = getHandLandmark(0); // Use wrist as anchor
            const jointMcp = getHandLandmark(mcp);
            const jointPip = getHandLandmark(pip);
            if (!wrist || !jointMcp || !jointPip) return undefined;

            // Bone up: direction from wrist toward knuckle
            const boneUp = jointMcp.subtract(wrist).normalize();

            // Bone backward: inherited from hand/parent
            const boneBackward = defParent?.[3] || defParent?.[1].normalizeToNew() || Vector3.Forward();

            // Target: from knuckle to first joint
            const target = jointPip.subtract(jointMcp); // Scaling applied via bone length field

            return [boneUp, boneBackward, target, undefined];
        },
        children: [bone1],
    };

    return [bone0];
};

// Thumb bone mapping with special boneUp for lateral extension
const createThumbBonesSpecial = (isLeft: boolean): BoneMapping[] => {
    const prefix = isLeft ? '.L' : '.R';

    // Reuse the standard finger bone structure but get children separately
    const standardThumb = createFingerBones(isLeft, 'FingerThumb', 1, 2, 3, 4)[0];
    const bone1 = standardThumb.children![0]; // Middle and tip segments

    // Custom base bone - thumb extends laterally from hand
    const bone0: BoneMapping = {
        boneNames: [`FingerThumb${prefix}`],
        getDef: (r, defParent) => {
            const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
            const jointCmc = getHandLandmark(1); // CMC joint (thumb base)
            const jointMcp = getHandLandmark(2); // MCP joint
            const jointIp = getHandLandmark(3); // IP joint

            if (!jointCmc || !jointMcp || !jointIp) return undefined;

            // Bone up: Use hand's target direction (palm extension) for proper thumb anchor
            // This differs from fingers which use wrist→knuckle
            const boneUp = defParent?.[2].normalizeToNew() || Vector3.Up();

            // Bone backward: inherited from hand orientation
            const boneBackward = defParent?.[3] || defParent?.[1].normalizeToNew() || Vector3.Forward();

            // Target: from CMC to MCP (base thumb segment)
            const target = jointMcp.subtract(jointCmc);

            // Calculate targetBackward for proper thumb twist
            const nextSegment = jointIp.subtract(jointMcp).normalize();
            const targetBackward = Vector3.Cross(target.normalizeToNew(), nextSegment);

            return [boneUp, boneBackward, target, targetBackward];
        },
        children: [bone1],
    };

    return [bone0];
};

// Create all finger bone mappings
const boneThumb = (isLeft: boolean) => createThumbBonesSpecial(isLeft);
const boneIndex = (isLeft: boolean) => createFingerBones(isLeft, 'FingerIndex', 5, 6, 7, 8);
const boneMiddle = (isLeft: boolean) => createFingerBones(isLeft, 'FingerMiddle', 9, 10, 11, 12);
const boneRing = (isLeft: boolean) => createFingerBones(isLeft, 'FingerRing', 13, 14, 15, 16);
const bonePinky = (isLeft: boolean) => createFingerBones(isLeft, 'FingerLittle', 17, 18, 19, 20);

const boneHands: BoneMapping[] = [true, false].map(isLeft => ({
    boneNames: [isLeft ? 'Hand.L' : 'Hand.R'],
    getDef: (r, defParent) => {
        const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
        const elbow = r.getPoseLandmark(isLeft ? 13 : 14);
        const wrist = r.getPoseLandmark(isLeft ? 15 : 16);

        // Use detailed hand landmarks for better rotation tracking
        const handWrist = getHandLandmark(0); // Hand landmark wrist
        const fingerIndexMcp = getHandLandmark(5); // Index knuckle
        const fingerMiddleMcp = getHandLandmark(9); // Middle knuckle
        const fingerPinkyMcp = getHandLandmark(17); // Pinky knuckle

        if (!elbow || !wrist || !handWrist || !fingerIndexMcp || !fingerPinkyMcp || !fingerMiddleMcp) return undefined;

        // Bone up: direction from elbow to wrist (along forearm)
        const boneUp = wrist.subtract(elbow).normalize();

        // Bone backward: inherited from parent (forearm orientation)
        const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Up();

        // Target: from pose wrist to middle finger knuckle (hand direction)
        const target = fingerMiddleMcp.subtract(handWrist);

        // Calculate palm orientation using knuckle line
        // Vector across knuckles from pinky to index
        const knuckleLine = (isLeft
            ? fingerIndexMcp.subtract(fingerPinkyMcp)
            : fingerPinkyMcp.subtract(fingerIndexMcp)).normalize();

        // Cross product gives palm normal for proper wrist rotation
        const targetBackward = Vector3.Cross(target.normalizeToNew(), knuckleLine).negate();

        return [boneUp, boneBackward, target, targetBackward];
    },
    // Attach all finger bones as children
    children: [
        ...boneThumb(isLeft),
        ...boneIndex(isLeft),
        ...boneMiddle(isLeft),
        ...boneRing(isLeft),
        ...bonePinky(isLeft),
    ],
}));
const boneLowerArms: BoneMapping[] = [true, false].map(isLeft => ({
    boneNames: [isLeft ? 'LowerArm.L' : 'LowerArm.R'],
    getDef: (r, defParent) => {
        const shoulder = r.getPoseLandmark(isLeft ? 11 : 12);
        const elbow = r.getPoseLandmark(isLeft ? 13 : 14);
        const wrist = r.getPoseLandmark(isLeft ? 15 : 16);
        if (!shoulder || !elbow || !wrist) return undefined;

        // Check if hand landmarks are visible - if not, return undefined to trigger neutral pose
        const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
        const handWrist = getHandLandmark(0);
        const indexMcp = getHandLandmark(5);
        const pinkyMcp = getHandLandmark(17);

        // If hand is not visible, return undefined to allow interpolation to neutral
        if (!handWrist || !indexMcp || !pinkyMcp) {
            return undefined;
        }

        // Bone up: points along upper arm from shoulder to elbow
        const boneUp = elbow.subtract(shoulder).normalize();

        // Bone backward: inherited from upper arm's orientation
        const boneBackward = defParent?.[1].normalizeToNew() || Vector3.Up();

        // Target: from elbow to wrist (forearm direction)
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

        // Check if hand landmarks are visible - if not, return undefined to trigger neutral pose
        const getHandLandmark = isLeft ? r.getLeftHandLandmark.bind(r) : r.getRightHandLandmark.bind(r);
        const wrist = getHandLandmark(0);
        const indexMcp = getHandLandmark(5);
        const pinkyMcp = getHandLandmark(17);

        // If hand is not visible, return undefined to allow interpolation to neutral (arms at sides)
        if (!wrist || !indexMcp || !pinkyMcp) {
            if (isLeft && Math.random() < 0.05) {
                console.log(`[UpperArm.${isLeft ? 'L' : 'R'}] Hand not visible - returning undefined for neutral pose`);
            }
            return undefined;
        }

        // Bone up: direction across shoulders (this shoulder to opposite shoulder)
        // This defines the "roll" axis of the upper arm
        const boneUp = shoulder.subtract(shoulderOther).normalize();

        // Bone backward: inherited from torso's spine orientation
        const boneBackward = defParent?.[0].normalizeToNew() || Vector3.Up();

        // Target: from shoulder to elbow (upper arm direction)
        const target = elbow.subtract(shoulder);

        // Debug logging for left arm (optional - can be removed for production)
        if (isLeft && Math.random() < 0.01) { // Log 1% of frames to reduce spam
            console.log('=== Left Upper Arm Debug ===');
            console.log('Shoulder:', shoulder.toString());
            console.log('Elbow:', elbow.toString());
            console.log('Target (elbow-shoulder):', target.toString());
            console.log('Target normalized:', target.normalizeToNew().toString());
        }

        return [boneUp, boneBackward, target, undefined];
    },
    children: [boneLowerArms[isLeft ? 0 : 1]],
}));
// Static head tilt configuration (degrees)
const HEAD_TILT_DEFAULT = 30; // Degrees forward tilt for head

const createBoneHead = (options?: GameOptions): BoneMapping => ({
    boneNames: ['Head'],
    getDef: (r, defParent) => {
        const shoulderLeft = r.getPoseLandmark(11);
        const shoulderRight = r.getPoseLandmark(12);
        const eyeLeft = r.getFaceLandmark(FaceEyeLeft);
        const eyeRight = r.getFaceLandmark(FaceEyeRight);
        const chin = r.getFaceLandmark(FaceChin);
        if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight || !chin) return undefined;

        // Bone up and backward from parent neck, or defaults if no parent
        var boneUp, boneBackward;
        if (!defParent) {
            boneUp = Vector3.Up();
            boneBackward = Vector3.Backward();
        } else {
            // Inherit from neck: up = neck's target direction, backward = neck's backward
            boneUp = defParent[2].normalizeToNew();
            boneBackward = defParent[1];
        }

        // Target: from chin to eye center (head vertical axis)
        const eyeCenter = Vector3.Center(eyeRight, eyeLeft);
        let target = eyeCenter.subtract(chin);

        // Add static forward tilt for natural head position
        const headTiltOffset = target.length() * Math.tan(HEAD_TILT_DEFAULT * Math.PI / 180);
        target.z += headTiltOffset; // Positive Z = forward tilt

        target.normalize();

        // Target backward: head's facing direction from eye line
        const eyeLine = eyeRight.subtract(eyeLeft).normalize();
        const targetBackward = Vector3.Cross(eyeLine, target).normalize();

        return [boneUp, boneBackward, target, targetBackward];
    },
    children: [],
});

// Static neck tilt configuration (degrees)
const NECK_TILT_DEFAULT = 40; // Degrees forward tilt for neck

const createBoneNeck = (options?: GameOptions): BoneMapping => ({
    boneNames: ['Neck'],
    getDef: (r, defParent) => {
        const shoulderLeft = r.getPoseLandmark(11);
        const shoulderRight = r.getPoseLandmark(12);
        const eyeLeft = r.getFaceLandmark(FaceEyeLeft);
        const eyeRight = r.getFaceLandmark(FaceEyeRight);
        const nose = r.getPoseLandmark(0); // Use nose from pose for better depth alignment
        if (!shoulderLeft || !shoulderRight || !eyeLeft || !eyeRight) return undefined;

        // Bone up: inherited from spine (points upward along torso)
        const boneUp = defParent?.[2]?.normalizeToNew() || Vector3.Up();

        // Bone backward: perpendicular to shoulder line and up direction
        const shoulder = shoulderRight.subtract(shoulderLeft).normalize();
        const boneBackward = Vector3.Cross(boneUp, shoulder).normalize();

        // Target: from shoulder center to eye center (neck direction)
        // Blend face and pose Z coordinates to balance forward/backward lean
        const eyeCenter = Vector3.Center(eyeRight, eyeLeft);
        const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);

        let target = eyeCenter.subtract(shoulderCenter);
        if (nose) {
            // Blend face mesh Z (50%) with pose nose Z (50%) for natural neck angle
            const faceZ = target.z;
            const poseZ = nose.z - shoulderCenter.z;
            target.z = faceZ * 0.5 + poseZ * 0.5;
        }

        // Negate Z for correct forward/backward head movement
        target.z = -target.z;

        // Add static forward tilt for natural neck position
        const forwardTiltOffset = target.length() * Math.tan(NECK_TILT_DEFAULT * Math.PI / 180);
        target.z += forwardTiltOffset;

        return [boneUp, boneBackward, target, undefined];
    },
    children: [createBoneHead(options)],
});
// Factory function to create spine bone with optional leg children
const createBoneBack = (includeLegs: boolean, options?: GameOptions): BoneMapping => ({
    boneNames: ['Spine', 'Chest', 'UpperChest'],
    getDef: (r, defParent) => {
        const hipLeft = r.getPoseLandmark(23);
        const hipRight = r.getPoseLandmark(24);
        const shoulderLeft = r.getPoseLandmark(11);
        const shoulderRight = r.getPoseLandmark(12);
        if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) return undefined;

        // Hip line direction (left to right)
        const hip = hipRight.subtract(hipLeft).normalize();

        // Shoulder line direction (left to right)
        const shoulder = shoulderRight.subtract(shoulderLeft).normalize();

        // Centers for spine target calculation
        const shoulderCenter = Vector3.Center(shoulderLeft, shoulderRight);
        const hipCenter = Vector3.Center(hipLeft, hipRight);

        // Bone up: world up (spine points upward)
        const boneUp = Vector3.Up();

        // Bone backward: cross product of hip line and up gives forward direction
        // Negate to get backward
        const boneBackward = Vector3.Cross(hip, boneUp).normalize();

        // Target: from hips to shoulders (spine direction)
        const target = shoulderCenter.subtract(hipCenter);

        // Target backward: twist based on shoulder orientation
        const targetBackward = Vector3.Cross(shoulder, target.normalizeToNew()).normalize();

        return [boneUp, boneBackward, target, targetBackward];
    },
    children: [
        createBoneNeck(options),
        ...boneUpperArms,
        ...(includeLegs ? boneUpperLegs : []),
    ],
});

// Collect all bone names from hierarchy (including legs)
export const allBoneNames: string[] = [];
const getAllBoneNames = (bone: BoneMapping) => {
    bone.boneNames.forEach(boneName => allBoneNames.push(boneName));
    bone.children?.forEach(bone => getAllBoneNames(bone));
}
getAllBoneNames(createBoneBack(true)); // Collect all names including legs

// Helper to convert Quaternion to plain object
const toQuatObj = (q: Quaternion) => ({x: q.x, y: q.y, z: q.z, w: q.w});

// Mutable neutral poses object with default values
export const neutralPoses: { [boneName: string]: { x: number, y: number, z: number, w: number } } = {
    'UpperLeg.L': {x: 0, y: 0, z: 0, w: 1},  // Straight down
    'UpperLeg.R': {x: 0, y: 0, z: 0, w: 1},
    'LowerLeg.L': {x: 0, y: 0, z: 0, w: 1},
    'LowerLeg.R': {x: 0, y: 0, z: 0, w: 1},
    'Foot.L': {x: 0, y: 0, z: 0, w: 1},
    'Foot.R': {x: 0, y: 0, z: 0, w: 1},
    'Toes.L': {x: 0, y: 0, z: 0, w: 1},
    'Toes.R': {x: 0, y: 0, z: 0, w: 1},
    // UpperArm: Vertical lift angle (X-axis rotation)
    // Default: -50° (arms pulled down/back at rest)
    'UpperArm.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), -50 * Math.PI / 180)),
    'UpperArm.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), -50 * Math.PI / 180)),
    // LowerArm: Forward/backward rotation (Z-axis rotation)
    // Default: 0° (straight/natural continuation of upper arm)
    'LowerArm.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), -15 * Math.PI / 180).multiply(Quaternion.RotationAxis(Vector3.Up(), 0 * Math.PI / 180)).multiply(Quaternion.RotationAxis(Vector3.Forward(), 0 * Math.PI / 180))),
    'LowerArm.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), -15 * Math.PI / 180).multiply(Quaternion.RotationAxis(Vector3.Up(), 0 * Math.PI / 180)).multiply(Quaternion.RotationAxis(Vector3.Forward(), 0 * Math.PI / 180))),
    'Hand.L': {x: 0, y: 0, z: 0, w: 1},
    'Hand.R': {x: 0, y: 0, z: 0, w: 1},

    // Finger neutral poses - slightly curled/relaxed
    // Thumb (straight/extended by default to match MediaPipe rest position)
    'FingerThumb.L': {x: 0, y: 0, z: 0, w: 1},  // Identity - no rotation
    'FingerThumb.R': {x: 0, y: 0, z: 0, w: 1},
    'FingerThumb01.L': {x: 0, y: 0, z: 0, w: 1},
    'FingerThumb01.R': {x: 0, y: 0, z: 0, w: 1},
    'FingerThumb02.L': {x: 0, y: 0, z: 0, w: 1},
    'FingerThumb02.R': {x: 0, y: 0, z: 0, w: 1},

    // Index finger (moderately curled)
    'FingerIndex.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerIndex.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),
    'FingerIndex01.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)), // ~36°
    'FingerIndex01.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)),
    'FingerIndex02.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerIndex02.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),

    // Middle finger (moderately curled)
    'FingerMiddle.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerMiddle.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),
    'FingerMiddle01.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)), // ~36°
    'FingerMiddle01.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)),
    'FingerMiddle02.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerMiddle02.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),

    // Ring finger (moderately curled)
    'FingerRing.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerRing.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),
    'FingerRing01.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)), // ~36°
    'FingerRing01.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)),
    'FingerRing02.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)), // ~30°
    'FingerRing02.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 6)),

    // Pinky (slightly more curled)
    'FingerLittle.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)), // ~36°
    'FingerLittle.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)),
    'FingerLittle01.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 4.5)), // ~40°
    'FingerLittle01.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 4.5)),
    'FingerLittle02.L': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)), // ~36°
    'FingerLittle02.R': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 5)),
};

// Function to update neutral pose for a specific bone
export function updateNeutralPose(boneName: string, angleX: number, angleY: number, angleZ: number) {
    // Create rotation from Euler angles (applied in order: X -> Y -> Z)
    const rotX = Quaternion.RotationAxis(Vector3.Right(), angleX * Math.PI / 180);
    const rotY = Quaternion.RotationAxis(Vector3.Up(), angleY * Math.PI / 180);
    const rotZ = Quaternion.RotationAxis(Vector3.Forward(), angleZ * Math.PI / 180);
    const combined = rotX.multiply(rotY).multiply(rotZ);
    neutralPoses[boneName] = toQuatObj(combined);
}

interface BoneState {
    lastUpdateTime: number;
    currentRotation: Quaternion;
}

export class Capturer {
    options: GameOptions;
    bonePrevDef: { [boneName: string]: BoneDefinition } = {};
    readonly kalmanState: KalmanState = {};
    private boneStates: { [boneName: string]: BoneState } = {};
    private neutralReturnSpeed = 0.05; // 5% interpolation per frame toward neutral

    constructor(options: GameOptions) {
        this.options = options;

        // Initialize all bone states with neutral poses
        const currentTime = Date.now();
        allBoneNames.forEach(boneName => {
            const neutralPose = neutralPoses[boneName];
            if (neutralPose) {
                this.boneStates[boneName] = {
                    lastUpdateTime: currentTime,
                    currentRotation: new Quaternion(neutralPose.x, neutralPose.y, neutralPose.z, neutralPose.w),
                };
            }
        });
    }

    capture(r: Results, updates: SkeletonUpdate, options: GameOptions): boolean {
        const cachedPoseLandmarks: { [index: number]: Vector3 } = {};
        const cachedFaceLandmarks: { [index: number]: Vector3 } = {};
        const cachedLeftHandLandmarks: { [index: number]: Vector3 } = {};
        const cachedRightHandLandmarks: { [index: number]: Vector3 } = {};

        // Create root bone dynamically based on renderLegs flag
        const rootBone = createBoneBack(options.renderLegs.current, options);

        return this.captureBonesRecursively(
            {
                getPoseLandmark: index => this.getPoseLandmark(r, index, cachedPoseLandmarks),
                getFaceLandmark: index => this.getFaceLandmark(r, index, cachedFaceLandmarks),
                getLeftHandLandmark: index => this.getLeftHandLandmark(r, index, cachedLeftHandLandmarks),
                getRightHandLandmark: index => this.getRightHandLandmark(r, index, cachedRightHandLandmarks),
                raw: r,
            },
            updates,
            options,
            false,
            rootBone);
    }

    captureBonesRecursively(r: ResultsWrapped, updates: SkeletonUpdate, options: GameOptions, changed: boolean, bone: BoneMapping, defParent?: BoneDefinition): boolean {
        const boneEnabled = !options.boneName.current || bone.boneNames.some(boneName => boneName === options.boneName.current);
        // If forceNeutralPose is enabled, skip bone detection and use neutral pose
        var def = (boneEnabled && !options.forceNeutralPose.current) ? bone.getDef(r, defParent) : undefined;
        const firstBoneName = bone.boneNames[bone.boneNames.length - 1];

        const currentTime = Date.now();

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

            const numBones = bone.boneNames.length;
            const rotation = Quaternion.FromRotationMatrix(rotMatrix);

            if (this.options.boneDebug.current) {
                debugAxesTool.update({
                    name: 'worldForward' + firstBoneName,
                    boneName: firstBoneName,
                    direction: Vector3.Forward(),
                    color: Color3.FromInts(0, 153, 0 /* Dark green */)
                });
                debugAxesTool.update({
                    name: 'worldUp' + firstBoneName,
                    boneName: firstBoneName,
                    direction: Vector3.Up(),
                    color: Color3.FromInts(153, 0, 0 /* Dark red */)
                });
                debugAxesTool.update({
                    name: 'worldRight' + firstBoneName,
                    boneName: firstBoneName,
                    direction: Vector3.Right(),
                    color: Color3.FromInts(0, 0, 153 /* Dark blue */)
                });
                debugAxesTool.update({
                    name: 'rotForward' + firstBoneName,
                    boneName: firstBoneName,
                    direction: rotForward,
                    color: Color3.Green()
                });
                debugAxesTool.update({
                    name: 'rotUp' + firstBoneName,
                    boneName: firstBoneName,
                    direction: rotUp,
                    color: Color3.Red()
                });
                debugAxesTool.update({
                    name: 'rotRight' + firstBoneName,
                    boneName: firstBoneName,
                    direction: rotRight,
                    color: Color3.Blue()
                });
            }

            const rotationScaled = numBones === 1 ? rotation : rotation.scale(1 / numBones);
            // const boneLengthScaled = numBones === 1 ? boneLength : boneLength / numBones;

            changed = true;
            bone.boneNames.forEach(boneName => {
                updates.push({
                    n: boneName,
                    // s: boneLengthScaled, // Disabled - causes positioning issues with arm chain
                    q: rotationScaled,
                });

                // Update bone state tracking
                this.boneStates[boneName] = {
                    lastUpdateTime: currentTime,
                    currentRotation: rotationScaled.clone(),
                };
            });
        } else {
            // Bone not detected - interpolate toward neutral pose if applicable
            bone.boneNames.forEach(boneName => {
                const neutralPose = neutralPoses[boneName];
                if (neutralPose) {
                    const boneState = this.boneStates[boneName];

                    // If bone was recently tracked OR forceNeutralPose is enabled, interpolate toward neutral
                    if (boneState && (options.forceNeutralPose.current || currentTime - boneState.lastUpdateTime < 5000)) {
                        const neutralQuat = new Quaternion(neutralPose.x, neutralPose.y, neutralPose.z, neutralPose.w);

                        // When forceNeutralPose is ON, use faster interpolation for immediate feedback (30% per frame)
                        // Otherwise use slow convergence (5% per frame)
                        const interpolationSpeed = options.forceNeutralPose.current ? 0.3 : this.neutralReturnSpeed;

                        // Slerp toward neutral (exponential decay)
                        const interpolated = Quaternion.Slerp(
                            boneState.currentRotation,
                            neutralQuat,
                            interpolationSpeed
                        );

                        boneState.currentRotation = interpolated;

                        updates.push({
                            n: boneName,
                            q: interpolated,
                        });

                        changed = true;
                    }
                }
            });
        }

        // Pass the current definition to children (not previous cached ones)
        // This ensures child bones align with current parent bone orientation

        changed = bone.children?.map(childBone => this.captureBonesRecursively(
            r, updates, options, changed, childBone, def))
            .some(c => c) || changed;

        return changed;
    }

    getPoseLandmark(holistic: Results, index: number, cachedLandmarks: {
        [index: number]: Vector3
    }): Vector3 | undefined {
        return this.getLandmark(holistic.poseLandmarks, index, 0, cachedLandmarks)
    }

    getFaceLandmark(holistic: Results, index: number, cachedLandmarks: {
        [index: number]: Vector3
    }): Vector3 | undefined {
        return this.getLandmark(holistic.faceLandmarks, index, 1000, cachedLandmarks)
    }

    getLeftHandLandmark(holistic: Results, index: number, cachedLandmarks: {
        [index: number]: Vector3
    }): Vector3 | undefined {
        return this.getLandmark(holistic.leftHandLandmarks, index, 2000, cachedLandmarks)
    }

    getRightHandLandmark(holistic: Results, index: number, cachedLandmarks: {
        [index: number]: Vector3
    }): Vector3 | undefined {
        return this.getLandmark(holistic.rightHandLandmarks, index, 3000, cachedLandmarks)
    }

    getLandmark(landmarklist: NormalizedLandmarkList | undefined, index: number, globalIndexOffset: number, cachedLandmarks: {
        [index: number]: Vector3
    }): Vector3 | undefined {
        // Check cache
        var landmarkVector = cachedLandmarks[index];
        if (landmarkVector) return landmarkVector;

        const landmark = landmarklist?.[index];
        if (!landmark || ((landmark?.visibility || 0) < VisibilityThreshold)) return undefined;

        // Apply Z-axis transformation
        // Negate: MediaPipe (positive=away) → Babylon (positive=forward)
        const z = -landmark.z;

        landmarkVector = new Vector3(
            landmark.x, // Keep X as-is: front camera video is already mirrored
            1 - landmark.y, // Flip Y: MediaPipe Y is top-to-bottom, Babylon Y is bottom-to-top
            z
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
