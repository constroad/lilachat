/**
 * Checklists in the chat, like Telegram's (José, 21/10; backlog 8): a card
 * with a title and tasks that people tick; each done task says who ticked it
 * and when; tasks can be added later; it updates live (`ref.changed`). Whoever
 * made it decides whether the others can tick and add. PURE: the server
 * applies the same rules the app and the web show.
 */
export const CHECKLIST_LIMITS = { title: 120, item: 200, items: 30 } as const;

export type ChecklistItem = { id: string; text: string; doneBy: string | null; doneAt: string | null };
export type AgendaChecklist = {
  _id: string;
  chatId: string;
  createdBy: string;
  title: string;
  items: ChecklistItem[];
  othersCanMark: boolean;
  othersCanAdd: boolean;
  createdAt: string;
};

const key = (text: string) => text.trim().toLocaleLowerCase('es');
const tooMany = `Un checklist lleva hasta ${CHECKLIST_LIMITS.items} tareas.`;

/** A new checklist: title and tasks trimmed, empty tasks dropped, in their order. */
export function validateChecklist(params: { title: string; items: readonly string[] }): { ok: true; title: string; items: string[] } | { ok: false; message: string } {
  const title = params.title.trim();
  if (!title) return { ok: false, message: 'Escribe el título del checklist.' };
  if (title.length > CHECKLIST_LIMITS.title) return { ok: false, message: `El título lleva hasta ${CHECKLIST_LIMITS.title} letras.` };
  const items = params.items.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return { ok: false, message: 'Agrega al menos una tarea.' };
  if (items.length > CHECKLIST_LIMITS.items) return { ok: false, message: tooMany };
  if (items.some((item) => item.length > CHECKLIST_LIMITS.item)) return { ok: false, message: `Cada tarea lleva hasta ${CHECKLIST_LIMITS.item} letras.` };
  if (new Set(items.map(key)).size !== items.length) return { ok: false, message: 'Hay tareas repetidas.' };
  return { ok: true, title, items };
}

/** A task added later: not empty, not already there, and room left. */
export function validateChecklistItem(text: string, existing: readonly { text: string }[]): { ok: true; text: string } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'Escribe la tarea.' };
  if (trimmed.length > CHECKLIST_LIMITS.item) return { ok: false, message: `Cada tarea lleva hasta ${CHECKLIST_LIMITS.item} letras.` };
  if (existing.length >= CHECKLIST_LIMITS.items) return { ok: false, message: tooMany };
  if (existing.some((item) => key(item.text) === key(trimmed))) return { ok: false, message: 'Esa tarea ya está.' };
  return { ok: true, text: trimmed };
}

/** Who made it ticks and adds always; the others, only if it allows them. */
export function checklistPermissions(params: { me: string; createdBy: string; othersCanMark: boolean; othersCanAdd: boolean }): { canMark: boolean; canAdd: boolean } {
  const author = params.me === params.createdBy;
  return { canMark: author || params.othersCanMark, canAdd: author || params.othersCanAdd };
}

/** Ticks a pending task (with who and when) or unticks a done one. */
export function toggleChecklistItem(items: readonly ChecklistItem[], itemId: string, userId: string, now: Date): { ok: true; done: boolean; items: ChecklistItem[] } | { ok: false; message: string } {
  const target = items.find((item) => item.id === itemId);
  if (!target) return { ok: false, message: 'Esa tarea ya no está.' };
  const done = !target.doneBy;
  return {
    ok: true,
    done,
    items: items.map((item) => (item.id === itemId ? { ...item, doneBy: done ? userId : null, doneAt: done ? now.toISOString() : null } : item)),
  };
}

export function checklistProgress(items: readonly { doneBy: string | null }[]): { done: number; total: number } {
  return { done: items.filter((item) => item.doneBy).length, total: items.length };
}

/** What the notification and the chat list read, like «Encuesta: …». */
export function checklistTextInChat(title: string): string {
  return `Checklist: ${title.trim()}`;
}
