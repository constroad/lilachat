import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** Cubicar volquete in the bolt (José 13/11, design pla-02): the dump body's shape is picked by its drawing. */
const FIGURES = 'https://portal.constroad.com/img/cubicar';
const shape = (value: string, title: string) => ({ const: value, title, 'x-thumb': `${FIGURES}/volquete-${value}.png`, 'x-photos': [`${FIGURES}/volquete-${value}.png`] });
const forma = (extra: Partial<FormSchemaProperty> = {}): FormSchemaProperty => ({ type: 'string', title: 'Forma de la tolva', 'x-cards': true, oneOf: [shape('cuadrado', 'Cuadrado'), shape('concavo', 'Cóncavo')], ...extra });
const answerWith = (property: FormSchemaProperty): EphemeralAnswer => ({
  commandId: 'c1', appName: 'Inframaq', command: '', action: 'Cubicar volquete', state: 'form',
  response: { responseType: 'form', form: { id: 'cubicar_volquete', title: 'Cubicar volquete', schema: { type: 'object', properties: { forma: property, ancho: { type: 'number', title: 'A1 Ancho', 'x-unit': 'm' } }, required: ['forma'] } } },
});
const draw = (property: FormSchemaProperty) => render(<AppFormDialog answer={answerWith(property)} onSubmit={vi.fn()} onUpload={vi.fn()} onClose={vi.fn()} />);

describe('picture cards in a bolt form on the web', () => {
  it('draws the shapes as cards with their drawing, none picked and no figure yet', () => {
    // Arrange / Act
    draw(forma());
    // Assert
    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    expect(screen.getByTestId('opcion-forma-concavo').querySelector('img')).toHaveAttribute('src', `${FIGURES}/volquete-concavo.png`);
    expect(screen.queryByTestId('figura-forma')).toBeNull();
  });
  it('one tap picks the shape and shows its figure big below the cards', () => {
    // Arrange
    draw(forma());
    // Act
    fireEvent.click(screen.getByTestId('opcion-forma-concavo'));
    // Assert
    expect(screen.getByTestId('opcion-forma-concavo')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('opcion-forma-cuadrado')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('figura-forma').querySelector('img')).toHaveAttribute('src', `${FIGURES}/volquete-concavo.png`);
  });
  it('the default starts picked, with its figure', () => {
    draw(forma({ default: 'cuadrado' }));
    expect(screen.getByTestId('opcion-forma-cuadrado')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('figura-forma')).toBeInTheDocument();
  });
  it('without x-cards the same options keep the list that opens with «Elige…»', () => {
    draw(forma({ 'x-cards': undefined }));
    expect(screen.queryByTestId('tarjetas-forma')).toBeNull();
    expect(screen.getByTestId('campo-forma')).toHaveTextContent('Elige…');
  });
});
