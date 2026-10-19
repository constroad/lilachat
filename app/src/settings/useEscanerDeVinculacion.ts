import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenDeVinculacion } from '@lilachat/shared';
import { aprobarVinculacion, consultarVinculacion } from '../api/client';
import { confirmarQueEresTu } from './desbloqueo';
import { motivoDeVinculacion } from './vinculos';

export type FaseDelEscaner =
  | { fase: 'buscando' }
  | { fase: 'consultando' }
  | { fase: 'confirmando'; token: string; nombre: string }
  | { fase: 'vinculando'; nombre: string }
  | { fase: 'aviso'; texto: string };

/** Lo que dura un aviso sobre la cámara antes de volver a buscar. */
const DURACION_DEL_AVISO_MS = 2_500;

/**
 * El escáner de vincular (W5): leer el QR → preguntar al server qué
 * navegador es → confirmar con el desbloqueo del teléfono → aprobar.
 * La cámara lee decenas de cuadros por segundo: solo el primero en
 * `buscando` cuenta; el resto se ignora hasta que se resuelva.
 */
export function useEscanerDeVinculacion(jwt: string, onVinculado: (nombre: string) => void) {
  const [estado, setEstado] = useState<FaseDelEscaner>({ fase: 'buscando' });
  const ocupado = useRef(false);
  /** El último código rechazado y por qué: si la cámara lo sigue viendo, no se le vuelve a preguntar al server. */
  const rechazado = useRef<{ texto: string; motivo: string } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (reloj.current && clearTimeout(reloj.current)), []);

  const avisar = useCallback((texto: string) => {
    setEstado({ fase: 'aviso', texto });
    reloj.current = setTimeout(() => {
      ocupado.current = false;
      setEstado({ fase: 'buscando' });
    }, DURACION_DEL_AVISO_MS);
  }, []);

  const alLeer = useCallback(
    async (texto: string) => {
      if (ocupado.current) return;
      ocupado.current = true;
      if (rechazado.current?.texto === texto) return avisar(rechazado.current.motivo);
      const token = tokenDeVinculacion(texto);
      if (!token) return avisar('Ese código no es de Lilachat Web.');
      setEstado({ fase: 'consultando' });
      const consulta = await consultarVinculacion(jwt, token);
      if (!consulta.ok) {
        const motivo = motivoDeVinculacion(consulta);
        // Sin red sí se reintenta: el mismo código puede servir al volver.
        if (consulta.status !== 'network') rechazado.current = { texto, motivo };
        return avisar(motivo);
      }
      setEstado({ fase: 'confirmando', token, nombre: consulta.data.nombre });
    },
    [jwt, avisar]
  );

  const vincular = useCallback(async () => {
    if (estado.fase !== 'confirmando') return;
    if (!(await confirmarQueEresTu('Confirma que eres tú para vincular'))) return;
    setEstado({ fase: 'vinculando', nombre: estado.nombre });
    const aprobado = await aprobarVinculacion(jwt, estado.token);
    if (!aprobado.ok) return avisar(motivoDeVinculacion(aprobado));
    onVinculado(aprobado.data.nombre);
  }, [estado, jwt, avisar, onVinculado]);

  const cancelar = useCallback(() => {
    ocupado.current = false;
    setEstado({ fase: 'buscando' });
  }, []);

  return { estado, alLeer, vincular, cancelar };
}
