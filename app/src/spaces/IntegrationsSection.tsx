import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { AlertTriangle, Bot } from 'lucide-react-native';
import { appDeliveryWarning, appInstalledLine, type SpaceApp } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { spaceApps, uninstallApp } from './spacesApi';
import { AvailableApps } from './AvailableApps';

/**
 * Integraciones in the space's settings, like the web's (`specs/BOTS-API.spec.md`):
 * the installed apps (Lila), who installed them, whether their last event
 * arrived, and «Desinstalar» (confirmed first). Installing starts on the app's
 * own page (agentes), not here.
 */
export function IntegrationsSection(props: { jwt: string; spaceId: string }) {
  const colors = useColores();
  const [apps, setApps] = useState<SpaceApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void spaceApps(props.jwt, props.spaceId).then((result) => (result.ok ? setApps(result.data.apps) : setFailed(true)));
  }, [props.jwt, props.spaceId]);
  const uninstall = (app: SpaceApp) =>
    Alert.alert(`¿Desinstalar ${app.name}?`, 'Dejará de publicar y de recibir mensajes en este espacio.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desinstalar',
        style: 'destructive',
        onPress: () => void uninstallApp(props.jwt, props.spaceId, app.id).then((result) => (result.ok ? setApps((before) => (before ?? []).filter((one) => one.id !== app.id)) : setFailed(true))),
      },
    ]);
  return (
    <View testID="seccion-integraciones" className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Integraciones</Text>
      {apps === null && !failed ? <View className="mt-3 h-14 rounded-xl bg-background" /> : null}
      {failed ? <Text className="mt-3 text-[13px] text-error">No se pudieron cargar las apps. Vuelve a abrir los ajustes.</Text> : null}
      {apps && apps.length === 0 ? <Text className="mt-3 text-[14px] text-on-surface-variant">No hay apps instaladas.</Text> : null}
      {apps?.map((app) => (
        <View key={app.id} testID={`app-${app.id}`} className="mt-3 border-t border-outline/10 pt-3">
          <View className="flex-row items-center gap-3">
            {app.avatarUrl ? <Image source={{ uri: app.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 10 }} /> : <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Bot size={20} color={colors.primary} /></View>}
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[15px] font-semibold text-on-surface">{app.name}</Text>
                <Text className="rounded-md bg-background px-1.5 text-[10px] font-bold text-on-surface-variant">App</Text>
              </View>
              <Text className="text-[12px] text-on-surface-variant">{appInstalledLine(app)}</Text>
            </View>
            <Pressable testID={`desinstalar-${app.id}`} onPress={() => uninstall(app)} className="min-h-[40px] justify-center rounded-xl border border-error/30 px-3">
              <Text className="text-[14px] font-semibold text-error">Desinstalar</Text>
            </Pressable>
          </View>
          {appDeliveryWarning(app) ? (
            <View className="mt-2 flex-row items-start gap-1.5">
              <AlertTriangle size={14} color={colors.warning} />
              <Text className="min-w-0 flex-1 text-[12px] text-warning">{appDeliveryWarning(app)}</Text>
            </View>
          ) : null}
        </View>
      ))}
      <AvailableApps jwt={props.jwt} spaceId={props.spaceId} />
    </View>
  );
}
