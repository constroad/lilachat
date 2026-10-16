import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AsientoDelLibro, Libro } from '@lilachat/shared';

/**
 * El libro de respaldos subidos (F12.1): qué archivo se subió, con qué huella
 * y cuándo. Es chico —un asiento por archivo, y se conserva uno—, así que va
 * en AsyncStorage como JSON; el libro de fotos usa SQLite porque son miles.
 */
const CLAVE = 'lilachat.respaldo.libro';

export async function leerLibro(): Promise<Libro> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    const asientos = crudo ? (JSON.parse(crudo) as AsientoDelLibro[]) : [];
    return new Map(asientos.map((asiento) => [asiento.id, asiento]));
  } catch {
    return new Map();
  }
}

export async function anotar(asiento: AsientoDelLibro): Promise<void> {
  const libro = new Map(await leerLibro());
  libro.set(asiento.id, asiento);
  await AsyncStorage.setItem(CLAVE, JSON.stringify([...libro.values()]));
}

export async function olvidarLibro(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}
