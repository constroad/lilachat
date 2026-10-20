import { describe, expect, it, vi } from 'vitest';
import { comoMensaje, crearColaDeArchivos, type DependenciasDeLaCola } from './colaDeArchivos';
import type { ChatMessage } from './types';

const CHAT = '6a90cf9012ab34cd56ef7890';
const YO = '665f1a2b3c4d5e6f70818293';

function armar(subir?: DependenciasDeLaCola['subir']) {
  let n = 0;
  const preparado = { resolver: () => undefined as void };
  const deps: DependenciasDeLaCola = {
    subir: subir ?? vi.fn(async (p) => ({ ok: true as const, mensaje: { chatId: p.chatId, seq: 9, senderId: YO, clientKey: p.clientKey, kind: 'image', at: 'x' } as ChatMessage })),
    preparar: vi.fn(async (archivo: File) => ({ archivo, nombre: 'foto.jpg', mime: 'image/jpeg', width: 1600, height: 1200 })),
    crearVista: vi.fn(() => 'blob:vista'),
    revocarVista: vi.fn(),
    uuid: () => `clave-${++n}`,
    ahora: () => `2026-10-19T20:00:0${n}.000Z`,
  };
  return { cola: crearColaDeArchivos(deps), deps, preparado };
}

const foto = () => new File(['x'], 'IMG_1.png', { type: 'image/png' });
const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Auditoría (19/10): en la web no había burbuja hasta que subía, sin progreso, y un reintento duplicaba. */
describe('cola de archivos de la web', () => {
  it('la burbuja aparece YA, antes de comprimir y subir', () => {
    const { cola } = armar();
    void cola.encolar(CHAT, foto(), {});
    expect(cola.delChat(CHAT)).toHaveLength(1);
    expect(comoMensaje(cola.delChat(CHAT)[0]!, YO)).toMatchObject({ estado: 'enviando', senderId: YO, media: { url: 'blob:vista' } });
  });

  it('al subir, entrega el confirmado ANTES de quitar la pendiente', async () => {
    const { cola } = armar();
    const vistos: number[] = [];
    cola.configurar({ alConfirmar: () => vistos.push(cola.delChat(CHAT).length) });
    await cola.encolar(CHAT, foto(), {});
    await esperar();
    expect(vistos).toEqual([1]);
    expect(cola.delChat(CHAT)).toHaveLength(0);
  });

  it('si falla queda «No se envió»; reintentar usa la MISMA clave', async () => {
    const subir = vi.fn().mockResolvedValueOnce({ ok: false, message: 'Sin conexión', reintentable: true }).mockResolvedValueOnce({ ok: true });
    const { cola } = armar(subir);
    await cola.encolar(CHAT, foto(), {});
    await esperar();
    const [pendiente] = cola.delChat(CHAT);
    expect(comoMensaje(pendiente!, YO)).toMatchObject({ estado: 'fallido', motivoDelFallo: 'Sin conexión' });
    await cola.reintentar(pendiente!.clientKey);
    await esperar();
    expect(subir.mock.calls.map((llamada) => llamada[0].clientKey)).toEqual(['clave-1', 'clave-1']);
    expect(cola.delChat(CHAT)).toHaveLength(0);
  });

  it('descartar la saca y libera la vista', async () => {
    const subir = vi.fn().mockResolvedValue({ ok: false, message: 'No', reintentable: false });
    const { cola, deps } = armar(subir);
    await cola.encolar(CHAT, foto(), {});
    await esperar();
    cola.descartar(cola.delChat(CHAT)[0]!.clientKey);
    expect(cola.delChat(CHAT)).toHaveLength(0);
    expect(deps.revocarVista).toHaveBeenCalledWith('blob:vista');
  });

  it('sube de a una y en orden', async () => {
    const orden: string[] = [];
    const subir = vi.fn(async (p: { clientKey: string }) => (orden.push(p.clientKey), { ok: true as const }));
    const { cola } = armar(subir);
    await Promise.all([cola.encolar(CHAT, foto(), {}), cola.encolar(CHAT, foto(), {})]);
    await esperar();
    await esperar();
    expect(orden).toEqual(['clave-1', 'clave-2']);
  });
});
