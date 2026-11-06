import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportQueue, PHOTO_REMOVAL_FAILED } from './reportQueue';
import { docOf, fakePortal, fakeVault, general, newTramo, NOW, ref, type Tramo } from './reportQueue.fixture';
import type { DevicePlace } from './reportCreation';
import { createReportScreen, NO_GPS_PHOTO, PHOTO_PLACE_WAIT_MS, REFRESH_RETRIES, REFRESH_RETRY_MS, type ReportScreenState } from './reportScreen';
import type { FieldDocument, FormSection, RepeatSection, SectionPath } from './fieldDocument';

type Source = { uri: string };

function screenWith(start: { id: string | null; tramos: Tramo[]; requireLocation?: boolean }, placeNow: () => Promise<DevicePlace> = async () => ({ lat: -12, lng: -77, at: NOW }), startId?: string) {
  const portal = fakePortal(start);
  const askedIds: (string | null)[] = [];
  const read = portal.wire.read;
  portal.wire.read = (reportRef, reportId) => {
    askedIds.push(reportId);
    return read(reportRef, reportId);
  };
  const disk = fakeVault();
  const queue = createReportQueue({ wire: portal.wire, vault: disk.vault, gapMs: 0 });
  let keys = 0;
  const dropped: string[] = [];
  const screen = createReportScreen<Source>({
    queue,
    keepPhoto: async (source) => ({ ref: `kept-${source.uri}`, mime: 'image/jpeg', preview: `file://${source.uri}` }),
    dropPhoto: async (photo) => { dropped.push(photo); },
    placeNow,
    personName: () => 'Ana Torres',
    newKey: () => `k${(keys += 1)}`,
    now: () => NOW,
  }, ref, startId);
  const stop = screen.subscribe(() => undefined);
  return { portal, disk, queue, screen, stop, dropped, askedIds };
}

const settled = async ({ queue }: { queue: ReturnType<typeof createReportQueue> }) => {
  await queue.idle();
  await vi.advanceTimersByTimeAsync(0);
};
const documentOf = (state: ReportScreenState): FieldDocument => {
  if (!state.draft?.ok) throw new Error('no document');
  return state.draft.document;
};
const tramosOf = (state: ReportScreenState): RepeatSection => documentOf(state).sections[1] as RepeatSection;
const bandejas = (itemId: string): SectionPath => ({ sectionId: 'tramos', itemId, key: 'bandejas' });
const generalOf = (state: ReportScreenState) => documentOf(state).sections[0] as FormSection;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('who makes the report', () => {
  it('is the responsible the form starts with', async () => {
    const test = screenWith({ id: null, tramos: [] });
    await settled(test);
    test.screen.openSection(general);
    const form = test.screen.snapshot().form;
    expect(form?.response.responseType === 'form' ? form.response.form.schema.properties?.responsable : null).toMatchObject({ default: 'Ana Torres' });
    test.stop();
  });
});

describe('opening', () => {
  it('nothing on screen until Portal answers, then its document', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    expect(test.screen.snapshot().draft).toBeNull();
    await settled(test);
    expect(documentOf(test.screen.snapshot()).id).toBe('r1');
    expect(test.screen.snapshot()).toMatchObject({ offline: false, changed: false, form: null });
  });

  it('with no signal and nothing kept it says why', async () => {
    const portal = fakePortal({ id: 'r1', tramos: [] });
    portal.state.offline = true;
    const queue = createReportQueue({ wire: portal.wire, vault: fakeVault().vault, gapMs: 0 });
    const screen = createReportScreen<Source>({ queue, keepPhoto: async () => ({ ref: '', mime: '', preview: '' }), dropPhoto: async () => undefined, personName: () => null, placeNow: async () => ({ at: NOW }), newKey: () => 'k', now: () => NOW }, ref);
    screen.subscribe(() => undefined);
    await queue.idle();
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.snapshot().draft).toMatchObject({ ok: false });
  });

  it('stops listening when the screen goes, and the id learnt rides with the next ask', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    const read = vi.spyOn(test.portal.wire, 'read');
    test.screen.refresh();
    await settled(test);
    expect(read).toHaveBeenCalledWith(ref, 'r1');
    test.stop();
    test.screen.openSection(general);
    expect(test.screen.snapshot().form).not.toBeNull();
  });
});

describe('saving a section', () => {
  it('shows at once, closes the form, and what Portal has replaces it when it comes back', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.screen.openSection(general);
    expect(test.screen.snapshot().form?.action).toBe('Datos generales');
    const read = test.portal.wire.read;
    let reads = 0;
    let release: () => void = () => undefined;
    test.portal.wire.read = async (...args) => {
      reads += 1;
      if (reads === 2) await new Promise<void>((resolve) => { release = resolve; });
      return read(...args);
    };
    const outcome = await test.screen.submit({ liquido: 'MC-30' });
    expect(outcome).toEqual({ done: true, answer: null });
    expect(test.screen.snapshot().form).toBeNull();
    expect(generalOf(test.screen.snapshot()).values).toEqual({ liquido: 'MC-30' });
    await settled(test);
    expect(test.portal.state.writes).toEqual(['general:nuevo:{"liquido":"MC-30"}']);
    expect(test.screen.snapshot()).toMatchObject({ saves: [], changed: true });
    // Out of the queue, and still on screen: never back to the old state while Portal's new document is on its way.
    expect(generalOf(test.screen.snapshot()).values).toEqual({ liquido: 'MC-30' });
    release();
    await settled(test);
    expect(generalOf(test.screen.snapshot()).pending).toBeUndefined();
  });

  it('with the form open and no document it does nothing', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    expect(await test.screen.submit({ liquido: 'MC-30' })).toMatchObject({ done: false });
  });

  it('a disk that fails says so and keeps the form open', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.screen.openSection(general);
    test.disk.vault.store = async () => { throw new Error('full'); };
    expect(await test.screen.submit({ liquido: 'MC-30' })).toEqual({ done: false, errors: {}, message: 'No se pudo guardar en este dispositivo.' });
    expect(test.screen.snapshot().form).not.toBeNull();
  });
});

describe('with no signal', () => {
  it('a report opened before keeps working: tramo and section wait, and go when it comes back', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.portal.state.offline = true;
    test.screen.refresh();
    await settled(test);
    expect(test.screen.snapshot().offline).toBe(true);

    test.screen.openSection(newTramo);
    await test.screen.submit({ tramo: 'Km 1' });
    await settled(test);
    const local = tramosOf(test.screen.snapshot()).items[0]!;
    expect(local.title).toBe('Tramo 1');
    test.screen.openSection(bandejas(local.id));
    await test.screen.submit({ peso: '9' });
    await settled(test);
    expect(test.screen.snapshot().saves).toHaveLength(2);
    expect(test.portal.state.writes).toEqual([]);

    test.portal.state.offline = false;
    await test.queue.kick();
    await settled(test);
    test.screen.refresh();
    await settled(test);
    expect(test.portal.state.writes).toEqual(['ubicacion:nuevo:{"tramo":"Km 1"}', 'bandejas:t1:{"peso":"9"}']);
    expect(test.screen.snapshot()).toMatchObject({ offline: false, saves: [] });
    expect(tramosOf(test.screen.snapshot()).items.map((one) => one.id)).toEqual(['t1']);
  });

  it('losing the signal with the document on screen also counts as no signal', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.portal.state.offline = true;
    test.screen.openSection(general);
    await test.screen.submit({ liquido: 'MC-30' });
    await settled(test);
    expect(test.screen.snapshot().offline).toBe(true);
  });
});

describe('photos', () => {
  const photosPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };

  it('the photo stays on the device with where and when it was taken, and goes with its caption', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    test.portal.state.offline = true;
    test.screen.openSection(photosPath);
    expect(await test.screen.upload({ uri: 'a.jpg' })).toEqual({ ok: true, fileId: 'kept-a.jpg' });
    await test.screen.submit({ foto: 'kept-a.jpg', descripcion: 'Riego' });
    await settled(test);
    expect(test.screen.snapshot().saves[0]).toMatchObject({ title: 'Tramo 1 · Fotos', place: { lat: -12, lng: -77, at: NOW }, photo: { field: 'foto', ref: 'kept-a.jpg', preview: 'file://a.jpg' } });
    test.portal.state.offline = false;
    await test.queue.kick();
    await settled(test);
    expect(test.portal.state.writes[0]).toContain('"descripcion":"Riego"');
    expect(test.portal.state.tramos[0]?.photos).toBe(1);
  });

  it('several in a row do not wait for each other', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    test.portal.state.offline = true;
    for (const name of ['a', 'b', 'c']) {
      test.screen.openSection(photosPath);
      await test.screen.upload({ uri: name });
      await test.screen.submit({ foto: `kept-${name}` });
    }
    await settled(test);
    expect(test.screen.snapshot().saves).toHaveLength(3);
  });

  it('closing the form drops the photo nobody saved', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    test.screen.closeForm();
    await settled(test);
    expect(test.dropped).toEqual(['kept-a.jpg']);
    expect(test.screen.snapshot().form).toBeNull();
  });

  it('a device that cannot keep the photo says so', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    const failing = createReportScreen<Source>({ queue: test.queue, keepPhoto: async () => { throw new Error('full'); }, dropPhoto: async () => undefined, personName: () => null, placeNow: async () => ({ at: NOW }), newKey: () => 'k', now: () => NOW }, ref);
    expect(await failing.upload({ uri: 'a.jpg' })).toEqual({ ok: false, message: 'No se pudo guardar la foto en este dispositivo.' });
  });
});

describe('what Portal refused', () => {
  it('reopening the section brings what it said under each field, and discarding clears it', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    test.portal.state.refuse = { peso: 'Falta el peso' };
    test.screen.openSection(bandejas('t1'));
    await test.screen.submit({ peso: '' });
    await settled(test);
    const [refused] = test.screen.snapshot().saves;
    expect(refused?.refusal?.message).toBe('Falta el peso');
    test.screen.openSection(bandejas('t1'));
    expect(test.screen.snapshot().form?.errors).toEqual({ peso: 'Falta el peso' });
    test.screen.closeForm();
    await test.screen.discard(refused!.clientKey);
    await settled(test);
    expect(test.screen.snapshot().saves).toEqual([]);
  });
});

describe('reload', () => {
  it('after publishing the detail behind has to ask again', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.screen.reload();
    await settled(test);
    expect(test.screen.snapshot().changed).toBe(true);
  });

  it('an old answer never replaces a newer one', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    const read = test.portal.wire.read;
    let release: () => void = () => undefined;
    test.portal.wire.read = async (...args) => {
      test.portal.wire.read = read;
      await new Promise<void>((resolve) => { release = resolve; });
      return { ok: true, data: { document: { ...JSON.parse(JSON.stringify(docOf('old', []))), status: 'draft' } } };
    };
    test.screen.refresh();
    test.screen.refresh();
    await settled(test);
    release();
    await settled(test);
    expect(documentOf(test.screen.snapshot()).id).toBe('r1');
  });
});

/** E2E 06/11: one failed read after the last photo left the screen in «No se pudo abrir el informe», with no way on. */
describe('a refresh that fails', () => {
  const refusingOnce = (test: ReturnType<typeof screenWith>, times: number) => {
    const read = test.portal.wire.read;
    let left = times;
    let calls = 0;
    test.portal.wire.read = async (...args) => {
      calls += 1;
      if (left > 0) {
        left -= 1;
        return { ok: false, status: 400, message: 'No se pudo abrir el informe' };
      }
      return read(...args);
    };
    return () => calls;
  };

  it('keeps the document on screen and reads again by itself', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    const calls = refusingOnce(test, 1);
    // Act
    test.screen.refresh();
    await settled(test);
    // Assert
    expect(documentOf(test.screen.snapshot()).id).toBe('r1');
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_MS);
    expect(calls()).toBe(2);
    expect(documentOf(test.screen.snapshot()).id).toBe('r1');
  });

  it('stops trying after a few reads and stays on the document', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    const calls = refusingOnce(test, 99);
    // Act
    test.screen.refresh();
    await settled(test);
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_MS * 10);
    // Assert
    expect(calls()).toBe(1 + REFRESH_RETRIES);
    expect(documentOf(test.screen.snapshot()).id).toBe('r1');
  });

  it('a report that never opened says so, and asking again opens it', async () => {
    // Arrange
    const portal = fakePortal({ id: 'r1', tramos: [] });
    const read = portal.wire.read;
    portal.wire.read = async () => ({ ok: false, status: 400, message: 'No se pudo abrir el informe' });
    const queue = createReportQueue({ wire: portal.wire, vault: fakeVault().vault, gapMs: 0 });
    const screen = createReportScreen<Source>({ queue, keepPhoto: async () => ({ ref: 'k', mime: 'image/jpeg', preview: 'p' }), dropPhoto: async () => undefined, placeNow: async () => ({ at: NOW }), personName: () => null, newKey: () => 'k', now: () => NOW }, ref);
    screen.subscribe(() => undefined);
    await settled({ queue });
    expect(screen.snapshot().draft).toMatchObject({ ok: false, message: 'No se pudo abrir el informe' });
    // Act
    portal.wire.read = read;
    screen.refresh();
    await settled({ queue });
    // Assert
    expect(documentOf(screen.snapshot()).id).toBe('r1');
  });
});

describe('a photo that needs its place (CTL-PIS, José 06/11)', () => {
  const photosPath: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };
  const located = { id: 'r1', tramos: [{ id: 't1', photos: 0 }], requireLocation: true };
  const noFix = async (): Promise<DevicePlace> => ({ at: NOW });

  it('without GPS there is no photo: «Enviar» says so and the form stays open', async () => {
    // Arrange
    const test = screenWith(located, noFix);
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    // Act
    const outcome = await test.screen.submit({ foto: 'kept-a.jpg' });
    // Assert
    expect(outcome).toEqual({ done: false, errors: {}, message: NO_GPS_PHOTO });
    expect(test.screen.snapshot().form).not.toBeNull();
    expect(test.screen.snapshot().saves).toEqual([]);
    test.stop();
  });

  it('a GPS that fails reads the same, and turned on it goes at the next «Enviar»', async () => {
    // Arrange
    let reading: () => Promise<DevicePlace> = async () => { throw new Error('off'); };
    const test = screenWith(located, () => reading());
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    expect(await test.screen.submit({ foto: 'kept-a.jpg' })).toMatchObject({ done: false, message: NO_GPS_PHOTO });
    reading = async () => ({ lat: -12, lng: -77, at: NOW });
    test.portal.state.offline = true;
    // Act
    const outcome = await test.screen.submit({ foto: 'kept-a.jpg' });
    // Assert
    expect(outcome).toMatchObject({ done: true });
    expect(test.screen.snapshot().saves[0]).toMatchObject({ place: { lat: -12, lng: -77, at: NOW } });
    test.stop();
  });

  it('a section that does not ask for the place takes the photo with the hour alone', async () => {
    // Arrange
    const free = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] }, noFix);
    await settled(free);
    free.screen.openSection(photosPath);
    await free.screen.upload({ uri: 'a.jpg' });
    // Act
    const outcome = await free.screen.submit({ foto: 'kept-a.jpg' });
    // Assert
    expect(outcome).toMatchObject({ done: true });
    free.stop();
  });
});

describe('continuing a draft (José 06/11: its row only offered the PDF)', () => {
  it('asks for that report, not for the newest of its type', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [] }, undefined, 'r1');
    // Act
    await settled(test);
    // Assert
    expect(test.askedIds[0]).toBe('r1');
    test.stop();
  });

  it('with no report named, Portal decides which draft opens', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [] });
    // Act
    await settled(test);
    // Assert
    expect(test.askedIds[0]).toBeNull();
    test.stop();
  });
});

describe('the GPS never holds the photo (José 06/11: «pasan segundos y recién los agrega a la app»)', () => {
  const photosPath: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };
  const start = { id: 'r1', tramos: [{ id: 't1', photos: 0 }] };

  it('the reading starts with the form, so it runs while the person aims', async () => {
    // Arrange
    const placeNow = vi.fn(async (): Promise<DevicePlace> => ({ lat: -12, lng: -77, at: NOW }));
    const test = screenWith(start, placeNow);
    await settled(test);
    // Act
    test.screen.openSection(photosPath);
    // Assert
    expect(placeNow).toHaveBeenCalledTimes(1);
    await test.screen.upload({ uri: 'a.jpg' });
    expect(placeNow).toHaveBeenCalledTimes(1);
    test.stop();
  });

  it('a form with no photo never asks for the GPS', async () => {
    // Arrange
    const placeNow = vi.fn(async (): Promise<DevicePlace> => ({ at: NOW }));
    const test = screenWith(start, placeNow);
    await settled(test);
    // Act
    test.screen.openSection(general);
    // Assert
    expect(placeNow).not.toHaveBeenCalled();
    test.stop();
  });

  it('the shot is kept at once, whatever the GPS is doing', async () => {
    // Arrange
    const test = screenWith(start, () => new Promise<DevicePlace>(() => undefined));
    await settled(test);
    test.screen.openSection(photosPath);
    // Act
    const kept = await test.screen.upload({ uri: 'a.jpg' });
    // Assert
    expect(kept).toEqual({ ok: true, fileId: 'kept-a.jpg' });
    test.stop();
  });

  it('a second photo reads the GPS again: the first reading was for the first one', async () => {
    // Arrange
    const placeNow = vi.fn(async (): Promise<DevicePlace> => ({ lat: -12, lng: -77, at: NOW }));
    const test = screenWith(start, placeNow);
    await settled(test);
    test.screen.openSection(photosPath);
    // Act
    await test.screen.upload({ uri: 'a.jpg' });
    await test.screen.upload({ uri: 'b.jpg' });
    // Assert
    expect(placeNow).toHaveBeenCalledTimes(2);
    test.stop();
  });

  it('a slow GPS holds «Enviar» a moment, then the photo goes with its hour', async () => {
    // Arrange
    const test = screenWith(start, () => new Promise<DevicePlace>(() => undefined));
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    test.portal.state.offline = true;
    // Act
    const sending = test.screen.submit({ foto: 'kept-a.jpg' });
    await vi.advanceTimersByTimeAsync(PHOTO_PLACE_WAIT_MS);
    // Assert
    expect(await sending).toMatchObject({ done: true });
    expect(test.screen.snapshot().saves[0]).toMatchObject({ place: { at: NOW } });
    test.stop();
  });

  it('a section that needs the place waits for it, however long the phone takes', async () => {
    // Arrange
    let answer: (place: DevicePlace) => void = () => undefined;
    const test = screenWith({ ...start, requireLocation: true }, () => new Promise<DevicePlace>((resolve) => { answer = resolve; }));
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    const sending = test.screen.submit({ foto: 'kept-a.jpg' });
    await vi.advanceTimersByTimeAsync(PHOTO_PLACE_WAIT_MS * 2);
    // Act
    answer({ lat: -12, lng: -77, at: NOW });
    // Assert
    expect(await sending).toMatchObject({ done: true });
    test.stop();
  });

  it('closing the form while «Enviar» waits for the GPS saves nothing', async () => {
    // Arrange
    let answer: (place: DevicePlace) => void = () => undefined;
    const test = screenWith({ ...start, requireLocation: true }, () => new Promise<DevicePlace>((resolve) => { answer = resolve; }));
    await settled(test);
    test.screen.openSection(photosPath);
    await test.screen.upload({ uri: 'a.jpg' });
    const sending = test.screen.submit({ foto: 'kept-a.jpg' });
    // Act
    test.screen.closeForm();
    answer({ lat: -12, lng: -77, at: NOW });
    // Assert
    expect(await sending).toMatchObject({ done: false });
    expect(test.screen.snapshot().saves).toEqual([]);
    test.stop();
  });
});

describe('taking a sent photo out of a draft (José 06/11)', () => {
  const fotosOf = (state: ReportScreenState) => tramosOf(state).items[0]!.sections.find((one) => one.id === 'fotos')!.values.fotos as unknown[];

  it('Portal hears it at once and the document comes back without the photo', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    await settled(test);
    // Act
    const removal = await test.screen.removePhoto('f1');
    await settled(test);
    // Assert
    expect(removal).toEqual({ ok: true });
    expect(test.portal.removed).toEqual(['r1:f1']);
    expect(fotosOf(test.screen.snapshot())).toHaveLength(1);
    expect(test.screen.snapshot().changed).toBe(true);
    test.stop();
  });

  it('with no signal nothing moves, and the person is told', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 1 }] });
    await settled(test);
    test.portal.state.offline = true;
    // Act
    const removal = await test.screen.removePhoto('f0');
    // Assert
    expect(removal).toEqual({ ok: false, message: PHOTO_REMOVAL_FAILED });
    expect(fotosOf(test.screen.snapshot())).toHaveLength(1);
    expect(test.screen.snapshot().saves).toEqual([]);
    test.stop();
  });

  it('what Portal refuses reaches the person in its words', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 1 }] });
    await settled(test);
    test.portal.state.refuse = { _: 'El informe ya se publicó: conserva sus fotos.' };
    // Act and assert
    expect(await test.screen.removePhoto('f0')).toEqual({ ok: false, message: 'El informe ya se publicó: conserva sus fotos.' });
    test.stop();
  });

  it('a report Portal has not made yet has nothing to take out', async () => {
    // Arrange
    const test = screenWith({ id: null, tramos: [] });
    await settled(test);
    // Act and assert
    expect(await test.screen.removePhoto('f0')).toEqual({ ok: false, message: PHOTO_REMOVAL_FAILED });
    expect(test.portal.removed).toEqual([]);
    test.stop();
  });
});

