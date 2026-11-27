import { createContext, type ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { LEVEL_LABEL, STAGE_LABEL, levelOf, originOf, shownStageOf, type ProspectStage, type ProspectView } from '@lilachat/shared';

/**
 * The small pieces every Dali screen shares (dl-01 to dl-13): the state pills, the kicker over each block, the seller's
 * initials, the segmented control and the skeleton rows. Only tokens: the company's color is the accent, never a hex.
 */

/** The wide inbox shows the ficha in its third column: the strip over the conversation then has no «Ficha» button. */
export const SheetInColumn = createContext(false);
/** Unfolds the ficha's column when it is folded (dp-01b); null where there is no column to unfold. */
export const ShowSheetColumn = createContext<(() => void) | null>(null);

export type PillTone = 'neutral' | 'primary' | 'ok' | 'warn' | 'error' | 'info';

const PILL_TONE: Record<PillTone, string> = {
  neutral: 'border-outline/30 bg-surface-variant/50 text-on-surface-variant',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  warn: 'border-warning/30 bg-warning/10 text-warning',
  error: 'border-error/30 bg-error/10 text-error',
  info: 'border-secondary/30 bg-secondary/10 text-secondary',
};

const SHRINK_CLASS = { none: 'shrink-0', last: 'min-w-0', first: 'min-w-0 shrink-[100]' } as const;

/**
 * `shrink`: a pill that gives way with «…» instead of pushing what follows out of the row. `first` gives way before
 * every other one (the origin, so the stage stays whole); `true`, only after it.
 */
export function Pill({ tone = 'neutral', children, testId, shrink }: { tone?: PillTone; children: ReactNode; testId?: string; shrink?: boolean | 'first' }) {
  const give = shrink === 'first' ? 'first' : shrink ? 'last' : 'none';
  return (
    <span data-testid={testId} className={`inline-flex h-6 items-center whitespace-nowrap rounded-md border px-2 text-[11px] font-bold uppercase tracking-wide ${SHRINK_CLASS[give]} ${PILL_TONE[tone]}`}>
      <span className={shrink ? 'truncate' : ''}>{children}</span>
    </span>
  );
}

const LEVEL_TONE = { hot: 'primary', warm: 'warn', cold: 'neutral' } as const;

/** «86 · CALIENTE»: violet when hot, ochre when warm (dl-11 note: hot never in ochre). */
export function ScorePill({ score }: { score?: number }) {
  const level = levelOf(score);
  if (score === undefined || !level) return null;
  return <Pill tone={LEVEL_TONE[level]} testId="pastilla-puntaje">{`${score} · ${LEVEL_LABEL[level]}`}</Pill>;
}

const STAGE_TONE: Record<ProspectStage, PillTone> = { missing_info: 'neutral', to_quote: 'warn', visit: 'info', quoted: 'info', negotiation: 'primary', won: 'ok', lost: 'error' };

/** The stage with the funnel's names (dl-08); a plain question says «Solo consulta» (Stitch's «SOLICITUD» does not go). */
export function StagePill({ prospect }: { prospect: ProspectView }) {
  const stage = shownStageOf(prospect);
  if (stage === 'missing_info' && prospect.intent === 'information') return <Pill shrink testId="pastilla-etapa">Solo consulta</Pill>;
  return <Pill shrink tone={STAGE_TONE[stage]} testId="pastilla-etapa">{STAGE_LABEL[stage]}</Pill>;
}

/** Meta (a paid ad: Facebook and Instagram are not told apart yet) or Directo. */
export const OriginPill = ({ prospect, shrink }: { prospect: ProspectView; shrink?: 'first' }) => <Pill shrink={shrink}>{originOf(prospect).label}</Pill>;

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant ${className}`}>{children}</p>;
}

/** What `initialsOf` gives a name without letters: a prospect that is still only a phone number. */
const NO_INITIALS = '·';

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || NO_INITIALS;

const AVATAR_SIZE = { sm: 'h-8 w-8 text-[12px]', md: 'h-9 w-9 text-[13px]', lg: 'h-10 w-10 text-[14px]', xl: 'h-12 w-12 text-base' } as const;

/** A prospect's circle: its initials, or a phone while it has no name yet (dl-01 v3: «+51 912 554 018 · Sin registrar»). */
export function ProspectAvatar({ name, size = 'md' }: { name: string; size?: keyof typeof AVATAR_SIZE }) {
  const initials = initialsOf(name);
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary ${AVATAR_SIZE[size]}`}>{initials === NO_INITIALS ? <Phone size={size === 'xl' ? 20 : 15} /> : initials}</span>;
}

/** The seller who attends it, as initials in a ring. */
export function Initials({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span title={name} aria-label={`Atiende ${name}`} style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-bold text-primary">
      {initialsOf(name)}
    </span>
  );
}

/** `unread`: how many of its chats have something unread (José 25/11), drawn as a badge. */
export type Segment<K extends string> = { key: K; label: string; count?: number; unread?: number };

/** «Míos 7 · Sin asignar 3 · Todos 148» (dl-01) and the funnel's periods: one choice, the active one filled. */
export function Segmented<K extends string>({ segments, value, onChange, testId }: { segments: Segment<K>[]; value: K; onChange: (key: K) => void; testId?: string }) {
  return (
    <div role="tablist" data-testid={testId} className="flex rounded-xl bg-surface-variant/60 p-1">
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          role="tab"
          aria-selected={segment.key === value}
          data-testid={`${testId ?? 'segmento'}-${segment.key}`}
          onClick={() => onChange(segment.key)}
          className={`h-9 min-w-0 flex-1 truncate rounded-lg px-2 text-[13px] font-semibold transition-colors ${segment.key === value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          {segment.label}
          {segment.count !== undefined ? <span className="ml-1.5 tabular-nums">{segment.count}</span> : null}
          {segment.unread ? <span data-testid={`${testId ?? 'segmento'}-${segment.key}-sin-leer`} aria-label={`${segment.unread} con mensajes sin leer`} className="ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 align-middle text-[11px] font-bold text-on-primary">{segment.unread}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Rows of the right height while the first load is on its way (a spinner says nothing about what comes). */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div data-testid="esqueleto-prospectos" className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-[104px] animate-pulse rounded-xl border border-outline/15 bg-surface-variant/40" />
      ))}
    </div>
  );
}

/** A quiet block that says why something is empty, and what makes it fill. */
export function EmptyNote({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div data-testid="vacio-dali" className="rounded-xl border border-dashed border-outline/30 px-4 py-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {children ? <p className="mt-1 text-[13px] text-on-surface-variant">{children}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function TextButton({ children, onClick, testId, tone = 'primary' }: { children: ReactNode; onClick: () => void; testId?: string; tone?: 'primary' | 'neutral' }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold hover:bg-background ${tone === 'primary' ? 'text-primary' : 'text-on-surface-variant'}`}>
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick, testId, disabled }: { children: ReactNode; onClick: () => void; testId?: string; disabled?: boolean }) {
  return (
    <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-outline/30 bg-surface px-4 text-[13px] font-semibold hover:bg-background disabled:opacity-40">
      {children}
    </button>
  );
}

export function SolidButton({ children, onClick, testId, disabled, wide }: { children: ReactNode; onClick: () => void; testId?: string; disabled?: boolean; wide?: boolean }) {
  return (
    <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-on-primary disabled:opacity-40 ${wide ? 'w-full' : ''}`}>
      {children}
    </button>
  );
}
