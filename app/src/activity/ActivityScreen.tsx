import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowRight, CornerUpLeft, MessagesSquare } from 'lucide-react-native';
import { ACTIVITY_TABS, activityDaySections, formatChatTimestamp, formatPhoneDisplay, type ActivityItem, type ActivityType, type ClientWorkspace } from '@lilachat/shared';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { Segmentado } from '../ui/Segmentado';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { TextoDelMensaje } from '../chat/TextoDelMensaje';
import { activityCache, fetchActivity, useCached } from '../spaces/spaceCache';

const EMPTY: Record<ActivityType, string> = { mentions: 'Nadie te mencionó todavía.', threads: 'Todavía no estás en ningún hilo.', reactions: 'Todavía nadie reaccionó a tus mensajes.' };
const nameOf = (person: { name?: string; phone?: string }) => person.name?.trim() || (person.phone ? formatPhoneDisplay(person.phone) : 'Alguien');
const chatLabel = (item: ActivityItem) => (item.chat.channel ? `#${item.chat.name ?? ''}` : (item.chat.name ?? (item.chat.phone ? formatPhoneDisplay(item.chat.phone) : 'Conversación')));

/**
 * «Menciones y actividad» of a space (design `e-19-menciones-actividad`):
 * Menciones · Hilos · Reacciones with what is new, by day; each card says who,
 * where and when, the message with its mentions, and opens the chat there.
 */
export function ActivityScreen(props: { visible: boolean; space: ClientWorkspace; jwt: string; myUserId: string; initialTab: ActivityType; onOpen: (item: ActivityItem) => void; onClose: () => void }) {
  const colors = useColores();
  const [tab, setTab] = useState<ActivityType>(props.initialTab);
  useEffect(() => {
    if (props.visible) setTab(props.initialTab);
  }, [props.visible, props.initialTab]);
  // Each tab keeps what it showed: Menciones → Hilos → Menciones no longer goes grey three times (22/10).
  const page = useCached(activityCache, `${props.space.id}:activity:${tab}`, fetchActivity(props.jwt, props.space.id, tab), props.visible);
  const items: ActivityItem[] | null = page.value?.items ?? null;
  const unread = page.value?.unread ?? { mentions: 0, threads: 0 };
  const error = items ? '' : (page.error ?? '');

  const counts: Partial<Record<ActivityType, number>> = { mentions: unread.mentions, threads: unread.threads };
  return (
    <PantallaEnModal visible={props.visible} titulo="Menciones y actividad" onCerrar={props.onClose} testIDCerrar="actividad-volver">
      <View className="px-4 pb-2">
        <Segmentado<ActivityType> opciones={ACTIVITY_TABS.map((option) => ({ key: option.type, etiqueta: option.label, testID: `actividad-${option.type}`, cuenta: counts[option.type] }))} valor={tab} onCambiar={setTab} />
      </View>
      <ScrollView testID="lista-actividad" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
        {items === null && !error ? [0, 1, 2].map((index) => <View key={index} className="mt-3 h-28 rounded-2xl bg-surface-variant" />) : null}
        {items !== null && items.length === 0 ? <Text className="mt-10 text-center text-[14px] text-on-surface-variant">{EMPTY[tab]}</Text> : null}
        {activityDaySections(items ?? [], new Date()).map((section) => (
          <View key={section.title}>
            <View className="mb-2 mt-4 flex-row items-center justify-between">
              <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{section.title}</Text>
              {section.items.some((item) => item.unread) ? <Text className="text-[13px] font-semibold text-primary">{`${section.items.filter((item) => item.unread).length} nuevas`}</Text> : null}
            </View>
            {section.items.map((item) => (
              <Pressable key={`${item.chatId}:${item.seq}`} testID={`actividad-item-${item.seq}`} onPress={() => props.onOpen(item)} className="mb-3 rounded-2xl border border-outline/15 bg-surface p-4">
                <View className="flex-row items-start gap-3">
                  <Avatar nombre={nameOf(item.author)} tamano={44} />
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text numberOfLines={1} className="flex-1 text-[16px] font-bold text-on-surface">{nameOf(item.author)}</Text>
                      <Text className="text-[13px] text-on-surface-variant">{formatChatTimestamp(item.at)}</Text>
                      {item.unread ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                    </View>
                    <Text numberOfLines={1} className="text-[14px] font-semibold text-primary">{chatLabel(item)}</Text>
                  </View>
                </View>
                {item.body ? (
                  // Its spans are nested texts: outside a <Text> the words after a mention are dropped.
                  <Text className="mt-2 text-[15px] leading-[21px] text-on-surface">
                    <TextoDelMensaje texto={item.body} menciones={item.menciones} yo={props.myUserId} enBurbujaPropia={false} id={`actividad-${item.chatId}-${item.seq}`} />
                  </Text>
                ) : null}
                {item.reactions?.length ? (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {item.reactions.map((reaction) => <Text key={reaction.emoji} className="rounded-full border border-outline/20 px-2.5 py-1 text-[14px] text-on-surface">{`${reaction.emoji} ${reaction.count}`}</Text>)}
                  </View>
                ) : null}
                <View className="mt-3 flex-row items-center border-t border-outline/10 pt-3">
                  {tab === 'threads' ? <MessagesSquare size={16} color={colors.primary} /> : <CornerUpLeft size={16} color={colors.primary} />}
                  <Text className="ml-2 flex-1 text-[15px] font-semibold text-primary">{tab === 'threads' ? `${item.thread?.replies ?? 0} respuestas · Ver hilo` : tab === 'reactions' ? 'Ver en el chat' : 'Responder en el chat'}</Text>
                  <ArrowRight size={18} color={colors['on-surface-variant']} />
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </PantallaEnModal>
  );
}
