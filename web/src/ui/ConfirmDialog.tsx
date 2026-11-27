import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  title: string;
  /** What happens and what does not, in one or two sentences. */
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** While the action runs: the buttons wait, so a double click acts once. */
  busy?: boolean;
};

/**
 * The app's own question before something that cannot be undone (José 27/11: the browser's `window.confirm` froze
 * the tab). It sits over any `Overlay`, and its Escape closes only it: the form under it stays open.
 */
export function ConfirmDialog(props: Props) {
  const { onCancel } = props;
  useEffect(() => {
    // Capture on the window runs before the Overlay's listener, and stopping it there keeps the form open.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div data-testid="fondo-confirmacion" className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
        <h2 className="text-base font-bold tracking-tight">{props.title}</h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{props.text}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" data-testid="btn-cancelar-confirmacion" disabled={props.busy} onClick={onCancel} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background disabled:opacity-60">
            Cancelar
          </button>
          <button type="button" data-testid="btn-confirmar" disabled={props.busy} onClick={props.onConfirm} autoFocus className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-error text-sm font-semibold text-white disabled:opacity-60">
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
