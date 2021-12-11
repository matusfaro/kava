import nipplejs from 'nipplejs';
import { useEffect, useRef } from 'react';
import { CharacterController } from '../CharacterController';

export const Joystick = (props: {
  controller: CharacterController;
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sensitivity = 16;
    const manager = nipplejs.create({
      mode: 'static',
      position: {
        top: '50%',
        left: '50%',
      },
      zone: divRef.current!,
      dynamicPage: true,
      follow: false,
    });
    const handlerJoystickAdded = (evtAdded: any, nipple: any) => {
      console.log('DEBUG added', nipple);
      nipple.on('start move end dir plain dir:up plain:up dir:left plain:left dir:down ' +
        'plain:down dir:right plain:right', (evt: any) => {
          if (evt.target && evt.target.position) {
            var x = evt.target.collection.nipples[0].frontPosition.x;
            var y = evt.target.collection.nipples[0].frontPosition.y;

            props.controller.walk(y < -sensitivity);
            props.controller.walkBack(y > sensitivity);
            props.controller.turnLeft(x < -sensitivity);
            props.controller.turnRight(x > sensitivity);

            // Enable/Disable Running
            props.controller.moveFast(y < -Math.abs(sensitivity * 2) || y > sensitivity * 2);
          }

          // STOPPING
          if (evt.type === 'end') props.controller.idle();
        });
    };

    // Static joystick doesn't trigger 'added' event so set it up here
    const staticJoystick = manager.get(0);
    if (staticJoystick) handlerJoystickAdded(undefined, staticJoystick);

    manager.on('added', handlerJoystickAdded);
    manager.on('removed', (evtRemoved: any, nipple: any) => {
      nipple.off('start move end dir plain dir:up plain:up dir:left plain:left dir:down ' +
        'plain:down dir:right plain:right');
    });
  }, []);
  return (
    <div id='joystick' ref={divRef} />
  );
}
