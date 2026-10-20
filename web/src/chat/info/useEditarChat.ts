import { useCallback } from 'react';
import { normalizarNombreDeGrupo } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';

/**
 * Lo que se edita desde el panel «Info.» (W3b): nombre, foto y participantes.
 * El permiso lo decide el server; acá solo se pide y se muestra su motivo.
 * Tras cada cambio, `onCambio` relee el detalle y la lista.
 */
export function useEditarChat(params: { chatId: string; jwt: string; onCambio: () => void; onAviso: (texto: string) => void }) {
  const { chatId, jwt, onCambio, onAviso } = params;

  const resolver = useCallback(
    (respuesta: ApiResult<unknown>): boolean => {
      if (!respuesta.ok) {
        onAviso(respuesta.message);
        return false;
      }
      onCambio();
      return true;
    },
    [onAviso, onCambio]
  );

  const renombrar = useCallback(
    async (nombre: string): Promise<boolean> => {
      const validado = normalizarNombreDeGrupo(nombre);
      if (!validado.ok) {
        onAviso(validado.motivo);
        return false;
      }
      return resolver(await api(`/chats/${chatId}`, { method: 'PATCH', body: { name: validado.nombre }, jwt }));
    },
    [chatId, jwt, onAviso, resolver]
  );

  /** La foto va como archivo: el `api` común manda JSON. */
  const cambiarFoto = useCallback(
    async (archivo: File) => {
      const formulario = new FormData();
      formulario.append('file', archivo);
      try {
        const respuesta = await fetch(`/api/chats/${chatId}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: formulario });
        const datos = (await respuesta.json().catch(() => ({}))) as { message?: string };
        resolver(respuesta.ok ? { ok: true, data: datos } : { ok: false, status: respuesta.status, message: datos.message ?? 'No se pudo cambiar la foto.' });
      } catch {
        onAviso('Sin conexión. Revisa tu internet.');
      }
    },
    [chatId, jwt, onAviso, resolver]
  );

  const agregar = useCallback(async (userId: string) => void resolver(await api(`/chats/${chatId}/members`, { body: { userId }, jwt })), [chatId, jwt, resolver]);
  const cambiarRol = useCallback(
    async (userId: string, role: 'admin' | 'member') => void resolver(await api(`/chats/${chatId}/members/${userId}`, { method: 'PATCH', body: { role }, jwt })),
    [chatId, jwt, resolver]
  );
  const sacar = useCallback(async (userId: string) => void resolver(await api(`/chats/${chatId}/members/${userId}`, { method: 'DELETE', jwt })), [chatId, jwt, resolver]);

  return { renombrar, cambiarFoto, agregar, cambiarRol, sacar };
}
