import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Qué hacer con un permiso del sistema (FL8).
 *
 * La regla: la app pregunta UNA vez por su cuenta; después de un «no», solo
 * vuelve a preguntar cuando la persona va a hacer algo que lo necesita
 * (invitar, escribirle a alguien). Antes el de contactos salía en cada
 * arranque aunque se hubiera negado.
 *
 * «¿Ya se preguntó?» lo guarda la app (`yaSePregunto`/`marcarPreguntado`): en
 * Android 13 `expo-notifications` contesta «denied» ANTES de haber preguntado,
 * así que fiarse de «undetermined» dejaba el permiso sin pedir nunca.
 */
export function queHacerConElPermiso(params: {
  concedido: boolean;
  /** `canAskAgain` del sistema: false = «no volver a preguntar». */
  puedePreguntar: boolean;
  yaSePregunto: boolean;
  /** La persona tocó algo que lo necesita (no es el arranque). */
  loPidioLaPersona: boolean;
}): 'usar' | 'pedir' | 'nada' {
  if (params.concedido) return 'usar';
  if (!params.puedePreguntar) return 'nada';
  return !params.yaSePregunto || params.loPidioLaPersona ? 'pedir' : 'nada';
}

const clave = (permiso: string) => `lilachat.permiso.${permiso}.preguntado`;

export async function yaSePregunto(permiso: 'contactos' | 'notificaciones'): Promise<boolean> {
  return (await AsyncStorage.getItem(clave(permiso)).catch(() => null)) === '1';
}

export async function marcarPreguntado(permiso: 'contactos' | 'notificaciones'): Promise<void> {
  await AsyncStorage.setItem(clave(permiso), '1').catch(() => undefined);
}
