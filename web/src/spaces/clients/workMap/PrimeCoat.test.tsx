import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapPhoto, WorkMap, WorkMapPoint } from '@lilachat/shared';
import { PrimeCoatSuggestions } from './PrimeCoat';

/** #253: the Control de imprimación suggests the stretch and «Registrar avance» opens filled. */
const METERS_PER_DEGREE = 111_195;
const north = (meters: number): WorkMapPoint => ({ lat: -12.05 + meters / METERS_PER_DEGREE, lng: -77.03 });
const map: WorkMap = {
  streets: [{ id: 's1', name: 'Jr. Los Pinos', line: [north(0), north(320)], lengthM: 320 }],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 320, workIds: ['imp'] }],
  progress: [],
  works: [{ id: 'imp', name: 'Imprimación', color: '#0f9d8a' }],
  stages: [],
};
const photo = (id: string, atM: number, reportType = 'CTL-IMP'): MapPhoto => ({ id, ...north(atM), at: '2026-11-06T14:05:00.000Z', kind: 'photo', url: `https://lila.test/${id}.jpg`, thumbnailUrl: `https://lila.test/${id}.jpg`, reportType, reportId: 'r1' });

describe('PrimeCoatSuggestions', () => {
  it('shows the stretch of the spraying photos and opens «Registrar avance» filled', () => {
    // Arrange
    const onRecord = vi.fn();
    render(<PrimeCoatSuggestions map={map} photos={[photo('a', 20), photo('b', 110)]} onRecord={onRecord} />);
    // Act
    fireEvent.click(screen.getByTestId('imprimacion-registrar-s1'));
    // Assert
    expect(screen.getByTestId('imprimacion-tramo-s1')).toHaveTextContent('+90 m');
    expect(screen.getByTestId('imprimacion-tramo-s1')).toHaveTextContent('Las 2 fotos del riego caen entre 0+020 y 0+110 de Jr. Los Pinos.');
    expect(onRecord).toHaveBeenCalledWith('s1', { workId: 'imp', fromM: 20, toM: 110, photoIds: [], note: '' });
  });

  it('draws nothing without photos of the Control de imprimación', () => {
    const { container } = render(<PrimeCoatSuggestions map={map} photos={[photo('a', 20, 'CTL-PIS')]} onRecord={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
