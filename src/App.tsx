import React, { useRef, useState } from 'react';
import { Quaternion } from '@babylonjs/core';
import { isProd } from './util/detectEnv';
import { useForceUpdate } from './util/reactUtil';
import {
  allBoneNames,
  HEAD_TILT_DEFAULT,
  NECK_TILT_DEFAULT,
  neutralPoses, SPINE_TILT_DEFAULT,
  updateNeutralPose
} from './world/capture/capturer';
import Game from './world/Game';

export interface GameOptions {
  boneDebug: React.MutableRefObject<boolean>;
  boneName: React.MutableRefObject<string | undefined>;
  preview: React.MutableRefObject<boolean>;
  renderFace: React.MutableRefObject<boolean>;
  renderBones: React.MutableRefObject<boolean>;
  skeletonRotations: React.MutableRefObject<boolean>;
  skeletonScaling: React.MutableRefObject<boolean>;
  processingRate: React.MutableRefObject<number>;
  renderLegs: React.MutableRefObject<boolean>;
  imageQuality: React.MutableRefObject<number>; // 0-100, JPEG quality percentage
  neutralBoneName: React.MutableRefObject<string | undefined>; // Bone to adjust neutral pose for
  neutralAngleX: React.MutableRefObject<number>; // X-axis rotation in degrees
  neutralAngleY: React.MutableRefObject<number>; // Y-axis rotation in degrees
  neutralAngleZ: React.MutableRefObject<number>; // Z-axis rotation in degrees
  forceNeutralPose: React.MutableRefObject<boolean>; // Ignore camera and use neutral poses for all bones
  headTilt: React.MutableRefObject<number>; // Head forward tilt in degrees
  neckTilt: React.MutableRefObject<number>; // Neck forward tilt in degrees
  spineTilt: React.MutableRefObject<number>; // Spine backward tilt in degrees (negative = back)
}

function App() {
  const [debug, setDebug] = useState(isProd() ? false : true);
  const [running, setRunning] = useState(debug ? false : true);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const forceUpdate = useForceUpdate();
  const [enableVideo, setEnableVideo] = useState(true);
  const boneDebugRef = useRef<boolean>(debug ? false : false);
  const boneNameRef = useRef<string | undefined>(debug ? undefined : undefined);
  const previewRef = useRef<boolean>(false);
  const renderFaceRef = useRef<boolean>(debug ? true : true);
  const renderBonesRef = useRef<boolean>(debug ? true : true);
  const skeletonRotationsRef = useRef<boolean>(debug ? true : true);
  const skeletonScalingRef = useRef<boolean>(debug ? false : true);
  const processingRateRef = useRef<number>(10);
  const renderLegsRef = useRef<boolean>(false);
  const imageQualityRef = useRef<number>(10); // 1-100, JPEG quality percentage (10% default for fast transfers)
  const neutralBoneNameRef = useRef<string | undefined>(undefined); // Bone to adjust neutral pose for
  const neutralAngleXRef = useRef<number>(0); // X-axis rotation in degrees
  const neutralAngleYRef = useRef<number>(0); // Y-axis rotation in degrees
  const neutralAngleZRef = useRef<number>(0); // Z-axis rotation in degrees
  const forceNeutralPoseRef = useRef<boolean>(false); // Force neutral pose for all bones
  const headTiltRef = useRef<number>(HEAD_TILT_DEFAULT); // Head forward tilt
  const neckTiltRef = useRef<number>(NECK_TILT_DEFAULT); // Neck forward tilt
  const spineTiltRef = useRef<number>(SPINE_TILT_DEFAULT); // Spine backward tilt
  const [options] = useState<GameOptions>({
    skeletonRotations: skeletonRotationsRef,
    skeletonScaling: skeletonScalingRef,
    boneDebug: boneDebugRef,
    boneName: boneNameRef,
    preview: previewRef,
    renderFace: renderFaceRef,
    renderBones: renderBonesRef,
    processingRate: processingRateRef,
    renderLegs: renderLegsRef,
    imageQuality: imageQualityRef,
    neutralBoneName: neutralBoneNameRef,
    neutralAngleX: neutralAngleXRef,
    neutralAngleY: neutralAngleYRef,
    neutralAngleZ: neutralAngleZRef,
    forceNeutralPose: forceNeutralPoseRef,
    headTilt: headTiltRef,
    neckTilt: neckTiltRef,
    spineTilt: spineTiltRef,
  });
  return (
    <>
      <div style={{
        position: 'absolute',
        zIndex: 2,
        left: 30,
        top: 30,
        display: 'flex',
        flexDirection: 'column',
        rowGap: 10,
        background: 'rgba(255, 255, 255, 0.5)',
        padding: '10px',
        borderRadius: '5px',
      }}>
        {debug && (
          <>
            <button onClick={() => {
              boneDebugRef.current = false;
              boneNameRef.current = undefined;
              previewRef.current = false;
              renderFaceRef.current = true;
              renderBonesRef.current = true;
              skeletonRotationsRef.current = true;
              skeletonScalingRef.current = true;
              !enableVideo && setEnableVideo(true);
              setDebug(false);
              setRunning(true);
            }}>CLOSE DEBUG</button>
            <button onClick={() => setRunning(!running)}>{running ? 'STOP' : 'START'}</button>
            <button onClick={() => setEnableVideo(!enableVideo)}>{enableVideo ? 'video ON' : 'video OFF'}</button>
            <button onClick={() => { forceNeutralPoseRef.current = !forceNeutralPoseRef.current; forceUpdate(); }}>
              {forceNeutralPoseRef.current ? 'NEUTRAL POSE ON' : 'NEUTRAL POSE OFF'}
            </button>
            {([
              ['preview', previewRef],
              ['face', renderFaceRef],
              ['bones', renderBonesRef],
              ['legs', renderLegsRef],
              ['skltnRota', skeletonRotationsRef],
              ['skltnScal', skeletonScalingRef],
              ['debugBone', boneDebugRef],
            ] as Array<[string, React.MutableRefObject<boolean>]>
            ).map(([title, ref]) => (
              <button key={title} onClick={() => { ref.current = !ref.current; forceUpdate() }}>
                {`${title} ${ref.current ? 'ON' : 'OFF'}`}
              </button>
            ))}
            <select defaultValue='None' onChange={e => {
              const boneName = e.target.value;
              boneNameRef.current = boneName === 'None' ? undefined : boneName;
              forceUpdate();
            }}>
              {['None', ...allBoneNames].map(boneName => (
                <option key={boneName} value={boneName}>{boneName}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="processingRate" style={{ fontSize: '14px' }}>Hz:</label>
              <input
                id="processingRate"
                type="number"
                min="1"
                max="60"
                defaultValue={10}
                style={{ width: '60px' }}
                onChange={e => {
                  const rate = parseInt(e.target.value) || 10;
                  processingRateRef.current = Math.max(1, Math.min(60, rate));
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label htmlFor="imageQuality" style={{ fontSize: '14px' }}>Quality:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  id="imageQuality"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  defaultValue={10}
                  style={{ width: '100px' }}
                  onChange={e => {
                    imageQualityRef.current = parseInt(e.target.value);
                    forceUpdate();
                  }}
                />
                <span style={{ fontSize: '12px', width: '35px' }}>{imageQualityRef.current}%</span>
              </div>
            </div>
            <div style={{ fontSize: '14px', marginTop: 10, fontWeight: 'bold' }}>Body Tilts:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label htmlFor="headTilt" style={{ fontSize: '14px' }}>Head Tilt:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  id="headTilt"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={headTiltRef.current}
                  style={{ width: '100px' }}
                  onChange={e => {
                    headTiltRef.current = parseInt(e.target.value);
                    forceUpdate();
                  }}
                />
                <span style={{ fontSize: '12px', width: '40px' }}>{headTiltRef.current}°</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label htmlFor="neckTilt" style={{ fontSize: '14px' }}>Neck Tilt:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  id="neckTilt"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={neckTiltRef.current}
                  style={{ width: '100px' }}
                  onChange={e => {
                    neckTiltRef.current = parseInt(e.target.value);
                    forceUpdate();
                  }}
                />
                <span style={{ fontSize: '12px', width: '40px' }}>{neckTiltRef.current}°</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label htmlFor="spineTilt" style={{ fontSize: '14px' }}>Spine Tilt:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  id="spineTilt"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={spineTiltRef.current}
                  style={{ width: '100px' }}
                  onChange={e => {
                    spineTiltRef.current = parseInt(e.target.value);
                    forceUpdate();
                  }}
                />
                <span style={{ fontSize: '12px', width: '40px' }}>{spineTiltRef.current}°</span>
              </div>
            </div>
            <div style={{ fontSize: '14px', marginTop: 10, fontWeight: 'bold' }}>Neutral Pose Editor:</div>
            <select
              value={neutralBoneNameRef.current || 'None'}
              onChange={e => {
                const boneName = e.target.value;
                neutralBoneNameRef.current = boneName === 'None' ? undefined : boneName;

                if (boneName !== 'None') {
                  // Load the current neutral pose values for this bone
                  const currentPose = neutralPoses[boneName];
                  if (currentPose) {
                    // Convert quaternion to Euler angles (radians -> degrees)
                    const quat = new Quaternion(currentPose.x, currentPose.y, currentPose.z, currentPose.w);
                    const euler = quat.toEulerAngles();
                    neutralAngleXRef.current = Math.round(euler.x * 180 / Math.PI);
                    neutralAngleYRef.current = Math.round(euler.y * 180 / Math.PI);
                    neutralAngleZRef.current = Math.round(euler.z * 180 / Math.PI);
                  } else {
                    // No neutral pose defined, default to zero
                    neutralAngleXRef.current = 0;
                    neutralAngleYRef.current = 0;
                    neutralAngleZRef.current = 0;
                  }
                }
                forceUpdate();
              }}
            >
              <option value='None'>Select Bone</option>
              {allBoneNames.map(boneName => (
                <option key={boneName} value={boneName}>{boneName}</option>
              ))}
            </select>
            {neutralBoneNameRef.current && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <label htmlFor="neutralAngleX" style={{ fontSize: '14px' }}>X-axis:</label>
                  <input
                    id="neutralAngleX"
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={neutralAngleXRef.current}
                    style={{ width: '120px' }}
                    onChange={e => {
                      neutralAngleXRef.current = parseInt(e.target.value);
                      updateNeutralPose(
                        neutralBoneNameRef.current!,
                        neutralAngleXRef.current,
                        neutralAngleYRef.current,
                        neutralAngleZRef.current
                      );
                      forceUpdate();
                    }}
                  />
                  <span style={{ fontSize: '12px', width: '45px' }}>{neutralAngleXRef.current}°</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <label htmlFor="neutralAngleY" style={{ fontSize: '14px' }}>Y-axis:</label>
                  <input
                    id="neutralAngleY"
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={neutralAngleYRef.current}
                    style={{ width: '120px' }}
                    onChange={e => {
                      neutralAngleYRef.current = parseInt(e.target.value);
                      updateNeutralPose(
                        neutralBoneNameRef.current!,
                        neutralAngleXRef.current,
                        neutralAngleYRef.current,
                        neutralAngleZRef.current
                      );
                      forceUpdate();
                    }}
                  />
                  <span style={{ fontSize: '12px', width: '45px' }}>{neutralAngleYRef.current}°</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <label htmlFor="neutralAngleZ" style={{ fontSize: '14px' }}>Z-axis:</label>
                  <input
                    id="neutralAngleZ"
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={neutralAngleZRef.current}
                    style={{ width: '120px' }}
                    onChange={e => {
                      neutralAngleZRef.current = parseInt(e.target.value);
                      updateNeutralPose(
                        neutralBoneNameRef.current!,
                        neutralAngleXRef.current,
                        neutralAngleYRef.current,
                        neutralAngleZRef.current
                      );
                      forceUpdate();
                    }}
                  />
                  <span style={{ fontSize: '12px', width: '45px' }}>{neutralAngleZRef.current}°</span>
                </div>
                <button
                  onClick={() => {
                    const boneName = neutralBoneNameRef.current!;
                    const x = neutralAngleXRef.current;
                    const y = neutralAngleYRef.current;
                    const z = neutralAngleZRef.current;
                    console.log(`Apply this to code:\n'${boneName}': toQuatObj(Quaternion.RotationAxis(Vector3.Right(), ${x} * Math.PI / 180).multiply(Quaternion.RotationAxis(Vector3.Up(), ${y} * Math.PI / 180)).multiply(Quaternion.RotationAxis(Vector3.Forward(), ${z} * Math.PI / 180))),`);
                  }}
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                >
                  Log Code
                </button>
              </>
            )}
          </>
        )}
      </div>
      <div style={{
        position: 'absolute',
        zIndex: 1000,
        left: 10,
        bottom: 10,
      }}>
        <canvas
          ref={webcamCanvasRef}
          style={{
            visibility: previewRef.current ? 'visible' : 'hidden',
            opacity: 0.9,
            display: 'block'
          }}
        />
      </div>
      {!!running && (
        <Game
          key='game'
          enableVideo={enableVideo}
          webcamCanvasRef={webcamCanvasRef}
          options={options}
        />
      )}
    </>
  );
}

export default App;
