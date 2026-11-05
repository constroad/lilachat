import { Text, View } from 'react-native';
import { formatClock, type BotCard } from '@lilachat/shared';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { AccionesDeTarjetaContext, useAccionesDeTarjeta } from '../accionesDeTarjeta';
import { BotBlocksView } from './BotBlocksView';

/**
 * A card's detail (§118.2: the data come with the message, so it opens at once
 * and without signal): the sheet with the rest of the blocks — the districts,
 * today's readings, who is missing. The thread stays for people.
 */
export function BotCardDetail(props: { card: BotCard; visible: boolean; onClose: () => void }) {
  const { card } = props;
  const actions = useAccionesDeTarjeta();
  if (!card.detail) return null;
  const { runLine } = actions;
  // A row's answer lands in the chat, behind this sheet: it closes first.
  const closeAndRun = runLine ? (line: string) => { props.onClose(); runLine(line); } : undefined;
  return (
    <PantallaEnModal visible={props.visible} titulo={card.detail.title} onCerrar={props.onClose} testIDCerrar="detalle-tarjeta-cerrar">
      <View testID="detalle-tarjeta" className="gap-1 px-4 pb-8 pt-2">
        {card.kicker || card.updatedAt ? (
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            {[card.kicker, card.updatedAt ? `Actualizado ${formatClock(card.updatedAt)}` : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <AccionesDeTarjetaContext.Provider value={{ ...actions, runLine: closeAndRun }}>
          <BotBlocksView blocks={card.detail.blocks} detail />
        </AccionesDeTarjetaContext.Provider>
      </View>
    </PantallaEnModal>
  );
}
