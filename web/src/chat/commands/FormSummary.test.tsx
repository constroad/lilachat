import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormSummary } from './FormSummary';

/** Wilson 02/11: «el resumen tapa casi todo». */
describe('FormSummary', () => {
  it('starts folded in one line and opens on a click', () => {
    // Arrange
    render(<FormSummary blocks={[{ type: 'metric', value: '11,48', unit: 'gl/m³', tone: 'neutral' }, { type: 'text', text: 'Falta un tanque con inicio y fin.', tone: 'warn' }]} />);
    // Assert: folded
    expect(screen.getByTestId('formulario-resumen-abrir')).toHaveTextContent('Resumen · 11,48 gl/m³ · 1 aviso');
    expect(screen.queryByText('Falta un tanque con inicio y fin.')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('formulario-resumen-abrir'));
    // Assert: open
    expect(screen.getByText('Falta un tanque con inicio y fin.')).toBeInTheDocument();
  });
});
