import { useEffect, useState } from 'react';
import { Crown, MessageSquare, X } from 'lucide-react';
import { birthdayCardFor, limaDayKey } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { markBirthdayCardSeen, seenBirthdayCards } from './seenBirthdayCards';

const QUICK_REACTIONS = ['🎂', '👏', '❤️', '🎉'] as const;
/** The design's still confetti (`c1-app-cumpleanos`), in the brand's colors: nothing childish. */
const CONFETTI = [
  { top: '8%', left: '12%', color: 'bg-primary', rotate: 20 },
  { top: '14%', left: '78%', color: 'bg-warning', rotate: -30 },
  { top: '22%', left: '40%', color: 'bg-secondary', rotate: 45 },
  { top: '72%', left: '8%', color: 'bg-warning', rotate: -15 },
  { top: '80%', left: '84%', color: 'bg-primary', rotate: 30 },
  { top: '88%', left: '30%', color: 'bg-secondary', rotate: -40 },
] as const;

type Props = {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  me: string;
  messages: readonly { seq: number; at: string; senderId: string; system?: { evento?: string; valor?: string } }[];
  names: ReadonlyMap<string, string>;
  photos: ReadonlyMap<string, string>;
  onReact: (emoji: string) => void;
  onGreet: (text: string) => void;
};

/**
 * The birthday card on the web (pending 17), the same as the app's: on opening
 * a chat with birthdays on, the day of someone else's, once per browser. No
 * «Crear tarjeta con IA» until José decides on the paid model.
 */
export function BirthdayCardWeb(props: Props) {
  const [shown, setShown] = useState<{ chatId: string; seq: number; who: string; age?: number } | null>(null);
  const { chatId, me, messages } = props;
  // Another chat is another card.
  const card = shown?.chatId === chatId ? shown : null;

  useEffect(() => {
    const seen = seenBirthdayCards();
    const found = birthdayCardFor(messages, { me, todayKey: limaDayKey(new Date()), seen: (seq) => seen.has(`${chatId}:${seq}`) });
    if (found) setShown((current) => (current?.chatId === chatId ? current : { chatId, ...found }));
  }, [chatId, me, messages]);

  useEffect(() => {
    if (!card) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) return null;
  const name = props.names.get(card.who) ?? 'tu contacto';
  const firstName = name.split(' ')[0];
  function close() {
    if (card) markBirthdayCardSeen(`${chatId}:${card.seq}`);
    setShown(null);
  }

  return (
    <div data-testid="tarjeta-cumpleanos-chat" role="dialog" aria-label={`Cumpleaños de ${firstName}`} className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-black/65 px-6" onClick={close}>
      {CONFETTI.map((piece, index) => (
        <span key={index} aria-hidden className={`pointer-events-none absolute h-3 w-2 rounded-sm ${piece.color}`} style={{ top: piece.top, left: piece.left, transform: `rotate(${piece.rotate}deg)` }} />
      ))}
      <button type="button" data-testid="btn-cerrar-cumpleanos" aria-label="Cerrar" onClick={close} className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white hover:bg-white/30">
        <X size={22} />
      </button>
      <div className="flex w-full max-w-[380px] flex-col items-center rounded-3xl bg-surface px-5 pb-5 pt-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <Crown size={22} className="text-warning" />
        <div className="relative mt-1">
          <div className="rounded-full border-4 border-primary/70 p-1">
            <Avatar name={name} foto={props.photos.get(card.who)} size={96} />
          </div>
          <span aria-hidden className="absolute -right-1 bottom-0 grid h-9 w-9 place-items-center rounded-full bg-surface text-lg">🎂</span>
        </div>
        <h2 className="mt-4 text-center text-[22px] font-extrabold text-on-surface">¡Feliz cumpleaños, {firstName}!</h2>
        <p className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium text-primary">
          {card.age ? `Hoy cumple ${card.age} años` : 'Hoy es su cumpleaños'}
          {props.isGroup ? ` · ${props.chatName}` : ''}
        </p>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[1.5px] text-on-surface-variant">Reaccionar al instante</p>
        <div className="mt-2 flex gap-3">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              data-testid={`cumple-reaccion-${emoji}`}
              aria-label={`Mandar ${emoji}`}
              onClick={() => {
                props.onReact(emoji);
                close();
              }}
              className="grid h-14 w-14 place-items-center rounded-full border border-outline/15 bg-background text-2xl transition-transform hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="btn-saludar-cumpleanos"
          onClick={() => {
            props.onGreet(`¡Feliz cumpleaños, ${firstName}! 🎉`);
            close();
          }}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-on-primary"
        >
          <MessageSquare size={18} /> {props.isGroup ? 'Saludar en el grupo' : 'Saludar'}
        </button>
      </div>
      <p className="absolute bottom-8 px-8 text-center text-[13px] text-white/80">
        {props.isGroup ? 'Lo ves porque el grupo tiene activados los cumpleaños' : 'Lo ves porque este chat tiene activados los cumpleaños'}
      </p>
    </div>
  );
}
