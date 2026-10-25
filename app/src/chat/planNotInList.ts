export type NotInListPlan = 'fetch' | 'ignore' | 'report';

/**
 * What to do when the message to jump to is not in the loaded rows. The opening
 * places the list more than once (onLoad, then once it settled), so the repeat of a
 * jump whose window is already being fetched must stay silent: reporting it printed
 * an error that nothing clears, although the message showed up a moment later.
 * `busy` is any request in flight; `fetchingSeq` is the message whose window it is.
 */
export function planNotInList(input: { encrypted: boolean; busy: boolean; fetchingSeq: number | null; seq: number }): NotInListPlan {
  if (input.encrypted) return 'report';
  if (!input.busy) return 'fetch';
  return input.fetchingSeq === input.seq ? 'ignore' : 'report';
}
