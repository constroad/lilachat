import { useEffect, useState } from 'react';
import { api } from '../api';
import { isAndroid } from './installOffer';

/** Only Android asks the server: an iPhone is offered the web whatever the account has. */
export function useHasAndroidApp(jwt: string): boolean | null {
  const [hasAndroidApp, setHasAndroidApp] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isAndroid()) return;
    void api<{ hasAndroidApp: boolean }>('/me/android-app', { jwt }).then((answer) => {
      if (answer.ok) setHasAndroidApp(answer.data.hasAndroidApp);
    });
  }, [jwt]);
  return hasAndroidApp;
}
