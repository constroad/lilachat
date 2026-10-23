import { describe, expect, it } from 'vitest';
import { nextZoom, sidewaysCenterAfterZoom, pageAtOffset, pageCounterLabel, pageDisplayHeight, pageDisplayWidth, pageOffsets, pageRenderWidth, PDF_PAGE_GAP, zoomLabel } from './pdfLayout';

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
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(3, 1)).toBe(3);
    expect(nextZoom(1, -1)).toBe(1);
    expect(nextZoom(1.2, -1)).toBe(1);
    expect(nextZoom(9, -1)).toBe(2);
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
});
