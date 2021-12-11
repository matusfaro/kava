import React, { useState } from 'react';
import Game from './world/Game';

function App() {
  const [running, setRunning] = useState(false);
  return (
    <>
      <div style={{
        position: 'absolute',
        zIndex: 2,
        left: 30,
        top: 30,
      }}>
        <button onClick={() => setRunning(!running)}>{running ? 'stop' : 'start'}</button>
      </div>
      {!!running && (<Game />)}
    </>
  );
}

export default App;
