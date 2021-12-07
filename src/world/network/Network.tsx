import { Mesh, Vector3 } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { useAfterRender } from 'react-babylonjs';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch } from '../hooks';
import { disconnected, update } from '../store/friends';
import { EventClientUpdateLocation, EventServerUpdateClientDisconnected, EventServerUpdateClientLocation, ServerUpdateClientDisconnected, ServerUpdateClientLocation } from './api';

const NetFpsMax = 30;
const NetFpxMaxOffsetInMs = Math.ceil(1000 / NetFpsMax);

const Network = (props: {
  player: Mesh;
}) => {
  const dispatch = useAppDispatch();
  const nextUpdateAfterRef = useRef(0);
  const socketRef = useRef<Socket>();
  const lastPositionRef = useRef(Vector3.Zero());
  const lastRotationRef = useRef(Vector3.Zero());
  useAfterRender(() => {
    if (!socketRef.current?.connected) return;
    const now = Date.now();
    if (nextUpdateAfterRef.current > now) return;
    const changed = !props.player.position.equals(lastPositionRef.current)
      || !props.player.rotation.equals(lastRotationRef.current);
    if (!changed) return;
    socketRef.current.volatile.emit(EventClientUpdateLocation, {
      position: { x: props.player.position.x, y: props.player.position.y, z: props.player.position.z },
      rotation: { x: props.player.rotation.x, y: props.player.rotation.y, z: props.player.rotation.z },
    });
    lastPositionRef.current = props.player.position.clone();
    lastRotationRef.current = props.player.rotation.clone();
    nextUpdateAfterRef.current = now + NetFpxMaxOffsetInMs;
  });
  useEffect(() => {
    console.log('socketio: starting');
    localStorage.debug = '*'; // Debugging

    const socket = io('http://localhost:8080', { reconnection: true });

    socket.on('error', (er) => {
      console.log('socketio:', er);
    });

    socket.on('connect', () => {
      console.log('socketio: connected');
    });

    socket.on('disconnect', () => {
      console.log('socketio: disconnect');
    });

    socket.on(EventServerUpdateClientLocation, (data: ServerUpdateClientLocation) => {
      dispatch(update(data));
    });

    socket.on(EventServerUpdateClientDisconnected, (data: ServerUpdateClientDisconnected) => {
      dispatch(disconnected(data.id));
    });

    socket.connect();

    socketRef.current = socket;

    return () => {
      console.log('socketio: disconnecting');
      socket.disconnect();
    };
  }, []);
  return null;
}


export default Network;
