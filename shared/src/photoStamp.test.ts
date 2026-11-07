import { describe, expect, it } from 'vitest';
import { HOUR_STAMP } from './appActions';
import { cameraStampOf, exifPointOf, exifTakenAtOf, fileStampOf, galleryStampOf, stampFieldsOf, takenAtFrom } from './photoStamp';

/** José 06/11: the photo of a tank or a material carries its date, hour and place, from the camera or from the gallery. */
const point = { lat: -12.0464, lng: -77.0428, precision: 8 };
const NOW = new Date('2026-11-07T01:00:00.000Z');

describe('cameraStampOf', () => {
  it('a fresh reading burns the place; without one, the hour still goes', () => {
    expect(cameraStampOf(point)).toEqual(point);
    expect(cameraStampOf(null)).toBe(HOUR_STAMP);
  });
});

describe('exifTakenAtOf', () => {
  it('reads the camera\'s date as Peru time, which has no zone in the file', () => {
    expect(exifTakenAtOf({ DateTimeOriginal: '2026:11:06 18:32:10' })).toBe('2026-11-06T23:32:10.000Z');
    expect(exifTakenAtOf({ DateTime: '2026:11:06 18:32:10' })).toBe('2026-11-06T23:32:10.000Z');
  });

  it('a file without a date, or with a broken one, has none', () => {
    expect(exifTakenAtOf(undefined)).toBeNull();
    expect(exifTakenAtOf({})).toBeNull();
    expect(exifTakenAtOf({ DateTimeOriginal: '0000:00:00 00:00:00' })).toBeNull();
  });
});

describe('exifPointOf', () => {
  it('reads decimal degrees with their hemisphere', () => {
    expect(exifPointOf({ GPSLatitude: 12.0464, GPSLatitudeRef: 'S', GPSLongitude: 77.0428, GPSLongitudeRef: 'W' })).toMatchObject({ lat: -12.0464, lng: -77.0428 });
  });

  it('reads degrees, minutes and seconds', () => {
    const read = exifPointOf({ GPSLatitude: [12, 2, 47.04], GPSLatitudeRef: 'S', GPSLongitude: [77, 2, 34.08], GPSLongitudeRef: 'W' });
    expect(read?.lat).toBeCloseTo(-12.0464, 3);
    expect(read?.lng).toBeCloseTo(-77.0428, 3);
  });

  it('Android blanks the place without its permission: zero is no place', () => {
    expect(exifPointOf({ GPSLatitude: 0, GPSLongitude: 0 })).toBeNull();
    expect(exifPointOf({})).toBeNull();
    expect(exifPointOf(undefined)).toBeNull();
  });
});

describe('galleryStampOf', () => {
  it('keeps the date and the place of the photo, not of the moment it is uploaded', () => {
    const stamp = galleryStampOf({ DateTimeOriginal: '2026:11:06 18:32:10', GPSLatitude: 12.0464, GPSLatitudeRef: 'S', GPSLongitude: 77.0428, GPSLongitudeRef: 'W' }, NOW);
    expect(stamp.takenAt).toBe('2026-11-06T23:32:10.000Z');
    expect(stamp.location).toMatchObject({ lat: -12.0464 });
  });

  it('without a date in the file it uses the one given, and no place is invented', () => {
    expect(galleryStampOf(undefined, NOW)).toEqual({ takenAt: NOW.toISOString() });
  });
});

describe('stampFieldsOf', () => {
  it('says what the server must burn', () => {
    expect(stampFieldsOf(undefined)).toEqual({});
    expect(stampFieldsOf(HOUR_STAMP)).toEqual({ stamp: 'hour' });
    expect(stampFieldsOf(point)).toEqual({ stamp: '1', lat: '-12.0464', lng: '-77.0428', precision: '8' });
    expect(stampFieldsOf({ takenAt: '2026-11-06T23:32:10.000Z' })).toEqual({ stamp: 'taken', takenAt: '2026-11-06T23:32:10.000Z' });
    expect(stampFieldsOf({ takenAt: '2026-11-06T23:32:10.000Z', location: point })).toEqual({ stamp: 'taken', takenAt: '2026-11-06T23:32:10.000Z', lat: '-12.0464', lng: '-77.0428', precision: '8' });
  });
});

describe('takenAtFrom (the server does not trust the phone blindly)', () => {
  it('takes a real past date', () => {
    expect(takenAtFrom('2026-11-06T23:32:10.000Z', NOW)?.toISOString()).toBe('2026-11-06T23:32:10.000Z');
  });

  it('refuses a future one, nonsense, or something that is no date', () => {
    expect(takenAtFrom('2027-01-01T00:00:00.000Z', NOW)).toBeNull();
    expect(takenAtFrom('1999-12-31T00:00:00.000Z', NOW)).toBeNull();
    expect(takenAtFrom('ayer', NOW)).toBeNull();
    expect(takenAtFrom(undefined, NOW)).toBeNull();
  });
});

describe('fileStampOf: a browser file keeps its own date', () => {
  it('a gallery field sends the file date, a plain one nothing, a camera-only one the hour', () => {
    // Arrange
    const lastModified = Date.UTC(2026, 10, 5, 14, 30);
    // Act
    const stamps = [fileStampOf({ gallery: true }, lastModified), fileStampOf({ gallery: true, plainGallery: true }, lastModified), fileStampOf({ gallery: false }, lastModified)];
    // Assert
    expect(stamps).toEqual([{ takenAt: '2026-11-05T14:30:00.000Z' }, undefined, HOUR_STAMP]);
  });
});
