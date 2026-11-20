import { describe, expect, it } from 'vitest';
import { fieldDocumentOf, type RepeatItem, type RepeatSection } from './fieldDocument';
import { photoSlotsOf } from './reportUnits';
import { arrivedAtOf, canMoveNext, finishBlockOf, moveNext, moveUnit, nextSlotOf, openOrderOf, queueCountsLine, queueVolumeLine, selectedUnitOf, slotMeasureOf, takeLabelOf, unloadQueueOf, volumeOf } from './unloadQueue';

const KINDS = ['ingreso', 'temperatura', 'escantillon', 'vacia'];
const template = [
  { id: 'datos', title: 'Datos', required: true, form: 'unidad' },
  ...KINDS.map((kind) => ({ id: `foto-${kind}`, title: kind === 'vacia' ? 'Unidad vacía · cierra la unidad' : `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind })),
];
const shot = (name: string, hora = '08:10') => ({ id: name, url: `https://x/${name}.jpg`, thumb_url: `https://x/${name}-t.jpg`, hora });

type UnitSpec = { id: string; plate: string; photos?: string[]; summary?: string[]; values?: Record<string, unknown>; sent?: boolean; hour?: string };
function unitOf({ id, plate, photos = [], summary = ['Salió 07:00 · 15 m³'], values = {}, sent, hour }: UnitSpec) {
  const photoSections = KINDS.map((kind) => ({ id: `foto-${kind}`, state: photos.includes(kind) ? 'done' : 'empty', values: { fotos: photos.includes(kind) ? [shot(`${id}-${kind}`, hour)] : [] } }));
  const filled = Object.keys(values).length > 0;
  return { id, title: `Unidad ${id.slice(1)} · ${plate}`, summary, results: [], sections: [{ id: 'datos', state: filled ? 'partial' : 'empty', values }, ...photoSections], ...(sent ? { albumEnviadoAt: '2026-11-20T13:05:00.000Z' } : {}) };
}

function sectionOf(units: UnitSpec[]): RepeatSection {
  const body = {
    id: 'r1', type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
    forms: { unidad: { type: 'object', properties: { horaLlegada: { type: 'string', title: 'Hora' }, tempLlegada: { type: 'number', title: 'T' }, escantillonCm: { type: 'number', title: 'E' } } }, fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
    sections: [{ id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 1, template, items: units.map(unitOf) }],
    publish: { label: 'Publicar informe', missing: [] },
  };
  return fieldDocumentOf(body)!.sections[0] as RepeatSection;
}

// Portal's order: closed rows first by placement, open rows by arrival, then the dispatches not here.
const FIELD = [
  { id: 'd1', plate: 'F2K-908', photos: KINDS, sent: true, summary: ['Colocación N° 1', 'Terminó 08:05', 'Salió 07:00 · 15 m³'], hour: '07:40' },
  { id: 'd2', plate: 'D5N-227', photos: ['ingreso', 'temperatura'], values: { horaLlegada: '08:02', tempLlegada: 148 } },
  { id: 'd3', plate: 'T4L-118', photos: ['ingreso'], hour: '08:20' },
  { id: 'd4', plate: 'B7M-604', photos: ['ingreso'], hour: '08:15' },
  { id: 'd5', plate: 'C9K-355', summary: ['Salió 08:30 · 15 m³'] },
];

describe('the unloading queue (José 20/11)', () => {
  it('puts the closed units first, then the open ones in arrival order, then the ones on their way', () => {
    // Arrange
    const section = sectionOf(FIELD);
    // Act
    const queue = unloadQueueOf(section);
    // Assert
    expect(queue.map((one) => [one.position, one.plate, one.status])).toEqual([
      [1, 'F2K-908', 'sent'], [2, 'D5N-227', 'unloading'], [3, 'T4L-118', 'queued'], [4, 'B7M-604', 'queued'], [5, 'C9K-355', 'onTheWay'],
    ]);
  });

  it('follows the order the person set, and a unit it does not name arrived last', () => {
    // Arrange
    const section = sectionOf(FIELD);
    // Act
    const queue = unloadQueueOf(section, ['d4', 'd2']);
    // Assert
    expect(queue.map((one) => one.item.id)).toEqual(['d1', 'd4', 'd2', 'd3', 'd5']);
    expect(queue[1]?.status).toBe('unloading');
  });

  it('ignores ids of units that are closed or gone', () => {
    const queue = unloadQueueOf(sectionOf(FIELD), ['d1', 'zz', 'd3']);
    expect(openOrderOf(queue)).toEqual(['d3', 'd2', 'd4']);
  });

  it('tells a finished unit not sent yet from a sent one', () => {
    const queue = unloadQueueOf(sectionOf([{ id: 'd1', plate: 'AAA-111', photos: KINDS }]));
    expect(queue[0]?.status).toBe('finished');
  });

  it('is empty for no units', () => {
    expect(unloadQueueOf(sectionOf([]))).toEqual([]);
  });

  it('writes when each unit arrived and what it carries', () => {
    // Arrange
    const queue = unloadQueueOf(sectionOf(FIELD));
    // Assert
    expect(queue.map((one) => one.line)).toEqual(['Llegó 07:40 · Terminó 08:05', 'Llegó 08:02 · 15 m³', 'Llegó 08:20 · 15 m³', 'Llegó 08:15 · 15 m³', 'Salió 08:30 · 15 m³']);
  });

  it('says «En planta» for a truck that has not left', () => {
    const queue = unloadQueueOf(sectionOf([{ id: 'd9', plate: 'P', summary: ['En planta'] }]));
    expect(queue[0]).toMatchObject({ status: 'onTheWay', line: 'En planta' });
  });
});

describe('reordering', () => {
  it('«Siguiente» puts a unit right after the one unloading', () => {
    expect(moveNext(['a', 'b', 'c', 'd'], 'd')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('«Siguiente» on the first in line passes the one unloading', () => {
    expect(moveNext(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('«Siguiente» leaves the head and an unknown id where they are', () => {
    expect(moveNext(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(moveNext(['a', 'b'], 'x')).toEqual(['a', 'b']);
  });

  it('a drag moves a unit to any place, clamped to the line', () => {
    expect(moveUnit(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveUnit(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveUnit(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b']);
    expect(moveUnit(['a', 'b'], 'x', 0)).toEqual(['a', 'b']);
  });

  it('only a unit waiting in line shows «Siguiente»', () => {
    const queue = unloadQueueOf(sectionOf(FIELD));
    expect(queue.map(canMoveNext)).toEqual([false, false, true, true, false]);
  });
});

describe('finishing a unit after the one before it left (José 20/11)', () => {
  it('blocks a unit while the one unloading has no photo of the empty truck', () => {
    // Arrange
    const queue = unloadQueueOf(sectionOf(FIELD));
    // Act
    const block = finishBlockOf(queue, 'd3');
    // Assert
    expect(block).toEqual({ itemId: 'd2', plate: 'D5N-227', text: 'Primero termina la Unidad 2 · D5N-227: todavía no tiene la foto de unidad vacía.', goLabel: 'Ir a D5N-227' });
  });

  it('lets the one unloading finish: the one before it already left', () => {
    expect(finishBlockOf(unloadQueueOf(sectionOf(FIELD)), 'd2')).toBeNull();
  });

  it('never blocks a closed unit sending its photos again, nor an unknown one', () => {
    const queue = unloadQueueOf(sectionOf(FIELD));
    expect(finishBlockOf(queue, 'd1')).toBeNull();
    expect(finishBlockOf(queue, 'nope')).toBeNull();
  });

  it('names the plate alone when Portal gives no number', () => {
    const section = sectionOf([{ id: 'd1', plate: 'A', photos: ['ingreso'] }, { id: 'd2', plate: 'B', photos: ['ingreso'] }]);
    const queue = unloadQueueOf({ items: section.items.map((item) => ({ ...item, title: item.title.split(' · ')[1]! })) });
    expect(finishBlockOf(queue, 'd2')?.text).toBe('Primero termina A: todavía no tiene la foto de unidad vacía.');
  });
});

describe('the card and the header', () => {
  it('shows the unit picked, else the one unloading, else a closed one', () => {
    const queue = unloadQueueOf(sectionOf(FIELD));
    expect(selectedUnitOf(queue, 'd4')?.plate).toBe('B7M-604');
    expect(selectedUnitOf(queue, 'd5')?.plate).toBe('D5N-227');
    expect(selectedUnitOf(queue, null)?.plate).toBe('D5N-227');
    expect(selectedUnitOf(unloadQueueOf(sectionOf([FIELD[0]!])), null)?.plate).toBe('F2K-908');
    expect(selectedUnitOf([], null)).toBeNull();
  });

  it('counts the units by status, without the empty ones', () => {
    expect(queueCountsLine(unloadQueueOf(sectionOf(FIELD)))).toBe('5 unid. · 1 enviada · 1 descargando · 2 en cola · 1 en camino');
    expect(queueCountsLine([])).toBe('');
  });

  it('sums the volume laid over the order', () => {
    expect(queueVolumeLine(unloadQueueOf(sectionOf(FIELD)))).toBe('15 / 75 m³');
    expect(queueVolumeLine(unloadQueueOf(sectionOf([{ id: 'd1', plate: 'A', summary: [] }])))).toBe('');
  });

  it('reads a decimal volume with a comma', () => {
    expect(volumeOf({ summary: ['Salió 07:00 · 7,5 m³'] })).toBe(7.5);
    expect(volumeOf({ summary: [] })).toBe(0);
  });

  it('shows the measure typed on each photo', () => {
    // Arrange
    const item = sectionOf(FIELD).items[1]!;
    const [, temperature, gauge] = photoSlotsOf(item);
    // Act and assert
    expect(slotMeasureOf(item, temperature!)).toBe('148 °C');
    expect(slotMeasureOf(item, gauge!)).toBeNull();
    expect(slotMeasureOf(item, photoSlotsOf(item)[0]!)).toBeNull();
  });

  it('names the next photo to take', () => {
    const item = sectionOf(FIELD).items[1]!;
    expect(takeLabelOf(nextSlotOf(item)!)).toBe('Tomar escantillon');
    const closed = sectionOf(FIELD).items[0]!;
    expect(nextSlotOf(closed)).toBeNull();
  });

  it('reads the arrival from the data, else from the ingreso photo', () => {
    const [sent, written, photographed, , away] = sectionOf(FIELD).items as RepeatItem[];
    expect(arrivedAtOf(written!)).toBe('08:02');
    expect(arrivedAtOf(photographed!)).toBe('08:20');
    expect(arrivedAtOf(sent!)).toBe('07:40');
    expect(arrivedAtOf(away!)).toBeNull();
  });
});
