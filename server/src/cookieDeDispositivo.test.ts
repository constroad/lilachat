import { describe, expect, it } from 'vitest';
import { cookieBorrada, cookieDeDispositivo, leerCookieDeDispositivo } from './cookieDeDispositivo.js';

describe('cookie del dispositivo de la web', () => {
  it('ida y vuelta, aunque el secreto traiga «:» o símbolos', () => {
    const cookie = cookieDeDispositivo({ deviceId: 'web-1', deviceSecret: 'a:b/c+d=', segura: true });
    const valor = cookie.split(';')[0]!;

    expect(leerCookieDeDispositivo(`otra=1; ${valor}`)).toEqual({ deviceId: 'web-1', deviceSecret: 'a:b/c+d=' });
  });

  it('HTTPS la marca Secure; en local no', () => {
    expect(cookieDeDispositivo({ deviceId: 'w', deviceSecret: 's', segura: true })).toContain('; Secure');
    expect(cookieDeDispositivo({ deviceId: 'w', deviceSecret: 's', segura: false })).not.toContain('Secure');
  });

  it('temporal (sin «Mantener la sesión iniciada»): sin Max-Age, muere con el navegador', () => {
    const cookie = cookieDeDispositivo({ deviceId: 'w', deviceSecret: 's', segura: false, temporal: true });
    expect(cookie).not.toContain('Max-Age');
    expect(cookie).toContain('HttpOnly');
    expect(cookieDeDispositivo({ deviceId: 'w', deviceSecret: 's', segura: false })).toContain('Max-Age=');
  });

  it('borrada vence ya', () => {
    expect(cookieBorrada(false)).toContain('Max-Age=0');
  });

  it('una cookie rota, vacía o ajena es null', () => {
    expect(leerCookieDeDispositivo(undefined)).toBeNull();
    expect(leerCookieDeDispositivo('otra=1')).toBeNull();
    expect(leerCookieDeDispositivo('lilachat_dispositivo=sin-dos-puntos')).toBeNull();
    expect(leerCookieDeDispositivo('lilachat_dispositivo=%E0%A4%A')).toBeNull();
    expect(leerCookieDeDispositivo('lilachat_dispositivo=web-1%3A')).toBeNull();
  });
});
