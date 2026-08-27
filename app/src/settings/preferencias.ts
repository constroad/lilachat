import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Las preferencias de la persona. Hoy hay una sola, y tiene su historia.
 *
 * José, 27/08/2026: «a cada rato me aparece la burbuja de Lilachat "conectado
 * para recibir mensajes", eso es incorrecto, WhatsApp no hace eso».
 *
 * Las dos mitades son ciertas y hay que separarlas:
 *
 * - **WhatsApp no la muestra** porque recibe por FCM, un canal que mantiene el
 *   sistema operativo. Una app sola no puede usar ese canal sin Firebase, y acá
 *   Firebase se descartó a propósito.
 * - **Nosotros no podemos ocultarla.** Sin FCM, la única forma de que un socket
 *   propio sobreviva a la app cerrada es un servicio en primer plano, y Android
 *   exige la notificación como condición para dejarlo correr. No es una decisión
 *   nuestra que se pueda revertir con una línea.
 *
 * Lo que sí se puede es dejar de imponer el intercambio. Acá se guarda esa
 * elección: apagarlo saca la notificación **y** los mensajes con la app cerrada.
 */
const CLAVE_SEGUNDO_PLANO = 'lilachat.pref.segundoPlano';

/**
 * Por defecto ENCENDIDO, y no es una preferencia estética.
 *
 * Una app de mensajería que de fábrica no te entrega los mensajes está rota, y
 * quien la instale no va a atribuir el silencio a un ajuste que nunca tocó — va
 * a pensar que la app no anda. Se arranca funcionando y se ofrece apagarlo.
 */
export const SEGUNDO_PLANO_POR_DEFECTO = true;

export async function leerSegundoPlano(): Promise<boolean> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_SEGUNDO_PLANO);
    // `null` es «nunca lo tocó», que NO es lo mismo que «lo apagó».
    if (crudo === null) return SEGUNDO_PLANO_POR_DEFECTO;
    return crudo === 'true';
  } catch {
    // Un storage que falla no puede dejar a la persona sin mensajes: ante la
    // duda, el comportamiento completo.
    return SEGUNDO_PLANO_POR_DEFECTO;
  }
}

export async function guardarSegundoPlano(activo: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_SEGUNDO_PLANO, String(activo));
  } catch {
    /* si no se puede guardar, se pierde al reiniciar; no hay nada mejor que hacer */
  }
}

/**
 * Claro, oscuro o lo que diga el teléfono (27/08/2026).
 *
 * **Tres opciones y no dos**, igual que en LilaStore: sin «sistema», la primera
 * vez que alguien abre la app de noche le explota una pantalla blanca en la
 * cara, y la única salida es acordarse de ir a buscar el ajuste. Con automático
 * por defecto, la mayoría no toca nada nunca.
 */
const CLAVE_TEMA = 'lilachat.pref.tema';

export const MODOS_DE_TEMA = ['sistema', 'claro', 'oscuro'] as const;
export type ModoDeTema = (typeof MODOS_DE_TEMA)[number];

export const esModoDeTema = (valor: unknown): valor is ModoDeTema =>
  typeof valor === 'string' && (MODOS_DE_TEMA as readonly string[]).includes(valor);

export const TEMA_POR_DEFECTO: ModoDeTema = 'sistema';

export async function leerTema(): Promise<ModoDeTema> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_TEMA);
    // Un valor viejo o corrupto NO deja la app sin tema: cae al automático.
    return esModoDeTema(crudo) ? crudo : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

export async function guardarTema(modo: ModoDeTema): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_TEMA, modo);
  } catch {
    /* se pierde al reiniciar y vuelve al automático: aceptable para un tema */
  }
}
