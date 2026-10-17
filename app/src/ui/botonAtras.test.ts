import { describe, expect, it } from 'vitest';
import { decidirAtras } from './botonAtras';

/**
 * El botón atrás de Android cerraba la app desde cualquier lado (José,
 * 27/08/2026). Sin `BackHandler`, no manejarlo NO es «no hacer nada»: en una app
 * de una sola actividad, el comportamiento por defecto es salir.
 */
describe('decidirAtras', () => {
  it('desde una conversación vuelve a la lista, no cierra', () => {
    expect(decidirAtras({ pantalla: 'chat' })).toBe('ir-a-lista');
  });

  it('desde otra pestaña vuelve a Chats', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'agenda' })).toBe('ir-a-chats');
    expect(decidirAtras({ pantalla: 'tabs', tab: 'encuestas' })).toBe('ir-a-chats');
    expect(decidirAtras({ pantalla: 'tabs', tab: 'ajustes' })).toBe('ir-a-chats');
  });

  /** Solo desde Chats se sale — igual que WhatsApp. */
  it('desde Chats sí sale', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats' })).toBe('salir');
  });

  /**
   * **Lo de más arriba gana siempre.** Cerrar la app con un formulario abierto
   * pierde lo que la persona venía escribiendo, y eso es peor que cualquier
   * navegación rara.
   */
  it('con algo abierto encima, primero se cierra eso', () => {
    expect(decidirAtras({ pantalla: 'chat', haySobreCapa: true })).toBe('cerrar-sobrecapa');
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats', haySobreCapa: true })).toBe(
      'cerrar-sobrecapa'
    );
  });

  /** Sin pestaña conocida no se inventa una navegación: se sale. */
  it('sin pestaña, sale', () => {
    expect(decidirAtras({ pantalla: 'tabs' })).toBe('salir');
  });
});

/**
 * FL9 (auditoría §46.2): atrás salía del chat con un mensaje seleccionado o una
 * respuesta a medias, y en la lista cerraba la app con una búsqueda activa.
 * Atrás deshace lo último que se hizo, como WhatsApp.
 */
describe('decidirAtras — lo que se está haciendo primero', () => {
  it('con un mensaje seleccionado, suelta la selección', () => {
    expect(decidirAtras({ pantalla: 'chat', haySeleccion: true })).toBe('soltar-seleccion');
  });

  it('con una respuesta a medias, la cancela', () => {
    expect(decidirAtras({ pantalla: 'chat', respondiendo: true })).toBe('cancelar-respuesta');
  });

  it('la selección gana sobre la respuesta (es lo último que se tocó)', () => {
    expect(decidirAtras({ pantalla: 'chat', haySeleccion: true, respondiendo: true })).toBe('soltar-seleccion');
  });

  it('en Chats con una búsqueda escrita, la limpia en vez de salir', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats', buscando: true })).toBe('limpiar-busqueda');
  });

  it('una hoja abierta encima sigue ganando a todo', () => {
    expect(decidirAtras({ pantalla: 'chat', haySobreCapa: true, haySeleccion: true })).toBe('cerrar-sobrecapa');
  });
});

describe('decidirAtras — editando (José, 17/10/2026)', () => {
  it('con una edición a medias, la cancela (y el mensaje queda como estaba)', () => {
    expect(decidirAtras({ pantalla: 'chat', editando: true })).toBe('cancelar-edicion');
  });
});

describe('decidirAtras — archivados y selección en la lista (FL9)', () => {
  it('en «Archivados», atrás vuelve a la lista principal en vez de salir', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats', enArchivados: true })).toBe('cerrar-archivados');
  });

  it('con chats seleccionados en la lista, suelta la selección primero', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats', haySeleccion: true, enArchivados: true })).toBe('soltar-seleccion');
  });

  it('la búsqueda se limpia antes de salir de «Archivados»', () => {
    expect(decidirAtras({ pantalla: 'tabs', tab: 'chats', buscando: true, enArchivados: true })).toBe('limpiar-busqueda');
  });
});
