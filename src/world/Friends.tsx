import { Vector3 } from '@babylonjs/core';
import React from 'react';
import { Model } from 'react-babylonjs';
import { useAppSelector } from './hooks';



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
  const position = useAppSelector(state => state.friends.friends[props.friendId]?.position);
  const rotation = useAppSelector(state => state.friends.friends[props.friendId]?.rotation);
  if (!position || !rotation) return null;
  return (
    <Model
      name={props.friendId}
      rootUrl='/assets/player/' sceneFilename='Vincent.babylon'
      position={new Vector3(position.x, position.y, position.z)}
      rotation={new Vector3(rotation.x, rotation.y, rotation.z)}
    />
  );
}
