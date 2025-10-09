import {LoadAssetContainerAsync, Vector3} from '@babylonjs/core';
import {useScene} from 'react-babylonjs';
import {useEffect} from "react";

export const City = (
    props: { groundReady?: (ground: any) => void }
) => {
    const scene = useScene();

    useEffect(() => {
        if (!scene) return;
        const loadCity = async () => {
            const container = await LoadAssetContainerAsync(
                '/assets/city/scene.glb',
                scene,
                {
                    name: 'city',
                },
            );
            container.addAllToScene();
            console.log('City meshes loaded:', container.meshes.length);

            // Find the root mesh
            const rootMesh = container.meshes.find(m => m.name === "__root__") || container.meshes[0];

            if (rootMesh) {
                // Calculate combined bounding box for scaleToDimension
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

                container.meshes.forEach(mesh => {
                    const bounds = mesh.getBoundingInfo();
                    if (bounds && bounds.boundingBox) {
                        const min = bounds.boundingBox.minimumWorld;
                        const max = bounds.boundingBox.maximumWorld;

                        minX = Math.min(minX, min.x);
                        minY = Math.min(minY, min.y);
                        minZ = Math.min(minZ, min.z);
                        maxX = Math.max(maxX, max.x);
                        maxY = Math.max(maxY, max.y);
                        maxZ = Math.max(maxZ, max.z);
                    }
                });

                // Calculate size for scaling
                const sizeX = maxX - minX;
                const sizeY = maxY - minY;
                const sizeZ = maxZ - minZ;

                if (sizeX > 0 && sizeY > 0 && sizeZ > 0 && isFinite(sizeX)) {
                    // Get the maximum dimension and scale to fit in 100 units
                    const maxDimension = Math.max(sizeX, sizeY, sizeZ);
                    const scaleFactor = 100 / maxDimension;

                    // Flip along Z-axis by using negative scaling
                    rootMesh.scaling = new Vector3(scaleFactor, scaleFactor, -scaleFactor);
                } else {
                    // Flip along Z-axis
                    rootMesh.scaling = new Vector3(1, 1, -1);
                }

                // Set position
                rootMesh.position = new Vector3(0, -2, 0);

                // Disable collisions on all city meshes
                container.meshes.forEach(mesh => {
                    mesh.checkCollisions = false;
                });

                console.log('City configured:', {
                    name: rootMesh.name,
                    position: rootMesh.position,
                    scaling: rootMesh.scaling,
                    meshCount: container.meshes.length
                });
            }

            props.groundReady?.(rootMesh);
        };
        loadCity().catch(console.error);
    }, [scene]);

    return (
        <>
            <groundFromHeightMap
                name='ground'
                url='/assets/city/city_heightMap.png'
                position={new Vector3(0, -10, 0)}
                width={122}
                height={122}
                minHeight={0}
                maxHeight={27}
                subdivisions={256}
                checkCollisions
                isPickable
            >
                <standardMaterial name='nomat' alpha={0}/>
            </groundFromHeightMap>
        </>
    );
};
