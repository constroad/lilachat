import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty, FormValues } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/**
 * Andrea, via José 12/11: «Completar gasto» was slow (the clients, then the partidas) and the
 * partidas showed in a tiny space. agentes measured its side at 72–87 ms: the wait was ours.
 */
const services = Array.from({ length: 12 }, (_, index) => ({ const: `6a5503b40afd38abc67ff7${String(index).padStart(2, '0')}`, title: `Servicio ${index + 1}` }));
const properties: Record<string, FormSchemaProperty> = {
  deQue: { type: 'string', enum: ['proyecto', 'servicio'], title: '¿De qué es?', 'x-labels': { proyecto: 'Proyecto', servicio: 'Servicio' }, 'x-refresh': true },
  servicioId: { type: 'string', title: '¿De qué servicio?', oneOf: services, 'x-refresh': true, 'x-visible-if': { deQue: ['servicio'] } },
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', 'x-refresh': true },
};
const answer: EphemeralAnswer = { commandId: 'c1', appName: 'Caja', command: '', action: 'Completar gasto', state: 'form', response: { responseType: 'form', form: { id: 'completar_gasto', title: 'Completar gasto', schema: { type: 'object', properties } } } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const draw = (onRefresh: (draft: FormValues) => Promise<void>) => render(<AppFormDialog answer={answer} onSubmit={vi.fn()} onUpload={vi.fn()} onClose={vi.fn()} onRefresh={onRefresh} />);
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('«Completar gasto» on the web', () => {
  it('a pick asks for the form again at once, and the wait shows by the button', async () => {
    // Arrange
    let finish: () => void = () => undefined;
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    draw(onRefresh);
    // Act
    fireEvent.click(screen.getByTestId('opcion-deQue-servicio'));
    await tick(1);
    // Assert
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenLastCalledWith(expect.objectContaining({ deQue: 'servicio' }));
    expect(screen.getByTestId('formulario-actualizando')).toHaveTextContent('Actualizando las opciones…');
    expect(screen.getByTestId('btn-enviar-formulario').closest('.border-t')).toContainElement(screen.getByTestId('formulario-actualizando'));
    await act(async () => finish());
    expect(screen.queryByTestId('formulario-actualizando')).toBeNull();
  });

  it('typing the amount still waits until it settles', async () => {
    const onRefresh = vi.fn(async () => undefined);
    draw(onRefresh);
    fireEvent.change(screen.getByTestId('campo-monto'), { target: { value: '40' } });
    await tick(100);
    expect(onRefresh).not.toHaveBeenCalled();
    await tick(600);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a long list takes the wide dialog, and its panel opens inside the form, not cut by the scroll', () => {
    draw(vi.fn(async () => undefined));
    fireEvent.click(screen.getByTestId('opcion-deQue-servicio'));
    expect(screen.getByTestId('overlay').className).toContain('sm:max-w-2xl');
    fireEvent.click(screen.getByTestId('campo-servicioId'));
    const panel = screen.getByTestId('hoja-servicioId');
    expect(panel.className).not.toContain('absolute');
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(12);
  });
});

/** José 13/11: «debe permitir seleccionar varias partidas y ofrecer repartir el monto, debe ser inteligente». */
describe('the partidas split the amount by themselves', () => {
  const withPartidas: Record<string, FormSchemaProperty> = {
    monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', default: 500 },
    partidas: {
      type: 'array',
      title: 'Partidas',
      items: {
        type: 'object',
        required: ['partidaId'],
        properties: {
          partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra' } },
          monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
        },
      },
    },
  };
  const split: EphemeralAnswer = { ...answer, response: { responseType: 'form', form: { id: 'completar_gasto', title: 'Completar gasto', schema: { type: 'object', properties: withPartidas } } } };

  it('two ticked share it; typing one adjusts the other; «Partes iguales» starts over', () => {
    // Arrange
    render(<AppFormDialog answer={split} onSubmit={vi.fn()} onUpload={vi.fn()} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('opcion-partidas-mat'));
    fireEvent.click(screen.getByTestId('opcion-partidas-mo'));
    // Assert
    expect(screen.getByTestId('campo-partidas-0-monto')).toHaveValue('250');
    expect(screen.getByTestId('campo-partidas-1-monto')).toHaveValue('250');
    expect(screen.getByTestId('reparto-partidas')).toHaveTextContent('Asignado S/ 500.00 de S/ 500.00');
    fireEvent.change(screen.getByTestId('campo-partidas-0-monto'), { target: { value: '300' } });
    expect(screen.getByTestId('campo-partidas-1-monto')).toHaveValue('200');
    expect(screen.getByTestId('ajustado-partidas-mo')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('partes-iguales-partidas'));
    expect(screen.getByTestId('campo-partidas-0-monto')).toHaveValue('250');
  });
});

/** Design gst-02-completar-v2 (José 13/11 noche: «que asco… ¿te parece lo mejor que pudo hacer?»): the form as it was drawn. */
describe('«Completar gasto» as the design draws it', () => {
  const SERVICE_IDS = ['6a5b0dce293506d652e2ab05', '6a56726f1e86f1c14d14a1c6', '6a55427258cf0904ab6ca1d9'];
  const drawn: Record<string, FormSchemaProperty> = {
    destino: { type: 'string', enum: ['servicio', 'proyecto'], title: '¿Proyecto o servicio?', default: 'servicio', 'x-labels': { servicio: 'Servicio', proyecto: 'Proyecto' } },
    servicioId: { type: 'string', title: '¿De qué servicio?', enum: SERVICE_IDS, 'x-labels': { [SERVICE_IDS[0]!]: 'Renovación de pista', [SERVICE_IDS[1]!]: 'Obra Las Lomas', [SERVICE_IDS[2]!]: 'Bacheo' }, 'x-visible-if': { destino: ['servicio'] } },
    repartir: { type: 'string', title: 'Repartir', enum: ['una', 'iguales', 'segun', 'mano'], default: 'iguales', 'x-labels': { una: 'Una partida', iguales: 'Partes iguales', segun: 'Según partida', mano: 'A mano' }, 'x-visible-if': { destino: ['servicio'] } },
    partidas: {
      type: 'array',
      title: 'Partidas del servicio',
      'x-visible-if': { repartir: ['iguales', 'mano'] },
      items: { type: 'object', required: ['partidaId'], properties: { partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo', 'eq'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra', eq: 'Equipos' } }, monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' } } },
    },
    monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', default: 500 },
  };
  const voucher = { kicker: 'Gasto', figure: 'S/ 500.00', title: 'Ferretería El Constructor', status: { label: 'Por completar', tone: 'warn' as const }, fields: [{ label: 'Medio', value: 'Yape' }, { label: 'Operación', value: '04519957' }] };
  const designed: EphemeralAnswer = { ...answer, context: voucher, response: { responseType: 'form', form: { id: 'completar_gasto', title: 'Completar gasto', schema: { type: 'object', properties: drawn } } } };
  const drawForm = (given: EphemeralAnswer = designed) => render(<AppFormDialog answer={given} personName="José Zamora" onSubmit={vi.fn()} onUpload={vi.fn()} onClose={vi.fn()} />);

  it('the header says whose form it is, its title and who registers', () => {
    drawForm();
    const header = screen.getByTestId('formulario-cabecera');
    expect(header).toHaveTextContent('Caja');
    expect(header).toHaveTextContent('Completar gasto');
    expect(header).toHaveTextContent('Registra: José Zamora');
  });

  it('says the channel it was opened in, then who registers', () => {
    render(<AppFormDialog answer={designed} personName="José Zamora" where="#flujo-caja" onSubmit={vi.fn()} onUpload={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('formulario-cabecera')).toHaveTextContent('Canal #flujo-caja · Registra: José Zamora');
  });

  it('the card it was opened from stays above the fields: the figure, the shop, the state and what was read', () => {
    drawForm();
    const card = screen.getByTestId('formulario-contexto');
    expect(card).toHaveTextContent('S/ 500.00');
    expect(card).toHaveTextContent('Ferretería El Constructor');
    expect(card).toHaveTextContent('Por completar');
    expect(card).toHaveTextContent('Yape');
    expect(card).toHaveTextContent('04519957');
  });

  it('a form opened from nowhere has no card above it', () => {
    drawForm({ ...designed, context: undefined });
    expect(screen.queryByTestId('formulario-contexto')).toBeNull();
  });

  it('numbers the steps: what it goes to, which service and the partidas; the way to split is no step', () => {
    drawForm();
    expect(screen.getByTestId('paso-destino')).toHaveTextContent('1');
    expect(screen.getByTestId('paso-servicioId')).toHaveTextContent('2');
    expect(screen.getByTestId('paso-partidas')).toHaveTextContent('3');
    expect(screen.queryByTestId('paso-repartir')).toBeNull();
  });

  it('the way to split is a row of pills, and what it goes to are two big tiles', () => {
    drawForm();
    expect(screen.getByTestId('opcion-repartir-mano')).toHaveClass('rounded-full');
    expect(screen.getByTestId('opcion-destino-servicio')).toHaveClass('h-14', 'border-2');
  });

  it('the partidas are chips to tick; only a ticked one has its row, with its share of the total', () => {
    // Arrange
    drawForm();
    // Act
    fireEvent.click(screen.getByTestId('opcion-partidas-mat'));
    fireEvent.click(screen.getByTestId('opcion-partidas-mo'));
    // Assert
    expect(screen.getByTestId('fila-partidas-mat')).toHaveTextContent('50 %');
    expect(screen.getByTestId('fila-partidas-mo')).toHaveTextContent('50 %');
    expect(screen.queryByTestId('fila-partidas-eq')).toBeNull();
    expect(screen.getByTestId('opcion-partidas-eq')).toHaveAttribute('aria-checked', 'false');
  });

  it('says «100 % cuadrado» while the rows match the total, and not when they do not', () => {
    // Arrange
    drawForm();
    fireEvent.click(screen.getByTestId('opcion-partidas-mat'));
    fireEvent.click(screen.getByTestId('opcion-partidas-mo'));
    // Assert
    expect(screen.getByTestId('cuadrado-partidas')).toHaveTextContent('100 % cuadrado');
    // Act: 300 typed leaves 200 to the other, still matching; then a third ticked row moves nothing wrong.
    fireEvent.change(screen.getByTestId('campo-partidas-0-monto'), { target: { value: '300' } });
    expect(screen.getByTestId('cuadrado-partidas')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('campo-partidas-1-monto'), { target: { value: '100' } });
    expect(screen.queryByTestId('cuadrado-partidas')).toBeNull();
    expect(screen.getByTestId('reparto-partidas')).toHaveTextContent('Faltan S/ 100.00');
  });
});
