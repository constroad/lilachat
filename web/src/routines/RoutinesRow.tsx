import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { ROUTINE_NOTE_MAX, quietHoursLabel, quietHoursOf, type ContactNote, type QuietHours } from '@lilachat/shared';
import { saveRoutines } from './routinesApi';

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DEFAULT_QUIET = { days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00' };
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';

/**
 * «Automatizaciones» of one chat in its info panel (pending 17, design
 * `automatizaciones`), only mine: quiet on a schedule and, in a 1:1, a note
 * for the next time I talk to that person.
 */
export function RoutinesRow(props: { chatId: string; jwt: string; isDirect: boolean; name: string; quietHours?: QuietHours; contactNote?: ContactNote; onNotice: (text: string) => void }) {
  const [quiet, setQuiet] = useState<QuietHours | null>(props.quietHours ?? null);
  const [note, setNote] = useState(props.contactNote?.text ?? '');
  const [savedNote, setSavedNote] = useState(props.contactNote?.text ?? '');
  useEffect(() => {
    setQuiet(props.quietHours ?? null);
  }, [props.quietHours]);
  // The detail arrives after the panel opens: the saved note follows it.
  useEffect(() => {
    setNote(props.contactNote?.text ?? '');
    setSavedNote(props.contactNote?.text ?? '');
  }, [props.contactNote?.text]);

  const saveQuiet = async (next: QuietHours | null) => {
    const before = quiet;
    setQuiet(next);
    const failed = await saveRoutines(props.jwt, props.chatId, { quietHours: next });
    if (failed) {
      setQuiet(before);
      props.onNotice(failed);
    }
  };
  const change = (patch: Partial<QuietHours>) => {
    const next = quiet && quietHoursOf({ ...quiet, ...patch });
    if (next) void saveQuiet(next);
  };
  const saveNote = async () => {
    const text = note.trim();
    const failed = await saveRoutines(props.jwt, props.chatId, { contactNote: text ? { text } : null });
    if (failed) props.onNotice(failed);
    else setSavedNote(text);
  };

  return (
    <section data-testid="rutinas-del-chat" className="mt-2 bg-surface px-6 py-3">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"><Timer size={14} /> Automatizaciones</p>
      <label className="flex min-h-[56px] cursor-pointer items-center gap-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">Silenciar por horario</span>
          <span className="block text-[12px] text-on-surface-variant">{quiet ? quietHoursLabel(quiet) : 'Sin avisos en tus horas de descanso. Las llamadas suenan igual.'}</span>
        </span>
        <input type="checkbox" role="switch" data-testid="interruptor-silencio-horario" checked={quiet !== null} onChange={() => void saveQuiet(quiet ? null : { ...DEFAULT_QUIET, tz: zone() })} className="h-5 w-5 accent-primary" />
      </label>
      {quiet ? (
        <div className="mb-2 space-y-2">
          <div className="flex gap-1.5">
            {DAY_LETTERS.map((letter, day) => (
              <button key={day} type="button" data-testid={`dia-silencio-${day}`} aria-pressed={quiet.days.includes(day)} onClick={() => change({ days: quiet.days.includes(day) ? quiet.days.filter((one) => one !== day) : [...quiet.days, day] })} className={`h-8 w-8 rounded-full border text-[12px] ${quiet.days.includes(day) ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-outline/20 text-on-surface-variant'}`}>
                {letter}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-[13px]">
            {(['from', 'to'] as const).map((edge) => (
              <label key={edge} className="flex flex-1 flex-col gap-1 text-on-surface-variant">
                {edge === 'from' ? 'Desde' : 'Hasta'}
                <input type="time" data-testid={`hora-silencio-${edge}`} value={quiet[edge]} onChange={(event) => change({ [edge]: event.target.value })} className="h-10 rounded-lg border border-outline/20 bg-surface px-2 text-on-surface" />
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {props.isDirect ? (
        <div className="border-t border-outline/10 pt-3">
          <p className="text-[15px]">Recordar la próxima vez que hables con {props.name}</p>
          <div className="mt-2 flex gap-2">
            <input data-testid="nota-contacto" value={note} maxLength={ROUTINE_NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="Ej.: preguntarle por la factura" className="h-10 min-w-0 flex-1 rounded-lg border border-outline/20 bg-surface px-3 text-[14px]" />
            {note.trim() !== savedNote ? (
              <button type="button" data-testid="btn-guardar-nota" onClick={() => void saveNote()} className="h-10 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary">
                {note.trim() ? 'Guardar' : 'Quitar'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
