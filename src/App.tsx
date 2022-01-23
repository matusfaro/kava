import React, { useRef, useState } from 'react';
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
}

function App() {
  const [running, setRunning] = useState(false);
  const webcamCanvasRef = useRef(null);
  const forceUpdate = useForceUpdate();
  const [debug, setDebug] = useState(true);
  const [enableVideo, setEnableVideo] = useState(true);
  const boneDebugRef = useRef<boolean>(false);
  const boneNameRef = useRef<string | undefined>();
  const previewRef = useRef<boolean>(true);
  const renderFaceRef = useRef<boolean>(false);
  const renderBonesRef = useRef<boolean>(true);
  const skeletonRotationsRef = useRef<boolean>(true);
  const skeletonScalingRef = useRef<boolean>(false);
  const [options] = useState<GameOptions>({
    skeletonRotations: skeletonRotationsRef,
    skeletonScaling: skeletonScalingRef,
    boneDebug: boneDebugRef,
    boneName: boneNameRef,
    preview: previewRef,
    renderFace: renderFaceRef,
    renderBones: renderBonesRef,
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
            }}>STOP DEBUG</button>
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
          </>
        )}
      </div>
      <div style={{
        position: 'absolute',
        zIndex: 2,
        right: 30,
        top: 30,
      }}>
        <canvas ref={webcamCanvasRef} style={{ visibility: previewRef.current ? 'visible' : 'hidden' }} />
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
