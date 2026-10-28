import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CHAT_DETAIL_TAB_LABEL, type ChatDetailTab } from '@lilachat/shared';

/**
 * The tabs under the chat's identity (pending 69, design `r151-detalle-grupo`): the active one underlined in the brand color.
 * The app's detail uses them too (pending 99, design c-04), with its own labels.
 */
export function DetailTabBar<K extends string = ChatDetailTab>(props: { tabs: readonly K[]; active: K; onChange: (tab: K) => void; labelOf?: (tab: K) => string }) {
  return (
    <View testID="pestanas-detalle" className="mt-6 flex-row border-b border-t border-outline/10 bg-surface">
      {props.tabs.map((tab) => {
        const active = tab === props.active;
        return (
          <Pressable
            key={tab}
            testID={`pestana-detalle-${tab}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => props.onChange(tab)}
            className={`min-h-[52px] flex-1 items-center justify-center border-b-2 ${active ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`text-[15px] ${active ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}`} numberOfLines={1}>{props.labelOf ? props.labelOf(tab) : CHAT_DETAIL_TAB_LABEL[tab as ChatDetailTab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The round buttons of the actions row. Only the ones that DO something go: a
 * button that looks normal and does not react teaches that this app's buttons
 * do not work.
 */
export function RoundAction(props: { children: ReactNode; label: string; onPress?: () => void; testID: string }) {
  return (
    <Pressable testID={props.testID} onPress={props.onPress} accessibilityLabel={props.label} className="items-center">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">{props.children}</View>
      <Text className="mt-1 text-[11px] text-on-surface-variant">{props.label}</Text>
    </Pressable>
  );
}
