/**
 * Buscar actualizaciones e invitar gente. Motores PUROS, sin React ni red.
 *
 * Los dos salen del mismo pedido (26/08/2026) y comparten la trampa: dar por
 * buena una respuesta que nunca llegó.
 */
export type ResultadoDelChequeo =
  | { estado: 'hay-nueva'; version: string }
  | { estado: 'al-dia' }
  | { estado: 'no-se-pudo' };

export function resultadoDelChequeo(params: {
  /** El `versionCode` de esta app; `0` si no se pudo leer. */
  actual: number;
  /** El publicado; `null` si no hubo respuesta. */
  ultima: number | null;
  version: string;
}): ResultadoDelChequeo {
  const { actual, ultima, version } = params;

  // **Sin datos NO se dice «estás al día».** Es la respuesta que más daño hace:
  // deja a alguien en una versión rota creyendo que no hay nada que hacer.
  if (!actual || !ultima) return { estado: 'no-se-pudo' };

  return ultima > actual ? { estado: 'hay-nueva', version } : { estado: 'al-dia' };
}
