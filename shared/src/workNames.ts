/**
 * One work name, folded: «Imprimación», « IMPRIMACION » and «imprimacion» are the same work; no case,
 * accents, repeated spaces nor quote style. «Asfaltado» and «Colocación» stay apart. PURE, no locale.
 */
export function foldWorkName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[“”″'’]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}
