import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PLACE_LINES } from '@lilachat/shared';
import { PlaceStatusWeb } from './PlaceStatusWeb';

describe('PlaceStatusWeb (José 19/11: the location loaded with no sign)', () => {
  it('while reading: a spinner and «Obteniendo ubicación…»', () => {
    // Act
    render(<PlaceStatusWeb reading={{ state: 'reading', required: true }} />);
    // Assert
    const line = screen.getByTestId('ubicacion-estado');
    expect(line).toHaveTextContent(PLACE_LINES.reading);
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('ubicacion-cargando')).toBeInTheDocument();
  });

  it('a failed reading the photo needs is an alert', () => {
    render(<PlaceStatusWeb reading={{ state: 'failed', required: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(PLACE_LINES.failedRequired);
  });

  it('a failed optional reading only warns', () => {
    render(<PlaceStatusWeb reading={{ state: 'failed', required: false }} />);
    expect(screen.getByTestId('ubicacion-estado')).toHaveTextContent(PLACE_LINES.failedOptional);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('nothing to read: nothing drawn', () => {
    const { container } = render(<PlaceStatusWeb reading={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
