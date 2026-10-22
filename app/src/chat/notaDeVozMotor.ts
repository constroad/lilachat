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


/** Like WhatsApp (José, 21/10): while it plays, or paused midway, the speed takes the photo's place. */
export function showsSpeed(playing: boolean, progress: number): boolean {
  return playing || (progress > 0 && progress < 1);
}

/** Where the knob goes on the bar: it follows the progress and never sticks out at either end. */
export function knobLeft(progress: number, width: number, knob: number): number {
  const share = Math.min(1, Math.max(0, progress));
  return Math.round(share * Math.max(0, width - knob));
}
