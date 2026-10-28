import { useState } from 'react';
import { repeatOfDays, scheduleRequestOf, validateScheduleInput, weekdaysOf, type ScheduleRepeat } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { createAppSchedule, type AppItems } from '../spacesApi';

/** What «Programar» opens with: a command alone, or an app's suggestion with its hour and days. */
export type ScheduleDraft = { command: string; shareable: boolean; text?: string; time?: string; repeat?: ScheduleRepeat; onlyIfSomething?: boolean };

type SheetProps = { jwt: string; spaceId: string; appId: string; appName: string; draft: ScheduleDraft; channels: AppItems['channels']; onClose: () => void; onCreated: () => void };

const DEFAULT_TIME = '08:00';
/** Monday first, as the week is read in Peru; 0 = Sunday. */
const WEEK: readonly [number, string][] = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const DIRECT = 'direct';

/**
 * «Programar» (design d-02): a read command that runs as the admin at the
 * hour and days picked and posts its report in a channel, or only in their 1:1
 * with the app when it carries amounts. The server checks it all again.
 */
export function ScheduleSheet(props: SheetProps) {
  const { draft } = props;
  const [time, setTime] = useState(draft.time ?? DEFAULT_TIME);
  const [days, setDays] = useState<number[]>(weekdaysOf(draft.repeat ?? { every: 1 }));
  const [where, setWhere] = useState(draft.shareable ? (props.channels[0]?.id ?? DIRECT) : DIRECT);
  const [text, setText] = useState(draft.text ?? '');
  const [onlyIfSomething, setOnlyIfSomething] = useState(draft.onlyIfSomething ?? false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const toggleDay = (day: number) => setDays((before) => (before.includes(day) ? before.filter((one) => one !== day) : [...before, day]));
  const submit = async () => {
    const body = { command: draft.command, text, time, repeat: repeatOfDays(days), chat_id: where, only_if_something: onlyIfSomething };
    const valid = validateScheduleInput(body);
    if (!valid.ok) return setState({ busy: false, error: valid.message });
    setState({ busy: true });
    const result = await createAppSchedule(props.jwt, props.spaceId, props.appId, scheduleRequestOf(valid.input));
    if (!result.ok) return setState({ busy: false, error: result.message });
    props.onCreated();
  };
  return (
    <Overlay title={`Programar /${draft.command}`} onClose={props.onClose} footer={<PrimaryButton testId="btn-programar" disabled={state.busy} onClick={() => void submit()}>{state.busy ? 'Programando…' : 'Programar'}</PrimaryButton>}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Programar</p>
      <p className="text-[18px] font-bold">/{draft.command} de {props.appName}</p>
      <p className="mb-4 text-[14px] text-on-surface-variant">Corre como tú, a la hora que elijas, y publica el reporte {draft.shareable ? 'en el canal' : 'en tu chat con la app'}.</p>
      <div className="space-y-3">
        <Card title="Hora de ejecución">
          <input type="time" data-testid="programar-hora" value={time} onChange={(event) => setTime(event.target.value)} className="h-12 w-full rounded-lg border border-outline/25 bg-background px-3 font-mono text-[22px] tabular-nums" />
        </Card>
        <Card title="Días repetidos" aside={`${days.length} ${days.length === 1 ? 'día activo' : 'días activos'}`}>
          <div className="flex justify-between gap-1">
            {WEEK.map(([day, letter]) => (
              <button key={day} type="button" data-testid={`dia-${day}`} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)} className={`grid h-10 w-10 place-items-center rounded-full text-[14px] font-bold ${days.includes(day) ? 'bg-primary text-on-primary' : 'border border-outline/25 text-on-surface-variant'}`}>{letter}</button>
            ))}
          </div>
        </Card>
        <Card title="Dónde se publica">
          <select data-testid="programar-donde" value={where} onChange={(event) => setWhere(event.target.value)} className="h-12 w-full rounded-lg border border-outline/25 bg-background px-3 text-[15px]">
            {draft.shareable ? props.channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>) : null}
            <option value={DIRECT}>Tu chat con {props.appName}</option>
          </select>
          {draft.shareable ? null : <p className="mt-2 text-[13px] text-on-surface-variant">Los comandos con montos solo se programan en tu chat con la app.</p>}
        </Card>
        <Card title="Argumentos (opcional)">
          <input data-testid="programar-texto" value={text} maxLength={200} placeholder="ayer, lunes, 2026-10-28…" onChange={(event) => setText(event.target.value)} className="h-11 w-full rounded-lg border border-outline/25 bg-background px-3 font-mono text-[14px]" />
          <p className="mt-1 text-[12px] text-on-surface-variant">Lo que escribirías después del comando.</p>
        </Card>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-outline/15 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Solo si hay algo que reportar</span>
            <span className="block text-[12px] text-on-surface-variant">Si la app no tiene nada nuevo, no se publica nada.</span>
          </span>
          <input type="checkbox" role="switch" data-testid="programar-solo-si-hay-algo" checked={onlyIfSomething} onChange={(event) => setOnlyIfSomething(event.target.checked)} className="h-5 w-5 accent-primary" />
        </label>
      </div>
      <FieldError>{state.error}</FieldError>
    </Overlay>
  );
}

function Card(props: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-outline/15 p-4">
      <p className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{props.title}{props.aside ? <span className="normal-case tracking-normal text-primary">{props.aside}</span> : null}</p>
      {props.children}
    </div>
  );
}
