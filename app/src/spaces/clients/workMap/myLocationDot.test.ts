import { describe, expect, it } from 'vitest';
import { myLocationCollection } from './myLocationDot';

describe('myLocationCollection', () => {
  it('has no feature before the phone is located', () => {
    expect(myLocationCollection(null).features).toHaveLength(0);
  });

  it('places one point at the located spot, lng before lat', () => {
    const collection = myLocationCollection({ lat: -12.0464, lng: -77.0428 });
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].geometry.coordinates).toEqual([-77.0428, -12.0464]);
  });
});
