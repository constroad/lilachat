import { describe, expect, it } from 'vitest';
import { mapLegendEntries, mapMoreItems, workChoiceLabel, workChoicesOf } from './workMapMenu.js';

/** José 09/11: the actions were piled up; the rest goes under «Más», the works in a select, the legend folds. */
const view = { works: [{ id: 'w1', name: 'Base granular', color: '#a16207', percent: 100 }, { id: 'w2', name: 'Imprimación', color: '#2563eb', percent: 41.5 }] };

describe('«Más» on the work map', () => {
  it('an admin who edits sees every option, in the order of the work', () => {
    // Arrange / Act
    const items = mapMoreItems({ draws: true, edits: true, admin: true });
    // Assert
    expect(items.map((item) => item.key)).toEqual(['draw', 'stages', 'works', 'export', 'open', 'deleted']);
    expect(items.map((item) => item.label)).toEqual(['Nueva calle', 'Etapas', 'Trabajos', 'Exportar', 'Abrir en Portal', 'Borrados']);
  });

  it('someone who only looks keeps export and open; «Borrados» needs both admin and editing', () => {
    expect(mapMoreItems({ draws: false, edits: false, admin: true }).map((item) => item.key)).toEqual(['export', 'open']);
    expect(mapMoreItems({ draws: true, edits: true, admin: false }).map((item) => item.key)).not.toContain('deleted');
  });
});

describe('the work select', () => {
  it('«Todos los trabajos» first, then each work with its percent', () => {
    expect(workChoicesOf(view)).toEqual([
      { id: '', label: 'Todos los trabajos', color: null },
      { id: 'w1', label: 'Base granular · 100 %', color: '#a16207' },
      { id: 'w2', label: 'Imprimación · 41,5 %', color: '#2563eb' },
    ]);
  });

  it('names the chosen one; an unknown id falls back to all', () => {
    expect(workChoiceLabel(view, 'w2')).toBe('Imprimación · 41,5 %');
    expect(workChoiceLabel(view, undefined)).toBe('Todos los trabajos');
    expect(workChoiceLabel(view, 'gone')).toBe('Todos los trabajos');
  });
});

describe('the legend', () => {
  it('each work, the stretch still to build and, only when something waits, «Por aprobar»', () => {
    // Act
    const quiet = mapLegendEntries(view, 0);
    const waiting = mapLegendEntries(view, 2);
    // Assert
    expect(quiet.map((entry) => entry.kind)).toEqual(['work', 'work', 'todo']);
    expect(quiet[2]).toEqual({ key: 'todo', kind: 'todo', label: 'Pendiente de ejecución', color: null });
    expect(waiting.at(-1)).toEqual({ key: 'waiting', kind: 'waiting', label: 'Por aprobar (2)', color: null });
    expect(mapLegendEntries(view, 1).at(-1)?.label).toBe('Por aprobar (1)');
  });
});
