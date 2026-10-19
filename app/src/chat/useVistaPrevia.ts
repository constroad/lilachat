import { useEffect, useState } from 'react';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { pedirVistaPrevia } from '../api/client';

/** Lo último que se supo de cada enlace: la celda reciclada no vuelve a pedir. `null` = no tiene. */
const vistas = new Map<string, VistaPreviaDeEnlace | null>();
const enCamino = new Map<string, Promise<VistaPreviaDeEnlace | null>>();

function buscar(url: string, jwt: string): Promise<VistaPreviaDeEnlace | null> {
  const yaVa = enCamino.get(url);
  if (yaVa) return yaVa;
  const viaje = pedirVistaPrevia(url, jwt)
    .then((respuesta) => {
      // Sin red no se recuerda nada: se vuelve a probar la próxima vez.
      if (respuesta.ok) vistas.set(url, respuesta.data.vistaPrevia);
      return respuesta.ok ? respuesta.data.vistaPrevia : null;
    })
    .finally(() => enCamino.delete(url));
  enCamino.set(url, viaje);
  return viaje;
}

/**
 * La tarjeta de un enlace (FL13d), la MISMA caché para la burbuja y para la
 * barra de escribir: lo que se previsualizó al tipear sale al instante al
 * enviarlo. `undefined` mientras viaja; `null` si la página no tiene.
 */
export function useVistaPrevia(url: string | null, jwt: string | undefined): VistaPreviaDeEnlace | null | undefined {
  const [vista, setVista] = useState<VistaPreviaDeEnlace | null | undefined>(() => (url ? vistas.get(url) : null));
  useEffect(() => {
    if (!url || !jwt) return setVista(null);
    if (vistas.has(url)) return setVista(vistas.get(url));
    setVista(undefined);
    let vigente = true;
    void buscar(url, jwt).then((encontrada) => vigente && setVista(encontrada));
    return () => {
      vigente = false;
    };
  }, [url, jwt]);
  return vista;
}
