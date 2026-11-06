import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from '@lilachat/shared';
import { ReportDocumentWeb } from './ReportDocumentWeb';

/** The form answers are the engine of every app form; here only `track` matters: it runs the call and opens what comes back. */
const answers = vi.hoisted(() => ({
  answers: [] as unknown[],
  openForm: null,
  track: vi.fn(async (_start: unknown, call: () => Promise<{ ok: boolean }>) => (await call()).ok),
  dismiss: vi.fn(),
  showForm: vi.fn(),
  submitForm: vi.fn(),
  uploadPhoto: vi.fn(),
  refreshForm: vi.fn(),
  previewForm: vi.fn(),
}));
vi.mock('../../../chat/commands/useAppAnswers', () => ({ useAppAnswers: () => answers }));

/** A CTL-IMP as Portal answers it (spec INFORMES-DESDE-LILACHAT §3.1): general done, one tramo with its bandejas still empty. */
const form = (title: string) => ({ type: 'object', properties: { campo: { type: 'string', title } } });
const document = {
  id: '6aed0a1b2c3d4e5f60718293', type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: form('General'), ubicacion: form('Ubicación'), bandejas: form('Bandejas'), fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: ['Av. Los Incas · MC-30'], results: [], form: 'general', values: { campo: 'x' } },
    {
      id: 'tramos', title: 'Tramos', required: true, state: 'partial', summary: [],
      repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }] },
      items: [{ id: 't1', title: 'Tramo 1', summary: ['Km 12+000 a 12+350'], results: [{ label: 'Tasa registrada', value: '1.02 lt/m²', tone: 'ok' }], sections: [{ id: 'ubicacion', state: 'done', values: {} }, { id: 'bandejas', state: 'empty', values: {} }, { id: 'fotos', state: 'empty', values: {} }] }],
    },
  ],
  publish: { label: 'Publicar informe', missing: ['Falta una foto en Tramo 1'] },
};
const formOutcome: CommandOutcome = { commandId: 'c1', appId: 'p', appName: 'Portal', outcome: 'form', response: { responseType: 'form', form: { id: 'guardar_seccion_de_informe', title: 'Datos generales', schema: form('General') } } };
const service = { id: 'srv-318', name: 'Imprimación Av. Los Incas', status: 'in_progress' as const, stage_label: 'Ejecución' };
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-cvs' };

/** The server behind: the draft by its path, a form by its path; everything else is a refusal. */
function serverWith(draft: object) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith('/reports/draft')) return new Response(JSON.stringify(draft), { status: 200 });
    if (url.endsWith('/reports/forms')) return new Response(JSON.stringify(formOutcome), { status: 200 });
    return new Response(JSON.stringify({ message: 'no' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}
const formCalls = (calls: { url: string; body: unknown }[]) => calls.filter((call) => call.url.endsWith('/reports/forms')).map((call) => call.body);

// A hook that returns the mock would hand vitest a «cleanup» that calls `track` with nothing: braces on purpose.
beforeEach(() => {
  answers.track.mockClear();
  answers.dismiss.mockClear();
  answers.answers = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('ReportDocumentWeb', () => {
  it('asks the draft and shows the hub (design j-02): kicker, state, progress, a card per section and what blocks «Publicar»', async () => {
    // Arrange
    const calls = serverWith({ document });
    // Act
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('progreso-informe')).toHaveTextContent('2 de 3 secciones listas');
    expect(calls[0]).toMatchObject({ url: '/api/workspaces/s1/clients/cli-cvs/services/srv-318/reports/draft', body: { type: 'CTL-IMP' } });
    expect(screen.getByTestId('informe-documento')).toHaveTextContent('Control de imprimación');
    expect(screen.getByTestId('informe-documento')).toHaveTextContent('Imprimación Av. Los Incas');
    expect(screen.getByTestId('estado-informe')).toHaveTextContent('Borrador');
    expect(screen.getByTestId('seccion-general')).toHaveTextContent('Lista');
    expect(screen.getByTestId('seccion-general')).toHaveTextContent('Av. Los Incas · MC-30');
    expect(screen.getByTestId('seccion-tramos')).toHaveTextContent('A medias');
    expect(screen.getByTestId('seccion-tramos')).toHaveTextContent('1 tramo · Km 12+000 a 12+350');
    expect(screen.getByTestId('seccion-tramos')).toHaveTextContent('1.02 lt/m²');
    expect(screen.getByTestId('falta-informe')).toHaveTextContent('Falta una foto en Tramo 1');
    expect(screen.getByTestId('abrir-publicar')).toHaveTextContent('Publicar informe');
  });

  it('a section card opens its form through the server, with the report and its path', async () => {
    const calls = serverWith({ document });
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={() => undefined} />);
    fireEvent.click(await screen.findByTestId('seccion-general'));
    await vi.waitFor(() => expect(formCalls(calls)).toHaveLength(1));
    expect(formCalls(calls)[0]).toEqual({ kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general', report_id: document.id, forms: 3 });
    expect(answers.track).toHaveBeenCalledWith({ appName: 'Portal', command: '', action: 'Datos generales' }, expect.any(Function));
  });

  it('the tramos open their own list (design j-03): a card per tramo with its subsections, «Agregar tramo» opens the first section of a new one, and back returns to the hub', async () => {
    const calls = serverWith({ document });
    const onClose = vi.fn();
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={onClose} />);
    fireEvent.click(await screen.findByTestId('seccion-tramos'));
    const item = screen.getByTestId('item-t1');
    expect(screen.getByTestId('items-tramos')).toHaveTextContent('1 tramo');
    expect(item).toHaveTextContent('Km 12+000 a 12+350');
    expect(within(item).getByTestId('seccion-t1-bandejas')).toHaveTextContent('Falta');
    expect(screen.queryByTestId('abrir-publicar')).toBeNull();
    fireEvent.click(within(item).getByTestId('seccion-t1-fotos'));
    await vi.waitFor(() => expect(formCalls(calls)).toHaveLength(1));
    // The photos ride with the hour (and the place when the browser gives one): the server needs it for Portal's stamp.
    expect(formCalls(calls)[0]).toMatchObject({ kind: 'section', item_id: 't1', key: 'fotos', at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    fireEvent.click(screen.getByTestId('agregar-item'));
    await vi.waitFor(() => expect(formCalls(calls)).toHaveLength(2));
    expect(formCalls(calls)[1]).toMatchObject({ kind: 'section', section_id: 'tramos', item_id: null, key: 'ubicacion' });
    expect(formCalls(calls)[1]).not.toHaveProperty('at');
    fireEvent.click(screen.getByTestId('volver-al-servicio'));
    expect(screen.getByTestId('seccion-general')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('volver-al-servicio'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('«Publicar» waits for what Portal says is missing (design j-04), and ready it opens Portal’s publish form', async () => {
    const calls = serverWith({ document });
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={() => undefined} />);
    fireEvent.click(await screen.findByTestId('abrir-publicar'));
    expect(screen.getByTestId('falta-publicar')).toHaveTextContent('Falta una foto en Tramo 1');
    expect(screen.getByTestId('confirmar-publicar')).toBeDisabled();
    fireEvent.click(screen.getByTestId('seguir-llenando'));
    expect(screen.queryByTestId('confirmar-publicar')).toBeNull();
    expect(formCalls(calls)).toHaveLength(0);
  });

  it('with nothing missing, «Publicar» opens Portal’s publish form with the report', async () => {
    const calls = serverWith({ document: { ...document, publish: { label: 'Publicar informe', missing: [] } } });
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={() => undefined} />);
    fireEvent.click(await screen.findByTestId('abrir-publicar'));
    expect(screen.queryByTestId('falta-publicar')).toBeNull();
    expect(screen.queryByTestId('falta-informe')).toBeNull();
    fireEvent.click(screen.getByTestId('confirmar-publicar'));
    await vi.waitFor(() => expect(formCalls(calls)).toHaveLength(1));
    expect(formCalls(calls)[0]).toEqual({ kind: 'publish', report_id: document.id, forms: 3 });
    expect(answers.track).toHaveBeenCalledWith({ appName: 'Portal', command: '', action: 'Publicar informe' }, expect.any(Function));
  });

  it('a new answer clears the ones before it: «Sección guardada» does not stack over the sections', async () => {
    serverWith({ document });
    const answered = (commandId: string) => ({ commandId, appName: 'Portal', command: '', action: 'Bandejas', state: 'answered', message: 'Sección guardada.' });
    answers.answers = [answered('c1'), answered('c2'), answered('c3')];
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={() => undefined} />);
    await screen.findByTestId('seccion-general');
    expect(answers.dismiss.mock.calls).toEqual([['c1'], ['c2']]);
  });

  it('a refusal shows the server’s message and the service in Portal', async () => {
    serverWith({ error: 'not_found', message: 'Ese servicio ya no está en el Portal.' });
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" portalUrl="https://portal.constroad.com/s/318" onClose={() => undefined} />);
    expect(await screen.findByTestId('informe-fallo')).toHaveTextContent('Ese servicio ya no está en el Portal.');
    expect(screen.getByTestId('informe-fallo-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    expect(screen.queryByTestId('abrir-publicar')).toBeNull();
  });
});
