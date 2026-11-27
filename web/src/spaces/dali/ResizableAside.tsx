import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';

/**
 * A side column of Dali on a computer that the seller sizes by dragging its inner edge and folds to a thin rail
 * (José 26/11: «los paneles de derecha e izquierda deberíamos de poder moverlos»). Width and folded state are kept
 * per browser, by `storageKey`; storage that fails only means the defaults.
 */
export interface ResizableAsideProps {
  storageKey: string;
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** What the folded rail says on hover and to a screen reader: «Mostrar la lista», «Mostrar la ficha». */
  label: string;
  testId?: string;
  className?: string;
  /** Folded as the parent says (dp-01b: a folded ficha moves its parts to the header); otherwise as kept in the browser. */
  folded?: boolean;
  onFolded?: (folded: boolean) => void;
  children: ReactNode;
}

type Stored = { width: number; folded: boolean };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function readStored(key: string, fallback: Stored, min: number, max: number): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Stored> | null;
    if (!raw) return fallback;
    return { width: typeof raw.width === 'number' ? clamp(raw.width, min, max) : fallback.width, folded: raw.folded === true };
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: Stored): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private window or blocked storage: the column still works, it just forgets.
  }
}

export function ResizableAside(props: ResizableAsideProps) {
  const { storageKey, side, minWidth, maxWidth } = props;
  const [state, setState] = useState<Stored>(() => readStored(storageKey, { width: props.defaultWidth, folded: false }, minWidth, maxWidth));
  const drag = useRef<{ x: number; width: number } | null>(null);
  const { onFolded } = props;
  const folded = props.folded ?? state.folded;
  const save = useCallback((next: Stored) => {
    setState(next);
    writeStored(storageKey, next);
    onFolded?.(next.folded);
  }, [storageKey, onFolded]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, width: state.width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.x;
    // The width is read NOW: the update runs at render, after a quick release already cleared the drag (José 26/11).
    const width = clamp(drag.current.width + (side === 'left' ? delta : -delta), minWidth, maxWidth);
    setState((current) => ({ ...current, width }));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setState((current) => {
      writeStored(storageKey, current);
      return current;
    });
  };

  const border = side === 'left' ? 'border-r' : 'border-l';
  if (folded) {
    const Icon = side === 'left' ? ChevronRight : ChevronLeft;
    return (
      <aside data-testid={props.testId ? `${props.testId}-plegada` : undefined} className={`flex w-9 shrink-0 flex-col items-center ${border} border-outline/15 bg-list pt-3`}>
        <button type="button" aria-label={props.label} title={props.label} onClick={() => save({ ...state, folded: false })} className="grid h-8 w-8 place-items-center rounded-lg text-on-surface-variant hover:bg-background hover:text-on-surface">
          <Icon size={18} />
        </button>
      </aside>
    );
  }
  const FoldIcon = side === 'left' ? ChevronLeft : ChevronRight;
  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Arrastra para cambiar el ancho"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => save({ width: props.defaultWidth, folded: false })}
      className={`absolute inset-y-0 ${side === 'left' ? '-right-1' : '-left-1'} z-10 w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/40`}
    />
  );
  return (
    <aside data-testid={props.testId} style={{ width: state.width }} className={`relative flex shrink-0 flex-col ${border} border-outline/15 ${props.className ?? ''}`}>
      <button type="button" aria-label="Ocultar este panel" title="Ocultar este panel" onClick={() => save({ ...state, folded: true })} className={`absolute top-2 ${side === 'left' ? 'right-2' : 'left-2'} z-10 grid h-7 w-7 place-items-center rounded-lg text-on-surface-variant opacity-60 hover:bg-background hover:opacity-100`}>
        <FoldIcon size={16} />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">{props.children}</div>
      {handle}
    </aside>
  );
}
