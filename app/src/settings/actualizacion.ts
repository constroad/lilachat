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

/**
 * El mensaje de invitación, con las DOS puertas de entrada.
 *
 * La tienda primero, porque es la que después deja la app actualizándose sola;
 * el APK directo como atajo para quien no quiere instalar dos cosas. Con una
 * sola se pierde gente: solo tienda, la que se cansa en el segundo paso; solo
 * APK, la que queda sin actualizaciones para siempre.
 */
export function textoDeInvitacion(params: {
  tienda: string;
  /** Vacío si todavía no hay APK publicado: entonces no se ofrece. */
  app: string;
  deParte: string | null;
}): string {
  const quien = params.deParte?.trim();
  // «El chat de la familia» quedó viejo el 27/08/2026: Lilachat se abrió al
  // público y el mensaje lo sigue leyendo gente que no es de la familia de
  // nadie. Se dice qué ES, no para quién.
  const saludo = quien
    ? `${quien} te invita a Lilachat, la mensajería de ConstRoad.`
    : 'Te invito a Lilachat, la mensajería de ConstRoad.';

  const lineas = [
    saludo,
    'Chats, grupos, eventos y encuestas, en un servidor propio.',
    '',
    `1) Instalá LilaStore y desde ahí Lilachat: ${params.tienda}`,
  ];

  if (params.app) {
    lineas.push('', `2) O bajá Lilachat directo: ${params.app}`);
  }

  return lineas.join('\n');
}
