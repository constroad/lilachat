import { useRef } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { EphemeralAnswer } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { BotCardView } from '../BotCardView';

const APP_AVATAR = 24;
/** The answers never take more than this share of the screen: the conversation stays in sight. */
const MAX_SCREEN_SHARE = 0.45;

/**
 * What an app answered only to me (§c-bis), over the bar like Slack's
 * «Only visible to you»: never stored, gone when the chat closes. A card here
 * has no actions to tap: there is no message behind it.
 */
export function EphemeralAnswers(props: { answers: readonly EphemeralAnswer[]; onDismiss: (commandId: string) => void; chatId: string; jwt: string }) {
  const colors = useColores();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  if (props.answers.length === 0) return null;
  return (
    <ScrollView testID="respuestas-efimeras" style={{ maxHeight: height * MAX_SCREEN_SHARE, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }} className="border-t border-outline/10 bg-surface px-3 py-2" keyboardShouldPersistTaps="handled" ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
      {props.answers.map((answer) => (
        <View key={answer.commandId} testID={`efimera-${answer.state}`} className="rounded-2xl border border-outline/15 bg-background px-3 pb-2.5 pt-2">
          <View className="flex-row items-center gap-2">
            <Avatar nombre={answer.appName} tamano={APP_AVATAR} bot />
            <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{answer.appName}</Text>
            <Text className="min-w-0 flex-1 text-[12px] text-on-surface-variant" numberOfLines={1}>
              {answer.command ? `/${answer.command} · ` : ''}Solo tú ves esto
            </Text>
            <Pressable testID="btn-descartar-efimera" accessibilityLabel="Descartar" onPress={() => props.onDismiss(answer.commandId)} hitSlop={8} className="h-8 w-8 items-center justify-center">
              <X size={16} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
          {answer.state === 'pending' ? <Text className="mt-1 text-[14px] italic text-on-surface-variant">{`${answer.appName} está trabajando…`}</Text> : null}
          {answer.state === 'failed' ? <Text className="mt-1 text-[14px] text-error">{answer.message}</Text> : null}
          {answer.response?.text ? (
            <Text selectable className="mt-1 text-[15px] text-on-surface">
              {answer.response.text}
            </Text>
          ) : null}
          {answer.response?.card ? (
            <View className="mt-2">
              <BotCardView card={{ ...answer.response.card, actions: [] }} chatId={props.chatId} seq={0} jwt={props.jwt} />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
