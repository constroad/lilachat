/**
 * La credencial de FCM, leída del entorno. Motor PURO: sin red.
 *
 * **Por qué cambió todo esto (27/08/2026):** el emisor anterior hablaba con
 * `https://fcm.googleapis.com/fcm/send` usando `FCM_SERVER_KEY`. Ese endpoint
 * —la API «legacy» de FCM— **Google lo apagó en junio de 2024**. O sea que aun
 * poniendo la clave, las notificaciones no habrían salido: habríamos tenido un
 * camino completo, configurado, y en silencio. La API vigente es HTTP v1 y se
 * autentica con una CUENTA DE SERVICIO, que es lo que José generó.
 *
 * La cuenta de servicio trae una clave privada, así que **no va al repositorio**:
 * viaja en una variable de entorno, codificada en base64 porque un JSON con
 * saltos de línea dentro de un `.env` se corta y llega roto.
 */
export type CredencialFcm = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * Lee y valida la credencial.
 *
 * Devuelve `null` —y NO lanza— cuando no está configurada: sin credencial el
 * server tiene que arrancar igual y decirlo, no morirse. Pero cuando está y está
 * MAL, sí se distingue del caso «no está»: una credencial rota que se trate como
 * ausente deja a alguien creyendo que solo le falta pegarla.
 */
export function leerCredencialFcm(crudo: string | undefined): {
  credencial: CredencialFcm | null;
  problema?: string;
} {
  if (!crudo || !crudo.trim()) return { credencial: null };

  let texto: string;
  try {
    // Se acepta el JSON pegado tal cual además del base64: es el error más
    // probable al configurarlo a mano, y fallar ahí por un detalle de formato
    // sería gratuito.
    texto = crudo.trim().startsWith('{')
      ? crudo
      : Buffer.from(crudo, 'base64').toString('utf8');
  } catch {
    return { credencial: null, problema: 'no se pudo decodificar (¿base64 cortado?)' };
  }

  let dato: Record<string, unknown>;
  try {
    dato = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return { credencial: null, problema: 'no es un JSON válido' };
  }

  const projectId = typeof dato.project_id === 'string' ? dato.project_id : '';
  const clientEmail = typeof dato.client_email === 'string' ? dato.client_email : '';
  const privateKeyCruda = typeof dato.private_key === 'string' ? dato.private_key : '';

  const faltan = [
    !projectId && 'project_id',
    !clientEmail && 'client_email',
    !privateKeyCruda && 'private_key',
  ].filter(Boolean);
  if (faltan.length) {
    return { credencial: null, problema: `le faltan campos: ${faltan.join(', ')}` };
  }

  return {
    credencial: {
      projectId,
      clientEmail,
      /**
       * Los `\n` literales se convierten en saltos reales.
       *
       * Es la trampa clásica de esta credencial: al pasar por un `.env` o por un
       * panel web, los saltos de la clave PEM quedan escritos como `\n` de dos
       * caracteres. La firma entonces falla con un error de OpenSSL que no
       * menciona en ningún momento que el problema es el formato.
       */
      privateKey: privateKeyCruda.replace(/\\n/g, '\n'),
    },
  };
}

/** El endpoint de HTTP v1 para este proyecto. */
export function urlDeEnvio(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
}
