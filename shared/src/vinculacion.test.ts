import { describe, expect, it } from 'vitest';
import { esDispositivoVinculado, tokenDeVinculacion, urlDeVinculacion } from './vinculacion.js';

// 32 bytes en base64url: el largo real que genera el server.
const TOKEN = 'q3VhZ0Jb1xR4mN8pLw2sT6yE9cK0aZfH5dUiOjXgB7v';

describe('urlDeVinculacion', () => {
  it('arma la URL del QR sin barra doble', () => {
    expect(urlDeVinculacion('https://lilachat.constroad.com/', TOKEN)).toBe(`https://lilachat.constroad.com/v/${TOKEN}`);
    expect(urlDeVinculacion('http://localhost:4003', TOKEN)).toBe(`http://localhost:4003/v/${TOKEN}`);
  });
});

describe('tokenDeVinculacion', () => {
  it('saca el token de la URL del QR', () => {
    expect(tokenDeVinculacion(`https://lilachat.constroad.com/v/${TOKEN}`)).toBe(TOKEN);
    expect(tokenDeVinculacion(`http://localhost:4003/v/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenDeVinculacion(`  https://lilachat.constroad.com/v/${TOKEN}\n`)).toBe(TOKEN);
  });

  it('rechaza lo que no es un QR de Lilachat', () => {
    expect(tokenDeVinculacion('2@abcdef,ghijk,lmnop')).toBeNull(); // un QR de WhatsApp Web
    expect(tokenDeVinculacion(`https://lilachat.constroad.com/c/${TOKEN}`)).toBeNull();
    expect(tokenDeVinculacion(`https://lilachat.constroad.com/v/${TOKEN.slice(1)}`)).toBeNull();
    expect(tokenDeVinculacion(`https://lilachat.constroad.com/v/${TOKEN}x`)).toBeNull();
    expect(tokenDeVinculacion(`javascript:alert(1)//v/${TOKEN}`)).toBeNull();
    expect(tokenDeVinculacion(`https://lilachat.constroad.com/v/${TOKEN}?x=1`)).toBeNull();
    expect(tokenDeVinculacion('')).toBeNull();
  });
});

describe('esDispositivoVinculado', () => {
  it('distingue el teléfono de una web vinculada por el id', () => {
    expect(esDispositivoVinculado('vinculado-8d1c2c2e-0b7c-4c1a-9f57-0d3f5a1e2b3c')).toBe(true);
    expect(esDispositivoVinculado('8d1c2c2e-0b7c-4c1a-9f57-0d3f5a1e2b3c')).toBe(false);
    expect(esDispositivoVinculado('')).toBe(false);
  });
});
