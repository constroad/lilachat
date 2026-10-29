/**
 * What the call's controls show (pending 106, design c-02/c-03), pure. No
 * «add person» and, on the phone, no «share screen»: they have no backend yet
 * (screen sharing needs the APK 0.1.175), and a button that does nothing is
 * worse than none. Noise cancelling is a switch in «Más opciones» (pending 3).
 */
export type CallBarButton = 'more' | 'camera' | 'speaker' | 'mic' | 'hangup';
export type MoreOption = 'message' | 'reactions';

export function callBarButtons(canToggleVideo: boolean): CallBarButton[] {
  return canToggleVideo ? ['more', 'camera', 'speaker', 'mic', 'hangup'] : ['more', 'speaker', 'mic', 'hangup'];
}

export function moreOptions(hasChat: boolean): MoreOption[] {
  return hasChat ? ['message', 'reactions'] : ['reactions'];
}
