import { sharedAudioContext } from '../sonidos/sonidoDeMensaje';

/**
 * The call tones, synthesized with Web Audio like the message sound (no files,
 * no licenses): the ring of an incoming call and the «tuu… tuu» while calling.
 * The browser only plays after the person touched the page; a hidden tab that
 * was never touched gets the system notice instead (`CallProvider`).
 */
export type CallTone = 'incoming' | 'outgoing';
type Note = { frequency: number; start: number; duration: number };

const TONES: Record<CallTone, { notes: Note[]; everyMs: number; volume: number }> = {
  incoming: {
    notes: [
      { frequency: 659, start: 0, duration: 0.18 },
      { frequency: 880, start: 0.2, duration: 0.18 },
      { frequency: 659, start: 0.6, duration: 0.18 },
      { frequency: 880, start: 0.8, duration: 0.18 },
    ],
    everyMs: 2_600,
    volume: 0.16,
  },
  // 425 Hz, the ringback tone of Peru's phone network.
  outgoing: { notes: [{ frequency: 425, start: 0, duration: 1.2 }], everyMs: 4_000, volume: 0.08 },
};

function playOnce(audio: AudioContext, tone: CallTone): void {
  if (audio.state !== 'running') return;
  const { notes, volume } = TONES[tone];
  for (const note of notes) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const from = audio.currentTime + note.start;
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0, from);
    gain.gain.linearRampToValueAtTime(volume, from + 0.02);
    gain.gain.setValueAtTime(volume, from + note.duration - 0.03);
    gain.gain.linearRampToValueAtTime(0, from + note.duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(from);
    oscillator.stop(from + note.duration + 0.02);
  }
}

/** Starts the tone in a loop; the returned function stops it. */
export function startCallTone(tone: CallTone): () => void {
  const audio = sharedAudioContext();
  if (!audio) return () => undefined;
  void audio.resume().catch(() => undefined);
  playOnce(audio, tone);
  const timer = window.setInterval(() => playOnce(audio, tone), TONES[tone].everyMs);
  return () => window.clearInterval(timer);
}
