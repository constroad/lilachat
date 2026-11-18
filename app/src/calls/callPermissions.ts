import { PermissionsAndroid, Platform } from 'react-native';

/** Microphone, and the camera for a video call; outside Android there is nothing to ask. */
export async function requestCallPermissions(withVideo: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const needed = withVideo
    ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]
    : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const granted = await PermissionsAndroid.requestMultiple(needed);
  return needed.every((permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED);
}
