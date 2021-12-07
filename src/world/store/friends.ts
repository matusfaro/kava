import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Vector3Serializable } from '../network/api'
import type { RootState } from './store'

interface Friend {
  id: string;
  position: Vector3Serializable;
  rotation: Vector3Serializable;
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
    update: (state, action: PayloadAction<{ id: string; position: Vector3Serializable; rotation: Vector3Serializable }>) => {
      if (!state.friends[action.payload.id]) {
        state.friends[action.payload.id] = action.payload;
      } else {
        state.friends[action.payload.id].position = action.payload.position;
        state.friends[action.payload.id].rotation = action.payload.rotation;
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
