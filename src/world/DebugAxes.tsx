import { Color3, Space, Vector3 } from '@babylonjs/core';
import React, { useEffect, useState } from 'react';
import { useScene } from 'react-babylonjs';
import { Unsubscribe } from '../util/subscriptionUtil';
import randomUuid from '../util/uuid';
import { Vector } from './capture/BodyCapture';

export type AxisData = { [name: string]: AxisUpdate };
export interface AxisUpdate {
  name: string;
  playerName?: string;
  boneName: string;
  space?: Space;
  direction: Vector;
  color?: Color3;
}
type Subscriber = ((name: string, update: AxisUpdate, data: AxisData) => void);
class DebugAxesTool {
  readonly subscribers: { [subscriberId: string]: Subscriber } = {};
  data: AxisData = {};

  subscribe(subscriber: Subscriber): Unsubscribe {
    const subscriberId = randomUuid();
    this.subscribers[subscriberId] = subscriber;
    return () => {
      delete this.subscribers[subscriberId];
    };
  }

  update(update: AxisUpdate): void {
    this.data[update.name] = update;
    for (const subscriber of Object.values(this.subscribers)) {
      subscriber && subscriber(update.name, update, this.data);
    }
  }
}
export const debugAxesTool = new DebugAxesTool();

export const DebugAxes = () => {
  const [count, setCount] = useState<number>();
  useEffect(() => {
    const unsubscribe = debugAxesTool.subscribe((name, update, data) => { setCount(Object.keys(data).length) });
    return () => { unsubscribe() };
  });
  return (
    <>
      {Object.keys(debugAxesTool.data).map(name => (
        <DebugAxis key={name} name={name} />
      ))}
    </>
  );
};

export const DebugAxis = (props: {
  name: string;
}) => {
  const scene = useScene();
  const [update, setUpdate] = useState<AxisUpdate>();
  useEffect(() => {
    const unsubscribe = debugAxesTool.subscribe((name, update, data) => {
      if (name === props.name) setUpdate(update);
    });
    return () => { unsubscribe() };
  });

  if (!update) return (<></>);
  const name = props.name;
  const mesh = scene?.getMeshByName(update.playerName || 'playerSelf');
  const skeleton = mesh?.skeleton;
  const boneIndex = skeleton?.getBoneIndexByName(update.boneName);
  if (!boneIndex) return (<></>);
  const bone = skeleton?.bones[boneIndex];
  if (!bone) return (<></>);

  const start = bone.getAbsolutePositionFromLocal(Vector3.Zero(), mesh);
  const direction = new Vector3(update.direction.x, update.direction.y, update.direction.z);
  const end = Space.WORLD === update.space
    ? start.add(direction)
    : bone.getAbsolutePositionFromLocal(direction, mesh);

  return (
    <lines
      key={randomUuid()}
      name={name}
      points={[start, end]}
      color={update.color}
    />
  );
};
