# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kava is a multiplayer 3D avatar application that uses real-time webcam tracking to animate player avatars. Players see each other's body movements and facial expressions in a shared 3D environment.

**Tech Stack:**
- **Frontend**: React + TypeScript with Babylon.js for 3D rendering
- **Body Tracking**: MediaPipe Holistic Landmarker (v0.10.14) for real-time pose/face detection
- **Multiplayer**: Socket.IO for real-time communication
- **Backend**: Express server (development supports HTTPS for camera access)

## Development Commands

### Starting the Application

Development requires running **both** server and client:

```bash
# Terminal 1 - Backend server (port 8080)
npm run start-dev-server

# Terminal 2 - React client (port 3000)
npm run start-dev-client
```

**Production mode:**
```bash
npm run build
npm start
```

### Testing

```bash
npm test                    # Run all tests in watch mode
npm test -- --coverage      # Run tests with coverage
```

### HTTPS Setup for Camera Access

Mobile devices and some browsers require HTTPS for camera permissions. Setup:

```bash
# Install mkcert (one-time)
brew install mkcert

# Generate certificates (stored in ~/.localhost-ssl/)
mkdir -p ~/.localhost-ssl
cd ~/.localhost-ssl
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

The `.env` file is already configured to use these certificates.

## Architecture Overview

### Core Component Flow

```
App.tsx (debug controls)
  └─> Game.tsx (Babylon.js engine setup)
        ├─> Player.tsx (avatar mesh + skeleton)
        ├─> Camera.tsx (ArcRotateCamera)
        ├─> Controller.tsx (CharacterController for movement)
        ├─> BodyCapture.tsx (MediaPipe webcam processing)
        ├─> Network.tsx (Socket.IO client)
        └─> Friends.tsx (other players' avatars)
```

### Body Tracking Pipeline

1. **BodyCapture.tsx**: Captures webcam, runs MediaPipe detection
2. **capturer.ts**: Transforms MediaPipe landmarks to Babylon.js bone rotations
3. **face.ts**: Processes facial landmarks and texture for face mesh
4. **Player.tsx**: Applies bone rotations to 3D skeleton

### Multiplayer Architecture

```
Client (Browser)
  ├─> Network.tsx: Publishes local body data via Socket.IO
  └─> Friends.tsx: Subscribes to remote players' body data

Server (server.ts)
  └─> Broadcasts body updates to all connected clients
```

**Socket.IO Events:**
- `client-update-body`: Body/face tracking data
- `client-update-location`: Position/rotation/animation
- `server-update-client-*`: Broadcasts from server to clients
- `server-update-client-disconnected`: Player left

## Critical Implementation Details

### MediaPipe Coordinate System Transformations

**MediaPipe coordinates:**
- X: 0 (left) to 1 (right)
- Y: 0 (top) to 1 (bottom)
- Z: depth, positive = away from camera

**Babylon.js (left-handed):**
- X: left to right
- Y: bottom to top
- Z: back to front

**Required transformation** (in `capturer.ts`):
```typescript
X: landmark.x           // Keep as-is (front camera already mirrored)
Y: 1 - landmark.y       // Flip vertical
Z: -landmark.z          // Negate depth
```

**Hand orientation fix:**
The `targetBackward` vector for hands must be negated to correct palm orientation with front-facing cameras (see `boneHands` in `capturer.ts`).

### Performance Optimizations

**Face texture rate limiting:**
- Face mesh geometry updates every frame (smooth animation)
- Face texture (expensive `toDataURL`) updates at configurable Hz (default 30)
- Configured via `faceRefreshRate` in `GameOptions`

**Canvas sizing:**
- Processing canvas dynamically sized to actual video dimensions
- Supports both portrait (720×1280) and landscape (1280×720)
- Preview canvas scales to max 320px on longest side

**Kalman filtering:**
- Applied to all landmarks to reduce jitter
- Configuration in `capturer.ts`: `KalmanProps`

### Camera and Character Controller

**CharacterController** (from `babylonjs-charactercontroller`):
- Manages player movement and camera positioning
- Camera follows player automatically
- Do NOT call `camera.setTarget()` in render loop (causes camera to lock)

**Camera setup:**
- Uses `ArcRotateCamera` with collision detection
- Controls attached once, CharacterController handles tracking
- User can freely rotate camera view

### Debug Mode

Access via `App.tsx` when `isProd()` returns false:

**Available controls:**
- Preview toggle: Shows/hides webcam preview with skeleton overlay
- Face/Bones rendering: Enable/disable face mesh or skeleton tracking
- Bone debug: Visualize individual bone transformations
- Face refresh rate: 1-60 Hz (affects texture update frequency)
- Z-axis mode: Switch coordinate transformation modes for testing

## Common Development Patterns

### Adding New Bone Mappings

Edit `capturer.ts`:

1. Define bone mapping with `BoneMapping` interface
2. Implement `getDef()` to calculate bone orientation from landmarks
3. Add to hierarchy (typically as child of parent bone)
4. Transformation uses `boneUp`, `boneBackward`, `target`, `targetBackward` vectors

### Modifying Network Protocol

1. Update interfaces in `src/world/network/api.ts`
2. Modify server handlers in `server.ts`
3. Update client sender in `Network.tsx`
4. Update client receiver in `Friends.tsx`

### MediaPipe Model Updates

See `MEDIAPIPE_SETUP.md` for detailed instructions. Key points:
- WASM files loaded from CDN (v0.10.14)
- Model loaded from Google Storage
- Pinned versions for stability
- Postinstall script copies WASM files

## File Organization

```
src/
├── App.tsx                          # Main app + debug controls
├── CharacterController.ts           # Third-party character controller
└── world/
    ├── Game.tsx                     # Babylon.js engine wrapper
    ├── Player.tsx                   # Avatar mesh + skeleton binding
    ├── Camera.tsx                   # Camera setup
    ├── Controller.tsx               # CharacterController wrapper
    ├── Friends.tsx                  # Remote players rendering
    ├── capture/
    │   ├── BodyCapture.tsx         # MediaPipe webcam processing
    │   ├── capturer.ts             # Landmark → bone transformation
    │   ├── face.ts                 # Face mesh generation
    │   └── faceConst.ts            # Face landmark indices
    └── network/
        ├── Network.tsx             # Socket.IO client
        └── api.ts                  # Network protocol types

server.ts                            # Express + Socket.IO server
```

## Important Constraints

1. **MediaPipe version pinned to 0.10.14**: Newer versions may have breaking API changes
2. **HTTPS required for camera**: Development uses mkcert certificates in `~/.localhost-ssl/`
3. **No bone position caching**: Prevents hands sticking in wrong poses when not visible (removed from `capturer.ts`)
4. **Front camera mirroring**: X-axis kept as-is, hand backward vectors negated
5. **Kalman filter smoothing**: Do not disable without testing - reduces tracking jitter significantly

## Testing on Mobile

1. Ensure HTTPS certificates are generated (see above)
2. Find local IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
3. On mobile device (same WiFi):
   - Visit `https://[your-ip]:3000`
   - Accept security warning for self-signed certificate
   - Grant camera permissions
4. Camera will auto-detect portrait/landscape orientation

## Troubleshooting

**"ModuleFactory not set" error:**
- Run `npm install` to trigger postinstall script
- Check `public/assets/mediapipe-new/wasm/` exists

**Hands/body misaligned:**
- Verify Z-axis transformation in `capturer.ts` (should be `-landmark.z`)
- Check hand `targetBackward` is negated
- Test with different Z-axis modes in debug menu

**Camera permissions denied:**
- Ensure HTTPS is enabled (check browser URL bar)
- Check `.env` has `HTTPS=true` and certificate paths

**Poor tracking quality:**
- Increase lighting
- Ensure face and hands are visible in frame
- Lower face refresh rate if CPU-bound (debug menu)
