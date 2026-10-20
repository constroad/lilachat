import { STICKER_COMPOSITION, stickerGeometry, type Layer, type Point, type Rect } from '@lilachat/shared';

/**
 * The web sticker: 512×512 with a transparent background, the image centered,
 * the white outline, text with a black stroke, emojis and pencil lines, each
 * layer rotated. The numbers come from the shared engine (`stickerGeometry`),
 * the same as the app's composition.
 */
const MAX_BYTES = 480 * 1024;
const START_QUALITY = 0.9;
const MIN_QUALITY = 0.4;
const QUALITY_STEP = 0.1;
const MIN_LETTER = 12;
/** How visible the whole photo is behind the cutout while restoring (like the app). */
const BACKDROP_OPACITY = 0.35;
/** The web font (Inter), with the system fallback. */
export const STICKER_FONT = 'Inter, system-ui, sans-serif';

type DrawnLayer = Omit<Layer, 'id'> & { id?: string };
type Image = CanvasImageSource & { width: number; height: number };

/** `backdrop`: only in the editor, with «Restaurar» — the whole photo faded where it sits (0..1 of the sticker). */
export function drawSticker(canvas: HTMLCanvasElement, image: Image, outline: boolean, layers: DrawnLayer[], backdrop?: { image: Image; frame: Rect }): void {
  const { side } = STICKER_COMPOSITION;
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, side, side);
  if (backdrop) {
    context.globalAlpha = BACKDROP_OPACITY;
    context.drawImage(backdrop.image, backdrop.frame.x * side, backdrop.frame.y * side, backdrop.frame.width * side, backdrop.frame.height * side);
    context.globalAlpha = 1;
  }
  const target = stickerGeometry({ width: image.width, height: image.height, outline });
  if (outline) drawOutline(context, image, target);
  context.drawImage(image, target.x, target.y, target.width, target.height);
  for (const layer of layers) {
    if (layer.kind === 'stroke') drawStroke(context, layer);
    else drawLetters(context, layer);
  }
}

/** The white silhouette repeated around: the thick outline of stickers. */
function drawOutline(context: CanvasRenderingContext2D, image: Image, target: { x: number; y: number; width: number; height: number }) {
  const { side, outlineRadius, outlineSteps } = STICKER_COMPOSITION;
  const silhouette = document.createElement('canvas');
  silhouette.width = side;
  silhouette.height = side;
  const brush = silhouette.getContext('2d');
  if (!brush) return;
  brush.drawImage(image, target.x, target.y, target.width, target.height);
  brush.globalCompositeOperation = 'source-in';
  brush.fillStyle = 'white';
  brush.fillRect(0, 0, side, side);
  for (let step = 0; step < outlineSteps; step += 1) {
    const angle = (2 * Math.PI * step) / outlineSteps;
    for (const radius of [outlineRadius, outlineRadius / 2]) context.drawImage(silhouette, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}

const letterSize = (layer: DrawnLayer) => Math.max(MIN_LETTER, layer.scale * STICKER_COMPOSITION.side);

function drawLetters(context: CanvasRenderingContext2D, layer: DrawnLayer) {
  if (!layer.text.trim()) return;
  const { side, textStroke } = STICKER_COMPOSITION;
  const size = letterSize(layer);
  context.save();
  context.translate(layer.x * side, layer.y * side);
  context.rotate(layer.rotation);
  context.font = `bold ${size}px ${STICKER_FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (layer.kind === 'text') {
    context.lineWidth = size * textStroke;
    context.lineJoin = 'round';
    context.strokeStyle = 'black';
    context.strokeText(layer.text, 0, 0);
  }
  context.fillStyle = layer.color;
  context.fillText(layer.text, 0, 0);
  context.restore();
}

function drawStroke(context: CanvasRenderingContext2D, layer: DrawnLayer) {
  const points = layer.points ?? [];
  if (points.length < 2) return;
  const { side } = STICKER_COMPOSITION;
  context.save();
  context.beginPath();
  context.moveTo(points[0]!.x * side, points[0]!.y * side);
  for (const point of points.slice(1)) context.lineTo(point.x * side, point.y * side);
  context.lineWidth = (layer.width ?? 0.02) * side;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = layer.color;
  context.stroke();
  context.restore();
}

/** A layer's box on the 512 canvas, before rotation: center, half width and half height. */
export function layerBox(context: CanvasRenderingContext2D, layer: DrawnLayer) {
  const size = letterSize(layer);
  context.font = `bold ${size}px ${STICKER_FONT}`;
  return { cx: layer.x * STICKER_COMPOSITION.side, cy: layer.y * STICKER_COMPOSITION.side, halfWidth: context.measureText(layer.text).width / 2, halfHeight: size / 2 };
}

/** A canvas point in the layer's own (unrotated) frame. */
export function toLayerFrame(point: Point, box: { cx: number; cy: number }, rotation: number): Point {
  const dx = point.x - box.cx;
  const dy = point.y - box.cy;
  return { x: dx * Math.cos(-rotation) - dy * Math.sin(-rotation), y: dx * Math.sin(-rotation) + dy * Math.cos(-rotation) };
}

const asBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));

/** WebP lowering the quality until it fits (Safari does not write WebP: it comes out PNG, which the server accepts too). */
export async function exportSticker(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (let quality = START_QUALITY; quality >= MIN_QUALITY - 0.001; quality -= QUALITY_STEP) {
    const file = await asBlob(canvas, quality);
    if (!file) return null;
    if (file.type !== 'image/webp' || file.size <= MAX_BYTES) return file;
  }
  return asBlob(canvas, MIN_QUALITY);
}
