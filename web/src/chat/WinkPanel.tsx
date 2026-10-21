import { useState } from 'react';
import { Play, Send, Vibrate } from 'lucide-react';
import { WINKS, type Wink, type WinkGroup, type WinkId } from '@lilachat/shared';
import { replayWink } from './nudge';
import { WinkCharacter } from './WinkCharacter';

/** The local preview has no message yet: any fixed seed. */
const PREVIEW_SEED = 0;
const GROUPS: { group: WinkGroup; title: string }[] = [
  { group: 'characters', title: 'Personajes' },
  { group: 'site', title: 'Obra y pistas' },
  { group: 'emoji', title: 'Emojis' },
];

/**
 * The «Guiños» tab of the emoji panel (design `m-02-guinos-panel`, desktop):
 * clicking a wink previews it over the window and shows «Enviar» under its
 * name. Three groups (José, 21/10): the full-body characters, the
 * construction ones and the first emoji winks.
 */
export function WinkPanel({ recipient, onSend, onNudge }: { recipient: string; onSend: (wink: WinkId) => void; onNudge?: () => void }) {
  const [selected, setSelected] = useState<WinkId | null>(null);
  const pick = (wink: WinkId) => {
    setSelected(wink);
    replayWink(PREVIEW_SEED, wink);
  };
  return (
    <div data-testid="panel-guinos" className="max-h-[360px] overflow-y-auto p-1">
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Guiños</p>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">Una animación a pantalla completa para {recipient}</p>
        </div>
        {selected ? (
          <button type="button" data-testid="guino-vista-previa" onClick={() => replayWink(PREVIEW_SEED, selected)} className="flex h-9 items-center gap-1.5 rounded-full border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
            <Play size={14} className="text-primary" /> Vista previa
          </button>
        ) : null}
      </div>
      {onNudge ? (
        <button type="button" data-testid="panel-zumbido" onClick={onNudge} className="mb-4 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 text-left hover:bg-background">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Vibrate size={20} /></span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Zumbido</span>
            <span className="block truncate text-[12px] text-on-surface-variant">Sacude la pantalla de {recipient}</span>
          </span>
        </button>
      ) : null}
      {GROUPS.map(({ group, title }) => (
        <div key={group} className="mb-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">{title}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {WINKS.filter((wink) => wink.group === group).map((wink) => (
              <WinkTile key={wink.id} wink={wink} active={wink.id === selected} onPick={() => pick(wink.id)} onSend={() => onSend(wink.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WinkTile({ wink, active, onPick, onSend }: { wink: Wink; active: boolean; onPick: () => void; onSend: () => void }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl bg-surface px-2 py-3 ${active ? 'border-2 border-primary' : 'border border-outline/15'}`}>
      <button type="button" data-testid={`guino-${wink.id}`} onClick={onPick} className="flex w-full flex-col items-center">
        <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-primary/10">
          {wink.kind === 'character' ? <WinkCharacter wink={wink} size={46} animate={false} /> : <span className="text-[30px] leading-none">{wink.hero}</span>}
        </span>
        <span className="mt-2 line-clamp-2 min-h-[34px] text-center text-[13px] font-semibold leading-[17px]">{wink.name}</span>
      </button>
      {active ? (
        <button type="button" data-testid={`enviar-guino-${wink.id}`} onClick={onSend} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-[13px] font-bold text-on-primary">
          <Send size={14} /> Enviar
        </button>
      ) : null}
    </div>
  );
}
