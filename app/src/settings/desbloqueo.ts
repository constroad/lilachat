import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Antes de vincular una computadora, el teléfono pide su desbloqueo (W5, spec
 * §54.4): un teléfono prestado y desbloqueado no alcanza para vincular sin que
 * su dueño se entere. Huella, rostro o el PIN del teléfono, lo que tenga.
 *
 * Un teléfono SIN bloqueo no tiene nada que pedir: se vincula igual.
 */
export async function confirmarQueEresTu(motivo: string): Promise<boolean> {
  try {
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    if (nivel === LocalAuthentication.SecurityLevel.NONE) return true;
    const resultado = await LocalAuthentication.authenticateAsync({ promptMessage: motivo, cancelLabel: 'Cancelar', disableDeviceFallback: false });
    return resultado.success;
  } catch (error) {
    // Sin poder preguntar, no se vincula: es la puerta a toda la cuenta.
    console.warn('[vincular] desbloqueo falló:', error instanceof Error ? error.message : error);
    return false;
  }
}
