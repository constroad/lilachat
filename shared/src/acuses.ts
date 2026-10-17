/**
 * El acuse que decide los checks de MIS mensajes (FL8). Server y app usan la
 * MISMA regla: en un grupo manda el menor —«leído» solo cuando lo leyeron
 * todos, como cualquier mensajería— y quien no tiene acuse vale la base (0 en
 * el server: nunca abrió el chat; en la app, lo último que dijo el server).
 *
 * `otros` son los miembros que acusan: sin mí y sin Lila (un asistente no
 * «lee»; si contara, el grupo no se pondría azul nunca).
 */
/** El teléfono con que se guarda a Lila (el asistente) como usuario. */
export const TELEFONO_DE_LILA = '000000000';

export function acuseDelGrupo(params: {
  otros: readonly string[];
  porMiembro: ReadonlyMap<string, number>;
  base?: number;
}): number {
  const base = params.base ?? 0;
  if (params.otros.length === 0) return base;
  const menor = Math.min(...params.otros.map((id) => params.porMiembro.get(id) ?? base));
  return Math.max(base, menor);
}
