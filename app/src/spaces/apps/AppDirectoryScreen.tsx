import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Lock, Search } from 'lucide-react-native';
import { directoryChips, filterDirectory, type ClientWorkspace, type DirectoryApp, type DirectoryFilter } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { AppBadge, AppLogo } from './AppLogo';
import { AppDetailScreen } from './AppDetailScreen';
import type { SpaceApps } from './useSpaceApps';

const CONTENT_MAX_WIDTH = 720;
const ROW_LOGO_SIZE = 48;

/**
 * «Apps» of a space (design e-24, like Slack's directory): searched by name or
 * category, with chips, each app with «Instalada» or «Instalar»; a tap opens
 * its detail (e-25). Installing opens the app's page in the browser; coming
 * back reads the directory again.
 */
export function AppDirectoryScreen(props: { space: ClientWorkspace; apps: SpaceApps; jwt: string; initialAppId?: string | null; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { apps, space } = props;
  const all = apps.directory?.apps ?? [];
  const admin = apps.directory?.canInstall ?? false;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [chosenId, setChosenId] = useState<string | null>(props.initialAppId ?? null);
  const chips = useMemo(() => directoryChips(all), [all]);
  const shown = useMemo(() => filterDirectory(all, { filter, query }), [all, filter, query]);
  const chosen = all.find((app) => app.appId === chosenId) ?? null;

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-apps" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="apps-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-[22px] font-bold text-on-surface">Apps</Text>
              {apps.directory ? (
                <View className="rounded-full bg-primary/10 px-2.5 py-0.5"><Text className="text-[13px] font-semibold text-primary">{`${all.length} ${all.length === 1 ? 'disponible' : 'disponibles'}`}</Text></View>
              ) : null}
            </View>
            <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{`Espacio ${space.name}`}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
            <View className="min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
              <Search size={18} color={colors['on-surface-variant']} />
              <TextInput testID="buscar-apps" value={query} onChangeText={setQuery} placeholder="Busca por nombre o categoría" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
            </View>
            {apps.directory ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
                {chips.map((chip) => (
                  <Pressable key={chip.key} testID={`chip-apps-${chip.key}`} onPress={() => setFilter(chip.key)} className={`min-h-[40px] justify-center rounded-xl border px-4 ${filter === chip.key ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
                    <Text className={`text-[14px] font-semibold ${filter === chip.key ? 'text-on-primary' : 'text-on-surface'}`}>{chip.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <Text className="mb-1 mt-5 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Catálogo del espacio</Text>
            {apps.failed ? (
              <Pressable testID="apps-reintentar" onPress={apps.refresh} className="mt-2 rounded-xl bg-error/10 px-4 py-3"><Text className="text-[13px] text-error">No se pudieron cargar las apps. Toca para reintentar.</Text></Pressable>
            ) : null}
            {!apps.directory && !apps.failed ? [0, 1, 2].map((index) => <View key={index} className="mt-2 h-16 rounded-2xl bg-surface-variant" />) : null}
            {apps.directory && shown.length === 0 ? <Text className="mt-6 text-center text-[14px] text-on-surface-variant">No hay apps con ese nombre o categoría.</Text> : null}
            {shown.map((app, index) => (
              <DirectoryRow key={app.appId} app={app} first={index === 0} admin={admin} onOpen={() => setChosenId(app.appId)} onInstall={() => apps.install(app)} />
            ))}
          </View>
        </ScrollView>
        {apps.directory && !admin ? (
          <View className="flex-row items-center justify-center gap-2 border-t border-outline/10 bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
            <Lock size={15} color={colors['on-surface-variant']} />
            <Text className="text-[14px] text-on-surface-variant">Las apps las instala un admin del espacio</Text>
          </View>
        ) : null}
      </View>
      {chosen ? (
        <AppDetailScreen
          app={chosen}
          jwt={props.jwt}
          spaceId={space.id}
          spaceName={space.name}
          admin={admin}
          uninstalling={apps.uninstallingId === chosen.appId}
          onClose={() => setChosenId(null)}
          onMessage={() => {
            setChosenId(null);
            apps.message(chosen);
          }}
          onInstall={() => apps.install(chosen)}
          onUninstall={admin ? () => apps.uninstall(chosen) : undefined}
          onChannelsChanged={() => void apps.reload()}
        />
      ) : null}
    </Modal>
  );
}

function DirectoryRow(props: { app: DirectoryApp; first: boolean; admin: boolean; onOpen: () => void; onInstall: () => void }) {
  const colors = useColores();
  const { app } = props;
  return (
    <Pressable testID={`fila-app-${app.appId}`} onPress={props.onOpen} android_ripple={{ color: colors.outline }} className={`min-h-[72px] flex-row items-center gap-3 py-3 ${props.first ? '' : 'border-t border-outline/10'}`}>
      <AppLogo avatarUrl={app.avatarUrl} size={ROW_LOGO_SIZE} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="shrink text-[16px] font-bold text-on-surface">{app.name}</Text>
          <AppBadge />
        </View>
        {app.description ? <Text numberOfLines={1} className="text-[14px] text-on-surface-variant">{app.description}</Text> : null}
      </View>
      {app.installation ? (
        <View className="flex-row items-center gap-1.5 rounded-full border border-en-linea/30 bg-en-linea/10 px-2.5 py-1">
          <View className="h-2 w-2 rounded-full bg-en-linea" />
          <Text className="text-[13px] font-semibold text-en-linea">Instalada</Text>
        </View>
      ) : props.admin && app.installUrl ? (
        <Pressable testID={`instalar-app-${app.appId}`} onPress={props.onInstall} className="min-h-[40px] justify-center rounded-xl border border-primary px-4">
          <Text className="text-[14px] font-semibold text-primary">Instalar</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
