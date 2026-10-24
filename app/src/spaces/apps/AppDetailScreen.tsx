import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowDownToLine, ArrowLeft, Check, Copy, Hash, Info, Lock, MessageSquare, MoreVertical, Terminal, X } from 'lucide-react-native';
import { APP_PERMISSIONS, appActivityLine, appInstalledByLine, uninstallWarning, type BotCommand, type DirectoryApp } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { AppBadge, AppLogo } from './AppLogo';

/** Lists and two columns stay readable on a tablet or a turned phone (rn-app-loop §3). */
const CONTENT_MAX_WIDTH = 720;
const LOGO_SIZE = 72;

function Section(props: { Icon: typeof Info; title: string; children: ReactNode }) {
  const colors = useColores();
  return (
    <View className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-2 border-b border-outline/10 pb-3">
        <props.Icon size={16} color={colors.primary} />
        <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{props.title}</Text>
      </View>
      {props.children}
    </View>
  );
}

function CommandRow(props: { command: BotCommand }) {
  const colors = useColores();
  const [copied, setCopied] = useState(false);
  const text = `/${props.command.command}${props.command.usageHint ? ` ${props.command.usageHint}` : ''}`;
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-outline/15 bg-background px-3 py-2">
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[14px] font-semibold text-primary">{text}</Text>
        <Text className="text-[13px] text-on-surface-variant">{props.command.description}</Text>
      </View>
      <Pressable testID={`copiar-comando-${props.command.command}`} accessibilityLabel={`Copiar ${text}`} onPress={() => void Clipboard.setStringAsync(text).then(() => setCopied(true))} className="h-11 w-11 items-center justify-center">
        {copied ? <Check size={18} color={colors['en-linea']} /> : <Copy size={18} color={colors['on-surface-variant']} />}
      </Pressable>
    </View>
  );
}

/**
 * The detail of an app (design e-25): what it is, where it is active, what it
 * does, its commands, its permissions and who installed it; at the foot
 * «Mensaje» or «Instalar en <espacio>». The ⋮ uninstalls, for admins. The
 * same screen is the «Información» of a 1:1 with the app (e-26).
 */
export function AppDetailScreen(props: { app: DirectoryApp; spaceName: string; canInstall: boolean; uninstalling?: boolean; onClose: () => void; onMessage?: () => void; onInstall: () => void; onUninstall?: () => void; /** «Comandos y acciones» and «Avisos» (R160), once installed. */ settings?: ReactNode }) {
  const colors = useColores();
  const margins = useMargenes();
  const { app } = props;
  const installation = app.installation;
  const activity = installation ? appActivityLine(installation) : '';
  const confirmUninstall = () =>
    Alert.alert(`¿Desinstalar ${app.name} de ${props.spaceName}?`, uninstallWarning(props.spaceName), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desinstalar', style: 'destructive', onPress: props.onUninstall },
    ]);
  // The ⋮ (agentes, 23/10): «Reinstalar» like Slack's, when the company or the permissions changed; then «Desinstalar».
  const openMenu = () =>
    Alert.alert(app.name, undefined, [
      ...(app.installUrl ? [{ text: 'Reinstalar', onPress: props.onInstall }] : []),
      { text: 'Desinstalar', style: 'destructive' as const, onPress: confirmUninstall },
      { text: 'Cancelar', style: 'cancel' as const },
    ]);

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID={`detalle-app-${app.appId}`} className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="detalle-app-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1 items-center">
            <Text className="text-[17px] font-bold text-on-surface">Detalle de la app</Text>
            <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{`Espacio ${props.spaceName}`}</Text>
          </View>
          {installation && props.onUninstall && !props.uninstalling ? (
            <Pressable testID="app-mas-opciones" onPress={openMenu} accessibilityLabel="Más opciones de la app" className="h-11 w-11 items-center justify-center">
              <MoreVertical size={20} color={colors['on-surface-variant']} />
            </Pressable>
          ) : (
            <View className="h-11 w-11" />
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
            <View className="items-center rounded-2xl border border-outline/15 bg-surface p-5">
              <AppLogo avatarUrl={app.avatarUrl} size={LOGO_SIZE} />
              <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
                <Text className="text-[24px] font-bold text-on-surface">{app.name}</Text>
                <AppBadge />
              </View>
              {app.developer ? <Text className="mt-0.5 text-[14px] font-medium text-primary">{`de ${app.developer}`}</Text> : null}
              {app.description ? <Text className="mt-2 text-center text-[15px] text-on-surface-variant">{app.description}</Text> : null}
              {installation ? (
                <View testID={props.uninstalling ? 'app-desinstalando' : 'app-instalada'} className={`mt-3 flex-row items-center gap-1.5 rounded-full border px-3 py-1 ${props.uninstalling ? 'border-outline/25' : 'border-en-linea/30 bg-en-linea/10'}`}>
                  {props.uninstalling ? null : <View className="h-2 w-2 rounded-full bg-en-linea" />}
                  <Text className={`text-[13px] font-semibold ${props.uninstalling ? 'text-on-surface-variant' : 'text-en-linea'}`}>{props.uninstalling ? 'Desinstalando…' : 'Instalada'}</Text>
                </View>
              ) : null}
              {activity ? (
                <View className="mt-3 flex-row items-center gap-1.5">
                  <Hash size={14} color={colors.primary} />
                  <Text className="text-[13px] text-on-surface-variant">{activity}</Text>
                </View>
              ) : null}
            </View>
            {app.features.length ? (
              <Section Icon={Info} title="Qué hace">
                {app.features.map((feature) => (
                  <View key={feature} className="mb-2 flex-row gap-2.5">
                    <View className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary" />
                    <Text className="flex-1 text-[15px] text-on-surface">{feature}</Text>
                  </View>
                ))}
              </Section>
            ) : null}
            {app.commands.length ? (
              <Section Icon={Terminal} title="Comandos">
                {app.commands.map((command) => <CommandRow key={command.command} command={command} />)}
                <Text className="text-[13px] text-on-surface-variant">Escríbelos en cualquier chat del espacio donde esté la app.</Text>
              </Section>
            ) : null}
            {installation ? props.settings : null}
            <Section Icon={Lock} title="Permisos">
              <Text className="mb-1 text-[13px] font-semibold text-en-linea">Puede</Text>
              {APP_PERMISSIONS.can.map((line) => <PermissionLine key={line} allowed text={line} />)}
              <Text className="mb-1 mt-2 text-[13px] font-semibold text-error">No puede</Text>
              {APP_PERMISSIONS.cannot.map((line) => <PermissionLine key={line} allowed={false} text={line} />)}
            </Section>
            {installation ? <Text className="mt-4 text-center text-[13px] text-on-surface-variant">{appInstalledByLine(installation)}</Text> : null}
          </View>
        </ScrollView>
        <DetailFoot app={app} spaceName={props.spaceName} canInstall={props.canInstall} uninstalling={props.uninstalling} bottom={margins.pie} onMessage={props.onMessage} onInstall={props.onInstall} />
      </View>
    </Modal>
  );
}

function PermissionLine(props: { allowed: boolean; text: string }) {
  const colors = useColores();
  return (
    <View className="mb-1.5 flex-row gap-2">
      {props.allowed ? <Check size={16} color={colors['en-linea']} /> : <X size={16} color={colors.error} />}
      <Text className="flex-1 text-[14px] text-on-surface">{props.text}</Text>
    </View>
  );
}

/** The foot (design e-25): «Mensaje» for an installed app, «Instalar en» for an admin, and why not for a member. */
function DetailFoot(props: { app: DirectoryApp; spaceName: string; canInstall: boolean; uninstalling?: boolean; bottom: number; onMessage?: () => void; onInstall: () => void }) {
  const colors = useColores();
  const { app } = props;
  let content: ReactNode = null;
  if (app.installation && props.onMessage) {
    content = (
      <Pressable testID="app-mensaje" disabled={props.uninstalling} onPress={props.onMessage} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${props.uninstalling ? 'opacity-50' : ''}`}>
        <MessageSquare size={18} color={colors['on-primary']} />
        <Text className="text-[16px] font-bold text-on-primary">Mensaje</Text>
      </Pressable>
    );
  } else if (!app.installation && props.canInstall && app.installUrl) {
    content = (
      <>
        <Pressable testID="app-instalar" onPress={props.onInstall} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
          <ArrowDownToLine size={18} color={colors['on-primary']} />
          <Text className="text-[16px] font-bold text-on-primary">{`Instalar en ${props.spaceName}`}</Text>
        </Pressable>
        <Text className="mt-2 text-center text-[13px] text-on-surface-variant">Se abre la página de la app para conectar tu empresa</Text>
      </>
    );
  } else if (!app.installation) {
    content = <Text className="text-center text-[14px] text-on-surface-variant">Las apps las instala un admin del espacio.</Text>;
  }
  if (!content) return null;
  return (
    <View className="border-t border-outline/10 bg-surface px-4 pt-3" style={{ paddingBottom: props.bottom + 8 }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>{content}</View>
    </View>
  );
}
