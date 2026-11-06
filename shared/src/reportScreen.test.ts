import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportQueue } from './reportQueue';
import { docOf, fakePortal, fakeVault, general, newTramo, NOW, ref, type Tramo } from './reportQueue.fixture';
import type { DevicePlace } from './reportCreation';
import { createReportScreen, NO_GPS_PHOTO, type ReportScreenState } from './reportScreen';
import type { FieldDocument, FormSection, RepeatSection, SectionPath } from './fieldDocument';

type Source = { uri: string };

function screenWith(start: { id: string | null; tramos: Tramo[]; requireLocation?: boolean }, placeNow: () => Promise<DevicePlace> = async () => ({ lat: -12, lng: -77, at: NOW })) {
  const portal = fakePortal(start);
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
  }, ref);
  const stop = screen.subscribe(() => undefined);
  return { portal, disk, queue, screen, stop, dropped };
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

describe('a photo that needs its place (CTL-PIS, José 06/11)', () => {
  const fotos: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };

  it('without GPS there is no photo: it is dropped and the person is told', async () => {
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }], requireLocation: true }, async () => ({ at: NOW }));
    await settled(test);
    test.screen.openSection(fotos);
    expect(await test.screen.upload({ uri: 'a.jpg' })).toEqual({ ok: false, message: NO_GPS_PHOTO });
    expect(test.dropped).toEqual(['kept-a.jpg']);
    test.stop();
  });

  it('a GPS that fails reads the same, and with the fix the photo is kept', async () => {
    const failing = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }], requireLocation: true }, async () => { throw new Error('off'); });
    await settled(failing);
    failing.screen.openSection(fotos);
    expect(await failing.screen.upload({ uri: 'a.jpg' })).toEqual({ ok: false, message: NO_GPS_PHOTO });
    failing.stop();
    const placed = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }], requireLocation: true });
    await settled(placed);
    placed.screen.openSection(fotos);
    expect(await placed.screen.upload({ uri: 'a.jpg' })).toEqual({ ok: true, fileId: 'kept-a.jpg' });
    expect(placed.dropped).toEqual([]);
    placed.stop();
  });

  it('a section that does not ask for the place takes the photo with the hour alone', async () => {
    const free = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] }, async () => ({ at: NOW }));
    await settled(free);
    free.screen.openSection(fotos);
    expect(await free.screen.upload({ uri: 'a.jpg' })).toEqual({ ok: true, fileId: 'kept-a.jpg' });
    free.stop();
  });
});
