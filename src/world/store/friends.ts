import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Face } from '../BodyCapture';
import { RunningAnimation, ServerUpdateClientBody, ServerUpdateClientLocation, Vector3Serializable } from '../network/api';
import type { RootState } from './store';

interface Friend {
  id: string;
  position: Vector3Serializable;
  rotation: Vector3Serializable;
  animation?: RunningAnimation;
  face?: Face;
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
    update: (state, action: PayloadAction<ServerUpdateClientLocation | ServerUpdateClientBody>) => {
      if (!state.friends[action.payload.id]) {
        state.friends[action.payload.id] = {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          ...action.payload
        };
      } else {
        Object.entries(action.payload).forEach(([key, val]) => {
          state.friends[action.payload.id][key as keyof Friend] = val;
        });
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
