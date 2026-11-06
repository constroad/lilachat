import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFormPlace } from './commandsApi';
import { usePlaceName } from './usePlaceName';

const point = { lat: -12.02177, lng: -76.88174, precision: 12 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePlaceName', () => {
  it('asks once per block, even when the function or the precision change', async () => {
    // Arrange
    const lookup = vi.fn(async () => 'Avenida Lima 123');
    const { result, rerender } = renderHook(({ reading, ask }) => usePlaceName(reading, ask), { initialProps: { reading: point, ask: lookup } });
    expect(result.current).toBeUndefined();
    // Act
    await waitFor(() => expect(result.current).toBe('Avenida Lima 123'));
    rerender({ reading: { ...point, precision: 5 }, ask: vi.fn(lookup) });
    // Assert
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('Avenida Lima 123');
  });

  it('another block asks again, and shows nothing old while it does', async () => {
    // Arrange
    const lookup = vi.fn(async (reading: { lat: number }) => (reading.lat < -12.03 ? 'Otra calle' : 'Avenida Lima 123'));
    const { result, rerender } = renderHook(({ reading }) => usePlaceName(reading, lookup), { initialProps: { reading: point } });
    await waitFor(() => expect(result.current).toBe('Avenida Lima 123'));
    // Act
    rerender({ reading: { ...point, lat: -12.05 } });
    // Assert
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe('Otra calle'));
  });

  it('no reading asks nothing; no way to ask is no address', async () => {
    // Arrange
    const lookup = vi.fn(async () => 'x');
    // Act
    const nothing = renderHook(() => usePlaceName(null, lookup));
    const silent = renderHook(() => usePlaceName(point));
    // Assert
    expect(nothing.result.current).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
    await waitFor(() => expect(silent.result.current).toBeNull());
  });
});

describe('readFormPlace', () => {
  const scope = { chatId: 'c1' };
  const answers = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it('reads the address of the open form, with the session', async () => {
    // Arrange
    answers({ place: 'Avenida Lima 123' });
    // Act
    const place = await readFormPlace('jwt', scope, 'run1', point);
    // Assert
    expect(place).toBe('Avenida Lima 123');
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/commands/run1/place?lat=-12.02177&lng=-76.88174&precision=12');
    expect(init?.headers).toEqual({ Authorization: 'Bearer jwt' });
  });

  it('a refusal or no signal is no address, never an error on the camera', async () => {
    // Arrange
    answers({ message: 'no' }, 429);
    // Act and assert
    expect(await readFormPlace('jwt', scope, 'run1', point)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await readFormPlace('jwt', scope, 'run1', point)).toBeNull();
  });
});
