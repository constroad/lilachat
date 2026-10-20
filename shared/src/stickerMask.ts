import type { Point, Rect } from './stickerEditor.js';

/**
 * Erase and restore brushes over the cutout (José, 20/10: «the background was
 * not fully removed and there is no way to erase a part»; Telegram has both).
 * A stroke lives in PHOTO pixels, so it survives the cutout changing its crop;
 * the editor converts the finger (0..1 over the square sticker) with the view
 * of the current cutout: where its image sits in the sticker (`geometry`, in
 * sticker pixels) and which part of the photo it shows (`box`, photo pixels).
 */
export type MaskMode = 'erase' | 'restore';
export type MaskStroke = { mode: MaskMode; radius: number; points: Point[] };
export type CutoutView = { box: Rect; geometry: Rect; side: number };

/** Brush radius relative to the sticker side: S, M and L. */
export const BRUSH_SIZES = { S: 0.018, M: 0.035, L: 0.07 } as const;
export type BrushSize = keyof typeof BRUSH_SIZES;

/** Photo pixels per sticker pixel in the current view. */
const photoScale = (view: CutoutView) => (view.geometry.width > 0 ? view.box.width / view.geometry.width : 0);

/** A finger point (0..1 over the sticker) in photo pixels. */
export function canvasToPhoto(point: Point, view: CutoutView): Point {
  const scale = photoScale(view);
  return {
    x: view.box.x + (point.x * view.side - view.geometry.x) * scale,
    y: view.box.y + (point.y * view.side - view.geometry.y) * scale,
  };
}

/** The brush radius (relative to the sticker side) in photo pixels. */
export const brushRadiusInPhoto = (relative: number, view: CutoutView) => relative * view.side * photoScale(view);

/** A finished brush stroke, ready for the cutout: photo pixels, points closer than a pixel dropped. */
export function maskStroke(mode: MaskMode, relativeRadius: number, points: Point[], view: CutoutView): MaskStroke | null {
  if (points.length === 0 || photoScale(view) === 0) return null;
  const inPhoto: Point[] = [];
  for (const point of points.map((one) => canvasToPhoto(one, view))) {
    const last = inPhoto[inPhoto.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 1) inPhoto.push({ x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 });
  }
  return { mode, radius: Math.max(1, Math.round(brushRadiusInPhoto(relativeRadius, view))), points: inPhoto };
}

/**
 * Where the WHOLE photo sits over the sticker (0..1), aligned with the cutout:
 * with «Restaurar» the original shows faded behind, so one sees what to bring back.
 */
export function photoFrame(photo: { width: number; height: number }, view: CutoutView): Rect {
  const scale = photoScale(view);
  if (scale === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const toSide = (value: number) => value / scale / view.side;
  return {
    x: (view.geometry.x - view.box.x / scale) / view.side,
    y: (view.geometry.y - view.box.y / scale) / view.side,
    width: toSide(photo.width),
    height: toSide(photo.height),
  };
}
