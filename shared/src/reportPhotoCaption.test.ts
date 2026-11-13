import { describe, expect, it } from 'vitest';
import { fieldDocumentOf } from './fieldDocument.js';
import { reportFormAnswer } from './reportSaves.js';

/**
 * José 12/11, on the WhatsApp of a CTL-PIS photo that said only «Ingreso»: the description says
 * which stage the photo is (ingreso, temperatura, escantillón, vacía), the unit's order of arrival
 * at the paver and its plate.
 */
const photosForm = { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción', maxLength: 200 } }, required: ['foto'] };
const photoEntry = (kind: string, title: string) => ({ id: `foto-${kind}`, title, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind });
const shot = (hora: string, descripcion = '') => ({ fotos: [{ id: `p-${hora}`, url: 'https://lila.example/p.jpg', hora, descripcion }] });
const unit = (id: string, title: string, ingresoAt?: string) => ({ id, title, summary: [], results: [], sections: ingresoAt ? [{ id: 'foto-ingreso', state: 'done', values: shot(ingresoAt) }] : [] });
const pista = (items: unknown[]) => fieldDocumentOf({
  id: null, type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
  forms: { fotos: photosForm },
  sections: [{
    id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'empty', summary: [], itemTitle: 'Unidad', addLabel: '', canAdd: false, min: 1,
    template: [photoEntry('ingreso', 'Foto de ingreso'), photoEntry('temperatura', 'Temperatura'), photoEntry('escantillon', 'Foto del escantillón'), photoEntry('vacia', 'Vacía')],
    items,
  }],
  publish: { label: 'Publicar informe', missing: [], warnings: [] },
})!;
const captionOf = (document: ReturnType<typeof pista>, itemId: string, key: string) =>
  reportFormAnswer(document, { sectionId: 'unidades', itemId, key })?.response?.form?.schema.properties.descripcion?.default;

describe('the description a unit photo suggests', () => {
  it('names the stage, the order of arrival at the paver and the plate', () => {
    // Arrange: D5N-227 arrived first (07:40), F2K-908 second (08:02), B7M-604 not yet.
    const document = pista([unit('u1', 'Unidad 1 · F2K-908', '08:02'), unit('u2', 'Unidad 2 · D5N-227', '07:40'), unit('u3', 'Unidad 3 · B7M-604')]);
    // Act + Assert
    expect(captionOf(document, 'u2', 'foto-ingreso')).toBe('Ingreso · llegada n.º 1 a descarga · D5N-227');
    expect(captionOf(document, 'u1', 'foto-escantillon')).toBe('Escantillón · llegada n.º 2 a descarga · F2K-908');
    expect(captionOf(document, 'u3', 'foto-ingreso')).toBe('Ingreso · llegada n.º 3 a descarga · B7M-604');
    expect(captionOf(document, 'u1', 'foto-vacia')).toBe('Vacía · llegada n.º 2 a descarga · F2K-908');
  });

  it('a plate alone is the plate, and a description already written stays', () => {
    // Arrange
    const written = { id: 'u1', title: 'F2K-908', summary: [], results: [], sections: [{ id: 'foto-temperatura', state: 'empty', values: { descripcion: 'Llegó con lona' } }] };
    const document = pista([written]);
    // Act + Assert
    expect(captionOf(document, 'u1', 'foto-ingreso')).toBe('Ingreso · llegada n.º 1 a descarga · F2K-908');
    expect(captionOf(document, 'u1', 'foto-temperatura')).toBe('Llegó con lona');
  });
});
