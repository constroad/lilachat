import { useEffect, useState, type ReactNode } from 'react';
import { Building2, ChevronRight, Info, Link2, MessageCircle, User } from 'lucide-react';
import type { WorkspacePreview } from '@lilachat/shared';
import { previewSpace } from './spacesApi';

type Props = { jwt: string; detectedCode: string | null; onPersonal: () => void; onJoin: () => void; onCreate: () => void };

/**
 * «¿Cómo vas a usar Lilachat?» (design `e-01-bienvenida-web`, pending 5): the
 * first screen of a new account, once. Three cards; the join card is marked
 * «Detectado» when a join link opened the web, with its code and space.
 */
export function WelcomePane(props: Props) {
  const [detected, setDetected] = useState<WorkspacePreview | null>(null);
  useEffect(() => {
    setDetected(null);
    if (!props.detectedCode) return;
    let alive = true;
    void previewSpace(props.jwt, props.detectedCode).then((response) => alive && response.ok && setDetected(response.data));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.detectedCode]);
  return (
    <div role="dialog" aria-label="¿Cómo vas a usar Lilachat?" data-testid="pantalla-bienvenida" className="fixed inset-0 z-40 overflow-y-auto bg-background px-4 py-10">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageCircle size={28} /></span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">¿Cómo vas a usar Lilachat?</h1>
        <p className="mt-3 max-w-[720px] text-[17px] leading-7 text-on-surface-variant">Elige por dónde quieres empezar. Podrás alternar entre tus chats personales y los canales de tu trabajo con un solo clic.</p>
        <div className="mt-10 grid w-full gap-5 text-left md:grid-cols-3">
          <Card testId="bienvenida-personal" Icon={User} title="Para mí" text="Chats con tus contactos, familia y amigos, con la misma fluidez y privacidad de siempre." action="Empezar chats" onClick={props.onPersonal} />
          <Card testId="bienvenida-unirme" Icon={Link2} title="Unirme a mi empresa" text="Con un código o enlace que te mandaron por WhatsApp o correo corporativo." action="Entrar al espacio" highlighted={Boolean(props.detectedCode)} onClick={props.onJoin}>
            {props.detectedCode ? (
              <div data-testid="bienvenida-espacio-detectado" className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-surface-variant px-3 py-2">
                <span className="font-mono text-[13px] text-primary">{props.detectedCode}</span>
                <span className="truncate text-[13px] uppercase text-on-surface-variant">{detected?.name ?? ''}</span>
              </div>
            ) : null}
          </Card>
          <Card testId="bienvenida-crear" Icon={Building2} title="Crear un espacio para mi empresa" text="Organiza canales por área, roles y tareas. Invita a tu equipo y contratistas en segundos." action="Configurar nuevo" onClick={props.onCreate} />
        </div>
        <p className="mt-8 flex items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-5 py-3 text-left text-[15px] text-on-surface-variant">
          <Info size={18} className="shrink-0 text-primary" />
          <span><strong className="text-on-surface">Puedes hacer las dos cosas:</strong> lo personal y la empresa quedan separados.</span>
        </p>
      </div>
    </div>
  );
}

function Card(props: { testId: string; Icon: typeof User; title: string; text: string; action: string; highlighted?: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" data-testid={props.testId} onClick={props.onClick} className={`relative flex flex-col rounded-2xl bg-surface p-7 text-left transition-shadow hover:shadow-lg ${props.highlighted ? 'border-2 border-primary shadow-lg' : 'border border-outline/15'}`}>
      {props.highlighted ? <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-background">Detectado</span> : null}
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${props.highlighted ? 'bg-primary text-background' : 'bg-primary/10 text-primary'}`}><props.Icon size={26} /></span>
      <span className={`mt-6 text-xl font-bold ${props.highlighted ? 'text-primary' : ''}`}>{props.title}</span>
      <span className="mt-2 text-[15px] leading-6 text-on-surface-variant">{props.text}</span>
      {props.children}
      <span className="mt-auto flex items-center justify-between border-t border-outline/15 pt-5 text-[15px] font-semibold text-primary" style={{ marginTop: 24 }}>{props.action}<ChevronRight size={18} /></span>
    </button>
  );
}
