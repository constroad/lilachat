import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportDialog } from './ReportDialog';

/** Google Play (José 19/11): report a message or a person, with a reason, a note and «Bloquear también». */
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const MESSAGE = { target: 'message' as const, chatId: 'c'.repeat(24), seq: 7 };

describe('ReportDialog', () => {
  it('sends nothing until a reason is chosen', () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ReportDialog jwt="jwt" subject={MESSAGE} personName="Beto" onClose={() => undefined} />);
    // Act / Assert
    expect(screen.getByTestId('denuncia-enviar')).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a message report with «Bloquear también» goes in one step and confirms', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => json(201, { reportId: 'r1', duplicate: false, blocked: true }));
    vi.stubGlobal('fetch', fetchMock);
    const onBlocked = vi.fn();
    render(<ReportDialog jwt="jwt" subject={MESSAGE} personName="Beto" onClose={() => undefined} onBlocked={onBlocked} />);
    // Act
    fireEvent.click(screen.getByTestId('denuncia-motivo-harassment'));
    fireEvent.change(screen.getByTestId('denuncia-nota'), { target: { value: 'me insulta' } });
    fireEvent.click(screen.getByTestId('denuncia-bloquear'));
    fireEvent.click(screen.getByTestId('denuncia-enviar'));
    // Assert
    expect(await screen.findByTestId('denuncia-recibida')).toHaveTextContent('Recibimos tu denuncia');
    expect(fetchMock).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ method: 'POST', body: JSON.stringify({ ...MESSAGE, reason: 'harassment', note: 'me insulta', alsoBlock: true }) }));
    expect(onBlocked).toHaveBeenCalled();
  });

  it('«Otro» asks for a text before sending', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<ReportDialog jwt="jwt" subject={{ target: 'user', userId: 'u'.repeat(24) }} personName="Beto" onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('denuncia-motivo-other'));
    expect(screen.getByTestId('denuncia-enviar')).toBeDisabled();
    fireEvent.change(screen.getByTestId('denuncia-nota'), { target: { value: 'otra cosa' } });
    expect(screen.getByTestId('denuncia-enviar')).toBeEnabled();
  });

  it('a refusal keeps the form open and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(429, { message: 'Enviaste muchas denuncias hoy. Prueba mañana.' })));
    render(<ReportDialog jwt="jwt" subject={MESSAGE} personName="Beto" onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('denuncia-motivo-spam'));
    fireEvent.click(screen.getByTestId('denuncia-enviar'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enviaste muchas denuncias hoy.');
    expect(screen.getByTestId('denuncia-enviar')).toBeEnabled();
  });
});
