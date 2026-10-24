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

describe('the weather block (pending 96, design e-33)', () => {
  const weather = validateBotCard({
    kicker: 'INFRAMAQ · CLIMA',
    title: 'Ate, Lima',
    fields: [],
    blocks: [{ type: 'weather', place: 'Ate', days: [
      { label: 'Hoy', icon: 'partly', max: 22, min: 16, temp: 19, summary: 'Parcialmente nublado', rain: 10, humidity: 78, wind: 12, risk: { label: 'Riesgo medio para asfaltar', tone: 'warn' }, hours: [{ at: '06:00', temp: 16, rain: 0, wind: 8 }, { at: '09:00', temp: 18, rain: 40, mm: 3.2, wind: 10 }] },
      { label: 'sáb', icon: 'rain', max: 20, min: 15, summary: 'Lluvia', rain: 70, risk: { label: 'Riesgo alto para asfaltar', tone: 'error' }, note: 'Tendencia', hours: [] },
    ] }],
  });

  it('shows the now with its facts and risk, switches the curve by tab, and a day changes the top', () => {
    // Arrange
    if (!weather.ok) throw new Error(weather.message);
    render(<BotCardView card={weather.card} chatId="c" seq={1} jwt="j" />);
    // Act + Assert
    expect(screen.getByTestId('clima-temperatura').textContent).toBe('19 °C');
    expect(screen.getByTestId('bloque-clima').textContent).toContain('Humedad 78 %');
    expect(screen.getByLabelText('Clima en Ate')).toBeInTheDocument();
    expect(screen.getByTestId('clima-riesgo').textContent).toBe('Riesgo medio para asfaltar');
    expect(screen.getByTestId('clima-curva').textContent).toBe('16°18°');
    fireEvent.click(screen.getByTestId('clima-pestana-rain'));
    expect(screen.getByTestId('clima-curva').textContent).toBe('0 %3,2 mm');
    fireEvent.click(screen.getByTestId('clima-dia-1'));
    expect(screen.getByTestId('clima-temperatura').textContent).toBe('20 °C');
    expect(screen.getByTestId('clima-riesgo').textContent).toBe('Riesgo alto para asfaltar');
    expect(screen.getByTestId('bloque-clima').textContent).toContain('Tendencia');
    expect(screen.queryByTestId('clima-curva')).toBeNull();
  });
});
