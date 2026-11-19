/**
 * The address the phone's own geocoder gives for the camera's stamp (José 18/11: Timemark printed
 * «Avenida Central Mz.126 - Lt.80, Lurigancho-Chosica 15461» where ours said only «Lurigancho, Lima,
 * Lima Metropolitana»: OpenStreetMap has no street there, the phone's geocoder does). The APK sends
 * it with the photo; without it the server looks the place up as before. PURE: app and server.
 */
export type DeviceAddress = {
  formattedAddress?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

/** Longer than this is not an address: the server keeps the start. */
const PLACE_MAX = 120;
const COUNTRY_NAMES = ['peru', 'perú'];

const fold = (text: string): string => text.trim().toLowerCase();

/** The phone's one line, without the country at its end. */
function lineOf(formatted: string, country: string | null | undefined): string | null {
  const countries = new Set([...COUNTRY_NAMES, ...(country ? [fold(country)] : [])]);
  const parts = formatted.split(',').map((part) => part.trim()).filter(Boolean);
  while (parts.length > 1 && countries.has(fold(parts[parts.length - 1]!))) parts.pop();
  return parts.length ? parts.join(', ') : null;
}

/** Street and number, then the district with its postal code; nothing without a street. */
function builtOf(address: DeviceAddress): string | null {
  if (!address.street?.trim()) return null;
  const street = [address.street, address.streetNumber].filter((part) => part?.trim()).join(' ');
  const area = [address.district ?? address.city ?? address.subregion, address.postalCode].filter((part) => part?.trim()).join(' ');
  return area ? `${street}, ${area}` : street;
}

export function devicePlaceOf(address: DeviceAddress): string | null {
  const formatted = address.formattedAddress?.trim();
  return formatted ? lineOf(formatted, address.country) : builtOf(address);
}

/** What the server accepts as a place sent with a photo: one line of text, or nothing. */
export function cleanPlace(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const line = value.replace(/\s+/g, ' ').trim();
  return line ? line.slice(0, PLACE_MAX) : null;
}
