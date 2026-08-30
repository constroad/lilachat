import { describe, expect, it } from 'vitest';
import {
  DELIVERY_GLYPH,
  formatChatTimestamp,
  formatClock,
  formatDayLabel,
  groupsWithPrevious,
  resolveChatPreview,
  resolveDeliveryState,
  startsNewDay,
  esAcuseDeOtro,
} from './chatDisplay.js';

describe('formatClock', () => {
  it('da la hora de reloj que el diseño muestra bajo cada mensaje', () => {
    expect(formatClock('2026-08-20T15:42:00.000Z')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('una fecha inválida no rompe la burbuja: devuelve vacío', () => {
    expect(formatClock('no es fecha')).toBe('');
  });
});

describe('formatDayLabel', () => {
  const now = new Date('2026-08-20T18:00:00.000Z');

  it('hoy y ayer se nombran, el resto va con fecha', () => {
    expect(formatDayLabel('2026-08-20T09:00:00.000Z', now)).toBe('Hoy');
    expect(formatDayLabel('2026-08-19T23:50:00.000Z', now)).toBe('Ayer');
    expect(formatDayLabel('2026-08-02T10:00:00.000Z', now)).toMatch(/2/);
  });

  /**
   * Por día CALENDARIO, no por horas transcurridas: a las 00:30 el mensaje de
   * las 23:50 es de ayer aunque hayan pasado 40 minutos.
   */
  it('cruzar la medianoche cambia el día aunque falte poco', () => {
    const medianoche = new Date('2026-08-20T00:30:00');
    const anoche = new Date('2026-08-19T23:50:00');

    expect(formatDayLabel(anoche, medianoche)).toBe('Ayer');
  });
});

describe('startsNewDay', () => {
  it('el primer mensaje siempre abre día', () => {
    expect(startsNewDay('2026-08-20T10:00:00')).toBe(true);
  });

  it('dos del mismo día no repiten el separador', () => {
    expect(startsNewDay('2026-08-20T18:00:00', '2026-08-20T10:00:00')).toBe(false);
  });
});

describe('resolveDeliveryState', () => {
  /**
   * Los acuses ya existían en el server desde F2 (cursor `readSeq`) y la
   * pantalla no los mostraba. Esta función es el puente que faltaba.
   */
  it('leído cuando el cursor del otro alcanzó ese seq', () => {
    expect(resolveDeliveryState({ seq: 5, otherReadSeq: 7, otherDeliveredSeq: 7 })).toBe('read');
    expect(resolveDeliveryState({ seq: 5, otherReadSeq: 5, otherDeliveredSeq: 5 })).toBe('read');
  });

  it('entregado pero no leído', () => {
    expect(resolveDeliveryState({ seq: 5, otherReadSeq: 3, otherDeliveredSeq: 6 })).toBe('delivered');
  });

  it('enviado cuando el otro todavía no lo recibió', () => {
    expect(resolveDeliveryState({ seq: 9, otherReadSeq: 3, otherDeliveredSeq: 4 })).toBe('sent');
  });

  it('sin seq todavía está en la cola', () => {
    expect(resolveDeliveryState({ seq: null, otherReadSeq: 0, otherDeliveredSeq: 0 })).toBe('pending');
  });

  it('cada estado tiene su glifo, y leído se distingue de entregado por color', () => {
    expect(DELIVERY_GLYPH.sent).toBe('✓');
    expect(DELIVERY_GLYPH.delivered).toBe('✓✓');
    expect(DELIVERY_GLYPH.read).toBe('✓✓');
  });
});

describe('groupsWithPrevious', () => {
  it('mismo emisor y poco tiempo: se agrupan', () => {
    expect(
      groupsWithPrevious({
        senderId: 'a',
        at: '2026-08-20T10:02:00',
        previousSenderId: 'a',
        previousAt: '2026-08-20T10:00:00',
      })
    ).toBe(true);
  });

  it('cambia el emisor: bloque nuevo', () => {
    expect(
      groupsWithPrevious({
        senderId: 'b',
        at: '2026-08-20T10:02:00',
        previousSenderId: 'a',
        previousAt: '2026-08-20T10:00:00',
      })
    ).toBe(false);
  });

  it('un silencio largo corta el bloque aunque hable el mismo', () => {
    expect(
      groupsWithPrevious({
        senderId: 'a',
        at: '2026-08-20T12:00:00',
        previousSenderId: 'a',
        previousAt: '2026-08-20T10:00:00',
      })
    ).toBe(false);
  });
});

describe('formatChatTimestamp', () => {
  const now = new Date('2026-08-20T18:00:00');

  /**
   * El diseño NO usa el reloj para todo. Con el reloj en todas las filas, una
   * conversación de hace tres semanas se ve igual que una de hace diez minutos.
   */
  it('hoy va con reloj', () => {
    expect(formatChatTimestamp(new Date('2026-08-20T10:42:00'), now)).toMatch(/10:42/);
  });

  it('ayer se nombra', () => {
    expect(formatChatTimestamp(new Date('2026-08-19T23:00:00'), now)).toBe('Ayer');
  });

  it('dentro de la semana, el día', () => {
    expect(formatChatTimestamp(new Date('2026-08-16T12:00:00'), now)).toMatch(/^[A-ZÁ-Ú]/);
    expect(formatChatTimestamp(new Date('2026-08-16T12:00:00'), now).length).toBeLessThan(5);
  });

  it('más atrás, la fecha', () => {
    expect(formatChatTimestamp(new Date('2026-02-12T12:00:00'), now)).toMatch(/12/);
  });
});

describe('resolveChatPreview', () => {
  /** El socket emite `typing` desde F2 y la lista no lo mostraba. */
  it('escribiendo gana sobre el último mensaje, y va en cursiva de acento', () => {
    expect(resolveChatPreview({ typing: true, lastBody: 'hola' })).toEqual({
      text: 'Escribiendo…',
      style: 'typing',
    });
  });

  it('sin texto pero con media, dice QUÉ llegó', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'image' }).text).toContain('Foto');
    expect(resolveChatPreview({ typing: false, lastKind: 'video' }).text).toContain('Video');
  });

  it('sin nada, lo dice sin inventar', () => {
    expect(resolveChatPreview({ typing: false }).text).toBe('Sin mensajes todavía');
  });
});

/**
 * **Mi propio acuse no dice nada del otro.**
 *
 * El server manda `receipt` a TODOS los miembros, incluido quien acaba de leer.
 * El cliente lo tomaba sin mirar de quién era, así que al abrir el chat —cuando
 * la app se marca leída sola— mi propio acuse subía «hasta dónde leyeron los
 * demás» y **todos mis mensajes aparecían con el doble check azul al instante**,
 * aunque del otro lado no los hubiera visto nadie.
 *
 * José, 30/08/2026: «los 2 checks azules es si mi contacto ya leyó el mensaje,
 * antes es gris».
 */
describe('esAcuseDeOtro', () => {
  it('el mío no cuenta', () => {
    expect(esAcuseDeOtro({ de: 'yo', yo: 'yo' })).toBe(false);
  });

  it('el del otro sí', () => {
    expect(esAcuseDeOtro({ de: 'wilson', yo: 'yo' })).toBe(true);
  });

  /** Sin saber quién soy no se puede afirmar que el acuse es ajeno. */
  it('sin mi id, no se cuenta', () => {
    expect(esAcuseDeOtro({ de: 'wilson', yo: '' })).toBe(false);
  });
});
