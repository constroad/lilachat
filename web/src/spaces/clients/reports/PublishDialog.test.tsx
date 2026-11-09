import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldDocument } from '@lilachat/shared';
import { PublishDialog } from './PublishDialog';

/** José 09/11: Jeremy read «falta escantillón» as the photo; the line now opens the unit's data. */
const report = {
  id: 'r1', type: 'CTL-PIS', title: 'Control de pista', status: 'draft', forms: {},
  publish: { label: 'Publicar informe', missing: [], warnings: [] },
  sections: [{ kind: 'repeat', id: 'tramos', items: [{ id: 'd2', title: 'Unidad 2 · AXN780', sections: [{ id: 'datos', state: 'done' }] }] }],
} as unknown as FieldDocument;

describe('«Todavía falta» opens what each line names', () => {
  it('a line of a unit opens its data; one with no unit stays text', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<PublishDialog report={report} blockers={['Unidad 2 AXN780: falta escantillón.', 'Hay cambios sin enviar.']} onClose={vi.fn()} onPublish={vi.fn()} onOpen={onOpen} />);
    const [unit, queue] = screen.getAllByTestId('falta-publicar');
    // Act
    fireEvent.click(unit!.querySelector('button')!);
    // Assert
    expect(onOpen).toHaveBeenCalledWith({ sectionId: 'tramos', itemId: 'd2', key: 'datos' });
    expect(queue!.querySelector('button')).toBeNull();
  });
});
