import { createPrefStore } from '../../ui/prefStore';
import { parseNotesViews, serializeNotesViews, type NotesView, type NotesViews } from './linkView';

/** «Chat» or «Por categoría», remembered per notes chat on this phone (José 18/11). */
const notesViewsStore = createPrefStore<NotesViews>('lilachat.pref.notesViews', parseNotesViews, {}, serializeNotesViews);

export function useNotesView(chatId: string): NotesView {
  return notesViewsStore.use()[chatId] ?? 'chat';
}

export function storeNotesView(chatId: string, view: NotesView): void {
  notesViewsStore.set({ ...notesViewsStore.get(), [chatId]: view });
}
