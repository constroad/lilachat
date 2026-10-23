import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { SectionRow } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/**
 * A section's header in the chat list, like Slack's sidebar (pending 62,
 * design `r154-secciones`): the chevron says whether it is open; open, it
 * shows how many chats it has; folded, how many are unread, in the accent
 * pill. A long press edits it («Sin sección» has nothing to edit).
 */
export function SectionHeader(props: { row: SectionRow; onToggle: (sectionId: string) => void; onEdit?: (listId: string) => void }) {
  const colors = useColores();
  const { row } = props;
  const Chevron = row.collapsed ? ChevronRight : ChevronDown;
  const showUnread = row.collapsed && row.unread > 0;
  return (
    <Pressable
      testID={`seccion-${row.sectionId}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: !row.collapsed }}
      accessibilityLabel={`${row.title}, ${row.count} chats${showUnread ? `, ${row.unread} sin leer` : ''}`}
      onPress={() => props.onToggle(row.sectionId)}
      onLongPress={row.listId && props.onEdit ? () => props.onEdit?.(row.listId!) : undefined}
      className="mt-1 min-h-[48px] flex-row items-center gap-2 bg-primary/[0.05] px-4"
    >
      <Chevron size={18} color={colors['on-surface-variant']} />
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-[1.5px] text-on-surface">
        {row.title}
      </Text>
      {showUnread ? (
        <View testID={`seccion-sin-leer-${row.sectionId}`} className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5">
          <Text className="text-[12px] font-bold text-on-primary">{row.unread}</Text>
        </View>
      ) : (
        <Text className="text-[13px] text-on-surface-variant">{row.count}</Text>
      )}
    </Pressable>
  );
}
