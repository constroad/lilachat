/**
 * What the call's controls show (pending 106, design c-02/c-03), pure. No
 * «add person»: it has no backend yet, and a button that does nothing is worse
 * than none. «Compartir pantalla» only in a video call with the camera on
 * (APK 0.1.175). Noise cancelling is a switch in «Más opciones» (pending 3).
 */
export type CallBarButton = 'more' | 'camera' | 'speaker' | 'mic' | 'hangup';
export type MoreOption = 'message' | 'screen' | 'reactions';

export function callBarButtons(canToggleVideo: boolean): CallBarButton[] {
  return canToggleVideo ? ['more', 'camera', 'speaker', 'mic', 'hangup'] : ['more', 'speaker', 'mic', 'hangup'];
}

export function moreOptions(hasChat: boolean, canShareScreen = false): MoreOption[] {
  return [...(hasChat ? (['message'] as const) : []), ...(canShareScreen ? (['screen'] as const) : []), 'reactions'];
}

/**
 * Which videos a 1:1 video call shows. José 13/11: turning MY camera off hid the other's video too,
 * because one flag said both «video call» and «my camera on». PURE.
 */
export function callVideos(params: { video: boolean; cameraOn: boolean; remote: boolean; local: boolean }): { remote: boolean; local: boolean } {
  return { remote: params.video && params.remote, local: params.video && params.cameraOn && params.local };
}
