import { requireOptionalNativeModule } from 'expo';

/**
 * El servicio en primer plano que sostiene el socket.
 *
 * `requireOptionalNativeModule` y no `requireNativeModule`: en una build donde
 * el módulo no esté enlazado —o en la web— tiene que devolver `null` y no
 * reventar. Un chat que no abre porque falta un servicio de fondo sería cambiar
 * un problema chico por uno grave.
 */
type ServicioNativo = { iniciar(): boolean; detener(): boolean };

const nativo = requireOptionalNativeModule<ServicioNativo>('ServicioSocket');

export const hayServicio = (): boolean => nativo !== null;

export function iniciarServicio(): void {
  nativo?.iniciar();
}

export function detenerServicio(): void {
  nativo?.detener();
}
