/**
 * Qué hace el botón ATRÁS de Android. Motor PURO.
 *
 * José, 27/08/2026: «en el chat con Wilson si presiono el botón atrás nativo del
 * celular se cierra Lilachat en lugar de ir a la lista de chats, y lo mismo pasa
 * cuando estoy en los demás tabs».
 *
 * La causa era que **nadie lo manejaba**: sin un `BackHandler`, Android aplica
 * su comportamiento por defecto, que es cerrar la actividad — o sea la app
 * entera. En una app de una sola actividad como esta, no manejar atrás no es
 * «no hacer nada»: es salir.
 *
 * La regla es la de cualquier app con pestañas: atrás DESHACE un nivel de
 * navegación, y recién cuando no queda nivel que deshacer cierra.
 */
export type AccionAtras =
  /** Hay algo encima (hoja, modal, formulario): se cierra eso y nada más. */
  | 'cerrar-sobrecapa'
  /** Estoy en una conversación: vuelvo a la lista. */
  | 'ir-a-lista'
  /** Estoy en otra pestaña: vuelvo a Chats, que es la de inicio. */
  | 'ir-a-chats'
  /** No queda nada que deshacer: que Android cierre la app. */
  | 'salir';

export function decidirAtras(params: {
  pantalla: 'chat' | 'tabs';
  /** La pestaña activa, cuando `pantalla` es `tabs`. */
  tab?: string;
  /** Si hay un modal, hoja o formulario abierto encima. */
  haySobreCapa?: boolean;
}): AccionAtras {
  // Lo de más arriba gana SIEMPRE: cerrar la app teniendo un formulario abierto
  // pierde lo que la persona estaba escribiendo.
  if (params.haySobreCapa) return 'cerrar-sobrecapa';

  if (params.pantalla === 'chat') return 'ir-a-lista';

  // `chats` es la pestaña de inicio: desde cualquier otra, atrás vuelve ahí.
  // Solo desde ella se sale, que es lo que hace WhatsApp.
  return params.tab && params.tab !== 'chats' ? 'ir-a-chats' : 'salir';
}
