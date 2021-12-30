import React, { useRef, useState } from 'react';
import Game from './world/Game';

function App() {
  const [running, setRunning] = useState(false);
  const [enableVideo, setEnableVideo] = useState(true);
  const webcamCanvasRef = useRef(null);
  const [debug, setDebug] = useState(true);
  const debugRef = useRef<boolean>(true);
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
        <button onClick={() => setRunning(!running)}>{running ? 'stop' : 'start'}</button>
        <button onClick={() => setEnableVideo(!enableVideo)}>{enableVideo ? 'video ON' : 'video OFF'}</button>
        <button onClick={() => { debugRef.current = !debugRef.current; setDebug(debugRef.current) }}>{debugRef.current ? 'debug ON' : 'debug OFF'}</button>
      </div>
      <div style={{
        position: 'absolute',
        zIndex: 2,
        right: 30,
        top: 30,
      }}>
        <canvas ref={webcamCanvasRef} style={{ visibility: debugRef.current ? 'visible' : 'hidden' }} />
      </div>
      {!!running && (
        <Game
          enableVideo={enableVideo}
          debugRef={debugRef}
          webcamCanvasRef={webcamCanvasRef}
        />
      )}
    </>
  );
}

export default App;
