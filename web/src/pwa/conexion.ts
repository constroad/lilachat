import { useEffect, useState } from 'react';

/** Un corte más corto que esto es una reconexión: no merece un cartel. */
export const GRACIA_SIN_SOCKET_MS = 5000;

/** ¿Se avisa «Sin conexión»? Sin red, ya; con red pero sin socket, pasada la gracia. */
export function mostrarSinConexion(p: { enLinea: boolean; socketConectado: boolean; sinSocketDesdeMs: number | null; ahora: number }): boolean {
  if (!p.enLinea) return true;
  if (p.socketConectado || p.sinSocketDesdeMs === null) return false;
  return p.ahora - p.sinSocketDesdeMs >= GRACIA_SIN_SOCKET_MS;
}

/**
 * «Sin conexión. Lo que escribas se enviará al volver.» (W4). Sigue a la red
 * del navegador y al socket; no hace polling: un solo temporizador al cortarse.
 */
export function useSinConexion(socketConectado: boolean, haySesion: boolean): boolean {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [sinSocketDesde, setSinSocketDesde] = useState<number | null>(null);
  const [, refrescar] = useState(0);

  useEffect(() => {
    const cambiar = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', cambiar);
    window.addEventListener('offline', cambiar);
    return () => {
      window.removeEventListener('online', cambiar);
      window.removeEventListener('offline', cambiar);
    };
  }, []);

  useEffect(() => {
    if (socketConectado || !haySesion) return setSinSocketDesde(null);
    setSinSocketDesde(Date.now());
    const espera = setTimeout(() => refrescar((n) => n + 1), GRACIA_SIN_SOCKET_MS);
    return () => clearTimeout(espera);
  }, [socketConectado, haySesion]);

  return mostrarSinConexion({ enLinea, socketConectado: socketConectado || !haySesion, sinSocketDesdeMs: sinSocketDesde, ahora: Date.now() });
}
