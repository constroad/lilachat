import { afterEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
const openURL = vi.fn(async (_url: string) => true);
vi.mock('react-native', () => ({ Alert: { alert }, Linking: { openURL } }));

const { askMapsOrWaze } = await import('./openPlace');
type Button = { text: string; style?: string; onPress?: () => void };
const buttons = () => alert.mock.calls[0]![2] as Button[];

afterEach(() => vi.clearAllMocks());

/** José 25/10: «tocar la ubicación y que me pregunte si abrir Maps o Waze». */
describe('askMapsOrWaze', () => {
  it('asks which app, with Maps and Waze and a way out', () => {
    askMapsOrWaze('Av. Javier Prado 123');
    expect(alert.mock.calls[0]![0]).toBe('¿Cómo quieres llegar?');
    expect(alert.mock.calls[0]![1]).toBe('Av. Javier Prado 123');
    expect(buttons().map((button) => button.text)).toEqual(['Google Maps', 'Waze', 'Cancelar']);
    expect(buttons()[2]!.style).toBe('cancel');
  });

  it('«Google Maps» opens the place in Maps', () => {
    askMapsOrWaze('Av. Javier Prado 123');
    buttons()[0]!.onPress!();
    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Av.%20Javier%20Prado%20123');
  });

  it('«Waze» opens it in Waze', () => {
    askMapsOrWaze('-12.0464, -77.0428');
    buttons()[1]!.onPress!();
    expect(openURL).toHaveBeenCalledWith('https://waze.com/ul?ll=-12.0464%2C-77.0428&navigate=yes');
  });

  it('a blank place asks nothing', () => {
    askMapsOrWaze('   ');
    askMapsOrWaze(undefined);
    expect(alert).not.toHaveBeenCalled();
  });

  it('if the phone cannot open it, it says so instead of staying silent', async () => {
    openURL.mockRejectedValueOnce(new Error('no app'));
    askMapsOrWaze('Planta Lurín');
    buttons()[1]!.onPress!();
    await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
    expect(alert.mock.calls[1]![0]).toBe('No se pudo abrir la ubicación');
  });
});
