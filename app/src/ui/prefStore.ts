import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A per-device preference that screens read without a provider (the chat's
 * font size, groups as a list). Read from AsyncStorage once, the first time
 * something asks; until then it is its default.
 */
export type PrefStore<T> = {
  use: () => T;
  get: () => T;
  set: (value: T) => void;
  /** The value once the device has been asked: a cold start reads before AsyncStorage answers. */
  ready: () => Promise<T>;
};

export function createPrefStore<T>(key: string, parse: (stored: string | null) => T, fallback: T, serialize: (value: T) => string = String): PrefStore<T> {
  let current = fallback;
  let reading: Promise<void> | null = null;
  // A value set here before the read ends is newer than the stored one.
  let touched = false;
  const listeners = new Set<() => void>();
  const announce = () => listeners.forEach((listener) => listener());
  const read = (): Promise<void> => {
    reading ??= AsyncStorage.getItem(key)
      .then((stored) => {
        const value = parse(stored);
        if (touched || value === current) return;
        current = value;
        announce();
      })
      .catch((error: unknown) => console.warn(`[pref] no se pudo leer ${key}:`, error instanceof Error ? error.message : error));
    return reading;
  };
  const subscribe = (listener: () => void) => {
    void read();
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const get = () => current;
  return {
    get,
    ready: () => read().then(get),
    use: () => useSyncExternalStore(subscribe, get),
    set: (value: T) => {
      touched = true;
      current = value;
      announce();
      AsyncStorage.setItem(key, serialize(value)).catch((error: unknown) => console.warn(`[pref] no se pudo guardar ${key}:`, error instanceof Error ? error.message : error));
    },
  };
}
