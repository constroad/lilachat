import { describe, expect, it } from 'vitest';
import { nombreDelNavegador } from './nombreDelNavegador.js';

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
  firefoxLinux: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  operaWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  safariIpad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeOs: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('nombreDelNavegador', () => {
  it('nombra el navegador y el sistema como los ve la persona', () => {
    expect(nombreDelNavegador(UA.chromeMac)).toBe('Chrome en macOS');
    expect(nombreDelNavegador(UA.edgeWindows)).toBe('Edge en Windows');
    expect(nombreDelNavegador(UA.firefoxLinux)).toBe('Firefox en Linux');
    expect(nombreDelNavegador(UA.safariMac)).toBe('Safari en macOS');
    expect(nombreDelNavegador(UA.operaWindows)).toBe('Opera en Windows');
    expect(nombreDelNavegador(UA.chromeAndroid)).toBe('Chrome en Android');
    expect(nombreDelNavegador(UA.safariIpad)).toBe('Safari en iPadOS');
    expect(nombreDelNavegador(UA.chromeOs)).toBe('Chrome en ChromeOS');
  });

  it('sin agente reconocible no inventa', () => {
    expect(nombreDelNavegador(undefined)).toBe('Navegador');
    expect(nombreDelNavegador('')).toBe('Navegador');
    expect(nombreDelNavegador('curl/8.4.0')).toBe('Navegador');
    expect(nombreDelNavegador('Mozilla/5.0 (Windows NT 10.0) Desconocido/1.0')).toBe('Navegador en Windows');
  });
});
