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
  contexto: { yo: string; esGrupo: boolean; nombreDelOtro: string },
  preview: (mensaje: M) => string
): Map<number, Citado> {
  const porSeq = new Map<number, M>();
  for (const mensaje of mensajes) if (typeof mensaje.seq === 'number') porSeq.set(mensaje.seq, mensaje);

  const citados = new Map<number, Citado>();
  for (const mensaje of mensajes) {
    if (typeof mensaje.seq !== 'number' || !mensaje.replyToSeq) continue;
    const respondido = porSeq.get(mensaje.replyToSeq);
    if (!respondido) continue;
    // En un 1:1 el autor es el otro (o «Vos»); en un grupo no está acá el
    // nombre de cada miembro, así que se omite en vez de mostrar uno falso.
    const autor = respondido.senderId === contexto.yo ? 'Vos' : contexto.esGrupo ? '' : contexto.nombreDelOtro;
    citados.set(mensaje.seq, { autor, texto: preview(respondido) });
  }
  return citados;
}
