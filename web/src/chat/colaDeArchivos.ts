import { useSyncExternalStore } from 'react';
import type { ChatMessage, MensajeEnPantalla } from './types';

/**
 * Fotos, archivos y notas de voz que salen desde la web (auditoría 19/10),
 * como WhatsApp Web: la burbuja aparece YA con la vista local, la foto se
 * comprime (salvo «HD») y sube por detrás con su progreso. La clave del
 * cliente es UNA por archivo: reintentar no duplica el mensaje (antes nacía
 * una clave nueva en cada intento). Al subir, el mensaje confirmado se entrega
 * ANTES de quitar la pendiente: sin hueco aunque el socket esté caído.
 *
 * Vive en memoria: al recargar la pestaña lo pendiente se pierde (un `File`
 * no sobrevive), igual que en WhatsApp Web.
 */
export type ArchivoPendiente = {
  clientKey: string;
  chatId: string;
  archivo: Blob;
  nombre: string;
  mime: string;
  vista: string | null;
  caption?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  onda?: number[];
  queuedAt: string;
  preparando: boolean;
  progreso?: number;
  fallo?: string;
};

export type DatosDeSubida = Pick<ArchivoPendiente, 'archivo' | 'nombre' | 'chatId' | 'clientKey' | 'caption' | 'width' | 'height' | 'durationMs' | 'onda'> & {
  onProgreso: (razon: number) => void;
};
export type ResultadoDeSubida = { ok: true; mensaje?: ChatMessage } | { ok: false; message: string; reintentable: boolean };

export type DependenciasDeLaCola = {
  subir: (datos: DatosDeSubida) => Promise<ResultadoDeSubida>;
  preparar: (archivo: File, hd: boolean) => Promise<{ archivo: Blob; nombre: string; mime: string; width?: number; height?: number }>;
  crearVista: (archivo: Blob) => string | null;
  revocarVista: (url: string) => void;
  uuid: () => string;
  ahora: () => string;
};

export type OpcionesDeEnvio = { caption?: string; hd?: boolean; durationMs?: number; onda?: number[] };

export function crearColaDeArchivos(deps: DependenciasDeLaCola) {
  let cola: ArchivoPendiente[] = [];
  let subiendo = false;
  let alConfirmar: ((mensaje: ChatMessage) => void) | undefined;
  const oyentes = new Set<() => void>();
  const avisar = () => oyentes.forEach((oyente) => oyente());
  const cambiar = (clientKey: string, cambios: Partial<ArchivoPendiente>) => {
    cola = cola.map((uno) => (uno.clientKey === clientKey ? { ...uno, ...cambios } : uno));
    avisar();
  };
  const sacar = (clientKey: string) => {
    const archivo = cola.find((uno) => uno.clientKey === clientKey);
    if (archivo?.vista) deps.revocarVista(archivo.vista);
    cola = cola.filter((uno) => uno.clientKey !== clientKey);
    avisar();
  };

  async function encolar(chatId: string, archivo: File, opciones: OpcionesDeEnvio): Promise<void> {
    const clientKey = deps.uuid();
    const vista = archivo.type.startsWith('image/') ? deps.crearVista(archivo) : null;
    const { hd, ...datos } = opciones;
    cola = [...cola, { clientKey, chatId, archivo, nombre: archivo.name, mime: archivo.type, vista, queuedAt: deps.ahora(), preparando: true, ...datos }];
    avisar();
    try {
      cambiar(clientKey, { ...(await deps.preparar(archivo, Boolean(hd))), preparando: false });
    } catch {
      // Si no se pudo preparar (comprimir), va como está.
      cambiar(clientKey, { preparando: false });
    }
    await drenar();
  }

  async function subirUno(archivo: ArchivoPendiente): Promise<void> {
    const resultado = await deps.subir({ ...archivo, onProgreso: (progreso) => cambiar(archivo.clientKey, { progreso }) });
    if (resultado.ok) {
      if (resultado.mensaje) alConfirmar?.(resultado.mensaje);
      return sacar(archivo.clientKey);
    }
    cambiar(archivo.clientKey, { fallo: resultado.message, progreso: undefined });
  }

  async function drenar(): Promise<void> {
    if (subiendo) return;
    subiendo = true;
    try {
      for (;;) {
        const siguiente = cola.find((uno) => !uno.fallo);
        // Si el primero todavía se prepara, se espera: subir el de atrás desordenaría el chat.
        if (!siguiente || siguiente.preparando) break;
        await subirUno(siguiente);
      }
    } finally {
      subiendo = false;
    }
  }

  return {
    encolar,
    async reintentar(clientKey: string) {
      cambiar(clientKey, { fallo: undefined });
      await drenar();
    },
    descartar: sacar,
    delChat: (chatId: string) => cola.filter((uno) => uno.chatId === chatId),
    tiene: (clientKey: string) => cola.some((uno) => uno.clientKey === clientKey),
    configurar(opciones: { alConfirmar?: (mensaje: ChatMessage) => void }) {
      alConfirmar = opciones.alConfirmar;
    },
    suscribir(oyente: () => void) {
      oyentes.add(oyente);
      return () => void oyentes.delete(oyente);
    },
  };
}

const tipoDe = (mime: string) => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file');

/** Un pendiente, como lo dibuja la conversación (al final, con su estado). */
export function comoMensaje(archivo: ArchivoPendiente, yo: string): MensajeEnPantalla {
  return {
    chatId: archivo.chatId,
    seq: Number.MAX_SAFE_INTEGER,
    senderId: yo,
    clientKey: archivo.clientKey,
    kind: tipoDe(archivo.mime),
    body: archivo.caption,
    media: { url: archivo.vista ?? undefined, mime: archivo.mime, fileName: archivo.nombre, width: archivo.width, height: archivo.height, durationMs: archivo.durationMs, onda: archivo.onda },
    at: archivo.queuedAt,
    estado: archivo.fallo ? 'fallido' : 'enviando',
    motivoDelFallo: archivo.fallo,
    progreso: archivo.progreso,
  };
}

/** Lo pendiente de un chat, en vivo. */
export function usePendientesDeArchivos(cola: ReturnType<typeof crearColaDeArchivos>, chatId: string): ArchivoPendiente[] {
  return useSyncExternalStore(cola.suscribir, () => instantanea(cola, chatId));
}

/** La misma referencia mientras no cambie (lo exige `useSyncExternalStore`). */
const instantaneas = new WeakMap<object, { clave: string; valor: ArchivoPendiente[] }>();
function instantanea(cola: ReturnType<typeof crearColaDeArchivos>, chatId: string): ArchivoPendiente[] {
  const valor = cola.delChat(chatId);
  const clave = `${chatId}|${valor.map((uno) => `${uno.clientKey}:${uno.progreso ?? ''}:${uno.fallo ?? ''}:${uno.preparando}:${uno.width ?? ''}`).join(',')}`;
  const previa = instantaneas.get(cola);
  if (previa?.clave === clave) return previa.valor;
  instantaneas.set(cola, { clave, valor });
  return valor;
}
