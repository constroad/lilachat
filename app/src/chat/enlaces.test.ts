import { describe, expect, it } from 'vitest';
import { partirEnEnlaces, primerEnlace } from './enlaces';

/** Links, correos y teléfonos tocables (FL9, auditoría §46.2). */
describe('partirEnEnlaces', () => {
  it('texto sin nada: una sola parte', () => {
    expect(partirEnEnlaces('hola qué tal')).toEqual([{ tipo: 'texto', texto: 'hola qué tal' }]);
  });

  it('un link en medio, con y sin https', () => {
    expect(partirEnEnlaces('mira https://constroad.com/a?b=1 ya')).toEqual([
      { tipo: 'texto', texto: 'mira ' },
      { tipo: 'url', texto: 'https://constroad.com/a?b=1', destino: 'https://constroad.com/a?b=1' },
      { tipo: 'texto', texto: ' ya' },
    ]);
    expect(partirEnEnlaces('www.lilachat.com')).toEqual([{ tipo: 'url', texto: 'www.lilachat.com', destino: 'https://www.lilachat.com' }]);
  });

  it('el punto o la coma al final no son parte del link', () => {
    expect(partirEnEnlaces('entra a https://x.com/a.')).toEqual([
      { tipo: 'texto', texto: 'entra a ' },
      { tipo: 'url', texto: 'https://x.com/a', destino: 'https://x.com/a' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('correo', () => {
    expect(partirEnEnlaces('escribe a ana@x.pe')).toEqual([
      { tipo: 'texto', texto: 'escribe a ' },
      { tipo: 'email', texto: 'ana@x.pe', destino: 'mailto:ana@x.pe' },
    ]);
  });

  it('celular peruano, con y sin +51 y espacios', () => {
    expect(partirEnEnlaces('llama al 902 049 935')).toEqual([
      { tipo: 'texto', texto: 'llama al ' },
      { tipo: 'telefono', texto: '902 049 935', destino: 'tel:902049935' },
    ]);
    expect(partirEnEnlaces('+51 902049935')).toEqual([{ tipo: 'telefono', texto: '+51 902049935', destino: 'tel:+51902049935' }]);
  });

  it('un número que no es un celular (un monto, un código) no se toca', () => {
    expect(partirEnEnlaces('son 1500 soles y el pedido 12345')).toEqual([{ tipo: 'texto', texto: 'son 1500 soles y el pedido 12345' }]);
  });
});

/** La tarjeta del chat (FL13d): sale del PRIMER link del mensaje, como WhatsApp. */
describe('primerEnlace', () => {
  it('el primer link, sin la puntuación que lo cierra', () => {
    expect(primerEnlace('Mira esto: https://lila.pe/almuerzo. Y esto https://otro.pe')).toBe('https://lila.pe/almuerzo');
  });

  it('www. se completa con https', () => {
    expect(primerEnlace('entra a www.lila.pe')).toBe('https://www.lila.pe');
  });

  it('correos y celulares no son enlaces con tarjeta', () => {
    expect(primerEnlace('escríbeme a jose@lila.pe o al 987 654 321')).toBeNull();
  });

  it('sin texto, nada', () => {
    expect(primerEnlace(undefined)).toBeNull();
  });
});
