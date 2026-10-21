import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

/** How much an arrow key moves the edge (px). */
const KEY_STEP = 16;

/**
 * The edge between the chat list and the conversation (design
 * `n-01-web-oscuro-lista`; José, 21/10: the chat list should be draggable):
 * drag it, use the arrow keys, or double-click to go back to the
 * usual width. The parent clamps and remembers the width.
 */
export function ListResizeHandle(props: { width: number; onResize: (width: number) => void; onReset: () => void }) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Without it the drag also selects the messages it passes over.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: props.width };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) props.onResize(drag.current.startWidth + event.clientX - drag.current.startX);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') props.onResize(props.width - KEY_STEP);
    if (event.key === 'ArrowRight') props.onResize(props.width + KEY_STEP);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Cambiar el ancho de la lista de chats"
      aria-valuenow={props.width}
      tabIndex={0}
      data-testid="tirador-lista"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={props.onReset}
      onKeyDown={onKeyDown}
      className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize touch-none outline-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-outline/15 transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary" />
    </div>
  );
}
