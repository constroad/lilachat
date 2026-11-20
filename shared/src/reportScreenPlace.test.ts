import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportQueue } from './reportQueue';
import { fakePortal, fakeVault, general, NOW, ref } from './reportQueue.fixture';
import type { DevicePlace } from './reportCreation';
import { createReportScreen, placeLineOf, PLACE_LINES } from './reportScreen';
import type { SectionPath } from './fieldDocument';

type Source = { uri: string };
const photosPath: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };

/** A report whose photo section reads the GPS; the reading answers when the test says. */
function screenWith(requireLocation: boolean) {
  let answer: (place: DevicePlace) => void = () => undefined;
  const portal = fakePortal({ id: 'r1', tramos: [{ id: 't1', photos: 0 }], requireLocation });
  const queue = createReportQueue({ wire: portal.wire, vault: fakeVault().vault, gapMs: 0 });
  const screen = createReportScreen<Source>({
    queue,
    keepPhoto: async (source) => ({ ref: `kept-${source.uri}`, mime: 'image/jpeg', preview: `file://${source.uri}` }),
    dropPhoto: async () => undefined,
    placeNow: () => new Promise<DevicePlace>((resolve) => { answer = resolve; }),
    personName: () => 'Ana Torres',
    newKey: () => 'k1',
    now: () => NOW,
  }, ref);
  const stop = screen.subscribe(() => undefined);
  const settled = async () => {
    await queue.idle();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { screen, stop, settled, answer: (place: DevicePlace) => answer(place) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the location while a photo section is open (José 19/11: no loading indicator)', () => {
  it('opening it says the location is being read', async () => {
    // Arrange
    const test = screenWith(true);
    await test.settled();
    // Act
    test.screen.openSection(photosPath);
    // Assert
    expect(test.screen.snapshot().place).toEqual({ state: 'reading', required: true });
    test.stop();
  });

  it('a fix turns it ready', async () => {
    // Arrange
    const test = screenWith(true);
    await test.settled();
    test.screen.openSection(photosPath);
    // Act
    test.answer({ lat: -12, lng: -77, at: NOW });
    await vi.advanceTimersByTimeAsync(0);
    // Assert
    expect(test.screen.snapshot().place).toEqual({ state: 'ready', required: true });
    test.stop();
  });

  it('no fix (permission denied, timeout) turns it failed', async () => {
    // Arrange
    const test = screenWith(false);
    await test.settled();
    test.screen.openSection(photosPath);
    // Act
    test.answer({ at: NOW });
    await vi.advanceTimersByTimeAsync(0);
    // Assert
    expect(test.screen.snapshot().place).toEqual({ state: 'failed', required: false });
    test.stop();
  });

  it('a section with no photo reads nothing', async () => {
    // Arrange
    const test = screenWith(true);
    await test.settled();
    // Act
    test.screen.openSection(general);
    // Assert
    expect(test.screen.snapshot().place).toBeNull();
    test.stop();
  });

  it('closing the form forgets it, and a late answer does not bring it back', async () => {
    // Arrange
    const test = screenWith(true);
    await test.settled();
    test.screen.openSection(photosPath);
    // Act
    test.screen.closeForm();
    test.answer({ lat: -12, lng: -77, at: NOW });
    await vi.advanceTimersByTimeAsync(0);
    // Assert
    expect(test.screen.snapshot().place).toBeNull();
    test.stop();
  });
});

describe('placeLineOf', () => {
  it('names each state in plain words', () => {
    expect(placeLineOf(null)).toBeNull();
    expect(placeLineOf({ state: 'reading', required: true })).toEqual({ tone: 'busy', text: PLACE_LINES.reading });
    expect(placeLineOf({ state: 'ready', required: false })).toEqual({ tone: 'ok', text: PLACE_LINES.ready });
    expect(placeLineOf({ state: 'failed', required: true })).toEqual({ tone: 'error', text: PLACE_LINES.failedRequired });
    expect(placeLineOf({ state: 'failed', required: false })).toEqual({ tone: 'warn', text: PLACE_LINES.failedOptional });
  });
});
