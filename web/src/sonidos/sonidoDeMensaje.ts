/**
 * El sonido de un mensaje que llega, en la web (José, 20/10: «todo está en
 * silencio»), como WhatsApp Web: suena lo que no estoy mirando —otro chat, o
 * cualquiera con la pestaña oculta—; no lo mío, ni un chat silenciado, ni los
 * avisos del sistema. El tono se sintetiza con Web Audio (sin archivos ni
 * licencias). El navegador solo deja sonar después de que la persona tocó la
 * página: el contexto se despierta con el primer clic o tecla.
 */
export function debeSonarEnLaWeb(params: { senderId: string; yo: string; chatId: string; abierto: string | null; visible: boolean; silenciado: boolean; kind: string; soloEnElHilo?: boolean }): boolean {
  // Una respuesta que queda en su hilo no suena acá: le llega aviso a quien está en el hilo (E3).
  if (params.senderId === params.yo || params.silenciado || params.kind === 'system' || params.soloEnElHilo) return false;
  return !params.visible || params.abierto !== params.chatId;
}

/** Dos notas cortas y suaves (≈0,25 s). */
const NOTAS = [
  { frecuencia: 880, inicio: 0, duracion: 0.09 },
  { frecuencia: 1320, inicio: 0.1, duracion: 0.13 },
];
const VOLUMEN = 0.12;
/** Dos mensajes seguidos no suenan dos veces encima. */
const PAUSA_ENTRE_SONIDOS_MS = 1200;

let contexto: AudioContext | null = null;
let ultimo = 0;

function contextoDeAudio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  contexto ??= new AudioContext();
  return contexto;
}

/** Al primer gesto, el contexto queda listo (si no, el navegador lo bloquea). */
export function prepararSonidos(): void {
  const despertar = () => void contextoDeAudio()?.resume().catch(() => undefined);
  window.addEventListener('pointerdown', despertar, { once: true });
  window.addEventListener('keydown', despertar, { once: true });
}

export function sonarMensaje(ahora = Date.now()): void {
  const audio = contextoDeAudio();
  if (!audio || audio.state !== 'running' || ahora - ultimo < PAUSA_ENTRE_SONIDOS_MS) return;
  ultimo = ahora;
  for (const nota of NOTAS) {
    const oscilador = audio.createOscillator();
    const ganancia = audio.createGain();
    const desde = audio.currentTime + nota.inicio;
    oscilador.frequency.value = nota.frecuencia;
    ganancia.gain.setValueAtTime(0, desde);
    ganancia.gain.linearRampToValueAtTime(VOLUMEN, desde + 0.01);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, desde + nota.duracion);
    oscilador.connect(ganancia).connect(audio.destination);
    oscilador.start(desde);
    oscilador.stop(desde + nota.duracion + 0.02);
  }
}
