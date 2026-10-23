import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bot } from 'lucide-react-native';
import { useColores } from '../../ui/tema';

/** The square's corner against its side (designs e-23 to e-26): 40 dp → 10. */
const CORNER_RATIO = 0.25;
const ICON_RATIO = 0.55;

/** An app's square logo (its `avatar_url`, an SVG works), or the robot on the accent when it has none or it does not load. */
export function AppLogo(props: { avatarUrl?: string; size: number; testID?: string }) {
  const colors = useColores();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const side = { width: props.size, height: props.size, borderRadius: Math.round(props.size * CORNER_RATIO) };
  if (props.avatarUrl && failedUrl !== props.avatarUrl) {
    return <Image testID={props.testID} recyclingKey={props.avatarUrl} source={{ uri: props.avatarUrl }} style={side} contentFit="cover" onError={() => setFailedUrl(props.avatarUrl ?? null)} />;
  }
  return (
    <View testID={props.testID} style={side} className="items-center justify-center bg-primary">
      <Bot size={Math.round(props.size * ICON_RATIO)} strokeWidth={1.75} color={colors['on-primary']} />
    </View>
  );
}

/** The small «APP» mark next to an app's name. */
export function AppBadge() {
  return (
    <View className="rounded bg-primary/10 px-1.5 py-0.5">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-primary">App</Text>
    </View>
  );
}
