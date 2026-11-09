import { useState } from 'react';
import { ChevronRight, MapPin, Paperclip } from 'lucide-react';
import { peopleOnCard, peoplePhotos, personEvidence, personTime, shortPersonName, type BotBlock, type PersonEvidence } from '@lilachat/shared';
import { usePortalFileViewer } from '../../spaces/clients/PortalFileViewer';
import { Avatar } from '../../ui/Avatar';
import { BlockChart } from './BlockChart';
import { BlockGallery } from './BlockGallery';
import { BlockTank } from './BlockTank';
import { BlockWeather } from './BlockWeather';
import { useCardCommand } from './cardCommand';
import { TONE } from './tones';

type PeopleBlock = Extract<BotBlock, { type: 'people' }>;

/** On the card: who it is at a glance, face and short name (José, 04/11). */
function PeopleOnCard({ block }: { block: PeopleBlock }) {
  const { names, more } = peopleOnCard(block);
  return (
    <div data-testid="bloque-personas" className="flex flex-wrap items-center gap-2">
      {names.map((name, index) => <span key={`${name}-${index}`} className="inline-flex items-center gap-1.5 text-[13px]"><Avatar name={name} size={26} />{shortPersonName(name)}{personTime(block, index) ? <span className="text-[12px] tabular-nums text-on-surface-variant">{personTime(block, index)}</span> : null}</span>)}
      {more ? <span className="text-[12px] text-on-surface-variant">+{more}</span> : null}
    </div>
  );
}

/** The photo of a mark; once its link expires, the initials again. */
function MarkPhoto(props: { name: string; url: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Avatar name={props.name} size={26} />;
  return (
    <button type="button" data-testid="foto-de-marca" onClick={props.onOpen} className="shrink-0">
      <img src={props.url} alt={`Foto de ${props.name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-12 w-12 rounded-[10px] object-cover" />
    </button>
  );
}

/** Where it was signed; with a map link it opens the map. */
function MarkPlace({ evidence }: { evidence: PersonEvidence }) {
  const { map, place } = evidence;
  if (!map && !place) return null;
  const label = <><MapPin size={13} aria-hidden className="shrink-0" /><span className="truncate">{place ?? 'Ver en el mapa'}</span></>;
  if (!map) return <span data-testid="lugar-de-marca" className="mt-0.5 flex items-center gap-1 text-[12px] text-on-surface-variant">{label}</span>;
  return <a data-testid="lugar-de-marca" href={map} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex w-fit max-w-full items-center gap-1 text-[12px] font-semibold text-primary">{label}</a>;
}

/** In the detail: everybody with their whole name, one per row, and what backs their mark when the app sends it (José, 04/11). */
function PeopleList({ block }: { block: PeopleBlock }) {
  const viewer = usePortalFileViewer();
  const photos = peoplePhotos(block);
  const show = (url: string) => {
    const file = photos.find((one) => one.url === url);
    if (file) viewer.open(file, photos);
  };
  return (
    <div data-testid="bloque-personas" className="divide-y divide-outline/10">
      {block.names.map((name, index) => {
        const evidence = personEvidence(block, index);
        return (
          <div key={`${name}-${index}`} className="flex min-h-[44px] items-center gap-3 py-1.5 text-[14px]">
            {evidence.photo ? <MarkPhoto name={name} url={evidence.photo} onOpen={() => show(evidence.photo ?? '')} /> : <Avatar name={name} size={26} />}
            <div className="min-w-0 flex-1">
              <span className="block">{name}</span>
              <MarkPlace evidence={evidence} />
            </div>
            {personTime(block, index) ? <span className="text-[13px] font-semibold tabular-nums">{personTime(block, index)}</span> : null}
          </div>
        );
      })}
      {block.more ? <p className="py-2 text-[13px] text-on-surface-variant">{`y ${block.more} más`}</p> : null}
      {viewer.viewer}
    </div>
  );
}

type RowsBlock = Extract<BotBlock, { type: 'rows' }>;

function RowBody({ row, tappable }: { row: RowsBlock['rows'][number]; tappable: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3 text-[14px]">
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {row.bar !== undefined ? <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-variant"><span className={`block h-full rounded-full ${TONE[row.tone].bar}`} style={{ width: `${Math.round(row.bar * 100)}%` }} /></span> : null}
        <span className={`text-[13px] font-semibold tabular-nums ${row.tone === 'neutral' ? '' : TONE[row.tone].text}`}>{row.value}</span>
        {tappable ? <ChevronRight size={16} className="shrink-0 text-on-surface-variant" /> : null}
      </div>
      {row.sub ? <span className="mt-0.5 text-[12px] text-on-surface-variant">{row.sub}</span> : null}
    </>
  );
}

/** A row with a command runs it on a tap, like typing it (José, 05/11). */
function Rows({ rows }: { rows: RowsBlock['rows'] }) {
  const run = useCardCommand();
  return (
    <div data-testid="bloque-filas" className="divide-y divide-outline/10">
      {rows.map((row, index) => {
        const key = `${row.label}-${index}`;
        const { command } = row;
        if (!run || !command) return <div key={key} className="flex min-h-[44px] flex-col justify-center py-2"><RowBody row={row} tappable={false} /></div>;
        return <button key={key} type="button" data-testid={`fila-comando-${index}`} onClick={() => run(command)} className="flex min-h-[44px] w-full flex-col justify-center py-2 text-left hover:bg-background"><RowBody row={row} tappable /></button>;
      })}
    </div>
  );
}

function Block({ block }: { block: BotBlock }) {
  switch (block.type) {
    case 'metric':
      return (
        <div data-testid="bloque-cifra">
          {block.label ? <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{block.label}</p> : null}
          <p className={`text-[26px] font-bold tabular-nums ${block.tone === 'neutral' ? '' : TONE[block.tone].text}`}>{block.value}{block.unit ? <span className="ml-1 text-[15px] font-semibold text-on-surface-variant">{block.unit}</span> : null}</p>
        </div>
      );
    case 'chips':
      return (
        <div data-testid="bloque-chips" className="flex gap-1.5">
          {block.items.map((chip) => (
            <div key={chip.label} className={`flex flex-1 flex-col items-center rounded-lg border px-1 py-1.5 ${TONE[chip.tone].soft}`}>
              <span className={`text-[12px] font-semibold ${TONE[chip.tone].text}`}>{chip.label}</span>
              {chip.sub ? <span className={`truncate text-[11px] ${TONE[chip.tone].text}`}>{chip.sub}</span> : null}
            </div>
          ))}
        </div>
      );
    case 'chart':
      return <BlockChart chart={block} />;
    case 'progress': {
      const percent = Math.round((block.value / block.max) * 100);
      return (
        <div data-testid="bloque-progreso">
          {/* Without a label the card's title is the headline (design r155): only the share is left above the bar. */}
          <div className="flex items-baseline justify-between">{block.label ? <span className="text-[15px] font-semibold">{block.label}: <span className="text-primary">{block.value}</span> de {block.max}</span> : <span />}<span className="text-[12px] text-on-surface-variant">{percent} %</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant"><div className={`h-full rounded-full ${TONE[block.tone === 'neutral' ? 'info' : block.tone].bar}`} style={{ width: `${percent}%` }} /></div>
        </div>
      );
    }
    case 'tank':
      return <BlockTank items={block.items} />;
    case 'text':
      // A warning or an error is a tinted box (design r155: «3 faltan: …»); the rest, a plain line.
      return <p data-testid="bloque-texto" className={`text-[13px] ${block.tone === 'neutral' ? 'text-on-surface-variant' : TONE[block.tone].text} ${block.tone === 'warn' || block.tone === 'error' ? `rounded-lg border px-2.5 py-1.5 ${TONE[block.tone].soft}` : ''}`}>{block.text}</p>;
    case 'rows':
      return <Rows rows={block.rows} />;
    case 'people':
      return <PeopleOnCard block={block} />;
    case 'attachments':
      return (
        <a data-testid="bloque-adjuntos" href={block.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
          <Paperclip size={14} className="text-on-surface-variant" /> {block.label}
        </a>
      );
    case 'gallery':
      return <BlockGallery block={block} />;
    case 'weather':
      return <BlockWeather block={block} />;
  }
}

/** The kit's blocks (§118.4), one under the other with the card's rhythm. */
export function BotBlocksView({ blocks, detail = false }: { blocks: readonly BotBlock[]; detail?: boolean }) {
  return <div className="flex flex-col gap-3">{blocks.map((block, index) => (detail && block.type === 'people' ? <PeopleList key={`${block.type}-${index}`} block={block} /> : <Block key={`${block.type}-${index}`} block={block} />))}</div>;
}
