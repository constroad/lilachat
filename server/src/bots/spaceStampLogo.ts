import sharp from 'sharp';
import type { Types } from 'mongoose';
import { WorkspaceModel } from '../workspaceModels.js';
import { readMediaBytes } from '../mediaClient.js';
import type { StampLogo } from './photoStamp.js';

/**
 * The space's logo inside a photo's stamp (José 12/11: with its chip on in the camera). Read and
 * squared once per space for a while: a field crew takes dozens of photos in a row. No logo, or one
 * that cannot be read, is no logo: the photo is never held for it.
 */
const LOGO_PX = 256;
const REMEMBER_MS = 10 * 60_000;
const known = new Map<string, { logo: StampLogo; until: number }>();

async function readLogo(workspaceId: Types.ObjectId): Promise<StampLogo> {
  const space = await WorkspaceModel.findById(workspaceId).select('logoUrl').lean();
  if (!space?.logoUrl) return null;
  const bytes = await readMediaBytes(space.logoUrl);
  if (!bytes) return null;
  const png = await sharp(bytes).resize(LOGO_PX, LOGO_PX, { fit: 'cover' }).png().toBuffer();
  return { dataUri: `data:image/png;base64,${png.toString('base64')}` };
}

export async function spaceStampLogo(workspaceId: Types.ObjectId | undefined | null, now = Date.now()): Promise<StampLogo> {
  if (!workspaceId) return null;
  const key = String(workspaceId);
  const hit = known.get(key);
  if (hit && hit.until > now) return hit.logo;
  try {
    const logo = await readLogo(workspaceId);
    known.set(key, { logo, until: now + REMEMBER_MS });
    return logo;
  } catch (error) {
    console.warn('[sello] sin logo del espacio:', error instanceof Error ? error.message : error);
    return null;
  }
}
