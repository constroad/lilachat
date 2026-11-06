import { describe, expect, it } from 'vitest';
import { activeMobileTab, mobileTabsFor } from './mobileTabs';

describe('the phone\'s bottom bar (the APK\'s, José 06/11)', () => {
  it('has four tabs: the personal ones, or the space\'s', () => {
    expect(mobileTabsFor(false)).toEqual(['chats', 'agenda', 'encuestas', 'ajustes']);
    expect(mobileTabsFor(true)).toEqual(['chats', 'directory', 'mentions', 'ajustes']);
  });

  it('lights the open overlay, Ajustes over anything, and Chats by default', () => {
    expect(activeMobileTab({ settingsOpen: false, overlay: null })).toBe('chats');
    expect(activeMobileTab({ settingsOpen: false, overlay: 'agenda' })).toBe('agenda');
    expect(activeMobileTab({ settingsOpen: false, overlay: 'mentions' })).toBe('mentions');
    expect(activeMobileTab({ settingsOpen: true, overlay: 'agenda' })).toBe('ajustes');
    expect(activeMobileTab({ settingsOpen: false, overlay: 'chat' })).toBe('chats');
  });
});
