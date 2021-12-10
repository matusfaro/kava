import { Face } from "../FaceCapture";

export interface Vector3Serializable { x: number; y: number; z: number };
export interface RunningAnimation { name: string; speed: number; loop: boolean };

export const EventClientUpdateLocation = 'client-update-location';
export interface ClientUpdateLocation {
  position?: Vector3Serializable;
  rotation?: Vector3Serializable;
  animation?: RunningAnimation;
}

export const EventClientUpdateFace = 'client-update-face';
export type ClientUpdateFace = Face;

export const EventServerUpdateClientLocation = 'server-update-client-location';
export interface ServerUpdateClientLocation extends ClientUpdateLocation {
  id: string;
}

export const EventServerUpdateClientDisconnected = 'server-update-client-disconnected';
export interface ServerUpdateClientDisconnected {
  id: string;
}
