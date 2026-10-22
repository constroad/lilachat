import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { callLinkTokenOf } from '@lilachat/shared';
import { useLlamadas } from '../../calls/ProveedorDeLlamadas';
import { requestOpenChat } from '../../ui/openChatRequest';
import { followCallLink } from './callLinks';

/**
 * Follows a call link that opened the app (pending 42): `…/llamada/<token>`,
 * by App Links. Inside the calls provider, so it can call. By refs: renewing
 * the session must not follow the link that opened the app a second time.
 */
export function CallLinkOpener({ jwt }: { jwt: string }) {
  const { llamar } = useLlamadas();
  const latest = useRef({ jwt, llamar });
  latest.current = { jwt, llamar };
  useEffect(() => {
    const follow = (url: string | null) => {
      const linkToken = callLinkTokenOf(url);
      if (linkToken) void followCallLink({ jwt: latest.current.jwt, linkToken, openChat: requestOpenChat, call: (chatId, name, video) => latest.current.llamar(chatId, name, video) });
    };
    void Linking.getInitialURL().then(follow);
    const subscription = Linking.addEventListener('url', (event) => follow(event.url));
    return () => subscription.remove();
  }, []);
  return null;
}
