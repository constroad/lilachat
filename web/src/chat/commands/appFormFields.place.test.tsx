import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLACE_BUTTON, formFields, locationMapLink, type FormField } from '@lilachat/shared';
import { TextField } from './AppFormFields';

/** The place of a report (José, 06/11: «una opción para tomar la ubicación del dispositivo»). */
const fieldOf = (input?: string) => formFields({ id: 'lugar', title: 'Lugar', schema: { type: 'object', properties: { ubicacion: { type: 'string', title: 'Ubicación', ...(input ? { 'x-input': input } : {}) } } } })[0] as Extract<FormField, { kind: 'text' }>;

function stubPosition(answer: (found: PositionCallback, failed: PositionErrorCallback) => void) {
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: answer } });
}

afterEach(() => vi.unstubAllGlobals());

describe('a place field', () => {
  it('writes the link to where the device is', async () => {
    stubPosition((found) => found({ coords: { latitude: -12.05, longitude: -77.04 } } as GeolocationPosition));
    const onChange = vi.fn();
    render(<TextField field={fieldOf('place')} value="" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('btn-usar-ubicacion'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(locationMapLink({ lat: -12.05, lng: -77.04 })));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says why when the device does not give it, and leaves what was typed', async () => {
    stubPosition((_found, failed) => failed({ code: 1 } as GeolocationPositionError));
    const onChange = vi.fn();
    render(<TextField field={fieldOf('place')} value="Av. Los Incas" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('btn-usar-ubicacion'));

    expect((await screen.findByRole('alert')).textContent).toBe(PLACE_BUTTON.failed);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a plain text has no button', () => {
    render(<TextField field={fieldOf()} value="" onChange={vi.fn()} />);
    expect(screen.queryByTestId('btn-usar-ubicacion')).toBeNull();
  });
});
