import { describe, expect, it } from 'vitest';
import { captionMs, encodeWidthOf, scriptDurationMs, TUTORIAL_CAP_MS, TUTORIAL_MOBILE, validateTutorialScript, voicedCaptionMs, type TutorialScript } from './tutorialScript.js';

const twelve = 'Toca la calle de la obra en el mapa y espera que se marque entera';

const scriptOf = (patch: Partial<TutorialScript> = {}): TutorialScript => ({
  slug: 'dibujar-calle',
  title: 'Dibujar la calle de la obra',
  summary: 'Busca el lugar, toca la calle, recorta los extremos y guarda.',
  startUrl: '/',
  viewport: TUTORIAL_MOBILE,
  steps: [{ say: twelve, action: { kind: 'click', selector: 'testid:editor-calle' } }],
  ...patch,
});

/** Skill tutorial-video-loop §1–§3: one task per video, under 5 minutes, recorded on the phone. */
describe('caption timing', () => {
  it('reads at 2.6 words a second with a floor and a ceiling', () => {
    expect(captionMs('')).toBe(2400);
    expect(captionMs('Dos palabras')).toBe(2400);
    expect(captionMs(twelve)).toBe(Math.round((15 / 2.6) * 1000) + 800);
    expect(captionMs(Array(80).fill('palabra').join(' '))).toBe(12000);
  });

  it('with a voice the caption lasts the voice plus 250 ms, with no reading floor', () => {
    expect(voicedCaptionMs(1000)).toBe(1250);
  });
});

describe('scriptDurationMs', () => {
  it('charges intro, each step with its narration tail and action cost, and the outro', () => {
    const plain = scriptDurationMs(scriptOf({ steps: [{ say: twelve }] }));
    const withClick = scriptDurationMs(scriptOf());
    expect(withClick - plain).toBe(900);
    expect(scriptDurationMs(scriptOf({ intro: { title: 'Mapa de obra' } })) - withClick).toBe(3200);
  });
});

describe('encodeWidthOf', () => {
  it('doubles a phone recording so the text stays readable, keeps a desktop one', () => {
    expect(encodeWidthOf({ width: 390, height: 844 })).toBe(780);
    expect(encodeWidthOf({ width: 1280, height: 720 })).toBe(1280);
  });
});

describe('validateTutorialScript', () => {
  it('accepts a complete phone script', () => {
    expect(validateTutorialScript(scriptOf())).toEqual({ ok: true, errors: [], durationMs: scriptDurationMs(scriptOf()) });
  });

  it('rejects captions under twelve words: the screen wait stays silent and the voice sounds robotic', () => {
    const check = validateTutorialScript(scriptOf({ steps: [{ say: 'Cuadra tres' }] }));
    expect(check.errors).toContain('Paso 1: el cartel tiene 2 palabras; explica en 12 o más');
  });

  it('rejects a paragraph, an action without its selector, text or url', () => {
    const check = validateTutorialScript(scriptOf({
      steps: [
        { say: Array(40).fill('palabra').join(' ') },
        { say: twelve, action: { kind: 'type', selector: 'ph:Buscar', text: ' ' } },
        { say: twelve, action: { kind: 'click', selector: '' } },
        { say: twelve, action: { kind: 'goto', url: '' } },
        { say: twelve, action: { kind: 'drag', selector: 'testid:mano-inicio', dx: 0, dy: 0 } },
        { say: twelve, action: { kind: 'dragToward', selector: 'testid:editor-extremo-end', toward: 'testid:editor-extremo-start', share: 1.2 } },
        { say: twelve, action: { kind: 'tapMap', lat: -120, lng: -77.04 } },
        { say: twelve, action: { kind: 'tapMap', lat: -12.046, lng: -77.04 } },
      ],
    }));
    expect(check.errors).toEqual([
      'Paso 1: el cartel es un párrafo (más de 38 palabras); pártelo en dos',
      'Paso 2: «type» sin texto',
      'Paso 3: «click» sin selector',
      'Paso 4: «goto» sin url',
      'Paso 5: «drag» sin desplazamiento',
      'Paso 6: «dragToward» sin destino o con una fracción fuera de 0 a 1',
      'Paso 7: «tapMap» fuera del mapa',
    ]);
  });

  it('rejects what would pass five minutes before recording it', () => {
    const long = Array(60).fill({ say: twelve, action: { kind: 'goto', url: '/x' } });
    const check = validateTutorialScript(scriptOf({ steps: long }));
    expect(check.durationMs).toBeGreaterThan(TUTORIAL_CAP_MS);
    expect(check.errors.at(-1)).toMatch(/^Dura \d+,\d min y el tope son 5: saca pasos o pártelo en dos$/);
  });

  it('rejects a script without slug, title or steps, and a viewport out of range', () => {
    const check = validateTutorialScript(scriptOf({ slug: ' ', title: '', steps: [], viewport: { width: 200, height: 2000 } }));
    expect(check.errors).toEqual([
      'El guion no tiene slug',
      'El guion no tiene título',
      'El guion no tiene pasos',
      'El ancho (200) está fuera de 320–1920 px',
      'El alto (2000) está fuera de 480–1200 px',
    ]);
  });
});
