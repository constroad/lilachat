import type { AgendaContact } from '@lilachat/shared';

/**
 * The phone's whole address book for «Nuevo chat» (pending 20, like WhatsApp
 * Web): asked through the socket each time the dialog opens, never stored.
 * The relay (`useAgendaRelay`) registers how to ask and hands the answer here.
 */
const WAIT_MS = 8_000;

let ask: (() => void) | null = null;
let waiting: ((contacts: AgendaContact[] | null) => void)[] = [];

export function setFullAgendaAsker(next: (() => void) | null): void {
  ask = next;
}

/** The address book, or null when the phone is not connected or does not answer in time. */
export function requestFullAgenda(): Promise<AgendaContact[] | null> {
  if (!ask) return Promise.resolve(null);
  const asker = ask;
  return new Promise((resolve) => {
    const finish = (contacts: AgendaContact[] | null) => {
      window.clearTimeout(timer);
      waiting = waiting.filter((one) => one !== finish);
      resolve(contacts);
    };
    const timer = window.setTimeout(() => finish(null), WAIT_MS);
    waiting.push(finish);
    asker();
  });
}

export function receiveFullAgenda(contacts: AgendaContact[]): void {
  [...waiting].forEach((finish) => finish(contacts));
}
