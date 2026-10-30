import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoutinesRow } from './RoutinesRow';
import { ContactNoteBannerWeb } from './ContactNoteBannerWeb';

/** Pending 17 (design automatizaciones): quiet on a schedule, and a note for the next time I talk to someone. */
afterEach(() => vi.unstubAllGlobals());
const ok = () => vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
const bodyOf = (mock: ReturnType<typeof ok>, call = 0) => JSON.parse(String((mock.mock.calls[call] as unknown as [string, RequestInit])[1].body)) as Record<string, unknown>;

describe('RoutinesRow', () => {
  it('turning the schedule on saves weekdays 18:00–08:00 in my zone; a day off is saved too', async () => {
    // Arrange
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    render(<RoutinesRow chatId="c1" jwt="jwt" isDirect={false} name="Obra" onNotice={() => undefined} />);
    // Act
    fireEvent.click(screen.getByTestId('interruptor-silencio-horario'));
    // Assert
    await screen.findByText(/Lun a vie · 18:00–08:00/);
    expect(bodyOf(fetchMock).quietHours).toMatchObject({ days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00' });
    fireEvent.click(screen.getByTestId('dia-silencio-5'));
    await screen.findByText(/Lun, mar, mié, jue · 18:00–08:00/);
    expect(screen.queryByTestId('nota-contacto')).toBeNull();
  });

  it('a refusal puts the switch back and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'No encontramos esa conversación.' }), { status: 404 })));
    const onNotice = vi.fn();
    render(<RoutinesRow chatId="c1" jwt="jwt" isDirect={false} name="Obra" onNotice={onNotice} />);
    fireEvent.click(screen.getByTestId('interruptor-silencio-horario'));
    await vi.waitFor(() => expect(onNotice).toHaveBeenCalledWith('No encontramos esa conversación.'));
    expect(screen.getByTestId('interruptor-silencio-horario')).not.toBeChecked();
  });

  it('in a 1:1, the note saves trimmed', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    render(<RoutinesRow chatId="c1" jwt="jwt" isDirect name="Ana" onNotice={() => undefined} />);
    fireEvent.change(screen.getByTestId('nota-contacto'), { target: { value: '  Preguntarle por la factura ' } });
    fireEvent.click(screen.getByTestId('btn-guardar-nota'));
    await vi.waitFor(() => expect(screen.queryByTestId('btn-guardar-nota')).toBeNull());
    expect(bodyOf(fetchMock).contactNote).toEqual({ text: 'Preguntarle por la factura' });
  });
});

describe('ContactNoteBannerWeb', () => {
  it('shows my note; «Listo» clears it on the server', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactNoteBannerWeb chatId="c1" jwt="jwt" note={{ text: 'Preguntarle por la factura' }} />);
    expect(screen.getByTestId('aviso-nota-contacto').textContent).toContain('Preguntarle por la factura');
    fireEvent.click(screen.getByTestId('btn-nota-lista'));
    expect(screen.queryByTestId('aviso-nota-contacto')).toBeNull();
    await vi.waitFor(() => expect(bodyOf(fetchMock)).toEqual({ contactNote: null }));
  });
});
