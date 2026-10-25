/**
 * Whether the chat offers nudges and winks: a 1:1 always, a group only when an
 * admin switched them on (the server checks it too), a draft never.
 *
 * The switch comes from the group's detail, which also holds the chats of a space.
 * The personal chat list does not (José, 25/10/2026), so it is only the fallback
 * while the detail loads.
 */
export function funAvailable(params: { isDraft: boolean; isGroup: boolean; detailAllows?: boolean; listAllows?: boolean }): boolean {
  if (params.isDraft) return false;
  if (!params.isGroup) return true;
  return (params.detailAllows ?? params.listAllows) === true;
}
