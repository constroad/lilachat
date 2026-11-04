import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/** Android's back goes where the screen's arrow goes, instead of closing the app in the middle of signing in. */
export function useHardwareBack(onBack: (() => void) | undefined): void {
  useEffect(() => {
    if (!onBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
}
