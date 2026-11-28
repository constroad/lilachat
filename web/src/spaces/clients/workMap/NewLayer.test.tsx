import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LAYER_EXISTS, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { NewLayer } from './NewLayer';

/** ma03 «Nueva capa» (José 28/11): catalog chips, the switch with the metrado, and «Crear capa». */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.998 }];
const MAP: WorkMap = {
  streets: [{ id: 's1', name: 'Jr. Progreso', line, lengthM: 284, widthM: 6 }, { id: 's2', name: 'Pje. San Valentín', line, lengthM: 131 }],
  scopes: [],
  progress: [],
  works: [{ id: 'imp', name: 'Imprimación', color: '#d97706' }],
  stages: [],
};
const sendTagging = (tagId: string) => vi.fn<MapEditSend>(async (request) => ({ ok: true, message: 'ok', ...(request.kind === 'work_tag' ? { data: { tag_id: tagId } } : {}) }));

describe('NewLayer (web)', () => {
  it('marks the layers already there and shows the metrado', () => {
    // Arrange / Act
    render(<NewLayer map={MAP} send={sendTagging('n1')} onCreated={vi.fn()} onClose={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('capa-imprimacion')).toBeDisabled();
    expect(screen.getByTestId('capa-imprimacion')).toHaveTextContent('Ya está');
    expect(screen.getByTestId('capa-metrado')).toHaveTextContent('2 calles · 415 m · 1 704 m² · sin ancho en 1 calle');
    expect(screen.getByTestId('capa-crear')).toBeDisabled();
  });

  it('creates the layer on every street and returns its id', async () => {
    // Arrange
    const send = sendTagging('n1');
    const onCreated = vi.fn();
    render(<NewLayer map={MAP} send={send} onCreated={onCreated} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('capa-riego-liga'));
    expect(screen.getByTestId('capa-crear')).toHaveTextContent('Crear trabajo Riego de liga');
    fireEvent.click(screen.getByTestId('capa-crear'));
    // Assert
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('n1', false));
    expect(send.mock.calls.map(([request]) => request.kind)).toEqual(['work_tag', 'work_scope', 'work_scope']);
  });

  it('with the switch off only creates it and asks for the brush', async () => {
    const send = sendTagging('n2');
    const onCreated = vi.fn();
    render(<NewLayer map={MAP} send={send} onCreated={onCreated} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('capa-base-granular'));
    fireEvent.click(screen.getByTestId('capa-todas'));
    fireEvent.click(screen.getByTestId('capa-crear'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('n2', true));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('«Otra…» refuses a name already in the service', async () => {
    const send = sendTagging('n3');
    render(<NewLayer map={MAP} send={send} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('capa-otra'));
    fireEvent.change(screen.getByTestId('capa-otra-nombre'), { target: { value: 'imprimacion' } });
    fireEvent.click(screen.getByTestId('capa-crear'));
    expect(await screen.findByTestId('capa-error')).toHaveTextContent(LAYER_EXISTS);
    expect(send).not.toHaveBeenCalled();
  });
});
