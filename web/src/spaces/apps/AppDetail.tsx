import { useState } from 'react';
import { Check, Copy, Hash, ListChecks, Lock, MessageSquare, MoreVertical, Terminal, X } from 'lucide-react';
import { APP_PERMISSIONS, appActivityLine, appInstalledByLine, type DirectoryApp } from '@lilachat/shared';
import { copiarTexto } from '../../chat/copiarTexto';
import { AppBadge, AppLogo } from './AppLogo';

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
 * The detail of an app (designs e-24 and e-25): what it is, where it is active,
 * «Mensaje» or «Instalar», what it does, its commands, its permissions and who
 * installed it. The same block is the «Información» tab of its 1:1.
 */
export function AppDetail(props: { app: DirectoryApp; spaceName: string; onMessage?: () => void; onInstall: () => void; onUninstall?: () => void; uninstalling?: boolean; /** «Avisos» (R160), only once installed. */ notices?: React.ReactNode }) {
  const { app } = props;
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const activity = app.installation ? appActivityLine(app.installation) : '';
  return (
    <div data-testid={`detalle-app-${app.appId}`} className="space-y-4">
      <section className="rounded-2xl border border-outline/15 bg-surface p-5">
        <div className="flex items-start gap-4">
          <AppLogo avatarUrl={app.avatarUrl} size={64} rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {app.name} <AppBadge />
              {app.installation && props.uninstalling ? <span data-testid="app-desinstalando" className="rounded-full border border-outline/25 px-2 py-0.5 text-[12px] font-semibold text-on-surface-variant">Desinstalando…</span> : null}
              {app.installation && !props.uninstalling ? <span className="rounded-full border border-en-linea/30 bg-en-linea/10 px-2 py-0.5 text-[12px] font-semibold text-en-linea">Instalada</span> : null}
            </p>
            {app.developer ? <p className="text-[14px] font-medium text-primary">de {app.developer}</p> : null}
            {app.description ? <p className="mt-2 text-[15px] text-on-surface-variant">{app.description}</p> : null}
            {activity ? <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-outline/15 px-3 py-1.5 text-[13px] text-on-surface-variant"><Hash size={14} className="text-primary" /> {activity}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 border-t border-outline/10 pt-5">
          {app.installation && props.onMessage ? (
            <button type="button" data-testid="app-mensaje" disabled={props.uninstalling} onClick={props.onMessage} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-50"><MessageSquare size={17} /> Mensaje</button>
          ) : null}
          {!app.installation && app.installUrl ? (
            <button type="button" data-testid="app-instalar" onClick={props.onInstall} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-on-primary">Instalar en {props.spaceName}</button>
          ) : null}
          {!app.installation && !app.installUrl ? <p className="flex flex-1 items-center gap-2 text-[13px] text-on-surface-variant"><Lock size={14} /> Las apps las instala un admin del espacio</p> : null}
          {app.installation && props.onUninstall ? (
            <div className="relative">
              <button type="button" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu((open) => !open)} className="grid h-11 w-11 place-items-center rounded-xl border border-outline/20 hover:bg-background"><MoreVertical size={18} /></button>
              {menu ? (
                <div className="absolute right-0 top-12 z-10 w-56 rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
                  {confirming ? (
                    <div className="p-2">
                      <p className="text-[13px]">¿Desinstalar {app.name} de {props.spaceName}?</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" data-testid="app-confirmar-desinstalar" onClick={() => { setMenu(false); props.onUninstall?.(); }} className="h-9 flex-1 rounded-lg bg-error text-[13px] font-semibold text-on-primary">Desinstalar</button>
                        <button type="button" aria-label="Cancelar" onClick={() => setConfirming(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-outline/20"><X size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" data-testid="app-desinstalar" onClick={() => setConfirming(true)} className="h-10 w-full rounded-lg px-3 text-left text-[14px] text-error hover:bg-background">Desinstalar</button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      {app.features.length ? (
        <Section Icon={ListChecks} title="Qué hace">
          <ul className="space-y-2">
            {app.features.map((feature) => <li key={feature} className="flex gap-2 text-[14px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{feature}</li>)}
          </ul>
        </Section>
      ) : null}
      {app.commands.length ? (
        <Section Icon={Terminal} title="Comandos">
          <div className="space-y-2">{app.commands.map((entry) => <CommandRow key={entry.command} {...entry} />)}</div>
          <p className="mt-2 text-[12px] text-on-surface-variant">Escríbelos en cualquier chat del espacio donde esté la app.</p>
        </Section>
      ) : null}
      {app.installation ? props.notices : null}
      <Section Icon={Lock} title="Permisos">
        <div className="grid gap-4 sm:grid-cols-2">
          <ul className="space-y-1.5"><li className="text-[12px] font-semibold text-en-linea">Puede</li>{APP_PERMISSIONS.can.map((line) => <li key={line} className="flex gap-2 text-[13px]"><Check size={15} className="mt-0.5 shrink-0 text-en-linea" />{line}</li>)}</ul>
          <ul className="space-y-1.5"><li className="text-[12px] font-semibold text-error">No puede</li>{APP_PERMISSIONS.cannot.map((line) => <li key={line} className="flex gap-2 text-[13px]"><X size={15} className="mt-0.5 shrink-0 text-error" />{line}</li>)}</ul>
        </div>
      </Section>
      {app.installation ? <p className="px-1 text-[12px] text-on-surface-variant">{appInstalledByLine(app.installation)}</p> : null}
    </div>
  );
}
