import { describe, expect, it } from 'vitest';
import { contarChats, filtrarChats, separarArchivados, type ChatFiltrable } from './filtrosDeChats.js';

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
  it('a list of my own shows only its chats (pending 45)', () => {
    // Arrange
    const withIds = chats.map((one, index) => ({ ...one, id: `c${index}` }));
    // Act
    const shown = filtrarChats({ chats: withIds, filtro: 'lista:family', texto: '', lista: new Set(['c0', 'c3']) });
    // Assert
    expect(titulos(shown)).toEqual(['Wilson', 'Mis lokillos']);
  });

  it('a list chip whose list is gone shows nothing, not everything', () => {
    expect(filtrarChats({ chats, filtro: 'lista:gone', texto: '' })).toEqual([]);
  });

  it('a list and the search work together', () => {
    const withIds = chats.map((one, index) => ({ ...one, id: `c${index}` }));
    expect(titulos(filtrarChats({ chats: withIds, filtro: 'lista:family', texto: 'lok', lista: new Set(['c0', 'c3']) }))).toEqual(['Mis lokillos']);
  });

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
    expect(contarChats(chats)).toEqual({ 'no-leidos': 2, grupos: 2, borradores: 0 });
  });

  it('sin chats, todo en cero', () => {
    expect(contarChats([])).toEqual({ 'no-leidos': 0, grupos: 0, borradores: 0 });
  });
});

/**
 * José, 19/10: chats contigo mismo, con nombre, «en otra categoría arriba,
 * como Todos, No leídos, Grupos y Borradores».
 */
describe('borradores', () => {
  const conBorradores = [...chats, chat({ titulo: 'Ideas obra', esBorrador: true }), chat({ titulo: 'Compras', esBorrador: true })];

  it('el chip «Borradores» muestra solo los chats contigo', () => {
    expect(titulos(filtrarChats({ chats: conBorradores, filtro: 'borradores', texto: '' }))).toEqual(['Ideas obra', 'Compras']);
  });

  it('un borrador no es un grupo', () => {
    expect(titulos(filtrarChats({ chats: conBorradores, filtro: 'grupos', texto: '' }))).toEqual(['Los originales', 'Mis lokillos']);
  });

  it('se cuentan aparte', () => {
    expect(contarChats(conBorradores).borradores).toBe(2);
  });
});

/**
 * Archivados y «marcar como no leído» (FL9). El archivado sale de la lista
 * principal (vive en «Archivados»), y el marcado a mano cuenta como no leído
 * para el chip aunque no tenga mensajes nuevos.
 */
describe('archivados y marcados como no leídos', () => {
  const base = { titulo: 'x', esGrupo: false, sinLeer: 0 };

  it('separarArchivados: cada chat a su lado, en el mismo orden', () => {
    const chats = [
      { ...base, titulo: 'a' },
      { ...base, titulo: 'b', archivado: true },
      { ...base, titulo: 'c' },
    ];

    const { principales, archivados } = separarArchivados(chats);

    expect(principales.map((chat) => chat.titulo)).toEqual(['a', 'c']);
    expect(archivados.map((chat) => chat.titulo)).toEqual(['b']);
  });

  it('el marcado a mano entra en el chip «No leídos» y en su cuenta', () => {
    const chats = [{ ...base, titulo: 'marcado', marcadoNoLeido: true }, { ...base, titulo: 'leido' }];

    expect(filtrarChats({ chats, filtro: 'no-leidos', texto: '' }).map((chat) => chat.titulo)).toEqual(['marcado']);
    expect(contarChats(chats)['no-leidos']).toBe(1);
  });
});
