import { groupContactsByLetter, type Contact, type ContactGroup } from '@lilachat/shared';

/**
 * «Nuevo chat» on the web (pending 20): the people I already have a chat
 * with, plus the phone's contacts who are on Lilachat. Each person once, with
 * the name the phone's agenda gives them, by letter like the app.
 */
export function mergeContactGroups(mine: ContactGroup[], fromPhone: readonly Contact[]): ContactGroup[] {
  if (fromPhone.length === 0) return mine;
  const byId = new Map<string, Contact>();
  for (const contact of mine.flatMap((group) => group.contacts)) byId.set(contact.id, contact);
  for (const contact of fromPhone) {
    const known = byId.get(contact.id);
    byId.set(contact.id, known ? { ...known, name: contact.name ?? known.name } : contact);
  }
  return groupContactsByLetter([...byId.values()]);
}
