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
