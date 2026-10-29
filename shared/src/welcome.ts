/**
 * The welcome «¿Cómo vas a usar Lilachat?» (design `e-01`, pending 5): the
 * first screen after the code, once. Only a new account sees it: someone who
 * already has chats or a space skips it for good, so an update does not greet
 * the people who were already using the app. PURE.
 */
export type WelcomeGate = 'wait' | 'show' | 'skip';

export function welcomeGate(input: {
  /** `undefined` = not read from the phone yet; `null` = never shown; `true` = done. */
  seen: boolean | null | undefined;
  /** The spaces I am in, any status; `null` while they load. */
  spaces: readonly unknown[] | null | undefined;
  /** My personal chats; `null` while the list loads. */
  personalChats: number | null;
}): WelcomeGate {
  if (input.seen === undefined) return 'wait';
  if (input.seen === true) return 'skip';
  // An answer without the list (an older server, a broken reply) is not «no spaces».
  if (!Array.isArray(input.spaces) || input.personalChats === null) return 'wait';
  return input.spaces.length > 0 || input.personalChats > 0 ? 'skip' : 'show';
}
