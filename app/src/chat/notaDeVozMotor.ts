/**
 * Lo puro de las notas de voz (FL9b; auditoría §46.2: sin velocidad, sin
 * arrastrar, y dos sonaban a la vez). Motor sin `react-native`.
 */
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

