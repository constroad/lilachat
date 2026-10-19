import { useCallback, useEffect, useState } from 'react';
import { cerrarVinculado, listarVinculados, type DispositivoVinculado } from '../api/client';
import { getSocket } from '../chat/socketClient';

export type EstadoDeVinculados = { fase: 'cargando' } | { fase: 'listo'; dispositivos: DispositivoVinculado[] } | { fase: 'error' };

/**
 * La lista de webs vinculadas: se pide al abrir la pantalla y cada vez que el
 * server avisa `vinculos.changed`. Releer apenas se aprueba no alcanza: el
 * dispositivo nace un instante después, cuando la web canja la aprobación.
 */
export function useDispositivosVinculados(jwt: string, abierta: boolean) {
  const [estado, setEstado] = useState<EstadoDeVinculados>({ fase: 'cargando' });

  const recargar = useCallback(async () => {
    const resultado = await listarVinculados(jwt);
    setEstado(resultado.ok ? { fase: 'listo', dispositivos: resultado.data.dispositivos } : { fase: 'error' });
  }, [jwt]);

  useEffect(() => {
    if (!abierta) return;
    void recargar();
    const socket = getSocket();
    const alCambiar = () => void recargar();
    socket?.on('vinculos.changed', alCambiar);
    return () => {
      socket?.off('vinculos.changed', alCambiar);
    };
  }, [abierta, recargar]);

  /** `true` si se cerró; la lista se relee igual (otro teléfono pudo cambiarla). */
  const cerrar = useCallback(
    async (deviceId: string) => {
      const resultado = await cerrarVinculado(jwt, deviceId);
      await recargar();
      return resultado.ok || resultado.status === 404;
    },
    [jwt, recargar]
  );

  return { estado, recargar, cerrar };
}
