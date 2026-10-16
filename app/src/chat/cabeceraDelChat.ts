/**
 * El subtítulo de la cabecera de un chat (FL3). En un 1:1, «escribiendo…» o
 * «en línea». En un grupo dice QUIÉN escribe y, si nadie escribe, quiénes
 * están —como WhatsApp—; sin los nombres cargados no inventa ninguno.
 */
export function subtituloDelChat(params: {
  esGrupo: boolean;
  /** Ids de los que están escribiendo ahora (sin mí). */
  escriben: readonly string[];
  otroEnLinea: boolean;
  nombres: ReadonlyMap<string, string>;
  yo: string;
}): string {
  if (!params.esGrupo) {
    if (params.escriben.length > 0) return 'escribiendo…';
    return params.otroEnLinea ? 'en línea' : '';
  }
  if (params.escriben.length > 0) {
    const quienes = params.escriben.map((id) => params.nombres.get(id)).filter((n): n is string => Boolean(n));
    if (quienes.length === 0) return 'alguien está escribiendo…';
    if (quienes.length === 1) return `${quienes[0]} está escribiendo…`;
    return `${quienes.slice(0, -1).join(', ')} y ${quienes[quienes.length - 1]} están escribiendo…`;
  }
  const otros = [...params.nombres.entries()].filter(([id]) => id !== params.yo).map(([, nombre]) => nombre);
  if (otros.length === 0) return '';
  return [...otros, 'Vos'].join(', ');
}
