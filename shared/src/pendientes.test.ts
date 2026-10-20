import { describe, expect, it } from 'vitest';
import { estadoDelEvento, lineaDePendientes, origenDelRecordatorio } from './pendientes.js';
import type { AgendaEvent, AgendaReminder } from './tiposDeAgenda.js';

/** «Pendientes» (José aprobó el 20/10): eventos y recordatorios en una línea, por cuándo tocan. */
const ahora = new Date(2026, 9, 20, 10, 0); // martes 20/10, 10:00 (hora local)
const evento = (id: string, startsAt: Date): AgendaEvent => ({ id, chatId: 'c1', title: id, startsAt: startsAt.toISOString(), rsvpSummary: { yes: 0, maybe: 0, no: 0, pending: 1 }, myRsvp: null, mio: false });
const recordatorio = (id: string, startsAt: Date, recurrence: AgendaReminder['recurrence'] = 'once', active = true): AgendaReminder => ({ _id: id, title: id, startsAt: startsAt.toISOString(), recurrence, active });

describe('lineaDePendientes', () => {
  it('reparte por día: Hoy, Mañana, Esta semana y Más adelante, cada una en orden', () => {
    const secciones = lineaDePendientes({
      eventos: [evento('almuerzo', new Date(2026, 9, 20, 13, 0)), evento('cumple', new Date(2026, 9, 30, 20, 0))],
      recordatorios: [recordatorio('agua', new Date(2026, 9, 20, 11, 0)), recordatorio('pagar', new Date(2026, 9, 21, 9, 0)), recordatorio('reunion', new Date(2026, 9, 23, 18, 0))],
      vencidos: [],
      ahora,
    });
    expect(secciones.map((s) => [s.titulo, s.items.map((i) => i.id)])).toEqual([
      ['Hoy', ['agua', 'almuerzo']],
      ['Mañana', ['pagar']],
      ['Esta semana', ['reunion']],
      ['Más adelante', ['cumple']],
    ]);
  });

  it('un recordatorio que se repite cae en su PRÓXIMA vez, no en su primera fecha', () => {
    const [hoy] = lineaDePendientes({ eventos: [], recordatorios: [recordatorio('pastilla', new Date(2026, 8, 1, 21, 0), 'daily')], vencidos: [], ahora });
    expect(hoy?.titulo).toBe('Hoy');
    expect(hoy?.items[0]?.cuando.getHours()).toBe(21);
    expect(hoy?.items[0]?.cuando.getDate()).toBe(20);
  });

  it('«Vencidos» va primero, del más reciente; las secciones vacías no salen', () => {
    const secciones = lineaDePendientes({
      eventos: [],
      recordatorios: [],
      vencidos: [recordatorio('luz', new Date(2026, 9, 20, 8, 0), 'once', false), recordatorio('agua', new Date(2026, 9, 19, 18, 0), 'once', false)],
      ahora,
    });
    expect(secciones.map((s) => [s.clave, s.items.map((i) => i.id)])).toEqual([['vencidos', ['luz', 'agua']]]);
  });

  it('nada pendiente = ninguna sección', () => {
    expect(lineaDePendientes({ eventos: [], recordatorios: [], vencidos: [], ahora })).toEqual([]);
  });
});

describe('origenDelRecordatorio', () => {
  const agenda = new Map([['902049935', 'Wilson Zamora']]);
  it('dice de dónde viene: mío, de un grupo o de un 1:1 (con el nombre de MI agenda)', () => {
    expect(origenDelRecordatorio({ agenda })).toBe('Solo para ti');
    expect(origenDelRecordatorio({ chat: { kind: 'group', name: 'Obra' }, agenda })).toBe('En «Obra»');
    expect(origenDelRecordatorio({ chat: { kind: 'direct', name: 'Wil', phone: '902049935' }, agenda })).toBe('Con Wilson Zamora');
  });
});

describe('estadoDelEvento', () => {
  it('la pastilla del evento: creado por mí, mi respuesta o «Sin responder»', () => {
    expect(estadoDelEvento({ mio: true, myRsvp: null })).toEqual({ texto: 'Creado por ti', tono: 'propio' });
    expect(estadoDelEvento({ mio: false, myRsvp: null })).toEqual({ texto: 'Sin responder', tono: 'pendiente' });
    expect(estadoDelEvento({ mio: false, myRsvp: 'yes' })).toEqual({ texto: 'Voy', tono: 'ok' });
    expect(estadoDelEvento({ mio: false, myRsvp: 'no' })).toEqual({ texto: 'No voy', tono: 'neutro' });
  });
});
