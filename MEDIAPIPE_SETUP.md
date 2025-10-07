# MediaPipe Tasks Vision API Setup

This document explains how the MediaPipe Tasks Vision API is configured in this project.

## Overview

The project uses the new MediaPipe Tasks Vision API (`@mediapipe/tasks-vision`) for holistic body tracking. This API requires WASM files to be accessible for the browser to load.

## Configuration

### WASM Files

The WASM files are loaded from the CDN in both development and production:
- **CDN URL**: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm`
- **Local Backup**: WASM files are copied to `public/assets/mediapipe-new/wasm/` for offline development

### Model Files

The holistic landmarker model is loaded from Google's storage:
- Primary: `https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task`
- Fallback: `https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task`

## Setup

### Automatic Setup (Recommended)

When you run `npm install`, a postinstall script automatically copies the WASM files from `node_modules` to the public directory.

### Manual Setup

If you need to manually copy the WASM files:

```bash
bash scripts/setup-mediapipe.sh
```

## File Structure

```
kava/
├── public/
│   └── assets/
│       └── mediapipe-new/
│           └── wasm/                    # WASM files (gitignored)
│               ├── vision_wasm_internal.js
│               ├── vision_wasm_internal.wasm
│               ├── vision_wasm_nosimd_internal.js
│               └── vision_wasm_nosimd_internal.wasm
├── scripts/
│   └── setup-mediapipe.sh              # Setup script
└── src/
    └── world/
        └── capture/
            └── BodyCapture.tsx          # Main implementation
```

## Implementation Details

### FilesetResolver Initialization

The `FilesetResolver.forVisionTasks()` method:
1. Checks if SIMD is supported in the browser
2. Loads the appropriate WASM files (SIMD or non-SIMD)
3. Returns a vision object used to create task instances

### HolisticLandmarker Creation

The `HolisticLandmarker.createFromOptions()` method:
1. Takes the vision object from FilesetResolver
2. Loads the model from the specified URL
3. Configures the landmarker with options (GPU delegate, confidence thresholds, etc.)

### Error Handling

The implementation includes:
- Detailed console logging for debugging
- Fallback model URLs
- Graceful error handling with informative messages

## Troubleshooting

### "ModuleFactory not set" Error

This error occurs when WASM files cannot be loaded. Solutions:
1. Ensure you've run `npm install` (postinstall script should copy WASM files)
2. Check that the CDN is accessible
3. Verify the WASM files exist in `public/assets/mediapipe-new/wasm/`

### Model Loading Errors

If the model fails to load:
1. Check browser console for specific error messages
2. Verify the model URLs are accessible
3. Check network connectivity
4. Try clearing browser cache

### GPU Acceleration Issues

If GPU acceleration isn't working:
1. Check if WebGL is enabled in your browser
2. Try setting `delegate: 'CPU'` in the options
3. Update your graphics drivers

## Development Notes

- WASM files are gitignored to avoid committing large binary files
- The CDN provides a fallback if local files are not available
- The implementation uses a pinned version of the WASM files to ensure consistency

## Production Deployment

For production:
1. The CDN is used for WASM files (no need to deploy them)
2. The model is loaded from Google's storage (CDN)
3. No special server configuration is required

## References

- [MediaPipe Tasks Vision API](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [Holistic Landmarker Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/holistic_landmarker)
- [FilesetResolver Documentation](https://ai.google.dev/edge/api/mediapipe/js/tasks-text.filesetresolver)
