import { Pressable, Text, View } from 'react-native';
import { MessagesSquare } from 'lucide-react-native';
import { newRepliesLine, type ThreadSummaryOfRoot } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/**
 * The band that says someone answered in a thread (José asked for it on
 * 16/11, as Slack does). Thread replies do not show
 * in the chat, so the chat says where they are and opens the newest one. It
 * goes away once every thread is seen.
 */
export function ThreadRepliesBanner({
  threads,
  rootText,
  nameOf,
  onOpen,
}: {
  threads: readonly ThreadSummaryOfRoot[];
  /** What the root says, when it is loaded: which conversation they answered. */
  rootText: (root: number) => string | undefined;
  nameOf: (userId: string) => string | undefined;
  onOpen: (root: number) => void;
}) {
  const colores = useColores();
  const newest = threads[0];
  if (!newest) return null;
  const quote = threads.length === 1 ? rootText(newest.root) : undefined;

  return (
    <Pressable
      testID="banda-hilo-nuevo"
      onPress={() => onOpen(newest.root)}
      className="mx-3 mt-2 min-h-[44px] flex-row items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2"
    >
      <MessagesSquare size={16} color={colores.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-semibold text-on-surface" numberOfLines={1}>
          {newRepliesLine(threads, nameOf)}
        </Text>
        {quote ? (
          <Text className="text-[11px] text-on-surface-variant" numberOfLines={1}>
            {quote}
          </Text>
        ) : null}
      </View>
      <Text className="text-[13px] font-bold text-primary">Ver</Text>
    </Pressable>
  );
}
