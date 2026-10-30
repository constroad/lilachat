import { useCallback } from 'react';
import { normalizarDescripcion, normalizarNombreDeGrupo } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';
import { uploadGroupPhoto } from './groupPhoto';

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

  /** La descripción (20/10): la misma validación que el server; vacía la borra. */
  const describir = useCallback(
    async (descripcion: string): Promise<boolean> => {
      const validada = normalizarDescripcion(descripcion);
      if (!validada.ok) {
        onAviso(validada.motivo);
        return false;
      }
      return resolver(await api(`/chats/${chatId}`, { method: 'PATCH', body: { descripcion: validada.descripcion }, jwt }));
    },
    [chatId, jwt, onAviso, resolver]
  );

  /** La foto va como archivo: el `api` común manda JSON. */
  const cambiarFoto = useCallback(
    async (archivo: File) => {
      const subida = await uploadGroupPhoto(jwt, chatId, archivo);
      if (subida.ok) return void resolver({ ok: true, data: subida });
      if (subida.status === 0) return onAviso(subida.message);
      resolver({ ok: false, status: subida.status, message: subida.message });
    },
    [chatId, jwt, onAviso, resolver]
  );

  const agregar = useCallback(
    async (userId: string, history?: boolean) => void resolver(await api(`/chats/${chatId}/members`, { body: history === undefined ? { userId } : { userId, history }, jwt })),
    [chatId, jwt, resolver]
  );
  const cambiarRol = useCallback(
    async (userId: string, role: 'admin' | 'member') => void resolver(await api(`/chats/${chatId}/members/${userId}`, { method: 'PATCH', body: { role }, jwt })),
    [chatId, jwt, resolver]
  );
  const sacar = useCallback(async (userId: string) => void resolver(await api(`/chats/${chatId}/members/${userId}`, { method: 'DELETE', jwt })), [chatId, jwt, resolver]);

  return { renombrar, describir, cambiarFoto, agregar, cambiarRol, sacar };
}
