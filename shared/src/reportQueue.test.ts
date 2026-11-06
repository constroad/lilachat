import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandNotice } from './botCommands';
import { createReportQueue, noticeOf, type ReportWire } from './reportQueue';
import { docOf, fakePortal, fakeVault, general, newTramo, photoOf, ref, saved, saveOf } from './reportQueue.fixture';
import { blankDocumentOf, reportKeyOf } from './reportSaves';

const queueWith = (wire: ReportWire, vault: ReturnType<typeof fakeVault>['vault']) => createReportQueue({ wire, vault });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('draining', () => {
  it('saves go out in order, with one read of the document for plain sections', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const document = docOf('r1', [{ id: 't1', photos: 0 }]);
    await queue.add(saveOf(document, general, 'a', { liquido: 'MC-30' }));
    await queue.add(saveOf(document, { sectionId: 'tramos', itemId: 't1', key: 'bandejas' }, 'b', { peso: '9' }));
    await queue.idle();
    expect(portal.state.writes).toEqual(['general:nuevo:{"liquido":"MC-30"}', 'bandejas:t1:{"peso":"9"}']);
    expect(kept.saves).toEqual([]);
  });

  it('a report born with no signal goes whole when it comes back: the ids are learnt on the way', async () => {
    const portal = fakePortal({ id: null, tramos: [] });
    portal.state.offline = true;
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const blank = docOf(null, []);
    const tramo = saveOf(blank, newTramo, 't');
    await queue.add(saveOf(blank, general, 'g', { liquido: 'MC-30' }));
    await queue.add({ ...tramo, values: { tramo: 'Km 1' } });
    await queue.add(saveOf(blank, { sectionId: 'tramos', itemId: tramo.path.itemId, key: 'bandejas' }, 'b', { peso: '9' }));
    await queue.add(photoOf(blank, tramo.path.itemId!, 'f'));
    await queue.idle();
    expect(portal.state.writes).toEqual([]);
    expect(kept.saves).toHaveLength(4);
    portal.state.offline = false;
    await queue.kick();
    await queue.idle();
    expect(portal.state.writes).toEqual(['general:nuevo:{"liquido":"MC-30"}', 'ubicacion:nuevo:{"tramo":"Km 1"}', 'bandejas:t1:{"peso":"9"}', 'fotos:t1:{"foto":"file-of-ref-f-run-4","descripcion":"Riego"}']);
    expect(kept.saves).toEqual([]);
  });

  it('with no signal it tries again by itself, later each time', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    portal.state.offline = true;
    const { vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(saveOf(docOf('r1', []), general, 'a'));
    await queue.idle();
    portal.state.offline = false;
    await vi.advanceTimersByTimeAsync(60_000);
    await queue.idle();
    expect(portal.state.writes).toHaveLength(1);
  });

  it('survives a restart: what was on disk goes out', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault([saveOf(docOf('r1', []), general, 'a')]);
    const queue = queueWith(portal.wire, vault);
    await queue.hydrate();
    await queue.idle();
    expect(portal.state.writes).toHaveLength(1);
    expect(kept.saves).toEqual([]);
  });

  it('a photo goes up with the run that sends it, and its file is dropped once Portal has it', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(photoOf(docOf('r1', [{ id: 't1', photos: 0 }]), 't1', 'f'));
    await queue.idle();
    expect(portal.state.writes[0]).toContain('file-of-ref-f-run-1');
    expect(kept.dropped).toEqual(['ref-f']);
  });
});

describe('a lost answer', () => {
  it('a tramo that reached Portal is not created twice, and what hangs from it follows it', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    portal.state.loseNextAnswer = true;
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const blank = docOf('r1', []);
    const tramo = saveOf(blank, newTramo, 't');
    await queue.add(tramo);
    await queue.add(saveOf(blank, { sectionId: 'tramos', itemId: tramo.path.itemId, key: 'bandejas' }, 'b', { peso: '9' }));
    await queue.idle();
    portal.state.offline = false;
    await queue.kick();
    await queue.idle();
    expect(portal.state.tramos).toHaveLength(1);
    expect(portal.state.writes.at(-1)).toBe('bandejas:t1:{"peso":"9"}');
    expect(kept.saves).toEqual([]);
  });

  it('a photo that reached Portal is not sent twice', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    portal.state.loseNextAnswer = true;
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(photoOf(docOf('r1', [{ id: 't1', photos: 0 }]), 't1', 'f'));
    await queue.idle();
    portal.state.offline = false;
    await queue.kick();
    await queue.idle();
    expect(portal.state.tramos[0]?.photos).toBe(1);
    expect(kept.saves).toEqual([]);
  });

  it('of two photos in a row, the second is not taken for landed because of the first', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const document = docOf('r1', [{ id: 't1', photos: 0 }]);
    const failOnce = portal.wire.upload;
    let uploads = 0;
    portal.wire.upload = async (...args) => {
      uploads += 1;
      if (uploads === 2) {
        portal.state.offline = true;
        return { ok: false, message: 'Sin conexión.' };
      }
      return failOnce(...args);
    };
    await queue.add(photoOf(document, 't1', 'f1'));
    await queue.add(photoOf(document, 't1', 'f2'));
    await queue.idle();
    portal.state.offline = false;
    await queue.kick();
    await queue.idle();
    expect(portal.state.tramos[0]?.photos).toBe(2);
    expect(kept.saves).toEqual([]);
  });

  it('a late answer settles a write that took long; no answer leaves it for the next pass', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    const late: CommandNotice = { commandId: 'run-1', appId: 'a', appName: 'Portal', response: { responseType: 'ephemeral', text: 'Guardado' } };
    portal.wire.submit = async () => ({ ok: true, outcome: { ...saved, outcome: 'pending' } });
    portal.wire.notice = async () => late;
    const queue = queueWith(portal.wire, vault);
    await queue.add(saveOf(docOf('r1', []), general, 'a'));
    await queue.idle();
    expect(kept.saves).toEqual([]);
    portal.wire.notice = async () => null;
    await queue.add(saveOf(docOf('r1', []), general, 'b'));
    await queue.idle();
    expect(kept.saves).toHaveLength(1);
    expect(kept.saves[0]?.refusal).toBeUndefined();
  });
});

describe('a refusal', () => {
  it('stays on the phone with what Portal said, and the next ones go on', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    portal.state.refuse = { peso: 'Falta el peso' };
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const document = docOf('r1', [{ id: 't1', photos: 0 }]);
    await queue.add(saveOf(document, { sectionId: 'tramos', itemId: 't1', key: 'bandejas' }, 'a'));
    await queue.idle();
    expect(kept.saves[0]?.refusal).toEqual({ message: 'Falta el peso', errors: { peso: 'Falta el peso' } });
    portal.state.refuse = null;
    await queue.add(saveOf(document, general, 'b'));
    await queue.idle();
    expect(portal.state.writes).toHaveLength(1);
    expect(kept.saves.map((one) => one.clientKey)).toEqual(['a']);
  });

  it('fixing it sends it again', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    portal.state.refuse = { peso: 'Falta el peso' };
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const document = docOf('r1', [{ id: 't1', photos: 0 }]);
    const path = { sectionId: 'tramos', itemId: 't1', key: 'bandejas' };
    await queue.add(saveOf(document, path, 'a'));
    await queue.idle();
    portal.state.refuse = null;
    await queue.add(saveOf(document, path, 'b', { peso: '9' }));
    await queue.idle();
    expect(kept.saves).toEqual([]);
    expect(portal.state.writes).toEqual(['bandejas:t1:{"peso":"9"}']);
  });

  it('a discarded save takes its photo with it', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    portal.state.refuse = { foto: 'Ya tiene sus 20 fotos' };
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(photoOf(docOf('r1', [{ id: 't1', photos: 0 }]), 't1', 'f'));
    await queue.idle();
    await queue.discard('f');
    expect(kept.saves).toEqual([]);
    expect(kept.dropped).toEqual(['ref-f']);
  });

  it('a credential revoked empties the queue and its files', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    portal.state.status = 401;
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(photoOf(docOf('r1', [{ id: 't1', photos: 0 }]), 't1', 'f'));
    await queue.idle();
    expect(kept.saves).toEqual([]);
    expect(kept.dropped).toEqual(['ref-f']);
  });
});

describe('an edit while its save is on the way', () => {
  it('the newest values still go, and the tramo is not created twice', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const blank = docOf('r1', []);
    const tramo = saveOf(blank, newTramo, 'a', { tramo: 'Km 1' });
    const submit = portal.wire.submit;
    portal.wire.submit = async (...args) => {
      portal.wire.submit = submit;
      await queue.add(saveOf(blank, tramo.path, 'b', { tramo: 'Km 2' }));
      return submit(...args);
    };
    await queue.add(tramo);
    await queue.idle();
    expect(portal.state.tramos).toHaveLength(1);
    expect(portal.state.writes).toEqual(['ubicacion:nuevo:{"tramo":"Km 1"}', 'ubicacion:t1:{"tramo":"Km 2"}']);
    expect(kept.saves).toEqual([]);
  });
});

describe('the document on the phone', () => {
  it('Portal\'s answer is kept, for the service and for the type', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    const opened = await queueWith(portal.wire, vault).documentOf(ref, null);
    expect(opened).toMatchObject({ ok: true, offline: false, document: { id: 'r1' } });
    expect(kept.documents.size).toBe(2);
  });

  it('with no signal it opens with the last one kept', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    kept.documents.set(reportKeyOf(ref), docOf('r1', [{ id: 't1', photos: 0 }]));
    portal.state.offline = true;
    const opened = await queueWith(portal.wire, vault).documentOf(ref, null);
    expect(opened).toMatchObject({ ok: true, offline: true, document: { id: 'r1' } });
  });

  it('a report already published does not reopen: with no signal a new one starts', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    kept.documents.set(reportKeyOf(ref), { ...docOf('r1', []), status: 'published' });
    portal.state.offline = true;
    const opened = await queueWith(portal.wire, vault).documentOf(ref, null);
    expect(opened).toMatchObject({ ok: true, offline: true, document: { id: null, status: 'draft' } });
  });

  it('a service never opened here starts blank from the forms of the type', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    await queueWith(portal.wire, vault).documentOf({ ...ref, serviceId: 'otro' }, null);
    portal.state.offline = true;
    const opened = await queueWith(portal.wire, vault).documentOf(ref, null);
    expect(opened).toMatchObject({ ok: true, offline: true, document: blankDocumentOf(docOf('r1', [])) });
    expect(kept.documents.size).toBe(2);
  });

  it('with nothing kept it says so, and a refusal is not taken for no signal', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { vault } = fakeVault();
    portal.state.offline = true;
    const queue = queueWith(portal.wire, vault);
    expect(await queue.documentOf(ref, null)).toMatchObject({ ok: false, message: 'Sin señal. Abre este informe una vez con señal para poder llenarlo sin ella.' });
    portal.wire.read = async () => ({ ok: false, status: 404, message: 'Ese servicio ya no está.' });
    expect(await queue.documentOf(ref, null)).toEqual({ ok: false, message: 'Ese servicio ya no está.' });
  });
});

describe('two tabs of the web', () => {
  it('only the one holding the lock sends, and it reads the disk first', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { kept, vault } = fakeVault();
    const queue = createReportQueue({ wire: portal.wire, vault, exclusive: async () => null });
    await queue.add(saveOf(docOf('r1', []), general, 'a'));
    await queue.idle();
    expect(portal.state.writes).toEqual([]);
    const other = createReportQueue({ wire: portal.wire, vault, exclusive: (task) => task() });
    await other.kick();
    await other.idle();
    expect(portal.state.writes).toHaveLength(1);
    expect(kept.saves).toEqual([]);
  });
});

describe('who is told', () => {
  it('a listener hears each change, and the revision moves when something reached Portal', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const { vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    const heard = vi.fn();
    const stop = queue.subscribe(heard);
    const before = queue.snapshot().revision;
    await queue.add(saveOf(docOf('r1', []), general, 'a'));
    await queue.idle();
    stop();
    expect(heard).toHaveBeenCalled();
    expect(queue.snapshot().revision).toBeGreaterThan(before);
    expect(queue.snapshot().saves).toEqual([]);
    expect(queue.snapshot().sending).toBe(false);
  });

  it('says when it stopped for lack of signal, and when it got through again', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    portal.state.offline = true;
    const { vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(saveOf(docOf('r1', []), general, 'a'));
    await queue.idle();
    expect(queue.snapshot().stalled).toBe(true);
    portal.state.offline = false;
    await queue.kick();
    await queue.idle();
    expect(queue.snapshot().stalled).toBe(false);
  });

  it('forgets everything on logout', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    portal.state.offline = true;
    const { kept, vault } = fakeVault();
    const queue = queueWith(portal.wire, vault);
    await queue.add(photoOf(docOf('r1', [{ id: 't1', photos: 0 }]), 't1', 'f'));
    await queue.idle();
    await queue.forget();
    expect(kept.saves).toEqual([]);
    expect(kept.dropped).toEqual(['ref-f']);
    expect(queue.snapshot().saves).toEqual([]);
  });
});

describe('noticeOf', () => {
  const source = () => {
    const listeners = new Set<(notice: CommandNotice) => void>();
    return { listeners, on: (_event: 'command.response', listener: (notice: CommandNotice) => void) => listeners.add(listener), off: (_event: 'command.response', listener: (notice: CommandNotice) => void) => listeners.delete(listener) };
  };
  const notice = (commandId: string): CommandNotice => ({ commandId, appId: 'a', appName: 'Portal', response: { responseType: 'ephemeral', text: 'Guardado' } });

  it('takes the answer of its own write and stops listening', async () => {
    const socket = source();
    const answer = noticeOf(socket, 'run-1');
    socket.listeners.forEach((listener) => listener(notice('run-2')));
    expect(socket.listeners.size).toBe(1);
    socket.listeners.forEach((listener) => listener(notice('run-1')));
    expect((await answer)?.commandId).toBe('run-1');
    expect(socket.listeners.size).toBe(0);
  });

  it('past the wait, or with no socket, there is no answer', async () => {
    const socket = source();
    const answer = noticeOf(socket, 'run-1', 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await answer).toBeNull();
    expect(socket.listeners.size).toBe(0);
    expect(await noticeOf(null, 'run-1')).toBeNull();
  });
});
