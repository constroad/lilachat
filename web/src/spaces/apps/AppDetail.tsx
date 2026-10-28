import { useState } from 'react';
import { Check, Copy, Hash, ListChecks, Lock, MessageSquare, Slash, Terminal, X } from 'lucide-react';
import { APP_PERMISSIONS, appActivityLine, appDetailTabs, appInstalledByLine, type AppDetailTab, type DirectoryApp } from '@lilachat/shared';
import { copiarTexto } from '../../chat/copiarTexto';
import { DetailTabBar } from '../../chat/info/DetailTabBar';
import { AppBadge, AppLogo } from './AppLogo';
import { AppAccountSection } from './AppAccountSection';
import { AppChannelsSection, AppInstallSection } from './AppChannelsSection';
import { AppItemsSection } from './AppItemsSection';
import { NoticeTopicsSection } from './NoticeTopicsSection';

type AppDetailProps = {
  app: DirectoryApp;
  jwt: string;
  /** Without it (a test, or a session still renewing) the parts the detail asks on its own are left out. */
  spaceId: string | null;
  spaceName: string;
  /** Installs, reinstalls and uninstalls (an admin of the space). */
  admin: boolean;
  uninstalling?: boolean;
  onMessage?: () => void;
  onInstall: () => void;
  onUninstall?: () => void;
  /** A switch of «En qué canales está» worked: the caller reads the directory again. */
  onChannelsChanged?: () => void;
};

function Section(props: { Icon: typeof Hash; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline/15 bg-surface p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        <props.Icon size={15} className="text-primary" /> {props.title}
      </p>
      {props.children}
    </section>
  );
}

function CommandRow(props: { command: string; usageHint?: string; description: string }) {
  const [copied, setCopied] = useState(false);
  const text = `/${props.command}${props.usageHint ? ` ${props.usageHint}` : ''}`;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-outline/15 px-3 py-2">
      <code className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[13px] font-semibold text-primary">{text}</code>
      <span className="min-w-0 flex-1 text-[13px] text-on-surface-variant">{props.description}</span>
      <button type="button" aria-label={`Copiar ${text}`} onClick={() => void copiarTexto(text).then((ok) => setCopied(ok))} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-background">
        {copied ? <Check size={15} className="text-en-linea" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/**
 * The one detail of an app (pending 99, designs c-04 and c-05), the same in
 * the directory and in the «Información» of its 1:1: «Mensaje» and «Comandos»
 * under its name, then Información · Comandos and, once installed, Avisos ·
 * Ajustes. Ajustes says in which channels it is and, for admins, reinstalls or
 * uninstalls. Callers key it by app, so another app opens on Información.
 */
export function AppDetail(props: AppDetailProps) {
  const tabs = appDetailTabs(Boolean(props.app.installation));
  const [tab, setTab] = useState<AppDetailTab>('info');
  // Uninstalled while on Avisos or Ajustes: those tabs go, and the detail falls back to Información.
  const shownTab = tabs.some((one) => one.key === tab) ? tab : 'info';
  return (
    <div data-testid={`detalle-app-${props.app.appId}`} className="space-y-4">
      <DetailHero {...props} onCommands={() => setTab('commands')} />
      <DetailTabBar tabs={tabs.map((one) => one.key)} active={shownTab} onChange={setTab} labelOf={(key) => tabs.find((one) => one.key === key)?.label ?? key} />
      <DetailTab {...props} tab={shownTab} />
    </div>
  );
}

/** Logo, name, who made it, what it is, whether it is installed, and «Mensaje» · «Comandos» or «Instalar» (design c-04). */
function DetailHero(props: AppDetailProps & { onCommands: () => void }) {
  const { app } = props;
  const activity = app.installation ? appActivityLine(app.installation) : '';
  return (
    <section className="flex flex-col items-center rounded-2xl border border-outline/15 bg-surface p-6 text-center">
      <AppLogo avatarUrl={app.avatarUrl} size={72} rounded="rounded-2xl" />
      <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-2xl font-bold tracking-tight">{app.name} <AppBadge /></p>
      {app.developer ? <p className="text-[14px] font-medium text-primary">de {app.developer}</p> : null}
      {app.description ? <p className="mt-2 max-w-xl text-[15px] text-on-surface-variant">{app.description}</p> : null}
      {app.installation ? (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[13px] text-on-surface-variant">
          {props.uninstalling ? <span data-testid="app-desinstalando" className="rounded-full border border-outline/25 px-2 py-0.5 text-[12px] font-semibold">Desinstalando…</span> : <span className="rounded-full border border-en-linea/30 bg-en-linea/10 px-2 py-0.5 text-[12px] font-semibold text-en-linea">Instalada</span>}
          {activity ? <span className="inline-flex items-center gap-1.5"><Hash size={14} className="text-primary" /> {activity}</span> : null}
        </p>
      ) : null}
      <div className="mt-5 flex w-full max-w-md items-center justify-center gap-3">
        {app.installation && props.onMessage ? (
          <>
            <button type="button" data-testid="app-mensaje" disabled={props.uninstalling} onClick={props.onMessage} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-[15px] font-semibold text-primary hover:bg-background disabled:opacity-50"><MessageSquare size={17} /> Mensaje</button>
            <button type="button" data-testid="app-ver-comandos" onClick={props.onCommands} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-[15px] font-semibold hover:bg-background"><Slash size={16} className="text-primary" /> Comandos</button>
          </>
        ) : null}
        {!app.installation && props.admin && app.installUrl ? (
          <button type="button" data-testid="app-instalar" onClick={props.onInstall} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-on-primary">Instalar en {props.spaceName}</button>
        ) : null}
        {!app.installation && !props.admin ? <p className="flex items-center gap-2 text-[13px] text-on-surface-variant"><Lock size={14} /> Las apps las instala un admin del espacio</p> : null}
      </div>
    </section>
  );
}

function DetailTab(props: AppDetailProps & { tab: AppDetailTab }) {
  const { app } = props;
  const section = props.spaceId ? { jwt: props.jwt, spaceId: props.spaceId, appId: app.appId } : null;
  if (props.tab === 'commands') {
    return (
      <>
        {app.commands.length ? (
          <Section Icon={Terminal} title="Comandos">
            <div className="space-y-2">{app.commands.map((entry) => <CommandRow key={entry.command} {...entry} />)}</div>
            <p className="mt-2 text-[12px] text-on-surface-variant">Escríbelos en cualquier chat del espacio donde esté la app.</p>
          </Section>
        ) : (
          <EmptyLine text={`${app.name} no tiene comandos.`} />
        )}
        {app.installation && section ? <AppItemsSection {...section} /> : null}
      </>
    );
  }
  if (props.tab === 'notices') return section ? <NoticeTopicsSection {...section} appName={app.name} emptyText={`${app.name} no manda avisos al espacio.`} /> : null;
  if (props.tab === 'settings') {
    return (
      <>
        {section ? <AppChannelsSection {...section} onChanged={props.onChannelsChanged} /> : null}
        {props.admin && props.onUninstall ? <AppInstallSection appName={app.name} spaceName={props.spaceName} uninstalling={props.uninstalling} onReinstall={app.installUrl ? props.onInstall : undefined} onUninstall={props.onUninstall} /> : null}
      </>
    );
  }
  return <InfoTab {...props} />;
}

function InfoTab(props: AppDetailProps) {
  const { app } = props;
  return (
    <>
      {/* A newer manifest asks for more (pending 95): it keeps working with what was accepted until an admin reinstalls. */}
      {app.installation?.newPermissions?.length ? (
        <section data-testid="app-permisos-nuevos" className="space-y-1.5 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <p className="text-[14px] font-semibold">Esta app pide permisos nuevos</p>
          {app.installation.newPermissions.map((line) => <p key={line} className="text-[13px]">· {line}</p>)}
          {props.admin && app.installUrl ? (
            <button type="button" data-testid="app-reinstalar-permisos" onClick={props.onInstall} className="mt-1 h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary">Reinstalar</button>
          ) : <p className="text-[12px] text-on-surface-variant">Un admin del espacio la reinstala para aceptarlos.</p>}
        </section>
      ) : null}
      {app.features.length ? (
        <Section Icon={ListChecks} title="Qué hace">
          <ul className="space-y-2">
            {app.features.map((feature) => <li key={feature} className="flex gap-2 text-[14px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{feature}</li>)}
          </ul>
        </Section>
      ) : null}
      {app.installation && props.spaceId ? <AppAccountSection jwt={props.jwt} spaceId={props.spaceId} appId={app.appId} appName={app.name} /> : null}
      <Section Icon={Lock} title="Permisos">
        <div className="grid gap-4 sm:grid-cols-2">
          <ul className="space-y-1.5"><li className="text-[12px] font-semibold text-en-linea">Puede</li>{[...APP_PERMISSIONS.can, ...(app.asks ?? [])].map((line) => <li key={line} className="flex gap-2 text-[13px]"><Check size={15} className="mt-0.5 shrink-0 text-en-linea" />{line}</li>)}</ul>
          <ul className="space-y-1.5"><li className="text-[12px] font-semibold text-error">No puede</li>{APP_PERMISSIONS.cannot.map((line) => <li key={line} className="flex gap-2 text-[13px]"><X size={15} className="mt-0.5 shrink-0 text-error" />{line}</li>)}</ul>
        </div>
      </Section>
      {app.installation ? <p className="px-1 text-center text-[12px] text-on-surface-variant">{appInstalledByLine(app.installation)}</p> : null}
    </>
  );
}

function EmptyLine(props: { text: string }) {
  return <p className="py-8 text-center text-[14px] text-on-surface-variant">{props.text}</p>;
}
