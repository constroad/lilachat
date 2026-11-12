/**
 * Calls that overlap with the same key share one request and its answer;
 * once it settles, the next call goes out again. agentes 12/11: re-renders
 * sent the same report read 8 to 18 times a second, and its cap of 20 tool
 * calls a minute per person locked the person out of every tool.
 */
export function sharedInFlight<A extends unknown[], R>(keyOf: (...args: A) => string, call: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const flying = new Map<string, Promise<R>>();
  return (...args: A) => {
    const key = keyOf(...args);
    const running = flying.get(key);
    if (running) return running;
    const started = call(...args).finally(() => flying.delete(key));
    flying.set(key, started);
    return started;
  };
}
