import { describe, expect, it } from 'vitest';
import { cuantosParaPonerAlDia, ofrecerPonerAlDia, UMBRAL_PONER_AL_DIA } from './ponerAlDia';

const YO = '665f1a2b3c4d5e6f70818293';
const OTRO = '665f1a2b3c4d5e6f70818294';

/**
 * «Ponme al día» con sentido (José, 18/10: salió con 1 mensaje sin leer, que
 * se lee de un vistazo, y también por líneas de llamada; auditoría §46.3).
 */
describe('cuantosParaPonerAlDia', () => {
  const texto = (senderId: string) => ({ senderId, kind: 'text' });

  it('cuenta solo los mensajes ajenos de verdad entre los no leídos', () => {
    const mensajes = [texto(OTRO), texto(OTRO), { senderId: OTRO, kind: 'system' }, texto(YO), texto(OTRO)];

    expect(cuantosParaPonerAlDia(mensajes, 4, YO)).toBe(2);
  });

  it('lo eliminado no cuenta', () => {
    expect(cuantosParaPonerAlDia([{ senderId: OTRO, kind: 'text', deletedAt: '2026-10-18T10:00:00Z' }], 1, YO)).toBe(0);
  });

  it('sin no leídos, cero', () => {
    expect(cuantosParaPonerAlDia([texto(OTRO)], 0, YO)).toBe(0);
  });

  it(`el umbral: con menos de ${UMBRAL_PONER_AL_DIA} se lee de un vistazo`, () => {
    expect(UMBRAL_PONER_AL_DIA).toBe(10);
  });
});

/** «…y no se fue al leerlo» (José, 18/10): leído hasta el final, ya no se ofrece. */
describe('ofrecerPonerAlDia', () => {
  it('desde el umbral, mientras no se leyó', () => {
    expect(ofrecerPonerAlDia(UMBRAL_PONER_AL_DIA, false)).toBe(true);
    expect(ofrecerPonerAlDia(UMBRAL_PONER_AL_DIA - 1, false)).toBe(false);
  });

  it('leído hasta el final, no se ofrece aunque sean muchos', () => {
    expect(ofrecerPonerAlDia(40, true)).toBe(false);
  });
});
