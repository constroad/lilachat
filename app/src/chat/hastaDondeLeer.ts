/**
 * Hasta qué `seq` acusar lectura con el chat abierto. Hasta el MÁXIMO entre lo
 * cargado y lo que el server dijo que existe: así un mensaje final borrado en
 * duro no deja un «sin leer» que no baja. Con la app en segundo plano, nada
 * (auditoría 19/10: con «Conexión permanente» se leía con la pantalla apagada).
 */
export function hastaDondeLeer(params: { mensajes: readonly { seq: number }[]; lastSeqInicial?: number; enPrimerPlano: boolean }): number | null {
  if (!params.enPrimerPlano) return null;
  const ultimo = params.mensajes[params.mensajes.length - 1];
  const hasta = Math.max(ultimo?.seq ?? 0, params.lastSeqInicial ?? 0);
  return hasta > 0 ? hasta : null;
}
