import { describe, expect, it, vi } from 'vitest';
import type { FormSubmitReply } from './appActions.js';
import type { CommandOutcome } from './botCommands.js';
import { embedEventOf, embedLinkOf, PORTAL_EMBED_ORIGINS } from './portalEmbed.js';
import { SERVICE_CROQUIS_FAILED, SERVICE_CROQUIS_NOT_ENABLED, serviceCroquisRequest, serviceCroquisRun, serviceCroquisVia } from './serviceCroquis.js';
import { editThenReload, type MapEditSend } from './workScopeDraft.js';
import type { WorkProgressDeps } from './workProgressSend.js';

const prod = [PORTAL_EMBED_ORIGINS.production];
const url = 'https://www.constroad.com/embed/service-croquis/6aedcc3a2f5e395dca260f16#t=abc.DEF_123-x';
const form = { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'form', response: { responseType: 'form' } } as CommandOutcome;
const answered = (data: Record<string, unknown> | undefined): FormSubmitReply => ({ ok: true, outcome: { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Listo', ...(data ? { data } : {}) } } as CommandOutcome });
const depsWith = (reply: FormSubmitReply, opened: Awaited<ReturnType<WorkProgressDeps['open']>> = { ok: true, data: form }): WorkProgressDeps => ({
  open: vi.fn(async () => opened),
  submit: vi.fn(async () => reply),
  notice: vi.fn(async () => null),
});

/** José 19/11: «Editar croquis» on the service's map opens Portal's croquis editor of the service. */
describe('the service croquis link', () => {
  it('only a link to Portal\'s service croquis embed, with its token', () => {
    expect(embedLinkOf({ url, expiresAt: '2026-11-20T08:00:00.000Z' }, prod, 'service-croquis')).toEqual({ url, expiresAt: '2026-11-20T08:00:00.000Z' });
    expect(embedLinkOf({ url: url.replace('6aedcc3a2f5e395dca260f16', 'not-a-service'), expiresAt: '2026-11-20T08:00:00.000Z' }, prod, 'service-croquis')).toBeNull();
    expect(embedLinkOf({ url: `${url.split('#')[0]}?x=1#t=abc`, expiresAt: '2026-11-20T08:00:00.000Z' }, prod, 'service-croquis')).toBeNull();
    expect(embedLinkOf({ url, expiresAt: '2026-11-20T08:00:00.000Z' }, prod, 'site-visit')).toBeNull();
  });

  it('reads «saved» with the service\'s id', () => {
    expect(embedEventOf({ type: 'portal-embed:saved', version: 1, serviceId: 's1', savedAt: '2026-11-19T14:00:00.000Z' })).toEqual({ type: 'saved', serviceId: 's1', savedAt: '2026-11-19T14:00:00.000Z' });
  });

  it('asks the door for the service croquis', () => {
    expect(serviceCroquisRequest()).toEqual({ kind: 'service_croquis', forms: 3 });
  });
});

describe('serviceCroquisRun', () => {
  it('runs the tool and keeps its link', async () => {
    // Arrange
    const deps = depsWith(answered({ url, expiresAt: '2026-11-20T08:00:00.000Z' }));
    // Act
    const result = await serviceCroquisRun(deps, prod);
    // Assert
    expect(result).toEqual({ ok: true, message: '', data: { url, expiresAt: '2026-11-20T08:00:00.000Z' } });
    expect(deps.submit).toHaveBeenCalledWith('cmd-1', {});
  });

  it('agentes refusing, failing or answering without a link: not enabled yet', async () => {
    const failed: FormSubmitReply = { ok: true, outcome: { ...form, outcome: 'failed', message: 'Portal no pudo responder.' } as CommandOutcome };
    expect(await serviceCroquisRun(depsWith(failed), prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_NOT_ENABLED });
    expect(await serviceCroquisRun(depsWith({ ok: false, status: 404, message: 'tool_unavailable' }), prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_NOT_ENABLED });
    expect(await serviceCroquisRun(depsWith(answered(undefined)), prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_NOT_ENABLED });
  });

  it('no network says to try again', async () => {
    expect(await serviceCroquisRun(depsWith({ ok: false, message: 'Sin conexión' }), prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_FAILED });
    expect(await serviceCroquisRun(depsWith(answered(undefined), { ok: false }), prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_FAILED });
  });
});

describe('serviceCroquisVia', () => {
  it('goes through the map\'s door and does not reload the map just for opening', async () => {
    // Arrange
    const deps = depsWith(answered({ url, expiresAt: '2026-11-20T08:00:00.000Z' }));
    const door: MapEditSend = vi.fn(async (_request, run) => run(deps));
    const reload = vi.fn(async () => undefined);
    // Act
    const result = await serviceCroquisVia(editThenReload(door, reload)!, prod);
    // Assert
    expect(result).toEqual({ ok: true, link: { url, expiresAt: '2026-11-20T08:00:00.000Z' } });
    expect(door).toHaveBeenCalledWith({ kind: 'service_croquis', forms: 3 }, expect.any(Function));
    expect(reload).not.toHaveBeenCalled();
  });

  it('says why when there is no link', async () => {
    const door: MapEditSend = vi.fn(async () => ({ ok: false as const, message: SERVICE_CROQUIS_NOT_ENABLED }));
    expect(await serviceCroquisVia(door, prod)).toEqual({ ok: false, message: SERVICE_CROQUIS_NOT_ENABLED });
  });
});
