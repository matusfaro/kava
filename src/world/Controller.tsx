import { ArcRotateCamera, Mesh, Vector3 } from '@babylonjs/core';
import { useEffect } from 'react';
import { useScene } from 'react-babylonjs';
import { CharacterController } from '../CharacterController';


export const Controller = (props: {
  player: Mesh;
  camera: ArcRotateCamera;
  controllerReady: (controller: CharacterController) => void;
}) => {
  const scene = useScene();

  useEffect(() => {
    if (props.player.rotationQuaternion) {
      props.player.rotation = props.player.rotationQuaternion.toEulerAngles();
      props.player.rotationQuaternion = null;
    }

    // https://github.com/ssatguru/BabylonJS-CharacterController
    const controller = new CharacterController(props.player, props.camera, scene!);

    controller.setTurningOff(true);

    const speed = 4;
    const speedFast = 10;
    controller.setGravity(9.8);    //default 9.8 m/s^2
    controller.setWalkSpeed(speed);  //default 3 m/s
    controller.setRunSpeed(speedFast);   //default 6 m/s
    controller.setBackSpeed(speed);  //default 3 m/s
    controller.setBackFastSpeed(speedFast);  //default 6 m/s
    controller.setJumpSpeed(speedFast);  //default 6 m/s
    controller.setLeftSpeed(speed);  //default 3 m/s
    controller.setLeftFastSpeed(speedFast);  //default 6 m/s
    controller.setRightSpeed(speed); //default 3 m/s
    controller.setRightFastSpeed(speedFast); //default 6 m/s
    controller.setTurnSpeed(Math.PI / 8);//default PI/8 degree/s
    controller.setTurnFastSpeed(Math.PI / 4);//default PI/4 degree/s

    controller.setCameraTarget(new Vector3(0, 1.5, 0));

    //if the camera comes close to the player we want to enter first person mode.
    controller.setNoFirstPerson(false);
    //the height of steps which the player can climb
    controller.setStepOffset(0.4);
    //the minimum and maximum slope the player can go up
    //between the two the player will start sliding down if it stops
    controller.setSlopeLimit(30, 60);

    //tell controller 
    // - which animation range should be used for which player animation
    // - rate at which to play that animation range
    // - wether the animation range should be looped
    //use this if name, rate or looping is different from default
    controller.setIdleAnim("idle", 1, true);
    controller.setTurnLeftAnim("turnLeft", 0.5, true);
    controller.setTurnRightAnim("turnRight", 0.5, true);
    controller.setWalkBackAnim("walkBack", 0.5, true);
    controller.setIdleJumpAnim("idleJump", .5, false);
    controller.setRunJumpAnim("runJump", 0.6, false);
    //set the animation range name to "null" to prevent the controller from playing
    //a player animation.
    //here even though we have an animation range called "fall" we donot want to play 
    //the fall animation
    controller.setFallAnim(null as any, 2, false);
    controller.setSlideBackAnim("slideBack", 1, false)

    controller.start();

    return () => controller.stop();
  }, []);

  return null;
}


