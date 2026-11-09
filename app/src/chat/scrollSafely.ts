import type { FlatList } from 'react-native';
import { indexInRange } from '@lilachat/shared';

type ScrollParams = { index: number; animated?: boolean; viewPosition?: number };

/**
 * `scrollToIndex` that counts the rows the list holds NOW: FlatList throws «out of range»
 * when a jump computed in one render fires after the list shrank (José 09/11, report
 * 3921979f). Out of range, nothing moves.
 */
export function scrollFlatListTo<T>(list: FlatList<T> | null, params: ScrollParams): boolean {
  const count = list?.props.data?.length ?? 0;
  if (!list || !indexInRange(params.index, count)) return false;
  list.scrollToIndex(params);
  return true;
}

/** The same guard for a list whose rows the caller knows (FlashList has no `props` on its handle). */
export function scrollWithinRows(list: { scrollToIndex: (params: ScrollParams) => unknown } | null, params: ScrollParams, rowCount: number): boolean {
  if (!list || !indexInRange(params.index, rowCount)) return false;
  void list.scrollToIndex(params);
  return true;
}
