import { describe, expect, it } from 'vitest';
import { formFields, visibleFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { formRows } from './appFormRows.js';

const formWith = (properties: Record<string, FormSchemaProperty>): AppForm => ({ id: 'f', title: 'F', schema: { type: 'object', properties } });
/** The rows as field names: `[['monto', 'fecha'], ['descripcion']]`. */
const rowsOf = (form: AppForm, values: Record<string, unknown> = {}) => formRows(visibleFields(formFields(form), values)).map((row) => row.map((field) => field.name));

/** Portal's `registrar_gasto` as it is declared today (28/10). */
const expense = formWith({
  deQue: { type: 'string', enum: ['proyecto', 'servicio'], title: '¿De qué es?' },
  proyectoId: { type: 'string', title: 'Proyecto', enum: ['6a5503b40afd38abc67ff7a9'], 'x-visible-if': { deQue: ['proyecto'] } },
  servicioId: { type: 'string', title: 'Servicio', enum: ['6a5503b40afd38abc67ff7aa'], 'x-visible-if': { deQue: ['servicio'] } },
  monto: { type: 'number', title: 'Monto', exclusiveMinimum: 0, 'x-unit': 'S/' },
  fecha: { type: 'string', format: 'date', title: 'Fecha' },
  descripcion: { type: 'string', title: 'Descripción', maxLength: 300 },
  estado: { type: 'string', enum: ['pagado', 'por_pagar'], title: 'Estado' },
  fotos: { type: 'array', items: { type: 'string' }, 'x-input': 'photo', title: 'Comprobante' },
  nota: { type: 'string', title: 'Nota', maxLength: 300 },
});

describe('two short fields share a row (José, 28/10: «unidad, hora, m³ podrían ser una sola fila»)', () => {
  it('a number beside a day goes in one row; choices, long texts and photos keep theirs', () => {
    // Arrange
    const values = { deQue: 'proyecto' };
    // Act
    const rows = rowsOf(expense, values);
    // Assert
    expect(rows).toEqual([['deQue'], ['proyectoId'], ['monto', 'fecha'], ['descripcion'], ['estado'], ['fotos'], ['nota']]);
  });

  it('a day beside an hour, an hour beside a number; the third short one starts the next row', () => {
    // Arrange
    const order = formWith({
      fecha: { type: 'string', format: 'date', title: 'Fecha' },
      hora: { type: 'string', format: 'time', title: 'Hora de inicio' },
      m3: { type: 'number', title: 'm³ del pedido', 'x-unit': 'm³' },
    });
    // Act
    const rows = rowsOf(order);
    // Assert
    expect(rows).toEqual([['fecha', 'hora'], ['m3']]);
  });

  it('a one-line text up to 60 is short (a plate, a carrier); a text of 61, a code, a PIN and a day with its hour are not', () => {
    // Arrange
    const form = formWith({
      placa: { type: 'string', title: 'Placa', maxLength: 10 },
      lote: { type: 'string', title: 'Lote', maxLength: 20 },
      codigo: { type: 'string', title: 'Código', pattern: '^\\d{6}$' },
      pin: { type: 'string', title: 'PIN', 'x-input': 'pin' },
      cuando: { type: 'string', format: 'date-time', title: 'Cuándo' },
      direccion: { type: 'string', title: 'Dirección', maxLength: 61 },
      fletero: { type: 'string', title: 'Fletero o placa', maxLength: 60 },
      cubos: { type: 'number', title: 'Cubos' },
    });
    // Act
    const rows = rowsOf(form);
    // Assert
    expect(rows).toEqual([['placa', 'lote'], ['codigo'], ['pin'], ['cuando'], ['direccion'], ['fletero', 'cubos']]);
  });

  it('the app decides with x-width: «half» puts a short choice or text beside another, «full» keeps a number alone', () => {
    // Arrange
    const reception = formWith({
      fletero: { type: 'string', title: 'Fletero o placa', maxLength: 60, 'x-width': 'half' },
      m3: { type: 'number', title: 'Cubos', 'x-unit': 'm³' },
      fecha: { type: 'string', format: 'date', title: 'Fecha', 'x-width': 'full' },
      hora: { type: 'string', format: 'time', title: 'Hora' },
      sedeId: { type: 'string', title: 'Sede', enum: ['6a5503b40afd38abc67ff7ab'], 'x-width': 'half' },
    });
    // Act
    const rows = rowsOf(reception);
    // Assert
    expect(rows).toEqual([['fletero', 'm3'], ['fecha'], ['hora', 'sedeId']]);
  });

  it('«half» cannot squeeze what needs the whole row: a list, a map, a photo, a long text or a day with its hour', () => {
    // Arrange
    const half = { 'x-width': 'half' } as const;
    const form = formWith({
      lista: { type: 'array', title: 'Carros', items: { type: 'object', properties: { carros: { type: 'integer' } } }, ...half },
      donde: { type: 'object', 'x-input': 'location', title: 'Ubicación', ...half },
      fotos: { type: 'array', items: { type: 'string' }, 'x-input': 'photo', title: 'Fotos', ...half },
      selfie: { type: 'string', 'x-input': 'photo', title: 'Foto', ...half },
      nota: { type: 'string', title: 'Nota', maxLength: 300, ...half },
      cuando: { type: 'string', format: 'date-time', title: 'Cuándo', ...half },
      monto: { type: 'number', title: 'Monto' },
    });
    // Act
    const rows = rowsOf(form);
    // Assert
    expect(rows).toEqual([['lista'], ['donde'], ['fotos'], ['selfie'], ['nota'], ['cuando'], ['monto']]);
  });

  it('pairs what is SHOWN: a hidden field between two short ones does not keep them apart', () => {
    // Arrange
    const form = formWith({
      tipo: { type: 'string', enum: ['ingreso', 'ajuste'], title: 'Tipo' },
      cantidad: { type: 'number', title: 'Cantidad' },
      motivo: { type: 'string', title: 'Motivo', maxLength: 200, 'x-visible-if': { tipo: ['ajuste'] } },
      fecha: { type: 'string', format: 'date', title: 'Fecha' },
    });
    // Act
    const hidden = rowsOf(form, { tipo: 'ingreso' });
    const shown = rowsOf(form, { tipo: 'ajuste' });
    // Assert
    expect(hidden).toEqual([['tipo'], ['cantidad', 'fecha']]);
    expect(shown).toEqual([['tipo'], ['cantidad'], ['motivo'], ['fecha']]);
  });

  it('an unknown x-width is ignored, and no fields give no rows', () => {
    // Arrange
    const form = formWith({ monto: { type: 'number', title: 'Monto', 'x-width': 'third' as 'half' }, fecha: { type: 'string', format: 'date' } });
    // Act
    const rows = rowsOf(form);
    const none = formRows([]);
    // Assert
    expect(rows).toEqual([['monto', 'fecha']]);
    expect(none).toEqual([]);
  });

  it('inside a product card the quantity and the price share a row (crear_cotizacion)', () => {
    // Arrange
    const quote = formWith({
      items: {
        type: 'array',
        title: 'Productos',
        items: { type: 'object', properties: { productoId: { type: 'string', title: 'Producto', enum: ['6a5503b40afd38abc67ff7ac'] }, cantidad: { type: 'number', title: 'Cantidad' }, precio: { type: 'number', title: 'Precio unitario', 'x-unit': 'S/' } } },
      },
    });
    const items = formFields(quote)[0];
    // Act
    const rows = items.kind === 'list' ? formRows(items.fields).map((row) => row.map((field) => field.name)) : [];
    // Assert
    expect(rows).toEqual([['productoId'], ['cantidad', 'precio']]);
  });
});
