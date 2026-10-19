/**
 * El orden para crear un recordatorio (E2E del 19/10).
 *
 * El del grupo sale en el chat como tarjeta. Si se publicaba al crear, la
 * tarjeta se pedía antes de que la imagen terminara de subir y quedaba sin
 * ella, en el teléfono de todos. Con imagen: crear sin publicar → subir →
 * publicar. Se publica AUNQUE la imagen falle: el recordatorio igual existe y
 * le va a sonar al grupo.
 */
export type PasosDeCreacion = {
  crear: (opciones: { publicar?: false }) => Promise<{ ok: true; id: string } | { ok: false; motivo: string }>;
  subirImagen: (id: string) => Promise<{ ok: true } | { ok: false; motivo: string }>;
  publicar: (id: string) => Promise<{ ok: boolean }>;
};

export type ResultadoDeCreacion = { ok: true } | { ok: false; guardado: boolean; motivo: string };

export async function crearRecordatorio(
  { conImagen, delGrupo }: { conImagen: boolean; delGrupo: boolean },
  pasos: PasosDeCreacion
): Promise<ResultadoDeCreacion> {
  const publicarAlFinal = conImagen && delGrupo;
  const creado = await pasos.crear(publicarAlFinal ? { publicar: false } : {});
  if (!creado.ok) return { ok: false, guardado: false, motivo: creado.motivo };

  const subida = conImagen ? await pasos.subirImagen(creado.id) : ({ ok: true } as const);
  const publicado = publicarAlFinal ? await pasos.publicar(creado.id) : { ok: true };

  if (!subida.ok) return { ok: false, guardado: true, motivo: `Se guardó, pero la imagen no subió: ${subida.motivo}` };
  if (!publicado.ok) return { ok: false, guardado: true, motivo: 'Se guardó, pero no salió en el chat. Revisa tu conexión.' };
  return { ok: true };
}
