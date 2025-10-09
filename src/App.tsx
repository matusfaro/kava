import React, { useRef, useState } from 'react';
import { isProd } from './util/detectEnv';
import { useForceUpdate } from './util/reactUtil';
import { allBoneNames } from './world/capture/capturer';
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
  armRestAngle: React.MutableRefObject<number>; // Degrees of vertical arm lift (-90 to 90)
  lowerArmAngle: React.MutableRefObject<number>; // Degrees of forearm forward/back rotation (-90 to 90)
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
  const armRestAngleRef = useRef<number>(-50); // Degrees of vertical arm lift (0=down, 90=out to sides)
  const lowerArmAngleRef = useRef<number>(0); // Degrees of forearm forward/back rotation (0=straight)
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
    armRestAngle: armRestAngleRef,
    lowerArmAngle: lowerArmAngleRef,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="imageQuality" style={{ fontSize: '14px' }}>Quality:</label>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="armRestAngle" style={{ fontSize: '14px' }}>Arm Lift:</label>
              <input
                id="armRestAngle"
                type="range"
                min="-90"
                max="90"
                step="5"
                defaultValue={-50}
                style={{ width: '120px' }}
                onChange={e => {
                  armRestAngleRef.current = parseInt(e.target.value);
                  forceUpdate();
                }}
              />
              <span style={{ fontSize: '12px', width: '40px' }}>{armRestAngleRef.current}°</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="lowerArmAngle" style={{ fontSize: '14px' }}>Forearm:</label>
              <input
                id="lowerArmAngle"
                type="range"
                min="-90"
                max="90"
                step="5"
                defaultValue={0}
                style={{ width: '120px' }}
                onChange={e => {
                  lowerArmAngleRef.current = parseInt(e.target.value);
                  forceUpdate();
                }}
              />
              <span style={{ fontSize: '12px', width: '40px' }}>{lowerArmAngleRef.current}°</span>
            </div>
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
