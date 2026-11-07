import { useCallback, useRef } from 'react';
import { cameraStampOf, type FormPhotoStamp, type GeoPoint } from '@lilachat/shared';
import { freshPoint } from '../location/freshPoint';

/** The upload never waits longer for the GPS: the photo is on screen and its hour is what counts. */
const PLACE_WAIT_MS = 2500;

/**
 * Where a camera shot was taken (José 06/11: date, hour and place, without the wait). The reading
 * starts when the camera opens, so it is usually there by the shutter; without it, the hour goes alone.
 */
export function useCameraPlace() {
  const reading = useRef<Promise<GeoPoint | null>>(Promise.resolve(null));
  const start = useCallback(() => {
    reading.current = freshPoint().catch(() => null);
  }, []);
  const stamp = useCallback(async (): Promise<FormPhotoStamp> => {
    const giveUp = new Promise<null>((resolve) => setTimeout(() => resolve(null), PLACE_WAIT_MS));
    return cameraStampOf(await Promise.race([reading.current, giveUp]));
  }, []);
  return { start, stamp };
}
