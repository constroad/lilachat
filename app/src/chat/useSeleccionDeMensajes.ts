import { useCallback, useMemo, useState } from 'react';

/**
 * Los mensajes elegidos con pulsación larga (FL9; salió de `ChatScreen`). Como
 * WhatsApp: el primero entra en modo selección y después cada toque suma o
 * saca; sin ninguno, se sale del modo.
 */
export function useSeleccionDeMensajes<M extends { seq: number }>(mensajes: readonly M[]) {
  const [elegidos, setElegidos] = useState<ReadonlySet<number>>(() => new Set());

  const alternar = useCallback((seq: number) => {
    setElegidos((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(seq)) nuevos.delete(seq);
      else nuevos.add(seq);
      return nuevos;
    });
  }, []);
  const soltar = useCallback(() => setElegidos(new Set()), []);

  // Lo que ya no está (lo borró el otro, se ocultó) deja de contar solo.
  const elegidosVivos = useMemo(() => mensajes.filter((mensaje) => elegidos.has(mensaje.seq)), [mensajes, elegidos]);

  return { elegidos, mensajes: elegidosVivos, enSeleccion: elegidosVivos.length > 0, alternar, soltar };
}
