/**
 * Where the list goes while the emoji panel closes at the end of a chat
 * (`useScrollConTeclado`): down as much as the panel's room has shrunk. PURE,
 * and a worklet: it runs on the UI thread, frame by frame.
 */
export function offsetWhileDropping(startOffset: number, startRoom: number, room: number): number {
  'worklet';
  return Math.max(0, startOffset - (startRoom - room));
}
