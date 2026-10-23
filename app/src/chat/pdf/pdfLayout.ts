/**
 * The PDF viewer's arithmetic (pending 7, design `visor-archivos`): how wide
 * each page is drawn, where each one starts, which one is on screen and the
 * zoom steps. PURE: the native renderer and the screen only follow it.
 */
export type PdfPageSize = { width: number; height: number };

export const PDF_ZOOM_STEPS = [1, 1.5, 2, 3] as const;
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

export const zoomLabel = (zoom: number): string => `${Math.round(zoom * 100)} %`;

/** «Página 3 de 14»: the counter's label for a screen reader. */
export const pageCounterLabel = (index: number, total: number): string => `Página ${index + 1} de ${total}`;

/** The sideways scroll after a zoom change, keeping the middle of the screen on the same spot of the page. */
export function sidewaysCenterAfterZoom(scrollX: number, screenWidth: number, ratio: number): number {
  const centered = (scrollX + screenWidth / 2) * ratio - screenWidth / 2;
  return ratio <= 0 ? 0 : Math.max(0, Math.round(centered));
}
