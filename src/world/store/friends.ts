import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RunningAnimation, ServerUpdateClientLocation, Vector3Serializable } from '../network/api';
import type { RootState } from './store';

interface Friend {
  id: string;
  position: Vector3Serializable;
  rotation: Vector3Serializable;
  animation?: RunningAnimation;
}
interface FriendsState {
  friends: {
    [id: string]: Friend;
  };
}
const initialState: FriendsState = {
  friends: {},
}
export const friendsSlice = createSlice({
  name: 'friends',
  initialState,
  reducers: {
    update: (state, action: PayloadAction<ServerUpdateClientLocation>) => {
      if (!state.friends[action.payload.id]) {
        state.friends[action.payload.id] = {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          ...action.payload
        };
      } else {
        if (action.payload.position) state.friends[action.payload.id].position = action.payload.position;
        if (action.payload.rotation) state.friends[action.payload.id].rotation = action.payload.rotation;
        if (action.payload.animation) state.friends[action.payload.id].animation = action.payload.animation;
      }
    },
    disconnected: (state, action: PayloadAction<string>) => {
      if (!state.friends[action.payload]) return;
      const { [action.payload]: deletedKey, ...others } = state.friends;
      state.friends = others;
    },
  },
})

export const { update, disconnected } = friendsSlice.actions;

export const selectFriend = (state: RootState, id: string) => state.friends.friends[id];

export default friendsSlice.reducer;
