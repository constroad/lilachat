import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_NAME,
  detectLilaMention,
  parseEventDraft,
  selectContextMessages,
} from './assistant.js';

/**
 * Las decisiones del asistente, sin llamar a ningún modelo.
 *
 * Todo lo que decide QUÉ se le manda a Claude vive acá con test, y por un
 * motivo concreto: lo que se manda es **conversación privada de una familia**.
 * El recorte, el tope y qué se excluye no pueden depender de que el prompt esté
 * bien escrito.
 */
describe('detectLilaMention', () => {
  it('reconoce la mención al principio y extrae el pedido', () => {
    const mencion = detectLilaMention('@lila ¿qué dijo mamá del domingo?');

    expect(mencion).toEqual({ request: '¿qué dijo mamá del domingo?' });
  });

  it('la reconoce en medio del mensaje', () => {
    expect(detectLilaMention('oye @lila resumime esto')).toEqual({ request: 'resumime esto' });
  });

  it('no distingue mayúsculas ni tildes del nombre', () => {
    expect(detectLilaMention('@Lila hola')).toEqual({ request: 'hola' });
  });

  /**
   * Sin mención NO se llama al modelo. Es la diferencia entre un asistente que
   * responde cuando lo llaman y uno que lee todo lo que escribe la familia.
   */
  it('un mensaje normal no la dispara', () => {
    expect(detectLilaMention('mañana llevo el postre')).toBeNull();
    expect(detectLilaMention('hablé con lila ayer')).toBeNull();
  });

  /** «@lila» a secas es una llamada sin pedido: se responde, no se ignora. */
  it('sin pedido devuelve una petición vacía, no null', () => {
    expect(detectLilaMention('@lila')).toEqual({ request: '' });
  });

  it('el nombre está en un solo lugar', () => {
    expect(ASSISTANT_NAME).toBe('lila');
  });
});

describe('selectContextMessages', () => {
  const mensaje = (seq: number, body: string) => ({ seq, body, from: 'Mamá', kind: 'text' });

  it('manda los más RECIENTES, no los primeros', () => {
    const todos = Array.from({ length: 60 }, (_, index) => mensaje(index + 1, `m${index + 1}`));

    const elegidos = selectContextMessages(todos, { maxMessages: 10 });

    expect(elegidos).toHaveLength(10);
    expect(elegidos[0]?.seq).toBe(51);
    expect(elegidos.at(-1)?.seq).toBe(60);
  });

  /**
   * Tope por CARACTERES además de por cantidad: veinte mensajes cortos y veinte
   * párrafos largos no cuestan lo mismo, y lo que se factura es el texto.
   */
  it('recorta por tamaño aunque quepan en cantidad', () => {
    const largos = Array.from({ length: 10 }, (_, index) => mensaje(index + 1, 'x'.repeat(500)));

    const elegidos = selectContextMessages(largos, { maxMessages: 10, maxChars: 1200 });

    expect(elegidos.length).toBeLessThan(10);
    expect(elegidos.reduce((total, item) => total + item.body.length, 0)).toBeLessThanOrEqual(1200);
    // Y los que sobreviven son los últimos: el final de la conversación es lo
    // que se está preguntando.
    expect(elegidos.at(-1)?.seq).toBe(10);
  });

  /**
   * Las fotos y los archivos NO se mandan. El asistente es de texto: incluir
   * una URL de media sería filtrar un enlace al storage sin ninguna utilidad
   * para el resumen.
   */
  it('deja fuera los mensajes que no son de texto', () => {
    const elegidos = selectContextMessages(
      [mensaje(1, 'hola'), { seq: 2, body: '', from: 'Mamá', kind: 'image' }, mensaje(3, 'chau')],
      { maxMessages: 10 }
    );

    expect(elegidos.map((item) => item.seq)).toEqual([1, 3]);
  });

  it('sin mensajes devuelve lista vacía y no revienta', () => {
    expect(selectContextMessages([], { maxMessages: 10 })).toEqual([]);
  });
});

describe('parseEventDraft', () => {
  /**
   * Lo que devuelve el modelo es TEXTO, no un objeto de confianza. Se valida
   * como si viniera de un cliente hostil: un modelo puede alucinar campos,
   * fechas imposibles o un título de diez mil caracteres.
   */
  it('acepta un borrador bien formado', () => {
    const draft = parseEventDraft(
      JSON.stringify({ title: 'Almuerzo del domingo', startsAt: '2026-08-30T18:00:00Z', location: 'Casa de mamá' })
    );

    expect(draft).toEqual({
      title: 'Almuerzo del domingo',
      startsAt: '2026-08-30T18:00:00Z',
      location: 'Casa de mamá',
    });
  });

  it('sobrevive a que el modelo envuelva el JSON en texto', () => {
    const draft = parseEventDraft('Claro:\n```json\n{"title":"Cena","startsAt":"2026-08-30T18:00:00Z"}\n```');

    expect(draft?.title).toBe('Cena');
  });

  it('sin título no hay borrador', () => {
    expect(parseEventDraft(JSON.stringify({ startsAt: '2026-08-30T18:00:00Z' }))).toBeNull();
  });

  it('una fecha inválida se rechaza entera', () => {
    expect(parseEventDraft(JSON.stringify({ title: 'X', startsAt: 'el domingo' }))).toBeNull();
  });

  it('un título kilométrico se recorta, no se acepta tal cual', () => {
    const draft = parseEventDraft(
      JSON.stringify({ title: 'a'.repeat(500), startsAt: '2026-08-30T18:00:00Z' })
    );

    expect(draft?.title.length).toBeLessThanOrEqual(120);
  });

  it('texto que no es JSON devuelve null', () => {
    expect(parseEventDraft('no pude armar el evento')).toBeNull();
  });
});
