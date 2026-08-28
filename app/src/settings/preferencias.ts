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
 * Por defecto APAGADO desde que existe FCM (27/08/2026).
 *
 * Hasta acá tenía que estar encendido: sin push, el socket sostenido por el
 * servicio en primer plano era la ÚNICA forma de recibir con la app cerrada, y
 * una app de mensajería que de fábrica no entrega mensajes está rota. El precio
 * era la notificación permanente, que José pidió sacar tres veces.
 *
 * Con FCM el push lo entrega el sistema operativo, así que el servicio dejó de
 * ser necesario — y con él se va la burbuja fija Y el wake lock que se comía la
 * batería. Se conserva como opción para quien quiera la conexión sostenida
 * igual: en un teléfono con Google Play capado, el push no llega.
 */
export const SEGUNDO_PLANO_POR_DEFECTO = false;

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
