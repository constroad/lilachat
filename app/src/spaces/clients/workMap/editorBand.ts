/**
 * The colors of the street editor's band (design o-02). In light mode it is the violet band with light text; in dark
 * mode the theme's primary turns light lilac and the band looked pink (José 27/11), so it takes the dark surface
 * instead. `icon` is a theme color name.
 */
export type EditorBandTone = { band: string; text: string; muted: string; soft: string; raised: string; icon: 'on-primary' | 'on-surface' };

export function editorBandTone(dark: boolean): EditorBandTone {
  return dark
    ? { band: 'bg-surface border-b border-outline/15', text: 'text-on-surface', muted: 'text-on-surface-variant', soft: 'bg-background', raised: 'bg-primary/15', icon: 'on-surface' }
    : { band: 'bg-primary', text: 'text-on-primary', muted: 'text-on-primary/80', soft: 'bg-on-primary/15', raised: 'bg-surface', icon: 'on-primary' };
}
