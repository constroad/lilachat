import { useEffect, useState } from 'react';
import { getBackupStatus } from './backupApi';

/**
 * ¿Quien usa la app opera el server? (FL10, auditoría §46.3: «dos respaldos
 * distintos en Ajustes»). El volcado nocturno de la base es cosa de operadores;
 * el resto tiene un solo respaldo, el de sus chats. Lo decide el server
 * (`puedeRespaldar`): sin respuesta, no se muestra.
 */
export function useEsOperador(jwt: string): boolean {
  const [esOperador, setEsOperador] = useState(false);
  useEffect(() => {
    let vivo = true;
    void getBackupStatus(jwt).then((respuesta) => {
      if (vivo) setEsOperador(respuesta.ok && respuesta.data.puedeRespaldar === true);
    });
    return () => {
      vivo = false;
    };
  }, [jwt]);
  return esOperador;
}
