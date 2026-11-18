import { FolderOpen, Plus, RotateCw } from 'lucide-react';

/** Loading, empty and failed states of «Por categoría», with the geometry of what comes. */
const SKELETON_RAIL_ROWS = 8;
const SKELETON_CARDS = 6;
const SKELETON_ROWS = 4;

export function LinksSkeleton({ wide }: { wide: boolean }) {
  if (wide) {
    return (
      <div data-testid="enlaces-cargando" className="flex min-h-0 flex-1 bg-background motion-safe:animate-pulse">
        <div className="w-[240px] shrink-0 space-y-2 border-r border-outline/15 bg-surface px-3 py-4">
          {Array.from({ length: SKELETON_RAIL_ROWS }, (_, index) => <div key={index} className="h-9 rounded-thumb bg-on-surface/5" />)}
        </div>
        <div className="flex-1 p-6">
          <div className="h-10 max-w-[420px] rounded-card bg-on-surface/5" />
          <div className="mt-6 h-8 w-64 rounded-lg bg-on-surface/5" />
          <div className="mt-6 grid grid-cols-2 gap-5 xl:grid-cols-3">
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className="aspect-[3/5] rounded-card bg-on-surface/5" />)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="enlaces-cargando" className="min-h-0 flex-1 space-y-3 bg-background px-4 py-3 motion-safe:animate-pulse">
      <div className="h-[50px] rounded-card bg-on-surface/5" />
      <div className="flex gap-2">{[0, 1, 2].map((index) => <div key={index} className="h-9 w-28 shrink-0 rounded-card bg-on-surface/5" />)}</div>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => <div key={index} className="h-[88px] rounded-card bg-on-surface/5" />)}
    </div>
  );
}

export function LinksEmpty({ onCompose }: { onCompose: () => void }) {
  return (
    <div data-testid="enlaces-vacio" className="grid min-h-0 flex-1 place-items-center bg-background px-6 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FolderOpen size={26} aria-hidden />
        </span>
        <p className="mt-4 text-[16px] font-bold text-on-surface">Todavía no hay enlaces guardados</p>
        <p className="mt-1 text-[14px] text-on-surface-variant">Comparte un reel o pega un enlace en el chat.</p>
        <button type="button" onClick={onCompose} className="mt-5 inline-flex h-11 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-on-primary">
          <Plus size={18} aria-hidden /> Ir al chat
        </button>
      </div>
    </div>
  );
}

export function LinksError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div data-testid="enlaces-error" className="grid min-h-0 flex-1 place-items-center bg-background px-6 text-center">
      <div className="max-w-xs">
        <p className="text-[16px] font-bold text-on-surface">No se pudieron traer tus enlaces</p>
        {message ? <p className="mt-1 text-[14px] text-on-surface-variant">{message}</p> : null}
        <button type="button" data-testid="btn-reintentar-enlaces" onClick={onRetry} className="mt-5 inline-flex h-11 items-center gap-2 rounded-card border border-outline/30 bg-surface px-4 text-sm font-semibold text-on-surface hover:bg-background">
          <RotateCw size={16} aria-hidden /> Reintentar
        </button>
      </div>
    </div>
  );
}
