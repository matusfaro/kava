
export interface Vector3Serializable { x: number; y: number; z: number };

export const EventClientUpdateLocation = 'client-update-location';
export interface ClientUpdateLocation {
  position: Vector3Serializable;
  rotation: Vector3Serializable;
}

export const EventServerUpdateClientLocation = 'server-update-client-location';
export interface ServerUpdateClientLocation {
  id: string;
  position: Vector3Serializable;
  rotation: Vector3Serializable;
}

export const EventServerUpdateClientDisconnected = 'server-update-client-disconnected';
export interface ServerUpdateClientDisconnected {
  id: string;
}
