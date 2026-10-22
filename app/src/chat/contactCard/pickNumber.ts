/** A phone book contact's number to share (pending 9): the mobile one, or the first with digits. */
export function pickContactNumber(numbers: readonly { number?: string; label?: string }[] | undefined): string | null {
  const usable = (numbers ?? []).filter((one) => /\d/.test(one.number ?? ''));
  const mobile = usable.find((one) => /mobile|m[oó]vil|celular/i.test(one.label ?? ''));
  return (mobile ?? usable[0])?.number ?? null;
}
