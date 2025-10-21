import {Mesh, Vector3} from '@babylonjs/core';
import {useEffect, useRef} from 'react';
import {useAfterRender} from 'react-babylonjs';
import {io, Socket} from 'socket.io-client';
import {ActionData, CharacterController} from '../../CharacterController';
import {isProd} from '../../util/detectEnv';
import Subscription from '../../util/subscriptionUtil';
import {Body} from '../capture/BodyCapture';
import {useAppDispatch} from '../hooks';
import {disconnected, update} from '../store/friends';
import {
    EventClientUpdateBody,
    EventClientUpdateLocation,
    EventServerUpdateClientBody,
    EventServerUpdateClientDisconnected,
    EventServerUpdateClientLocation,
    ServerUpdateClientBody,
    ServerUpdateClientDisconnected,
    ServerUpdateClientLocation
} from './api';

const NetFpsMax = 30;
const NetFpxMaxOffsetInMs = Math.ceil(1000 / NetFpsMax);

const Network = (props: {
    player: Mesh;
    controller: CharacterController;
    bodySubscription: Subscription<Body>;
}) => {
    const dispatch = useAppDispatch();
    const nextUpdateAfterRef = useRef(0);
    const socketRef = useRef<Socket | undefined>(undefined);
    const lastPositionRef = useRef(Vector3.Zero());
    const lastRotationRef = useRef(Vector3.Zero());
    const lastAnimationRef = useRef<ActionData | undefined>(undefined);
    useAfterRender(() => {
        if (socketRef.current?.disconnected) return;

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

        socketRef.current?.volatile.emit(EventClientUpdateLocation, {
            position: positionChanged ? {
                x: props.player.position.x,
                y: props.player.position.y,
                z: props.player.position.z
            } : undefined,
            rotation: rotationChanged ? {
                x: props.player.rotation.x,
                y: props.player.rotation.y,
                z: props.player.rotation.z
            } : undefined,
            animation: hasNewAnimation ? {
                name: activeAnimation.name,
                speed: activeAnimation.rate,
                loop: activeAnimation.loop
            } : undefined,
        });
        if (positionChanged) lastPositionRef.current = props.player.position.clone();
        if (rotationChanged) lastRotationRef.current = props.player.rotation.clone();
        nextUpdateAfterRef.current = now + NetFpxMaxOffsetInMs;
    });
    useEffect(() => {
        console.log('socketio: starting');
        if (!isProd()) {
            localStorage.debug = '*'; // Debugging
        }

        const host = isProd()
            ? window.location.host
            : '127.0.0.1:8080'
        const socket = io(`${window.location.protocol}//${host}`, {reconnection: true});

        socket.on('error', (er) => {
            console.log('socketio:', er);
        });

        socket.on('connect', () => {
            console.log('socketio: connected');
        });

        socket.on('disconnect', () => {
            console.log('socketio: disconnect');
        });

        socket.on(EventServerUpdateClientBody, (data: ServerUpdateClientBody) => {
            dispatch(update(data));
        });

        socket.on(EventServerUpdateClientLocation, (data: ServerUpdateClientLocation) => {
            dispatch(update(data));
        });

        socket.on(EventServerUpdateClientDisconnected, (data: ServerUpdateClientDisconnected) => {
            dispatch(disconnected(data.id));
        });

        const faceUnsubscribe = props.bodySubscription.subscribe(body => {
            if (socket.disconnected) return;
            socket.volatile.emit(EventClientUpdateBody, body);
        });

        socket.connect();

        socketRef.current = socket;

        return () => {
            console.log('socketio: disconnecting');
            faceUnsubscribe();
            socket.disconnect();
        };
    }, [dispatch, props.bodySubscription]);
    return null;
}


export default Network;
