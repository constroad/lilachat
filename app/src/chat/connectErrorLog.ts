const MAX_REASON_LENGTH = 48;
const UNKNOWN_REASON = 'unknown';

/** What socket.io or the server said, with letters only: no number or address reaches a report that leaves the phone. */
export function connectErrorReason(message: string): string {
  const reason = message.replace(/[^a-zA-Z_ ]+/g, '#').slice(0, MAX_REASON_LENGTH);
  return reason.length > 0 ? reason : UNKNOWN_REASON;
}

/** One line per reason and outage: socket.io retries a lost network for hours, and the log keeps few entries. */
export function createConnectErrorLog(record: (reason: string) => void): { failed: (message: string) => void; connected: () => void } {
  const written = new Set<string>();
  return {
    failed: (message) => {
      const reason = connectErrorReason(message);
      if (written.has(reason)) return;
      written.add(reason);
      record(reason);
    },
    connected: () => written.clear(),
  };
}
