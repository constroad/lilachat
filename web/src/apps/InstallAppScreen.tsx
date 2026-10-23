import { useEffect, useState } from 'react';
import { AtSign, Bot, Check, ChevronRight, Lock, MessageSquareOff, MousePointerClick, Send, Users } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { SpaceLogo } from '../spaces/SpaceLogo';

/**
 * «Instalar una app en tu espacio» (`specs/BOTS-API.spec.md` §a), like Slack's
 * «Add to Slack»: agentes sends the space's owner or admin here; they see the
 * app, what it may do, and choose the space. Installing or cancelling sends
 * them back to the app's registered address, with the code or with
 * `access_denied`. A link whose address the app did not register never sends
 * anyone anywhere.
 */
type Space = { id: string; name: string; logoUrl?: string };
type Consent = { app: { name: string; avatarUrl?: string }; spaces: Space[] };

/** What it may NOT do (design `r156-instalar-consentimiento`): said as plainly as what it may. */
const CANNOT_DO = [
  { Icon: MessageSquareOff, text: 'Leer los demás mensajes ni los chats personales' },
  { Icon: Lock, text: 'Entrar a canales privados si no la agregan' },
];

const CAN_DO = [
  { Icon: Send, text: 'Publicar mensajes, tarjetas y checklists en los canales públicos del espacio' },
  { Icon: AtSign, text: 'Leer los mensajes que la mencionan o le escriben directamente' },
  { Icon: MousePointerClick, text: 'Saber quién toca los botones de sus tarjetas y marca sus tareas' },
  { Icon: Users, text: 'Ver los miembros del espacio, con su teléfono' },
];

async function oauth<T>(path: string, jwt: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(`/api/oauth${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${jwt}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = (await response.json().catch(() => ({}))) as T & { error_description?: string; message?: string };
    return response.ok ? { ok: true, data } : { ok: false, message: data.error_description ?? data.message ?? 'Este enlace de instalación no es válido.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}

export function InstallAppScreen(props: { jwt: string; search: string; onRedirect: (url: string) => void }) {
  const query = new URLSearchParams(props.search);
  const params = { client_id: query.get('client_id') ?? '', redirect_uri: query.get('redirect_uri') ?? '', state: query.get('state') ?? '', code_challenge: query.get('code_challenge') ?? '', code_challenge_method: query.get('code_challenge_method') ?? '' };
  const [consent, setConsent] = useState<Consent | { failed: string } | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  // Like Slack (José, 23/10): coming from a space, the space is not asked; «Cambiar» opens the list.
  const [fromSpace, setFromSpace] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void oauth<Consent>(`/app?client_id=${encodeURIComponent(params.client_id)}&redirect_uri=${encodeURIComponent(params.redirect_uri)}`, props.jwt).then((result) => {
      setConsent(result.ok ? result.data : { failed: result.message });
      if (!result.ok) return;
      // From Integraciones of a space (agentes adds `?space=`): that one comes chosen.
      const asked = result.data.spaces.find((space) => space.id === query.get('space'));
      if (asked) {
        setSpaceId(asked.id);
        setFromSpace(true);
      } else if (result.data.spaces.length === 1) setSpaceId(result.data.spaces[0]!.id);
    });
    // `query` is read once with the address; the effect runs again only when the app changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.jwt, params.client_id, params.redirect_uri]);
  const decide = async (decision: 'approve' | 'deny') => {
    setSending(true);
    setError('');
    const result = await oauth<{ redirect: string }>('/authorize', props.jwt, { ...params, space_id: spaceId, decision });
    if (result.ok) return props.onRedirect(result.data.redirect);
    setSending(false);
    setError(result.message);
  };
  if (!consent) return <main className="grid min-h-full place-items-center px-4"><div data-testid="instalar-cargando" className="h-80 w-full max-w-md animate-pulse rounded-2xl bg-surface" /></main>;
  if ('failed' in consent) return <Message title="No se puede instalar" text={consent.failed} />;
  const { app, spaces } = consent;
  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <div data-testid="pantalla-instalar-app" className="w-full max-w-md rounded-2xl border border-outline/15 bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Logo size={48} />
          <span className="flex flex-1 items-center gap-1 text-outline" aria-hidden><span className="h-px flex-1 border-t border-dashed border-outline/50" /><ChevronRight size={16} /><span className="h-px flex-1 border-t border-dashed border-outline/50" /></span>
          {app.avatarUrl ? <img src={app.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary"><Bot size={26} strokeWidth={1.75} /></span>}
        </div>
        <div className="mt-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Instalar una app</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{`${app.name} quiere unirse a un espacio`}</h1>
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Podrá</p>
        <ul className="mt-2 space-y-2.5">
          {CAN_DO.map(({ Icon, text }) => (
            <li key={text} className="flex gap-3 text-[14px] leading-5"><Icon size={18} className="mt-0.5 shrink-0 text-primary" />{text}</li>
          ))}
        </ul>
        <p className="mt-5 text-[13px] font-semibold">{`${app.name} no podrá`}</p>
        <ul className="mt-2 space-y-2.5">
          {CANNOT_DO.map(({ Icon, text }) => (
            <li key={text} className="flex gap-3 text-[14px] leading-5 text-on-surface-variant"><Icon size={18} className="mt-0.5 shrink-0" />{text}</li>
          ))}
        </ul>
        {spaces.length === 0 ? (
          <p role="alert" className="mt-5 rounded-xl bg-background px-4 py-3 text-[14px]">Para instalar una app tienes que ser dueño o admin de un espacio de empresa.</p>
        ) : fromSpace && spaceId ? (
          <div data-testid="espacio-elegido" className="mt-5 flex min-h-[52px] items-center gap-3 rounded-xl border border-outline/15 px-3">
            <SpaceLogo space={spaces.find((space) => space.id === spaceId)!} size={32} />
            <span className="min-w-0 flex-1 truncate text-[14px]">Se instala en <span className="font-semibold">{spaces.find((space) => space.id === spaceId)!.name}</span></span>
            {spaces.length > 1 ? <button type="button" data-testid="cambiar-espacio" onClick={() => setFromSpace(false)} className="text-[13px] font-semibold text-primary hover:underline">Cambiar</button> : null}
          </div>
        ) : (
          <fieldset className="mt-5">
            <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">¿En qué espacio?</legend>
            <div className="mt-2 space-y-2">
              {spaces.map((space) => (
                <button key={space.id} type="button" data-testid={`espacio-${space.id}`} aria-pressed={spaceId === space.id} onClick={() => setSpaceId(space.id)} className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 text-left ${spaceId === space.id ? 'border-primary bg-primary/5' : 'border-outline/15 hover:bg-background'}`}>
                  <SpaceLogo space={space} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{space.name}</span>
                  {spaceId === space.id ? <Check size={18} className="text-primary" /> : null}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {error ? <p role="alert" className="mt-4 text-[13px] text-error">{error}</p> : null}
        <div className="mt-6 flex gap-2">
          <button type="button" data-testid="cancelar-instalacion" disabled={sending} onClick={() => void decide('deny')} className="h-11 flex-1 rounded-full border border-outline/20 text-sm font-semibold hover:bg-background disabled:opacity-60">Cancelar</button>
          {spaces.length ? <button type="button" data-testid="instalar-app" disabled={sending || !spaceId} onClick={() => void decide('approve')} className="h-11 flex-1 rounded-full bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">{sending ? 'Instalando…' : spaces.find((space) => space.id === spaceId) ? `Instalar en ${spaces.find((space) => space.id === spaceId)!.name}` : 'Instalar'}</button> : null}
        </div>
        <p className="mt-4 text-center text-[12px] text-on-surface-variant">La desinstalas cuando quieras desde Ajustes del espacio → Integraciones.</p>
      </div>
    </main>
  );
}

function Message(props: { title: string; text: string }) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold tracking-tight">{props.title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-on-surface-variant">{props.text}</p>
        <a href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-on-primary">Ir a Lilachat</a>
      </div>
    </main>
  );
}
