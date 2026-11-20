import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openVisitRowsOf, visitDocumentOf, type ShortcutRow } from '@lilachat/shared';
import { NEW_VISIT as PORTAL_NEW_VISIT } from '../../../../shared/src/siteVisit.fixture';

const calls = vi.hoisted(() => ({ draft: vi.fn(), open: vi.fn(), place: vi.fn() }));
vi.mock('./visitsApi', () => ({ askVisitDraft: calls.draft, openVisitForm: calls.open }));
vi.mock('../clients/reports/devicePlace', () => ({ devicePlaceNow: calls.place }));

const { runVisitShortcut } = await import('./visitShortcut');

const VISIT_ROW: ShortcutRow = { kind: 'shortcut', appId: 'portal', appName: 'Portal', key: 'visita_tecnica', name: 'Visita técnica' };
const OTHER_ROW: ShortcutRow = { kind: 'shortcut', appId: 'portal', appName: 'Portal', key: 'crear_enlace_de_servicio', name: 'Enlace del servicio' };
const SPACE = { jwt: 'jwt', spaceId: 'space-1' };
/** What `POST /visits/draft` answers for a new visit, as our server read it from Portal. */
const NEW_VISIT = { document: visitDocumentOf(PORTAL_NEW_VISIT.document), visits: openVisitRowsOf(PORTAL_NEW_VISIT.visitas) };
const DATA_SECTION_FORM = { commandId: 'run-1', appId: 'portal', appName: 'Portal', outcome: 'form' };

type Track = Parameters<typeof runVisitShortcut>[2];

/** What `useAppAnswers().track` does with the call: runs it and says whether it went. */
const trackRunning = (): { track: Track; started: unknown[] } => {
  const started: unknown[] = [];
  const track: Track = async (start, call) => {
    started.push(start);
    return (await call()).ok;
  };
  return { track, started };
};

describe('«Visita técnica» from the space ⚡ on the APK (José 20/11: it showed Portal\'s «se abre en su pantalla»)', () => {
  beforeEach(() => {
    calls.draft.mockReset().mockResolvedValue({ ok: true, data: NEW_VISIT });
    calls.open.mockReset().mockResolvedValue({ ok: true, data: DATA_SECTION_FORM });
    calls.place.mockReset().mockResolvedValue({ lat: -12.1, lng: -77.03, at: '2026-11-20T10:00:00.000Z' });
  });

  it('opens the new visit\'s «Datos» where the phone is, never Portal\'s shortcut', async () => {
    const { track, started } = trackRunning();

    const ran = await runVisitShortcut(VISIT_ROW, SPACE, track);

    expect(ran).toBe(true);
    expect(started).toEqual([{ appName: 'Portal', command: '', action: 'Visita técnica' }]);
    expect(calls.draft).toHaveBeenCalledWith(SPACE, null);
    expect(calls.open).toHaveBeenCalledWith(SPACE, { kind: 'section', section: 'datos', lat: -12.1, lng: -77.03 });
  });

  it('without a fix of the phone, «Datos» still opens, with no point', async () => {
    calls.place.mockResolvedValue({ at: '2026-11-20T10:00:00.000Z' });

    await runVisitShortcut(VISIT_ROW, SPACE, trackRunning().track);

    expect(calls.open).toHaveBeenCalledWith(SPACE, { kind: 'section', section: 'datos' });
  });

  it('a refused draft (visits turned off) is the answer, and no form is opened', async () => {
    calls.draft.mockResolvedValue({ ok: true, data: { error: 'visitas_apagadas', message: 'Las visitas técnicas están apagadas en Portal.' } });

    const ran = await runVisitShortcut(VISIT_ROW, SPACE, trackRunning().track);

    expect(ran).toBe(false);
    expect(calls.open).not.toHaveBeenCalled();
  });

  it('any other row is not the visit: null, so it runs as always', () => {
    expect(runVisitShortcut(OTHER_ROW, SPACE, trackRunning().track)).toBeNull();
    expect(calls.draft).not.toHaveBeenCalled();
  });
});
