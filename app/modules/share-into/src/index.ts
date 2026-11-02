import { requireOptionalNativeModule } from 'expo';

/**
 * What another app shared into Lilachat (José, 02/11/2026: YouTube, Instagram,
 * TikTok and Facebook did not list it). The native side reads Android's SEND
 * and SEND_MULTIPLE; `onShare` only says there is one, and `takePendingShare`
 * takes it once.
 *
 * `requireOptionalNativeModule`: a build without the module (an APK older than
 * 0.1.176 running this JS by OTA) simply never shares.
 */
export type NativeShare = {
  text: string | null;
  subject: string | null;
  files: { uri: string; mimeType: string | null; name: string | null; size: number | null }[];
};

type ShareIntoNative = {
  takePending(): NativeShare | null;
  addListener(event: 'onShare', listener: () => void): { remove(): void };
};

const native = requireOptionalNativeModule<ShareIntoNative>('ShareInto');

export function takePendingShare(): NativeShare | null {
  try {
    return native?.takePending() ?? null;
  } catch {
    // A native failure loses this share, never the app.
    return null;
  }
}

export function onShareArrived(listener: () => void): () => void {
  const subscription = native?.addListener('onShare', listener);
  return () => subscription?.remove();
}
