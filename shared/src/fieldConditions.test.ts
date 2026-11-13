import { describe, expect, it } from 'vitest';
import { formFields, type AppForm } from './appForms.js';
import { conditionKindsOf, conditionValues, shiftOf, weatherLabelOf } from './fieldConditions.js';

/**
 * José 12/11, on CTL-PIS «Información de control»: the shift and the weather should come by themselves
 * (at 7 am, morning; the weather of where the engineer stands), and the stretch is the street under the GPS.
 */
const controlForm = (extra: Record<string, unknown> = {}): AppForm => ({
  id: 'guardar_seccion_de_informe',
  title: 'Información de control',
  schema: {
    type: 'object',
    properties: {
      tramo: { type: 'string', title: 'Tramo', maxLength: 200 },
      frente: { type: 'string', title: 'Frente', maxLength: 200 },
      turno: { type: 'string', title: 'Turno', maxLength: 200 },
      clima: { type: 'string', title: 'Clima', maxLength: 200 },
      ...extra,
    },
    required: ['tramo'],
  },
});
const at = (hour: number) => new Date(2026, 10, 12, hour, 5);

describe('shiftOf', () => {
  it('reads the hour of the phone: morning from 5, afternoon from 12, night from 18', () => {
    expect([4, 5, 7, 11, 12, 17, 18, 23].map((hour) => shiftOf(at(hour)))).toEqual(['Noche', 'Mañana', 'Mañana', 'Mañana', 'Tarde', 'Tarde', 'Noche', 'Noche']);
  });
});

describe('weatherLabelOf', () => {
  it('says the sky in words with the temperature, and an unknown code only the temperature', () => {
    expect(weatherLabelOf(0, 24.6)).toBe('Despejado · 25 °C');
    expect(weatherLabelOf(3, 18)).toBe('Nublado · 18 °C');
    expect(weatherLabelOf(61)).toBe('Lluvia');
    expect(weatherLabelOf(45, 16.2)).toBe('Neblina · 16 °C');
    expect(weatherLabelOf(999, 20)).toBe('20 °C');
  });
});

describe('conditionValues', () => {
  it('finds turno, clima and tramo by name, or by the x-input the app declares', () => {
    // Act
    const byName = conditionKindsOf(formFields(controlForm()));
    const declared = conditionKindsOf(formFields(controlForm({ cuadrilla: { type: 'string', title: 'Turno de la cuadrilla', 'x-input': 'shift' } })));
    // Assert
    expect(byName).toEqual({ tramo: 'street', turno: 'shift', clima: 'weather' });
    expect(declared.cuadrilla).toBe('shift');
  });

  it('fills only the empty ones: the shift at once, the street and the weather when they arrive', () => {
    // Arrange
    const fields = formFields(controlForm());
    // Act
    const atOnce = conditionValues(fields, {}, { now: at(7), conditions: null });
    const arrived = conditionValues(fields, { tramo: 'Km 12+300' }, { now: at(7), conditions: { street: 'Av. Los Incas, Ate', weather: 'Nublado · 18 °C' } });
    // Assert
    expect(atOnce).toEqual({ turno: 'Mañana' });
    expect(arrived).toEqual({ turno: 'Mañana', clima: 'Nublado · 18 °C' });
  });

  it('a choice takes the option that names it, and none when nothing matches', () => {
    // Arrange
    const fields = formFields(controlForm({ turno: { type: 'string', title: 'Turno', enum: ['manana', 'tarde', 'noche'], 'x-labels': { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' } }, clima: { type: 'string', title: 'Clima', enum: ['Soleado', 'Lluvioso'] } }));
    // Act
    const filled = conditionValues(fields, {}, { now: at(14), conditions: { street: null, weather: 'Nublado · 18 °C' } });
    // Assert
    expect(filled).toEqual({ turno: 'tarde' });
  });
});
