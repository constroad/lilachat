import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { validateBotCard } from '@lilachat/shared';
import { BotCardView } from '../BotCardView';

/** The card kit on the web (§118.4, designs r155-*): a drawn tank, bars, the update time and the detail. */
const card = validateBotCard({
  kicker: 'MEDIDA DE TANQUE',
  title: 'GRUPO WILSON',
  fields: [],
  updated_at: '2026-10-23T13:33:00.000Z',
  blocks: [
    { type: 'tank', items: [{ name: 'GRUPO WILSON', level: 0.81, min: 0.2, value: '81 cm', sub: '50 gl disponibles', delta: '−0,06 gl', tone: 'ok' }] },
    { type: 'chart', kind: 'bar-h', unit: 'm³', points: [{ label: 'INFRA PEN 2', value: 18, tone: 'error', note: 'Bajo' }] },
  ],
  detail: { title: 'Control de tanques', blocks: [{ type: 'rows', rows: [{ label: '08:33 · Darío Paredes', value: '−0,06 gl' }] }] },
});

describe('BotCardView with the kit', () => {
  it('draws the tank and the bars, says when it was updated, and opens the detail', () => {
    if (!card.ok) throw new Error(card.message);
    render(<BotCardView card={card.card} chatId="c" seq={1} jwt="j" />);
    expect(screen.getByRole('img', { name: 'GRUPO WILSON: 81 %' })).toBeInTheDocument();
    expect(screen.getByTestId('bloque-grafico-barras-h').textContent).toContain('18 m³');
    expect(screen.getByTestId('tarjeta-actualizada').textContent).toMatch(/^Actualizado /);
    fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
    expect(screen.getByTestId('detalle-tarjeta').textContent).toContain('08:33 · Darío Paredes');
  });
});
