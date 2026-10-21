import { describe, expect, it, vi } from 'vitest';
import {
  DELIVERY_GLYPH,
  formatChatTimestamp,
  formatClock,
  formatDayLabel,
  formatUltimaVez,
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

  /** Auditoría (19/10): una foto borrada para todos seguía diciendo «Foto» en la lista. */
  it('el último borrado para todos dice «Se eliminó este mensaje», aunque fuera una foto', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'image', eliminado: true })).toEqual({ text: 'Se eliminó este mensaje', style: 'eliminado' });
  });

  /** E3 (20/10): lo último fue una respuesta en un hilo. */
  it('una respuesta de hilo lo dice antes del texto', () => {
    expect(resolveChatPreview({ typing: false, lastBody: 'Yo llamo', enHilo: true }).text).toBe('En un hilo: Yo llamo');
  });

  it('sin texto pero con media, dice QUÉ llegó', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'image' }).text).toContain('Foto');
    expect(resolveChatPreview({ typing: false, lastKind: 'video' }).text).toContain('Video');
  });

  /**
   * FL3: el tipo de media viaja aparte para que la app dibuje un ícono
   * vectorial (como WhatsApp) en vez del emoji pegado al texto.
   */
  it('dice el tipo de media y el texto va sin emoji', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'image' })).toEqual({ text: 'Foto', style: 'normal', media: 'foto' });
    expect(resolveChatPreview({ typing: false, lastKind: 'audio' })).toMatchObject({ text: 'Nota de voz', media: 'voz' });
    expect(resolveChatPreview({ typing: false, lastKind: 'file' })).toMatchObject({ text: 'Archivo', media: 'archivo' });
    expect(resolveChatPreview({ typing: false, lastBody: 'hola' }).media).toBeUndefined();
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

/**
 * Borrador por chat (FL9): lo escrito y no mandado vuelve al abrir el chat, y
 * la lista lo dice como WhatsApp («Borrador: …»). Lo que escribe el otro gana:
 * es lo que está pasando ahora.
 */
describe('resolveChatPreview — borrador', () => {
  it('con borrador: «Borrador: …» en vez del último mensaje', () => {
    expect(resolveChatPreview({ typing: false, lastBody: 'hola', borrador: '  nos vemos\n  mañana ' })).toEqual({
      etiqueta: 'Borrador:',
      text: 'nos vemos mañana',
      style: 'borrador',
    });
  });

  it('un borrador vacío o de espacios no cuenta', () => {
    expect(resolveChatPreview({ typing: false, lastBody: 'hola', borrador: '   ' })).toEqual({ text: 'hola', style: 'normal' });
  });

  it('si el otro está escribiendo, eso gana al borrador', () => {
    expect(resolveChatPreview({ typing: true, lastBody: 'hola', borrador: 'x' }).style).toBe('typing');
  });
});

/** «últ. vez» en la cabecera de un 1:1 (FL10, auditoría §46.3), como WhatsApp. */
describe('formatUltimaVez', () => {
  const ahora = new Date('2026-10-18T15:00:00');

  /**
   * Corta, para que la hora quepa en la cabecera (FL13d, emulador 18/10): con
   * video, llamada y menú, «últ. vez hoy a las 7:38 p. m.» se cortaba en
   * «últ. vez hoy a las 7:…» y se perdía justo la hora.
   */
  it('hoy, solo la hora; ayer, «ayer» y la hora', () => {
    const hoy = new Date('2026-10-18T07:31:00');
    const ayer = new Date('2026-10-17T21:04:00');

    expect(formatUltimaVez(hoy, ahora)).toBe(`últ. vez ${formatClock(hoy)}`);
    expect(formatUltimaVez(ayer, ahora)).toBe(`últ. vez ayer ${formatClock(ayer)}`);
  });

  it('antes de ayer, solo el día: la hora de hace días ya no dice nada', () => {
    const viejo = formatUltimaVez(new Date('2026-10-02T10:00:00'), ahora);

    expect(viejo).toMatch(/^últ\. vez 2 /);
    expect(viejo).not.toContain(':');
  });

  // El peor caso es «ayer» con hora de dos cifras; la cabecera achica la letra
  // hasta un 15 % si hace falta (`adjustsFontSizeToFit`).
  it('cabe en la cabecera: hasta 25 caracteres', () => {
    expect(formatUltimaVez(new Date('2026-10-17T12:59:00'), ahora).length).toBeLessThanOrEqual(25);
    expect(formatUltimaVez(new Date('2026-10-18T10:59:00'), ahora).length).toBeLessThanOrEqual(25);
  });

  it('sin una fecha válida, nada', () => {
    expect(formatUltimaVez('no es fecha', ahora)).toBe('');
  });
});

/**
 * FL12 (auditoría de fluidez §49 #8): crear un `Intl.DateTimeFormat` en Hermes
 * va a ICU y es caro, y estas funciones corren por fila y por render. Se
 * construye UNO por formato y se reusa.
 */
describe('formateadores reusados', () => {
  it('cien horas y fechas no construyen ningún formateador nuevo', () => {
    const ahora = new Date(2026, 9, 18, 12, 0);
    // La primera vuelta puede crear los de cada formato: son de módulo.
    formatClock(ahora);
    formatDayLabel(new Date(2026, 9, 1), ahora);
    formatChatTimestamp(new Date(2026, 9, 15), ahora);
    formatChatTimestamp(new Date(2026, 8, 1), ahora);

    const espia = vi.spyOn(Intl, 'DateTimeFormat');
    for (let i = 0; i < 100; i += 1) {
      formatClock(new Date(2026, 9, 18, 9, i % 60));
      formatDayLabel(new Date(2026, 9, 1), ahora);
      formatChatTimestamp(new Date(2026, 9, 15), ahora);
      formatChatTimestamp(new Date(2026, 8, 1), ahora);
    }
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('el resultado no cambia por reusar', () => {
    const at = new Date(2026, 9, 18, 9, 5);
    expect(formatClock(at)).toBe(new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).format(at));
  });
});

/** José, 18/10: la encuesta y el evento se publican en el chat; la lista los muestra como WhatsApp. */
describe('vista previa de encuesta y evento', () => {
  it('la encuesta: su ícono y la pregunta, sin el prefijo', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'poll', lastBody: 'Encuesta: ¿Pizza o pollo?' })).toEqual({
      text: '¿Pizza o pollo?',
      style: 'normal',
      media: 'encuesta',
    });
  });

  it('el evento: su ícono y el título', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'event', lastBody: 'Evento: Almuerzo' })).toEqual({
      text: 'Almuerzo',
      style: 'normal',
      media: 'evento',
    });
  });

  /** José, 19/10: recordatorios del grupo, que viven en el chat. */
  it('el recordatorio del grupo: su ícono y el título', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'reminder', lastBody: 'Recordatorio: Vaciado de losa' })).toEqual({
      text: 'Vaciado de losa',
      style: 'normal',
      media: 'recordatorio',
    });
  });
});

describe('nudge preview', () => {
  it('the list says «Zumbido»', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'zumbido' })).toEqual({ text: 'Zumbido', style: 'normal' });
    expect(resolveChatPreview({ typing: false, lastKind: 'guino' })).toEqual({ text: 'Guiño', style: 'normal' });
  });
});
