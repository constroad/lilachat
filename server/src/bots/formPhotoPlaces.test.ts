import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from '@lilachat/shared';
import { photosAmong, placeOfStamp, signPhotoValues, type PhotoSigner } from './formPhotoPlaces.js';

/** FRE-PAV in the field (José 13/11): every photo travels with where and when it was taken, to sit on the sketch. */
const AT = new Date('2026-11-13T15:04:00.000Z');
const ID = { inicio: '6735a1f0c2b4e8a1d0f3a001', fin: '6735a1f0c2b4e8a1d0f3a002', galeria: '6735a1f0c2b4e8a1d0f3a003', ajena: '6735a1f0c2b4e8a1d0f3a0ff' };
const files: Record<string, { point?: { lat: number; lng: number; precision: number }; takenAt?: Date }> = {
  [ID.inicio]: { point: { lat: -12.0217, lng: -76.8817, precision: 6 }, takenAt: AT },
  [ID.fin]: { point: { lat: -12.0221, lng: -76.8809, precision: 9 }, takenAt: AT },
  [ID.galeria]: { takenAt: AT },
};
const sign: PhotoSigner = (fileId) => (typeof fileId === 'string' && files[fileId] ? { url: `https://lilachat.constroad.com/api/bots/files/${fileId}.firma`, ...files[fileId]! } : null);
const formOf = (properties: Record<string, FormSchemaProperty>): AppForm => ({ id: 'fre_pav', title: 'Fresado de pavimento', schema: { type: 'object', properties } });
const url = (fileId: string) => `https://lilachat.constroad.com/api/bots/files/${fileId}.firma`;

describe('placeOfStamp: what the file keeps of the upload', () => {
  it('the camera reading keeps its point and the hour it was taken', () => {
    expect(placeOfStamp({ timemark: { logo: false }, location: { lat: -12.0217, lng: -76.8817, precision: 6 }, takenAt: AT })).toEqual({ point: { lat: -12.0217, lng: -76.8817, precision: 6 }, takenAt: AT });
  });
  it('a gallery photo keeps only its date, and no stamp keeps the upload hour', () => {
    expect(placeOfStamp({ takenAt: AT })).toEqual({ takenAt: AT });
    expect(placeOfStamp(undefined, AT)).toEqual({ takenAt: AT });
    expect(placeOfStamp({ hourOnly: true }, AT)).toEqual({ takenAt: AT });
  });
});

describe('signPhotoValues: addresses in values, places apart', () => {
  it('a single photo becomes its address and its place goes to photos with the field it came from', () => {
    // Arrange
    const fields = formFields(formOf({ foto: { type: 'string', title: 'Foto del inicio', 'x-input': 'photo' }, progresiva: { type: 'string' } }));
    // Act
    const signed = signPhotoValues(fields, { foto: ID.inicio, progresiva: '0+120' }, sign);
    // Assert
    expect(signed.values).toEqual({ foto: url(ID.inicio), progresiva: '0+120' });
    expect(signed.photos).toEqual([{ field: 'foto', url: url(ID.inicio), taken_at: AT.toISOString(), lat: -12.0217, lng: -76.8817, precision_m: 6 }]);
  });
  it('several photos keep their order, a foreign one is dropped, and a gallery photo travels without a place', () => {
    const fields = formFields(formOf({ fotos: { type: 'array', title: 'Fotos', 'x-input': 'photo', items: { type: 'string' } } }));
    const signed = signPhotoValues(fields, { fotos: [ID.inicio, ID.ajena, ID.galeria] }, sign);
    expect(signed.values).toEqual({ fotos: [url(ID.inicio), url(ID.galeria)] });
    expect(signed.photos).toEqual([
      { field: 'fotos', url: url(ID.inicio), taken_at: AT.toISOString(), lat: -12.0217, lng: -76.8817, precision_m: 6 },
      { field: 'fotos', url: url(ID.galeria), taken_at: AT.toISOString() },
    ]);
  });
  it("a list's item photos are signed too, named by their row", () => {
    const fields = formFields(formOf({ tramos: { type: 'array', title: 'Tramos', items: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, largo: { type: 'number' } } } } }));
    const signed = signPhotoValues(fields, { tramos: [{ foto: ID.inicio, largo: 40 }, { foto: ID.fin, largo: 35 }] }, sign);
    expect(signed.values).toEqual({ tramos: [{ foto: url(ID.inicio), largo: 40 }, { foto: url(ID.fin), largo: 35 }] });
    expect(signed.photos.map((photo) => photo.field)).toEqual(['tramos[0].foto', 'tramos[1].foto']);
  });
  it('a single photo that is not of this form is no value, and no photo means an empty photos', () => {
    const fields = formFields(formOf({ foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } }));
    expect(signPhotoValues(fields, { foto: ID.ajena }, sign)).toEqual({ values: {}, photos: [] });
    expect(signPhotoValues(fields, {}, sign)).toEqual({ values: {}, photos: [] });
  });
});

describe('photosAmong: only what is still answered travels', () => {
  it('drops the place of a photo whose field ended hidden, keeps the rest in order', () => {
    const photos = [{ field: 'foto', url: url(ID.inicio) }, { field: 'tramos[0].foto', url: url(ID.fin) }];
    expect(photosAmong(photos, { tramos: [{ foto: url(ID.fin) }] })).toEqual([{ field: 'tramos[0].foto', url: url(ID.fin) }]);
    expect(photosAmong(photos, {})).toEqual([]);
  });
});
