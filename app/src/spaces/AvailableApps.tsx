import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bot } from 'lucide-react-native';
import type { AvailableApp } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { availableApps } from './spacesApi';

/**
 * The apps an admin can install in this space (agentes, 23/10): «Instalar»
 * opens the app's own page in the browser — it asks the company first — with
 * this space already chosen. The ones already installed are listed above.
 */
export function AvailableApps(props: { jwt: string; spaceId: string }) {
  const colors = useColores();
  const [apps, setApps] = useState<AvailableApp[]>([]);
  useEffect(() => {
    void availableApps(props.jwt, props.spaceId).then((result) => setApps(result.ok ? result.data.apps.filter((app) => !app.installed) : []));
  }, [props.jwt, props.spaceId]);
  if (apps.length === 0) return null;
  return (
    <View testID="apps-para-instalar" className="mt-4 border-t border-outline/10 pt-3">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Para instalar</Text>
      {apps.map((app) => (
        <View key={app.id} className="mt-3 flex-row items-center gap-3">
          {app.avatarUrl ? <Image source={{ uri: app.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 10 }} /> : <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary"><Bot size={22} color={colors['on-primary']} /></View>}
          <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface">{app.name}</Text>
          <Pressable testID={`instalar-${app.id}`} onPress={() => void Linking.openURL(app.installUrl)} className="min-h-[40px] justify-center rounded-xl bg-primary px-4">
            <Text className="text-[14px] font-semibold text-on-primary">Instalar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
