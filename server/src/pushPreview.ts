import type { Router } from 'express';
import { UserModel } from './models.js';

/**
 * «Mostrar vista previa» of the notices, like WhatsApp (R31/10-B8): off, a
 * message rings with who wrote it but not what it says nor its picture, so the
 * locked screen does not read it aloud to whoever is beside the phone.
 */
export const HIDDEN_PREVIEW_BODY = 'Nuevo mensaje';

/** Who of these people turned the preview off: one read, only of the ones that did. */
export async function previewHiddenFor(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const users = await UserModel.find({ _id: { $in: userIds }, pushPreviewOff: true }).select('_id').lean();
  return new Set(users.map((user) => String(user._id)));
}

/** The notice without its content: the title (who, and the group) stays. */
export const withoutPreview = <T extends { title: string; body: string }>(text: T): T => ({ ...text, body: HIDDEN_PREVIEW_BODY });

/** A person's on/off setting stored as an «off» flag: GET and PUT `{on}` on `path`. */
export function ownSwitch(router: Router, path: string, offField: 'readReceiptsOff' | 'pushPreviewOff', refusal: string): void {
  router.get(path, async (req, res) => {
    const user = await UserModel.findById(req.session!.userId).select(offField).lean<Record<string, unknown> | null>();
    res.json({ on: user?.[offField] !== true });
  });
  router.put(path, async (req, res) => {
    if (typeof req.body?.on !== 'boolean') return res.status(400).json({ message: refusal });
    const on = req.body.on as boolean;
    await UserModel.updateOne({ _id: req.session!.userId }, on ? { $unset: { [offField]: 1 } } : { $set: { [offField]: true } });
    res.json({ on });
  });
}
