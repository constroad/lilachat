import { describe, expect, it } from 'vitest';
import { NO_REPORT_LAYER, photosOfShownReports, reportPhotoLayerRows, reportPhotoLayersOf, toggleReportLayer } from './reportPhotoLayers.js';

/**
 * José 19/11 (via Portal f080f7c6a): the map's photos split by the report they belong to, each type
 * a sub-layer of «Fotos» with its switch and count. Same rule as Portal's `reportPhotoLayers.ts`.
 */
const photos = [
  { reportType: 'CTL-PIS', at: '1' },
  { reportType: 'CTL-PIS', at: '2' },
  { reportType: 'CTL-IMP', at: '3' },
  { reportType: undefined, at: '4' },
];

describe('reportPhotoLayersOf', () => {
  it('one layer per report type with its count, the busiest first, and the photos of no report last', () => {
    expect(reportPhotoLayersOf(photos)).toEqual([
      { type: 'CTL-PIS', count: 2 },
      { type: 'CTL-IMP', count: 1 },
      { type: NO_REPORT_LAYER, count: 1 },
    ]);
  });

  it('no photos, no layers', () => {
    expect(reportPhotoLayersOf([])).toEqual([]);
  });

  it('a photo with an empty type is a photo of no report', () => {
    expect(reportPhotoLayersOf([{ reportType: '' }, { reportType: null }])).toEqual([{ type: NO_REPORT_LAYER, count: 2 }]);
  });
});

describe('photosOfShownReports', () => {
  it('drops the photos of a hidden report type, and the ones of no report when that layer is hidden', () => {
    expect(photosOfShownReports(photos, new Set(['CTL-PIS'])).map((photo) => photo.at)).toEqual(['3', '4']);
    expect(photosOfShownReports(photos, new Set([NO_REPORT_LAYER])).map((photo) => photo.at)).toEqual(['1', '2', '3']);
  });

  it('with nothing hidden it is the same list', () => {
    expect(photosOfShownReports(photos, new Set())).toBe(photos);
  });
});

describe('reportPhotoLayerRows', () => {
  it('names each type as the reports do, and the photos of no report «Otras fotos de campo»', () => {
    // Arrange
    const withObservations = [...photos, { reportType: 'REG-OBS' }, { reportType: 'XYZ-NEW' }];
    // Act
    const rows = reportPhotoLayerRows(withObservations, new Set(['CTL-IMP']));
    // Assert
    expect(rows).toEqual([
      { type: 'CTL-PIS', label: 'Control de pista', count: 2, shown: true },
      { type: 'CTL-IMP', label: 'Control de imprimación', count: 1, shown: false },
      { type: 'REG-OBS', label: 'Registro de observaciones', count: 1, shown: true },
      { type: 'XYZ-NEW', label: 'XYZ-NEW', count: 1, shown: true },
      { type: NO_REPORT_LAYER, label: 'Otras fotos de campo', count: 1, shown: true },
    ]);
  });
});

describe('toggleReportLayer', () => {
  it('hides a shown type and shows it again, without touching the given set', () => {
    // Arrange
    const none: ReadonlySet<string> = new Set();
    // Act
    const hidden = toggleReportLayer(none, 'CTL-PIS');
    const back = toggleReportLayer(hidden, 'CTL-PIS');
    // Assert
    expect([...hidden]).toEqual(['CTL-PIS']);
    expect([...back]).toEqual([]);
    expect(none.size).toBe(0);
  });
});
