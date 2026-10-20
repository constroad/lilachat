import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FranjaDeFijados } from './FranjaDeFijados';
import type { FijadoEnLista } from './types';

const fijado = (seq: number, body: string): FijadoEnLista => ({ seq, por: 'u1', en: '2026-10-19T10:00:00.000Z', hasta: '2099-01-01T00:00:00.000Z', vista: { senderId: 'u2', kind: 'text', body } });

describe('FranjaDeFijados (web)', () => {
  it('muestra el más reciente con su autor y el contador; tocar lleva al mensaje y pasa al siguiente', async () => {
    const onIr = vi.fn();
    render(<FranjaDeFijados fijados={[fijado(9, 'El sábado almorzamos'), fijado(4, 'Llevar torta')]} nombreDe={() => 'Mamá'} puedeDesfijar onIr={onIr} onDesfijar={vi.fn()} />);
    expect(screen.getByTestId('franja-fijados')).toHaveTextContent('Mamá');
    expect(screen.getByTestId('texto-fijado')).toHaveTextContent('El sábado almorzamos');
    expect(screen.getByTestId('contador-fijados')).toHaveTextContent('1 de 2');

    await userEvent.click(screen.getByTestId('btn-ir-fijado'));
    expect(onIr).toHaveBeenCalledWith(9);
    expect(screen.getByTestId('texto-fijado')).toHaveTextContent('Llevar torta');
  });

  it('el menú ofrece desfijar solo a quien puede', async () => {
    const onDesfijar = vi.fn();
    const { rerender } = render(<FranjaDeFijados fijados={[fijado(9, 'hola')]} nombreDe={() => 'Ana'} puedeDesfijar onIr={vi.fn()} onDesfijar={onDesfijar} />);
    screen.getByTestId('menu-fijado').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByTestId('accion-desfijar'));
    expect(onDesfijar).toHaveBeenCalledWith(9);

    rerender(<FranjaDeFijados fijados={[fijado(9, 'hola')]} nombreDe={() => 'Ana'} puedeDesfijar={false} onIr={vi.fn()} onDesfijar={onDesfijar} />);
    screen.getByTestId('menu-fijado').focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('accion-ir-fijado')).toBeInTheDocument();
    expect(screen.queryByTestId('accion-desfijar')).toBeNull();
  });

  it('sin fijados no ocupa lugar', () => {
    const { container } = render(<FranjaDeFijados fijados={[]} nombreDe={() => ''} puedeDesfijar onIr={vi.fn()} onDesfijar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FranjaDeFijados — ver todos (20/10)', () => {
  it('el menú ofrece la lista entera con la cantidad', async () => {
    const onVerTodos = vi.fn();
    render(<FranjaDeFijados fijados={[fijado(9, 'Uno'), fijado(4, 'Dos')]} nombreDe={() => 'Ana'} puedeDesfijar onIr={vi.fn()} onDesfijar={vi.fn()} onVerTodos={onVerTodos} />);
    screen.getByTestId('menu-fijado').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByTestId('accion-ver-fijados'));
    expect(onVerTodos).toHaveBeenCalled();
  });
});

describe('FranjaDeFijados — un fijado nuevo', () => {
  it('vuelve al principio para mostrar el recién fijado', async () => {
    const { rerender } = render(<FranjaDeFijados fijados={[fijado(9, 'Uno'), fijado(4, 'Dos')]} nombreDe={() => 'Ana'} puedeDesfijar onIr={vi.fn()} onDesfijar={vi.fn()} />);
    await userEvent.click(screen.getByTestId('btn-ir-fijado'));
    expect(screen.getByTestId('texto-fijado')).toHaveTextContent('Dos');
    rerender(<FranjaDeFijados fijados={[fijado(12, 'Nuevo'), fijado(9, 'Uno'), fijado(4, 'Dos')]} nombreDe={() => 'Ana'} puedeDesfijar onIr={vi.fn()} onDesfijar={vi.fn()} />);
    expect(screen.getByTestId('texto-fijado')).toHaveTextContent('Nuevo');
    expect(screen.getByTestId('contador-fijados')).toHaveTextContent('1 de 3');
  });
});
