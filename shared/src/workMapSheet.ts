/**
 * The sheet over the phone's map (design ma01, José 28/11: layers open only from a floating
 * button, never on their own). The layer's sheet
 * opens as a peek (its figure, bar and «Registrar avance de <capa>»), grows to the whole detail,
 * and «Capas y leyenda» opens ONLY from its floating button. PURE: the APK and the web share it.
 */
/** `min`: only «Registrar avance de <capa>» floats over the map (José 28/11: the X folds the peek). */
export type MapSheet = 'min' | 'peek' | 'full' | 'layers' | null;

/** With layers the map opens with the layer's peek; without them, the map alone. */
export const initialMapSheet = (worksCount: number): MapSheet => (worksCount > 0 ? 'peek' : null);

/** Folded as far as it goes: with a layer its action stays; without, nothing. */
const folded = (hasLayer: boolean): MapSheet => (hasLayer ? 'min' : null);

/** The floating «Capas» button: opens «Capas y leyenda», and pressed again folds it. */
export const toggleLayersSheet = (sheet: MapSheet, hasLayer: boolean): MapSheet => (sheet === 'layers' ? folded(hasLayer) : 'layers');

/** The sheet's X: the detail back to the peek, the peek down to its action, «Capas» closed. */
export function collapseSheet(sheet: MapSheet, hasLayer: boolean): MapSheet {
  if (sheet === 'full') return 'peek';
  return folded(hasLayer);
}

/** A chip of the strip shows its layer: the peek, or the detail when it was already open. */
export const sheetForLayerPick = (sheet: MapSheet): MapSheet => (sheet === 'full' ? 'full' : 'peek');

/** The handle of the layer's sheet: the action grows to the peek, the peek to the detail and back. */
export const expandLayerSheet = (sheet: MapSheet): MapSheet => (sheet === 'min' ? 'peek' : sheet === 'full' ? 'peek' : 'full');
