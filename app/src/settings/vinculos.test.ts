import { describe, expect, it } from 'vitest';
import { motivoDeVinculacion, puedeVincularOtro, textoDeUltimoUso } from './vinculos';

const AHORA = new Date(2026, 9, 19, 17, 30);

describe('textoDeUltimoUso', () => {
  it('reciente: «Activo ahora» y «Activo hace N min»', () => {
    expect(textoDeUltimoUso(new Date(2026, 9, 19, 17, 29, 30).toISOString(), AHORA)).toBe('Activo ahora');
    expect(textoDeUltimoUso(new Date(2026, 9, 19, 17, 25).toISOString(), AHORA)).toBe('Activo hace 5 min');
  });

  it('hoy, ayer y antes, por día calendario', () => {
    expect(textoDeUltimoUso(new Date(2026, 9, 19, 9, 5).toISOString(), AHORA)).toMatch(/^Último uso: hoy 9:05/);
    expect(textoDeUltimoUso(new Date(2026, 9, 18, 18, 40).toISOString(), AHORA)).toMatch(/^Último uso: ayer 6:40/);
    expect(textoDeUltimoUso(new Date(2026, 9, 12, 8, 0).toISOString(), AHORA)).toMatch(/^Último uso: 12 oct/);
  });

  it('sin fecha o con una rota no inventa', () => {
    expect(textoDeUltimoUso(null, AHORA)).toBe('Vinculado');
    expect(textoDeUltimoUso('no-es-fecha', AHORA)).toBe('Vinculado');
  });
});

describe('motivoDeVinculacion', () => {
  it('cada rechazo dice qué hacer', () => {
    expect(motivoDeVinculacion({ ok: false, status: 410 })).toMatch(/venció/);
    expect(motivoDeVinculacion({ ok: false, status: 409, message: 'Ya tienes 4 dispositivos vinculados.' })).toBe('Ya tienes 4 dispositivos vinculados.');
    expect(motivoDeVinculacion({ ok: false, status: 'network' })).toMatch(/Sin conexión/);
    expect(motivoDeVinculacion({ ok: false, status: 500 })).toMatch(/No se pudo/);
  });
});

describe('puedeVincularOtro', () => {
  it('hasta 4', () => {
    expect(puedeVincularOtro(3)).toBe(true);
    expect(puedeVincularOtro(4)).toBe(false);
  });
});
