/**
 * The PDF viewer's arithmetic (pending 7, design `visor-archivos`): how wide
 * each page is drawn, where each one starts, which one is on screen and the
 * zoom steps. PURE: the native renderer and the screen only follow it.
 */
export type PdfPageSize = { width: number; height: number };

/** 125 % and 250 % are there for the pinch: with only 1-1.5-2-3 a pinch landed far from where the fingers left it. */
export const PDF_ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;
const MIN_ZOOM = PDF_ZOOM_STEPS[0];
const MAX_ZOOM = PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1];
/** Space between pages, in dp. */
export const PDF_PAGE_GAP = 12;
/** Side margin of the pages at 100 %, in dp. */
export const PDF_SIDE_MARGIN = 12;
/** A page bitmap never goes past this width: an A4 at 1600 px is ~14 MB while it is drawn. */
const MAX_RENDER_WIDTH = 1600;
/** Widths go in steps, so a small change of width or zoom reuses the page already drawn. */
const RENDER_WIDTH_STEP = 200;

/** The width a page takes on screen at a zoom. */
export function pageDisplayWidth(screenWidth: number, zoom: number): number {
  return Math.max(1, Math.round((screenWidth - PDF_SIDE_MARGIN * 2) * zoom));
}

/** The pixels to ask the renderer for: the display width at the screen's density, stepped and capped. */
export function pageRenderWidth(displayWidth: number, pixelRatio: number): number {
  const wanted = displayWidth * Math.max(1, pixelRatio);
  const stepped = Math.ceil(wanted / RENDER_WIDTH_STEP) * RENDER_WIDTH_STEP;
  return Math.min(MAX_RENDER_WIDTH, Math.max(RENDER_WIDTH_STEP, stepped));
}

export function pageDisplayHeight(page: PdfPageSize, displayWidth: number): number {
  if (page.width <= 0 || page.height <= 0) return displayWidth;
  return Math.round((page.height / page.width) * displayWidth);
}

/** Where each page starts in the list (for `getItemLayout` and the counter). */
export function pageOffsets(pages: readonly PdfPageSize[], displayWidth: number): number[] {
  const offsets: number[] = [];
  let next = PDF_PAGE_GAP;
  for (const page of pages) {
    offsets.push(next);
    next += pageDisplayHeight(page, displayWidth) + PDF_PAGE_GAP;
  }
  return offsets;
}

/** The page under the middle of the screen: the one the «3 / 14» counter names. */
export function pageAtOffset(offsets: readonly number[], scrollY: number, viewportHeight: number): number {
  if (offsets.length === 0) return 0;
  const middle = scrollY + viewportHeight / 2;
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (offsets[mid]! <= middle) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function nextZoom(zoom: number, direction: 1 | -1): number {
  const index = PDF_ZOOM_STEPS.findIndex((step) => step >= zoom);
  const current = index === -1 ? PDF_ZOOM_STEPS.length - 1 : index;
  return PDF_ZOOM_STEPS[Math.max(0, Math.min(PDF_ZOOM_STEPS.length - 1, current + direction))]!;
}

/** The allowed step nearest to the zoom the fingers left (`scale`: how much they spread, 1 = not at all). */
export function zoomAfterPinch(zoom: number, scale: number): number {
  const base = Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM;
  const wanted = Number.isFinite(scale) && scale > 0 ? base * scale : base;
  // Nearest by ratio, not by difference: a pinch is a multiplication.
  let nearest: number = MIN_ZOOM;
  for (const step of PDF_ZOOM_STEPS) {
    if (Math.abs(Math.log(step / wanted)) < Math.abs(Math.log(nearest / wanted))) nearest = step;
  }
  return nearest;
}

/** The zoom a double tap lands on: in to 200 % from 100 %, back to 100 % from any other (José 18/11). */
const DOUBLE_TAP_ZOOM = 2;
export function zoomAfterDoubleTap(zoom: number): number {
  const base = Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM;
  return base > MIN_ZOOM ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
}

/** How far the live pinch preview may scale from a zoom without passing the first or last step. */
export function pinchScaleBounds(zoom: number): { min: number; max: number } {
  const base = Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM;
  return { min: Math.min(1, MIN_ZOOM / base), max: Math.max(1, MAX_ZOOM / base) };
}

export const zoomLabel = (zoom: number): string => `${Math.round(zoom * 100)} %`;

/** «Página 3 de 14»: the counter's label for a screen reader. */
export const pageCounterLabel = (index: number, total: number): string => `Página ${index + 1} de ${total}`;

/**
 * The sideways scroll after a zoom change, keeping a spot of the screen (the
 * middle for the buttons, the fingers for a pinch) on the same spot of the page.
 */
export function sidewaysCenterAfterZoom(scrollX: number, screenWidth: number, ratio: number, anchorX = screenWidth / 2): number {
  const centered = (scrollX + anchorX) * ratio - anchorX;
  return ratio <= 0 ? 0 : Math.max(0, Math.round(centered));
}

/**
 * The list's scroll after a pinch, keeping the spot under the fingers
 * (`anchorY`, from the top of the list) on the same spot of the same page.
 * The gaps between pages do not grow with the zoom, so it goes by page.
 */
export function listOffsetAfterZoom(args: { before: readonly number[]; after: readonly number[]; scrollY: number; anchorY: number; ratio: number }): number {
  const { before, after, scrollY, anchorY, ratio } = args;
  if (before.length === 0 || !(ratio > 0)) return 0;
  const spot = scrollY + anchorY;
  const index = pageAtOffset(before, spot, 0);
  const intoPage = Math.max(0, spot - before[index]!) * ratio;
  return Math.max(0, Math.round((after[index] ?? 0) + intoPage - anchorY));
}
