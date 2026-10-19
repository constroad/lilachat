import { nombreDePila } from '@lilachat/shared';

/** Alguien de la agenda a quien invitar. */
export type ContactoInvitable = { id: string; nombre: string; telefono: string };

/**
 * Qué decir debajo de la fila cuando no se pudo invitar (FL13d): a QUIÉN y
 * por qué. Antes el aviso iba al pie de la lista, fuera de la pantalla, y el
 * botón parecía no hacer nada.
 */
export function textoDeInvitacionFallida(nombre: string, motivo?: string): string {
  const quien = nombreDePila(nombre) ?? nombre.trim();
  return `No se pudo invitar a ${quien}. ${motivo ?? 'Prueba de nuevo.'}`;
}
