import { Mesh, Vector3 } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { useAfterRender, useScene } from 'react-babylonjs';
import { io, Socket } from 'socket.io-client';
import { ActionData, CharacterController } from '../../CharacterController';
import { useAppDispatch } from '../hooks';
import { disconnected, update } from '../store/friends';
import { EventClientUpdateLocation, EventServerUpdateClientDisconnected, EventServerUpdateClientLocation, ServerUpdateClientDisconnected, ServerUpdateClientLocation } from './api';

const NetFpsMax = 30;
const NetFpxMaxOffsetInMs = Math.ceil(1000 / NetFpsMax);

const Network = (props: {
  player: Mesh;
  controller: CharacterController;
}) => {
  const scene = useScene();
  const dispatch = useAppDispatch();
  const nextUpdateAfterRef = useRef(0);
  const socketRef = useRef<Socket>();
  const lastPositionRef = useRef(Vector3.Zero());
  const lastRotationRef = useRef(Vector3.Zero());
  const lastAnimationRef = useRef<ActionData>();
  useAfterRender(() => {
    if (!socketRef.current?.connected) return;

    const activeAnimation = props.controller.getAnim() || undefined;
    const hasNewAnimation = !!activeAnimation && lastAnimationRef.current !== activeAnimation;
    lastAnimationRef.current = activeAnimation;

    const now = Date.now();
    if (!hasNewAnimation) {
      if (nextUpdateAfterRef.current > now) return;
    }

    const positionChanged = !props.player.position.equals(lastPositionRef.current);
    const rotationChanged = !props.player.rotation.equals(lastRotationRef.current);
    if (!positionChanged && !rotationChanged && !hasNewAnimation) return;

    socketRef.current.volatile.emit(EventClientUpdateLocation, {
      position: positionChanged ? { x: props.player.position.x, y: props.player.position.y, z: props.player.position.z } : undefined,
      rotation: rotationChanged ? { x: props.player.rotation.x, y: props.player.rotation.y, z: props.player.rotation.z } : undefined,
      animation: hasNewAnimation ? { name: activeAnimation.name, speed: activeAnimation.rate, loop: activeAnimation.loop } : undefined,
    });
    if (positionChanged) lastPositionRef.current = props.player.position.clone();
    if (rotationChanged) lastRotationRef.current = props.player.rotation.clone();
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
