import { describe, expect, it } from 'vitest';
import { queHacerConElPermiso } from './permisos';

/**
 * Pedir un permiso SIN insistir (FL8; auditoría 17/10/2026: el de contactos se
 * pedía en cada arranque aunque se hubiera negado, y el de notificaciones dos
 * veces seguidas).
 *
 * «¿Ya se preguntó?» lo recuerda la APP: en Android 13 `expo-notifications`
 * dice «denied» antes de preguntar nada (no «undetermined»), y con esa regla
 * el permiso no se pedía nunca — se vio en el E2E.
 */
describe('queHacerConElPermiso', () => {
  it('concedido: se usa, no se pregunta', () => {
    expect(queHacerConElPermiso({ concedido: true, puedePreguntar: true, yaSePregunto: true, loPidioLaPersona: false })).toBe('usar');
  });

  it('nunca preguntado (aunque el sistema diga «denied»): se pregunta, también al arrancar', () => {
    expect(queHacerConElPermiso({ concedido: false, puedePreguntar: true, yaSePregunto: false, loPidioLaPersona: false })).toBe('pedir');
  });

  it('ya se preguntó y dijo que no: al arrancar NO se vuelve a preguntar', () => {
    expect(queHacerConElPermiso({ concedido: false, puedePreguntar: true, yaSePregunto: true, loPidioLaPersona: false })).toBe('nada');
  });

  it('dijo que no, pero la persona fue a invitar o a escribir: se vuelve a preguntar', () => {
    expect(queHacerConElPermiso({ concedido: false, puedePreguntar: true, yaSePregunto: true, loPidioLaPersona: true })).toBe('pedir');
  });

  it('«no volver a preguntar»: nunca, ni pidiéndolo (el sistema no mostraría nada)', () => {
    expect(queHacerConElPermiso({ concedido: false, puedePreguntar: false, yaSePregunto: false, loPidioLaPersona: true })).toBe('nada');
  });
});
