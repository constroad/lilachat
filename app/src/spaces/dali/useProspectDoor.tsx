import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, MessageCircle, Phone } from 'lucide-react-native';
import { prospectNameOf, prospectStripOf, shownProspectPhone, type ProspectView } from '@lilachat/shared';
import type { ProspectHeader } from '../../chat/EncabezadoDelChat';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { OriginPill, Pill, TextButton, useNow } from './daliParts';
import { callProspect } from './prospectSheetBlocks';
import { ProspectSheetScreen, useOneChangeAtATime } from './ProspectSheetScreen';
import { sendChange, sendHandBack, useProspectOfChat } from './sellerDesk';

/** The chat header's circle (dp), as every chat's. */
const HEADER_AVATAR = 40;
/** In a short strip the state («Dali en pausa») gives way long before who attends it. */
const STATE_SHRINK = 100;

type DoorParams = { jwt: string; spaceId?: string; chatId: string; me: string; /** The chat's name: the header's initials while the prospect loads. */ name: string; enabled: boolean };
export type ProspectDoor = { header?: ProspectHeader; strip: ReactNode; screen: ReactNode; composerNote: ReactNode };

const NO_DOOR: ProspectDoor = { strip: null, screen: null, composerNote: null };

/**
 * A Dali prospect's conversation in its channel (dl-02), the APK's `ProspectChat`: the prospect is read ONCE by its
 * chat. The header gets the client's circle, «phone · origin», «Llamar» (the phone's dialer, never a Lilachat call)
 * and «Ficha»; the strip under it says who attends it and whether Dali is paused, with «Tomar» and «Devolver a Dali»;
 * over the composer, that what is written leaves by WhatsApp. On the phone «Marcar resultado» lives in the ficha.
 * While it loads: the chat's initials and an empty line, without actions or strip.
 */
export function useProspectDoor(params: DoorParams): ProspectDoor {
  const { jwt, spaceId, chatId } = params;
  const { prospect, setProspect, reload } = useProspectOfChat(jwt, spaceId, chatId, params.enabled);
  const [sheetOpen, setSheetOpen] = useState(false);
  const run = useOneChangeAtATime(setProspect, reload);
  useEffect(() => {
    setSheetOpen(false);
  }, [chatId]);
  if (!params.enabled || !spaceId) return NO_DOOR;
  const composerNote = <WhatsAppNote />;
  if (!prospect) return { header: { avatar: <Avatar nombre={params.name.replace(/^# /, '')} tamano={HEADER_AVATAR} />, subtitle: <View className="h-6" />, actions: null }, strip: null, screen: null, composerNote };
  const close = () => setSheetOpen(false);
  return {
    header: { avatar: <ProspectCircle prospect={prospect} />, subtitle: <ProspectLine prospect={prospect} />, actions: <HeaderActions prospect={prospect} onSheet={() => setSheetOpen(true)} /> },
    strip: <ProspectStrip prospect={prospect} onTake={() => void run(() => sendChange(jwt, spaceId, prospect, { assignee: 'me' }))} onHandBack={() => void run(() => sendHandBack(jwt, spaceId, prospect))} />,
    // Inside the chat, «Abrir conversación» only closes the ficha: the conversation is under it.
    screen: sheetOpen ? <ChatProspectSheet visible prospect={prospect} jwt={jwt} spaceId={spaceId} me={params.me} onChanged={setProspect} onStale={reload} onClose={close} onOpenConversation={close} /> : null,
    composerNote,
  };
}

/** Its initials, or a phone while it has no name (as on the web). */
function ProspectCircle({ prospect }: { prospect: ProspectView }) {
  const colors = useColores();
  return <Avatar nombre={prospectNameOf(prospect)} tamano={HEADER_AVATAR} icono={prospect.name ? undefined : <Phone size={18} color={colors.primary} />} />;
}

/** Below this width (a tablet's chat beside the list) the origin goes: the number comes first, and «+51 …» says nothing. */
const ORIGIN_MIN_ROW = 150;

/** «+51 949 123 824 · META» (dl-02): the number on one line; without a name, the title already is the number. */
function ProspectLine({ prospect }: { prospect: ProspectView }) {
  const [rowWidth, setRowWidth] = useState(0);
  const showOrigin = !prospect.name || rowWidth === 0 || rowWidth >= ORIGIN_MIN_ROW;
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-1.5" onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      {prospect.name ? <Text numberOfLines={1} className="shrink text-xs text-on-surface-variant">{shownProspectPhone(prospect.phone)}</Text> : null}
      {showOrigin ? <OriginPill prospect={prospect} /> : null}
    </View>
  );
}

function HeaderActions({ prospect, onSheet }: { prospect: ProspectView; onSheet: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-1">
      {prospect.phone ? (
        <Pressable testID="cabecera-llamar" accessibilityRole="button" accessibilityLabel="Llamar" onPress={() => callProspect(prospect.phone)} className="h-11 w-11 items-center justify-center">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-outline/30">
            <Phone size={18} color={colors.primary} />
          </View>
        </Pressable>
      ) : null}
      <Pressable testID="cabecera-ficha" accessibilityRole="button" accessibilityLabel="Ficha del prospecto" onPress={onSheet} className="h-11 justify-center">
        <View className="h-10 flex-row items-center gap-0.5 rounded-xl border border-outline/30 pl-3 pr-2">
          <Text className="text-[13px] font-semibold text-on-surface">Ficha</Text>
          <ChevronRight size={14} color={colors['on-surface']} />
        </View>
      </Pressable>
    </View>
  );
}

/** Who attends it and whether Dali is paused; «Devolver a Dali» while a person answers; «Tomar» while nobody has it. */
function ProspectStrip({ prospect, onTake, onHandBack }: { prospect: ProspectView; onTake: () => void; onHandBack: () => void }) {
  const strip = prospectStripOf(prospect);
  return (
    <View testID="franja-prospecto" className="min-h-[48px] flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {strip.result ? (
          <Pill shrink tone={strip.result.won ? 'ok' : 'error'}>{strip.result.label}</Pill>
        ) : (
          <>
            <Pill shrink tone={strip.who.taken ? 'primary' : 'warn'}>{strip.who.label}</Pill>
            <Text numberOfLines={1} style={{ flexShrink: STATE_SHRINK }} className="text-[13px] text-on-surface-variant">{strip.state}</Text>
          </>
        )}
      </View>
      {strip.canHandBack ? <TextButton testID="franja-devolver-a-dali" onPress={onHandBack}>Devolver a Dali</TextButton> : null}
      {strip.canTake ? <TextButton testID="franja-tomar" onPress={onTake}>Tomar</TextButton> : null}
    </View>
  );
}

/** Over the composer of a prospect's channel: what is written there leaves Lilachat. */
function WhatsAppNote() {
  const colors = useColores();
  return (
    <View testID="aviso-whatsapp" className="flex-row items-center gap-1.5 border-t border-outline/10 bg-surface px-4 pt-2">
      <MessageCircle size={14} color={colors['on-surface-variant']} />
      <Text className="text-[12px] text-on-surface-variant">Se envía al cliente por WhatsApp</Text>
    </View>
  );
}

/**
 * The ficha over the chat, mounted only while open (closed, it would redraw with every message), with its own minute:
 * the clock ticks inside it and never re-renders the chat.
 */
function ChatProspectSheet(props: Omit<Parameters<typeof ProspectSheetScreen>[0], 'now'>) {
  const now = useNow(props.visible);
  return <ProspectSheetScreen {...props} now={now} />;
}
