import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EnviarArchivos } from './EnviarArchivos';

const voucher = () => new File(['voucher'], 'voucher.png', { type: 'image/png' });

describe('EnviarArchivos: the caption is where the keyboard lands (José, 04/11)', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:voucher');
    URL.revokeObjectURL = vi.fn();
  });

  it('opens with the cursor in the caption, even when the composer had the focus', () => {
    render(<textarea data-testid="input-mensaje" autoFocus />);
    expect(document.activeElement).toBe(screen.getByTestId('input-mensaje'));

    render(<EnviarArchivos archivos={[voucher()]} onCerrar={() => undefined} onEnviar={() => undefined} />);

    expect(document.activeElement).toBe(screen.getByTestId('input-pie'));
  });

  it('what is typed right after pasting goes to the caption and leaves with the file', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const file = voucher();
    render(<EnviarArchivos archivos={[file]} onCerrar={() => undefined} onEnviar={send} />);

    await user.keyboard('/gastos pago parcial');
    await user.click(screen.getByTestId('btn-enviar-archivos'));

    expect(send).toHaveBeenCalledWith([file], '/gastos pago parcial', false);
  });

  it('pasting with text in the composer brings that text as the caption (José 11/11)', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const file = voucher();
    render(<EnviarArchivos archivos={[file]} initialCaption="adelanto de Juan" onCerrar={() => undefined} onEnviar={send} />);

    expect((screen.getByTestId('input-pie') as HTMLInputElement).value).toBe('adelanto de Juan');
    await user.keyboard(' 50%');
    await user.click(screen.getByTestId('btn-enviar-archivos'));

    expect(send).toHaveBeenCalledWith([file], 'adelanto de Juan 50%', false);
  });

  it('Enter in the caption sends, Shift+Enter does not (José 11/11)', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const file = voucher();
    render(<EnviarArchivos archivos={[file]} onCerrar={() => undefined} onEnviar={send} />);

    await user.keyboard('pago{Shift>}{Enter}{/Shift}');
    expect(send).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');

    expect(send).toHaveBeenCalledWith([file], 'pago', false);
  });

  it('Enter with nothing valid to send does nothing', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const empty = new File([], 'vacio.png', { type: 'image/png' });
    render(<EnviarArchivos archivos={[empty]} onCerrar={() => undefined} onEnviar={send} />);

    await user.keyboard('{Enter}');

    expect(send).not.toHaveBeenCalled();
  });
});
