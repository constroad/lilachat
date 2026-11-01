import { describe, expect, it } from 'vitest';
import { aspectCrop, dragCrop, fitContain, handleAt, isWholeImage, nextRotation, toFraction, toPixels } from './cropMath';

/** Cropping a photo before sending it, like WhatsApp (José 01/11: «no hay forma de recortar la imagen»). */
const bounds = { x: 0, y: 100, width: 400, height: 300 };
const limits = { minSize: 60, aspect: null };

describe('where the photo sits and where the finger lands', () => {
  it('fits the photo inside the box, centered, without stretching', () => {
    expect(fitContain(4000, 3000, 400, 600)).toEqual({ x: 0, y: 150, width: 400, height: 300 });
    expect(fitContain(3000, 4000, 400, 400)).toEqual({ x: 50, y: 0, width: 300, height: 400 });
  });

  it('a corner wins over its edges; inside moves the frame; far outside is nothing', () => {
    expect(handleAt(bounds, 4, 104, 24)).toBe('tl');
    expect(handleAt(bounds, 398, 398, 24)).toBe('br');
    expect(handleAt(bounds, 200, 102, 24)).toBe('t');
    expect(handleAt(bounds, 2, 250, 24)).toBe('l');
    expect(handleAt(bounds, 200, 250, 24)).toBe('move');
    expect(handleAt(bounds, 200, 20, 24)).toBeNull();
  });
});

describe('dragging the frame', () => {
  it('a corner resizes from the opposite one and never leaves the photo', () => {
    // Act
    const smaller = dragCrop(bounds, 'tl', 50, 40, bounds, limits);
    const beyond = dragCrop(bounds, 'br', 90, 90, bounds, limits);
    // Assert
    expect(smaller).toEqual({ x: 50, y: 140, width: 350, height: 260 });
    expect(beyond).toEqual(bounds);
  });

  it('an edge moves only its side, and the frame keeps a minimum size', () => {
    expect(dragCrop(bounds, 'r', -100, 30, bounds, limits)).toEqual({ x: 0, y: 100, width: 300, height: 300 });
    expect(dragCrop(bounds, 'l', 390, 0, bounds, limits)).toEqual({ x: 340, y: 100, width: 60, height: 300 });
  });

  it('moving keeps the size and stops at the borders', () => {
    const frame = { x: 100, y: 150, width: 100, height: 100 };
    expect(dragCrop(frame, 'move', 500, -500, bounds, limits)).toEqual({ x: 300, y: 100, width: 100, height: 100 });
  });

  it('with a fixed ratio a corner keeps it, and an edge does nothing', () => {
    // Arrange
    const square = { x: 100, y: 150, width: 200, height: 200 };
    const locked = { minSize: 60, aspect: 1 };
    // Act
    const dragged = dragCrop(square, 'br', -50, 10, bounds, locked);
    // Assert
    expect(dragged.width).toBe(dragged.height);
    expect(dragged).toEqual({ x: 100, y: 150, width: 150, height: 150 });
    expect(dragCrop(square, 'r', 50, 0, bounds, locked)).toEqual(square);
  });
});

describe('ratios, rotation and the pixels that get cut', () => {
  it('a ratio takes the biggest centered frame that fits; free is the whole photo', () => {
    expect(aspectCrop(bounds, 1)).toEqual({ x: 50, y: 100, width: 300, height: 300 });
    expect(aspectCrop(bounds, 16 / 9)).toEqual({ x: 0, y: 137.5, width: 400, height: 225 });
    expect(aspectCrop(bounds, null)).toEqual(bounds);
  });

  it('rotates a quarter turn to the left each time, like WhatsApp', () => {
    expect(([0, 270, 180, 90] as const).map((rotation) => nextRotation(rotation))).toEqual([270, 180, 90, 0]);
  });

  it('the frame becomes a fraction of the photo, and the fraction becomes whole pixels inside it', () => {
    // Arrange
    const fraction = toFraction({ x: 100, y: 175, width: 200, height: 150 }, bounds);
    // Act
    const pixels = toPixels(fraction, 4000, 3000);
    // Assert
    expect(fraction).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    expect(pixels).toEqual({ originX: 1000, originY: 750, width: 2000, height: 1500 });
    expect(toPixels({ x: 0.9, y: 0.9, width: 0.2, height: 0.2 }, 1000, 1000)).toEqual({ originX: 900, originY: 900, width: 100, height: 100 });
  });

  it('nothing to do when the frame is the whole photo and it was not turned', () => {
    expect(isWholeImage({ x: 0, y: 0, width: 1, height: 1 }, 0)).toBe(true);
    expect(isWholeImage({ x: 0, y: 0, width: 1, height: 1 }, 90)).toBe(false);
    expect(isWholeImage({ x: 0.1, y: 0, width: 0.9, height: 1 }, 0)).toBe(false);
  });
});
