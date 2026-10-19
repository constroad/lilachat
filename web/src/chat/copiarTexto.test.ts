import { afterEach, describe, expect, it, vi } from 'vitest';
import { copiarTexto } from './copiarTexto';

afterEach(() => vi.restoreAllMocks());

describe('copiarTexto', () => {
  it('con la API moderna, la usa', async () => {
    const escribir = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });

    expect(await copiarTexto('hola')).toBe(true);
    expect(escribir).toHaveBeenCalledWith('hola');
  });

  it('si el navegador la niega, copia con el respaldo y no deja el campo colgado', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, configurable: true });
    document.execCommand = vi.fn(() => true);

    expect(await copiarTexto('hola')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('si tampoco hay respaldo, lo dice', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, configurable: true });
    document.execCommand = vi.fn(() => false);

    expect(await copiarTexto('hola')).toBe(false);
  });
});
