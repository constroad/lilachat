import { describe, expect, it } from 'vitest';
import { fieldDocumentOf, type FieldDocument, type SectionPath } from './fieldDocument';
import { applySave, blankDocumentOf, documentWithQueue, judgeFailure, judgeNotice, judgeReply, landedBefore, newItemOf, nextSave, pendingOf, photosLine, queueLine, queueSave, reportFormAnswer, reportKeyOf, reportSaveOf, resolveItem, savesOf, sectionPhotos, sectionRowLine, sentMarkOf, withoutSave, type ReportRef, type ReportSave } from './reportSaves';

const photosForm = { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción', maxLength: 200 } }, required: ['foto'] };
const textForm = (name: string) => ({ type: 'object', properties: { [name]: { type: 'string', title: name } }, required: [name] });

/** A CTL-IMP as Portal answers it: the repeat flat beside `kind`, a tramo with its photo. */
const body = {
  id: 'r1', type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: textForm('liquido'), ubicacion: textForm('tramo'), bandejas: textForm('peso'), fotos: photosForm, firmas: textForm('nombre') },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: ['MC-30'], results: [], form: 'general', values: { liquido: 'MC-30' } },
    {
      id: 'tramos', kind: 'repeat', title: 'Tramos', required: true, state: 'partial', summary: ['1 tramo'], itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1,
      template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }],
      items: [{ id: 't1', title: 'Tramo 1', summary: ['Km 12'], results: [{ label: 'Tasa', value: '1 lt/m²', tone: 'ok' }], sections: [{ id: 'ubicacion', state: 'done', values: { tramo: 'Km 12' } }, { id: 'bandejas', state: 'empty', values: {} }, { id: 'fotos', state: 'done', values: { fotos: [{ id: 'f1', url: 'https://x/1.jpg', thumb_url: 'https://x/1t.jpg', descripcion: 'Inicio', hora: '10:02' }] } }] }],
    },
    { id: 'firmas', title: 'Firmas', required: false, state: 'empty', summary: [], results: [], form: 'firmas', values: {} },
  ],
  publish: { label: 'Publicar informe', missing: [] },
};
const parsed = (): FieldDocument => fieldDocumentOf(body)!;
const empty = (): FieldDocument => ({ ...blankDocumentOf(parsed()) });

const ref: ReportRef = { spaceId: 's1', clientId: 'c1', chatId: 'ch1', serviceId: 'sv1', type: 'CTL-IMP' };
const bandejas: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'bandejas' };
const photosPath: SectionPath = { sectionId: 'tramos', itemId: 't1', key: 'fotos' };
const newTramo: SectionPath = { sectionId: 'tramos', itemId: null, key: 'ubicacion' };
const saveAt = (path: SectionPath, clientKey: string, values = {}, document = parsed()): ReportSave => reportSaveOf({ ref, document, path, values, clientKey, now: '2026-11-05T10:00:00.000Z' });
const photoSave = (clientKey: string, path = photosPath): ReportSave => ({ ...saveAt(path, clientKey, { foto: 'ref-1', descripcion: 'Riego' }), photo: { field: 'foto', ref: `ref-${clientKey}`, mime: 'image/jpeg', preview: `file://${clientKey}.jpg` }, place: { at: '2026-11-05T10:00:00.000Z' } });

describe('reportSaveOf', () => {
  it('a section of the report keeps its path, its report and its title', () => {
    expect(saveAt(bandejas, 'k1', { peso: 'a' })).toMatchObject({ clientKey: 'k1', reportId: 'r1', path: bandejas, title: 'Tramo 1 · Bandejas', values: { peso: 'a' }, attempts: 0 });
  });

  it('a new tramo gets a local id, and it says the save creates it', () => {
    const save = saveAt(newTramo, 'k2', { tramo: 'Km 13' });
    expect(save.path.itemId).toBe('local-k2');
    expect(save.createsItem).toBe(true);
  });
});

describe('queueSave', () => {
  it('keeps one save per section, the newest, in the order they first came', () => {
    const queue = queueSave(queueSave(queueSave([], saveAt(bandejas, 'a', { peso: '1' })), saveAt(photosPath, 'b')), saveAt(bandejas, 'c', { peso: '2' }));
    expect(queue.map((one) => one.clientKey)).toEqual(['c', 'b']);
    expect(queue[0]?.values).toEqual({ peso: '2' });
  });

  it('a photo is its own write: two photos of a tramo both stay', () => {
    expect(queueSave(queueSave([], photoSave('a')), photoSave('b'))).toHaveLength(2);
  });

  it('editing a tramo not sent yet leaves it as the save that creates it', () => {
    const first = saveAt(newTramo, 'a', { tramo: 'Km 13' });
    const edited = saveAt(first.path, 'b', { tramo: 'Km 14' });
    const [only] = queueSave([first], edited);
    expect(only).toMatchObject({ clientKey: 'b', createsItem: true, values: { tramo: 'Km 14' } });
  });

  it('a new version of a refused section is a clean attempt', () => {
    const refused = { ...saveAt(bandejas, 'a'), refusal: { message: 'No', errors: {} }, attempts: 3 };
    const [only] = queueSave([refused], saveAt(bandejas, 'b'));
    expect(only?.refusal).toBeUndefined();
    expect(only?.attempts).toBe(0);
  });
});

describe('applySave', () => {
  it('a section shows what was saved, pending, before Portal answers', () => {
    const section = documentWithQueue(parsed(), [saveAt(bandejas, 'k1', { peso: '9' })]).sections[1];
    const one = section?.kind === 'repeat' ? section.items[0]?.sections[1] : null;
    expect(one).toMatchObject({ values: { peso: '9' }, state: 'partial', pending: 'k1' });
  });

  it('a tramo not sent yet shows as one more, numbered, on the template', () => {
    const section = documentWithQueue(parsed(), [saveAt(newTramo, 'k1', { tramo: 'Km 13' })]).sections[1];
    const item = section?.kind === 'repeat' ? section.items[1] : null;
    expect(item).toMatchObject({ id: 'local-k1', title: 'Tramo 2' });
    expect(item?.sections.map((one) => one.id)).toEqual(['ubicacion', 'bandejas', 'fotos']);
    expect(item?.sections[0]).toMatchObject({ values: { tramo: 'Km 13' }, pending: 'k1' });
  });

  it('the saves of a local tramo land on it, in order', () => {
    const first = saveAt(newTramo, 'k1', { tramo: 'Km 13' });
    const second = saveAt({ ...bandejas, itemId: first.path.itemId }, 'k2', { peso: '4' });
    const section = documentWithQueue(parsed(), [first, second]).sections[1];
    expect(section?.kind === 'repeat' ? section.items[1]?.sections[1] : null).toMatchObject({ values: { peso: '4' }, pending: 'k2' });
  });

  it('a photo joins the tramo\'s photos with its local preview, marked pending', () => {
    const section = documentWithQueue(parsed(), [photoSave('k1'), photoSave('k2')]).sections[1];
    const leaf = section?.kind === 'repeat' ? section.items[0]?.sections[2] : undefined;
    expect(sectionPhotos(leaf!)).toEqual([
      { id: 'f1', url: 'https://x/1.jpg', thumbUrl: 'https://x/1t.jpg', caption: 'Inicio', hour: '10:02', pending: false },
      { id: 'k1', url: 'file://k1.jpg', thumbUrl: 'file://k1.jpg', caption: 'Riego', hour: '', pending: true },
      { id: 'k2', url: 'file://k2.jpg', thumbUrl: 'file://k2.jpg', caption: 'Riego', hour: '', pending: true },
    ]);
  });

  it('the first save of a report opens the sections Portal keeps closed until it exists', () => {
    const document = applySave(empty(), saveAt({ sectionId: 'general', itemId: null, key: 'general' }, 'k1', { liquido: 'MC-30' }, empty()));
    expect(document.sections.map((one) => one.enabled)).toEqual([true, true, true]);
  });

  it('a refused section reads as an error, not as pending', () => {
    const refused = { ...saveAt(bandejas, 'k1'), refusal: { message: 'Falta el peso', errors: { peso: 'Falta el peso' } } };
    const section = documentWithQueue(parsed(), [refused]).sections[1];
    expect(section?.kind === 'repeat' ? section.items[0]?.sections[1]?.state : null).toBe('error');
  });
});

describe('sectionPhotos', () => {
  it('reads only what has a url, and says how many there are', () => {
    const section = parsed().sections[1];
    const leaf = section?.kind === 'repeat' ? section.items[0]?.sections[2] : undefined;
    expect(photosLine(leaf!)).toBe('1 foto');
    expect(photosLine({ ...leaf!, values: { fotos: [{ id: 'x' }] } })).toBe('0 fotos');
    expect(photosLine({ ...leaf!, values: { fotos: [{ url: 'a' }, { url: 'b' }] } })).toBe('2 fotos');
  });
});

describe('blankDocumentOf', () => {
  it('leaves the forms and nothing of the report it came from', () => {
    const blank = blankDocumentOf({ ...parsed(), status: 'published', publish: { label: 'Republicar informe', missing: ['x'] } });
    expect(blank).toMatchObject({ id: null, status: 'draft', publish: { label: 'Publicar informe', missing: [] } });
    expect(Object.keys(blank.forms)).toEqual(['general', 'ubicacion', 'bandejas', 'fotos', 'firmas']);
    expect(JSON.stringify(blank.sections)).not.toContain('Km 12');
    expect(JSON.stringify(blank.sections)).not.toContain('MC-30');
    expect(blank.sections.map((one) => one.enabled)).toEqual([true, false, false]);
  });
});

describe('nextSave', () => {
  it('takes the first one, skipping what was refused', () => {
    const queue = [{ ...saveAt(bandejas, 'a'), refusal: { message: 'No', errors: {} } }, saveAt(photosPath, 'b')];
    expect(nextSave(queue, parsed())?.clientKey).toBe('b');
    expect(nextSave([], parsed())).toBeNull();
  });

  it('what hangs from a tramo that was refused waits with it', () => {
    const tramo = { ...saveAt(newTramo, 'a'), refusal: { message: 'No', errors: {} } };
    const inside = saveAt({ ...bandejas, itemId: tramo.path.itemId }, 'b');
    expect(nextSave([tramo, inside], parsed())).toBeNull();
  });

  it('while the report does not exist only its first section goes', () => {
    const general = saveAt({ sectionId: 'general', itemId: null, key: 'general' }, 'a', {}, empty());
    const firmas = saveAt({ sectionId: 'firmas', itemId: null, key: 'firmas' }, 'b', {}, empty());
    expect(nextSave([firmas, general], empty())?.clientKey).toBe('a');
    expect(nextSave([{ ...general, refusal: { message: 'No', errors: {} } }, firmas], empty())).toBeNull();
  });
});

describe('what a lost answer left behind', () => {
  it('a tramo that showed up since the write went out landed, and says its id', () => {
    const save = { ...saveAt(newTramo, 'a'), sent: { items: ['t0'], photos: 0 } };
    expect(landedBefore(save, parsed())).toEqual({ itemId: 't1' });
    expect(landedBefore({ ...save, sent: { items: ['t1'], photos: 0 } }, parsed())).toBeNull();
  });

  it('a photo landed when the tramo has more than it had', () => {
    const save = { ...photoSave('a'), sent: { items: [], photos: 0 } };
    expect(landedBefore(save, parsed())).toEqual({ itemId: null });
    expect(landedBefore({ ...save, sent: { items: [], photos: 1 } }, parsed())).toBeNull();
  });

  it('a save never sent, or a plain section, proves nothing: writing it again changes nothing', () => {
    expect(landedBefore(photoSave('a'), parsed())).toBeNull();
    expect(landedBefore({ ...saveAt(bandejas, 'a'), sent: { items: [], photos: 0 } }, parsed())).toBeNull();
  });

  it('the mark is taken once, from the document as it was', () => {
    expect(sentMarkOf(photoSave('a'), parsed())).toEqual({ items: ['t1'], photos: 1 });
    const again = { ...photoSave('a'), sent: { items: [], photos: 0 } };
    expect(sentMarkOf(again, parsed())).toEqual({ items: [], photos: 0 });
  });
});

describe('judging an answer', () => {
  it('no network, a timeout, a limit or a server down wait; 401 empties; the rest is a refusal', () => {
    expect(judgeFailure({}).kind).toBe('retry');
    expect(judgeFailure({ status: 0 }).kind).toBe('retry');
    expect(judgeFailure({ status: 408 }).kind).toBe('retry');
    expect(judgeFailure({ status: 429 }).kind).toBe('retry');
    expect(judgeFailure({ status: 502 }).kind).toBe('retry');
    expect(judgeFailure({ status: 401 }).kind).toBe('flush');
    expect(judgeFailure({ status: 404, message: 'Ya no está' })).toEqual({ kind: 'refuse', refusal: { message: 'Ya no está', errors: {} } });
    expect(judgeFailure({ status: 409 })).toMatchObject({ kind: 'refuse' });
  });

  it('a form answered is confirmed; Portal down is another try; its errors are field by field', () => {
    const base = { commandId: 'c', appId: 'a', appName: 'Portal' };
    expect(judgeReply({ ok: true, outcome: { ...base, outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Guardado' } } }).kind).toBe('confirm');
    expect(judgeReply({ ok: true, outcome: { ...base, outcome: 'failed', message: 'x' } }).kind).toBe('retry');
    expect(judgeReply({ ok: false, errors: { peso: 'Falta el peso' } })).toEqual({ kind: 'refuse', refusal: { message: 'Falta el peso', errors: { peso: 'Falta el peso' } } });
    expect(judgeReply({ ok: false, errors: { _: 'Ese tramo no está', peso: 'x' } })).toMatchObject({ refusal: { message: 'Ese tramo no está' } });
    expect(judgeReply({ ok: false, message: 'Sin conexión' }).kind).toBe('retry');
    expect(judgeReply({ ok: false, status: 410, message: 'La app ya no está' }).kind).toBe('refuse');
  });
});

describe('a late answer', () => {
  it('none in time waits; the app\'s errors are a refusal; anything else is done', () => {
    const notice = { commandId: 'c', appId: 'a', appName: 'Portal', response: { responseType: 'ephemeral' as const, text: 'Guardado' } };
    expect(judgeNotice(null).kind).toBe('retry');
    expect(judgeNotice(notice).kind).toBe('confirm');
    expect(judgeNotice({ ...notice, errors: { peso: 'Falta' } })).toMatchObject({ kind: 'refuse', refusal: { message: 'Falta' } });
  });
});

describe('resolveItem', () => {
  it('what hung from the local tramo goes to the real one, and nothing creates it again', () => {
    const creator = saveAt(newTramo, 'a');
    const inside = saveAt({ ...bandejas, itemId: creator.path.itemId }, 'b');
    const [one, two] = resolveItem([creator, inside], creator.path.itemId!, 't9');
    expect(one?.path.itemId).toBe('t9');
    expect(one?.createsItem).toBeUndefined();
    expect(two?.path.itemId).toBe('t9');
  });
});

describe('withoutSave', () => {
  it('discarding a tramo takes what hangs from it', () => {
    const creator = saveAt(newTramo, 'a');
    const inside = saveAt({ ...bandejas, itemId: creator.path.itemId }, 'b');
    const other = saveAt(bandejas, 'c');
    expect(withoutSave([creator, inside, other], 'a').map((one) => one.clientKey)).toEqual(['c']);
    expect(withoutSave([creator, inside, other], 'b').map((one) => one.clientKey)).toEqual(['a', 'c']);
  });
});

describe('the tramo Portal makes with a new report', () => {
  const seeded = (state: string) => fieldDocumentOf({ ...body, sections: body.sections.map((one) => (one.id === 'tramos' ? { ...one, items: [{ id: 'control-1', title: 'Tramo 1', summary: [], results: [], sections: [{ id: 'ubicacion', state, values: {} }, { id: 'bandejas', state: 'empty', values: {} }] }] } : one)) })!;
  const firstTramo = (): ReportSave => saveAt(newTramo, 'k', { tramo: 'Km 1' }, empty());

  it('the first tramo of a report not made yet says it fills that one', () => {
    expect(firstTramo().fillsSeed).toBe(true);
  });

  it('a tramo of a report that exists is a new tramo: the person saw the one that is there', () => {
    expect(saveAt(newTramo, 'k', { tramo: 'Km 1' }).fillsSeed).toBeUndefined();
  });

  it('a second tramo of a report not made yet is a new tramo too', () => {
    const shown = documentWithQueue(empty(), [firstTramo()]);
    expect(saveAt(newTramo, 'k2', { tramo: 'Km 2' }, shown).fillsSeed).toBeUndefined();
  });

  it('correcting it before it leaves keeps that it fills the seed', () => {
    const save = firstTramo();
    const again = saveAt(save.path, 'k3', { tramo: 'Km 1+500' }, documentWithQueue(empty(), [save]));
    expect(queueSave([save], again)[0]).toMatchObject({ createsItem: true, fillsSeed: true, values: { tramo: 'Km 1+500' } });
  });

  it('takes the empty tramo, and the id is known with no need to read it back', () => {
    const sent = sentMarkOf(firstTramo(), seeded('empty'));
    expect(sent.seed).toBe('control-1');
    expect(newItemOf(firstTramo(), seeded('done'), sent)).toBe('control-1');
  });

  it('a tramo somebody already wrote is left alone', () => {
    expect(sentMarkOf(firstTramo(), seeded('partial')).seed).toBeUndefined();
  });

  it('with its answer lost it is sent again: writing the same section twice changes nothing', () => {
    const sent = sentMarkOf(firstTramo(), seeded('empty'));
    expect(landedBefore({ ...firstTramo(), sent }, seeded('done'))).toBeNull();
  });
});

describe('the report form on the phone', () => {
  it('is the section\'s form with what was refused under each field', () => {
    const answer = reportFormAnswer(parsed(), bandejas, { peso: 'Falta el peso' });
    expect(answer).toMatchObject({ appName: 'Portal', state: 'form', action: 'Tramo 1 · Bandejas', errors: { peso: 'Falta el peso' }, response: { responseType: 'form', form: { id: 'guardar_seccion_de_informe' } } });
  });

  describe('general data (José, 06/11)', () => {
    const generalPath: SectionPath = { sectionId: 'general', itemId: null, key: 'general' };
    const generalForm = { type: 'object', properties: { responsable: { type: 'string', title: 'Responsable' }, ubicacion: { type: 'string', title: 'Ubicación' } }, required: ['responsable'] };
    const withGeneral = (values: Record<string, string>) => fieldDocumentOf({ ...body, forms: { ...body.forms, general: generalForm }, sections: [{ ...body.sections[0], values }, ...body.sections.slice(1)] })!;
    const propertiesOf = (answer: ReturnType<typeof reportFormAnswer>) => (answer?.response.responseType === 'form' ? answer.response.form.schema.properties : undefined);

    it('the person who makes the report is its responsible', () => {
      expect(propertiesOf(reportFormAnswer(withGeneral({}), generalPath, undefined, 'Ana Torres'))?.responsable).toMatchObject({ default: 'Ana Torres' });
    });

    it('a responsible already saved stays', () => {
      expect(propertiesOf(reportFormAnswer(withGeneral({ responsable: 'Luis Vega' }), generalPath, undefined, 'Ana Torres'))?.responsable).toMatchObject({ default: 'Luis Vega' });
    });

    it('with no name the field stays empty to be typed', () => {
      expect(propertiesOf(reportFormAnswer(withGeneral({}), generalPath, undefined, ' '))?.responsable).not.toHaveProperty('default');
    });

    it('the place can be taken from the device', () => {
      expect(propertiesOf(reportFormAnswer(withGeneral({}), generalPath))?.ubicacion).toMatchObject({ 'x-input': 'place' });
    });

    it('a tramo\'s section with the same name stays as it is', () => {
      expect(propertiesOf(reportFormAnswer(parsed(), bandejas, undefined, 'Ana Torres'))?.responsable).toBeUndefined();
    });
  });

  it('two sections are two forms, and a path that is not there is none', () => {
    expect(reportFormAnswer(parsed(), bandejas)?.commandId).not.toBe(reportFormAnswer(parsed(), photosPath)?.commandId);
    expect(reportFormAnswer(parsed(), { sectionId: 'x', itemId: null, key: 'x' })).toBeNull();
  });
});

describe('what the cards say', () => {
  const tramos = () => { const one = parsed().sections[1]; if (one?.kind !== 'repeat') throw new Error('no repeat'); return one; };

  it('a row says what waits, then how many photos, then what Portal summed up', () => {
    const [ubicacion, bandejasLeaf, photos] = tramos().items[0]!.sections;
    expect(sectionRowLine(photos!)).toBe('1 foto');
    expect(sectionRowLine(bandejasLeaf!)).toBe('Falta');
    expect(sectionRowLine({ ...ubicacion!, summary: ['Carril derecho'] })).toBe('Carril derecho');
    expect(sectionRowLine({ ...photos!, pending: 'k1' })).toBe('Pendiente de enviar');
  });

  it('a card waits while any of its tramos does', () => {
    expect(pendingOf(tramos())).toBeUndefined();
    const waiting = documentWithQueue(parsed(), [saveAt(bandejas, 'k1')]).sections[1]!;
    expect(pendingOf(waiting)).toBe('k1');
    expect(pendingOf({ ...parsed().sections[0]!, kind: 'form', pending: 'k2' } as never)).toBe('k2');
  });
});

describe('lines and keys', () => {
  it('counts what waits, and says why', () => {
    expect(queueLine(0, true)).toBe('Sin señal. Lo que guardes sale solo cuando vuelva.');
    expect(queueLine(1, false)).toBe('1 cambio enviándose');
    expect(queueLine(3, false)).toBe('3 cambios enviándose');
    expect(queueLine(1, true)).toBe('1 cambio sin enviar. Sale solo cuando vuelva la señal.');
    expect(queueLine(2, true)).toBe('2 cambios sin enviar. Salen solos cuando vuelva la señal.');
  });

  it('a report is its space, client, service and type; the chat does not change it', () => {
    expect(reportKeyOf(ref)).toBe(reportKeyOf({ ...ref, chatId: 'otro' }));
    expect(reportKeyOf(ref)).not.toBe(reportKeyOf({ ...ref, serviceId: 'otro' }));
    expect(savesOf([saveAt(bandejas, 'a')], ref)).toHaveLength(1);
    expect(savesOf([saveAt(bandejas, 'a')], { ...ref, serviceId: 'otro' })).toHaveLength(0);
  });
});
