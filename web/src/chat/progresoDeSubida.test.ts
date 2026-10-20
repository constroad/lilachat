import { describe, expect, it } from 'vitest';
import { anilloDeSubidaWeb } from './progresoDeSubida';

describe('anilloDeSubidaWeb', () => {
  it('la fracción mientras sube', () => expect(anilloDeSubidaWeb(0.4)).toEqual({ fraccion: 0.4, girando: false }));
  it('sin medida gira', () => expect(anilloDeSubidaWeb(undefined)).toEqual({ fraccion: 0, girando: true }));
  it('más que el total se acota y gira (procesando)', () => expect(anilloDeSubidaWeb(1.7)).toEqual({ fraccion: 1, girando: true }));
});
