import { useRef, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, FileText, FolderOpen, Plus, RotateCcw, X } from 'lucide-react';
import { checklistMembers, formatClock, pendingTasks, stageFiles, taskActivity, taskDueLabel, taskDueState, type ChecklistItem, type TaskEvidence, type WorkStage } from '@lilachat/shared';
import { api } from '../../api';
import { useConversacion } from '../contextoDeLaConversacion';
import { TaskDialog, type TaskEdit } from '../tarjetas/TaskDialog';
import { attachEvidenceWeb, detachEvidenceWeb } from './evidenceWeb';

export type OpenTask = { stageId: string; itemId: string };

const DAY = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const day = (iso: string) => DAY.format(new Date(iso)).replace(/\./g, '');
const stamp = (iso: string) => `${day(iso)} · ${formatClock(new Date(iso)).replace(/[  ]/g, ' ')}`;
const sizeLabel = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** «Pendientes» of a job's channel on the web (design e2-17): the open tasks of the plan, overdue first. */
export function PendingWeb(props: { stages: readonly WorkStage[]; onOpen: (task: OpenTask) => void }) {
  const { nombres } = useConversacion();
  const now = new Date();
  const pending = pendingTasks(props.stages, now);
  if (!pending.length) {
    return (
      <div data-testid="pendientes-de-obra-vacio" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <CheckCircle2 className="text-en-linea" size={40} />
        <p className="text-lg font-bold">Nada pendiente</p>
        <p className="text-sm text-on-surface-variant">Las tareas abiertas de todas las etapas aparecen aquí.</p>
      </div>
    );
  }
  return (
    <div data-testid="pendientes-de-obra" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{`${pending.length} pendientes`}</p>
        {pending.map((task, index) => (
          <button key={`${task.stageId}-${task.item.id}`} type="button" data-testid={`pendiente-${index}`} onClick={() => props.onOpen({ stageId: task.stageId, itemId: task.item.id })} className={`flex min-h-[60px] items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-left hover:bg-surface-variant/40 ${task.overdue ? 'border-error/40' : 'border-outline/15'}`}>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{task.item.text}</span>
              <span className="block text-[12px] text-on-surface-variant">{`Etapa ${task.stage} · ${task.stageTitle}${task.item.assignee ? ` · ${nombres.get(task.item.assignee) ?? 'Alguien'}` : ''}`}</span>
            </span>
            {task.item.dueAt ? <span className={`shrink-0 text-[12px] font-semibold ${task.overdue ? 'text-error' : 'text-on-surface-variant'}`}>{taskDueLabel(task.item.dueAt, now)}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** «Archivos» of a job's channel on the web (design e2-17): the evidence by stage; a click goes to the file's message. */
export function StageFilesWeb(props: { stages: readonly WorkStage[]; onOpenMessage: (seq: number) => void }) {
  const files = stageFiles(props.stages);
  if (!files.total) {
    return (
      <div data-testid="archivos-de-obra-vacio" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <FolderOpen className="text-primary" size={40} />
        <p className="text-lg font-bold">Sin archivos todavía</p>
        <p className="max-w-md text-sm text-on-surface-variant">Abre una tarea del checklist y sube su evidencia: fotos, planos o informes.</p>
      </div>
    );
  }
  return (
    <div data-testid="archivos-de-obra" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {files.groups.map((group) => (
          <section key={group.stageId}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{`${group.stage}. ${group.title} · ${group.files.length}`}</p>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {group.files.map((file) => (
                <button key={file.seq} type="button" data-testid={`archivo-de-obra-${file.seq}`} onClick={() => props.onOpenMessage(file.seq)} className="overflow-hidden rounded-xl border border-outline/15 bg-surface text-left hover:border-primary/40">
                  {file.kind === 'file' ? <span className="grid h-24 place-items-center bg-error/[0.06]"><FileText className="text-error" size={28} /></span> : <img src={file.thumbnailUrl ?? file.url} alt={file.taskText} className="h-24 w-full object-cover" />}
                  <span className="block truncate px-2 py-1.5 text-[11px] text-on-surface-variant">{file.kind === 'file' ? file.name : file.taskText}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A task of the job on the web (design e2-18): who, when, stage, evidence, activity, «Reasignar» and «Marcar como hecho». */
export function TaskDetailWeb(props: { open: OpenTask; stages: readonly WorkStage[]; onChanged: () => void; onOpenMessage: (seq: number) => void; onClose: () => void }) {
  const { jwt, yo, nombres, chat } = useConversacion();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const stage = props.stages.find((one) => one._id === props.open.stageId);
  const item = stage?.items.find((one) => one.id === props.open.itemId);
  if (!stage || !item) return null;
  const nameOf = (userId: string) => nombres.get(userId) ?? 'Alguien';
  const state = taskDueState(item, new Date());
  const run = async (label: string, action: () => Promise<string | null>) => {
    setBusy(label);
    setError('');
    const problem = await action();
    setBusy(null);
    if (problem) setError(problem);
    props.onChanged();
  };
  const call = async (path: string, options: { method?: string; body?: unknown }, fallback: string) => {
    const response = await api(path, { jwt, ...options });
    return response.ok ? null : (response.message ?? fallback);
  };
  const toggle = () => void run('marcar', () => call(`/agenda/checklists/${stage._id}/items/${item.id}/toggle`, { body: {} }, 'No se pudo marcar la tarea.'));
  const save = (edit: TaskEdit) => void run('guardar', () => call(`/agenda/checklists/${stage._id}/items/${item.id}`, { method: 'PATCH', body: edit }, 'No se pudo guardar la tarea.'));
  const upload = (file: File | undefined) => file && void run('subir', () => attachEvidenceWeb({ jwt, chatId: chat.id, checklistId: stage._id, itemId: item.id, taskText: item.text, file }));
  const remove = (file: TaskEvidence) => window.confirm('¿Quitar este archivo de la tarea? Sigue en el chat.') && void run('quitar', () => detachEvidenceWeb({ jwt, checklistId: stage._id, itemId: item.id, seq: file.seq }));
  return (
    <div role="dialog" aria-modal="true" aria-label={item.text} className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={props.onClose}>
      <div data-testid="hoja-detalle-tarea" className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-background md:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-outline/10 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase tracking-widest text-primary">{`${stage.title} · ${chat.name}`}</p>
            <h2 data-testid="detalle-tarea-titulo" className="mt-1 text-xl font-bold">{item.text}</h2>
          </div>
          {state === 'overdue' ? <span className="mt-1 rounded-full border border-error/30 bg-error/10 px-2.5 py-0.5 text-[11px] font-bold text-error">VENCIDO</span> : state === 'done' ? <span className="mt-1 rounded-full border border-en-linea/30 bg-en-linea/10 px-2.5 py-0.5 text-[11px] font-bold text-en-linea">HECHO</span> : null}
          <button type="button" aria-label="Cerrar" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-variant"><X size={18} /></button>
        </header>
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <dl className="divide-y divide-outline/10 rounded-2xl border border-outline/15 bg-surface text-sm">
            <Fact label="Responsable">{item.assignee ? <span className="font-semibold">{nameOf(item.assignee)}</span> : <span className="text-on-surface-variant">Sin responsable</span>}</Fact>
            <Fact label="Fecha límite">{item.dueAt ? <span className={`flex items-center gap-1.5 font-semibold ${state === 'overdue' ? 'text-error' : ''}`}><CalendarDays size={15} />{`${day(item.dueAt)}${state === 'overdue' ? ' (Venció)' : ''}`}</span> : <span className="text-on-surface-variant">Sin fecha</span>}</Fact>
            <Fact label="Etapa"><span className="flex items-center gap-2"><span className="rounded-md border border-outline/20 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">{`ETAPA ${stage.stage}`}</span><span className="font-semibold">{stage.title}</span></span></Fact>
          </dl>
          <EvidenceWeb files={item.evidence ?? []} me={yo} uploading={busy === 'subir'} onUpload={() => picker.current?.click()} onOpen={(file) => { props.onClose(); props.onOpenMessage(file.seq); }} onRemove={remove} />
          <input ref={picker} type="file" data-testid="input-evidencia" className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ''; }} />
          <ActivityWeb item={item} nameOf={nameOf} />
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
        </div>
        <footer className="flex gap-3 border-t border-outline/10 p-4">
          <button type="button" data-testid="btn-tarea-reasignar" onClick={() => setEditing(true)} className="min-h-[48px] flex-1 rounded-2xl border border-outline/25 bg-surface font-semibold">Reasignar</button>
          <button type="button" data-testid="btn-tarea-marcar" disabled={busy === 'marcar'} onClick={toggle} className="flex min-h-[48px] flex-[1.3] items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-on-primary disabled:opacity-60">
            {item.doneBy ? <RotateCcw size={17} /> : <Check size={17} />}{item.doneBy ? 'Reabrir' : 'Marcar como hecho'}
          </button>
        </footer>
      </div>
      {editing ? <TaskDialog item={item} members={checklistMembers(nombres, yo)} canRemove={false} onSave={(edit) => { setEditing(false); save(edit); }} onRemove={() => setEditing(false)} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function Fact(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between px-4">
      <dt className="text-on-surface-variant">{props.label}</dt>
      <dd>{props.children}</dd>
    </div>
  );
}

function EvidenceWeb(props: { files: readonly TaskEvidence[]; me: string; uploading: boolean; onUpload: () => void; onOpen: (file: TaskEvidence) => void; onRemove: (file: TaskEvidence) => void }) {
  const photos = props.files.filter((file) => file.kind !== 'file');
  const documents = props.files.filter((file) => file.kind === 'file');
  const removable = (file: TaskEvidence) => (file.by === props.me ? <button type="button" aria-label="Quitar de la tarea" onClick={(event) => { event.stopPropagation(); props.onRemove(file); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white"><X size={13} /></button> : null);
  return (
    <section data-testid="detalle-tarea-evidencia" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Evidencia</p>
        <button type="button" data-testid="btn-subir-evidencia" disabled={props.uploading} onClick={props.onUpload} className="flex items-center gap-1 text-[13px] font-semibold text-primary disabled:opacity-60"><Plus size={14} />{props.uploading ? 'Subiendo…' : 'Subir archivo'}</button>
      </div>
      {props.files.length === 0 ? <p className="mt-2 text-[13px] text-on-surface-variant">Sin archivos todavía. Sube una foto o un documento que pruebe la tarea.</p> : null}
      {photos.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {photos.map((file, index) => (
            <div key={file.seq} className="relative">
              <button type="button" data-testid={`evidencia-foto-${index}`} onClick={() => props.onOpen(file)} className="w-full overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.06] text-left">
                <img src={file.thumbnailUrl ?? file.url} alt={`Foto ${index + 1}`} className="h-24 w-full object-cover" />
                <span className="block px-2.5 py-2"><span className="block text-[10px] font-bold uppercase tracking-wider text-primary">{`Foto ${String(index + 1).padStart(2, '0')}`}</span><span className="block text-[11px] text-on-surface-variant">{stamp(file.at)}</span></span>
              </button>
              {removable(file)}
            </div>
          ))}
        </div>
      ) : null}
      {documents.map((file) => (
        <div key={file.seq} className="relative mt-2">
          <button type="button" data-testid={`evidencia-archivo-${file.seq}`} onClick={() => props.onOpen(file)} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-outline/15 px-3 text-left">
            <FileText className="shrink-0 text-error" size={20} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="block text-[11px] text-on-surface-variant">{`${sizeLabel(file.sizeBytes)} · ${stamp(file.at)}`}</span></span>
          </button>
          {removable(file)}
        </div>
      ))}
    </section>
  );
}

function ActivityWeb({ item, nameOf }: { item: ChecklistItem; nameOf: (userId: string) => string }) {
  const lines = taskActivity(item, nameOf);
  if (!lines.length) return null;
  return (
    <section data-testid="detalle-tarea-actividad" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Actividad</p>
      {lines.map((line, index) => (
        <p key={index} className="mt-2 flex items-center gap-2 text-sm">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${line.tone === 'done' ? 'bg-en-linea' : 'bg-primary'}`} />
          <span>{line.text}{line.at ? <span className="text-[12px] text-on-surface-variant">{`  ·  ${day(line.at)}`}</span> : null}</span>
        </p>
      ))}
    </section>
  );
}
