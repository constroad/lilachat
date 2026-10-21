import { useState } from 'react';
import { AlarmClock, Phone, PhoneMissed, Video } from 'lucide-react';
import { callBackOptions, callBackTitle, formatClock, isMissedCallForMe, leerValorDeLlamada, textoDeLlamada } from '@lilachat/shared';
import { api } from '../api';
import { useConversacion } from './contextoDeLaConversacion';
import type { MensajeEnPantalla } from './types';

const TIME = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });

/**
 * The line a call leaves in the chat, like the app's: «Llamada perdida» in red
 * for whoever missed it, with «Recordarme» to return it later (backlog 23,
 * José 21/10). The web does not place calls, so it has no «Llamar»: the
 * reminder rings on the phone too and opens that chat.
 */
export function LineaDeLlamada({ mensaje }: { mensaje: MensajeEnPantalla }) {
  const { yo, jwt, chat } = useConversacion();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const mine = mensaje.senderId === yo;
  const valor = mensaje.system?.valor;
  const record = leerValorDeLlamada(valor);
  const text = textoDeLlamada({ valor, esMio: mine });
  if (!record || !text) return null;
  const missed = isMissedCallForMe({ valor, esMio: mine });
  const Icon = missed ? PhoneMissed : record.video ? Video : Phone;
  const canRemind = missed && chat.kind === 'direct';
  const remind = async (date: Date) => {
    setOpen(false);
    const name = chat.name ?? chat.phone ?? '';
    const result = await api<{ id?: string }>('/agenda/reminders', { jwt, body: { title: callBackTitle(name), startsAt: date.toISOString(), callBack: { chatId: chat.id, video: record.video } } });
    setNotice(result.ok ? `Te lo recuerdo a las ${TIME.format(date)}` : 'No se pudo guardar el recordatorio. Prueba de nuevo.');
  };
  return (
    <div className="my-2 flex flex-col items-center gap-1.5" data-testid={`llamada-${mensaje.seq}`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-variant/60 px-3 py-1 text-[12px] ${missed ? 'text-error' : 'text-on-surface-variant'}`}>
        <Icon size={13} />
        {text} · {formatClock(mensaje.at)}
      </span>
      {canRemind ? (
        <div className="relative">
          <button type="button" data-testid={`recordar-devolver-${mensaje.seq}`} onClick={() => setOpen((before) => !before)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-outline/20 bg-surface px-3 text-[13px] font-semibold text-primary hover:bg-background">
            <AlarmClock size={14} />
            Recordarme devolverla
          </button>
          {open ? (
            <div role="menu" className="absolute left-1/2 top-9 z-20 w-56 -translate-x-1/2 rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
              {callBackOptions(new Date()).map((option) => (
                <button key={option.id} type="button" role="menuitem" data-testid={`devolver-${option.id}`} onClick={() => void remind(option.date)} className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-[14px] hover:bg-background">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-[12px] text-on-surface-variant">{TIME.format(option.date)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {notice ? <span className="text-[12px] text-primary">{notice}</span> : null}
    </div>
  );
}
