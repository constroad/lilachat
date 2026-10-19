import { describe, expect, it } from 'vitest';
import { chatDeLaRuta, rutaDelChat } from './rutaDelChat';

const ID = '6ad641ff1e1b7ddd859d0771';

describe('chatDeLaRuta', () => {
  it('lee el chat de /c/<id>', () => {
    expect(chatDeLaRuta(`/c/${ID}`, '')).toBe(ID);
  });

  it('entiende el enlace viejo de los avisos (?chat=<id>)', () => {
    expect(chatDeLaRuta('/', `?chat=${ID}`)).toBe(ID);
  });

  it('un id que no es de Mongo no abre nada', () => {
    expect(chatDeLaRuta('/c/../../etc', '')).toBeNull();
    expect(chatDeLaRuta('/', '?chat=<script>')).toBeNull();
  });

  it('la raíz no tiene chat', () => {
    expect(chatDeLaRuta('/', '')).toBeNull();
  });
});

describe('rutaDelChat', () => {
  it('ida y vuelta', () => {
    expect(rutaDelChat(ID)).toBe(`/c/${ID}`);
    expect(rutaDelChat(null)).toBe('/');
  });
});
