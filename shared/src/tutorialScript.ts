/**
 * Tutorial scripts: the part that can be reasoned about without a browser.
 *
 * A tutorial is recorded by running a SCRIPT (steps with a caption the voice reads and an
 * action on the screen). This module holds that contract and the timing engine, so a script is
 * validated before opening a browser and paying the encode. Ported from Portal
 * (`src/lib/academy/recordingScript.ts`) with the rules of the skill `tutorial-video-loop`.
 */

export type TutorialAction =
  | { kind: 'goto'; url: string }
  | { kind: 'scrollTo'; selector: string }
  | { kind: 'highlight'; selector: string }
  | { kind: 'click'; selector: string }
  | { kind: 'hover'; selector: string }
  /** Types key by key: a value set by hand is not seen by React. */
  | { kind: 'type'; selector: string; text: string }
  /** Presses a key on the focused element (Enter to search). */
  | { kind: 'press'; key: string }
  /** Drags an element by an offset in CSS pixels. */
  | { kind: 'drag'; selector: string; dx: number; dy: number }
  /** Drags an element a share of the way toward another: a street end along its own street. */
  | { kind: 'dragToward'; selector: string; toward: string; share: number }
  /** Only narrates: the screen stays still. */
  | { kind: 'pause' };

export type TutorialStep = {
  /** The caption on screen, and what the voice says. */
  say: string;
  action?: TutorialAction;
  /** Extra still time after the action, so what is shown can be understood. */
  holdMs?: number;
};

export type TutorialViewport = { width: number; height: number };

export type TutorialScript = {
  slug: string;
  title: string;
  summary: string;
  /** Path where the recording starts. */
  startUrl: string;
  /** The space the app opens in, so the person's own chats never reach the camera. */
  spaceId?: string;
  intro?: { title: string; subtitle?: string };
  /** The width decides which screen the app opens: the client channel is used on site, on the phone. */
  viewport?: TutorialViewport;
  /** Names that cannot appear on camera («QA», «borrar») and what is shown instead. */
  cameraNames?: Record<string, string>;
  steps: TutorialStep[];
};

export const TUTORIAL_DESKTOP: TutorialViewport = { width: 1280, height: 720 };
export const TUTORIAL_MOBILE: TutorialViewport = { width: 390, height: 844 };
/** Hard cap of a tutorial: longer than this is two tutorials. */
export const TUTORIAL_CAP_MS = 5 * 60_000;

const VIEWPORT_LIMITS = { minWidth: 320, maxWidth: 1920, minHeight: 480, maxHeight: 1200 };
const MOBILE_MAX_WIDTH = 768;

export const viewportOf = (script: TutorialScript): TutorialViewport => script.viewport ?? TUTORIAL_DESKTOP;

/** A phone recording is encoded at twice its width: at 390 px the app's text is unreadable. */
export const encodeWidthOf = (viewport: TutorialViewport): number =>
  viewport.width < MOBILE_MAX_WIDTH ? viewport.width * 2 : viewport.width;

/** Comfortable reading speed in Spanish; it is the estimate's worst case, slower than the voice. */
const WORDS_PER_SECOND = 2.6;
const CAPTION_PADDING_MS = 800;
const CAPTION_MIN_MS = 2400;
const CAPTION_MAX_MS = 12000;
/** Fewer words than this leaves the screen wait silent and the synthetic voice sounds robotic. */
const CAPTION_MIN_WORDS = 12;
/** More than this is a paragraph nobody reads while watching the screen. */
const CAPTION_MAX_WORDS = 38;
/** With a voice the caption lasts the voice and this much more, with no reading floor on top. */
export const VOICE_TAIL_MS = 250;
export const NARRATION_TAIL_MS = 600;
export const INTRO_CARD_MS = 3200;
export const OUTRO_CARD_MS = 1800;

/** What the screen takes to answer each action (measured in Portal). */
const ACTION_COST_MS: Record<TutorialAction['kind'], number> = {
  goto: 2600,
  scrollTo: 1100,
  highlight: 600,
  click: 900,
  hover: 700,
  type: 1800,
  press: 700,
  drag: 1600,
  dragToward: 1600,
  pause: 0,
};

const wordsOf = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** How long a caption stays without a voice, by its words. */
export const captionMs = (text: string): number => {
  const words = wordsOf(text);
  if (!words) return CAPTION_MIN_MS;
  const read = Math.round((words / WORDS_PER_SECOND) * 1000) + CAPTION_PADDING_MS;
  return Math.min(CAPTION_MAX_MS, Math.max(CAPTION_MIN_MS, read));
};

export const voicedCaptionMs = (voiceMs: number): number => voiceMs + VOICE_TAIL_MS;

const stepMs = (step: TutorialStep): number =>
  captionMs(step.say) + NARRATION_TAIL_MS + ACTION_COST_MS[step.action?.kind ?? 'pause'] + (step.holdMs ?? 0);

export const scriptDurationMs = (script: TutorialScript): number =>
  (script.intro ? INTRO_CARD_MS : 0) + script.steps.reduce((total, step) => total + stepMs(step), 0) + OUTRO_CARD_MS;

/** Actions that operate an element: each needs its selector, and some their text or offset. */
const elementActionError = (action: Exclude<TutorialAction, { kind: 'goto' | 'press' | 'pause' }>): string | null => {
  if (!action.selector.trim()) return `«${action.kind}» sin selector`;
  if (action.kind === 'type' && !action.text.trim()) return '«type» sin texto';
  if (action.kind === 'drag' && !action.dx && !action.dy) return '«drag» sin desplazamiento';
  if (action.kind === 'dragToward' && (!action.toward.trim() || action.share <= 0 || action.share >= 1)) return '«dragToward» sin destino o con una fracción fuera de 0 a 1';
  return null;
};

const actionError = (action: TutorialAction | undefined): string | null => {
  if (!action || action.kind === 'pause') return null;
  if (action.kind === 'goto') return action.url.trim() ? null : '«goto» sin url';
  if (action.kind === 'press') return action.key.trim() ? null : '«press» sin tecla';
  return elementActionError(action);
};

const stepErrors = (step: TutorialStep, position: number): string[] => {
  const errors: string[] = [];
  const words = wordsOf(step.say);
  if (words > CAPTION_MAX_WORDS) errors.push(`Paso ${position}: el cartel es un párrafo (más de ${CAPTION_MAX_WORDS} palabras); pártelo en dos`);
  else if (words < CAPTION_MIN_WORDS) errors.push(`Paso ${position}: el cartel tiene ${words} palabras; explica en ${CAPTION_MIN_WORDS} o más`);
  const action = actionError(step.action);
  if (action) errors.push(`Paso ${position}: ${action}`);
  return errors;
};

const viewportErrors = ({ width, height }: TutorialViewport): string[] => {
  const errors: string[] = [];
  if (width < VIEWPORT_LIMITS.minWidth || width > VIEWPORT_LIMITS.maxWidth) errors.push(`El ancho (${width}) está fuera de ${VIEWPORT_LIMITS.minWidth}–${VIEWPORT_LIMITS.maxWidth} px`);
  if (height < VIEWPORT_LIMITS.minHeight || height > VIEWPORT_LIMITS.maxHeight) errors.push(`El alto (${height}) está fuera de ${VIEWPORT_LIMITS.minHeight}–${VIEWPORT_LIMITS.maxHeight} px`);
  return errors;
};

export type TutorialScriptCheck = { ok: boolean; errors: string[]; durationMs: number };

/** Validates a script before recording: caught here it costs a second, caught later the whole recording. */
export const validateTutorialScript = (script: TutorialScript): TutorialScriptCheck => {
  const errors: string[] = [];
  if (!script.slug.trim()) errors.push('El guion no tiene slug');
  if (!script.title.trim()) errors.push('El guion no tiene título');
  if (!script.steps.length) errors.push('El guion no tiene pasos');
  errors.push(...viewportErrors(viewportOf(script)));
  script.steps.forEach((step, index) => errors.push(...stepErrors(step, index + 1)));
  const durationMs = scriptDurationMs(script);
  if (durationMs > TUTORIAL_CAP_MS) errors.push(`Dura ${(durationMs / 60000).toFixed(1).replace('.', ',')} min y el tope son 5: saca pasos o pártelo en dos`);
  return { ok: errors.length === 0, errors, durationMs };
};
