import { describe, expect, it } from 'vitest';
import { opcionesNativasDeGrabacion } from './opcionesDeGrabacion';

const base = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 2,
  bitRate: 128000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { audioQuality: 127 },
  web: { mimeType: 'audio/webm' },
};

describe('opcionesNativasDeGrabacion', () => {
  it('en Android suma lo de Android y nada de iOS', () => {
    const opciones = opcionesNativasDeGrabacion(base, 'android');

    expect(opciones).toMatchObject({ extension: '.m4a', isMeteringEnabled: true, outputFormat: 'mpeg4', audioEncoder: 'aac' });
    expect(opciones).not.toHaveProperty('audioQuality');
  });

  it('en iOS suma lo de iOS', () => {
    expect(opcionesNativasDeGrabacion(base, 'ios')).toMatchObject({ audioQuality: 127, sampleRate: 44100 });
  });

  it('sin medición pedida, va apagada', () => {
    expect(opcionesNativasDeGrabacion({ ...base, isMeteringEnabled: undefined }, 'android').isMeteringEnabled).toBe(false);
  });
});
