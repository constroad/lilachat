import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workMapOf, type WorkMap } from '@lilachat/shared';
import { WorkMapExport } from './WorkMapExport';

/** Design o-08 inside «Compartir avance»: the partial progress, street by street, as the client sees it. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const mapOf = (progress: Array<Record<string, unknown>>): WorkMap => workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [] }],
    progress,
    tags: [{ _id: 'base', name: 'Base', color: '#d97706', order: 1 }],
    stages: [],
  },
})!;

describe('WorkMapExport · Avance parcial', () => {
  it('lists each work with its streets, the streets with progress and the approved metres', () => {
    render(<WorkMapExport map={mapOf([{ streetId: 's1', tagId: 'base', fromM: 0, toM: 120, date: '2026-11-01' }])} filter={{}} title="Obra" pageUrl="https://portal.example/x" onClose={vi.fn()} />);
    expect(screen.getByTestId('mapa-parcial-base')).toHaveTextContent('Base: Jr. Los Pinos hasta 0+120');
    expect(screen.getByTestId('mapa-parcial-vias')).toHaveTextContent('1 de 1 vía');
    expect(screen.getByTestId('mapa-parcial-metrado')).toHaveTextContent('+120 m lineales');
  });

  it('says when the cut has no approved progress yet', () => {
    render(<WorkMapExport map={mapOf([])} filter={{}} title="Obra" pageUrl="https://portal.example/x" onClose={vi.fn()} />);
    expect(screen.getByText('Todavía no hay avance aprobado en este corte.')).toBeTruthy();
  });
});
