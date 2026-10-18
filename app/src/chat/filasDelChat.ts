import { formatClock } from '@lilachat/shared';
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
  media?: { mime?: string };
  pending?: boolean;
  clientKey?: string;
};

export type TipoDeFila = 'texto' | 'media' | 'aviso' | 'pendiente';

/** FlashList recicla celdas por tipo: una burbuja de foto no se reusa para un texto. */
export function tipoDeFila(fila: FilaMinima): TipoDeFila {
  if (fila.pending) return 'pendiente';
  if (fila.kind === 'system') return 'aviso';
  if (fila.deletedAt) return 'texto';
  return fila.media ? 'media' : 'texto';
}

export type Citado = { autor: string; texto: string };

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
    if (typeof mensaje.seq !== 'number' || !mensaje.replyToSeq) continue;
    const respondido = porSeq.get(mensaje.replyToSeq);
    if (!respondido) continue;
    // En un 1:1 el autor es el otro (o «Vos»); en un grupo, el nombre de ese
    // miembro si ya se conoce (FL9) y si no, nada en vez de uno falso.
    const autor =
      respondido.senderId === contexto.yo
        ? 'Tú'
        : contexto.esGrupo
          ? (contexto.nombres?.get(String(respondido.senderId)) ?? '')
          : contexto.nombreDelOtro;
    citados.set(mensaje.seq, { autor, texto: preview(respondido) });
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
export function fotosDelChat(
  mensajes: readonly MensajeConMedia[],
  contexto: { yo: string; esGrupo: boolean; nombres: ReadonlyMap<string, string>; nombreDelChat: string }
) {
  return mensajes.flatMap((mensaje) => {
    const media = mensaje.media;
    if (!media?.thumbUrl || mensaje.deletedAt) return [];
    const mia = mensaje.senderId === contexto.yo;
    const deUnGrupo = contexto.esGrupo ? contexto.nombres.get(String(mensaje.senderId)) : undefined;
    return [
      {
        url: media.url ?? media.thumbUrl,
        mime: media.mime,
        nombre: media.fileName,
        cuandoReal: new Date(mensaje.at),
        seq: mensaje.seq,
        mia,
        // En un grupo, quién la mandó; antes decía el nombre del GRUPO.
        autor: mia ? 'Tú' : (deUnGrupo ?? contexto.nombreDelChat),
        cuando: formatClock(new Date(mensaje.at)),
        miniatura: media.thumbUrl,
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
