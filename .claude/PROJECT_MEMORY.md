# Kava Project - Development Knowledge Base

Last updated: 2025-10-07

## Project Overview

**Kava** is a 3D multiplayer avatar game with real-time body and face tracking.

- **Frontend**: React + Babylon.js for 3D rendering
- **Backend**: Express + Socket.IO for multiplayer sync
- **Motion Capture**: MediaPipe Holistic Landmarker v0.10.14
- **Location**: `/Users/matus/dev/kava`

---

## Critical Coordinate System Transformations

### MediaPipe → Babylon.js Mapping

```typescript
// In capturer.ts getLandmark()
X: landmark.x           // No change (camera already mirrored)
Y: 1 - landmark.y       // Flip vertical (MediaPipe top→bottom, Babylon bottom→top)
Z: -landmark.z          // Negate depth (MediaPipe positive=away, Babylon positive=forward)
```

**Why these transformations?**
- MediaPipe uses image coordinates: Y=0 at top, Z+ away from camera
- Babylon.js uses 3D world coordinates: Y=0 at bottom, Z+ forward
- Front-facing camera video is already horizontally mirrored by browser

### Hand Orientation Fix

```typescript
// In boneHands mapping
const targetBackward = Vector3.Cross(target.normalizeToNew(), fingers).negate();
```

**Without `.negate()`**: Hands face backward (palms away from camera)
**With `.negate()`**: Hands face forward correctly

---

## Performance Optimizations

### Face Texture Rate Limiting

```typescript
// In face.ts - Default 30Hz
const FACE_TEXTURE_UPDATE_INTERVAL = 1000 / options.faceRefreshRate.current;
```

- **Face mesh geometry**: Updates every frame (smooth animation)
- **Face texture**: Rate-limited (expensive `toDataURL()` operation)
- Configurable in debug menu: 1-60 Hz

### Bone Position Caching

**REMOVED** - Bone position caching caused hands to stick in wrong poses when not visible.

```typescript
// OLD (removed):
if (def) {
  this.bonePrevDef[firstBoneName] = def;
} else {
  def = this.bonePrevDef[firstBoneName]; // Used stale positions
}

// NEW: Don't update bones when landmarks not detected
```

---

## Mobile Camera Support

### HTTPS Setup (Required for Camera Access)

**Development Certificates:**
```bash
brew install mkcert
mkcert -install  # May require sudo password
mkdir -p ~/.localhost-ssl
cd ~/.localhost-ssl
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

**Environment Variables (.env):**
```
HTTPS=true
SSL_CRT_FILE=$HOME/.localhost-ssl/localhost.pem
SSL_KEY_FILE=$HOME/.localhost-ssl/localhost-key.pem
```

**Server Setup (server.ts):**
- Detects `ENV=development`
- Loads certificates from `~/.localhost-ssl/`
- Falls back to HTTP if certificates not found

### Portrait/Landscape Support

```typescript
// In BodyCapture.tsx
video: {
  facingMode: 'user',  // Front camera
  width: { ideal: 1280 },
  height: { ideal: 720 }
}
```

**Dynamic canvas sizing:**
- Detects actual video dimensions on metadata load
- Processing canvas matches video size (portrait or landscape)
- Preview canvas scales to max 320px on longest side

---

## Debug Configuration

### Available Controls (App.tsx)

- **Face Hz**: 1-60 (texture update rate)
- **Z-Axis Mode**: Normal/Negated/Original (for testing transforms)
- **Preview**: Toggle semi-transparent video overlay
- **Bone Selection**: Debug individual bones
- **Bone Debug**: Show skeleton visualization

### Key File Locations

```
src/world/capture/
├── capturer.ts          # Coordinate transforms, bone mapping
├── face.ts              # Face mesh & texture processing
└── BodyCapture.tsx      # Camera setup, MediaPipe integration

src/world/
├── Player.tsx           # Avatar rendering
├── Camera.tsx           # Camera controls
└── Controller.tsx       # Character controller

server.ts                # Express + Socket.IO backend
.env                     # HTTPS & dev settings
```

---

## Common Issues & Solutions

### Issue: Hands go forward when raised up
**Cause**: Z-axis not negated correctly
**Solution**: Use `z = -landmark.z` in normal mode

### Issue: Hands facing backward (palms away)
**Cause**: Hand targetBackward cross product direction
**Solution**: Add `.negate()` to targetBackward calculation

### Issue: Hands stick in wrong position when not visible
**Cause**: Bone position caching
**Solution**: Removed `bonePrevDef` caching logic

### Issue: Camera keeps snapping to default view
**Cause**: Camera target updated every frame
**Solution**: Removed `scene.registerBeforeRender()` forced targeting

### Issue: Poor performance on mobile
**Cause**: Face texture conversion too frequent
**Solution**: Rate limit to 30Hz (configurable)

---

## Testing Notes

### Hand Position Debugging

When testing coordinate transforms, log target vectors:

```typescript
// Hands UP should show:
Target normalized: { X: ~0.1, Y: ~0.9, Z: ~-0.4 }
// Large Y (vertical), small Z

// Hands FORWARD should show:
Target normalized: { X: ~0.7, Y: ~0.0, Z: ~0.7 }
// Small Y, large Z (forward)
```

### Mobile Testing

1. Find local IP: `ipconfig getifaddr en0`
2. On mobile: Visit `https://[IP]:3000`
3. Accept security warning (self-signed cert)
4. Grant camera permissions

---

## Architecture Decisions

### Why Kalman filtering?
Reduces landmark jitter from MediaPipe noise

### Why off-screen canvas processing?
Avoids direct video element issues with MediaPipe

### Why separate mesh/texture updates?
Mesh geometry needs 60fps for smoothness
Texture updates are expensive, can be throttled

### Why remove bone caching?
Better to have no update than wrong position
Prevents hands freezing in weird poses

---

## Future Improvements

- [ ] Add calibration step for Z-axis per-user
- [ ] Implement hand gesture recognition
- [ ] Add face expression mapping
- [ ] Optimize for lower-end mobile devices
- [ ] Add multiplayer avatar sync improvements
