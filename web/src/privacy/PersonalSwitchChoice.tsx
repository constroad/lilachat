import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

const headersOf = (jwt: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` });

/**
 * A setting of mine that is on or off on the server (`GET`/`PUT {on}` on its
 * route): read once when the panel opens; the switch waits for the server and
 * goes back if it refuses. Read receipts (R31/10) and the notices' preview (B8).
 */
export function PersonalSwitchChoice(props: { jwt: string; route: string; icon: LucideIcon; title: string; hint: string; testId: string; onNotice: (text: string) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void fetch(props.route, { headers: headersOf(props.jwt) })
      .then((response) => (response.ok ? (response.json() as Promise<{ on: boolean }>) : null))
      .then((answer) => setOn(answer?.on ?? true))
      .catch(() => setOn(true));
  }, [props.jwt, props.route]);
  const change = async () => {
    const next = !on;
    setOn(next);
    const saved = await fetch(props.route, { method: 'PUT', headers: headersOf(props.jwt), body: JSON.stringify({ on: next }) }).then((response) => response.ok).catch(() => false);
    if (saved) return;
    setOn(!next);
    props.onNotice('No se pudo guardar. Revisa tu conexión.');
  };
  const Icon = props.icon;
  return (
    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background" title={props.hint}>
      <Icon size={16} />
      <span className="min-w-0 flex-1">{props.title}</span>
      <input
        type="checkbox"
        role="switch"
        data-testid={props.testId}
        checked={on ?? true}
        disabled={on === null}
        onChange={() => void change()}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-outline/30 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-primary checked:before:translate-x-[18px] disabled:opacity-50"
      />
    </label>
  );
}
