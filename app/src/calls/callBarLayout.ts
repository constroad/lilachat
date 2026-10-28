/**
 * What the call's controls show (pending 106, design c-02/c-03), pure. No
 * «add person», «share screen» or «noise cancelling»: they have no backend yet,
 * and a button that does nothing is worse than none.
 */
export type CallBarButton = 'more' | 'camera' | 'speaker' | 'mic' | 'hangup';
export type MoreOption = 'message' | 'reactions';

export function callBarButtons(canToggleVideo: boolean): CallBarButton[] {
  return canToggleVideo ? ['more', 'camera', 'speaker', 'mic', 'hangup'] : ['more', 'speaker', 'mic', 'hangup'];
}

export function moreOptions(hasChat: boolean): MoreOption[] {
  return hasChat ? ['message', 'reactions'] : ['reactions'];
}
