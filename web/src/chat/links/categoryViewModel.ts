import type { CategoryChip, CategoryFilter, CategorySection, CategoryView, LinkCategory } from '@lilachat/shared';

/**
 * What the «Por categoría» screen draws on top of `buildCategoryView`
 * (shared): the order, the filter that still exists and the heading.
 */
export type LinkOrder = 'newest' | 'oldest';
/** In «Todas» on a phone each section shows its newest few and «Ver las N →». */
export const SECTION_PREVIEW = 3;

const REVIEW_FILTERS = new Set<CategoryFilter>(['commentBait', 'unreadable']);

/** `buildCategoryView` sorts newest first; «Más viejos» turns each section around. */
export function orderSections(sections: CategorySection[], order: LinkOrder): CategorySection[] {
  return order === 'newest' ? sections : sections.map((section) => ({ ...section, items: [...section.items].reverse() }));
}

/** A category that was merged or deleted elsewhere falls back to «Todas». */
export function validFilter(only: CategoryFilter, chips: CategoryChip[]): CategoryFilter {
  return REVIEW_FILTERS.has(only) || chips.some((chip) => chip.id === only) ? only : 'all';
}

export type FilterHeading = { kicker: string; title: string; category: LinkCategory | null };

const linksWord = (count: number) => (count === 1 ? '1 ENLACE' : `${count} ENLACES`);

/** «CATEGORÍA · 5 ENLACES» and its name; «Renombrar» and «Unir con…» only for a real category. */
export function filterHeading(only: CategoryFilter, view: CategoryView, categories: LinkCategory[]): FilterHeading {
  const shown = view.sections.reduce((sum, section) => sum + section.count, 0);
  const category = categories.find((one) => one.id === only) ?? null;
  if (category) return { kicker: `CATEGORÍA · ${linksWord(shown)}`, title: category.name, category };
  if (only === 'commentBait') return { kicker: `REVISIÓN · ${linksWord(shown)}`, title: 'Solo piden comentar', category: null };
  if (only === 'unreadable') return { kicker: `REVISIÓN · ${linksWord(shown)}`, title: 'No se pudieron leer', category: null };
  if (only === 'none') return { kicker: linksWord(shown), title: 'Sin categoría', category: null };
  return { kicker: linksWord(shown), title: 'Todas', category: null };
}
