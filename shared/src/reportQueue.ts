import type { FormSubmitReply } from './appActions.js';
import type { FormValues } from './appForms.js';
import { WRITE_GIVE_UP_MS, type CommandNotice, type CommandOutcome } from './botCommands.js';
import type { FieldDocument } from './fieldDocument.js';
import { retryDelayMs } from './outbox.js';
import { DRAFT_FAILED, readReportDraft, sectionFormRequest, type ReportDraftBody, type SectionFormRequest } from './reportCreation.js';
import { blankDocumentOf, isUnreachable, judgeFailure, judgeNotice, judgeReply, landedBefore, newItemOf, nextSave, queueSave, reportKeyOf, reportTypeKeyOf, resolveItem, sentMarkOf, withoutSave, type QueuedPhoto, type ReportRef, type ReportSave, type SaveRefusal, type SaveVerdict, type SentMark } from './reportSaves.js';

/**
 * The queue of a field report's saves (spec INFORMES-DESDE-LILACHAT §4.4): the
 * only way a section or a photo reaches Portal, with or without signal. Each
 * save opens its own run and sends through the form routes when it can, in
 * order, so a report born with no signal goes whole when the signal is back.
 * The phone and the web lend their disk and their calls; the rules are here.
 */
export type WireResult<T> = { ok: true; data: T } | { ok: false; message?: string; status?: number };
/** `status` is missing with no network: a refusal is told from no signal. */
export type FormPhotoUpload = { ok: true; fileId: string } | { ok: false; message: string; status?: number };
export type ReportVault = {
  load(): Promise<ReportSave[]>;
  store(saves: ReportSave[]): Promise<void>;
  loadDocument(key: string): Promise<FieldDocument | null>;
  storeDocument(key: string, document: FieldDocument): Promise<void>;
  dropPhoto(ref: string): Promise<void>;
};
export type ReportWire = {
  read(ref: ReportRef, reportId: string | null): Promise<WireResult<ReportDraftBody>>;
  open(ref: ReportRef, request: SectionFormRequest): Promise<WireResult<CommandOutcome>>;
  upload(ref: ReportRef, commandId: string, photo: QueuedPhoto): Promise<FormPhotoUpload>;
  submit(ref: ReportRef, commandId: string, values: FormValues): Promise<FormSubmitReply>;
  /** The late answer of a write, or null past the wait. */
  notice(commandId: string): Promise<CommandNotice | null>;
};
export type QueueState = { saves: ReportSave[]; /** Moves when something reached Portal: the screen asks the document again. */ revision: number; sending: boolean; /** The last pass stopped for lack of signal. */ stalled: boolean };
export type OpenedReport = { ok: true; document: FieldDocument; offline: boolean } | { ok: false; message: string };
export type ReportQueue = ReturnType<typeof createReportQueue>;

const NEVER_OPENED = 'Sin señal. Abre este informe una vez con señal para poder llenarlo sin ella.';

type NoticeSource = { on(event: 'command.response', listener: (notice: CommandNotice) => void): unknown; off(event: 'command.response', listener: (notice: CommandNotice) => void): unknown };

/** Waits on the socket for the answer of one write. */
export function noticeOf(source: NoticeSource | null, commandId: string, waitMs: number = WRITE_GIVE_UP_MS): Promise<CommandNotice | null> {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = (notice: CommandNotice | null) => {
      clearTimeout(timer);
      source.off('command.response', onNotice);
      resolve(notice);
    };
    const onNotice = (notice: CommandNotice) => {
      if (notice.commandId === commandId) finish(notice);
    };
    const timer = setTimeout(() => finish(null), waitMs);
    source.on('command.response', onNotice);
  });
}

/** A plain section needs nothing of the answer; what makes a report, a tramo or a photo changes what the next save reads. */
const needsFreshDocument = (save: ReportSave, document: FieldDocument): boolean => Boolean(save.createsItem || save.photo || document.id === null);

/** Two tabs of the web share the disk: only the one holding the lock sends. Without one, this is the only sender. */
type Exclusive = (task: () => Promise<void>) => Promise<unknown>;

export function createReportQueue({ vault, wire, exclusive = (task) => task() }: { vault: ReportVault; wire: ReportWire; exclusive?: Exclusive }) {
  let state: QueueState = { saves: [], revision: 0, sending: false, stalled: false };
  const listeners = new Set<() => void>();
  let tail: Promise<unknown> = Promise.resolve();
  let pass: Promise<void> | null = null;
  let rerun = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tell = (next: Partial<QueueState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  /** Every change goes through the disk, one at a time: another tab of the web may have written there. */
  const change = (edit: (saves: ReportSave[]) => ReportSave[], reached = false): Promise<void> => {
    const done = tail.then(async () => {
      const next = edit(await vault.load());
      await vault.store(next);
      tell({ saves: next, ...(reached ? { revision: state.revision + 1, stalled: false } : {}) });
    });
    tail = done.catch(() => undefined);
    return done;
  };

  const dropPhotos = async (saves: readonly ReportSave[]) => {
    await Promise.all(saves.flatMap((one) => (one.photo ? [vault.dropPhoto(one.photo.ref)] : [])));
  };

  const editSave = (clientKey: string, edit: (save: ReportSave) => ReportSave) => change((saves) => saves.map((one) => (one.clientKey === clientKey ? edit(one) : one)));

  async function tryLater(save: ReportSave): Promise<void> {
    const attempts = save.attempts + 1;
    await editSave(save.clientKey, (one) => ({ ...one, attempts }));
    tell({ stalled: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), retryDelayMs(attempts));
  }

  async function forget(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    const gone = state.saves;
    await change(() => []);
    await dropPhotos(gone);
  }

  /** What Portal has now; the server keeps it too, for the forms that follow. */
  async function readDocument(ref: ReportRef, reportId: string | null): Promise<{ document: FieldDocument } | { verdict: SaveVerdict }> {
    const response = await wire.read(ref, reportId);
    if (!response.ok) return { verdict: judgeFailure(response) };
    const read = readReportDraft(response.data);
    if (!read.ok) return { verdict: { kind: 'retry' } };
    await keepDocument(ref, read.document);
    return { document: read.document };
  }

  async function keepDocument(ref: ReportRef, document: FieldDocument): Promise<void> {
    await Promise.all([vault.storeDocument(reportKeyOf(ref), document), vault.storeDocument(reportTypeKeyOf(ref), document)]);
  }

  /** One attempt: its own run, the photo up, the form sent. */
  async function send(save: ReportSave, document: FieldDocument, sent: SentMark): Promise<SaveVerdict> {
    await editSave(save.clientKey, (one) => ({ ...one, sent }));
    const path = save.createsItem ? { ...save.path, itemId: null } : save.path;
    const opened = await wire.open(save.ref, sectionFormRequest(document, path, save.place));
    if (!opened.ok) return judgeFailure(opened);
    const { commandId } = opened.data;
    const uploaded = save.photo ? await wire.upload(save.ref, commandId, save.photo) : null;
    if (uploaded && !uploaded.ok) return judgeFailure(uploaded);
    const values = save.photo && uploaded?.ok ? { ...save.values, [save.photo.field]: uploaded.fileId } : save.values;
    const verdict = judgeReply(await wire.submit(save.ref, commandId, values));
    return verdict.kind === 'wait' ? judgeNotice(await wire.notice(commandId)) : verdict;
  }

  /** Portal has it: out of the queue, with the id of the tramo it made. `false` when the report could not be read to learn it. */
  async function settle(save: ReportSave, document: FieldDocument, sent: SentMark): Promise<FieldDocument | null> {
    const fresh = needsFreshDocument(save, document) ? await readDocument(save.ref, document.id ?? save.reportId) : { document };
    if (!('document' in fresh)) return null;
    const itemId = save.createsItem ? newItemOf(save, fresh.document, sent) : null;
    await change((saves) => {
      const rest = saves.filter((one) => one.clientKey !== save.clientKey);
      return itemId && save.path.itemId ? resolveItem(rest, save.path.itemId, itemId) : rest;
    }, true);
    await dropPhotos([save]);
    return fresh.document;
  }

  const refuse = (save: ReportSave, refusal: SaveRefusal) => editSave(save.clientKey, (one) => ({ ...one, refusal }));

  /** What follows a verdict that is not a confirmation. `true`: go on with the next save. */
  async function afterFailure(save: ReportSave, verdict: SaveVerdict): Promise<boolean> {
    if (verdict.kind === 'refuse') {
      await refuse(save, verdict.refusal);
      return true;
    }
    if (verdict.kind === 'flush') await forget();
    else await tryLater(save);
    return false;
  }

  /** The saves of one report in order. `false` stops the pass: no signal, or the queue was emptied. */
  async function drainReport(key: string): Promise<boolean> {
    let document: FieldDocument | null = null;
    for (;;) {
      const mine = state.saves.filter((one) => reportKeyOf(one.ref) === key);
      const head = nextSave(mine, document);
      if (!head) return true;
      if (!document) {
        const read = await readDocument(head.ref, mine.find((one) => one.reportId)?.reportId ?? null);
        if ('verdict' in read) {
          if (await afterFailure(head, read.verdict)) continue;
          return false;
        }
        document = read.document;
        continue;
      }
      const sent = sentMarkOf(head, document);
      const verdict = landedBefore({ ...head, sent }, document) ? ({ kind: 'confirm' } as const) : await send(head, document, sent);
      if (verdict.kind !== 'confirm') {
        if (await afterFailure(head, verdict)) continue;
        return false;
      }
      const settled: FieldDocument | null = await settle(head, document, sent);
      if (!settled) {
        await tryLater(head);
        return false;
      }
      document = settled;
    }
  }

  async function drainKeys(): Promise<void> {
    do {
      rerun = false;
      await change((saves) => saves);
      const keys = [...new Set(state.saves.filter((one) => !one.refusal).map((one) => reportKeyOf(one.ref)))];
      for (const key of keys) if (!(await drainReport(key))) break;
    } while (rerun);
  }

  async function drainAll(): Promise<void> {
    tell({ sending: true });
    try {
      await exclusive(drainKeys);
    } finally {
      pass = null;
      tell({ sending: false });
    }
  }

  function run(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pass) {
      rerun = true;
      return pass;
    }
    pass = drainAll();
    return pass;
  }

  return {
    snapshot: (): QueueState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** What was on the disk, on its way: at start, after a restart. */
    async hydrate(): Promise<void> {
      await change((saves) => saves);
      void run();
    },
    async add(save: ReportSave): Promise<void> {
      await change((saves) => queueSave(saves, save));
      void run();
    },
    /** A refused save the person gives up on, with what hangs from it. */
    async discard(clientKey: string): Promise<void> {
      const before = await vault.load();
      const kept = withoutSave(before, clientKey);
      await change(() => kept);
      await dropPhotos(before.filter((one) => !kept.includes(one)));
    },
    kick: run,
    /** Resolves when no pass is running. */
    async idle(): Promise<void> {
      await tail;
      while (pass) await pass;
    },
    forget,
    /** The document on screen: Portal's, or with no signal the last one kept; a new report starts from the forms of its type. */
    async documentOf(ref: ReportRef, reportId: string | null): Promise<OpenedReport> {
      const response = await wire.read(ref, reportId);
      if (response.ok) {
        const read = readReportDraft(response.data);
        if (!read.ok) return read;
        await keepDocument(ref, read.document);
        return { ok: true, document: read.document, offline: false };
      }
      if (!isUnreachable(response)) return { ok: false, message: response.message ?? DRAFT_FAILED };
      const kept = await vault.loadDocument(reportKeyOf(ref));
      if (kept?.status === 'draft') return { ok: true, document: kept, offline: true };
      const known = kept ?? (await vault.loadDocument(reportTypeKeyOf(ref)));
      return known ? { ok: true, document: blankDocumentOf(known), offline: true } : { ok: false, message: NEVER_OPENED };
    },
  };
}
