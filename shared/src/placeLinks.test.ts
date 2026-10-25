import { describe, expect, it } from 'vitest';
import { placeLinks } from './placeLinks.js';

/** José 25/10: tapping the location of a reminder asks «Maps o Waze». */
describe('placeLinks', () => {
  it('an address searches in both apps', () => {
    expect(placeLinks('Av. Javier Prado 123, San Isidro')).toEqual({
      maps: 'https://www.google.com/maps/search/?api=1&query=Av.%20Javier%20Prado%20123%2C%20San%20Isidro',
      waze: 'https://waze.com/ul?q=Av.%20Javier%20Prado%20123%2C%20San%20Isidro&navigate=yes',
    });
  });

  it('coordinates go to both apps as a point', () => {
    expect(placeLinks('-12.0464, -77.0428')).toEqual({
      maps: 'https://www.google.com/maps/search/?api=1&query=-12.0464%2C-77.0428',
      waze: 'https://waze.com/ul?ll=-12.0464%2C-77.0428&navigate=yes',
    });
  });

  it('a Google Maps link opens as it is in Maps, and its point goes to Waze', () => {
    const link = 'https://www.google.com/maps/place/Planta/@-12.0464,-77.0428,17z/data=!3m1';
    expect(placeLinks(link)).toEqual({ maps: link, waze: 'https://waze.com/ul?ll=-12.0464%2C-77.0428&navigate=yes' });
  });

  it('a link with the point in «q» is read too', () => {
    const link = 'https://maps.google.com/?q=-12.1,-77.2';
    expect(placeLinks(link)).toEqual({ maps: link, waze: 'https://waze.com/ul?ll=-12.1%2C-77.2&navigate=yes' });
  });

  it('a short link has no point: Maps opens it, Waze searches the text', () => {
    const link = 'https://maps.app.goo.gl/AbCd123';
    expect(placeLinks(link)).toEqual({ maps: link, waze: `https://waze.com/ul?q=${encodeURIComponent(link)}&navigate=yes` });
  });

  it('a link that is not Google Maps is a plain search, never opened as is', () => {
    const result = placeLinks('https://malo.example/maps');
    expect(result?.maps.startsWith('https://www.google.com/maps/search/')).toBe(true);
  });

  it('a script is never a link', () => {
    const result = placeLinks('javascript:alert(1)');
    expect(result?.maps.startsWith('https://www.google.com/maps/search/')).toBe(true);
    expect(result?.waze.startsWith('https://waze.com/ul?q=')).toBe(true);
  });

  it('blank is no place', () => {
    expect(placeLinks('')).toBeNull();
    expect(placeLinks('   ')).toBeNull();
    expect(placeLinks(undefined)).toBeNull();
  });
});
