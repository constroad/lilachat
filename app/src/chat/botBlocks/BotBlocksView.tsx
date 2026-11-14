import { useContext, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, MapPin, Paperclip } from 'lucide-react-native';
import { peopleOnCard, peoplePhotos, personEvidence, personTime, shortPersonName, type BotBlock, type PersonEvidence } from '@lilachat/shared';
import { useFileViewer } from '../../spaces/clients/useFileViewer';
import { InVisitCardContext } from '../../spaces/visits/visitCardContext';
import { VisitFigures, VisitText } from '../../spaces/visits/VisitCardBlocks';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { useAccionesDeTarjeta } from '../accionesDeTarjeta';
import { BlockChart } from './BlockChart';
import { BlockSection, BlockStat, BlockTiles } from './BlockDesign';
import { BlockGallery } from './BlockGallery';
import { BlockMap } from './BlockMap';
import { BlockTank } from './BlockTank';
import { BlockWeather } from './BlockWeather';
import { TONE_CLASS, TONE_COLOR } from './tones';

const PEOPLE_SIZE = 26;
const MARK_PHOTO_SIZE = 48;
type PeopleBlock = Extract<BotBlock, { type: 'people' }>;

/** On the card: who it is at a glance, face and short name (José, 04/11). */
function PeopleOnCard({ block }: { block: PeopleBlock }) {
  const { names, more } = peopleOnCard(block);
  return (
    <View testID="bloque-personas" className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
      {names.map((name, index) => (
        <View key={`${name}-${index}`} className="flex-row items-center gap-1.5">
          <Avatar nombre={name} tamano={PEOPLE_SIZE} />
          <Text className="text-[13px] text-on-surface">{shortPersonName(name)}</Text>
          {personTime(block, index) ? <Text className="text-[12px] text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>{personTime(block, index)}</Text> : null}
        </View>
      ))}
      {more ? <Text className="text-[12px] text-on-surface-variant">+{more}</Text> : null}
    </View>
  );
}

/** The photo of a mark; once its link expires, the initials again. */
function MarkPhoto(props: { name: string; url: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Avatar nombre={props.name} tamano={PEOPLE_SIZE} />;
  return (
    <Pressable testID="foto-de-marca" accessibilityRole="imagebutton" accessibilityLabel={`Foto de ${props.name}`} onPress={props.onOpen}>
      <Image source={{ uri: props.url }} onError={() => setFailed(true)} contentFit="cover" style={{ width: MARK_PHOTO_SIZE, height: MARK_PHOTO_SIZE, borderRadius: 10 }} />
    </Pressable>
  );
}

/** Where it was signed; with a map link it opens the map. */
function MarkPlace({ evidence }: { evidence: PersonEvidence }) {
  const colors = useColores();
  const { map, place } = evidence;
  if (!map && !place) return null;
  return (
    <Pressable testID="lugar-de-marca" disabled={!map} accessibilityRole={map ? 'link' : undefined} onPress={() => map && void Linking.openURL(map)} className="mt-0.5 flex-row items-center gap-1 self-start">
      <MapPin size={13} color={colors[map ? 'primary' : 'on-surface-variant']} />
      <Text className={`shrink text-[12px] ${map ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{place ?? 'Ver en el mapa'}</Text>
    </Pressable>
  );
}

/** In the detail: everybody with their whole name, one per row, and what backs their mark when the app sends it (José, 04/11). */
function PeopleList({ block }: { block: PeopleBlock }) {
  const viewer = useFileViewer();
  const photos = peoplePhotos(block);
  const show = (url: string) => {
    const file = photos.find((one) => one.url === url);
    if (file) viewer.open(file, photos);
  };
  return (
    <View testID="bloque-personas">
      {block.names.map((name, index) => {
        const evidence = personEvidence(block, index);
        return (
          <View key={`${name}-${index}`} className={`min-h-[44px] flex-row items-center gap-3 py-1.5 ${index ? 'border-t border-outline/10' : ''}`}>
            {evidence.photo ? <MarkPhoto name={name} url={evidence.photo} onOpen={() => show(evidence.photo ?? '')} /> : <Avatar nombre={name} tamano={PEOPLE_SIZE} />}
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] text-on-surface">{name}</Text>
              <MarkPlace evidence={evidence} />
            </View>
            {personTime(block, index) ? <Text className="text-[13px] font-semibold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{personTime(block, index)}</Text> : null}
          </View>
        );
      })}
      {block.more ? <Text className="py-2 text-[13px] text-on-surface-variant">{`y ${block.more} más`}</Text> : null}
      {viewer.viewer}
    </View>
  );
}

type RowsBlock = Extract<BotBlock, { type: 'rows' }>;

function RowBody({ row, tappable }: { row: RowsBlock['rows'][number]; tappable: boolean }) {
  const colors = useColores();
  return (
    <>
      <View className="flex-row items-center gap-3">
        <Text className="min-w-0 flex-1 text-[14px] text-on-surface">{row.label}</Text>
        {row.mid ? <Text testID="fila-medio" className="text-[13px] text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>{row.mid}</Text> : null}
        {row.bar !== undefined ? (
          <View className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-variant">
            <View className="h-full rounded-full" style={{ width: `${Math.round(row.bar * 100)}%`, backgroundColor: colors[TONE_COLOR[row.tone]] }} />
          </View>
        ) : null}
        <Text className={`text-[13px] font-semibold ${row.tone === 'neutral' ? 'text-on-surface' : TONE_CLASS[row.tone].text}`} style={{ fontVariant: ['tabular-nums'] }}>
          {row.before ? <Text testID="fila-antes" className="font-normal text-on-surface-variant" style={{ textDecorationLine: 'line-through' }}>{row.before}</Text> : null}
          {row.before ? ' → ' : null}
          {row.value}
        </Text>
        {tappable ? <ChevronRight size={16} color={colors['on-surface-variant']} /> : null}
      </View>
      {row.sub ? <Text className="mt-0.5 text-[12px] text-on-surface-variant">{row.sub}</Text> : null}
    </>
  );
}

/** Rows for the detail: label and value, an optional mini bar and a second line (districts, today's readings, who is missing). One with a command runs it on a tap (José, 05/11). */
function Rows({ rows }: { rows: RowsBlock['rows'] }) {
  const { runLine } = useAccionesDeTarjeta();
  return (
    <View testID="bloque-filas">
      {rows.map((row, index) => {
        const key = `${row.label}-${index}`;
        const frame = `min-h-[44px] justify-center py-2 ${index ? 'border-t border-outline/10' : ''}`;
        const { command } = row;
        if (!runLine || !command) return <View key={key} className={frame}><RowBody row={row} tappable={false} /></View>;
        return <Pressable key={key} testID={`fila-comando-${index}`} accessibilityRole="button" accessibilityLabel={row.label} onPress={() => runLine(command)} className={frame}><RowBody row={row} tappable /></Pressable>;
      })}
    </View>
  );
}

function Block({ block }: { block: BotBlock }) {
  const colors = useColores();
  switch (block.type) {
    case 'metric':
      return (
        <View testID="bloque-cifra">
          {block.label ? <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{block.label}</Text> : null}
          <Text className={`text-[26px] font-bold ${block.tone === 'neutral' ? 'text-on-surface' : TONE_CLASS[block.tone].text}`} style={{ fontVariant: ['tabular-nums'] }}>{block.value}{block.unit ? <Text className="text-[15px] font-semibold text-on-surface-variant">{` ${block.unit}`}</Text> : null}</Text>
        </View>
      );
    case 'chips':
      return (
        <View testID="bloque-chips" className="flex-row" style={{ gap: 6 }}>
          {block.items.map((chip) => (
            <View key={chip.label} className={`flex-1 items-center rounded-lg border px-1 py-1.5 ${TONE_CLASS[chip.tone].soft}`}>
              <Text className={`text-[12px] font-semibold ${TONE_CLASS[chip.tone].text}`}>{chip.label}</Text>
              {chip.sub ? <Text className={`text-center text-[11px] ${TONE_CLASS[chip.tone].text}`}>{chip.sub}</Text> : null}
            </View>
          ))}
        </View>
      );
    case 'chart':
      return <BlockChart chart={block} />;
    case 'progress':
      return (
        <View testID="bloque-progreso">
          <View className="flex-row items-baseline justify-between">
            {/* Without a label the card's title is the headline (design r155): only the share is left above the bar. */}
            {block.label ? <Text className="text-[15px] font-semibold text-on-surface">{block.label}: <Text className="text-primary">{block.value}</Text> de {block.max}</Text> : <View />}
            <Text className="text-[12px] text-on-surface-variant">{Math.round((block.value / block.max) * 100)} %</Text>
          </View>
          <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant">
            <View className="h-full rounded-full" style={{ width: `${Math.round((block.value / block.max) * 100)}%`, backgroundColor: colors[TONE_COLOR[block.tone === 'neutral' ? 'info' : block.tone]] }} />
          </View>
        </View>
      );
    case 'tank':
      return <BlockTank items={block.items} />;
    case 'text':
      // A warning or an error is a tinted box (design r155: «3 faltan: …»); the rest, a plain line.
      return <Text testID="bloque-texto" className={`text-[13px] ${block.tone === 'neutral' ? 'text-on-surface-variant' : TONE_CLASS[block.tone].text} ${block.tone === 'warn' || block.tone === 'error' ? `overflow-hidden rounded-lg border px-2.5 py-1.5 ${TONE_CLASS[block.tone].soft}` : ''}`}>{block.text}</Text>;
    case 'rows':
      return <Rows rows={block.rows} />;
    case 'people':
      return <PeopleOnCard block={block} />;
    case 'attachments':
      return (
        <Pressable testID="bloque-adjuntos" onPress={() => void Linking.openURL(block.url)} className="min-h-[36px] flex-row items-center gap-1.5 self-start rounded-full border border-outline/20 px-3">
          <Paperclip size={14} color={colors['on-surface-variant']} />
          <Text className="text-[13px] font-semibold text-on-surface">{block.label}</Text>
        </Pressable>
      );
    case 'gallery':
      return <BlockGallery block={block} />;
    case 'map':
      return <BlockMap block={block} />;
    case 'weather':
      return <BlockWeather block={block} />;
    case 'stat':
      return <BlockStat block={block} />;
    case 'section':
      return <BlockSection block={block} />;
    case 'tiles':
      return <BlockTiles block={block} />;
  }
}

/** In a visit card (lv01) the address, what is missing and the figures follow the design; the rest as always. */
function CardBlock({ block, inVisit }: { block: BotBlock; inVisit: boolean }) {
  if (inVisit && block.type === 'text') return <VisitText block={block} />;
  if (inVisit && block.type === 'tiles') return <VisitFigures block={block} />;
  return <Block block={block} />;
}

/** The kit's blocks (§118.4), one under the other with the card's rhythm. */
export function BotBlocksView({ blocks, detail = false }: { blocks: readonly BotBlock[]; detail?: boolean }) {
  const inVisit = useContext(InVisitCardContext);
  return (
    <View className="gap-3">
      {blocks.map((block, index) => (detail && block.type === 'people' ? <PeopleList key={`${block.type}-${index}`} block={block} /> : <CardBlock key={`${block.type}-${index}`} block={block} inVisit={inVisit} />))}
    </View>
  );
}
