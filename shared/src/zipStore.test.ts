import { describe, expect, it } from 'vitest';
import { crc32, zipOneFile } from './zipStore';

const text = (value: string) => new TextEncoder().encode(value);

/** Reads back the only file of the zip, the way an unzip tool walks the local header. */
function readBack(zip: Uint8Array): { name: string; content: string; method: number; crc: number } {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const nameLength = view.getUint16(26, true);
  const size = view.getUint32(18, true);
  const decoder = new TextDecoder();
  return {
    name: decoder.decode(zip.subarray(30, 30 + nameLength)),
    content: decoder.decode(zip.subarray(30 + nameLength, 30 + nameLength + size)),
    method: view.getUint16(8, true),
    crc: view.getUint32(14, true),
  };
}

describe('crc32', () => {
  it('gives the check value of the standard', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('zipOneFile (a KMZ is a zip with doc.kml)', () => {
  it('stores the file with its name, its bytes and its checksum', () => {
    // Arrange
    const kml = '<kml>Av. Perú</kml>';
    // Act
    const zip = zipOneFile('doc.kml', text(kml));
    // Assert
    expect(readBack(zip)).toEqual({ name: 'doc.kml', content: kml, method: 0, crc: crc32(text(kml)) });
  });

  it('closes with a directory that points back to the file', () => {
    // Arrange
    const zip = zipOneFile('doc.kml', text('<kml/>'));
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    // Act
    const centralAt = view.getUint32(end + 16, true);
    // Assert: the signatures sit where a reader looks for them.
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(centralAt, true)).toBe(0x02014b50);
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(1);
    expect(view.getUint32(centralAt + 42, true)).toBe(0);
  });

  it('writes the same bytes for the same file', () => {
    expect(zipOneFile('doc.kml', text('<kml/>'))).toEqual(zipOneFile('doc.kml', text('<kml/>')));
  });
});
