import { GroundMesh, Mesh, StandardMaterial, Vector3 } from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { useEffect } from 'react';
import { useScene } from 'react-babylonjs';


export const City = (props: {
  groundReady: (ground: Mesh) => void,
}) => {
  const scene = useScene();

  useEffect(() => {
    if (!scene) return;

    // Load the city model using the async API
    const loadCity = async () => {
      try {
        const container = await LoadAssetContainerAsync(
          '/assets/city/scene.glb',
          scene
        );

        container.addAllToScene();

        console.log('City meshes loaded:', container.meshes.length);

        // Find the root mesh
        const rootMesh = container.meshes.find(m => m.name === "__root__") || container.meshes[0];

        if (rootMesh) {
          // Calculate combined bounding box of all meshes
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

          // Calculate size from combined bounds
          const sizeX = maxX - minX;
          const sizeY = maxY - minY;
          const sizeZ = maxZ - minZ;

          console.log('Combined city bounds:', {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: { x: sizeX, y: sizeY, z: sizeZ }
          });

          let cityScaleFactor = 1;

          // Check if we have valid bounds
          if (sizeX > 0 && sizeY > 0 && sizeZ > 0 && isFinite(sizeX)) {
            // Get the maximum dimension
            const maxDimension = Math.max(sizeX, sizeY, sizeZ);

            // Scale to fit in 100 units
            cityScaleFactor = 100 / maxDimension;

            rootMesh.position = new Vector3(0, 0, 0);
            rootMesh.scaling = new Vector3(cityScaleFactor, cityScaleFactor, cityScaleFactor);

            console.log('City scaled:', {
              name: rootMesh.name,
              scaleFactor: cityScaleFactor,
              newScaling: rootMesh.scaling
            });
          } else {
            // Use a reasonable default scaling
            console.log('Using default scaling');
            rootMesh.position = new Vector3(0, 0, 0);
            rootMesh.scaling = new Vector3(1, 1, 1);
          }

          // Store the scale factor for the ground
          (window as any).cityScaleFactor = cityScaleFactor;
        }
      } catch (error) {
        console.error('Failed to load city model:', error);
      }
    };

    loadCity().catch(console.error);
  }, [scene, props]);

  return (
    <groundFromHeightMap
      name='ground'
      ref={(ground: GroundMesh | null) => {
        if (ground) {
          // Make completely invisible and ensure no rendering
          ground.visibility = 0;
          ground.isVisible = false;
          ground.showBoundingBox = false;
          ground.renderingGroupId = 0;
          ground.isPickable = false;

          // Create a completely transparent material
          if (!ground.material && scene) {
            const invisibleMaterial = new StandardMaterial('invisibleMaterial', scene);
            invisibleMaterial.alpha = 0;
            invisibleMaterial.transparencyMode = 2; // ALPHA_BLEND
            ground.material = invisibleMaterial;
          }

          props.groundReady(ground as Mesh);
        }
      }}
      url='/assets/city/city_heightMap.png'
      position={new Vector3(0, 0, 0)}
      width={100} height={100} minHeight={0} maxHeight={10}
      subdivisions={64}
      checkCollisions
      isPickable={false}
    />
  );
};
