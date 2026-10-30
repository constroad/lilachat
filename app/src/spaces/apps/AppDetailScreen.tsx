import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowDownToLine, ArrowLeft, Check, Copy, Hash, Info, Lock, MessageSquare, Slash, Terminal, X } from 'lucide-react-native';
import { APP_PERMISSIONS, appActivityLine, appDetailTabs, appInstalledByLine, type AppDetailTab, type BotCommand, type DirectoryApp } from '@lilachat/shared';
import { DetailTabBar } from '../../chat/DetailTabBar';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { AppBadge, AppLogo } from './AppLogo';
import { AppAccountSection } from './AppAccountSection';
import { NewPermissionsNotice } from './NewPermissionsNotice';
import { AppChannelsSection, AppInstallSection } from './AppChannelsSection';
import { NoticeTopicsSection } from './AppSettingsSections';
import { AppCommandsPanel } from './AppCommandsPanel';

/** Lists and two columns stay readable on a tablet or a turned phone (rn-app-loop §3). */
const CONTENT_MAX_WIDTH = 720;
const LOGO_SIZE = 72;

type AppDetailProps = {
  app: DirectoryApp;
  jwt: string;
  spaceId: string;
  spaceName: string;
  /** Installs, reinstalls and uninstalls (an admin of the space). */
  admin: boolean;
  uninstalling?: boolean;
  onClose: () => void;
  onMessage?: () => void;
  onInstall: () => void;
  onUninstall?: () => void;
  /** A switch of «En qué canales está» worked: the caller reads the directory again. */
  onChannelsChanged?: () => void;
};

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
 * The one detail of an app (pending 99, designs c-04 and c-05), the same from
 * the directory and from the 1:1: «Mensaje» and «Comandos» under its name,
 * then Información · Comandos and, once installed, Avisos · Ajustes. Ajustes
 * says in which channels it is and, for admins, reinstalls or uninstalls.
 */
export function AppDetailScreen(props: AppDetailProps) {
  const colors = useColores();
  const margins = useMargenes();
  const { app } = props;
  const tabs = appDetailTabs(Boolean(app.installation));
  const [tab, setTab] = useState<AppDetailTab>('info');
  // Uninstalled while on Avisos or Ajustes: those tabs go, and the detail falls back to Información.
  const shownTab = tabs.some((one) => one.key === tab) ? tab : 'info';
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID={`detalle-app-${app.appId}`} className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-2">
          <Pressable testID="detalle-app-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Aplicación</Text>
            <Text numberOfLines={1} className="text-[17px] font-bold text-on-surface">{app.name}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="bg-surface">
            <DetailHero {...props} onCommands={() => setTab('commands')} />
            <DetailTabBar tabs={tabs.map((one) => one.key)} active={shownTab} onChange={setTab} labelOf={(key) => tabs.find((one) => one.key === key)?.label ?? key} />
          </View>
          <View className="px-4" style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
            <DetailTab {...props} tab={shownTab} />
          </View>
        </ScrollView>
        <DetailFoot app={app} spaceName={props.spaceName} admin={props.admin} bottom={margins.pie} onInstall={props.onInstall} />
      </View>
    </Modal>
  );
}

/** Logo, name, who made it, what it is, whether it is installed, and «Mensaje» · «Comandos» (design c-04). */
function DetailHero(props: AppDetailProps & { onCommands: () => void }) {
  const colors = useColores();
  const { app } = props;
  const installation = app.installation;
  const activity = installation ? appActivityLine(installation) : '';
  return (
    <View className="items-center px-4 pt-5" style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
      <AppLogo avatarUrl={app.avatarUrl} size={LOGO_SIZE} />
      <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
        <Text className="text-[24px] font-bold text-on-surface">{app.name}</Text>
        <AppBadge />
      </View>
      {app.developer ? <Text className="mt-0.5 text-[14px] font-medium text-primary">{`de ${app.developer}`}</Text> : null}
      {app.description ? <Text className="mt-2 text-center text-[15px] text-on-surface-variant">{app.description}</Text> : null}
      {installation ? (
        <View className="mt-3 flex-row flex-wrap items-center justify-center gap-3">
          <View testID={props.uninstalling ? 'app-desinstalando' : 'app-instalada'} className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1 ${props.uninstalling ? 'border-outline/25' : 'border-en-linea/30 bg-en-linea/10'}`}>
            {props.uninstalling ? null : <View className="h-2 w-2 rounded-full bg-en-linea" />}
            <Text className={`text-[13px] font-semibold ${props.uninstalling ? 'text-on-surface-variant' : 'text-en-linea'}`}>{props.uninstalling ? 'Desinstalando…' : 'Instalada'}</Text>
          </View>
          {activity ? (
            <View className="flex-row items-center gap-1.5">
              <Hash size={14} color={colors.primary} />
              <Text className="text-[13px] text-on-surface-variant">{activity}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {installation && props.onMessage ? (
        <View className="mt-4 w-full flex-row gap-3">
          <HeroButton testID="app-mensaje" label="Mensaje" Icon={MessageSquare} primary disabled={props.uninstalling} onPress={props.onMessage} />
          <HeroButton testID="app-ver-comandos" label="Comandos" Icon={Slash} onPress={props.onCommands} />
        </View>
      ) : null}
    </View>
  );
}

function HeroButton(props: { testID: string; label: string; Icon: typeof Info; primary?: boolean; disabled?: boolean; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} disabled={props.disabled} onPress={props.onPress} className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface ${props.disabled ? 'opacity-50' : ''}`}>
      <props.Icon size={18} color={colors.primary} />
      <Text className={`text-[15px] font-semibold ${props.primary ? 'text-primary' : 'text-on-surface'}`}>{props.label}</Text>
    </Pressable>
  );
}

function DetailTab(props: AppDetailProps & { tab: AppDetailTab }) {
  const { app } = props;
  const section = { jwt: props.jwt, spaceId: props.spaceId, appId: app.appId };
  if (props.tab === 'commands') {
    // Installed, each command says where it works and who uses it, and «Horarios» follows (designs d-01, d-03).
    if (app.installation) return <AppCommandsPanel {...section} appName={app.name} />;
    return app.commands.length ? (
      <Section Icon={Terminal} title="Comandos">
        {app.commands.map((command) => <CommandRow key={command.command} command={command} />)}
        <Text className="text-[13px] text-on-surface-variant">Escríbelos en cualquier chat del espacio donde esté la app.</Text>
      </Section>
    ) : (
      <EmptyLine text={`${app.name} no tiene comandos.`} />
    );
  }
  if (props.tab === 'notices') return <NoticeTopicsSection {...section} appName={app.name} emptyText={`${app.name} no manda avisos al espacio.`} />;
  if (props.tab === 'settings') {
    return (
      <>
        <AppChannelsSection {...section} onChanged={props.onChannelsChanged} />
        {props.admin && props.onUninstall ? <AppInstallSection appName={app.name} spaceName={props.spaceName} uninstalling={props.uninstalling} onReinstall={app.installUrl ? props.onInstall : undefined} onUninstall={props.onUninstall} /> : null}
      </>
    );
  }
  return <InfoTab {...props} />;
}

function InfoTab(props: AppDetailProps) {
  const { app } = props;
  const installation = app.installation;
  return (
    <>
      {installation?.newPermissions?.length && props.spaceId ? <NewPermissionsNotice jwt={props.jwt} spaceId={props.spaceId} appId={app.appId} lines={installation.newPermissions} admin={props.admin} /> : null}
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
      {installation ? <AppAccountSection jwt={props.jwt} spaceId={props.spaceId} appId={app.appId} appName={app.name} /> : null}
      <Section Icon={Lock} title="Permisos">
        <Text className="mb-1 text-[13px] font-semibold text-en-linea">Puede</Text>
        {[...APP_PERMISSIONS.can, ...(app.asks ?? [])].map((line) => <PermissionLine key={line} allowed text={line} />)}
        <Text className="mb-1 mt-2 text-[13px] font-semibold text-error">No puede</Text>
        {APP_PERMISSIONS.cannot.map((line) => <PermissionLine key={line} allowed={false} text={line} />)}
      </Section>
      {installation ? <Text className="mt-4 text-center text-[13px] text-on-surface-variant">{appInstalledByLine(installation)}</Text> : null}
    </>
  );
}

function EmptyLine(props: { text: string }) {
  return <Text className="mt-6 text-center text-[14px] text-on-surface-variant">{props.text}</Text>;
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

/** The foot of an app not installed (design e-25): «Instalar en» for an admin, and why not for a member. */
function DetailFoot(props: { app: DirectoryApp; spaceName: string; admin: boolean; bottom: number; onInstall: () => void }) {
  const colors = useColores();
  if (props.app.installation || (props.admin && !props.app.installUrl)) return null;
  const content = props.admin && props.app.installUrl ? (
    <>
      <Pressable testID="app-instalar" onPress={props.onInstall} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
        <ArrowDownToLine size={18} color={colors['on-primary']} />
        <Text className="text-[16px] font-bold text-on-primary">{`Instalar en ${props.spaceName}`}</Text>
      </Pressable>
      <Text className="mt-2 text-center text-[13px] text-on-surface-variant">Se abre la página de la app para conectar tu empresa</Text>
    </>
  ) : (
    <Text className="text-center text-[14px] text-on-surface-variant">Las apps las instala un admin del espacio.</Text>
  );
  return (
    <View className="border-t border-outline/10 bg-surface px-4 pt-3" style={{ paddingBottom: props.bottom + 8 }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>{content}</View>
    </View>
  );
}
