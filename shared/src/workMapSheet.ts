/**
 * The sheet over the phone's map (design ma01, José 28/11: layers open only from a floating
 * button, never on their own). The layer's sheet
 * opens as a peek (its figure, bar and «Registrar avance de <capa>»), grows to the whole detail,
 * and «Capas y leyenda» opens ONLY from its floating button. PURE: the APK and the web share it.
 */
export type MapSheet = 'peek' | 'full' | 'layers' | null;

/** With layers the map opens with the layer's peek; without them, the map alone. */
export const initialMapSheet = (worksCount: number): MapSheet => (worksCount > 0 ? 'peek' : null);

/** The floating «Capas» button: opens «Capas y leyenda», and pressed again closes it. */
export const toggleLayersSheet = (sheet: MapSheet): MapSheet => (sheet === 'layers' ? null : 'layers');

/** A chip of the strip shows its layer: the peek, or the detail when it was already open. */
export const sheetForLayerPick = (sheet: MapSheet): MapSheet => (sheet === 'full' ? 'full' : 'peek');

/** The handle of the layer's sheet: peek grows to the detail and back. */
export const expandLayerSheet = (sheet: MapSheet): MapSheet => (sheet === 'full' ? 'peek' : 'full');
