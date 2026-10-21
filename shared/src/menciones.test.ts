import { describe, expect, it } from 'vitest';
import { MAX_MENCIONES, MENTION_ALL, MENTION_HERE, mentionedUserIds, mentionOptions, notificationLevel, partirEnMenciones, ringsFor, settingsForLevel, validarMenciones, validateMentions } from './menciones.js';

const ANA = '665f1a2b3c4d5e6f70818294';
const BETO = '665f1a2b3c4d5e6f70818295';

/**
 * José, 18/10: «en un grupo no puedo taggear un contacto colocando @». La
 * mención viaja como el texto que eligió quien escribe MÁS el rango y el id:
 * cada teléfono la dibuja con SU nombre para esa persona, y una app vieja
 * igual lee «@Ana».
 */
describe('validarMenciones', () => {
  const texto = 'Hola @Ana y @Beto, ¿vienen?';

  it('acepta rangos que caen sobre un «@» y son de miembros', () => {
    const menciones = [
      { userId: ANA, desde: 5, largo: 4 },
      { userId: BETO, desde: 12, largo: 5 },
    ];
    expect(validarMenciones(texto, menciones, [ANA, BETO])).toEqual(menciones);
  });

  it('descarta lo que no es de un miembro, sale del texto o no empieza con «@»', () => {
    const resultado = validarMenciones(
      texto,
      [
        { userId: '665f1a2b3c4d5e6f70818299', desde: 5, largo: 4 },
        { userId: ANA, desde: 40, largo: 4 },
        { userId: BETO, desde: 0, largo: 4 },
      ],
      [ANA, BETO]
    );
    expect(resultado).toEqual([]);
  });

  it('sin superposiciones, ordenadas y con tope', () => {
    const muchas = Array.from({ length: MAX_MENCIONES + 5 }, () => ({ userId: ANA, desde: 5, largo: 4 }));
    expect(validarMenciones(texto, muchas, [ANA])).toEqual([{ userId: ANA, desde: 5, largo: 4 }]);
    expect(
      validarMenciones(texto, [{ userId: BETO, desde: 12, largo: 5 }, { userId: ANA, desde: 5, largo: 4 }], [ANA, BETO]).map((m) => m.desde)
    ).toEqual([5, 12]);
  });

  it('basura en vez de un arreglo: ninguna', () => {
    expect(validarMenciones(texto, 'x' as never, [ANA])).toEqual([]);
    expect(validarMenciones(texto, [{ userId: ANA, desde: 'cinco', largo: 4 }] as never, [ANA])).toEqual([]);
  });
});

describe('partirEnMenciones', () => {
  it('parte el texto en tramos y menciones', () => {
    expect(partirEnMenciones('Hola @Ana!', [{ userId: ANA, desde: 5, largo: 4 }])).toEqual([
      { tipo: 'texto', texto: 'Hola ' },
      { tipo: 'mencion', userId: ANA, texto: '@Ana' },
      { tipo: 'texto', texto: '!' },
    ]);
  });

  it('sin menciones, un solo tramo', () => {
    expect(partirEnMenciones('hola', undefined)).toEqual([{ tipo: 'texto', texto: 'hola' }]);
  });

  it('un rango que ya no calza (mensaje editado) se ignora', () => {
    expect(partirEnMenciones('Hola Ana', [{ userId: ANA, desde: 5, largo: 4 }])).toEqual([{ tipo: 'texto', texto: 'Hola Ana' }]);
  });
});

/** E3b (20/10): group mentions (all / here) and the per-chat notification level. */
describe('group mentions', () => {
  const members = ['ana', 'beto', 'yo'];

  it('@todos and @aquí are valid only in a group and only over that exact text', () => {
    const text = '@todos y @aquí revisen';
    const raw = [{ userId: MENTION_ALL, desde: 0, largo: 6 }, { userId: MENTION_HERE, desde: 9, largo: 5 }];
    expect(validateMentions(text, raw, members, { groupMentions: true })).toEqual(raw);
    expect(validateMentions(text, raw, members)).toEqual([]);
    expect(validateMentions('@todas', [{ userId: MENTION_ALL, desde: 0, largo: 6 }], members, { groupMentions: true })).toEqual([]);
  });

  it('who a mention reaches: the person, everyone, or those online', () => {
    const online = (id: string) => id === 'beto';
    expect([...mentionedUserIds([{ userId: 'ana', desde: 0, largo: 4 }], members, online)]).toEqual(['ana']);
    expect([...mentionedUserIds([{ userId: MENTION_ALL, desde: 0, largo: 6 }], members, online)].sort()).toEqual(members);
    expect([...mentionedUserIds([{ userId: MENTION_HERE, desde: 0, largo: 5 }], members, online)]).toEqual(['beto']);
    expect(mentionedUserIds(undefined, members, online).size).toBe(0);
  });
});

describe('notification level', () => {
  it('comes from muted, refined by avisos', () => {
    expect(notificationLevel({})).toBe('todo');
    expect(notificationLevel({ muted: true })).toBe('menciones');
    expect(notificationLevel({ muted: true, avisos: 'nada' })).toBe('nada');
    // A stray «nada» without muted (an old client unmuted) is «todo».
    expect(notificationLevel({ muted: false, avisos: 'nada' })).toBe('todo');
  });

  it('each level is written as muted + avisos', () => {
    expect(settingsForLevel('todo')).toEqual({ muted: false, avisos: null });
    expect(settingsForLevel('menciones')).toEqual({ muted: true, avisos: null });
    expect(settingsForLevel('nada')).toEqual({ muted: true, avisos: 'nada' });
  });

  it('a mention rings with «solo menciones» but not with «nada»', () => {
    expect(ringsFor('todo', false)).toBe(true);
    expect(ringsFor('menciones', false)).toBe(false);
    expect(ringsFor('menciones', true)).toBe(true);
    expect(ringsFor('nada', true)).toBe(false);
  });
});

describe('mention options', () => {
  it('a group offers @todos and @aquí before the people; a 1:1 offers nothing', () => {
    expect(mentionOptions([{ id: 'ana', nombre: 'Ana' }])?.map((option) => option.nombre)).toEqual(['todos', 'aquí', 'Ana']);
    expect(mentionOptions([{ id: 'ana', nombre: 'Ana' }, { id: 'beto', nombre: 'Beto' }])?.[0]).toMatchObject({ hint: 'Avisa a los 3 del grupo' });
    expect(mentionOptions([])).toBeUndefined();
    expect(mentionOptions(undefined)).toBeUndefined();
  });
});
