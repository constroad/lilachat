import { describe, expect, it } from 'vitest';
import { listOffsetAfterZoom, nextZoom, pinchScaleBounds, sidewaysCenterAfterZoom, pageAtOffset, pageCounterLabel, pageDisplayHeight, pageDisplayWidth, pageOffsets, pageRenderWidth, PDF_PAGE_GAP, zoomAfterDoubleTap, zoomAfterPinch, zoomLabel } from './pdfLayout';

const A4 = { width: 595, height: 842 };
const LANDSCAPE = { width: 842, height: 595 };

describe('pdfLayout', () => {
  it('a page fills the screen minus the margins and grows with the zoom', () => {
    // Act / Assert
    expect(pageDisplayWidth(390, 1)).toBe(366);
    expect(pageDisplayWidth(390, 2)).toBe(732);
  });

  it('asks the renderer for stepped pixels at the density, never past the cap', () => {
    // Act / Assert
    expect(pageRenderWidth(366, 2.625)).toBe(1000);
    expect(pageRenderWidth(380, 2.625)).toBe(1000);
    expect(pageRenderWidth(1098, 2.625)).toBe(1600);
    expect(pageRenderWidth(10, 0.5)).toBe(200);
  });

  it('keeps each page\'s proportion, and a broken size draws a square', () => {
    // Act / Assert
    expect(pageDisplayHeight(A4, 366)).toBe(518);
    expect(pageDisplayHeight(LANDSCAPE, 366)).toBe(259);
    expect(pageDisplayHeight({ width: 0, height: 0 }, 366)).toBe(366);
  });

  it('places mixed pages one after the other with the gap', () => {
    // Act
    const offsets = pageOffsets([A4, LANDSCAPE, A4], 366);
    // Assert
    expect(offsets).toEqual([PDF_PAGE_GAP, PDF_PAGE_GAP * 2 + 518, PDF_PAGE_GAP * 3 + 518 + 259]);
    expect(pageOffsets([], 366)).toEqual([]);
  });

  it('the counter names the page under the middle of the screen', () => {
    // Arrange
    const offsets = pageOffsets([A4, A4, A4, A4], 366);
    // Act / Assert
    expect(pageAtOffset(offsets, 0, 700)).toBe(0);
    expect(pageAtOffset(offsets, 400, 700)).toBe(1);
    expect(pageAtOffset(offsets, 99_999, 700)).toBe(3);
    expect(pageAtOffset([], 0, 700)).toBe(0);
  });

  it('zooms by steps and stops at both ends', () => {
    // Act / Assert
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1.25, 1)).toBe(1.5);
    expect(nextZoom(2, 1)).toBe(2.5);
    expect(nextZoom(3, 1)).toBe(3);
    expect(nextZoom(1, -1)).toBe(1);
    expect(nextZoom(1.2, -1)).toBe(1);
    expect(nextZoom(9, -1)).toBe(2.5);
    expect(zoomLabel(1.5)).toBe('150 %');
    expect(pageCounterLabel(2, 14)).toBe('Página 3 de 14');
  });

  it('keeps the middle of the screen on the same spot when zooming, and none at 100 %', () => {
    // Act / Assert
    expect(sidewaysCenterAfterZoom(0, 400, 1.5)).toBe(100);
    expect(sidewaysCenterAfterZoom(300, 400, 1 / 1.5)).toBe(133);
    expect(sidewaysCenterAfterZoom(50, 400, 0.5)).toBe(0);
    expect(sidewaysCenterAfterZoom(500, 400, 0)).toBe(0);
  });

  it('keeps the spot under the fingers sideways when a pinch gives the anchor', () => {
    // Act / Assert
    expect(sidewaysCenterAfterZoom(0, 400, 2, 100)).toBe(100);
    expect(sidewaysCenterAfterZoom(0, 400, 2, 0)).toBe(0);
    expect(sidewaysCenterAfterZoom(200, 400, 0.5, 300)).toBe(0);
  });

  it('a pinch lands on the step nearest to where the fingers left the zoom', () => {
    // Act / Assert
    expect(zoomAfterPinch(1, 1)).toBe(1);
    expect(zoomAfterPinch(1, 1.05)).toBe(1);
    expect(zoomAfterPinch(1, 1.2)).toBe(1.25);
    expect(zoomAfterPinch(1, 2.1)).toBe(2);
    expect(zoomAfterPinch(2, 1.3)).toBe(2.5);
    expect(zoomAfterPinch(3, 0.5)).toBe(1.5);
    expect(zoomAfterPinch(1.5, 1)).toBe(1.5);
  });

  it('a pinch never passes the first or last step', () => {
    // Act / Assert
    expect(zoomAfterPinch(1, 0.01)).toBe(1);
    expect(zoomAfterPinch(2, 0.0001)).toBe(1);
    expect(zoomAfterPinch(1, 50)).toBe(3);
    expect(zoomAfterPinch(3, Number.POSITIVE_INFINITY)).toBe(3);
  });

  it('a broken pinch keeps the zoom, and a broken zoom falls back to 100 %', () => {
    // Act / Assert
    expect(zoomAfterPinch(2, Number.NaN)).toBe(2);
    expect(zoomAfterPinch(2, 0)).toBe(2);
    expect(zoomAfterPinch(2.5, -3)).toBe(2.5);
    expect(zoomAfterPinch(Number.NaN, 2)).toBe(2);
    expect(zoomAfterPinch(0, Number.NaN)).toBe(1);
    expect(zoomAfterPinch(-1, 1)).toBe(1);
  });

  it('the live pinch preview stops at the first and last step', () => {
    // Act / Assert
    expect(pinchScaleBounds(1)).toEqual({ min: 1, max: 3 });
    expect(pinchScaleBounds(2)).toEqual({ min: 0.5, max: 1.5 });
    expect(pinchScaleBounds(3)).toEqual({ min: 1 / 3, max: 1 });
    expect(pinchScaleBounds(Number.NaN)).toEqual({ min: 1, max: 3 });
  });

  it('after a pinch the spot under the fingers stays on the same page', () => {
    // Arrange
    const before = pageOffsets([A4, A4, A4], 366);
    const after = pageOffsets([A4, A4, A4], 732);
    // Act: fingers 100 dp into page 2 (index 1), 300 dp from the top of the list.
    const scrollY = before[1]! + 100 - 300;
    const offset = listOffsetAfterZoom({ before, after, scrollY, anchorY: 300, ratio: 2 });
    // Assert: that spot is 200 dp into page 2 now, still 300 dp from the top.
    expect(offset + 300).toBe(after[1]! + 200);
  });

  it('after a pinch the list never scrolls above the top, and nothing breaks without pages', () => {
    // Arrange
    const before = pageOffsets([A4, A4], 732);
    const after = pageOffsets([A4, A4], 366);
    // Act / Assert: zooming out from the top would leave the page above the list.
    expect(listOffsetAfterZoom({ before, after, scrollY: 0, anchorY: 300, ratio: 0.5 })).toBe(0);
    // Fingers in the gap above the first page: that page keeps its start under them.
    expect(listOffsetAfterZoom({ before, after: pageOffsets([A4, A4], 1464), scrollY: 0, anchorY: 5, ratio: 2 })).toBe(PDF_PAGE_GAP - 5);
    expect(listOffsetAfterZoom({ before: [], after: [], scrollY: 50, anchorY: 100, ratio: 2 })).toBe(0);
    expect(listOffsetAfterZoom({ before, after, scrollY: 50, anchorY: 100, ratio: Number.NaN })).toBe(0);
    expect(listOffsetAfterZoom({ before, after, scrollY: 50, anchorY: 100, ratio: 0 })).toBe(0);
  });

  it('a double tap at 100 % zooms to 200 %, and from any other zoom goes back to 100 % (José 18/11)', () => {
    // Act / Assert
    expect(zoomAfterDoubleTap(1)).toBe(2);
    expect(zoomAfterDoubleTap(1.25)).toBe(1);
    expect(zoomAfterDoubleTap(3)).toBe(1);
  });

  it('a double tap with a broken zoom starts from 100 %', () => {
    // Act / Assert
    expect(zoomAfterDoubleTap(Number.NaN)).toBe(2);
    expect(zoomAfterDoubleTap(0)).toBe(2);
  });
});
