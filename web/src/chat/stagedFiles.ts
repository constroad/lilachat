/** José 13/11: files waiting inside the composer, like Claude's input. At most this many at once. */
export const MAX_STAGED_FILES = 10;

/** More picks join the waiting ones, without repeating a file, up to the limit. PURE. */
export function stageFiles(current: readonly File[], added: readonly File[]): File[] {
  const keyOf = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;
  const seen = new Set(current.map(keyOf));
  const fresh = added.filter((file) => !seen.has(keyOf(file)) && Boolean(seen.add(keyOf(file))));
  return [...current, ...fresh].slice(0, MAX_STAGED_FILES);
}
