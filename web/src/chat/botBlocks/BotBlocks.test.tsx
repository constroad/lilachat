import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { validateBotCard } from '@lilachat/shared';
import { BotCardView } from '../BotCardView';
import { CardCommandContext } from './cardCommand';

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

describe('people on a card (José, 04/11: initials alone say nothing)', () => {
  const attendance = validateBotCard({
    kicker: 'ASISTENCIA',
    title: 'Vinieron',
    fields: [],
    blocks: [{ type: 'people', names: ['Jensen Castillo Ruiz', 'Darío Paredes'], more: 2 }],
    detail: { title: 'Asistencia de hoy', blocks: [{ type: 'people', names: ['Jensen Castillo Ruiz', 'Darío Paredes'], more: 2 }] },
  });

  it('writes the short name on the card and the whole name in its detail', () => {
    if (!attendance.ok) throw new Error(attendance.message);
    render(<BotCardView card={attendance.card} chatId="c" seq={1} jwt="j" />);
    const onCard = screen.getByTestId('bloque-personas').textContent;
    expect(onCard).toContain('Jensen C.');
    expect(onCard).toContain('Darío P.');
    expect(onCard).toContain('+2');
    expect(onCard).not.toContain('Castillo');
    fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
    const inDetail = screen.getByTestId('detalle-tarjeta').textContent;
    expect(inDetail).toContain('Jensen Castillo Ruiz');
    expect(inDetail).toContain('y 2 más');
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

describe('tapping a tank opens its detail (José, 24/10)', () => {
  it('a tank with a detail is a button that opens the big tank and its rows; one without stays still', () => {
    // Arrange
    const tank = { name: 'INFRA PEN #1', level: 0.84, min: 0.2, value: '84 cm', tone: 'ok' };
    const tanks = validateBotCard({ title: 'Tanques', fields: [], blocks: [{ type: 'tank', items: [{ ...tank, detail: { title: 'INFRA PEN #1', blocks: [{ type: 'tank', items: [tank] }, { type: 'rows', rows: [{ label: 'Disponible', value: '2589,1 gl' }] }] } }, { ...tank, name: 'INFRA PEN #2' }] }] });
    if (!tanks.ok) throw new Error(tanks.message);
    render(<BotCardView card={tanks.card} chatId="c" seq={1} jwt="j" />);
    // Act
    expect(screen.getByTestId('tanque-INFRA PEN #2')).toBeDisabled();
    fireEvent.click(screen.getByTestId('tanque-INFRA PEN #1'));
    // Assert
    expect(screen.getByTestId('detalle-tanque').textContent).toContain('Disponible2589,1 gl');
    expect(screen.getByTestId('detalle-tanque').querySelector('[data-testid="bloque-tanque"]')).not.toBeNull();
  });

  it('the change of a tank stands out, with its arrow (José, 04/11: «casi pasa desapercibido»)', () => {
    if (!card.ok) throw new Error(card.message);
    render(<BotCardView card={card.card} chatId="c" seq={1} jwt="j" />);
    const delta = screen.getByTestId('tanque-delta');
    expect(delta.textContent).toContain('−0,06 gl');
    expect(delta.querySelector('svg')).not.toBeNull();
  });

  it('each person shows their time on the card and in the detail (José, 04/11)', () => {
    const attendance = validateBotCard({
      title: 'Asistencia',
      fields: [],
      blocks: [{ type: 'people', names: ['Carlos Dario Paredes', 'Jensen Stewen'], times: ['07:12'] }],
      detail: { title: 'Detalle', blocks: [{ type: 'people', names: ['Carlos Dario Paredes', 'Jensen Stewen'], times: ['07:12'] }] },
    });
    if (!attendance.ok) throw new Error(attendance.message);
    render(<BotCardView card={attendance.card} chatId="c" seq={1} jwt="j" />);
    expect(screen.getByTestId('bloque-personas').textContent).toContain('07:12');
    fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
    expect(screen.getByTestId('detalle-tarjeta').textContent).toContain('Carlos Dario Paredes07:12');
  });

  describe('where they signed, and the photo (José, 04/11)', () => {
    const photo = 'https://inframaq.constroad.com/api/public/marca/abc?sig=1';
    const map = 'https://maps.google.com/?q=-12.02,-77.02';
    const people = { type: 'people', names: ['Carlos Dario Paredes', 'Jensen Stewen'], evidence: [{ photo, place: 'Planta Huachipa', map }] };
    const renderDetail = () => {
      const attendance = validateBotCard({ title: 'Asistencia', fields: [], blocks: [people], detail: { title: 'Detalle', blocks: [people] } });
      if (!attendance.ok) throw new Error(attendance.message);
      render(<BotCardView card={attendance.card} chatId="c" seq={1} jwt="j" />);
    };

    it('the card stays light: faces and names, no photo', () => {
      renderDetail();
      expect(screen.queryByRole('img', { name: 'Foto de Carlos Dario Paredes' })).toBeNull();
    });

    it('the detail shows the photo and the place, and the place opens the map', () => {
      renderDetail();
      fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
      expect(screen.getByRole('img', { name: 'Foto de Carlos Dario Paredes' })).toHaveAttribute('src', photo);
      expect(screen.getByRole('link', { name: 'Planta Huachipa' })).toHaveAttribute('href', map);
    });

    it('a photo that no longer loads falls back to the initials', () => {
      renderDetail();
      fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
      fireEvent.error(screen.getByRole('img', { name: 'Foto de Carlos Dario Paredes' }));
      expect(screen.queryByRole('img', { name: 'Foto de Carlos Dario Paredes' })).toBeNull();
      expect(screen.getByTestId('detalle-tarjeta').textContent).toContain('Carlos Dario Paredes');
    });
  });
});

describe('a row with a command (José, 05/11: «si toco un distrito no muestra el detalle»)', () => {
  const weather = validateBotCard({
    title: 'Clima de hoy',
    fields: [],
    blocks: [{ type: 'rows', rows: [{ label: 'Miraflores', value: '21°', command: '/clima hoy en Miraflores' }] }],
    detail: { title: 'Distritos', blocks: [{ type: 'rows', rows: [{ label: 'Ate', value: '24°', command: '/clima hoy en Ate' }, { label: 'Lurín', value: '22°' }] }] },
  });
  const renderCard = (run: ((line: string) => void) | null) => {
    if (!weather.ok) throw new Error(weather.message);
    render(<CardCommandContext.Provider value={run}><BotCardView card={weather.card} chatId="c" seq={1} jwt="j" /></CardCommandContext.Provider>);
  };

  it('on the card, tapping it runs the line', () => {
    // Arrange
    const run = vi.fn();
    renderCard(run);
    // Act
    fireEvent.click(screen.getByRole('button', { name: /Miraflores/ }));
    // Assert
    expect(run).toHaveBeenCalledWith('/clima hoy en Miraflores', 1);
  });

  it('in the detail, it closes first: the answer lands in the chat, behind it', () => {
    const run = vi.fn();
    renderCard(run);
    fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
    fireEvent.click(screen.getByRole('button', { name: /Ate/ }));
    expect(run).toHaveBeenCalledWith('/clima hoy en Ate', 1);
    expect(screen.queryByTestId('detalle-tarjeta')).toBeNull();
  });

  it('a row without a command is not a button', () => {
    renderCard(vi.fn());
    fireEvent.click(screen.getByTestId('tarjeta-ver-detalle'));
    expect(screen.getByText('Lurín').closest('button')).toBeNull();
  });

  it('where the answer could not be shown, the row stays still', () => {
    renderCard(null);
    expect(screen.getByText('Miraflores').closest('button')).toBeNull();
  });
});
