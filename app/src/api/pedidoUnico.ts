/**
 * Juntar pedidos iguales que están en vuelo (FL4). PURO.
 *
 * La lista de chats se pedía 6 veces al arrancar: la lista y las pestañas
 * pedían cada una por su lado, y otra vez al conectar el socket. Si ya hay un
 * pedido con la misma clave en camino, el segundo espera ese mismo resultado.
 * Terminado, se olvida: el siguiente vuelve al server. No es una caché —un
 * cambio recién hecho (archivar, fijar) tiene que verse al recargar—.
 */
const enVuelo = new Map<string, Promise<unknown>>();

export function unSoloPedido<T>(clave: string, hacer: () => Promise<T>): Promise<T> {
  const existente = enVuelo.get(clave) as Promise<T> | undefined;
  if (existente) return existente;
  const pedido = hacer().finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, pedido);
  return pedido;
}
