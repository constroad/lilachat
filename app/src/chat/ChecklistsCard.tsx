import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, ClipboardCheck } from 'lucide-react-native';
import { checklistSummaryLine, type ChecklistSummary } from '@lilachat/shared';
import { agendaGet } from '../agenda/agendaApi';
import { useColores } from '../ui/tema';

/** How many the card shows before «Ver los N checklists». */
const VISIBLE = 3;

/**
 * «Checklists» in the chat info (backlog 30, José 21/10: «el checklist se
 * podría perder en los mensajes»; design `k-05-checklists-del-chat`): each
 * with its progress and what is late; a tap jumps to its card in the chat.
 */
export function ChecklistsCard(props: { chatId: string; jwt: string; onOpen: (seq: number) => void }) {
  const colors = useColores();
  const [checklists, setChecklists] = useState<ChecklistSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let current = true;
    void agendaGet<{ checklists: ChecklistSummary[] }>(`/checklists?chatId=${props.chatId}`, props.jwt).then((response) => {
      if (!current) return;
      if (response.ok) setChecklists(response.data.checklists);
      else setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [props.chatId, props.jwt]);

  if (failed) return <Text className="mx-4 mt-4 text-[13px] text-on-surface-variant">No se pudieron cargar los checklists.</Text>;
  if (!checklists?.length) return null;
  const shown = all ? checklists : checklists.slice(0, VISIBLE);
  return (
    <View testID="tarjeta-checklists" className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/10 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <ClipboardCheck size={16} color={colors.primary} />
        <Text className="text-[15px] font-semibold text-on-surface">Checklists</Text>
        <View className="rounded-full bg-primary/10 px-2 py-0.5">
          <Text className="text-[12px] font-semibold text-primary">{checklists.length}</Text>
        </View>
      </View>
      {shown.map((checklist) => {
        const line = checklistSummaryLine(checklist);
        const { cardSeq } = checklist;
        return (
          <Pressable key={checklist._id} testID={`checklist-del-chat-${checklist._id}`} disabled={!cardSeq} onPress={() => cardSeq && props.onOpen(cardSeq)} className="min-h-[64px] flex-row items-center gap-3 border-t border-outline/10 px-4 py-2.5">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck size={19} color={colors.primary} />
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{checklist.title}</Text>
              <View className="my-1 h-1 overflow-hidden rounded-full bg-primary/10">
                <View className="h-full rounded-full bg-primary" style={{ width: `${checklist.total ? (checklist.done / checklist.total) * 100 : 0}%` }} />
              </View>
              <Text className="text-[12px] text-on-surface-variant">
                {line.complete ? 'Completo · ' : ''}
                {line.progress}
                {line.late ? <Text className="font-semibold text-error">{` · ${line.late}`}</Text> : null}
              </Text>
            </View>
            {cardSeq ? <ChevronRight size={18} color={colors.outline} /> : null}
          </Pressable>
        );
      })}
      {checklists.length > VISIBLE ? (
        <Pressable testID="btn-ver-todos-checklists" onPress={() => setAll((before) => !before)} className="min-h-[44px] items-center justify-center border-t border-outline/10">
          <Text className="text-[14px] font-semibold text-primary">{all ? 'Ver menos' : `Ver los ${checklists.length} checklists`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
