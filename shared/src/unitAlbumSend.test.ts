import { describe, expect, it } from 'vitest';
import { createReportQueue } from './reportQueue';
import { fakePortal, fakeVault, NOW, ref, type Tramo } from './reportQueue.fixture';
import { createReportScreen } from './reportScreen';
import { ALBUM_SEND_FAILED, ALBUM_SENT } from './unitAlbum';

/** «Terminar unidad» end to end in shared (José 19/11): the run, the empty form and Portal's text for the notice. */
function screenWith(start: { id: string | null; tramos: Tramo[] }) {
  const portal = fakePortal(start);
  const disk = fakeVault();
  const queue = createReportQueue({ wire: portal.wire, vault: disk.vault, gapMs: 0 });
  const screen = createReportScreen<{ uri: string }>({
    queue,
    keepPhoto: async (source) => ({ ref: source.uri, mime: 'image/jpeg', preview: source.uri }),
    dropPhoto: async () => undefined,
    placeNow: async () => ({ at: NOW }),
    personName: () => 'Ana',
    newKey: () => 'k1',
    now: () => NOW,
  }, ref);
  const stop = screen.subscribe(() => undefined);
  const settled = async () => {
    await queue.idle();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { portal, queue, screen, stop, settled };
}

const URLS = ['https://x/0.jpg', 'https://x/1.jpg'];

describe('sending a unit’s album to the group', () => {
  it('opens the tool with the report, the unit and the urls, and gives Portal’s words back', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    await test.settled();
    const readsBefore = test.portal.state.reads;
    // Act
    const sent = await test.screen.sendUnitAlbum('t1', URLS);
    await test.settled();
    // Assert
    expect(sent).toEqual({ ok: true, message: 'Se enviaron 2 fotos al grupo.' });
    expect(test.portal.albums).toEqual([`r1:t1:${URLS.join(',')}`]);
    expect(test.portal.state.reads).toBeGreaterThan(readsBefore);
    test.stop();
  });

  it('says it went in its own words when Portal answers with no text', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    await test.settled();
    test.portal.state.albumText = '';
    // Act and assert
    expect(await test.screen.sendUnitAlbum('t1', URLS)).toEqual({ ok: true, message: ALBUM_SENT });
    test.stop();
  });

  it('with no signal nothing is sent, and the person is told', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    await test.settled();
    test.portal.state.offline = true;
    // Act and assert
    expect(await test.screen.sendUnitAlbum('t1', URLS)).toEqual({ ok: false, message: ALBUM_SEND_FAILED });
    expect(test.portal.albums).toEqual([]);
    test.stop();
  });

  it('a refusal of Portal reaches the person in its words', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    await test.settled();
    test.portal.state.refuse = { _: 'Solo un admin envía fotos al grupo.' };
    // Act and assert
    expect(await test.screen.sendUnitAlbum('t1', URLS)).toEqual({ ok: false, message: 'Solo un admin envía fotos al grupo.' });
    test.stop();
  });

  it('nothing to send, or a report Portal has not made, asks nothing', async () => {
    // Arrange
    const made = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 2 }] });
    const unborn = screenWith({ id: null, tramos: [] });
    await Promise.all([made.settled(), unborn.settled()]);
    // Act and assert
    expect(await made.screen.sendUnitAlbum('t1', [])).toEqual({ ok: false, message: ALBUM_SEND_FAILED });
    expect(await unborn.screen.sendUnitAlbum('t1', URLS)).toEqual({ ok: false, message: ALBUM_SEND_FAILED });
    expect([...made.portal.albums, ...unborn.portal.albums]).toEqual([]);
    made.stop();
    unborn.stop();
  });
});
