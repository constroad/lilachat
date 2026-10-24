import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Zap } from 'lucide-react';
import { quickActionRows, type CommandGroup, type ShortcutRow } from '@lilachat/shared';
import { loadPerfil } from '../../api';
import { currentSocket } from '../../useSocket';
import { Overlay } from '../../ui/Overlay';
import { AppFormDialog } from '../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { spaceCommands } from '../../chat/commands/commandsApi';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { AppLogo } from './AppLogo';

/**
 * The space's ⚡ (R160, design e-30; José, 23/10: it belongs to the space,
 * not only to a channel): the actions of every installed app, without entering a
 * channel, like Slack's global shortcuts. What is registered lands in the
 * channel the admin picked for its topic; the answer only I see shows here.
 */
export function SpaceQuickActions(props: { jwt: string; spaceId: string; spaceName: string }) {
  const { jwt, spaceId } = props;
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<CommandGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const scope = useMemo(() => ({ workspaceId: spaceId }), [spaceId]);
  const answers = useAppAnswers({ jwt, scope });
  const rows = useMemo(() => quickActionRows(groups ?? []), [groups]);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await spaceCommands(jwt, spaceId, 'space');
    if (result.ok) setGroups(result.data.groups);
    else setFailed(true);
  }, [jwt, spaceId]);
  useEffect(() => {
    setGroups(null);
  }, [spaceId]);
  const openRef = useRef(open);
  openRef.current = open;
  // A manifest changed: the list already read is stale. With the sheet open it is
  // read again at once (José, 23/10: skeletons that never loaded).
  useEffect(() => {
    const socket = currentSocket();
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId !== spaceId) return;
      setGroups(null);
      if (openRef.current) void load();
    };
    socket?.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket?.off('workspace.apps.changed', onAppsChanged);
    };
  }, [spaceId, load]);
  // A late answer reopens the sheet: it would be lost behind a closed one.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = answers.answers.filter((answer) => answer.state === 'answered' && !seen.current.has(answer.commandId));
    fresh.forEach((answer) => seen.current.add(answer.commandId));
    if (fresh.length) setOpen(true);
  }, [answers.answers]);

  const show = () => {
    setOpen(true);
    if (!groups) void load();
  };
  const run = (row: ShortcutRow) => void answers.runAction(row);
  return (
    <>
      <button type="button" data-testid="btn-acciones-espacio" aria-label="Acciones rápidas" title="Acciones rápidas" onClick={show} className="grid h-9 w-9 place-items-center rounded-full bg-warning/10 text-warning hover:bg-warning/20">
        <Zap size={18} fill="currentColor" />
      </button>
      {open ? (
        <Overlay title="Acciones rápidas" onClose={() => setOpen(false)} footer={<p className="text-center text-[12px] text-on-surface-variant">También con <kbd className="rounded border border-outline/25 px-1">/</kbd> en cualquier canal</p>}>
          <div data-testid="hoja-acciones-espacio" className="space-y-3">
            <p className="text-[13px] text-on-surface-variant">Sin entrar a un canal. Lo que registres llega al canal que eligió el admin.</p>
            <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={jwt} />
            {groups === null && !failed ? <div data-testid="acciones-cargando" className="space-y-2">{[0, 1, 2].map((index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-background" />)}</div> : null}
            {failed ? <button type="button" onClick={() => void load()} className="w-full rounded-xl bg-error/10 px-4 py-3 text-left text-[13px] text-error">No se pudieron leer las acciones. Toca para reintentar.</button> : null}
            {groups && rows.length === 0 ? <p data-testid="acciones-vacias" className="rounded-xl border border-outline/15 p-4 text-[13px] text-on-surface-variant">Las apps de {props.spaceName} todavía no tienen acciones. Cuando una las tenga, aparecen aquí.</p> : null}
            {rows.length ? (
              <div className="divide-y divide-outline/10 overflow-hidden rounded-2xl border border-outline/15">
                {rows.map((row) => (
                  <button key={`${row.appId}:${row.key}`} type="button" data-testid={`accion-espacio-${row.key}`} onClick={() => run(row)} className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-background">
                    <AppLogo avatarUrl={row.avatarUrl} size={40} rounded="rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{row.name}</span>
                      <span className="block truncate text-[13px] text-on-surface-variant">{row.appName}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Overlay>
      ) : null}
      {answers.openForm ? (
        <AppFormDialog key={answers.openForm.commandId} answer={answers.openForm} personName={loadPerfil()?.name} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(file) => answers.uploadPhoto(answers.openForm!.commandId, file)} onClose={() => answers.showForm(null)} />
      ) : null}
    </>
  );
}
