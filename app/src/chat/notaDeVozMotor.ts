/**
 * Lo puro de las notas de voz (FL9b; auditoría §46.2: sin velocidad, sin
 * arrastrar, y dos sonaban a la vez). Motor sin `react-native`.
 */
const VELOCIDADES = [1, 1.5, 2] as const;

export function siguienteVelocidad(actual: number): number {
  const indice = VELOCIDADES.indexOf(actual as (typeof VELOCIDADES)[number]);
  return indice < 0 ? 1 : (VELOCIDADES[(indice + 1) % VELOCIDADES.length] ?? 1);
}

/** Tocar la barra: a qué segundo del audio corresponde ese punto. */
export function segundosDelToque(params: { x: number; ancho: number; duracion: number }): number {
  if (params.ancho <= 0 || params.duracion <= 0) return 0;
  const proporcion = Math.min(1, Math.max(0, params.x / params.ancho));
  return proporcion * params.duracion;
}

/**
 * Una sola nota sonando a la vez: la que toma el audio pausa a la anterior.
 * Vive en el módulo porque cada burbuja tiene su propio reproductor.
 */
let actual: { id: string; pausar: () => void } | null = null;

export function tomarElAudio(id: string, pausar: () => void): void {
  if (actual && actual.id !== id) actual.pausar();
  actual = { id, pausar };
}

/** La nota que se desmonta suelta el audio (si era la que sonaba). */
export function soltarElAudio(id: string): void {
  if (actual?.id === id) actual = null;
}

/** Solo para tests. */
export function __soltarAudio(): void {
  actual = null;
}
