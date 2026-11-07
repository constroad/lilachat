import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from '@lilachat/shared';
import { baseDe } from '../../../local/baseLocal';
import { ReportDocumentWeb } from './ReportDocumentWeb';
import { reportQueue } from './reportQueueStore';

/** The queue keeps its saves in this person's local base. */
vi.mock('../../../api', async (original) => ({ ...(await original<typeof import('../../../api')>()), loadPerfil: () => ({ userId: 'qa-user', phone: '', deviceId: 'd1' }) }));

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
const savedOutcome: CommandOutcome = { commandId: 'c1', appId: 'p', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Sección guardada.' } };
const formOutcome: CommandOutcome = { commandId: 'c1', appId: 'p', appName: 'Portal', outcome: 'form', response: { responseType: 'form', form: { id: 'guardar_seccion_de_informe', title: 'Datos generales', schema: form('General') } } };
const service = { id: 'srv-318', name: 'Imprimación Av. Los Incas', status: 'in_progress' as const, stage_label: 'Ejecución' };
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-cvs' };

/** The server behind: the draft by its path, a form by its path, its answer by the run; everything else is a refusal. */
function serverWith(draft: object, answer: { status: number; body: object } = { status: 200, body: savedOutcome }) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith('/reports/draft')) return new Response(JSON.stringify(draft), { status: 200 });
    if (url.endsWith('/reports/forms')) return new Response(JSON.stringify(formOutcome), { status: 200 });
    if (url.endsWith('/commands/c1/form')) return new Response(JSON.stringify(answer.body), { status: answer.status });
    if (url.endsWith('/pdf?preview=1')) return new Response(JSON.stringify({ pdf: { status: 'ready', pdfUrl: 'https://portal.example.com/vista/rep' } }), { status: 200 });
    return new Response(JSON.stringify({ message: 'no' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}
/** No network at all: every call throws, as `fetch` does. */
const noNetwork = () => vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
const formCalls = (calls: { url: string; body: unknown }[]) => calls.filter((call) => call.url.endsWith('/reports/forms')).map((call) => call.body);
const sentCalls = (calls: { url: string; body: unknown }[]) => calls.filter((call) => call.url.endsWith('/commands/c1/form')).map((call) => call.body);
const openReport = (props: { onClose?: (changed: boolean) => void } = {}) => render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" onClose={props.onClose ?? (() => undefined)} />);
const fillAndSave = (value: string) => {
  fireEvent.change(screen.getByTestId('campo-campo'), { target: { value } });
  fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
};

// A hook that returns the mock would hand vitest a «cleanup» that calls `track` with nothing: braces on purpose.
beforeEach(() => {
  answers.track.mockClear();
  answers.dismiss.mockClear();
  answers.answers = [];
});
afterEach(async () => {
  await reportQueue.forget();
  await baseDe('qa-user').meta.clear();
  vi.unstubAllGlobals();
});

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

  it('a section opens its form here, with no call, and «Guardar» goes through the server with the report and its path', async () => {
    const calls = serverWith({ document });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-general'));
    expect(await screen.findByTestId('formulario-guardar_seccion_de_informe')).toBeInTheDocument();
    expect(formCalls(calls)).toHaveLength(0);
    fillAndSave('Nuevo valor');
    await vi.waitFor(() => expect(sentCalls(calls)).toEqual([{ values: { campo: 'Nuevo valor' } }]));
    expect(formCalls(calls)[0]).toEqual({ kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general', report_id: document.id, forms: 3 });
    expect(screen.queryByTestId('formulario-guardar_seccion_de_informe')).toBeNull();
  });

  it('the tramos open their own list (design j-03): a card per tramo with its subsections, «Agregar tramo» opens the first section of a new one, and back returns to the hub', async () => {
    serverWith({ document });
    const onClose = vi.fn();
    openReport({ onClose });
    fireEvent.click(await screen.findByTestId('seccion-tramos'));
    const item = screen.getByTestId('item-t1');
    expect(screen.getByTestId('items-tramos')).toHaveTextContent('1 tramo');
    expect(item).toHaveTextContent('Km 12+000 a 12+350');
    expect(within(item).getByTestId('seccion-t1-bandejas')).toHaveTextContent('Falta');
    expect(screen.queryByTestId('abrir-publicar')).toBeNull();
    expect(within(item).getByTestId('seccion-t1-fotos')).toHaveTextContent('0 fotos');
    fireEvent.click(screen.getByTestId('agregar-item'));
    expect(await screen.findByTestId('formulario-guardar_seccion_de_informe')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cerrar'));
    fireEvent.click(screen.getByTestId('volver-al-servicio'));
    expect(screen.getByTestId('seccion-general')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('volver-al-servicio'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('a control de pista (design j-05): the volquetes that left the plant with «Llegó», the ones on site with their four photos, and «Publicar» with what is missing and the warning', async () => {
    const photoEntry = (kind: string) => ({ id: `foto-${kind}`, title: `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind, requireLocation: true });
    const units = {
      id: 'unidades', kind: 'repeat', results: [{ label: 'Carros', value: '4', tone: 'neutral' }], title: 'Unidades', required: true, state: 'partial', summary: ['1 de 3 terminadas · 45 m³'], itemTitle: 'Unidad', addLabel: '', min: 1,
      template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, photoEntry('ingreso'), photoEntry('temperatura'), photoEntry('vacia'), photoEntry('escantillon')],
      items: [
        { id: 'd1', title: 'Unidad 1 · QAP-101', summary: ['Terminó 09:12', 'Guía G1 · 15 m³'], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 06:15 · 150° · 3.0 cm'], values: {} }, ...['ingreso', 'temperatura', 'vacia', 'escantillon'].map((kind) => ({ id: `foto-${kind}`, state: 'done', values: { fotos: [{ id: kind, url: `https://x/${kind}.jpg` }] } }))] },
        { id: 'd2', title: 'Unidad 2 · QAP-102', summary: ['Guía G2 · 15 m³'], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30 · 148°'], values: {} }] },
        { id: 'd3', title: 'QAP-103', summary: ['Salió 07:10 · 15 m³ · Guía G3'], results: [], sections: [] },
      ],
    };
    const pista = { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units], publish: { label: 'Publicar informe', missing: ['Falta la foto de vacía en QAP-102'], warnings: ['2 volquetes por llegar'] } };
    const calls = serverWith({ document: pista });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-unidades'));

    const list = screen.getByTestId('unidades-unidades');
    expect(screen.queryByTestId('agregar-item')).toBeNull();
    expect(screen.getByTestId('resumen-unidades')).toHaveTextContent('1 de 3 terminadas · 45 m³');
    expect(screen.getByTestId('resultados-unidades')).toHaveTextContent('Carros');
    expect(list).toHaveTextContent('Por llegar · toca el que llegó');
    expect(list).toHaveTextContent('En pista');
    expect(screen.getByTestId('conteo-unidades')).toHaveTextContent('1 en pista · 1 por llegar · 1 terminó');
    expect(within(screen.getByTestId('unidad-d3')).getByTestId('llego-d3')).toHaveTextContent('Llegó');
    // A finished unit folds away: it no longer needs the person.
    expect(screen.queryByTestId('estado-d1')).toBeNull();
    fireEvent.click(screen.getByTestId('ver-terminadas'));
    expect(screen.getByTestId('estado-d1')).toHaveTextContent('Terminó 09:12');
    expect(screen.getByTestId('estado-d2')).toHaveTextContent('En pista');
    expect(within(screen.getByTestId('unidad-d2')).getAllByRole('button', { name: /^Foto de/ })).toHaveLength(4);
    expect(screen.getByTestId('datos-d2')).toHaveTextContent('Llegada 07:30 · 148°');
    expect(screen.getByTestId('falta-informe')).toHaveTextContent('Falta la foto de vacía en QAP-102 · 2 volquetes por llegar');
    expect(screen.getByTestId('abrir-publicar')).toBeInTheDocument();

    // José 07/11: «Llegó» opens the ingreso photo first, with no call; the data comes after.
    fireEvent.click(screen.getByTestId('llego-d3'));
    expect(await screen.findByTestId('formulario-agregar_foto_de_informe')).toBeInTheDocument();
    expect(screen.queryByTestId('formulario-guardar_seccion_de_informe')).toBeNull();
    expect(formCalls(calls)).toEqual([]);
  });

  it('with several units on site the plates go on top, and a truck the plant has not marked can arrive (José 06/11)', async () => {
    // Arrange
    const working = (id: string) => ({ id, title: `Unidad 1 · ${id}`, summary: [], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30'], values: {} }] });
    const notHere = (id: string, summary: string[]) => ({ id, title: id, summary, results: [], sections: [{ id: 'datos', state: 'empty', summary: [], values: {} }] });
    const units = { id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 0, canAdd: false, template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, { id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'ubicacion', tool: 'agregar_foto_de_informe', photoKind: 'ingreso' }], items: [working('QAP-1'), working('QAP-2'), notHere('QAP-3', ['Salió 07:10']), notHere('QAP-4', ['En planta'])] };
    serverWith({ document: { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units] } });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-unidades'));
    // Assert
    expect(within(screen.getByTestId('unidades-por-llegar')).getByTestId('llego-QAP-3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('llego-QAP-4'));
    expect(await screen.findByTestId('formulario-agregar_foto_de_informe')).toBeInTheDocument();
  });

  it('a photo already taken opens in the viewer, and «Tomar otra» goes to its form (José 06/11)', async () => {
    // Arrange
    const photoEntry = { id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: 'ingreso' };
    const taken = { id: 'foto-ingreso', state: 'done', summary: [], values: { fotos: [{ id: 'p1', url: 'https://lila.example.com/f/p1.jpg', descripcion: 'Ingreso' }] } };
    const units = { id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 0, units: true, template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, photoEntry], items: [{ id: 'd2', title: 'Unidad 2 · QAP-102', summary: [], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30'], values: {} }, taken] }] };
    serverWith({ document: { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units] } });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-unidades'));
    // Act
    fireEvent.click(screen.getByTestId('foto-d2-foto-ingreso'));
    // Assert
    expect(screen.queryByTestId('formulario-agregar_foto_de_informe')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar otra' }));
    expect(await screen.findByTestId('formulario-agregar_foto_de_informe')).toBeInTheDocument();
  });

  it('a unit\'s extra photos sit under the fixed four: a thumbnail opens the viewer and «Agregar foto» its camera (José 07/11)', async () => {
    // Arrange
    const extraEntry = { id: 'foto-adicional', title: 'Fotos adicionales', required: false, form: 'fotos', tool: 'agregar_foto_adicional', photoKind: 'adicional' };
    const extras = { id: 'foto-adicional', state: 'done', summary: [], values: { fotos: [{ id: 'x1', url: 'https://lila.example.com/f/x1.jpg', descripcion: 'Junta', hora: '08:02' }] } };
    const units = { id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 0, canAdd: false, template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, { id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: 'ingreso' }, extraEntry], items: [{ id: 'd2', title: 'Unidad 1 · QAP-102', summary: [], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30'], values: {} }, extras] }] };
    serverWith({ document: { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units] } });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-unidades'));
    const strip = screen.getByTestId('adicionales-d2');
    // Assert
    expect(strip).toHaveTextContent('Adicionales · opcional (1)');
    expect(within(screen.getByTestId('unidad-d2')).getAllByRole('button', { name: /^Foto de/ })).toHaveLength(1);
    fireEvent.click(within(strip).getByRole('button', { name: 'Junta · 08:02' }));
    expect(await screen.findByRole('button', { name: 'Tomar otra' })).toBeInTheDocument();
    expect(screen.queryByTestId('formulario-agregar_foto_adicional')).toBeNull();
  });

  it('«Agregar foto» opens the camera of the extra photos', async () => {
    const extraEntry = { id: 'foto-adicional', title: 'Fotos adicionales', required: false, form: 'fotos', tool: 'agregar_foto_adicional', photoKind: 'adicional' };
    const units = { id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 0, canAdd: false, template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, extraEntry], items: [{ id: 'd2', title: 'Unidad 1 · QAP-102', summary: [], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30'], values: {} }] }] };
    serverWith({ document: { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units] } });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-unidades'));
    fireEvent.click(screen.getByTestId('agregar-adicional-d2'));
    expect(await screen.findByTestId('formulario-agregar_foto_adicional')).toBeInTheDocument();
  });

  it('a draft has «Ver PDF» beside «Publicar», and it asks for the preview, which publishes nothing (José 07/11)', async () => {
    // Arrange
    const calls = serverWith({ document: { ...document, id: '6aed0a1b2c3d4e5f60718293' } });
    openReport();
    // Act
    fireEvent.click(await screen.findByTestId('ver-vista-previa'));
    // Assert
    expect(screen.getByTestId('abrir-publicar')).toBeInTheDocument();
    expect(await screen.findByTestId('abrir-vista-previa')).toHaveAttribute('href', 'https://portal.example.com/vista/rep');
    expect(calls.some((call) => call.url.endsWith('/reports/6aed0a1b2c3d4e5f60718293/pdf?preview=1'))).toBe(true);
  });

  describe('taking a sent photo out of a draft (José 06/11)', () => {
    const photoEntry = { id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: 'ingreso' };
    const photos = [{ id: 'p1', url: 'https://lila.example.com/f/p1.jpg', descripcion: 'Ingreso', hora: '07:10' }, { id: 'p2', url: 'https://lila.example.com/f/p2.jpg', descripcion: 'Riego', hora: '07:20' }];
    const reportOf = () => {
      const taken = { id: 'foto-ingreso', state: 'done', summary: [], values: { fotos: photos } };
      const units = { id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 0, canAdd: false, template: [{ id: 'datos', title: 'Datos', required: true, form: 'ubicacion' }, photoEntry], items: [{ id: 'd2', title: 'Unidad 1', summary: [], results: [], sections: [{ id: 'datos', state: 'done', summary: ['Llegada 07:30'], values: {} }, taken] }] };
      return { ...document, type: 'CTL-PIS', title: 'Control de pista', sections: [document.sections[0], units] };
    };
    const openPhoto = async () => {
      const calls = serverWith({ document: reportOf() });
      openReport();
      fireEvent.click(await screen.findByTestId('seccion-unidades'));
      fireEvent.click(screen.getByTestId('foto-d2-foto-ingreso'));
      await screen.findByTestId('visor-fotos');
      return calls;
    };
    const shownPhotoId = () => photos.find((photo) => screen.getByTestId('visor-fotos').innerHTML.includes(photo.url))!.id;

    it('«Eliminar» acts on the photo on screen after moving, once confirmed', async () => {
      // Arrange
      const asked = vi.fn(() => true);
      vi.stubGlobal('confirm', asked);
      const calls = await openPhoto();
      fireEvent.keyDown(window, { key: shownPhotoId() === 'p1' ? 'ArrowRight' : 'ArrowLeft' });
      const shown = shownPhotoId();
      // Act
      fireEvent.click(screen.getByTestId('visor-eliminar'));
      // Assert
      await waitFor(() => expect(formCalls(calls)).toEqual([{ kind: 'remove_photo', report_id: document.id, photo_id: shown, forms: 3 }]));
      await waitFor(() => expect(sentCalls(calls)).toEqual([{ values: {} }]));
      expect(asked).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('visor-fotos')).toBeNull();
    });

    it('nothing goes to Portal when the person says no', async () => {
      // Arrange
      vi.stubGlobal('confirm', vi.fn(() => false));
      const calls = await openPhoto();
      // Act
      fireEvent.click(screen.getByTestId('visor-eliminar'));
      // Assert
      expect(formCalls(calls)).toEqual([]);
      expect(screen.getByTestId('visor-fotos')).toBeInTheDocument();
    });

    it('a refusal reaches the person in Portal’s words', async () => {
      // Arrange
      const told = vi.fn();
      vi.stubGlobal('confirm', vi.fn(() => true));
      vi.stubGlobal('alert', told);
      const calls = serverWith({ document: reportOf() }, { status: 422, body: { errors: { _: 'El informe ya se publicó: conserva sus fotos.' } } });
      openReport();
      fireEvent.click(await screen.findByTestId('seccion-unidades'));
      fireEvent.click(screen.getByTestId('foto-d2-foto-ingreso'));
      await screen.findByTestId('visor-fotos');
      // Act
      fireEvent.click(screen.getByTestId('visor-eliminar'));
      // Assert
      await waitFor(() => expect(told).toHaveBeenCalledWith('El informe ya se publicó: conserva sus fotos.'));
      expect(formCalls(calls)).toHaveLength(1);
    });
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

  it('what Portal refused stays on screen: «Corregir» brings the form with the error under its field, «Descartar» lets it go', async () => {
    const calls = serverWith({ document }, { status: 422, body: { errors: { campo: 'Ese valor no va' } } });
    openReport();
    fireEvent.click(await screen.findByTestId('seccion-general'));
    await screen.findByTestId('campo-campo');
    fillAndSave('Malo');
    const refused = await screen.findByText('Ese valor no va');
    expect(sentCalls(calls)).toHaveLength(1);
    const card = refused.closest('[data-testid^="rechazo-"]')!;
    expect(card).toHaveTextContent('Datos generales');
    const key = card.getAttribute('data-testid')!.replace('rechazo-', '');
    expect(screen.getByTestId('seccion-general')).toHaveTextContent('Error');
    fireEvent.click(screen.getByTestId(`corregir-${key}`));
    expect(await screen.findByTestId('campo-campo')).toHaveValue('Malo');
    expect(screen.getAllByText('Ese valor no va').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByLabelText('Cerrar'));
    fireEvent.click(screen.getByTestId(`descartar-${key}`));
    await vi.waitFor(() => expect(screen.queryByTestId(`rechazo-${key}`)).toBeNull());
    expect(screen.getByTestId('seccion-general')).toHaveTextContent('Lista');
  });

  it('with no network the report opens with the last one kept, a save waits, and «Publicar» says why it cannot', async () => {
    serverWith({ document: { ...document, publish: { label: 'Publicar informe', missing: [] } } });
    const first = openReport();
    await screen.findByTestId('seccion-general');
    first.unmount();

    noNetwork();
    openReport();
    expect(await screen.findByTestId('linea-cola')).toHaveTextContent('Sin señal. Lo que guardes sale solo cuando vuelva.');
    expect(screen.getByTestId('falta-informe')).toHaveTextContent('Publicar necesita señal.');
    fireEvent.click(screen.getByTestId('seccion-general'));
    await screen.findByTestId('campo-campo');
    fillAndSave('Sin señal');
    await vi.waitFor(() => expect(screen.getByTestId('seccion-general')).toHaveTextContent('Pendiente de enviar'));
    expect(await screen.findByTestId('linea-cola')).toHaveTextContent('1 cambio sin enviar. Sale solo cuando vuelva la señal.');
    expect(screen.getByTestId('falta-informe')).toHaveTextContent('Hay cambios sin enviar.');
    fireEvent.click(screen.getByTestId('abrir-publicar'));
    expect(screen.getByTestId('confirmar-publicar')).toBeDisabled();
  });

  it('never opened and with no network, it says what to do', async () => {
    noNetwork();
    openReport();
    expect(await screen.findByTestId('informe-fallo')).toHaveTextContent('Abre este informe una vez con señal');
  });

  it('a refusal shows the server’s message and the service in Portal', async () => {
    serverWith({ error: 'not_found', message: 'Ese servicio ya no está en el Portal.' });
    render(<ReportDocumentWeb target={target} chatId="chat-1" service={service} type="CTL-IMP" portalUrl="https://portal.constroad.com/s/318" onClose={() => undefined} />);
    expect(await screen.findByTestId('informe-fallo')).toHaveTextContent('Ese servicio ya no está en el Portal.');
    expect(screen.getByTestId('informe-reintentar')).toHaveTextContent('Reintentar');
    expect(screen.getByTestId('informe-fallo-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    expect(screen.queryByTestId('abrir-publicar')).toBeNull();
  });
});
