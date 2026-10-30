import { compareNames } from './compareText.js';
/**
 * Checklists in the chat, like Telegram's (José, 21/10; backlog 8): a card
 * with a title and tasks that people tick; each done task says who ticked it
 * and when; tasks can be added later; it updates live (`ref.changed`). Whoever
 * made it decides whether the others can tick and add. PURE: the server
 * applies the same rules the app and the web show.
 */
export const CHECKLIST_LIMITS = { title: 120, item: 200, items: 30 } as const;

/** `assignee` and `dueAt` (backlog 30): who does it and for when; both optional. */
/** A file that proves a task (pending 21, design e2-18): a message of the channel, linked to the task by its seq. */
export type TaskEvidence = { seq: number; kind: 'image' | 'video' | 'file'; url: string; thumbnailUrl?: string; name: string; sizeBytes: number; by: string; at: string };
export type ChecklistItem = { id: string; text: string; doneBy: string | null; doneAt: string | null; assignee?: string | null; dueAt?: string | null; addedBy?: string; evidence?: TaskEvidence[] };
export type AgendaChecklist = {
  _id: string;
  chatId: string;
  createdBy: string;
  title: string;
  items: ChecklistItem[];
  othersCanMark: boolean;
  othersCanAdd: boolean;
  createdAt: string;
  /** The seq of its card in the chat: the chat info and «Mis tareas» jump to it. */
  cardSeq?: number;
};

const key = (text: string) => text.trim().toLocaleLowerCase('es');
const tooMany = `Un checklist lleva hasta ${CHECKLIST_LIMITS.items} tareas.`;

/** A new checklist: title and tasks trimmed, empty tasks dropped, in their order. */
export function validateChecklist(params: { title: string; items: readonly string[] }): { ok: true; title: string; items: string[] } | { ok: false; message: string } {
  const validTitle = validateChecklistTitle(params.title);
  if (!validTitle.ok) return validTitle;
  const { title } = validTitle;
  const items = params.items.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return { ok: false, message: 'Agrega al menos una tarea.' };
  if (items.length > CHECKLIST_LIMITS.items) return { ok: false, message: tooMany };
  if (items.some((item) => item.length > CHECKLIST_LIMITS.item)) return { ok: false, message: `Cada tarea lleva hasta ${CHECKLIST_LIMITS.item} letras.` };
  if (new Set(items.map(key)).size !== items.length) return { ok: false, message: 'Hay tareas repetidas.' };
  return { ok: true, title, items };
}

/** A title, new or edited: trimmed, not empty, not too long. */
export function validateChecklistTitle(text: string): { ok: true; title: string } | { ok: false; message: string } {
  const title = text.trim();
  if (!title) return { ok: false, message: 'Escribe el título del checklist.' };
  if (title.length > CHECKLIST_LIMITS.title) return { ok: false, message: `El título lleva hasta ${CHECKLIST_LIMITS.title} letras.` };
  return { ok: true, title };
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

/**
 * Who ticks a task (José, 21/10): an assigned task, only its person or whoever
 * created the checklist — the person assigned even when the checklist says
 * «solo yo marco»; a task without anyone, as the checklist allows.
 */
export function canToggleTask(params: { me: string; createdBy: string; othersCanMark: boolean; assignee?: string | null }): boolean {
  if (params.me === params.createdBy) return true;
  if (params.assignee) return params.me === params.assignee;
  return params.othersCanMark;
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

// ─── Assignees and due dates (backlog 30, José 21/10: who does each task and an ETA, to see whether it is on time) ───

export type TaskDueState = 'done' | 'overdue' | 'today' | 'upcoming' | 'none';
const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
const CLOCK = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
const WEEKDAY = new Intl.DateTimeFormat('es-PE', { weekday: 'short' });
const DAY_AND_MONTH = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
/** «vie.» → «vie», «oct.» → «oct»: the design (`k-04-mis-tareas`) writes them without the period. */
const withoutPeriods = (text: string) => text.replace(/\./g, '');

/** Where a task stands against its date, in the phone's local time. */
export function taskDueState(item: { dueAt?: string | null; doneBy: string | null }, now: Date): TaskDueState {
  if (item.doneBy) return 'done';
  if (!item.dueAt) return 'none';
  const due = new Date(item.dueAt);
  if (due.getTime() < now.getTime()) return 'overdue';
  return daysBetween(now, due) === 0 ? 'today' : 'upcoming';
}

/** «Hoy 3:00 p. m.», «Mañana 9:00 a. m.», «vie 7:00 a. m.», or how late: «Atrasada · ayer», «Atrasada · 18 oct». */
export function taskDueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const days = daysBetween(now, due);
  if (due.getTime() < now.getTime()) {
    const late = -days;
    return `Atrasada · ${late <= 0 ? 'hoy' : late === 1 ? 'ayer' : withoutPeriods(DAY_AND_MONTH.format(due))}`;
  }
  const time = CLOCK.format(due);
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Mañana ${time}`;
  return `${withoutPeriods(WEEKDAY.format(due))} ${time}`;
}

/** «1 tarea», «3 tareas»: the count beside each group of «Mis tareas». */
export const taskCountLabel = (count: number): string => `${count} ${count === 1 ? 'tarea' : 'tareas'}`;

/** The chat info card's pill (`k-05-checklists-del-chat`): how many are still open, or «Completos». */
export function checklistsBadge(checklists: readonly { done: number; total: number }[]): string {
  const open = checklists.filter((checklist) => checklist.total === 0 || checklist.done < checklist.total).length;
  if (open === 0) return 'Completos';
  return `${open} ${open === 1 ? 'activo' : 'activos'}`;
}

export type TaskDueOption = { id: 'today' | 'tomorrow' | 'in2' | 'in3'; label: string; date: Date };
/** End of the working day, and when a day starts. */
const END_OF_DAY = 18;
const MORNING = 9;
/** «Hoy» needs at least this much day left. */
const LATEST_FOR_TODAY = 17;

/** Quick dates for a task: today at 6 p. m. (if there is time left), tomorrow and the next two days at 9 a. m. */
export function taskDueOptions(now: Date): TaskDueOption[] {
  const at = (days: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0);
  const capitalized = (date: Date) => {
    const day = WEEKDAY.format(date).replace('.', '');
    return day.charAt(0).toUpperCase() + day.slice(1);
  };
  const options: TaskDueOption[] = [];
  if (now.getHours() < LATEST_FOR_TODAY) options.push({ id: 'today', label: 'Hoy', date: at(0, END_OF_DAY) });
  options.push({ id: 'tomorrow', label: 'Mañana', date: at(1, MORNING) });
  options.push({ id: 'in2', label: capitalized(at(2, MORNING)), date: at(2, MORNING) });
  options.push({ id: 'in3', label: capitalized(at(3, MORNING)), date: at(3, MORNING) });
  return options;
}

export function checklistOverdue(items: readonly { dueAt?: string | null; doneBy: string | null }[], now: Date): number {
  return items.filter((item) => taskDueState(item, now) === 'overdue').length;
}

export type MyTask = { item: ChecklistItem; checklistId: string; checklistTitle: string; chatId: string };
export type MyTaskGroup = { state: Exclude<TaskDueState, 'done'>; tasks: MyTask[] };
const GROUP_ORDER: MyTaskGroup['state'][] = ['overdue', 'today', 'upcoming', 'none'];

/** «Mis tareas» (backlog 30): what is assigned to me and still pending, overdue first, the soonest first in each group. */
export function myTasks(checklists: readonly { _id: string; title: string; chatId: string; items: readonly ChecklistItem[] }[], me: string, now: Date): MyTaskGroup[] {
  const mine = checklists.flatMap((checklist) => checklist.items.filter((item) => item.assignee === me && !item.doneBy).map((item) => ({ item, checklistId: checklist._id, checklistTitle: checklist.title, chatId: checklist.chatId })));
  const due = (task: MyTask) => (task.item.dueAt ? new Date(task.item.dueAt).getTime() : Number.POSITIVE_INFINITY);
  return GROUP_ORDER.map((state) => ({ state, tasks: mine.filter((task) => taskDueState(task.item, now) === state).sort((a, b) => due(a) - due(b)) })).filter((group) => group.tasks.length > 0);
}


/** Which «para cuándo» chip the task sheet lights: a quick one whose date it is, «Elegir fecha» for any other date, «Sin fecha» for none. */
export function activeDueChoice(dueAt: string | null | undefined, options: readonly TaskDueOption[]): TaskDueOption['id'] | 'custom' | 'none' {
  if (!dueAt) return 'none';
  const due = new Date(dueAt).getTime();
  return options.find((option) => option.date.getTime() === due)?.id ?? 'custom';
}

/** The name under an avatar in a row of people: «Ana T.»; a lone name or a phone stays whole. */
export function shortPersonName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || /\d/.test(name)) return words.join(' ');
  return `${words[0]} ${words[1]!.charAt(0).toUpperCase()}.`;
}

/** Who can be put in charge of a task: the chat's members, me first as «Tú», the rest by name. */
export function checklistMembers(names: ReadonlyMap<string, string> | undefined, me: string): { id: string; name: string }[] {
  if (!names) return [];
  const others = [...names].filter(([id]) => id !== me).map(([id, name]) => ({ id, name })).sort((a, b) => compareNames(a.name, b.name));
  return names.has(me) ? [{ id: me, name: 'Tú' }, ...others] : others;
}

/** The channel's people without its installed apps: a bot is not restricted nor assigned a task. */
export function withoutApps(names: ReadonlyMap<string, string>, apps: ReadonlySet<string>): ReadonlyMap<string, string> {
  if (!apps.size) return names;
  return new Map([...names].filter(([id]) => !apps.has(id)));
}

/** A checklist as the chat info lists it (GET `/checklists?chatId`). */
export type ChecklistSummary = { _id: string; title: string; done: number; total: number; overdue: number; cardSeq?: number };

/** Its line in the chat info: «3 de 6 listas», what is late apart (it goes in the error tone), and whether it is complete. */
export function checklistSummaryLine(summary: Pick<ChecklistSummary, 'done' | 'total' | 'overdue'>): { progress: string; late: string | null; complete: boolean } {
  return {
    progress: `${summary.done} de ${summary.total} listas`,
    late: summary.overdue > 0 ? `${summary.overdue} ${summary.overdue === 1 ? 'atrasada' : 'atrasadas'}` : null,
    complete: summary.total > 0 && summary.done === summary.total,
  };
}

// ─── Notices when tasks get done (backlog 35, José 21/10) ───

export type TaskDoneNotice = { to: string; body: string };

/**
 * Who hears that tasks were ticked, and what they read. Not the whole chat (a
 * site group would drown in it): the author hears about every tick, each
 * assignee about their own, and who ticked hears nothing. Ticks in a row
 * arrive together (the server waits a minute); when the checklist ends up
 * complete, the author and every assignee hear that instead.
 */
export function taskDoneNotices(params: {
  checklist: { title: string; createdBy: string; total: number; done: number; assignees?: readonly string[] };
  who: string;
  whoName: string;
  ticked: readonly { text: string; assignee: string | null | undefined }[];
}): TaskDoneNotice[] {
  const { checklist, who, whoName, ticked } = params;
  if (ticked.length === 0) return [];
  const title = `«${checklist.title}»`;
  if (checklist.total > 0 && checklist.done === checklist.total) {
    const body = `${whoName} completó ${title} (${checklist.done} de ${checklist.total} listas)`;
    return [...new Set([checklist.createdBy, ...(checklist.assignees ?? [])])].filter((to) => to !== who).map((to) => ({ to, body }));
  }
  const said = (tasks: readonly { text: string }[]) => (tasks.length === 1 ? `${whoName} marcó «${tasks[0]!.text}» de ${title}` : `${whoName} marcó ${tasks.length} tareas de ${title}`);
  const notices: TaskDoneNotice[] = checklist.createdBy !== who ? [{ to: checklist.createdBy, body: said(ticked) }] : [];
  const assignees = [...new Set(ticked.map((task) => task.assignee).filter((to): to is string => Boolean(to) && to !== who && to !== checklist.createdBy))];
  for (const to of assignees) notices.push({ to, body: said(ticked.filter((task) => task.assignee === to)) });
  return notices;
}

