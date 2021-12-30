import { Mesh, Vector3 } from '@babylonjs/core';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import Subscription from '../util/subscriptionUtil';
import { Face } from './capture/BodyCapture';
import { useAppSelector } from './hooks';
import { HeadBoneName, Player } from './Player';

export const Friends = () => {
  const friends = useAppSelector(state => state.friends.friends);
  return (
    <>
      {Object.keys(friends).map(friendId => (
        <Friend key={friendId} friendId={friendId} />
      ))}
    </>
  );
};

export const Friend = (props: {
  friendId: string;
}) => {
  const [player, setPlayer] = useState<Mesh>();
  const playerCallback = useCallback(setPlayer, [setPlayer]);

  const lastAnimNameRef = useRef<string>();
  const position = useAppSelector(state => state.friends.friends[props.friendId]?.position);
  const rotation = useAppSelector(state => state.friends.friends[props.friendId]?.rotation);
  const animation = useAppSelector(state => state.friends.friends[props.friendId]?.animation);

  const faceSubscription: Subscription<Face> = useMemo(() => new Subscription(), []);
  const face = useAppSelector(state => state.friends.friends[props.friendId]?.face);
  if (!!face && faceSubscription.getValue() !== face) {
    faceSubscription.notify(face);
  }

  // Update face location on movement
  player?.skeleton?.bones[player?.skeleton?.getBoneIndexByName(HeadBoneName) || -1]
    .markAsDirty();

  if (!position || !rotation) return null;

  if (!!player?.skeleton) {
    if (animation && lastAnimNameRef.current !== animation.name) {
      player.skeleton?.beginAnimation(animation.name, animation.loop, animation.speed);
    }
    lastAnimNameRef.current = animation?.name;
  }

  return (
    <>
      <Player name={props.friendId} playerReady={playerCallback} faceSubscription={faceSubscription} />
      {!!player && (
        <mesh
          fromInstance={player}
          name={props.friendId}
          id={props.friendId}
          position={new Vector3(position.x, position.y, position.z)}
          rotation={new Vector3(rotation.x, rotation.y, rotation.z)}
        />
      )}
      {/* // <Model
    //   onCreated={mesh => friendRef.current = mesh as Mesh}
    //   name={props.friendId}
    //   rootUrl='/assets/player/' sceneFilename='Vincent.babylon'
    //   position={new Vector3(position.x, position.y, position.z)}
    //   rotation={new Vector3(rotation.x, rotation.y, rotation.z)}
    //   onModelLoaded={model => {
    //     const friend = model.meshes![0];
    //     const skeleton = model.skeletons![0];
    //     friend.skeleton = skeleton;
    //     skeleton.enableBlending(0.1);
    //   }}
    // /> */}
    </>
  );
}
