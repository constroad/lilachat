import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty, FormSubmitOutcome, FormValues } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/**
 * agentes 13/11: one form for «Completar» and «Corregir datos» — «Revisar gasto». The data read from the voucher
 * hide under a header the person opens, two buttons say what happens, and «Según partida» shares by weight.
 */
const partidas = (extra: Record<string, unknown> = {}): FormSchemaProperty => ({
  type: 'array',
  title: 'Partidas',
  items: {
    type: 'object',
    required: ['partidaId', 'monto'],
    properties: {
      partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra' } },
      monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
    },
  },
  'x-split': { weights: { mat: 60, mo: 40 }, modeField: 'reparto', weightedValue: 'Según partida' },
  ...extra,
});
const fold = { 'x-section': 'Corregir datos', 'x-collapsed': true };
const baseProperties = (): Record<string, FormSchemaProperty> => ({
  reparto: { type: 'string', title: 'Cómo repartir', enum: ['Una partida', 'Partes iguales', 'Según partida', 'A mano'], default: 'Partes iguales' },
  partidas: partidas(),
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', default: 100, ...fold },
  nota: { type: 'string', title: 'Nota', maxLength: 40, ...fold },
});
const SUBMITS = [{ id: 'registrar', label: 'Registrar gasto' }, { id: 'borrador', label: 'Guardar borrador' }];
const review = (properties: Record<string, FormSchemaProperty> = baseProperties(), required: string[] = ['monto'], submits: typeof SUBMITS | null = SUBMITS): EphemeralAnswer => ({
  commandId: 'c1',
  appName: 'Caja',
  command: '',
  action: 'Revisar gasto',
  state: 'form',
  response: { responseType: 'form', form: { id: 'revisar_gasto', title: 'Revisar gasto', submitLabel: 'Registrar gasto', ...(submits ? { submits } : {}), schema: { type: 'object', properties, required } } },
});
const draw = (answer: EphemeralAnswer, onSubmit: (values: FormValues) => Promise<FormSubmitOutcome> = vi.fn(async () => ({ done: true }) as FormSubmitOutcome)) => {
  render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} />);
  return onSubmit;
};
const press = async (testId: string) => act(async () => { fireEvent.click(screen.getByTestId(testId)); });
const HEADER = 'seccion-corregir-datos-cabecera';

describe('«Corregir datos» is a header the person opens', () => {
  it('starts folded while what the voucher gave is filled; a tap opens it and shows the fields', () => {
    draw(review());
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('campo-monto')).toBeNull();
    fireEvent.click(screen.getByTestId(HEADER));
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('campo-monto')).toHaveValue(100);
    fireEvent.click(screen.getByTestId(HEADER));
    expect(screen.queryByTestId('campo-monto')).toBeNull();
  });

  it('starts open when a required field inside is blank: the voucher did not give the amount', () => {
    const properties = baseProperties();
    delete properties.monto!.default;
    draw(review(properties));
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('campo-monto')).toHaveValue(null);
  });

  it('opens by itself when the app refuses a field inside, and says why under it', async () => {
    const onSubmit = draw(review(), vi.fn(async () => ({ done: false, errors: { monto: 'Ese monto ya está registrado.' } }) as FormSubmitOutcome));
    expect(screen.queryByTestId('campo-monto')).toBeNull();
    await press('btn-enviar-formulario');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Ese monto ya está registrado.')).toBeInTheDocument();
  });

  it('the fields of the form that are not under the header stay in view', () => {
    draw(review());
    expect(screen.getByTestId('opcion-reparto-Según partida')).toBeInTheDocument();
    expect(screen.getByTestId('opcion-partidas-mat')).toBeInTheDocument();
  });
});

describe('two buttons: «Registrar gasto» and «Guardar borrador»', () => {
  it('shows the big one with its label and the other under it', () => {
    draw(review());
    expect(screen.getByTestId('btn-enviar-formulario')).toHaveTextContent('Registrar gasto');
    expect(screen.getByTestId('btn-enviar-formulario-borrador')).toHaveTextContent('Guardar borrador');
  });

  it('the big one sends «registrar» with what is filled', async () => {
    const onSubmit = draw(review());
    await press('btn-enviar-formulario');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ monto: 100, _accion: 'registrar' }));
  });

  it('«registrar» with the amount missing is refused before leaving, and the header opens to show it', async () => {
    const properties = baseProperties();
    delete properties.monto!.default;
    const onSubmit = draw(review(properties));
    fireEvent.click(screen.getByTestId(HEADER));
    await press('btn-enviar-formulario');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('formulario-revisar_gasto')).toHaveTextContent(/Escribe un número|Falta/);
  });

  it('«Guardar borrador» saves what is filled though the amount is missing, and says it is a draft', async () => {
    const properties = baseProperties();
    delete properties.monto!.default;
    const onSubmit = draw(review(properties));
    await press('btn-enviar-formulario-borrador');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = (onSubmit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as FormValues;
    expect(sent._accion).toBe('borrador');
    expect(sent).not.toHaveProperty('monto');
  });

  it('a form without buttons sends no `_accion` and shows one button', async () => {
    const onSubmit = draw(review(baseProperties(), ['monto'], null));
    expect(screen.queryByTestId('btn-enviar-formulario-borrador')).toBeNull();
    await press('btn-enviar-formulario');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((onSubmit as ReturnType<typeof vi.fn>).mock.calls[0]![0]).not.toHaveProperty('_accion');
  });
});

describe('«Según partida» shares by the weight of each partida', () => {
  const amounts = () => [screen.getByTestId('campo-partidas-0-monto'), screen.getByTestId('campo-partidas-1-monto')].map((input) => (input as HTMLInputElement).value);
  const tick = () => {
    fireEvent.click(screen.getByTestId('opcion-partidas-mat'));
    fireEvent.click(screen.getByTestId('opcion-partidas-mo'));
  };

  it('picking the mode shares 100 as 60 and 40; equal shares and «A mano» start from halves', () => {
    const properties = baseProperties();
    draw(review(properties));
    tick();
    expect(amounts()).toEqual(['50', '50']);
    fireEvent.click(screen.getByTestId('opcion-reparto-Según partida'));
    expect(amounts()).toEqual(['60', '40']);
    fireEvent.click(screen.getByTestId('opcion-reparto-Partes iguales'));
    expect(amounts()).toEqual(['50', '50']);
  });

  it('a typed amount stays and the other takes what is left, whatever its weight', () => {
    const properties = baseProperties();
    properties.reparto!.default = 'Según partida';
    draw(review(properties));
    tick();
    fireEvent.change(screen.getByTestId('campo-partidas-0-monto'), { target: { value: '90' } });
    expect(amounts()).toEqual(['90', '10']);
  });

  it('changing the mode lets go of what was typed', () => {
    const properties = baseProperties();
    properties.reparto!.default = 'A mano';
    draw(review(properties));
    tick();
    fireEvent.change(screen.getByTestId('campo-partidas-0-monto'), { target: { value: '90' } });
    expect(amounts()).toEqual(['90', '10']);
    fireEvent.click(screen.getByTestId('opcion-reparto-Según partida'));
    expect(amounts()).toEqual(['60', '40']);
  });

  it('the button over the banner starts over the form\'s own way: by weight in «Según partida», halves otherwise', () => {
    const properties = baseProperties();
    properties.reparto!.default = 'Según partida';
    draw(review(properties));
    tick();
    expect(screen.getByTestId('partes-iguales-partidas')).toHaveTextContent('Según partida');
    fireEvent.change(screen.getByTestId('campo-partidas-0-monto'), { target: { value: '90' } });
    fireEvent.click(screen.getByTestId('partes-iguales-partidas'));
    expect(amounts()).toEqual(['60', '40']);
    fireEvent.click(screen.getByTestId('opcion-reparto-Partes iguales'));
    expect(screen.getByTestId('partes-iguales-partidas')).toHaveTextContent('Partes iguales');
  });

  it('the rows the app sent that already add up stay as they came (its card wins by the cent)', () => {
    const properties = baseProperties();
    properties.reparto!.default = 'Según partida';
    properties.partidas = partidas({ default: [{ partidaId: 'mat', monto: 70 }, { partidaId: 'mo', monto: 30 }] });
    draw(review(properties));
    expect(amounts()).toEqual(['70', '30']);
  });

  it('rows the app sent without amounts are filled by weight when the form opens', () => {
    const properties = baseProperties();
    properties.reparto!.default = 'Según partida';
    properties.partidas = partidas({ default: [{ partidaId: 'mat' }, { partidaId: 'mo' }] });
    draw(review(properties));
    expect(amounts()).toEqual(['60', '40']);
  });
});

describe('«Revisar gasto» is one form from its first step (agentes 13/11)', () => {
  /** The first mode: one partida, no list of ticks yet; only the folded «Corregir datos» says it is the designed form. */
  const onePartida = (): Record<string, FormSchemaProperty> => ({
    reparto: { type: 'string', title: 'Repartir', enum: ['Una partida', 'Partes iguales', 'Según partida', 'A mano'], default: 'Una partida' },
    partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra' } },
    monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', default: 100, ...fold },
  });

  it('wears the design with one partida too: the look does not jump when the person picks another way to split', () => {
    draw(review(onePartida(), ['monto']));
    expect(screen.getByTestId('formulario-cabecera')).toHaveTextContent('Revisar gasto');
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'false');
  });

  it('a form without sections and without a list keeps the plain look', () => {
    const plain = { monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', default: 100 } } as Record<string, FormSchemaProperty>;
    draw(review(plain, ['monto'], null));
    expect(screen.queryByTestId('formulario-cabecera')).toBeNull();
  });
});

describe('the app\'s live remarks wait for what the person fills (José 13/11)', () => {
  const withPreview = (reply: Record<string, string>): { onPreview: ReturnType<typeof vi.fn> } => {
    const answer = review();
    if (answer.response.responseType === 'form') answer.response.form.preview = 'revisar_gasto_preview';
    const onPreview = vi.fn(async () => ({ blocks: [], errors: reply }));
    render(<AppFormDialog answer={answer} onSubmit={vi.fn(async () => ({ done: true }) as FormSubmitOutcome)} onUpload={vi.fn()} onClose={vi.fn()} onPreview={onPreview} />);
    return { onPreview };
  };

  it('«Elige al menos una partida» does not stand in red before a partida is picked', async () => {
    const { onPreview } = withPreview({ partidas: 'Elige al menos una partida.' });
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(screen.queryByText('Elige al menos una partida.')).toBeNull();
  });

  it('a remark about what is filled shows, and opens the folded section it sits in', async () => {
    const { onPreview } = withPreview({ monto: 'Ese monto ya está registrado.' });
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    expect(await screen.findByText('Ese monto ya está registrado.')).toBeInTheDocument();
    expect(screen.getByTestId(HEADER)).toHaveAttribute('aria-expanded', 'true');
  });
});
