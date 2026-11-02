import { useEffect, useState } from 'react';
import { ToastAndroid } from 'react-native';
import { onShareArrived, takePendingShare } from '../../../modules/share-into/src';
import type { ChatSummary } from '../../api/client';
import { setCurrentSpaceId } from '../../spaces/currentSpace';
import { planIncomingShare, type SharePlan } from './incomingShare';
import { ForwardScreen } from './ForwardScreen';
import { knownChats } from './knownChats';

/**
 * «Compartir» from another app (José, 02/11/2026): the forward picker,
 * titled «Compartir en», with what is being shared under the title. Sent to a
 * single chat, that chat opens in its space, like WhatsApp. A share made while signed out
 * waits on the native side until the session is up.
 */
export function IncomingShareHost(props: { jwt: string; onOpenChat: (chat: ChatSummary) => void }) {
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
    <ForwardScreen
      visible={plan !== null}
      title="Compartir en"
      summary={plan?.summary}
      steps={plan?.text ? [{ tipo: 'texto', texto: plan.text }] : []}
      files={plan?.files}
      token={props.jwt}
      onClose={() => setPlan(null)}
      onError={toast}
      onSent={(names, ids) => {
        setPlan(null);
        toast(`Enviado a ${names.join(', ')}`);
        const chat = ids.length === 1 ? knownChats().find((one) => one.id === ids[0]) : undefined;
        if (!chat) return;
        // In its own space first, like a tapped notice: otherwise «back» lands on another space's list.
        setCurrentSpaceId(chat.workspaceId ?? null);
        props.onOpenChat(chat);
      }}
    />
  );
}
