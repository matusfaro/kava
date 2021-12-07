import { Mesh, Vector3 } from '@babylonjs/core';
import React from 'react';
import { Model } from 'react-babylonjs';


export const City = (props: {
  groundReady: (ground: Mesh) => void,
}) => {
  return (
    <>
      <Model name='city' rootUrl='/assets/city/' sceneFilename='scene.glb' scaleToDimension={100} position={new Vector3(0, -2, 0)} />
      <groundFromHeightMap
        name='ground'
        ref={props.groundReady}
        url='/assets/city/city_heightMap.png'
        // scaling={new Vector3(10, 10, 10)}
        position={new Vector3(0, -10, 0)}
        width={128} height={128} minHeight={0} maxHeight={27}
        subdivisions={128}
        checkCollisions
        isPickable
      >
        <standardMaterial name='nomat' alpha={0} />
      </groundFromHeightMap>
    </>
  );
};
