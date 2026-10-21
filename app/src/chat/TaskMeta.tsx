import { Text, View } from 'react-native';
import { taskDueLabel, taskDueState, type ChecklistItem, type TaskDueState } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/** The date pill by state: late in the error tone, today in the accent, later in grey. */
const PILL: Record<Exclude<TaskDueState, 'done' | 'none'>, { box: string; text: string }> = {
  overdue: { box: 'bg-error/10', text: 'font-bold text-error' },
  today: { box: 'bg-primary/10', text: 'font-semibold text-primary' },
  upcoming: { box: 'bg-surface-variant', text: 'text-on-surface-variant' },
};
const MINI_AVATAR = 18;

/**
 * Under a pending task (design `k-03-checklist-responsables`): who does it
 * and the date as a pill. The task's own row opens its sheet; «Sin
 * responsable» shows only to whoever may assign one.
 */
export function TaskMeta(props: { item: ChecklistItem; index: number; name: string | null; showEmpty: boolean }) {
  const { item } = props;
  const now = new Date();
  const state = taskDueState(item, now);
  const pill = state === 'overdue' || state === 'today' || state === 'upcoming' ? PILL[state] : null;
  if (!props.name && !pill && !props.showEmpty) return null;
  return (
    <View testID={`checklist-tarea-meta-${props.index}`} className="mt-1 flex-row flex-wrap items-center gap-1.5">
      {props.name ? <Avatar nombre={props.name} tamano={MINI_AVATAR} /> : null}
      <Text className={`text-[12px] ${props.name ? 'text-on-surface' : 'text-on-surface-variant/70'}`}>{props.name ?? 'Sin responsable'}</Text>
      {pill && item.dueAt ? (
        <Text className={`overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] ${pill.box} ${pill.text}`}>{taskDueLabel(item.dueAt, now)}</Text>
      ) : null}
    </View>
  );
}
