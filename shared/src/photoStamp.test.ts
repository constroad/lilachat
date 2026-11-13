import { describe, expect, it } from 'vitest';
import { HOUR_STAMP } from './appActions';
import { cameraStampOf, exifTakenAtOf, fileStampOf, galleryStampOf, phoneShrinksPhoto, stampFieldsOf, takenAtFrom } from './photoStamp';

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

describe('galleryStampOf', () => {
  it('keeps the date of the photo, not of the moment it is uploaded', () => {
    expect(galleryStampOf({ DateTimeOriginal: '2026:11:06 18:32:10' }, NOW)).toEqual({ takenAt: '2026-11-06T23:32:10.000Z' });
  });

  it('never carries a place, even when the file has one: the place comes only from the camera (José 07/11)', () => {
    const stamp = galleryStampOf({ DateTimeOriginal: '2026:11:06 18:32:10', GPSLatitude: 12.0464, GPSLatitudeRef: 'S', GPSLongitude: 77.0428, GPSLongitudeRef: 'W' }, NOW);
    expect(stamp).toEqual({ takenAt: '2026-11-06T23:32:10.000Z' });
  });

  it('without a date in the file it uses the one given', () => {
    expect(galleryStampOf(undefined, NOW)).toEqual({ takenAt: NOW.toISOString() });
  });
});

describe('stampFieldsOf', () => {
  it('says what the server must burn', () => {
    expect(stampFieldsOf(undefined)).toEqual({});
    expect(stampFieldsOf(HOUR_STAMP)).toEqual({ stamp: 'hour' });
    expect(stampFieldsOf(point)).toEqual({ stamp: '1', lat: '-12.0464', lng: '-77.0428', precision: '8' });
    expect(stampFieldsOf({ takenAt: '2026-11-06T23:32:10.000Z' })).toEqual({ stamp: 'taken', takenAt: '2026-11-06T23:32:10.000Z' });
  });

  it('the report camera asks for its Timemark-like stamp, with the reading and whether the logo goes (José 12/11)', () => {
    expect(stampFieldsOf({ timemark: true, point, logo: true })).toEqual({ stamp: 'timemark', logo: '1', lat: '-12.0464', lng: '-77.0428', precision: '8' });
    expect(stampFieldsOf({ timemark: true, point: null, logo: false })).toEqual({ stamp: 'timemark', logo: '0' });
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

/** José 12/11: a stamped photo is encoded once, by the server that burns the stamp, never by the phone first. */
describe('phoneShrinksPhoto', () => {
  const tenMb = 10 * 1024 * 1024;

  it('leaves a stamped photo whole for the server, and shrinks an unstamped one on the phone', () => {
    // Act
    const stamped = phoneShrinksPhoto({ timemark: true, point: null, logo: true }, 6 * 1024 * 1024, tenMb);
    const plain = phoneShrinksPhoto(undefined, 6 * 1024 * 1024, tenMb);
    // Assert
    expect(stamped).toBe(false);
    expect(plain).toBe(true);
  });

  it('still shrinks on the phone what the server would refuse, or a file whose size it cannot read', () => {
    // Act
    const huge = phoneShrinksPhoto(HOUR_STAMP, tenMb + 1, tenMb);
    const unknown = phoneShrinksPhoto(HOUR_STAMP, null, tenMb);
    // Assert
    expect(huge).toBe(true);
    expect(unknown).toBe(true);
  });
});

describe('the Timemark stamp of a queued report photo', () => {
  it('says the hour it was taken, and is never read as a gallery photo', () => {
    // Act
    const fields = stampFieldsOf({ timemark: true, point: null, logo: false, takenAt: '2026-11-12T12:42:00.000Z' });
    // Assert
    expect(fields).toEqual({ stamp: 'timemark', logo: '0', takenAt: '2026-11-12T12:42:00.000Z' });
  });
});
