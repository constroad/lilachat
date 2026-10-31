import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { Interruptor } from '../ui/Interruptor';

type Answer = { ok: true; data: { on: boolean } } | { ok: false };

/**
 * A setting of mine that is on or off on the server: read once when the
 * settings open; the switch waits for the server and goes back if it refuses.
 * Read receipts (R31/10) and the notices' preview (B8).
 */
export function OwnSwitchSetting(props: { read: () => Promise<Answer>; save: (on: boolean) => Promise<Answer>; icon: LucideIcon; title: string; detail: string; testID: string }) {
  const { read, save } = props;
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void read().then((answer) => (answer.ok ? setOn(answer.data.on) : setFailed(true)));
  }, [read]);
  const change = async (next: boolean) => {
    const before = on;
    setOn(next);
    const answer = await save(next);
    if (answer.ok) return setFailed(false);
    setOn(before);
    setFailed(true);
  };
  return (
    <FilaDeAjuste
      icono={props.icon}
      titulo={props.title}
      detalle={failed ? 'No se pudo guardar. Revisa tu conexión.' : props.detail}
      derecha={<Interruptor testID={props.testID} value={on ?? true} onValueChange={(next) => void change(next)} disabled={on === null} />}
    />
  );
}
