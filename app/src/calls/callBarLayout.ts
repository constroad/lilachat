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
