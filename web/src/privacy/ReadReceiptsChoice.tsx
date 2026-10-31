import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';

const route = '/api/me/read-receipts';
const headersOf = (jwt: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` });

/**
 * «Confirmaciones de lectura», like WhatsApp (R31/10): off, the others do not
 * see that I read their 1:1 messages, and I do not see theirs. Groups always
 * tell it. Read once when the panel opens; the switch waits for the server.
 */
export function ReadReceiptsChoice(props: { jwt: string; onNotice: (text: string) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void fetch(route, { headers: headersOf(props.jwt) })
      .then((response) => (response.ok ? (response.json() as Promise<{ on: boolean }>) : null))
      .then((answer) => setOn(answer?.on ?? true))
      .catch(() => setOn(true));
  }, [props.jwt]);
  const change = async () => {
    const next = !on;
    setOn(next);
    const saved = await fetch(route, { method: 'PUT', headers: headersOf(props.jwt), body: JSON.stringify({ on: next }) }).then((response) => response.ok).catch(() => false);
    if (saved) return;
    setOn(!next);
    props.onNotice('No se pudo guardar. Revisa tu conexión.');
  };
  return (
    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background" title="Si las desactivas, tampoco verás las de los demás. En los grupos siempre se envían.">
      <CheckCheck size={16} />
      <span className="min-w-0 flex-1">Confirmaciones de lectura</span>
      <input
        type="checkbox"
        role="switch"
        data-testid="interruptor-confirmaciones-lectura"
        checked={on ?? true}
        disabled={on === null}
        onChange={() => void change()}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-outline/30 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-primary checked:before:translate-x-[18px] disabled:opacity-50"
      />
    </label>
  );
}
