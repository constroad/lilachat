import { describe, expect, it } from 'vitest';
import { broadcastStatus, isPresenceMode, presenceLine } from './presenceMode.js';

describe('presence mode (pending 15)', () => {
  it('away and busy travel as a status; auto says nothing more; invisible never goes out', () => {
    // Arrange / Act / Assert
    expect(broadcastStatus('away')).toBe('away');
    expect(broadcastStatus('busy')).toBe('busy');
    expect(broadcastStatus('auto')).toBeUndefined();
    expect(broadcastStatus('invisible')).toBeUndefined();
  });

  it('the line under the name: online, away or busy; offline says nothing here', () => {
    expect(presenceLine({ online: true })).toBe('En línea');
    expect(presenceLine({ online: true, status: 'away' })).toBe('Ausente');
    expect(presenceLine({ online: true, status: 'busy' })).toBe('Ocupado');
    expect(presenceLine({ online: false, status: 'busy' })).toBeNull();
  });

  it('only the four modes are valid', () => {
    expect(isPresenceMode('invisible')).toBe(true);
    expect(isPresenceMode('offline')).toBe(false);
    expect(isPresenceMode(undefined)).toBe(false);
  });
});
