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
  faceRefreshRate: React.MutableRefObject<number>;
  zAxisMode: React.MutableRefObject<'normal' | 'negated' | 'original'>;
}

function App() {
  const [debug, setDebug] = useState(isProd() ? false : true);
  const [running, setRunning] = useState(debug ? false : true);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const forceUpdate = useForceUpdate();
  const [enableVideo, setEnableVideo] = useState(true);
  const boneDebugRef = useRef<boolean>(debug ? false : false);
  const boneNameRef = useRef<string | undefined>(debug ? undefined : undefined);
  const previewRef = useRef<boolean>(debug ? true : false);
  const renderFaceRef = useRef<boolean>(debug ? true : true);
  const renderBonesRef = useRef<boolean>(debug ? true : true);
  const skeletonRotationsRef = useRef<boolean>(debug ? true : true);
  const skeletonScalingRef = useRef<boolean>(debug ? false : true);
  const faceRefreshRateRef = useRef<number>(30);
  const zAxisModeRef = useRef<'normal' | 'negated' | 'original'>('normal');
  const [options] = useState<GameOptions>({
    skeletonRotations: skeletonRotationsRef,
    skeletonScaling: skeletonScalingRef,
    boneDebug: boneDebugRef,
    boneName: boneNameRef,
    preview: previewRef,
    renderFace: renderFaceRef,
    renderBones: renderBonesRef,
    faceRefreshRate: faceRefreshRateRef,
    zAxisMode: zAxisModeRef,
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
              <label htmlFor="faceRefreshRate" style={{ fontSize: '14px' }}>Face Hz:</label>
              <input
                id="faceRefreshRate"
                type="number"
                min="1"
                max="60"
                defaultValue={30}
                style={{ width: '60px' }}
                onChange={e => {
                  const rate = parseInt(e.target.value) || 30;
                  faceRefreshRateRef.current = Math.max(1, Math.min(60, rate));
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="zAxisMode" style={{ fontSize: '14px' }}>Z-Axis:</label>
              <select
                id="zAxisMode"
                defaultValue="normal"
                onChange={e => {
                  zAxisModeRef.current = e.target.value as 'normal' | 'negated' | 'original';
                  forceUpdate();
                }}
                style={{ fontSize: '12px' }}
              >
                <option value="normal">Normal (z)</option>
                <option value="negated">Negated (-z)</option>
                <option value="original">Original (1-z)</option>
              </select>
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
            opacity: 0.5,
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
