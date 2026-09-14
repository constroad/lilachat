import { describe, expect, it } from 'vitest';
import { construirServidoresIce } from './iceServers';

describe('construirServidoresIce', () => {
  it('sin TURN, solo STUN público (hito 1: misma red)', () => {
    const servidores = construirServidoresIce(null);
    expect(servidores).toHaveLength(1);
    expect(servidores[0].urls).toContain('stun:');
  });

  it('con credenciales TURN, agrega el relay además del STUN', () => {
    const servidores = construirServidoresIce({
      urls: ['turn:mini.constroad.com:3478'],
      username: 'efimero',
      credential: 'firmado',
    });
    expect(servidores).toHaveLength(2);
    const turn = servidores[1];
    expect(turn.urls).toEqual(['turn:mini.constroad.com:3478']);
    expect(turn.username).toBe('efimero');
    expect(turn.credential).toBe('firmado');
  });

  it('TURN con lista vacía de urls cae a solo STUN', () => {
    expect(construirServidoresIce({ urls: [], username: 'x', credential: 'y' })).toHaveLength(1);
  });
});
