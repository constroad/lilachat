import { describe, expect, it } from 'vitest';
import { CALL_TIMEOUT_MS, type CallState } from '@lilachat/shared';
import { comoSuena, decidirDeslizamiento, inicioDelTimbre, queHacerConElAviso, UMBRAL_DE_DESLIZAR } from './llamadaNativa';

/** FL8.1: la llamada entrante como WhatsApp, desde la notificación nativa. */
const sonando: CallState = { fase: 'sonando', desde: 1, entrante: true };
const activa: CallState = { fase: 'activa', desde: 1, entrante: true, conectadaEn: 2 };

describe('queHacerConElAviso', () => {
  it('Contestar en la notificación con la llamada ya sonando en ese chat: contesta', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'contestar' }, estado: sonando, chatId: 'c1' })).toBe('contestar');
  });

  it('Rechazar con la llamada sonando: cuelga', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'rechazar' }, estado: sonando, chatId: 'c1' })).toBe('colgar');
  });

  it('la app abrió en frío y la oferta todavía no llegó: espera', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'contestar' }, estado: null, chatId: null })).toBe('esperar');
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'abrir' }, estado: null, chatId: null })).toBe('esperar');
  });

  it('abrir con la llamada sonando: nada que hacer, la pantalla ya está', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'abrir' }, estado: sonando, chatId: 'c1' })).toBe('nada');
  });

  it('otro chat, o una llamada ya contestada: nada (un toque viejo no corta la llamada de ahora)', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c2', accion: 'rechazar' }, estado: sonando, chatId: 'c1' })).toBe('nada');
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'rechazar' }, estado: activa, chatId: 'c1' })).toBe('nada');
  });

  it('rechazar sin llamada: nada (el server ya la cortó por HTTP)', () => {
    expect(queHacerConElAviso({ aviso: { chatId: 'c1', accion: 'rechazar' }, estado: null, chatId: null })).toBe('nada');
  });
});

describe('comoSuena', () => {
  it('entrante con la app adelante: el tono del teléfono; de fondo: la notificación a pantalla completa', () => {
    expect(comoSuena({ sonandoEntrante: true, appActiva: true })).toBe('tono');
    expect(comoSuena({ sonandoEntrante: true, appActiva: false })).toBe('aviso-nativo');
  });

  it('sin entrante sonando: nada', () => {
    expect(comoSuena({ sonandoEntrante: false, appActiva: true })).toBe('nada');
  });
});

describe('decidirDeslizamiento', () => {
  // Deslizar hacia arriba para contestar, como WhatsApp: un toque en el
  // bolsillo no contesta.
  it('arriba más allá del umbral: contesta', () => {
    expect(decidirDeslizamiento({ dy: -UMBRAL_DE_DESLIZAR - 1, vy: 0 })).toBe('contestar');
  });

  it('un tirón rápido hacia arriba aunque corto: contesta', () => {
    expect(decidirDeslizamiento({ dy: -50, vy: -1200 })).toBe('contestar');
  });

  it('corto y lento, o hacia abajo: vuelve a su lugar', () => {
    expect(decidirDeslizamiento({ dy: -40, vy: -100 })).toBe('volver');
    expect(decidirDeslizamiento({ dy: 200, vy: 1500 })).toBe('volver');
    expect(decidirDeslizamiento({ dy: -10, vy: -1500 })).toBe('volver');
  });
});

describe('inicioDelTimbre', () => {
  // La oferta que llega tarde (la app abrió desde la notificación) trae lo que
  // le queda: el timbre termina cuando termina en el server, no 30 s después.
  it('con lo que queda: arrancó hace (30 s − queda)', () => {
    expect(inicioDelTimbre(12_000, 100_000)).toBe(100_000 - (CALL_TIMEOUT_MS - 12_000));
  });

  it('sin el dato (oferta en vivo): ahora', () => {
    expect(inicioDelTimbre(undefined, 100_000)).toBe(100_000);
  });

  it('un valor imposible se acota al timbre', () => {
    expect(inicioDelTimbre(-5, 100_000)).toBe(100_000 - CALL_TIMEOUT_MS);
    expect(inicioDelTimbre(999_999, 100_000)).toBe(100_000);
  });
});
