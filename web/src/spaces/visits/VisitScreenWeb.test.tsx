import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openVisitRowsOf, visitDocumentOf, type CommandOutcome } from '@lilachat/shared';
import { NEW_VISIT, VISIT_WITH_ID } from '../../../../shared/src/siteVisit.fixture';
import { VisitScreenWeb } from './VisitScreenWeb';

/** The technical visit on the web (José 13/11, designs lv01–lv03), against the shared flow with the server faked. */
const api = vi.hoisted(() => ({ askVisitDraft: vi.fn(), openVisitForm: vi.fn(), askVisitDoor: vi.fn() }));
vi.mock('./visitsApi', () => api);
const submit = vi.hoisted(() => vi.fn());
vi.mock('../../chat/commands/commandsApi', async (original) => ({ ...(await original<typeof import('../../chat/commands/commandsApi')>()), submitAppForm: submit }));
const answers = vi.hoisted(() => ({ answers: [] as unknown[], openForm: null, track: vi.fn(async (_start: unknown, call: () => Promise<{ ok: boolean }>) => (await call()).ok), dismiss: vi.fn(), showForm: vi.fn(), submitForm: vi.fn(), uploadPhoto: vi.fn() }));
vi.mock('../../chat/commands/useAppAnswers', () => ({ useAppAnswers: () => answers }));

const place = { jwt: 'jwt', spaceId: '65f0000000000000000000ff', chatId: '65f0000000000000000000ee' };
const opened: CommandOutcome = { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'form' };

beforeEach(() => {
  vi.clearAllMocks();
  api.askVisitDraft.mockResolvedValue({ ok: true, data: { document: visitDocumentOf(VISIT_WITH_ID), visits: [] } });
  api.openVisitForm.mockResolvedValue({ ok: true, data: opened });
});

describe('the visit on the web', () => {
  it('shows its figures, its points and the four actions (lv01)', async () => {
    // Act
    render(<VisitScreenWeb place={place} visitId="65f0000000000000000000a1" onClose={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('visita-puntos')).toHaveTextContent('1');
    expect(screen.getByTestId('visita-entrevista')).toHaveTextContent('1 de 2');
    expect(screen.getByTestId('visita-punto-1')).toBeInTheDocument();
    ['visita-marcar-punto', 'visita-abrir-entrevista', 'visita-foto-suelta', 'visita-terminar'].forEach((id) => expect(screen.getByTestId(id)).toBeInTheDocument());
    expect(api.askVisitDraft).toHaveBeenCalledWith(place, '65f0000000000000000000a1');
  });
  it('a new visit offers «Crear visita» and the open ones; one tapped opens it', async () => {
    // Arrange
    api.askVisitDraft.mockResolvedValueOnce({ ok: true, data: { document: visitDocumentOf(NEW_VISIT.document), visits: openVisitRowsOf(NEW_VISIT.visitas) } });
    render(<VisitScreenWeb place={place} onClose={() => undefined} />);
    const row = await screen.findByTestId('visita-abierta-VIS-2026-0003');
    expect(screen.getByTestId('visita-crear')).toBeInTheDocument();
    // Act
    fireEvent.click(row);
    // Assert
    await waitFor(() => expect(api.askVisitDraft).toHaveBeenLastCalledWith(place, '65f0000000000000000000a1'));
    expect(await screen.findByTestId('visita-puntos')).toHaveTextContent('1');
  });
  it('«Terminar» with something missing says the first thing', async () => {
    // Arrange
    submit.mockResolvedValue({ ok: true, outcome: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', data: { missing: ['la conclusión'] } } } });
    render(<VisitScreenWeb place={place} visitId="65f0000000000000000000a1" onClose={() => undefined} />);
    // Act
    fireEvent.click(await screen.findByTestId('visita-terminar'));
    // Assert
    expect(await screen.findByTestId('visita-aviso')).toHaveTextContent('Falta: la conclusión');
    expect(api.openVisitForm).toHaveBeenCalledWith(place, { kind: 'finish', visit_id: '65f0000000000000000000a1' });
  });
  it('Portal\'s switch off: its words, and «Reintentar»', async () => {
    api.askVisitDraft.mockResolvedValueOnce({ ok: true, data: { error: 'visitas_apagadas', message: 'Las visitas técnicas desde Lilachat están apagadas.' } });
    render(<VisitScreenWeb place={place} onClose={() => undefined} />);
    expect(await screen.findByTestId('visita-fallo')).toHaveTextContent('Las visitas técnicas desde Lilachat están apagadas.');
  });
});
