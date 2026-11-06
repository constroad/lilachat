/** The row of a reply in the thread as it is NOW: a scroll that runs later never trusts an index it kept. */
export function replyRowOf(rows: readonly { seq?: number; pending?: boolean }[], seq: number | undefined): number {
  if (seq === undefined) return -1;
  return rows.findIndex((row) => row.pending !== true && row.seq === seq);
}
