import { describe, expect, it } from 'vitest';
import { validateBotBlocks } from './botBlocks.js';
import { dayTemperature, hourLabel, pointLabel, validateWeatherBlock, weatherCurve, weatherFacts, type WeatherHour } from './weatherBlock.js';

/** /clima like Google's, by hours (pending 96, design e-33; contract with agentes 24/10). */
const today = {
  label: 'Hoy', icon: 'partly', max: 22, min: 16, temp: 19, summary: 'Parcialmente nublado', rain: 10, humidity: 78, wind: 12,
  risk: { label: 'Riesgo medio para asfaltar', tone: 'warn' },
  hours: [{ at: '06:00', temp: 16, rain: 0, wind: 8 }, { at: '09:00', temp: 18, rain: 40, mm: 3.25, wind: 10 }, { at: '12:00', temp: 22, rain: 20, wind: 14 }],
};

describe('the weather block an app sends', () => {
  it('keeps the days with their now, hours, risk and note', () => {
    // Arrange
    const raw = { type: 'weather', place: 'Ate', days: [today, { label: 'sáb', icon: 'rain', max: 20, min: 15, mm: 4, note: 'Tendencia', risk: { label: 'Riesgo alto', tone: 'error' } }] };
    // Act
    const result = validateWeatherBlock(raw);
    // Assert
    expect(result.ok && result.value).toEqual({
      type: 'weather', place: 'Ate',
      days: [
        { label: 'Hoy', icon: 'partly', max: 22, min: 16, temp: 19, summary: 'Parcialmente nublado', rain: 10, humidity: 78, wind: 12, risk: { label: 'Riesgo medio para asfaltar', tone: 'warn' }, hours: today.hours },
        { label: 'sáb', icon: 'rain', max: 20, min: 15, mm: 4, risk: { label: 'Riesgo alto', tone: 'error' }, note: 'Tendencia', hours: [] },
      ],
    });
  });

  it('never invents a number: missing stays missing, odd values are bounded, a bad hour or icon is dropped or defaulted', () => {
    const result = validateWeatherBlock({ days: [{ label: 'Hoy', icon: 'tornado', rain: 140, wind: -3, temp: 'x', hours: [{ at: '25:00', temp: 3 }, { at: '15:00' }] }, { label: 'dom', temp: 30 }] });
    expect(result.ok && result.value.days[0]).toEqual({ label: 'Hoy', icon: 'cloud', rain: 100, wind: 0, hours: [{ at: '15:00' }] });
    // Only today carries the temperature of now.
    expect(result.ok && result.value.days[1]).toEqual({ label: 'dom', icon: 'cloud', hours: [] });
  });

  it('caps at 8 days and 12 hours; without a labeled day it is refused; the kit takes it like any block', () => {
    const many = validateWeatherBlock({ days: Array.from({ length: 10 }, (_, index) => ({ label: `d${index}`, hours: Array.from({ length: 20 }, (_, hour) => ({ at: `${String(hour).padStart(2, '0')}:00`, temp: hour })) })) });
    expect(many.ok && many.value.days.length).toBe(8);
    expect(many.ok && many.value.days[0]!.hours.length).toBe(12);
    expect(validateWeatherBlock({ days: [{ icon: 'sun' }] }).ok).toBe(false);
    expect(validateBotBlocks([{ type: 'weather', days: [today] }, { type: 'text', text: 'Ate · Lluvia 3 mm' }], 8)).toMatchObject({ ok: true, blocks: [{ type: 'weather' }, { type: 'text' }] });
  });
});

describe('drawing it', () => {
  const hours: WeatherHour[] = today.hours;

  it('labels hours like Google and points per tab; rain shows millimeters when it rains', () => {
    expect(['00:00', '06:00', '12:00', '15:00', '21:30'].map(hourLabel)).toEqual(['12 a. m.', '6 a. m.', '12 p. m.', '3 p. m.', '9:30 p. m.']);
    expect(hours.map((hour) => pointLabel(hour, 'temp'))).toEqual(['16°', '18°', '22°']);
    expect(hours.map((hour) => pointLabel(hour, 'rain'))).toEqual(['0 %', '3,3 mm', '20 %']);
    expect(pointLabel({ at: '03:00' }, 'wind')).toBe('');
  });

  it('fits temperature to its range and starts rain at zero; the hottest point is on top', () => {
    // Act
    const temp = weatherCurve(hours, 'temp', 200, 100, 20);
    const rain = weatherCurve(hours, 'rain', 200, 100, 20);
    // Assert
    expect(temp.points.map((point) => [point.x, point.y])).toEqual([[0, 100], [100, 73], [200, 20]]);
    expect(rain.points.map((point) => point.y)).toEqual([100, 20, 60]);
    expect(temp.line).toBe('M0,100 L100,73 L200,20');
    expect(temp.area).toBe('M0,100 L100,73 L200,20 L200,100 L0,100 Z');
  });

  it('skips a missing hour without dropping to zero, and draws nothing without data or room', () => {
    const gap = weatherCurve([{ at: '06:00', wind: 10 }, { at: '09:00' }, { at: '12:00', wind: 20 }], 'wind', 100, 50, 10);
    expect(gap.points.map((point) => point.index)).toEqual([0, 2]);
    expect(weatherCurve([{ at: '06:00' }], 'temp', 100, 50, 10).points).toEqual([]);
    expect(weatherCurve(hours, 'temp', 0, 50, 10).line).toBe('');
  });

  it('the big number is now or the maximum; the facts list only what came', () => {
    expect(dayTemperature({ label: 'Hoy', icon: 'sun', temp: 19, max: 22, hours: [] })).toBe(19);
    expect(dayTemperature({ label: 'sáb', icon: 'sun', max: 22, hours: [] })).toBe(22);
    expect(weatherFacts({ label: 'Hoy', icon: 'sun', rain: 40, mm: 3.2, wind: 12, hours: [] })).toEqual([{ label: 'Prob. de precipitaciones', value: '40 % · 3,2 mm' }, { label: 'Viento', value: '12 km/h' }]);
  });
});
