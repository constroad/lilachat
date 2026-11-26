import { useEffect, useState } from 'react';
import { firstShownAnswer, settleServiceAnswer, type ServiceAskKind, type ServiceAskValue, type ShownServiceAnswer } from '@lilachat/shared';
import { alConectar } from '../../chat/socketClient';
import { askService, dropSavedServiceAnswer, KEPT_KINDS, readSavedServiceAnswer, writeSavedServiceAnswer } from './savedServiceAnswers';

export type ServiceAskTarget = { jwt: string; spaceId: string; clientId: string };

/**
 * Asked when it opens; `null` while it loads. A new `round` asks again keeping what is on screen (after a payment, agentes 31/10).
 * The detail is kept on the phone since 26/11 (José, offline at the site): its copy paints at once, the server confirms or
 * corrects behind, and without signal the copy stays with `offline` until the socket connects again, which asks once more.
 */
export function useServiceAsk<K extends ServiceAskKind>(kind: K, target: ServiceAskTarget, serviceId: string | null, round = 0): ShownServiceAnswer<ServiceAskValue<K>> | null {
  const { jwt, spaceId, clientId } = target;
  const [answer, setAnswer] = useState<ShownServiceAnswer<ServiceAskValue<K>> | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const offline = Boolean(answer && 'offline' in answer && answer.offline);
  useEffect(() => (offline ? alConectar(() => setReconnects((count) => count + 1)) : undefined), [offline]);
  // Another service (or space, client, kind): nothing of the previous one may stay on screen.
  useEffect(() => {
    setAnswer(null);
    setReconnects(0);
  }, [kind, spaceId, clientId, serviceId]);
  useEffect(() => {
    if (!serviceId) return undefined;
    let alive = true;
    const asked = { jwt, spaceId, clientId };
    const kept = KEPT_KINDS.has(kind);
    void (async () => {
      const saved = kept ? await readSavedServiceAnswer<ServiceAskValue<K>>(asked, kind, serviceId) : null;
      if (alive && saved) setAnswer((current) => current ?? firstShownAnswer(saved));
      const fresh = await askService(kind, asked, serviceId);
      if (!alive) return;
      if (!kept) return setAnswer(fresh);
      const settled = settleServiceAnswer(fresh, saved, Date.now());
      setAnswer(settled.shown);
      if (settled.write) writeSavedServiceAnswer(asked, kind, serviceId, settled.write);
      if (settled.drop) dropSavedServiceAnswer(asked, kind, serviceId);
    })();
    return () => {
      alive = false;
    };
  }, [kind, jwt, spaceId, clientId, serviceId, round, reconnects]);
  return answer;
}
