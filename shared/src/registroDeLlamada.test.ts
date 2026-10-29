import { describe, expect, it } from 'vitest';
import { callBackTitle, isMissedCallForMe, cuerpoDeLlamada, leerValorDeLlamada, textoDeLlamada, valorDeLlamada } from './registroDeLlamada.js';
import { textoDeAviso } from './avisoDeGrupo.js';

/**
 * La línea que deja una llamada en el chat (FL8.1). Antes una llamada perdida
 * no dejaba rastro: `summarizeEndedCall` existía y nadie la usaba.
 */
describe('valorDeLlamada', () => {
  it('perdida y contestada, de voz y de video, ida y vuelta', () => {
    expect(valorDeLlamada({ video: false, segundos: null })).toBe('voz:perdida');
    expect(valorDeLlamada({ video: true, segundos: 133 })).toBe('video:133');
    expect(leerValorDeLlamada('voz:perdida')).toEqual({ video: false, segundos: null });
    expect(leerValorDeLlamada('video:133')).toEqual({ video: true, segundos: 133 });
  });

  it('una contestada de 0,4 s no es perdida: cuenta 0 s', () => {
    expect(valorDeLlamada({ video: false, segundos: 0 })).toBe('voz:0');
    expect(leerValorDeLlamada('voz:0')).toEqual({ video: false, segundos: 0 });
  });

  it('un valor roto no se adivina', () => {
    expect(leerValorDeLlamada(undefined)).toBeNull();
    expect(leerValorDeLlamada('cualquier-cosa')).toBeNull();
    expect(leerValorDeLlamada('voz:-3')).toBeNull();
  });
});

describe('textoDeLlamada', () => {
  it('perdida: para quien no contestó es «perdida»; para quien llamó, «sin respuesta»', () => {
    expect(textoDeLlamada({ valor: 'voz:perdida', esMio: false })).toBe('Llamada perdida');
    expect(textoDeLlamada({ valor: 'voz:perdida', esMio: true })).toBe('Llamada sin respuesta');
    expect(textoDeLlamada({ valor: 'video:perdida', esMio: false })).toBe('Videollamada perdida');
    expect(textoDeLlamada({ valor: 'video:perdida', esMio: true })).toBe('Videollamada sin respuesta');
  });

  it('contestada: el tipo y la duración, igual para los dos', () => {
    expect(textoDeLlamada({ valor: 'voz:133', esMio: true })).toBe('Llamada de voz · 02:13');
    expect(textoDeLlamada({ valor: 'video:3725', esMio: false })).toBe('Videollamada · 1:02:05');
  });

  it('valor roto: nada (mejor un hueco que una frase inventada)', () => {
    expect(textoDeLlamada({ valor: 'x', esMio: false })).toBe('');
  });

  it('textoDeAviso la reconoce como evento «llamada»', () => {
    expect(textoDeAviso({ quien: 'Wilson', esMio: false, evento: 'llamada', valor: 'voz:perdida' })).toBe('Llamada perdida');
  });
});

describe('cuerpoDeLlamada', () => {
  // El texto de respaldo: lo que se ve en la notificación y en la web.
  it('perdida con el nombre de quien llamó; contestada sin nombre', () => {
    expect(cuerpoDeLlamada({ valor: 'voz:perdida', quien: 'Wilson' })).toBe('Llamada perdida de Wilson');
    expect(cuerpoDeLlamada({ valor: 'video:perdida', quien: 'Wilson' })).toBe('Videollamada perdida de Wilson');
    expect(cuerpoDeLlamada({ valor: 'voz:65', quien: 'Wilson' })).toBe('Llamada de voz · 01:05');
  });
});

describe('call back (backlog 23)', () => {
  it('a missed call is one I did not answer: not mine, without seconds', () => {
    expect(isMissedCallForMe({ valor: 'voz:perdida', esMio: false })).toBe(true);
    expect(isMissedCallForMe({ valor: 'voz:perdida', esMio: true })).toBe(false);
    expect(isMissedCallForMe({ valor: 'voz:95', esMio: false })).toBe(false);
    expect(isMissedCallForMe({ valor: undefined, esMio: false })).toBe(false);
  });
  it('the reminder title names who to call back', () => {
    expect(callBackTitle('Ana Torres')).toBe('Devolver la llamada a Ana Torres');
    expect(callBackTitle('')).toBe('Devolver una llamada perdida');
  });
});

describe('the line of a group call (pending 56)', () => {
  it('says it was a group call and how many took part; a 1:1 value reads as before', () => {
    // Arrange
    const recorded = valorDeLlamada({ video: true, segundos: 150, personas: 3 });
    // Act + Assert
    expect(recorded).toBe('video:150:g3');
    expect(leerValorDeLlamada(recorded)).toEqual({ video: true, segundos: 150, personas: 3 });
    expect(textoDeLlamada({ valor: recorded, esMio: false })).toBe('Videollamada grupal · 3 personas · 02:30');
    expect(cuerpoDeLlamada({ valor: 'voz:65:g2', quien: 'Ana' })).toBe('Llamada grupal · 2 personas · 01:05');
    expect(leerValorDeLlamada('voz:65')).toEqual({ video: false, segundos: 65 });
  });
});
