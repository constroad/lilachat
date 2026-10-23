import { winkById } from '@lilachat/shared';
import { WINK_IMAGES } from './winkImages';

/** A wink's tile for the chat list (pending 57): the character, or the piece of a wink without one. */
export function winkTileSource(winkId: string | undefined): number | undefined {
  const wink = winkById(winkId);
  if (!wink || wink.kind !== 'character') return undefined;
  return WINK_IMAGES[wink.tile ?? wink.id]?.tile;
}
