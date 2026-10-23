import { describe, expect, it } from 'vitest';
import { aDetalle } from '../useDetalleDelChat';
import type { ChatSummary } from '../types';
import { armarInfo } from './infoDelChat';

const chat = (kind: ChatSummary['kind'], extra: Partial<ChatSummary> = {}): ChatSummary => ({ id: 'c1', kind, name: 'Familia', memberIds: [], lastSeq: 1, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0, ...extra });
const grupo = aDetalle({
  members: [
    { id: 'beto', name: 'Beto', phone: '900000089', role: 'member' },
    { id: 'yo', name: 'José', phone: '902049935', role: 'member', esYo: true },
    { id: 'mama', name: 'Mamá', phone: '900000001', role: 'admin' },
    { id: 'ana', name: 'Ana', phone: '900000088', role: 'member' },
  ],
});

describe('armarInfo', () => {
  it('grupo: título, cuántos son, y yo primero, después admins y el resto por nombre', () => {
    const info = armarInfo({ chat: chat('group'), detalle: grupo, yo: 'yo' });
    expect(info.titulo).toBe('Info. del grupo');
    expect(info.subtitulo).toBe('Grupo · 4 miembros');
    expect(info.miembros.map((uno) => uno.nombre)).toEqual(['Tú', 'Mamá', 'Ana', 'Beto']);
    expect(info.puedeSalir).toBe(true);
    expect(info.puedeEliminar).toBe(false);
  });

  it('cualquier miembro edita el nombre y suma gente; sacar y nombrar admin es de admins', () => {
    const comoMiembro = armarInfo({ chat: chat('group'), detalle: grupo, yo: 'yo' });
    expect(comoMiembro.puedeEditar).toBe(true);
    expect(comoMiembro.puedeAgregar).toBe(true);
    expect(comoMiembro.miembros.every((uno) => uno.acciones.length === 0)).toBe(true);

    const comoAdmin = armarInfo({ chat: chat('group'), detalle: grupo, yo: 'mama' });
    expect(comoAdmin.miembros.find((uno) => uno.id === 'ana')?.acciones).toEqual(['hacer-admin', 'sacar']);
  });

  it('1:1: «Info. del contacto», su teléfono, sin participantes; se elimina, no se sale', () => {
    const detalle = aDetalle({ members: [{ id: 'yo', name: 'José', phone: '9', esYo: true }, { id: 'ana', name: 'Ana', phone: '900000088' }] });
    const info = armarInfo({ chat: chat('direct', { name: 'Ana' }), detalle, yo: 'yo' });
    expect(info.titulo).toBe('Info. del contacto');
    expect(info.subtitulo).toBe('900000088');
    expect(info.puedeEditar).toBe(false);
    expect(info.puedeAgregar).toBe(false);
    expect(info.miembros).toEqual([]);
    expect(info.puedeEliminar).toBe(true);
  });

  it('borrador: «Solo tú lo ves», con nombre editable y sin participantes', () => {
    const detalle = aDetalle({ members: [{ id: 'yo', name: 'José', phone: '9', esYo: true, role: 'admin' }] });
    const info = armarInfo({ chat: chat('notas', { name: 'Ideas' }), detalle, yo: 'yo' });
    expect(info.titulo).toBe('Info. del borrador');
    expect(info.subtitulo).toBe('Solo tú lo ves');
    expect(info.puedeEditar).toBe(true);
    expect(info.puedeAgregar).toBe(false);
    expect(info.miembros).toEqual([]);
  });

  it('sin detalle todavía, nada que se pueda tocar', () => {
    const info = armarInfo({ chat: chat('group'), detalle: null, yo: 'yo' });
    expect(info.puedeEditar).toBe(false);
    expect(info.miembros).toEqual([]);
  });
});
