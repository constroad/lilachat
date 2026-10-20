import { Component, type ErrorInfo, type ReactNode } from 'react';

type BoundaryProps = { label: string; children: ReactNode; fallback: (reset: () => void) => ReactNode };

/**
 * A render error inside a piece no longer blanks the whole web (backlog 4,
 * José 20/10: closing a thread left the page white until reloading). The
 * error goes to the console with the piece's name, so it can be read there.
 */
class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[lilachat] ${this.props.label} failed to render`, error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** A side panel (the thread, the info): if it fails, it says so and can be closed; the chat stays. */
export function PanelBoundary(props: { label: string; onClose: () => void; children: ReactNode }) {
  const close = (reset: () => void) => {
    reset();
    props.onClose();
  };
  return (
    <Boundary
      label={props.label}
      fallback={(reset) => (
        <aside role="alert" className="flex flex-col items-center justify-center gap-3 border-l border-outline/15 bg-background p-6 text-center lg:w-[400px] lg:shrink-0">
          <p className="text-[14px] text-on-surface">No se pudo mostrar {props.label}.</p>
          <button type="button" onClick={() => close(reset)} className="min-h-[44px] rounded-xl bg-primary px-5 font-semibold text-on-primary">
            Cerrar
          </button>
        </aside>
      )}
    >
      {props.children}
    </Boundary>
  );
}

/** The last net: the app shows a message with «Recargar» instead of a white page. */
export function AppBoundary({ children }: { children: ReactNode }) {
  return (
    <Boundary
      label="la app"
      fallback={() => (
        <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <p className="text-[15px] text-on-surface">Algo falló al mostrar Lilachat.</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-[44px] rounded-xl bg-primary px-5 font-semibold text-on-primary">
            Recargar
          </button>
        </main>
      )}
    >
      {children}
    </Boundary>
  );
}
