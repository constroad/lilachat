import { useCallback, useState } from 'react';
import { ToastAndroid } from 'react-native';
import type { Reaccion } from '@lilachat/shared';
import type { RespuestaDeReaccion } from '../useCambiosDeMensajes';
import { HojaDeEmojis, HojaDeReacciones } from './HojaDeReacciones';

type MensajeConReacciones = { seq: number; reacciones?: Reaccion[] };

/**
 * Las reacciones en una pantalla (chat o hilo): elegir, «+» con todos los
 * emojis y «quién reaccionó». Devuelve los callbacks para las filas y las
 * hojas para montar una sola vez. Un «no» del server se dice: la reacción ya
 * volvió atrás sola (`useCambiosDeMensajes`).
 */
export function useReaccionesEnPantalla(params: {
  mensajes: readonly MensajeConReacciones[];
  reaccionar: (seq: number, emoji: string | null) => Promise<RespuestaDeReaccion>;
  yo: string;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  /** Al reaccionar se sale de la selección, como WhatsApp. */
  alReaccionar?: () => void;
}) {
  const { reaccionar, alReaccionar } = params;
  const [verDe, setVerDe] = useState<number | null>(null);
  const [masPara, setMasPara] = useState<number | null>(null);

  const elegir = useCallback(
    (seq: number, emoji: string | null) => {
      alReaccionar?.();
      void reaccionar(seq, emoji).then((r) => {
        if (!r.ok && r.motivo) ToastAndroid.show(r.motivo, ToastAndroid.SHORT);
      });
    },
    [reaccionar, alReaccionar]
  );

  const reaccionesAbiertas = verDe === null ? null : (params.mensajes.find((uno) => uno.seq === verDe)?.reacciones ?? []);
  const hojas = (
    <>
      <HojaDeReacciones
        reacciones={reaccionesAbiertas}
        yo={params.yo}
        nombres={params.nombres}
        fotos={params.fotos}
        onQuitarMia={() => {
          if (verDe !== null) elegir(verDe, null);
          setVerDe(null);
        }}
        onCerrar={() => setVerDe(null)}
      />
      <HojaDeEmojis
        visible={masPara !== null}
        onElegir={(emoji) => {
          if (masPara !== null) elegir(masPara, emoji);
          setMasPara(null);
        }}
        onCerrar={() => setMasPara(null)}
      />
    </>
  );

  return { elegir, verReacciones: setVerDe, masEmojis: setMasPara, hojas };
}
