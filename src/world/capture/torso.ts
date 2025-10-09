import { GameOptions } from '../../App';
import { Body, Torso } from './BodyCapture';

// Local type definitions for MediaPipe compatibility
interface Results {
  poseLandmarks: any[];
  faceLandmarks: any[];
  rightHandLandmarks?: any[];
  leftHandLandmarks?: any[];
  segmentationMask?: any;
  multiFaceGeometry?: any[];
  image: HTMLVideoElement | HTMLCanvasElement;
}

// Face landmark indices for cheek area (for skin color sampling)
const FACE_LEFT_CHEEK = 205; // Left cheek center
const FACE_RIGHT_CHEEK = 425; // Right cheek center

// Face landmark indices for forehead/hair area
const FACE_FOREHEAD_LEFT = 21; // Left forehead
const FACE_FOREHEAD_CENTER = 10; // Center forehead
const FACE_FOREHEAD_RIGHT = 251; // Right forehead

// Rate limiting for torso texture updates
let lastTorsoTextureUpdate = 0;

// Pose landmark indices for torso
const SHOULDER_LEFT = 11;
const SHOULDER_RIGHT = 12;
const HIP_LEFT = 23;
const HIP_RIGHT = 24;
const KNEE_LEFT = 25;
const KNEE_RIGHT = 26;

export const captureTorso = (results: Results, body: Body, options: GameOptions): boolean => {
  if (!results.poseLandmarks || results.poseLandmarks.length < 25) return false;

  const shoulderLeft = results.poseLandmarks[SHOULDER_LEFT];
  const shoulderRight = results.poseLandmarks[SHOULDER_RIGHT];
  const hipLeft = results.poseLandmarks[HIP_LEFT];
  const hipRight = results.poseLandmarks[HIP_RIGHT];
  const kneeLeft = results.poseLandmarks[KNEE_LEFT];
  const kneeRight = results.poseLandmarks[KNEE_RIGHT];

  // Require at least one shoulder to be visible (we need some anchor point)
  const hasShoulderLeft = shoulderLeft && shoulderLeft.visibility >= 0.5;
  const hasShoulderRight = shoulderRight && shoulderRight.visibility >= 0.5;
  const hasHipLeft = hipLeft && hipLeft.visibility >= 0.5;
  const hasHipRight = hipRight && hipRight.visibility >= 0.5;
  const hasKneeLeft = kneeLeft && kneeLeft.visibility >= 0.5;
  const hasKneeRight = kneeRight && kneeRight.visibility >= 0.5;

  if (!hasShoulderLeft && !hasShoulderRight) return false;

  // Calculate bounding box coordinates (used for both texture and color sampling)
  const xCoords: number[] = [];
  if (hasShoulderLeft) xCoords.push(shoulderLeft.x);
  if (hasShoulderRight) xCoords.push(shoulderRight.x);
  if (hasHipLeft) xCoords.push(hipLeft.x);
  if (hasHipRight) xCoords.push(hipRight.x);

  const yCoords: number[] = [];
  if (hasShoulderLeft) yCoords.push(shoulderLeft.y);
  if (hasShoulderRight) yCoords.push(shoulderRight.y);
  if (hasHipLeft) yCoords.push(hipLeft.y);
  if (hasHipRight) yCoords.push(hipRight.y);

  let minX = xCoords.length > 0 ? Math.min(...xCoords) : 0;
  let maxX = xCoords.length > 0 ? Math.max(...xCoords) : 1;
  let minY = yCoords.length > 0 ? Math.min(...yCoords) : 0;
  let maxY = yCoords.length > 0 ? Math.max(...yCoords) : 1;

  // If hips not visible, extend downward
  if (!hasHipLeft && !hasHipRight) {
    const shoulderY = Math.max(
      hasShoulderLeft ? shoulderLeft.y : 0,
      hasShoulderRight ? shoulderRight.y : 0
    );
    maxY = Math.min(1.0, shoulderY + 0.4);
  }

  // Rate limit texture updates to reduce CPU load
  const now = Date.now();
  const torsoTextureUpdateInterval = 1000 / options.processingRate.current;
  const shouldUpdateTexture = (now - lastTorsoTextureUpdate) >= torsoTextureUpdateInterval;

  let img: string | undefined;
  if (shouldUpdateTexture) {
    lastTorsoTextureUpdate = now;

    // Extract torso region from webcam
    if (results.image instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      const videoWidth = results.image.videoWidth;
      const videoHeight = results.image.videoHeight;

      // Add some padding (10% on each side)
      const padding = 0.1;
      const width = maxX - minX;
      const height = maxY - minY;
      const paddedMinX = Math.max(0, minX - width * padding);
      const paddedMaxX = Math.min(1, maxX + width * padding);
      const paddedMinY = Math.max(0, minY - height * padding);
      const paddedMaxY = Math.min(1, maxY + height * padding);

      // Convert to pixel coordinates
      const cropX = paddedMinX * videoWidth;
      const cropY = paddedMinY * videoHeight;
      const cropWidth = (paddedMaxX - paddedMinX) * videoWidth;
      const cropHeight = (paddedMaxY - paddedMinY) * videoHeight;

      // Set canvas size to cropped region
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw only the torso region
        ctx.drawImage(
          results.image,
          cropX, cropY, cropWidth, cropHeight,  // Source rectangle
          0, 0, cropWidth, cropHeight           // Destination rectangle
        );
        // Use quality from options (0-100 scale converted to 0-1)
        img = canvas.toDataURL('image/jpeg', options.imageQuality.current / 100);
      }
    } else if ((results.image as any).toDataURL) {
      // Legacy API with canvas - similar extraction
      const canvas = results.image as HTMLCanvasElement;
      const videoWidth = canvas.width;
      const videoHeight = canvas.height;

      const padding = 0.1;
      const width = maxX - minX;
      const height = maxY - minY;
      const paddedMinX = Math.max(0, minX - width * padding);
      const paddedMaxX = Math.min(1, maxX + width * padding);
      const paddedMinY = Math.max(0, minY - height * padding);
      const paddedMaxY = Math.min(1, maxY + height * padding);

      const cropX = paddedMinX * videoWidth;
      const cropY = paddedMinY * videoHeight;
      const cropWidth = (paddedMaxX - paddedMinX) * videoWidth;
      const cropHeight = (paddedMaxY - paddedMinY) * videoHeight;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          canvas,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );
        // Use quality from options (0-100 scale converted to 0-1)
        img = tempCanvas.toDataURL('image/jpeg', options.imageQuality.current / 100);
      }
    }
  }

  // Sample skin color from face cheek area
  let skinColor: { r: number, g: number, b: number } | undefined;
  if (shouldUpdateTexture && results.image instanceof HTMLVideoElement && results.faceLandmarks && results.faceLandmarks.length > Math.max(FACE_LEFT_CHEEK, FACE_RIGHT_CHEEK)) {
    const leftCheek = results.faceLandmarks[FACE_LEFT_CHEEK];
    const rightCheek = results.faceLandmarks[FACE_RIGHT_CHEEK];

    if (leftCheek && rightCheek) {
      const tempCanvas = document.createElement('canvas');
      const videoWidth = results.image.videoWidth;
      const videoHeight = results.image.videoHeight;

      const sampleSize = 10;
      tempCanvas.width = sampleSize * 2; // Sample both cheeks
      tempCanvas.height = sampleSize;

      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        // Sample left cheek
        tempCtx.drawImage(
          results.image,
          leftCheek.x * videoWidth - sampleSize / 2,
          leftCheek.y * videoHeight - sampleSize / 2,
          sampleSize,
          sampleSize,
          0, 0, sampleSize, sampleSize
        );

        // Sample right cheek
        tempCtx.drawImage(
          results.image,
          rightCheek.x * videoWidth - sampleSize / 2,
          rightCheek.y * videoHeight - sampleSize / 2,
          sampleSize,
          sampleSize,
          sampleSize, 0, sampleSize, sampleSize
        );

        // Get average color from both cheeks
        const imageData = tempCtx.getImageData(0, 0, sampleSize * 2, sampleSize);
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          r += imageData.data[i];
          g += imageData.data[i + 1];
          b += imageData.data[i + 2];
        }
        const pixelCount = sampleSize * sampleSize * 2;
        skinColor = {
          r: Math.round(r / pixelCount),
          g: Math.round(g / pixelCount),
          b: Math.round(b / pixelCount)
        };
      }
    }
  }

  // Sample dominant color from the torso region (synchronously from video)
  let dominantColor: { r: number, g: number, b: number } | undefined;
  if (shouldUpdateTexture && results.image instanceof HTMLVideoElement) {
    // Sample color directly from video element (synchronous)
    const tempCanvas = document.createElement('canvas');
    const videoWidth = results.image.videoWidth;
    const videoHeight = results.image.videoHeight;

    // Sample a small region from center of torso
    const sampleSize = 10;
    tempCanvas.width = sampleSize;
    tempCanvas.height = sampleSize;

    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      // Calculate center of torso region
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Draw a small sample from the center
      tempCtx.drawImage(
        results.image,
        centerX * videoWidth - sampleSize / 2,
        centerY * videoHeight - sampleSize / 2,
        sampleSize,
        sampleSize,
        0, 0, sampleSize, sampleSize
      );

      // Get average color from the sample
      const imageData = tempCtx.getImageData(0, 0, sampleSize, sampleSize);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
      }
      const pixelCount = sampleSize * sampleSize;
      dominantColor = {
        r: Math.round(r / pixelCount),
        g: Math.round(g / pixelCount),
        b: Math.round(b / pixelCount)
      };
    }
  }

  // Sample hair color from forehead/top of head area
  let hairColor: { r: number, g: number, b: number } | undefined;
  if (shouldUpdateTexture && results.image instanceof HTMLVideoElement && results.faceLandmarks && results.faceLandmarks.length > Math.max(FACE_FOREHEAD_LEFT, FACE_FOREHEAD_CENTER, FACE_FOREHEAD_RIGHT)) {
    const foreheadLeft = results.faceLandmarks[FACE_FOREHEAD_LEFT];
    const foreheadCenter = results.faceLandmarks[FACE_FOREHEAD_CENTER];
    const foreheadRight = results.faceLandmarks[FACE_FOREHEAD_RIGHT];

    if (foreheadLeft && foreheadCenter && foreheadRight) {
      const tempCanvas = document.createElement('canvas');
      const videoWidth = results.image.videoWidth;
      const videoHeight = results.image.videoHeight;

      // Sample from above the forehead (where hair is)
      const hairOffsetY = -0.05; // Sample 5% of frame height above forehead
      const centerX = foreheadCenter.x;
      const centerY = foreheadCenter.y + hairOffsetY;

      const sampleSize = 15; // Slightly larger sample for hair
      tempCanvas.width = sampleSize;
      tempCanvas.height = sampleSize;

      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(
          results.image,
          centerX * videoWidth - sampleSize / 2,
          centerY * videoHeight - sampleSize / 2,
          sampleSize,
          sampleSize,
          0, 0, sampleSize, sampleSize
        );

        // Get average color
        const imageData = tempCtx.getImageData(0, 0, sampleSize, sampleSize);
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          r += imageData.data[i];
          g += imageData.data[i + 1];
          b += imageData.data[i + 2];
        }
        const pixelCount = sampleSize * sampleSize;
        hairColor = {
          r: Math.round(r / pixelCount),
          g: Math.round(g / pixelCount),
          b: Math.round(b / pixelCount)
        };
      }
    }
  }

  // Sample pants color from region below hips (when legs visible)
  let pantsColor: { r: number, g: number, b: number } | undefined;
  if (shouldUpdateTexture && results.image instanceof HTMLVideoElement && (hasHipLeft || hasHipRight) && (hasKneeLeft || hasKneeRight)) {
    const tempCanvas = document.createElement('canvas');
    const videoWidth = results.image.videoWidth;
    const videoHeight = results.image.videoHeight;

    // Calculate center point between hips and knees for pants sampling
    const hipCenterX = ((hasHipLeft ? hipLeft.x : 0) + (hasHipRight ? hipRight.x : 0)) / (hasHipLeft && hasHipRight ? 2 : 1);
    const hipCenterY = ((hasHipLeft ? hipLeft.y : 0) + (hasHipRight ? hipRight.y : 0)) / (hasHipLeft && hasHipRight ? 2 : 1);
    const kneeCenterX = ((hasKneeLeft ? kneeLeft.x : 0) + (hasKneeRight ? kneeRight.x : 0)) / (hasKneeLeft && hasKneeRight ? 2 : 1);
    const kneeCenterY = ((hasKneeLeft ? kneeLeft.y : 0) + (hasKneeRight ? kneeRight.y : 0)) / (hasKneeLeft && hasKneeRight ? 2 : 1);

    // Sample from midpoint between hips and knees (center of upper leg)
    const sampleX = (hipCenterX + kneeCenterX) / 2;
    const sampleY = (hipCenterY + kneeCenterY) / 2;

    const sampleSize = 10;
    tempCanvas.width = sampleSize;
    tempCanvas.height = sampleSize;

    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(
        results.image,
        sampleX * videoWidth - sampleSize / 2,
        sampleY * videoHeight - sampleSize / 2,
        sampleSize,
        sampleSize,
        0, 0, sampleSize, sampleSize
      );

      // Get average color
      const imageData = tempCtx.getImageData(0, 0, sampleSize, sampleSize);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
      }
      const pixelCount = sampleSize * sampleSize;
      pantsColor = {
        r: Math.round(r / pixelCount),
        g: Math.round(g / pixelCount),
        b: Math.round(b / pixelCount)
      };
    }
  }

  const torso: Torso = {
    texture: img ? { img } : undefined,
    color: dominantColor,
    skinColor: skinColor,
    hairColor: hairColor,
    pantsColor: pantsColor,
    landmarks: {
      shoulderLeft: hasShoulderLeft ? { x: shoulderLeft.x, y: shoulderLeft.y, z: shoulderLeft.z } : { x: 0, y: 0, z: 0 },
      shoulderRight: hasShoulderRight ? { x: shoulderRight.x, y: shoulderRight.y, z: shoulderRight.z } : { x: 0, y: 0, z: 0 },
      hipLeft: hasHipLeft ? { x: hipLeft.x, y: hipLeft.y, z: hipLeft.z } : { x: 0, y: 0, z: 0 },
      hipRight: hasHipRight ? { x: hipRight.x, y: hipRight.y, z: hipRight.z } : { x: 0, y: 0, z: 0 },
    }
  };

  body.torso = torso;
  return true;
};
