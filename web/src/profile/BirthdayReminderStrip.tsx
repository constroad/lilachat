import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cake, X } from 'lucide-react';
import type { MyProfile } from '@lilachat/shared';
import { CompleteProfileScreen } from './CompleteProfileScreen';
import { useBirthdayReminder } from './useBirthdayReminder';

const ACTION = 'inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary';

/**
 * «Agrega tu cumpleaños» in the chat list (José, 14/11), shaped like the
 * install strip: part of the list, not floating over it. «Agregar» opens the
 * profile with its birthday boxes; «Ahora no» hides it on this device for a
 * few days. It goes away for good once the birthday is saved.
 */
export function BirthdayReminderStrip(props: { jwt?: string; userId?: string }) {
  // Without a session (no network, a list in a test) there is no one to ask about.
  return props.jwt && props.userId ? <Strip jwt={props.jwt} userId={props.userId} /> : null;
}

function Strip({ jwt, userId }: { jwt: string; userId: string }) {
  const reminder = useBirthdayReminder(jwt, userId);
  const [editing, setEditing] = useState(false);
  if (!reminder.profile) return null;
  const saved = (profile: MyProfile) => {
    setEditing(false);
    reminder.done(profile);
  };
  return (
    <section data-testid="franja-cumpleanos" aria-label="Agrega tu cumpleaños" className="mx-3 mb-2 rounded-xl bg-primary/10 py-1 pl-3 pr-1">
      <div className="flex items-start gap-2">
        <Cake size={16} className="mt-2.5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 py-1.5">
          <span className="block text-sm font-semibold">Agrega tu cumpleaños</span>
          <span className="block text-[13px] leading-5 text-on-surface-variant">Así tus grupos sabrán cuándo saludarte.</span>
        </p>
        <button type="button" data-testid="btn-cumpleanos-ahora-no" aria-label="Ahora no" title="Ahora no" onClick={reminder.dismiss} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant"><X size={16} /></button>
      </div>
      <div className="flex justify-end pb-2 pr-2">
        <button type="button" data-testid="btn-cumpleanos-agregar" onClick={() => setEditing(true)} className={ACTION}>Agregar</button>
      </div>
      {editing
        ? createPortal(
          <div role="dialog" aria-label="Tu perfil" className="fixed inset-0 z-40 overflow-y-auto bg-background">
            <CompleteProfileScreen jwt={jwt} profile={reminder.profile} onDone={saved} onCancel={() => setEditing(false)} />
          </div>,
          document.body
        )
        : null}
    </section>
  );
}
