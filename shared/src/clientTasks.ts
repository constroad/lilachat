import { validateBotChecklist } from './bots.js';
import { CHECKLIST_LIMITS } from './checklists.js';
import { DEFAULT_WORK_STAGES } from './workStages.js';

/**
 * Tasks an app adds to a client's checklist (José 06/11: the field checklist of an order goes to the
 * «Checklist» tab, not to a message). `key` names what they came from, so a repeated event adds nothing.
 * PURE: the server applies it; the app and the web only draw the tasks.
 */
export type ClientTask = { text: string; key?: string; assigneePhone?: string; dueAt?: string };
export type ClientTasks = { key: string; label: string; items: ClientTask[] };

/** «Ejecución», by its place in the plan: an admin may rename the stage. */
export const ORDER_TASKS_STAGE = DEFAULT_WORK_STAGES.indexOf('Ejecución') + 1;
const LIMITS = { key: 120, label: 40 };

/** One line per task: a client has several orders, and without the code they read the same. */
export const orderTaskText = (label: string, text: string): string => `${label} · ${text}`;

const shortText = (raw: unknown, max: number): string | null => {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text && text.length <= max ? text : null;
};

export function validateClientTasks(raw: unknown): { ok: true; tasks: ClientTasks } | { ok: false; message: string } {
  const body: { key?: unknown; label?: unknown; items?: unknown } = raw && typeof raw === 'object' ? raw : {};
  const key = shortText(body.key, LIMITS.key);
  const label = shortText(body.label, LIMITS.label);
  if (!key) return { ok: false, message: `key va como un texto de hasta ${LIMITS.key} letras.` };
  if (!label) return { ok: false, message: `label va como un texto de hasta ${LIMITS.label} letras.` };
  const valid = validateBotChecklist({ title: label, items: body.items });
  if (!valid.ok) return { ok: false, message: valid.message };
  const items = valid.checklist.items.map((item) => ({ ...item, text: orderTaskText(label, item.text) }));
  if (items.some((item) => item.text.length > CHECKLIST_LIMITS.item)) return { ok: false, message: `Cada tarea lleva hasta ${CHECKLIST_LIMITS.item} letras, con su código.` };
  return { ok: true, tasks: { key, label, items } };
}

/** A task as the app reads it back (`GET /api/bots/clients/:clientId/tasks`). */
export type ClientTaskState = { id: string; key: string | null; text: string; done: boolean; done_at: string | null; assignee_phone: string | null; due_at: string | null };
