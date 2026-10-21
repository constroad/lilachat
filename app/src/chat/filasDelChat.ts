import { formatClock, tamanoDeBurbuja } from '@lilachat/shared';
import type { ArchivoEnCola } from './colaDeArchivosMotor';

/**
 * Lo puro de las filas de la conversación (FL2, spec §45): de qué tipo es cada
 * fila y a quién cita cada respuesta. Antes se calculaba por fila y por render
 * —con un `messages.find` por fila, O(n²)— y una tecla en el campo de escribir
 * volvía a hacerlo para toda la pantalla.
 */
export type FilaMinima = {
  seq?: number;
  senderId?: string;
  body?: string;
  kind?: string;
  deletedAt?: string;
  replyToSeq?: number;
  /** E3: a thread reply, and whether it was also sent to the chat. */
  hiloDe?: number;
  enElChat?: boolean;
  media?: { mime?: string };
  pending?: boolean;
  clientKey?: string;
  /** Un archivo en cola (pendiente con foto, video o documento). */
  mediaUri?: string;
};

export type TipoDeFila = 'texto' | 'media' | 'aviso';

/**
 * FlashList recicla celdas por tipo: una burbuja de foto no se reusa para un
 * texto. El pendiente lleva el tipo que tendrá al confirmarse (FL12, §49 #7):
 * con uno propio, la celda cambiaba justo cuando aparecía el check.
 */
export function tipoDeFila(fila: FilaMinima): TipoDeFila {
  if (fila.pending) return fila.mediaUri ? 'media' : 'texto';
  if (fila.kind === 'system') return 'aviso';
  if (fila.deletedAt) return 'texto';
  return fila.media ? 'media' : 'texto';
}

/**
 * La clave de la fila en la lista (FL12, §49 #7). Pendiente y confirmado del
 * mismo envío comparten `clientKey`, así que son la MISMA celda: solo cambia el
 * reloj por el check. El historial sin `clientKey` usa el `seq`.
 */
export function claveDeFila(fila: FilaMinima): string {
  return fila.clientKey ? `k-${fila.clientKey}` : `m-${fila.seq}`;
}

/** Cuántos mensajes del final se miran: el eco de lo que acabo de mandar está ahí. */
const ULTIMOS_PARA_CONFIRMAR = 50;

/**
 * Los pendientes cuyo mensaje todavía NO llegó confirmado. El eco del server
 * (`msg.new`) puede llegar antes que el ack que saca el pendiente de la cola:
 * en ese hueco la burbuja se veía dos veces, con reloj y con check.
 */
export function sinPendientesConfirmados<P extends { clientKey: string }>(
  pendientes: P[],
  mensajes: readonly FilaMinima[]
): P[] {
  if (pendientes.length === 0) return pendientes;
  const confirmados = new Set(mensajes.slice(-ULTIMOS_PARA_CONFIRMAR).map((mensaje) => mensaje.clientKey));
  const quedan = pendientes.filter((pendiente) => !confirmados.has(pendiente.clientKey));
  return quedan.length === pendientes.length ? pendientes : quedan;
}

/** `enHilo`: it is a thread reply sent to the chat too; the quote is its root and opens the thread. */
export type Citado = { autor: string; texto: string; enHilo?: number };

/**
 * La cita de cada respuesta, por `seq` de la respuesta. Se calcula una vez por
 * cambio de mensajes: los objetos salen estables y la fila memoizada no se
 * vuelve a dibujar por una tecla.
 */
export function citadosPorSeq<M extends FilaMinima>(
  mensajes: readonly M[],
  contexto: {
    yo: string;
    esGrupo: boolean;
    nombreDelOtro: string;
    /** En un grupo: el nombre de cada miembro por id, si ya se conoce. */
    nombres?: ReadonlyMap<string, string>;
  },
  preview: (mensaje: M) => string
): Map<number, Citado> {
  const porSeq = new Map<number, M>();
  for (const mensaje of mensajes) if (typeof mensaje.seq === 'number') porSeq.set(mensaje.seq, mensaje);

  const citados = new Map<number, Citado>();
  for (const mensaje of mensajes) {
    const threadRoot = mensaje.hiloDe !== undefined && mensaje.enElChat ? mensaje.hiloDe : undefined;
    const citedSeq = threadRoot ?? mensaje.replyToSeq;
    if (typeof mensaje.seq !== 'number' || !citedSeq) continue;
    const respondido = porSeq.get(citedSeq);
    if (!respondido) continue;
    // En un 1:1 el autor es el otro (o «Vos»); en un grupo, el nombre de ese
    // miembro si ya se conoce (FL9) y si no, nada en vez de uno falso.
    const autor =
      respondido.senderId === contexto.yo
        ? 'Tú'
        : contexto.esGrupo
          ? (contexto.nombres?.get(String(respondido.senderId)) ?? '')
          : contexto.nombreDelOtro;
    citados.set(mensaje.seq, { autor, texto: preview(respondido), ...(threadRoot !== undefined ? { enHilo: threadRoot } : {}) });
  }
  return citados;
}

type MensajeConMedia = {
  seq: number;
  senderId: string;
  at: string;
  deletedAt?: string;
  media?: { url?: string; thumbUrl?: string; mime?: string; fileName?: string };
};

/**
 * Las fotos del chat como las consume el visor (salió de `ChatScreen`). Se
 * arman acá y no en el visor: el autor sale de la agenda y la hora de un
 * formateador nuestro, tres cosas que el visor no tiene por qué conocer.
 *
 * El archivo COMPLETO y no la miniatura: con `thumbUrl` el visor mostraba una
 * foto borrosa y un video no se reproducía nunca (le llegaba la portada). Lo
 * que no tiene miniatura no entra: se abre con otra app.
 */
/**
 * Qué dibujar como miniatura de una foto o un video. El storage no siempre la
 * genera (E2E de FL11, 18/10: un PNG llegó sin ella y la burbuja mostraba solo
 * el pie). Una IMAGEN usa su archivo completo; un video no, porque su URL es
 * el video y no una imagen.
 */
export function miniaturaDe(media: { thumbUrl?: string; url?: string; mime?: string }): string | undefined {
  if (media.thumbUrl) return media.thumbUrl;
  return (media.mime ?? '').startsWith('image/') ? media.url : undefined;
}

export function fotosDelChat(
  mensajes: readonly MensajeConMedia[],
  contexto: { yo: string; esGrupo: boolean; nombres: ReadonlyMap<string, string>; nombreDelChat: string }
) {
  return mensajes.flatMap((mensaje) => {
    const media = mensaje.media;
    const miniatura = media ? miniaturaDe(media) : undefined;
    if (!media || !miniatura || mensaje.deletedAt) return [];
    const mia = mensaje.senderId === contexto.yo;
    const deUnGrupo = contexto.esGrupo ? contexto.nombres.get(String(mensaje.senderId)) : undefined;
    return [
      {
        url: media.url ?? miniatura,
        mime: media.mime,
        nombre: media.fileName,
        cuandoReal: new Date(mensaje.at),
        seq: mensaje.seq,
        mia,
        // En un grupo, quién la mandó; antes decía el nombre del GRUPO.
        autor: mia ? 'Tú' : (deUnGrupo ?? contexto.nombreDelChat),
        cuando: formatClock(new Date(mensaje.at)),
        miniatura,
      },
    ];
  });
}

/**
 * Un archivo de la cola como fila pendiente de la conversación (salió de
 * `ChatScreen`): se ve YA, con su pie y —FL9— con la forma que tendrá al
 * llegar, para que la burbuja no salte de tamaño.
 */
export function filaDeArchivoEnCola(archivo: ArchivoEnCola, progreso?: number) {
  return {
    clientKey: archivo.clientKey,
    queuedAt: archivo.queuedAt,
    pending: true as const,
    mediaUri: archivo.uri,
    mediaMime: archivo.mimeType,
    mediaNombre: archivo.fileName,
    mediaAncho: archivo.width,
    mediaAlto: archivo.height,
    body: archivo.caption,
    progreso,
    fallo: archivo.fallo,
  };
}

/**
 * Hasta dónde llega una burbuja con foto o video (FL11, José 18/10: «se ve con
 * un padding a la derecha»). El pie largo la estiraba al 80 % y la foto quedaba
 * pegada a la izquierda; con este tope el pie se ajusta al ancho de la foto,
 * como WhatsApp.
 */
export function anchoDeBurbujaConFoto(media: { width?: number; height?: number }): number {
  return tamanoDeBurbuja(media).ancho;
}

/**
 * Lo pendiente —texto y archivos— en el orden en que se mandó (auditoría
 * 19/10: el texto salía siempre antes, aunque se escribió después de la foto).
 * `sort` es estable: con la misma hora queda el orden de llegada.
 */
export function pendientesEnOrden<P extends { queuedAt: string }>(textos: readonly P[], archivos: readonly P[]): P[] {
  return [...textos, ...archivos].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}
