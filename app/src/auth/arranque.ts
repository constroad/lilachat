import type { Credential } from './credentialStore';

/**
 * Si el arranque puede mostrar la app con la credencial guardada, sin esperar
 * a `refreshSession`. Es lo que hace que abra al instante, como WhatsApp: la
 * red concilia por detrás. Sin `userId` (credencial de una versión vieja) se
 * espera, porque el refresh es el que lo repara.
 */
export function entraSinEsperar(guardada: Credential): boolean {
  return guardada.userId.length > 0;
}

/**
 * Cambia la credencial del estado de arranque sin moverlo de pantalla: el
 * refresh llega cuando la persona ya puede estar dentro de un chat.
 */
export function conCredencialNueva<B extends { phase: string; credential?: Credential }>(
  estado: B,
  credencial: Credential
): B {
  if (estado.phase !== 'home' && estado.phase !== 'chat') return estado;
  return { ...estado, credential: credencial };
}
