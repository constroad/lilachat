import { describe, expect, it } from 'vitest';
import { crearVinculaciones, VIDA_DE_LA_VINCULACION_MS, VIDA_DEL_TOKEN_MS } from './vinculaciones.js';

const APROBACION = { userId: '6650f1c2a3b4c5d6e7f80911', aprobadoPor: '8d1c2c2e-0b7c-4c1a-9f57-0d3f5a1e2b3c' };

function conReloj(inicio = 1_000_000) {
  let ahora = inicio;
  const vinculaciones = crearVinculaciones({ ahora: () => ahora });
  return { vinculaciones, avanzar: (ms: number) => (ahora += ms) };
}

describe('vinculaciones en memoria (W5)', () => {
  it('el token del QR se consulta y se aprueba; la web lo canjea UNA vez', () => {
    const { vinculaciones } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    expect(inicio.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(vinculaciones.consultar(inicio.token)).toEqual({ nombre: 'Chrome en macOS' });
    expect(vinculaciones.canjear(inicio.id, inicio.clave)).toBeNull(); // todavía nadie aprobó
    expect(vinculaciones.aprobar(inicio.token, APROBACION)).toEqual({ nombre: 'Chrome en macOS' });

    expect(vinculaciones.canjear(inicio.id, inicio.clave)).toEqual({ nombre: 'Chrome en macOS', aprobacion: APROBACION });
    expect(vinculaciones.canjear(inicio.id, inicio.clave)).toBeNull();
    expect(vinculaciones.consultar(inicio.token)).toBeNull();
  });

  it('un token aprobado no se aprueba dos veces (dos teléfonos, un QR)', () => {
    const { vinculaciones } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    expect(vinculaciones.aprobar(inicio.token, APROBACION)).not.toBeNull();
    expect(vinculaciones.aprobar(inicio.token, { ...APROBACION, userId: '6650f1c2a3b4c5d6e7f80999' })).toBeNull();
    expect(vinculaciones.canjear(inicio.id, inicio.clave)?.aprobacion.userId).toBe(APROBACION.userId);
  });

  it('sin la clave de la web nadie canjea ni rota, aunque tenga el QR', () => {
    const { vinculaciones } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    vinculaciones.aprobar(inicio.token, APROBACION);
    expect(vinculaciones.canjear(inicio.id, inicio.token)).toBeNull();
    expect(vinculaciones.canjear(inicio.id, 'x'.repeat(43))).toBeNull();
    expect(vinculaciones.rotar(inicio.id, 'otra')).toBeNull();
    expect(vinculaciones.canjear(inicio.id, inicio.clave)).not.toBeNull();
  });

  it('el token impreso vence a los 60 s; rotar da uno nuevo para la MISMA vinculación', () => {
    const { vinculaciones, avanzar } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    avanzar(20_000);
    const rotado = vinculaciones.rotar(inicio.id, inicio.clave)!;
    expect(rotado.token).not.toBe(inicio.token);
    // El de hace 20 s sigue sirviendo: el teléfono pudo leerlo justo antes del cambio.
    expect(vinculaciones.consultar(inicio.token)).not.toBeNull();
    avanzar(VIDA_DEL_TOKEN_MS - 20_000 + 1);
    expect(vinculaciones.consultar(inicio.token)).toBeNull();
    expect(vinculaciones.aprobar(rotado.token, APROBACION)).not.toBeNull();
    expect(vinculaciones.canjear(inicio.id, inicio.clave)).not.toBeNull();
  });

  it('la vinculación entera vence a los 5 min: no rota más y la web pide otra', async () => {
    const { vinculaciones, avanzar } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    avanzar(VIDA_DE_LA_VINCULACION_MS + 1);
    expect(vinculaciones.rotar(inicio.id, inicio.clave)).toBeNull();
    expect(await vinculaciones.esperar(inicio.id, inicio.clave, 10)).toBe('vencida');
  });

  it('esperar devuelve «aprobada» apenas el teléfono aprueba', async () => {
    const { vinculaciones } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    const espera = vinculaciones.esperar(inicio.id, inicio.clave, 5_000);
    vinculaciones.aprobar(inicio.token, APROBACION);
    expect(await espera).toBe('aprobada');
  });

  it('esperar sin novedad devuelve «pendiente» al vencer la espera; clave mala = «vencida»', async () => {
    const { vinculaciones } = conReloj();
    const inicio = vinculaciones.iniciar('Chrome en macOS')!;
    expect(await vinculaciones.esperar(inicio.id, inicio.clave, 5)).toBe('pendiente');
    expect(await vinculaciones.esperar(inicio.id, 'mala', 5)).toBe('vencida');
    expect(await vinculaciones.esperar('no-existe', inicio.clave, 5)).toBe('vencida');
  });

  it('las vencidas se limpian solas al iniciar otra', () => {
    const { vinculaciones, avanzar } = conReloj();
    vinculaciones.iniciar('A');
    vinculaciones.iniciar('B');
    avanzar(VIDA_DE_LA_VINCULACION_MS + 1);
    vinculaciones.iniciar('C');
    expect(vinculaciones.cantidad()).toBe(1);
  });

  it('con el tope lleno no crea más (memoria acotada ante un abuso)', () => {
    const vinculaciones = crearVinculaciones({ tope: 2 });
    expect(vinculaciones.iniciar('A')).not.toBeNull();
    expect(vinculaciones.iniciar('B')).not.toBeNull();
    expect(vinculaciones.iniciar('C')).toBeNull();
  });
});
