import { useEffect, useState } from 'react';
import { readServiceAsk, serviceAskPath, type ServiceAskBody, type ServiceAskKind, type ServiceAskResult, type ServiceAskValue } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';

export type ServiceAskTarget = { jwt: string; spaceId: string; clientId: string };

/**
 * Asked when it opens, never stored (pending 121; José 30/10): agentes asks Portal in the same request. `null` while it loads.
 * A new `round` asks again keeping what is on screen (after a payment, agentes 31/10).
 */
export function useServiceAsk<K extends ServiceAskKind>(kind: K, target: ServiceAskTarget, serviceId: string | null, round = 0): ServiceAskResult<ServiceAskValue<K>> | null {
  const { jwt, spaceId, clientId } = target;
  const [answer, setAnswer] = useState<ServiceAskResult<ServiceAskValue<K>> | null>(null);
  useEffect(() => {
    if (round === 0) setAnswer(null);
    if (!serviceId) return undefined;
    let alive = true;
    void jsonCall<ServiceAskBody>(`${BASE_URL}/api${serviceAskPath(spaceId, clientId, serviceId, kind)}`, jwt).then((response) => {
      if (alive) setAnswer(readServiceAsk(kind, response.ok ? response.data : { message: response.message }));
    });
    return () => {
      alive = false;
    };
  }, [kind, jwt, spaceId, clientId, serviceId, round]);
  return answer;
}
