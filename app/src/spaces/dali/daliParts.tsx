import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, ToastAndroid, View } from 'react-native';
import { LEVEL_LABEL, STAGE_LABEL, levelOf, originOf, shownStageOf, type ProspectStage, type ProspectView } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/**
 * The small pieces every Dali screen of the APK shares (dl-01 to dl-13), as on the web: the state pills, the skeleton
 * rows, the empty note and the buttons. Only tokens: the company's color is the accent, never a hex. The circles are
 * the app's `Avatar` and the kickers its `Rotulo` (one of each in the whole app, FL13).
 */

export type PillTone = 'neutral' | 'primary' | 'ok' | 'warn' | 'error' | 'info';

/** NativeWind only sees literal classes: one box and one ink per tone. */
const PILL_BOX: Record<PillTone, string> = {
  neutral: 'border-outline/30 bg-surface-variant/50',
  primary: 'border-primary/30 bg-primary/10',
  ok: 'border-en-linea/30 bg-en-linea/10',
  warn: 'border-warning/30 bg-warning/10',
  error: 'border-error/30 bg-error/10',
  info: 'border-secondary/30 bg-secondary/10',
};
const PILL_INK: Record<PillTone, string> = {
  neutral: 'text-on-surface-variant',
  primary: 'text-primary',
  ok: 'text-en-linea',
  warn: 'text-warning',
  error: 'text-error',
  info: 'text-secondary',
};

/** How much a pill gives way in a short row: the origin first, so the stage stays whole; the rest never. */
const SHRINK = { none: 0, last: 1, first: 100 } as const;
/** A pill that gives way keeps room for «M…»: an empty bordered box says nothing. */
const PILL_MIN_WIDTH = 36;

export function Pill({ tone = 'neutral', children, testID, shrink }: { tone?: PillTone; children: string; testID?: string; shrink?: boolean | 'first' }) {
  const give = shrink === 'first' ? 'first' : shrink ? 'last' : 'none';
  return (
    // The text shrinks with the box: without it Yoga keeps the pill at its content's width and the
    // neighbour (a phone number) is the one cut.
    <View testID={testID} style={{ flexShrink: SHRINK[give], minWidth: shrink ? PILL_MIN_WIDTH : undefined }} className={`h-6 flex-row items-center overflow-hidden rounded-md border px-2 ${PILL_BOX[tone]}`}>
      <Text numberOfLines={1} style={{ flexShrink: 1 }} className={`text-[11px] font-bold uppercase tracking-wide ${PILL_INK[tone]}`}>
        {children}
      </Text>
    </View>
  );
}

const LEVEL_TONE = { hot: 'primary', warm: 'warn', cold: 'neutral' } as const;

/** «86 · CALIENTE»: violet when hot, ochre when warm (dl-11 note: hot never in ochre). */
export function ScorePill({ score }: { score?: number }) {
  const level = levelOf(score);
  if (score === undefined || !level) return null;
  return <Pill tone={LEVEL_TONE[level]} testID="pastilla-puntaje">{`${score} · ${LEVEL_LABEL[level]}`}</Pill>;
}

const STAGE_TONE: Record<ProspectStage, PillTone> = { missing_info: 'neutral', to_quote: 'warn', visit: 'info', quoted: 'info', negotiation: 'primary', won: 'ok', lost: 'error' };

/** The stage with the funnel's names (dl-08); a plain question says «Solo consulta» (Stitch's «SOLICITUD» does not go). */
export function StagePill({ prospect }: { prospect: ProspectView }) {
  const stage = shownStageOf(prospect);
  if (stage === 'missing_info' && prospect.intent === 'information') return <Pill shrink testID="pastilla-etapa">Solo consulta</Pill>;
  return <Pill shrink tone={STAGE_TONE[stage]} testID="pastilla-etapa">{STAGE_LABEL[stage]}</Pill>;
}

/** Meta (a paid ad: Facebook and Instagram are not told apart yet) or Directo. */
export const OriginPill = ({ prospect, shrink }: { prospect: ProspectView; shrink?: 'first' }) => <Pill shrink={shrink}>{originOf(prospect).label}</Pill>;

/**
 * What a seller's action outside a form tells (taken, handed back to Dali, someone was first), as the rest of the app
 * does. A form's error stays in the form: with the keyboard open a toast is not seen.
 */
export const notify = (text: string): void => ToastAndroid.show(text, ToastAndroid.LONG);

const MINUTE_MS = 60_000;

/**
 * «hace 6 min» moves on without asking the server: one re-render a minute, only while the space is on screen (a
 * timer in the background spends battery for nobody).
 */
export function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** Rows of the right height while the first load is on its way (a spinner says nothing about what comes). */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View testID="esqueleto-prospectos" className="gap-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} className="h-[104px] rounded-xl border border-outline/15 bg-surface-variant/40" />
      ))}
    </View>
  );
}

/** A quiet block that says why something is empty, and what makes it fill. */
export function EmptyNote({ title, children, action }: { title: string; children?: string; action?: ReactNode }) {
  return (
    <View testID="vacio-dali" className="items-center rounded-xl border border-dashed border-outline/30 px-4 py-6">
      <Text className="text-center text-[15px] font-semibold text-on-surface">{title}</Text>
      {children ? <Text className="mt-1 text-center text-[13px] text-on-surface-variant">{children}</Text> : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

type ButtonProps = { children: string; onPress: () => void; testID?: string; disabled?: boolean; busy?: boolean; icon?: ReactNode };

/** A link-like action inside a card («Reintentar», «Ver todo»). */
export function TextButton({ children, onPress, testID, tone = 'primary' }: ButtonProps & { tone?: 'primary' | 'neutral' }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={6} className="min-h-[44px] flex-row items-center justify-center px-3">
      <Text className={`text-[14px] font-semibold ${tone === 'primary' ? 'text-primary' : 'text-on-surface-variant'}`}>{children}</Text>
    </Pressable>
  );
}

export function OutlineButton({ children, onPress, testID, disabled, icon, wide }: ButtonProps & { wide?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/30 bg-surface px-4 ${wide ? 'flex-1' : ''} ${disabled ? 'opacity-40' : ''}`}
    >
      {icon}
      <Text numberOfLines={1} className="text-[14px] font-semibold text-on-surface">{children}</Text>
    </Pressable>
  );
}

export function SolidButton({ children, onPress, testID, disabled, busy, icon, wide }: ButtonProps & { wide?: boolean }) {
  const colors = useColores();
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      disabled={off}
      onPress={onPress}
      className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 ${wide ? 'flex-1' : ''} ${off ? 'opacity-40' : ''}`}
    >
      {busy ? <ActivityIndicator size="small" color={colors['on-primary']} /> : icon}
      <Text numberOfLines={1} className="text-[15px] font-bold text-on-primary">{children}</Text>
    </Pressable>
  );
}
