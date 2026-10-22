import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { CalendarClock, ChevronDown, Copy, Link, Phone, Video } from 'lucide-react';
import { nextHalfHour, scheduledCallTitle } from '@lilachat/shared';
import { api } from '../../api';
import { FieldError, Overlay } from '../../ui/Overlay';

/** The reminder of a scheduled call: just before it, not an hour like an event. */
const REMIND_MINUTES_BEFORE = 5;

/** `datetime-local` speaks local time without a zone: «2026-10-23T15:30». */
const toLocalInput = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function KindPicker(props: { video: boolean; onChange: (video: boolean) => void }) {
  const option = (video: boolean, label: string, Icon: typeof Phone) => (
    <button type="button" data-testid={`tipo-llamada-${video ? 'video' : 'voz'}`} aria-pressed={props.video === video} onClick={() => props.onChange(video)} className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${props.video === video ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-background'}`}>
      <Icon size={16} /> {label}
    </button>
  );
  return <div className="flex gap-1 rounded-xl border border-outline/15 p-1">{option(false, 'Voz', Phone)}{option(true, 'Video', Video)}</div>;
}

/** «Programar llamada» on the web (pending 42): an event with the call's kind, as in the app. */
function ScheduleCallDialog(props: { jwt: string; chat: { id: string; name: string }; onClose: () => void }) {
  const [video, setVideo] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(nextHalfHour(new Date())));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const shownTitle = title ?? scheduledCallTitle(props.chat.name, video);

  const schedule = async () => {
    const startsAt = new Date(when);
    if (!shownTitle.trim()) return setError('Ponle un nombre a la llamada.');
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return setError('Elige una hora que todavía no pasó.');
    setSaving(true);
    const response = await api('/agenda/events', { jwt: props.jwt, body: { chatId: props.chat.id, title: shownTitle.trim(), startsAt: startsAt.toISOString(), call: { video }, remindMinutesBefore: REMIND_MINUTES_BEFORE, remindGuests: true } });
    setSaving(false);
    if (response.ok) props.onClose();
    else setError(response.message);
  };

  return (
    <Overlay title="Programar llamada" onClose={props.onClose} footer={<button type="button" data-testid="btn-programar-llamada" disabled={saving} onClick={() => void schedule()} className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? 'Programando…' : 'Programar'}</button>}>
      <KindPicker video={video} onChange={setVideo} />
      <input data-testid="campo-titulo-llamada" value={shownTitle} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre de la llamada" className="mt-3 h-11 w-full rounded-xl border border-outline/30 bg-transparent px-3 text-[15px] outline-none focus:border-primary" />
      <input data-testid="campo-cuando-llamada" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-outline/30 bg-transparent px-3 text-[15px] outline-none focus:border-primary" />
      <p className="mt-2 text-[12px] text-on-surface-variant">Les avisamos a los dos 5 minutos antes. Pueden unirse desde 10 minutos antes.</p>
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}

/** «Crear enlace de llamada» on the web (pending 42): voice or video, then the link to copy. */
function CallLinkDialog(props: { jwt: string; chat: { id: string; name: string }; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const create = async (video: boolean) => {
    const response = await api<{ url: string }>(`/chats/${props.chat.id}/call-link`, { jwt: props.jwt, body: { video } });
    if (response.ok) setUrl(response.data.url);
    else setError(response.message);
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.'));
  };

  return (
    <Overlay title="Crear enlace de llamada" onClose={props.onClose}>
      <p className="mb-3 text-sm text-on-surface-variant">Para una llamada con {props.chat.name}. Solo sirve para quienes están en este chat.</p>
      {url ? (
        <>
          <input data-testid="enlace-de-llamada" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="h-11 w-full rounded-xl border border-outline/30 bg-background px-3 text-[13px]" />
          <button type="button" data-testid="btn-copiar-enlace-llamada" onClick={() => void copy()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-on-primary">
            <Copy size={16} /> {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" data-testid="btn-enlace-voz" onClick={() => void create(false)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-primary text-sm font-semibold text-primary"><Phone size={16} /> Voz</button>
          <button type="button" data-testid="btn-enlace-video" onClick={() => void create(true)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-primary text-sm font-semibold text-primary"><Video size={16} /> Video</button>
        </div>
      )}
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}

/**
 * The arrow next to the call buttons of a 1:1 (pending 42, José 22/10), like
 * WhatsApp's: «Programar llamada» and «Crear enlace de llamada».
 */
export function CallExtrasMenu(props: { jwt: string; chat: { id: string; name: string } }) {
  const [open, setOpen] = useState<'schedule' | 'link' | null>(null);
  const item = 'flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-[highlighted]:bg-background';
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" data-testid="btn-mas-llamada" aria-label="Más opciones de llamada" title="Más opciones de llamada" className="grid h-11 w-8 place-items-center rounded-full hover:bg-surface">
            <ChevronDown size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} className="z-40 min-w-[220px] rounded-xl border border-outline/15 bg-surface p-1 shadow-xl">
            <DropdownMenu.Item data-testid="opcion-programar-llamada" onSelect={() => setOpen('schedule')} className={item}><CalendarClock size={16} /> Programar llamada</DropdownMenu.Item>
            <DropdownMenu.Item data-testid="opcion-enlace-llamada" onSelect={() => setOpen('link')} className={item}><Link size={16} /> Crear enlace de llamada</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {open === 'schedule' ? <ScheduleCallDialog jwt={props.jwt} chat={props.chat} onClose={() => setOpen(null)} /> : null}
      {open === 'link' ? <CallLinkDialog jwt={props.jwt} chat={props.chat} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
