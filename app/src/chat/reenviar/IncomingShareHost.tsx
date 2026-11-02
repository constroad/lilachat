import { useEffect, useState } from 'react';
import { ToastAndroid } from 'react-native';
import { onShareArrived, takePendingShare } from '../../../modules/share-into/src';
import { planIncomingShare, type SharePlan } from './incomingShare';
import { PantallaDeReenviar } from './PantallaDeReenviar';

/**
 * «Compartir» from another app (José, 02/11/2026): the «Reenviar a» picker,
 * titled «Compartir en», with what is being shared under the title. Sent to a
 * single chat, that chat opens, like WhatsApp. A share made while signed out
 * waits on the native side until the session is up.
 */
export function IncomingShareHost(props: { jwt: string; onOpenChat: (chatId: string) => void }) {
  const [plan, setPlan] = useState<SharePlan | null>(null);
  useEffect(() => {
    const take = () => {
      const next = planIncomingShare(takePendingShare());
      if (next) setPlan(next);
    };
    take();
    return onShareArrived(take);
  }, []);
  const toast = (text: string) => ToastAndroid.show(text, ToastAndroid.SHORT);
  return (
    <PantallaDeReenviar
      visible={plan !== null}
      titulo="Compartir en"
      resumen={plan?.summary}
      pasos={plan?.text ? [{ tipo: 'texto', texto: plan.text }] : []}
      archivos={plan?.files}
      token={props.jwt}
      onCerrar={() => setPlan(null)}
      onError={toast}
      onReenviado={(nombres, ids) => {
        setPlan(null);
        toast(`Enviado a ${nombres.join(', ')}`);
        const [only] = ids;
        if (only && ids.length === 1) props.onOpenChat(only);
      }}
    />
  );
}
