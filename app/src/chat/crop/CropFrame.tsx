import { View } from 'react-native';
import type { Rect } from './cropMath';

const CORNER_LENGTH = 22;
const CORNER_THICKNESS = 3;
const SHADE = 'rgba(0,0,0,0.6)';
const GRID = 'rgba(255,255,255,0.45)';
const THIRDS = [1 / 3, 2 / 3];

/** What is left out goes dark, the frame shows its thirds and four corners to grab, like WhatsApp. Draws only: the touch is the parent's. */
export function CropFrame(props: { crop: Rect; bounds: Rect }) {
  const { crop, bounds } = props;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const shades: Rect[] = [
    { x: bounds.x, y: bounds.y, width: bounds.width, height: crop.y - bounds.y },
    { x: bounds.x, y: bottom, width: bounds.width, height: bounds.y + bounds.height - bottom },
    { x: bounds.x, y: crop.y, width: crop.x - bounds.x, height: crop.height },
    { x: right, y: crop.y, width: bounds.x + bounds.width - right, height: crop.height },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {shades.map((shade, index) => (
        <View key={index} style={{ position: 'absolute', left: shade.x, top: shade.y, width: Math.max(0, shade.width), height: Math.max(0, shade.height), backgroundColor: SHADE }} />
      ))}
      <View testID="marco-de-recorte" style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.width, height: crop.height, borderWidth: 1, borderColor: 'white' }}>
        {THIRDS.map((third) => (
          <View key={`v${third}`} style={{ position: 'absolute', left: crop.width * third, top: 0, bottom: 0, width: 1, backgroundColor: GRID }} />
        ))}
        {THIRDS.map((third) => (
          <View key={`h${third}`} style={{ position: 'absolute', top: crop.height * third, left: 0, right: 0, height: 1, backgroundColor: GRID }} />
        ))}
      </View>
      {cornerBars(crop).map((bar, index) => (
        <View key={`c${index}`} style={{ position: 'absolute', left: bar.x, top: bar.y, width: bar.width, height: bar.height, backgroundColor: 'white' }} />
      ))}
    </View>
  );
}

/** Two bars per corner, drawn just outside the frame's line. */
function cornerBars(crop: Rect): Rect[] {
  const left = crop.x - CORNER_THICKNESS;
  const top = crop.y - CORNER_THICKNESS;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const endX = right + CORNER_THICKNESS - CORNER_LENGTH;
  const endY = bottom + CORNER_THICKNESS - CORNER_LENGTH;
  const across = { width: CORNER_LENGTH, height: CORNER_THICKNESS };
  const down = { width: CORNER_THICKNESS, height: CORNER_LENGTH };
  return [
    { x: left, y: top, ...across },
    { x: left, y: top, ...down },
    { x: endX, y: top, ...across },
    { x: right, y: top, ...down },
    { x: left, y: bottom, ...across },
    { x: left, y: endY, ...down },
    { x: endX, y: bottom, ...across },
    { x: right, y: endY, ...down },
  ];
}
