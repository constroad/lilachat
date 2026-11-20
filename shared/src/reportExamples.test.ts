import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportQueue } from './reportQueue';
import { docOf, fakePortal, fakeVault, general, NOW, ref, type Tramo } from './reportQueue.fixture';
import { createReportScreen } from './reportScreen';
import type { FieldDocument, FormSection } from './fieldDocument';
import { EXAMPLE_FILL_FAILED, exampleBannerLine, runExampleFill, exampleDismissKeys, exampleFillOf, exampleOutcomeLine, exampleProgressLine, exampleSectionsOf, isExampleDismissed, parseExampleDismissed, showsExampleBanner, withExampleDismissed, EXAMPLE_DISMISSED_MAX } from './reportExamples';

const withGeneral = (document: FieldDocument, patch: Partial<FormSection>): FieldDocument => ({ ...document, sections: document.sections.map((section) => (section.id === 'general' && section.kind === 'form' ? { ...section, ...patch } : section)) });

describe('exampleSectionsOf', () => {
  it('lists the sections with an example, a tramo\'s after the top ones; a photo section never', () => {
    // Arrange
    const document = docOf('r1', [{ id: 't1', photos: 0 }], false, true);
    // Act
    const paths = exampleSectionsOf(document);
    // Assert
    expect(paths).toEqual([general, { sectionId: 'tramos', itemId: 't1', key: 'bandejas' }]);
  });

  it('a report with no example has none, and shows no banner', () => {
    const document = docOf('r1', [{ id: 't1', photos: 0 }]);
    expect(exampleSectionsOf(document)).toEqual([]);
    expect(showsExampleBanner(document)).toBe(false);
  });

  it('a published report shows no banner even with examples', () => {
    const document = docOf('r1', [], false, true);
    expect(showsExampleBanner(document)).toBe(true);
    expect(showsExampleBanner({ ...document, status: 'published' })).toBe(false);
  });

  it('a section Portal keeps closed is skipped once the report exists', () => {
    const document = withGeneral(docOf('r1', [], false, true), { enabled: false });
    expect(exampleSectionsOf(document)).toEqual([]);
  });
});

describe('exampleFillOf', () => {
  it('the form as it opens with the example over its empty fields', () => {
    // Arrange
    const document = docOf('r1', [], false, true);
    // Act
    const fill = exampleFillOf(document, general, { personName: 'Ana Torres' });
    // Assert
    expect(fill).toEqual({ kind: 'fill', title: 'Datos generales', values: { liquido: 'MC-30', responsable: 'Ana Torres' } });
  });

  it('what the person wrote stays: a section with nothing empty is no save', () => {
    const document = withGeneral(docOf('r1', [], false, true), { values: { liquido: 'RC-250' } });
    expect(exampleFillOf(document, general)).toEqual({ kind: 'nothing', title: 'Datos generales' });
  });

  it('a required field the example leaves empty cannot be saved from the banner', () => {
    const base = docOf('r1', [], false, true);
    const document: FieldDocument = { ...base, forms: { ...base.forms, general: { ...base.forms.general!, properties: { ...base.forms.general!.properties, turno: { type: 'string', title: 'Turno' } }, required: ['turno'] } } };
    expect(exampleFillOf(document, general)).toEqual({ kind: 'missing', title: 'Datos generales' });
  });

  it('a path that is not there gives nothing', () => {
    expect(exampleFillOf(docOf('r1', [], false, true), { sectionId: 'nada', itemId: null, key: 'nada' })).toBeNull();
  });
});

describe('the banner\'s lines', () => {
  it('progress counts from one and never past the total', () => {
    expect(exampleProgressLine({ done: 0, total: 3 })).toBe('Completando 1 de 3…');
    expect(exampleProgressLine({ done: 3, total: 3 })).toBe('Completando 3 de 3…');
  });

  it('nothing before it starts; the progress while it fills; then the outcome', () => {
    expect(exampleBannerLine(null, null)).toBeNull();
    expect(exampleBannerLine({ done: 0, total: 0 }, null)).toBeNull();
    expect(exampleBannerLine({ done: 1, total: 2 }, null)).toBe('Completando 2 de 2…');
    expect(exampleBannerLine(null, { saved: 2, skipped: [] })).toBe('2 secciones completadas');
  });

  it('a fill that breaks ends as an outcome that says so', async () => {
    const outcome = await runExampleFill(async () => { throw new Error('boom'); }, () => undefined);
    expect(outcome).toEqual({ saved: 0, skipped: [], failed: `${EXAMPLE_FILL_FAILED} (boom)` });
    expect(await runExampleFill(async () => ({ saved: 1, skipped: [] }), () => undefined)).toEqual({ saved: 1, skipped: [] });
  });

  it('the outcome says what was saved and what is left by hand', () => {
    expect(exampleOutcomeLine({ saved: 1, skipped: [] })).toBe('1 sección completada');
    expect(exampleOutcomeLine({ saved: 2, skipped: ['Fotos'] })).toBe('2 secciones completadas · Falta a mano: Fotos');
    expect(exampleOutcomeLine({ saved: 0, skipped: [] })).toBe('Ya estaba todo lleno');
    expect(exampleOutcomeLine({ saved: 1, skipped: [], failed: 'No se pudo' })).toBe('No se pudo');
  });
});

describe('closing the banner, remembered on the device', () => {
  it('a report is dismissed by its id or, before it exists, by its service and type', () => {
    const keys = exampleDismissKeys('sv1', 'CTL-IMP', null);
    const dismissed = withExampleDismissed([], keys);
    expect(isExampleDismissed(dismissed, exampleDismissKeys('sv1', 'CTL-IMP', 'r1'))).toBe(true);
    expect(isExampleDismissed(dismissed, exampleDismissKeys('sv2', 'CTL-IMP', 'r2'))).toBe(false);
  });

  it('keeps the newest past the limit, without repeats', () => {
    const many = Array.from({ length: EXAMPLE_DISMISSED_MAX }, (_unused, index) => `r${index}`);
    const next = withExampleDismissed(many, ['r0', 'nuevo']);
    expect(next).toHaveLength(EXAMPLE_DISMISSED_MAX);
    expect(next.slice(-2)).toEqual(['r0', 'nuevo']);
    expect(next.filter((key) => key === 'r0')).toHaveLength(1);
  });

  it('reads only a list of texts from the device', () => {
    expect(parseExampleDismissed(null)).toEqual([]);
    expect(parseExampleDismissed('no es json')).toEqual([]);
    expect(parseExampleDismissed('{"a":1}')).toEqual([]);
    expect(parseExampleDismissed('["r1",2,"r2"]')).toEqual(['r1', 'r2']);
  });
});

function screenWith(start: { id: string | null; tramos: Tramo[] }) {
  const portal = fakePortal({ ...start, examples: true });
  const disk = fakeVault();
  const queue = createReportQueue({ wire: portal.wire, vault: disk.vault, gapMs: 0 });
  let keys = 0;
  const screen = createReportScreen<{ uri: string }>({ queue, keepPhoto: async () => ({ ref: '', mime: '', preview: '' }), dropPhoto: async () => undefined, placeNow: async () => ({ at: NOW }), personName: () => 'Ana Torres', newKey: () => `k${(keys += 1)}`, now: () => NOW }, ref);
  screen.subscribe(() => undefined);
  return { portal, disk, queue, screen };
}

const settled = async ({ queue }: { queue: ReturnType<typeof createReportQueue> }) => {
  await queue.idle();
  await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fillExamples on the report screen (José 20/11)', () => {
  it('saves each section with an example, one after the other, through the queue', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [{ id: 't1', photos: 0 }] });
    await settled(test);
    const steps: number[] = [];
    // Act
    const outcome = await test.screen.fillExamples(({ done }) => steps.push(done));
    await settled(test);
    // Assert
    expect(outcome).toEqual({ saved: 2, skipped: [] });
    expect(steps).toEqual([0, 1, 2]);
    expect(test.portal.state.writes).toEqual(['general:nuevo:{"liquido":"MC-30","responsable":"Ana Torres"}', 'bandejas:t1:{"peso":"12"}']);
  });

  it('a device that cannot keep the save stops and says so', async () => {
    // Arrange
    const test = screenWith({ id: 'r1', tramos: [] });
    await settled(test);
    test.disk.vault.store = async () => { throw new Error('full'); };
    // Act
    const outcome = await test.screen.fillExamples();
    // Assert
    expect(outcome).toEqual({ saved: 0, skipped: [], failed: 'No se pudo guardar en este dispositivo.' });
  });

  it('without a document there is nothing to fill', async () => {
    const test = screenWith({ id: 'r1', tramos: [] });
    expect(await test.screen.fillExamples()).toEqual({ saved: 0, skipped: [] });
  });
});
