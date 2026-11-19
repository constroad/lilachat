import { describe, expect, it } from 'vitest';
import { cleanPlace, devicePlaceOf } from './devicePlace';

describe('devicePlaceOf', () => {
  it('keeps the phone geocoder line without the country, like Timemark', () => {
    // Arrange
    const address = { formattedAddress: 'Avenida Central Mz.126 - Lt.80, Lurigancho-Chosica 15461, Perú', country: 'Perú' };
    // Act
    const place = devicePlaceOf(address);
    // Assert
    expect(place).toBe('Avenida Central Mz.126 - Lt.80, Lurigancho-Chosica 15461');
  });

  it('drops the country even when written without its accent', () => {
    expect(devicePlaceOf({ formattedAddress: 'Jr. Los Pinos 120, Ate 15022, Peru', country: 'Perú' })).toBe('Jr. Los Pinos 120, Ate 15022');
  });

  it('builds street, number, district and postal code when the phone gives no line', () => {
    const address = { formattedAddress: null, street: 'Avenida Central', streetNumber: '80', district: 'Lurigancho-Chosica', city: 'Lima', postalCode: '15461' };
    expect(devicePlaceOf(address)).toBe('Avenida Central 80, Lurigancho-Chosica 15461');
  });

  it('gives nothing without a street, so the server looks the place up', () => {
    expect(devicePlaceOf({ formattedAddress: null, street: null, district: 'Lurigancho', city: 'Lima' })).toBeNull();
    expect(devicePlaceOf({ formattedAddress: '   ', street: null })).toBeNull();
  });
});

describe('cleanPlace', () => {
  it('trims, joins its spaces and drops line breaks', () => {
    expect(cleanPlace('  Avenida Central\n Mz.126  ')).toBe('Avenida Central Mz.126');
  });

  it('refuses what is not text, empty, or absurdly long', () => {
    expect(cleanPlace(undefined)).toBeNull();
    expect(cleanPlace(42)).toBeNull();
    expect(cleanPlace('   ')).toBeNull();
    expect(cleanPlace('x'.repeat(500))).toHaveLength(120);
  });
});
