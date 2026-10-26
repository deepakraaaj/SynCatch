import { useTeamRoomStore } from './team-room-store';
import { TEAM_WORKSPACE_ENABLED, useTeamStore } from './team-store';
import { connectTeamRoomSync } from './team-room-sync';

/** Selects a room, connects its live sync, and unlocks the team workspace. */
export async function enterTeamRoom(roomId: string): Promise<void> {
  if (!TEAM_WORKSPACE_ENABLED) return;
  const state = useTeamRoomStore.getState();
  state.selectRoom(roomId);
  await connectTeamRoomSync(roomId);
  useTeamStore.getState().grantApprovedTeamAccess();
}

/**
 * Opens the room the user was last in, so switching to Team goes straight to
 * work instead of through the picker. Falls back to the first approved room
 * when there is no remembered selection; the header remains the place to
 * switch workspaces afterward.
 *
 * @returns true when a room was opened; false means the picker is still needed.
 */
export async function resumeLastTeamRoom(): Promise<boolean> {
  // An earlier hydrate that failed still flips `hydrated`, so retry whenever we
  // have no rooms to choose from rather than sending the user to the picker.
  const hydratedState = useTeamRoomStore.getState();
  if (!hydratedState.hydrated || hydratedState.rooms.length === 0) {
    await hydratedState.hydrate();
  }

  const { rooms, activeRoomId } = useTeamRoomStore.getState();
  const approved = rooms.filter((room) => room.status === 'approved');
  if (approved.length === 0) return false;

  const remembered = approved.find((room) => room.roomId === activeRoomId) ?? approved[0];

  await enterTeamRoom(remembered.roomId);
  return true;
}
