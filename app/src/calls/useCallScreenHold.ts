import { useEffect, useRef } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createScreenHold } from '../ui/screenHold';

/** Its own tag: a voice note or the updater letting go of theirs does not lock a call. */
const CALL_KEEP_AWAKE_TAG = 'call';

/** The screen stays on while `holding`, also with the call minimized under its pill (José, 04/11). */
export function useCallScreenHold(holding: boolean): void {
  const screen = useRef(createScreenHold(CALL_KEEP_AWAKE_TAG, { activate: activateKeepAwakeAsync, deactivate: deactivateKeepAwake }));
  useEffect(() => {
    if (!holding) return;
    const { current } = screen;
    current.hold();
    return () => current.release();
  }, [holding]);
}
