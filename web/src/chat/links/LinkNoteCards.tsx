import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Copy, EllipsisVertical, ExternalLink, FolderInput } from 'lucide-react';
import { useRef, type PointerEvent, type ReactNode } from 'react';
import type { LinkNoteItem } from '@lilachat/shared';
import { copiarTexto } from '../copiarTexto';
import { authorOf, dayMonthOf, LinkThumb, PlatformPill, summaryOf } from './linkCardParts';

/**
 * A saved link in the «Por categoría» view (design nl-01): a 3:4 card of the
 * grid on a computer, an 88 px row on a phone. Tap opens it; ⋮ (or a long
 * press on the phone) moves it.
 */
export type LinkCardActions = { onOpen: (item: LinkNoteItem) => void; onMove: (item: LinkNoteItem) => void; onCopied: () => void };

const LONG_PRESS_MS = 500;

function LinkCardMenu({ item, actions, revealOnHover }: { item: LinkNoteItem; actions: LinkCardActions; revealOnHover: boolean }) {
  const copy = async () => {
    if (await copiarTexto(item.link.url)) actions.onCopied();
  };
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-testid={`menu-enlace-${item.seq}`}
          aria-label="Opciones del enlace"
          onClick={(event) => event.stopPropagation()}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-outline/15 bg-surface/90 text-on-surface shadow-sm hover:border-primary focus:opacity-100 data-[state=open]:opacity-100 ${revealOnHover ? 'opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none' : ''}`}
        >
          <EllipsisVertical size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} onClick={(event) => event.stopPropagation()} className="z-40 min-w-[200px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
          <MenuRow testId="accion-enlace-mover" icon={<FolderInput size={16} />} label="Mover de categoría" onSelect={() => actions.onMove(item)} />
          <MenuRow testId="accion-enlace-abrir" icon={<ExternalLink size={16} />} label="Abrir" onSelect={() => actions.onOpen(item)} />
          <MenuRow testId="accion-enlace-copiar" icon={<Copy size={16} />} label="Copiar enlace" onSelect={() => void copy()} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuRow(props: { testId: string; icon: ReactNode; label: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item data-testid={props.testId} onSelect={props.onSelect} className="flex min-h-[40px] cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background">
      {props.icon}
      {props.label}
    </DropdownMenu.Item>
  );
}

/** The grid's card on a computer (nl-01 desktop). */
export function LinkGridCard({ item, actions }: { item: LinkNoteItem; actions: LinkCardActions }) {
  const { link } = item;
  return (
    <article data-testid={`enlace-${item.seq}`} className="group relative flex flex-col rounded-card border border-outline/15 bg-surface p-3 shadow-sm transition-colors hover:border-primary motion-reduce:transition-none">
      <div className="absolute right-4 top-4 z-10">
        <LinkCardMenu item={item} actions={actions} revealOnHover />
      </div>
      <button type="button" onClick={() => actions.onOpen(item)} className="flex flex-col text-left">
        <LinkThumb link={link} className="h-44 w-full" iconSize={22} />
        <span className="mt-3 flex items-center justify-between gap-2">
          <PlatformPill link={link} />
          <span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">{dayMonthOf(item.at)}</span>
        </span>
        <span className="mt-2 truncate text-[14px] font-bold text-on-surface">{authorOf(link)}</span>
        <span className="mt-1 line-clamp-3 text-[13px] leading-5 text-on-surface-variant">{summaryOf(link)}</span>
      </button>
    </article>
  );
}

/** A long press on the phone opens «Mover de categoría»; the tap that ends it does not open the link. */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    fired.current = false;
    cancel();
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  return { handlers: { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel }, fired };
}

/** The row on a phone (nl-01 mobile): 88 px, the thumbnail on the left. */
export function LinkRowCard({ item, actions }: { item: LinkNoteItem; actions: LinkCardActions }) {
  const { link } = item;
  const press = useLongPress(() => actions.onMove(item));
  return (
    <article data-testid={`enlace-${item.seq}`} className="flex min-h-[88px] items-start gap-3 rounded-card border border-outline/10 bg-surface p-4 shadow-sm">
      <button
        type="button"
        {...press.handlers}
        onClick={() => !press.fired.current && actions.onOpen(item)}
        onContextMenu={(event) => event.preventDefault()}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <LinkThumb link={link} className="aspect-[3/4] w-14" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <PlatformPill link={link} />
            <span className="shrink-0 text-[12px] tabular-nums text-on-surface-variant">{dayMonthOf(item.at)}</span>
          </span>
          <span className="mt-1 block truncate text-[14px] font-bold text-on-surface">{authorOf(link)}</span>
          <span className="line-clamp-2 text-[13px] leading-5 text-on-surface-variant">{summaryOf(link)}</span>
        </span>
      </button>
      <LinkCardMenu item={item} actions={actions} revealOnHover={false} />
    </article>
  );
}
