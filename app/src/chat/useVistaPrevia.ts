import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { pedirVistaPrevia } from '../api/client';
import { rememberPreview, type PreviewEntry } from './linkPreviewCache';

/** Lo último que se supo de cada enlace: la celda reciclada no vuelve a pedir. `null` = no tiene. */
const vistas = new Map<string, VistaPreviaDeEnlace | null>();
const enCamino = new Map<string, Promise<VistaPreviaDeEnlace | null>>();
const STORED_PREVIEWS_KEY = 'lilachat.vistasPrevias';
let storedEntries: PreviewEntry[] = [];

/**
 * The cards already seen survive a restart (E2E, 20/10: on the first open after
 * a restart every card was born at 0 dp and pushed the chat when it arrived).
 * Loaded once, at import, before any chat opens.
 */
const hydration = AsyncStorage.getItem(STORED_PREVIEWS_KEY)
  .then((raw) => {
    storedEntries = raw ? (JSON.parse(raw) as PreviewEntry[]) : [];
    for (const [url, preview] of storedEntries) if (!vistas.has(url)) vistas.set(url, preview);
  })
  .catch(() => {
    storedEntries = [];
  });

function storePreview(url: string, preview: VistaPreviaDeEnlace | null) {
  storedEntries = rememberPreview(storedEntries, url, preview);
  AsyncStorage.setItem(STORED_PREVIEWS_KEY, JSON.stringify(storedEntries)).catch(() => undefined);
}

function buscar(url: string, jwt: string): Promise<VistaPreviaDeEnlace | null> {
  const yaVa = enCamino.get(url);
  if (yaVa) return yaVa;
  const viaje = pedirVistaPrevia(url, jwt)
    .then((respuesta) => {
      // Sin red no se recuerda nada: se vuelve a probar la próxima vez.
      if (respuesta.ok) {
        vistas.set(url, respuesta.data.vistaPrevia);
        storePreview(url, respuesta.data.vistaPrevia);
      }
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
    void hydration
      .then(() => (vistas.has(url) ? vistas.get(url)! : buscar(url, jwt)))
      .then((encontrada) => vigente && setVista(encontrada));
    return () => {
      vigente = false;
    };
  }, [url, jwt]);
  return vista;
}
