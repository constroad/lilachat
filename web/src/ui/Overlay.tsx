import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * La ventana modal de la web: una sola, para todo lo que se crea.
 *
 * El cierre es lo último que se sacrifica —`shrink-0`, 44 px de área táctil— y
 * además responde a Escape y al clic en el fondo. Un modal sin salida visible
 * en el celular deja al usuario tocando el botón de atrás, que cierra la
 * pestaña entera.
 */
export function Overlay({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        data-testid="overlay"
        role="dialog"
        aria-label={title}
        onClick={(evento) => evento.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <header className="flex items-center gap-2 border-b border-outline/15 px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            data-testid="btn-cerrar-overlay"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? <div className="border-t border-outline/15 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** El botón principal de los formularios de creación. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-full place-items-center rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** El texto de error de un formulario, siempre debajo de lo que falló. */
export function FieldError({ children }: { children: ReactNode }) {
  return children ? (
    <p data-testid="error-formulario" className="mt-1 text-[12px] leading-4 text-error">
      {children}
    </p>
  ) : null;
}
