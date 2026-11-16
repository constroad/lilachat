import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { arProblemLine, isArWarning, tapeKey, tapeMeters, type ArDiagonalRow, type ArProblem, type ArSide, type TapeKey, type TapedLength } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { SectionTitle } from '../observations/ObservationParts';
import { TapeKeypad } from './TapeKeypad';
import { decimals } from './ZoneParts';

type Taped = Record<number, number>;
export type SideEditing = { kind: 'side'; index: number } | { kind: 'diagonal'; to: number } | null;

/** An empty «Listo» takes the tape off: the AR length goes back. */
function withTape(current: Taped, index: number, value: number | null): Taped {
  const next = { ...current };
  if (value === null) delete next[index];
  else next[index] = value;
  return next;
}

/**
 * The tape on each side and on each diagonal from corner A (by `to`): the AR measure and a saved
 * zone's correction (José 16/11) hold them the same way, and the same engine turns them into figures.
 */
export function useSideTapes(start: { tapes: Taped; diagonals: Taped } = { tapes: {}, diagonals: {} }) {
  const [tapes, setTapes] = useState<Taped>(start.tapes);
  const [diagonals, setDiagonals] = useState<Taped>(start.diagonals);
  const [editing, setEditing] = useState<SideEditing>(null);
  const [typed, setTyped] = useState('');
  const open = (next: SideEditing) => {
    const meters = next?.kind === 'side' ? tapes[next.index] : next?.kind === 'diagonal' ? diagonals[next.to] : undefined;
    setEditing(next);
    setTyped(meters ? String(meters) : '');
  };
  const done = () => {
    const value = tapeMeters(typed);
    if (editing?.kind === 'side') setTapes((current) => withTape(current, editing.index, value));
    if (editing?.kind === 'diagonal') setDiagonals((current) => withTape(current, editing.to, value));
    setEditing(null);
  };
  // Memoized: the engine reruns only when a tape changes, not on every render.
  const list = useMemo((): TapedLength[] => Object.entries(diagonals).map(([to, meters]) => ({ from: 0, to: Number(to), meters })), [diagonals]);
  return { tapes, diagonals, list, editing, typed, open, done, key: (pressed: TapeKey) => setTyped((current) => tapeKey(current, pressed)) };
}
export type SideTapes = ReturnType<typeof useSideTapes>;

type SidesProps = { sides: readonly ArSide[]; rows: readonly ArDiagonalRow[]; tape: SideTapes; onShown: (node: View) => void };

/** «Lados · toca uno para poner la wincha»: each side's length, where it comes from, and the tape's keypad. */
export function SidesCard({ sides, rows, tape, onShown }: SidesProps) {
  const editing = tape.editing?.kind === 'side' ? tape.editing.index : null;
  return (
    <View className="gap-1 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Lados · toca uno para poner la wincha" />
      {sides.map((side) => (editing === side.index
        ? <View key={side.index} className="gap-2"><SideWarning side={side} /><TapeKeypad title={`Lado ${side.index + 1} en edición`} unit="m" before={`AR ${decimals(side.arMeters, 2)} m`} typed={tape.typed} onKey={tape.key} onDone={tape.done} onShown={onShown} /></View>
        : <SideRow key={side.index} side={side} onPress={() => tape.open({ kind: 'side', index: side.index })} />))}
      <DiagonalRows rows={rows} tape={tape} onShown={onShown} />
    </View>
  );
}

/**
 * José 16/11: a street zone is rarely a triangle. A quad's four sides do not fix its shape (it
 * flexes); one diagonal from corner A does, and then the area comes from the tapes alone.
 */
function DiagonalRows({ rows, tape, onShown }: Omit<SidesProps, 'sides'>) {
  if (!rows.length) return null;
  const editing = tape.editing?.kind === 'diagonal' ? tape.editing.to : null;
  return (
    <View testID="diagonales-ar" className="gap-1 pt-3">
      <SectionTitle title="Diagonales · fijan la forma" side="Opcional" />
      {rows.map((row) => (editing === row.to
        ? <TapeKeypad key={row.to} title={`${row.label} en edición`} unit="m" before={`AR ${decimals(row.arMeters, 2)} m`} typed={tape.typed} onKey={tape.key} onDone={tape.done} onShown={onShown} />
        : <DiagonalRow key={row.to} row={row} onPress={() => tape.open({ kind: 'diagonal', to: row.to })} />))}
    </View>
  );
}

function DiagonalRow({ row, onPress }: { row: ArDiagonalRow; onPress: () => void }) {
  const colors = useColores();
  const warning = !row.taped || row.flag === 'ok' ? null : row.centimeters ? '¿Escribiste centímetros? La wincha va en metros (2,30 y no 230).' : row.flag === 'block' ? `La wincha difiere más de 15 % del AR (${decimals(row.arMeters, 2)} m): revisa las esquinas.` : 'AR y wincha no coinciden · manda la wincha';
  return (
    <View className="border-b border-outline/10 py-1">
      <Pressable testID={`diagonal-ar-${row.to + 1}`} onPress={onPress} className="min-h-[52px] flex-row items-center gap-3">
        <Text className="flex-1 text-[15px] text-on-surface">{row.label}</Text>
        <Text className="text-[16px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{`${decimals(row.meters, 2)} m`}</Text>
        <Text className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${row.flag === 'block' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{row.taped ? 'Wincha' : 'AR'}</Text>
      </Pressable>
      {warning ? <View className="mb-1 flex-row items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-2"><AlertTriangle size={16} color={colors.error} /><Text className="flex-1 text-[13px] font-semibold text-error">{warning}</Text></View> : null}
    </View>
  );
}

function SideRow({ side, onPress }: { side: ArSide; onPress: () => void }) {
  const taped = side.source === 'wincha';
  return (
    <View className="border-b border-outline/10 py-1">
      <Pressable testID={`lado-ar-${side.index + 1}`} onPress={onPress} className="min-h-[52px] flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full border border-outline/30"><Text className="text-[13px] font-bold text-on-surface">{side.index + 1}</Text></View>
        <Text className="flex-1 text-[15px] text-on-surface">{`Lado ${side.index + 1}`}</Text>
        <Text className="text-[16px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{`${decimals(side.meters, 2)} m`}</Text>
        <Text className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${side.flag === 'block' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{taped ? (side.flag === 'ok' ? 'Wincha' : 'Ajustado') : 'AR'}</Text>
      </Pressable>
      <SideWarning side={side} />
    </View>
  );
}

/** José 15/11: over 3 % «manda la wincha»; over 15 % it does not save (or it was typed in centimeters). */
function SideWarning({ side }: { side: ArSide }) {
  const colors = useColores();
  if (side.source !== 'wincha' || side.flag === 'ok') return null;
  const line = side.centimeters ? '¿Escribiste centímetros? La wincha va en metros (2,30 y no 230).' : side.flag === 'block' ? `La wincha difiere más de 15 % del AR (${decimals(side.arMeters, 2)} m): revisa que sea este lado.` : 'AR y wincha no coinciden · manda la wincha';
  return (
    <View testID={`aviso-lado-${side.index + 1}`} className="mb-1 flex-row items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-2">
      <AlertTriangle size={16} color={colors.error} />
      <Text className="flex-1 text-[13px] font-semibold text-error">{line}</Text>
    </View>
  );
}

/** A fault in red stops the save; a warning in amber only asks to look (José 15/11). */
export function ProblemsCard({ problems }: { problems: readonly ArProblem[] }) {
  const faults = problems.filter((problem) => !isArWarning(problem));
  const warnings = problems.filter(isArWarning);
  return (
    <View className="gap-2">
      {faults.length ? <View testID="problemas-ar" className="gap-1 rounded-2xl border border-error/30 bg-error/5 p-3">{faults.map((problem) => <Text key={problem} className="text-[14px] text-on-surface">{`• ${arProblemLine(problem)}`}</Text>)}</View> : null}
      {warnings.length ? <View testID="avisos-ar" className="gap-1 rounded-2xl border border-warning/40 bg-warning/10 p-3">{warnings.map((problem) => <Text key={problem} className="text-[14px] text-on-surface">{`• ${arProblemLine(problem)}`}</Text>)}</View> : null}
    </View>
  );
}
