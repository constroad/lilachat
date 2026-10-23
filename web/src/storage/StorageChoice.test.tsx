import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const deleteBase = vi.fn(async (_userId: string) => undefined);
vi.mock('../local/baseLocal', () => ({ borrarBaseDe: (userId: string) => deleteBase(userId) }));
const { StorageChoice } = await import('./StorageChoice');

afterEach(() => {
  vi.unstubAllGlobals();
  deleteBase.mockClear();
});

describe('StorageChoice (pending 13, the browser)', () => {
  it('says how much this browser keeps and, after asking, deletes its copy and reloads', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: { estimate: async () => ({ usage: 12 * 1024 * 1024, quota: 2 * 1024 * 1024 * 1024 }) } });
    vi.stubGlobal('confirm', () => true);
    const reload = vi.fn();
    render(<StorageChoice userId="u1" reload={reload} />);
    expect(await screen.findByText('12 MB en este navegador')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-almacenamiento'));
    await userEvent.click(screen.getByTestId('btn-borrar-copia-local'));
    expect(deleteBase).toHaveBeenCalledWith('u1');
    expect(reload).toHaveBeenCalled();
  });

  it('does nothing if the person says no', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: { estimate: async () => ({ usage: 0, quota: 1 }) } });
    vi.stubGlobal('confirm', () => false);
    const reload = vi.fn();
    render(<StorageChoice userId="u1" reload={reload} />);
    await userEvent.click(screen.getByTestId('btn-almacenamiento'));
    await userEvent.click(screen.getByTestId('btn-borrar-copia-local'));
    expect(deleteBase).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
