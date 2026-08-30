import { describe, expect, it } from 'vitest';
import { contarChats, filtrarChats, type ChatFiltrable } from './filtrosDeChats.js';

const chat = (parcial: Partial<ChatFiltrable> & { titulo: string }): ChatFiltrable => ({
  ultimo: '',
  esGrupo: false,
  sinLeer: 0,
  ...parcial,
});

const chats = [
  chat({ titulo: 'Wilson', ultimo: 'Alo? Tiomisho?' }),
  chat({ titulo: 'Los originales', esGrupo: true, sinLeer: 2 }),
  chat({ titulo: 'José Zamora', ultimo: 'nos vemos el domingo', sinLeer: 1 }),
  chat({ titulo: 'Mis lokillos', esGrupo: true }),
];

const titulos = (lista: ChatFiltrable[]) => lista.map((uno) => uno.titulo);

describe('filtrarChats', () => {
  it('sin filtro ni búsqueda devuelve todo', () => {
    expect(filtrarChats({ chats, filtro: 'todos', texto: '' })).toHaveLength(4);
  });

  it('no leídos', () => {
    expect(titulos(filtrarChats({ chats, filtro: 'no-leidos', texto: '' }))).toEqual([
      'Los originales',
      'José Zamora',
    ]);
  });

  it('grupos', () => {
    expect(titulos(filtrarChats({ chats, filtro: 'grupos', texto: '' }))).toEqual([
      'Los originales',
      'Mis lokillos',
    ]);
  });

  /**
   * **Sin tildes y sin mayúsculas.** Nadie escribe la tilde en un buscador, y no
   * encontrar a «José» escribiendo «jose» es la clase de detalle que hace sentir
   * rota una app. Es la misma regla que ya usa el buscador de contactos.
   */
  it('busca sin tildes ni mayúsculas', () => {
    expect(titulos(filtrarChats({ chats, filtro: 'todos', texto: 'JOSE' }))).toEqual([
      'José Zamora',
    ]);
  });

  /** También por lo último que se dijo: así se encuentra el chat donde estaba ESO. */
  it('busca en el último mensaje', () => {
    expect(titulos(filtrarChats({ chats, filtro: 'todos', texto: 'domingo' }))).toEqual([
      'José Zamora',
    ]);
  });

  it('el filtro y la búsqueda se combinan', () => {
    expect(titulos(filtrarChats({ chats, filtro: 'grupos', texto: 'lokillos' }))).toEqual([
      'Mis lokillos',
    ]);
  });

  it('sin coincidencias devuelve vacío, no todo', () => {
    expect(filtrarChats({ chats, filtro: 'todos', texto: 'zzz' })).toEqual([]);
  });

  /**
   * La MISMA referencia cuando no hay nada que filtrar: devolver una copia
   * obliga a la lista a redibujarse entera sin que haya cambiado nada.
   */
  it('sin filtro devuelve el mismo array', () => {
    expect(filtrarChats({ chats, filtro: 'todos', texto: '   ' })).toBe(chats);
  });
});

describe('contarChats', () => {
  it('cuenta lo que cada chip muestra al lado', () => {
    expect(contarChats(chats)).toEqual({ 'no-leidos': 2, grupos: 2 });
  });

  it('sin chats, todo en cero', () => {
    expect(contarChats([])).toEqual({ 'no-leidos': 0, grupos: 0 });
  });
});
