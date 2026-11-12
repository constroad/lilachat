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
