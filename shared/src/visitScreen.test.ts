import { describe, expect, it, vi } from 'vitest';
import type { FormSubmitReply } from './appActions.js';
import { NEW_VISIT, VISIT_WITH_ID } from './siteVisit.fixture.js';
import { openVisitRowsOf, visitDocumentOf } from './siteVisit.js';
import { createVisitScreen, watchVisitDoor, type VisitScreenDeps } from './visitScreen.js';

const VISIT = '65f0000000000000000000a1';
const POINT = '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b';
const sent = { ok: true as const, data: { document: visitDocumentOf(VISIT_WITH_ID), visits: [] } };
const answered = (data: Record<string, unknown>): FormSubmitReply => ({ ok: true, outcome: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', data } } });

function depsOf(reply: FormSubmitReply = answered({})): VisitScreenDeps<string> & { askDraft: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> } {
  return {
    askDraft: vi.fn(async () => sent),
    open: vi.fn(async () => ({ ok: true as const, data: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'form' as const } })),
    submit: vi.fn(async () => reply),
    notice: vi.fn(async () => null),
    send: vi.fn(async () => ({ status: 201 })),
    newKey: () => POINT,
    source: 'web',
  };
}

describe('the visit screen\'s state', () => {
  it('reads the visit it opens with, and reads again when another is chosen', async () => {
    // Arrange
    const deps = depsOf();
    const screen = createVisitScreen(deps, null);
    deps.askDraft.mockResolvedValueOnce({ ok: true, data: { document: visitDocumentOf(NEW_VISIT.document), visits: openVisitRowsOf(NEW_VISIT.visitas) } });
    // Act
    await screen.reload();
    await screen.choose(VISIT);
    // Assert
    expect(deps.askDraft).toHaveBeenNthCalledWith(1, null);
    expect(deps.askDraft).toHaveBeenNthCalledWith(2, VISIT);
    expect(screen.snapshot()).toMatchObject({ visitId: VISIT, draft: { ok: true, document: { id: VISIT } }, busy: null });
  });
  it('a new visit\'s saved details make it that visit', async () => {
    const deps = depsOf();
    const screen = createVisitScreen(deps, null);
    expect(screen.adopt({ visitaId: VISIT, codigo: 'VIS-2026-0004' })).toBe(true);
    expect(screen.snapshot().visitId).toBe(VISIT);
    expect(screen.adopt({ visitaId: VISIT })).toBe(false);
  });
  it('a point says its number and reads the visit again; without GPS it does not go', async () => {
    // Arrange
    const deps = depsOf(answered({ puntoId: POINT, n: 2 }));
    const screen = createVisitScreen(deps, VISIT);
    // Act
    await screen.markPoint({ type: 'GIBA' }, null);
    const said = screen.snapshot().notice;
    await screen.markPoint({ type: 'GIBA', lat: -12, lng: -77 }, null);
    // Assert
    expect(said).toBe('Sin GPS no se marca el punto. Enciende la ubicación y vuelve a intentarlo.');
    expect(screen.snapshot().notice).toBe('Punto 2 guardado.');
    expect(deps.open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'point', visit_id: VISIT, entry_id: POINT, type: 'GIBA', source: 'web' }));
    expect(deps.askDraft).toHaveBeenCalledWith(VISIT);
  });
  it('the PDF gives its address; while it is made, the notice says so', async () => {
    const ready = createVisitScreen(depsOf(answered({ status: 'ready', url: 'https://www.constroad.com/v.pdf' })), VISIT);
    expect(await ready.pdf()).toBe('https://www.constroad.com/v.pdf');
    const making = createVisitScreen(depsOf(answered({ status: 'generating', retry_after_s: 10 })), VISIT);
    expect(await making.pdf()).toBeNull();
    expect(making.snapshot().notice).toBe('El PDF se está generando. Vuelve a tocar en un momento.');
  });
  it('a failure on the way is said, never left spinning', async () => {
    const deps = depsOf();
    deps.open.mockRejectedValueOnce(new Error('offline'));
    const screen = createVisitScreen(deps, VISIT);
    await screen.finish();
    expect(screen.snapshot()).toMatchObject({ busy: null, notice: 'No se pudo completar. Revisa tu señal.' });
  });
});

describe('the door', () => {
  it('it tells whether the chat is a door; a late answer after leaving is dropped', async () => {
    const seen: boolean[] = [];
    watchVisitDoor(async () => ({ ok: true as const, data: { open: true } }), (open) => seen.push(open));
    const stop = watchVisitDoor(async () => ({ ok: true as const, data: { open: true } }), (open) => seen.push(open));
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([true]);
  });
});
