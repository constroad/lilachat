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
    const onEnviar = vi.fn();
    const file = voucher();
    render(<EnviarArchivos archivos={[file]} onCerrar={() => undefined} onEnviar={onEnviar} />);

    await user.keyboard('/gastos pago parcial');
    await user.click(screen.getByTestId('btn-enviar-archivos'));

    expect(onEnviar).toHaveBeenCalledWith([file], '/gastos pago parcial', false);
  });
});
