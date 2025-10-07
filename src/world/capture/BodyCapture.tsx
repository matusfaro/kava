import { Mesh } from '@babylonjs/core';
import { FilesetResolver, HolisticLandmarker, HolisticLandmarkerResult } from '@mediapipe/tasks-vision';
import { useEffect, useRef } from 'react';
import { GameOptions } from '../../App';
import Subscription from '../../util/subscriptionUtil';
import { Capturer, VisibilityThreshold } from './capturer';
import { captureFace } from './face';

export const Qps = 30;
export const FaceCaptureDimensions = { width: 1280, height: 720 };

// Legacy Results type for compatibility with existing code
interface Results {
  poseLandmarks: any[];
  faceLandmarks: any[];
  rightHandLandmarks: any[];
  leftHandLandmarks: any[];
  segmentationMask?: any;
  multiFaceGeometry: any[];
  image: HTMLVideoElement | HTMLCanvasElement;
}

// TODO convert these into number arrays
export type SkeletonUpdate = Array<{
  n: string; // bone name
  p?: Vector; // Deprecated position
  r?: Vector;  // Deprecated euler rotation
  q?: Quater; // Rotation (Quaternion)
  s?: number; // Scaling length
}>;

export interface Body {
  skeleton: SkeletonUpdate,
  face?: Face,
  webcamCanvasRef?: React.RefObject<HTMLCanvasElement>;
}
export interface Vector { x: number, y: number, z: number };
export interface Quater { x: number, y: number, z: number, w: number };
export interface Face {
  mesh: {
    positions: Array<number>;
    normals: Array<number>;
    indices: Array<number>;
    p?: Vector;
    q?: Quater;
  },
  texture?: {
    uvs: Array<number>;
    img: string;
  },
}

const convertToLegacyFormat = (result: HolisticLandmarkerResult, image: HTMLVideoElement): Results => {
  return {
    poseLandmarks: result.poseLandmarks?.[0] || [],
    faceLandmarks: result.faceLandmarks?.[0] || [],
    rightHandLandmarks: result.rightHandLandmarks?.[0] || [],
    leftHandLandmarks: result.leftHandLandmarks?.[0] || [],
    segmentationMask: result.poseSegmentationMasks?.[0],
    multiFaceGeometry: [], // Not used in this app
    image: image as any // Cast to any to avoid type conflict
  } as Results;
};

const captureToBody = (results: Results, capturer: Capturer, options: GameOptions): Body | undefined => {
  const body: Body = { skeleton: [] };

  let changed = false;
  if (options.renderFace.current) changed = captureFace(results, body) || changed;
  if (options.renderBones.current) changed = capturer.capture(results, body.skeleton, options) || changed;

  return changed ? body : undefined;
}

const previewWebcam = (results: Results, options: GameOptions, webcamCanvasRef?: React.RefObject<HTMLCanvasElement | null>) => {
  if (!options.preview.current || !webcamCanvasRef?.current) return;

  const canvasElement = webcamCanvasRef.current;
  if (!canvasElement) return;
  const canvasCtx = canvasElement.getContext('2d');
  if (!canvasCtx) return;

  // Draw the overlays
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the video frame
  if (results.image instanceof HTMLVideoElement) {
    canvasCtx.drawImage(
      results.image, 0, 0, canvasElement.width, canvasElement.height);
  }

  // Basic visualization of landmarks
  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    canvasCtx.fillStyle = 'red';
    results.poseLandmarks.forEach((landmark: any) => {
      if (landmark.visibility && landmark.visibility >= VisibilityThreshold) {
        canvasCtx.beginPath();
        canvasCtx.arc(
          landmark.x * canvasElement.width,
          landmark.y * canvasElement.height,
          3, 0, 2 * Math.PI
        );
        canvasCtx.fill();
      }
    });
  }

  canvasCtx.restore();
}

const BodyCapture = (props: {
  player: Mesh;
  videoElement: HTMLVideoElement;
  bodySubscription: Subscription<Body>;
  webcamCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  options: GameOptions;
}) => {
  const holisticLandmarkerRef = useRef<HolisticLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastTimestampMsRef = useRef(-1);

  useEffect(() => {
    const capturer = new Capturer(props.options);
    const frameInterval = 1000 / Qps;

    // Initialize webcam
    const initializeWebcam = async () => {
      try {
        console.log('Requesting webcam access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: FaceCaptureDimensions.width,
            height: FaceCaptureDimensions.height
          }
        });

        streamRef.current = stream;
        if (props.videoElement) {
          props.videoElement.srcObject = stream;
          console.log('Webcam stream connected to video element');

          // Wait for video to be ready
          await new Promise<void>((resolve) => {
            props.videoElement.onloadedmetadata = () => {
              console.log('Video metadata loaded, ready state:', props.videoElement.readyState);
              // Ensure video is playing
              props.videoElement.play().then(() => {
                console.log('Video is playing');
                resolve();
              }).catch(err => {
                console.error('Error playing video:', err);
                resolve();
              });
            };
          });
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
      }
    };

    const initializeHolistic = async () => {
      try {
        console.log('Initializing HolisticLandmarker...');

        // Create off-screen canvas for processing
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = FaceCaptureDimensions.width;
        canvasRef.current.height = FaceCaptureDimensions.height;
        canvasCtxRef.current = canvasRef.current.getContext('2d');
        console.log('Created processing canvas:', canvasRef.current.width, 'x', canvasRef.current.height);

        // Use stable version 0.10.14 WASM
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        console.log('FilesetResolver created successfully');

        // Use the latest model
        const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task';
        console.log('Loading model from:', modelAssetPath);

        // Create HolisticLandmarker - let MediaPipe handle model loading
        holisticLandmarkerRef.current = await HolisticLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelAssetPath,
            delegate: 'GPU'  // Use GPU which usually works better
          },
          runningMode: 'VIDEO',
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5
        });

        console.log('HolisticLandmarker initialized successfully');
        console.log('Landmarker object:', holisticLandmarkerRef.current);

        // Test detection on a single frame to ensure model is loaded
        try {
          const testCanvas = document.createElement('canvas');
          testCanvas.width = 640;
          testCanvas.height = 480;
          const testCtx = testCanvas.getContext('2d');
          if (testCtx && props.videoElement) {
            // Wait for video to have content
            await new Promise(resolve => setTimeout(resolve, 500));
            testCtx.drawImage(props.videoElement, 0, 0, 640, 480);
            const testResult = holisticLandmarkerRef.current.detectForVideo(testCanvas, 0);
            console.log('Test detection result:', {
              hasPose: !!testResult?.poseLandmarks?.length,
              hasFace: !!testResult?.faceLandmarks?.length,
              result: testResult
            });
          }
        } catch (testError) {
          console.error('Test detection failed:', testError);
        }

        // Wait a bit before starting processing
        setTimeout(() => {
          startProcessing();
        }, 1000);
      } catch (error) {
        console.error('Failed to initialize HolisticLandmarker:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.error('Full error:', error);
      }
    };

    const startProcessing = () => {
      console.log('Starting frame processing loop');
      let frameCount = 0;
      startTimeRef.current = performance.now(); // Set start time
      const processFrame = () => {
        const currentTime = Date.now();

        // Skip if still processing or not enough time has passed
        if (isProcessingRef.current || (currentTime - lastFrameTimeRef.current < frameInterval)) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        if (!holisticLandmarkerRef.current || !props.videoElement) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Check if video is ready and has content
        if (props.videoElement.readyState < 2 || props.videoElement.videoWidth === 0 || props.videoElement.videoHeight === 0) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Don't skip frames - process immediately
        // if (frameCount < 10) {
        //   frameCount++;
        //   animationFrameRef.current = requestAnimationFrame(processFrame);
        //   return;
        // }

        isProcessingRef.current = true;
        lastFrameTimeRef.current = currentTime;

        try {
          frameCount++;

          // Ensure strictly monotonically increasing timestamps
          let timestampMs = Math.round(performance.now());

          // If timestamp hasn't increased, increment it
          if (timestampMs <= lastTimestampMsRef.current) {
            timestampMs = lastTimestampMsRef.current + 1;
          }
          lastTimestampMsRef.current = timestampMs;

          // Log before detection on first few frames
          if (frameCount <= 5) {
            console.log(`Frame ${frameCount} - Before detection:`, {
              timestamp: timestampMs,
              videoWidth: props.videoElement.videoWidth,
              videoHeight: props.videoElement.videoHeight,
              videoReadyState: props.videoElement.readyState,
              currentTime: props.videoElement.currentTime,
              srcObject: props.videoElement.srcObject,
              paused: props.videoElement.paused,
              networkState: props.videoElement.networkState
            });

            // Test drawing video to canvas to verify it has actual content
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 100;
            testCanvas.height = 100;
            const ctx = testCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(props.videoElement, 0, 0, 100, 100);
              const imageData = ctx.getImageData(50, 50, 1, 1);
              console.log('Video pixel test:', imageData.data);
            }
          }

          let results;
          try {
            // Draw video frame to canvas first to avoid direct video element issues
            if (canvasCtxRef.current && canvasRef.current) {
              canvasCtxRef.current.drawImage(
                props.videoElement,
                0, 0,
                canvasRef.current.width,
                canvasRef.current.height
              );


              // Use canvas only - video element causes errors
              results = holisticLandmarkerRef.current.detectForVideo(
                canvasRef.current,
                timestampMs
              );

              // Log if no results at all
              if (!results) {
                console.log('No results returned from detectForVideo');
              } else if (frameCount === 1) {
                // On first frame, log the structure of results
                console.log('First frame results structure:', {
                  hasResults: !!results,
                  resultKeys: Object.keys(results),
                  poseLandmarksLength: results.poseLandmarks?.length,
                  faceLandmarksLength: results.faceLandmarks?.length
                });
              }
            } else {
              console.error('Canvas not ready');
              isProcessingRef.current = false;
              animationFrameRef.current = requestAnimationFrame(processFrame);
              return;
            }
          } catch (detectionError) {
            console.error('Detection error:', detectionError);
            console.error('Detection error details:', detectionError instanceof Error ? detectionError.message : String(detectionError));
            // Skip this frame but continue processing
            isProcessingRef.current = false;
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
          }

          // Log raw results on first detection or every 30 frames
          if (frameCount <= 5 || frameCount % 30 === 0) {
            console.log(`Frame ${frameCount} - Raw results:`, results);
            console.log('MediaPipe detection status:', {
              frameCount,
              hasPoseLandmarks: !!results.poseLandmarks?.length,
              hasFaceLandmarks: !!results.faceLandmarks?.length,
              hasLeftHand: !!results.leftHandLandmarks?.length,
              hasRightHand: !!results.rightHandLandmarks?.length,
              videoReadyState: props.videoElement.readyState,
              videoWidth: props.videoElement.videoWidth,
              videoHeight: props.videoElement.videoHeight,
              timestamp: timestampMs
            });
          }

          // Log first detection
          if (frameCount === 1 && results.poseLandmarks?.length) {
            console.log('First pose detected! Starting body tracking...');
          }

          // Convert to legacy format and process
          const legacyResults = convertToLegacyFormat(results, props.videoElement);
          const body = captureToBody(legacyResults, capturer, props.options);

          if (body) {
            props.bodySubscription.notify(body);
          }

          // Preview if enabled
          previewWebcam(legacyResults, props.options, props.webcamCanvasRef);

        } catch (error) {
          console.error('Error processing frame:', error);
        } finally {
          isProcessingRef.current = false;
        }

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    // Initialize webcam and MediaPipe
    const initialize = async () => {
      await initializeWebcam();
      await initializeHolistic();
    };

    initialize().catch(console.error);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (holisticLandmarkerRef.current) {
        try {
          holisticLandmarkerRef.current.close();
        } catch (error) {
          console.error('Error closing HolisticLandmarker:', error);
        }
        holisticLandmarkerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('Webcam stream stopped');
      }
    };
  }, []); // Empty dependency array for mount-only effect

  return null;
}

export default BodyCapture;