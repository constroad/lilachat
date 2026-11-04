import { describe, expect, it, vi } from 'vitest';
import { connectErrorReason, createConnectErrorLog } from './connectErrorLog';

describe('connectErrorReason', () => {
  it('what the server and socket.io say passes as it is', () => {
    // Arrange / Act / Assert
    expect(connectErrorReason('unauthorized')).toBe('unauthorized');
    expect(connectErrorReason('update_required')).toBe('update_required');
    expect(connectErrorReason('websocket error')).toBe('websocket error');
  });

  it('a number or an address does not reach the Diagnóstico report', () => {
    // Arrange
    const message = 'refused 902049935 at https://10.0.2.2:3000/socket';
    // Act
    const reason = connectErrorReason(message);
    // Assert
    expect(reason).not.toMatch(/\d/);
    expect(reason).not.toContain('/');
    expect(reason).toContain('refused');
  });

  it('a very long message is cut', () => {
    // Arrange / Act / Assert
    expect(connectErrorReason('x'.repeat(500)).length).toBeLessThanOrEqual(48);
  });

  it('an empty message still says something', () => {
    // Arrange / Act / Assert
    expect(connectErrorReason('')).toBe('unknown');
  });
});

/** socket.io retries a lost network for hours: one line per outage, not one per attempt. */
describe('createConnectErrorLog', () => {
  it('the same reason is written once until the socket connects', () => {
    // Arrange
    const record = vi.fn();
    const log = createConnectErrorLog(record);
    // Act
    log.failed('websocket error');
    log.failed('websocket error');
    log.failed('websocket error');
    // Assert
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('websocket error');
  });

  it('a new reason in the same outage is written', () => {
    // Arrange
    const record = vi.fn();
    const log = createConnectErrorLog(record);
    // Act
    log.failed('websocket error');
    log.failed('unauthorized');
    // Assert
    expect(record.mock.calls).toEqual([['websocket error'], ['unauthorized']]);
  });

  it('after connecting, the next outage is written again', () => {
    // Arrange
    const record = vi.fn();
    const log = createConnectErrorLog(record);
    log.failed('unauthorized');
    // Act
    log.connected();
    log.failed('unauthorized');
    // Assert
    expect(record).toHaveBeenCalledTimes(2);
  });
});
