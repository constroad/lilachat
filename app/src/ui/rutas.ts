/**
 * Lo puro de la navegación de la sesión (FL1): qué chat está arriba del stack.
 * Sin React Navigation adentro, para testearlo sin emulador.
 */
type RutaMinima = { name: string; params?: object };
type EstadoMinimo = { index: number; routes: readonly RutaMinima[] };

/** El chat de la pantalla de arriba del stack, o `null` si se está en la lista. */
export function chatAbiertoDe(estado: EstadoMinimo | undefined): string | null {
  const arriba = estado?.routes[estado.index];
  if (arriba?.name !== 'Chat') return null;
  const params = arriba.params as { chat?: { id?: string } } | undefined;
  return params?.chat?.id ?? null;
}

/**
 * El chat que se VE (FL10). Con dos paneles el chat vive al lado de la lista,
 * no en el stack; y si la pestaña activa no es Chats, el panel no se ve y sus
 * mensajes no cuentan como leídos.
 */
export function chatQueSeVe(params: { deLaPila: string | null; enPanel: string | null; pestana: string }): string | null {
  if (params.deLaPila) return params.deLaPila;
  return params.pestana === 'chats' ? params.enPanel : null;
}
