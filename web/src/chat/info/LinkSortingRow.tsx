import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { saveLinkSorting } from '../links/linkNotesApi';

/**
 * «Ordenar enlaces por categoría» in a notes chat's settings (José 18/11):
 * off by default. Turning it on, Lila reads the links already saved and
 * sorts them; the chat list then says `linksSorted` and the header shows
 * «Chat · Por categoría».
 */
export function LinkSortingRow(props: { chatId: string; jwt: string; on: boolean; onNotice: (text: string) => void }) {
  const [on, setOn] = useState(props.on);
  const [saving, setSaving] = useState(false);
  const [justTurnedOn, setJustTurnedOn] = useState(false);
  useEffect(() => {
    setOn(props.on);
  }, [props.on]);
  const change = async (next: boolean) => {
    setOn(next);
    setSaving(true);
    const response = await saveLinkSorting(props.jwt, props.chatId, next);
    setSaving(false);
    if (response.ok) return setJustTurnedOn(next);
    setOn(!next);
    props.onNotice(response.message);
  };
  return (
    <label data-testid="fila-ordenar-enlaces" className="mt-2 flex min-h-[64px] cursor-pointer items-center gap-4 bg-surface px-6 py-2">
      <FolderOpen size={18} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Ordenar enlaces por categoría</span>
        <span className="block text-[12px] text-on-surface-variant">
          {justTurnedOn ? 'Lila lee tus enlaces y los ordena. Tarda uno o dos minutos.' : 'Lila elige la categoría de cada enlace que guardas. Tú la puedes cambiar.'}
        </span>
      </span>
      <input type="checkbox" role="switch" data-testid="interruptor-ordenar-enlaces" checked={on} disabled={saving} onChange={() => void change(!on)} className="h-5 w-5 accent-primary" />
    </label>
  );
}
