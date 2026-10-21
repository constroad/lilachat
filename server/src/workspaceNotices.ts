/**
 * «Your spaces changed, read them again» to the people a change touches: the
 * admins when a request arrives, the person approved, added, rejected,
 * deactivated or given another role. Socket-free so the logic is testable; the
 * socket server plugs the emitter in (`configureWorkspaceNotices`).
 */
type Notify = (userIds: readonly string[]) => void;
let notify: Notify = () => undefined;

export function configureWorkspaceNotices(emit: Notify): void {
  notify = emit;
}

export function noticeSpacesChanged(userIds: readonly (string | { toString(): string } | undefined)[]): void {
  const ids = [...new Set(userIds.flatMap((id) => (id ? [String(id)] : [])))];
  if (ids.length) notify(ids);
}
