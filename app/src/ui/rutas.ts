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
