import { useEffect, useMemo, useState } from 'react';
import { Banknote, Bell, CloudSun, Database, FileText, Hash, Package, TriangleAlert, Truck, UserCheck, type LucideIcon } from 'lucide-react';
import type { NoticeIcon, TopicRoute } from '@lilachat/shared';
import { topicPrivacyHint } from '@lilachat/shared';
import { appTopics, saveAppTopics, testAppTopics, type AppTopics } from '../spacesApi';

const ICONS: Record<NoticeIcon, LucideIcon> = { attendance: UserCheck, tank: Database, material: Package, truck: Truck, weather: CloudSun, cash: Banknote, document: FileText, alert: TriangleAlert };
/** «Sin canal» in the select: an empty value. */
const NO_CHANNEL = '';

const channelOf = (topic: TopicRoute) => topic.channel?.id ?? NO_CHANNEL;

/**
 * «¿Dónde llega cada aviso?» (R160, design e-31; José, 23/10): each topic the
 * app declared, with the channel of the space where it lands. The admin
 * changes it and tries it; everyone else sees it. A topic without a channel is
 * not posted.
 */
export function NoticeTopicsSection(props: { jwt: string; spaceId: string; appId: string; appName: string }) {
  const [state, setState] = useState<AppTopics | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ busy: boolean; line?: string; error?: boolean }>({ busy: false });

  useEffect(() => {
    let alive = true;
    setState(null);
    setPicked({});
    void appTopics(props.jwt, props.spaceId, props.appId).then((result) => {
      if (!alive) return;
      if (result.ok) setState(result.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);

  const changed = useMemo(() => (state ? state.topics.filter((topic) => picked[topic.key] !== undefined && picked[topic.key] !== channelOf(topic)) : []), [state, picked]);
  if (failed || (state && state.topics.length === 0)) return null;
  if (!state) return <div data-testid="avisos-cargando" className="h-40 animate-pulse rounded-2xl bg-surface" />;

  const save = async () => {
    setStatus({ busy: true });
    const channels = Object.fromEntries(changed.map((topic) => [topic.key, picked[topic.key] || null]));
    const result = await saveAppTopics(props.jwt, props.spaceId, props.appId, channels);
    if (!result.ok) return setStatus({ busy: false, line: result.message, error: true });
    setState(result.data);
    setPicked({});
    setStatus({ busy: false, line: 'Guardado. Los próximos avisos llegan a esos canales.' });
  };
  const tryIt = async () => {
    setStatus({ busy: true });
    const result = await testAppTopics(props.jwt, props.spaceId, props.appId);
    setStatus(result.ok ? { busy: false, line: `Se mandó una prueba a ${result.data.channels === 1 ? '1 canal' : `${result.data.channels} canales`}.` } : { busy: false, line: result.message, error: true });
  };
  return (
    <section data-testid="avisos-de-la-app" className="rounded-2xl border border-outline/15 bg-surface p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Avisos de {props.appName}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">¿Dónde llega cada aviso?</p>
      <p className="mt-1 text-[14px] text-on-surface-variant">{state.canEdit ? 'Elige un canal del espacio para cada tema.' : 'Solo los admins lo cambian.'}</p>
      <div className="mt-4 divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15">
        {state.topics.map((topic) => {
          const Icon = topic.icon ? ICONS[topic.icon] : Bell;
          const value = picked[topic.key] ?? channelOf(topic);
          const hint = topicPrivacyHint(topic, state.channels.find((channel) => channel.id === value) ?? null);
          return (
            <div key={topic.key} data-testid={`tema-${topic.key}`} className="flex items-center gap-3 px-3 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-outline/15 bg-background text-on-surface-variant"><Icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{topic.name}</span>
                {topic.description ? <span className="block truncate text-[13px] text-on-surface-variant">{topic.description}</span> : null}
                {hint ? <span data-testid={`aviso-privado-${topic.key}`} className="block text-[13px] font-semibold text-warning">{hint}</span> : null}
              </span>
              {state.canEdit ? (
                <select data-testid={`canal-tema-${topic.key}`} aria-label={`Canal de ${topic.name}`} value={value} onChange={(event) => setPicked((before) => ({ ...before, [topic.key]: event.target.value }))} className={`h-10 max-w-[44%] rounded-xl border bg-background px-2 text-[14px] ${value ? 'border-outline/25' : 'border-dashed border-outline/40 italic text-on-surface-variant'}`}>
                  {state.channels.map((channel) => <option key={channel.id} value={channel.id}>{`# ${channel.name}${channel.private ? ' (privado)' : ''}`}</option>)}
                  <option value={NO_CHANNEL}>Sin canal</option>
                </select>
              ) : (
                <span className="flex items-center gap-1 text-[14px] text-on-surface-variant">{topic.channel ? <><Hash size={14} />{topic.channel.name}</> : 'Sin canal'}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-on-surface-variant">Los avisos de un tema sin canal no se publican.</p>
      {state.canEdit ? (
        <div className="mt-4 flex gap-2">
          <button type="button" data-testid="btn-probar-avisos" disabled={status.busy} onClick={() => void tryIt()} className="h-11 flex-1 rounded-xl border border-outline/25 text-[14px] font-semibold disabled:opacity-50">Probar envío</button>
          <button type="button" data-testid="btn-guardar-avisos" disabled={status.busy || changed.length === 0} onClick={() => void save()} className="h-11 flex-1 rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-40">{status.busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      ) : null}
      {status.line ? <p role={status.error ? 'alert' : 'status'} className={`mt-2 text-[13px] ${status.error ? 'text-error' : 'text-en-linea'}`}>{status.line}</p> : null}
    </section>
  );
}
