import { useCallback, useEffect, useState } from 'react';
import { suscribirTarjeta, type CardType } from '@lilachat/shared';
import { api } from '../../api';

/**
 * Lo último que se vio de cada tarjeta, por `tipo:id`: la lista virtualizada
 * desmonta y vuelve a montar las filas al scrollear, y pedirla de nuevo la
 * dejaría en blanco un instante. `null` = ya no está.
 */
const vistas = new Map<string, unknown>();

/**
 * Una tarjeta del chat (encuesta, evento o recordatorio) como la app (W3c,
 * 20/10): se pide al montar, `404` = ya no está (sin reintentar para siempre)
 * y se vuelve a pedir cuando el server avisa `ref.changed`.
 */
export function useTarjeta<T>(params: { tipo: CardType; id: string; ruta: string; campo: string; jwt: string }) {
  const { tipo, id, ruta, campo, jwt } = params;
  const llave = `${tipo}:${id}`;
  const [valor, setValor] = useState<T | null | undefined>(() => vistas.get(llave) as T | null | undefined);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    const respuesta = await api<Record<string, T>>(ruta, { jwt });
    if (respuesta.ok) {
      const nuevo = respuesta.data[campo] as T;
      vistas.set(llave, nuevo);
      setValor(nuevo);
      setFallo(false);
    } else if (respuesta.status === 404) {
      vistas.set(llave, null);
      setValor(null);
    } else setFallo(true);
  }, [llave, ruta, campo, jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEffect(() => suscribirTarjeta(tipo, id, () => void cargar()), [tipo, id, cargar]);

  const reemplazar = useCallback(
    (nuevo: T | null) => {
      vistas.set(llave, nuevo);
      setValor(nuevo);
    },
    [llave]
  );
  return { valor, fallo, cargar, reemplazar };
}
