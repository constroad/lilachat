import { describe, expect, it } from 'vitest';
import { editorBandTone } from './editorBand';

/** José 27/11: «¿por qué en modo oscuro se ve rosado la parte superior?» — the light violet band stayed on the dark screen. */
describe('editorBandTone', () => {
  it('in light mode the band is the violet of o-02 with light text', () => {
    expect(editorBandTone(false)).toMatchObject({ band: 'bg-primary', text: 'text-on-primary', icon: 'on-primary' });
  });
  it('in dark mode the band is the dark surface with light text, never the light lilac', () => {
    const tone = editorBandTone(true);
    expect(tone.band).toContain('bg-surface');
    expect(tone.band).not.toContain('bg-primary');
    expect(tone).toMatchObject({ text: 'text-on-surface', icon: 'on-surface' });
  });
});
