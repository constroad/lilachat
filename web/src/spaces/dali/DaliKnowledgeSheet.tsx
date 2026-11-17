import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Lock, X } from 'lucide-react';
import { catalogByService, moneyOf, questionsOf, weekReviewOf, type DaliKnowledge, type DaliQuestion } from '@lilachat/shared';
import { EmptyNote, Kicker, OutlineButton, SkeletonRows, TextButton } from './daliParts';
import { fetchKnowledge, type ProspectList } from './prospectsApi';
import { TeachDaliDialog } from './TeachDaliDialog';

type Props = { jwt: string; spaceId: string; list: ProspectList | null; now: Date; phone?: boolean; onClose: () => void; onNotice: (text: string) => void };
type Loaded = { knowledge: DaliKnowledge } | { failed: string } | null;

/**
 * «Lo que Dali sabe» (dl-12), read only: how Dali attends, what it asks (the questions every service shares once, then
 * each service's own), the catalog grouped BY SERVICE (José 16/11; prices only for the space's admins: the server
 * strips them), the FAQ and what Dali could not answer, with «Enseñarle a Dali». It is edited in Dali's panel.
 */
export function DaliKnowledgeSheet(props: Props) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [round, setRound] = useState(0);
  const [teach, setTeach] = useState<{ question?: string; count?: number } | null>(null);
  const unanswered = useMemo(() => weekReviewOf(props.list?.prospects ?? [], props.now), [props.list, props.now]);
  useEffect(() => {
    setLoaded(null);
    void fetchKnowledge(props.jwt, props.spaceId).then((answer) => setLoaded(answer.ok ? { knowledge: answer.data.knowledge } : { failed: answer.status === 502 ? 'Dali no respondió. Vuelve a intentarlo en un momento.' : answer.message }));
  }, [props.jwt, props.spaceId, round]);
  const knowledge = loaded && 'knowledge' in loaded ? loaded.knowledge : null;
  return (
    <div data-testid="lo-que-sabe" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-outline/15 bg-surface px-2 py-2">
        {props.phone ? <button type="button" aria-label="Volver" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-background"><ArrowLeft size={20} /></button> : null}
        <span className={`min-w-0 flex-1 ${props.phone ? '' : 'pl-2'}`}>
          <Kicker className="text-primary">Dali</Kicker>
          <span className="block text-base font-extrabold tracking-tight">Lo que Dali sabe</span>
        </span>
        {knowledge?.editUrl ? <a href={knowledge.editUrl} target="_blank" rel="noreferrer" data-testid="editar-panel-dali" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-outline/30 px-3 text-[13px] font-semibold hover:bg-background">Editar <ExternalLink size={14} /></a> : null}
        {props.phone ? null : <button type="button" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={20} /></button>}
      </header>
      <p className="flex items-center gap-2 border-b border-outline/15 px-4 py-2 text-[13px] text-on-surface-variant"><Lock size={14} /> Solo lectura. Se edita en el panel de Dali.</p>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loaded === null ? <SkeletonRows count={3} /> : null}
        {loaded && 'failed' in loaded ? <EmptyNote title="No se pudo leer lo que Dali sabe." action={<TextButton onClick={() => setRound(round + 1)}>Reintentar</TextButton>}>{loaded.failed}</EmptyNote> : null}
        {knowledge ? <KnowledgeBody knowledge={knowledge} /> : null}
        <Card title={`Dali no supo responder · ${unanswered.week.label}`}>
          {unanswered.questions.length ? unanswered.questions.map((one) => (
            <div key={one.question} className="flex items-center gap-2 border-b border-outline/10 py-2 last:border-b-0">
              <p className="min-w-0 flex-1 text-sm font-semibold">{one.question}<span className="block text-[12px] font-normal text-on-surface-variant">{one.count === 1 ? '1 vez' : `${one.count} veces`}</span></p>
              <OutlineButton onClick={() => setTeach(one)}>Enseñarle a Dali</OutlineButton>
            </div>
          )) : <p className="text-sm text-on-surface-variant">Dali respondió todo lo que le preguntaron esa semana.</p>}
          <TextButton testId="ensenar-respuesta-nueva" onClick={() => setTeach({})}>Enseñarle otra respuesta</TextButton>
        </Card>
      </div>
      {teach ? <TeachDaliDialog jwt={props.jwt} spaceId={props.spaceId} question={teach.question} asked={teach.count} onClose={() => setTeach(null)} onTaught={() => { setTeach(null); setRound(round + 1); props.onNotice('Dali ya tiene esa respuesta.'); }} /> : null}
    </div>
  );
}

function KnowledgeBody({ knowledge }: { knowledge: DaliKnowledge }) {
  const questions = questionsOf(knowledge);
  const catalog = catalogByService(knowledge);
  return (
    <>
      <Card title="Cómo atiende">
        {knowledge.hours ? <Row label="Horario" value={knowledge.hours} /> : null}
        {knowledge.zone ? <Row label="Zona" value={knowledge.zone} /> : null}
        <Row label="Se pausa" value="Cuando una persona del equipo le responde al cliente" />
      </Card>
      <Card title="Lo que pregunta">
        {questions.common.length ? <Chips label="Para todos los servicios" questions={questions.common} /> : null}
        {questions.services.filter((service) => service.questions.length).map((service) => <Chips key={service.key} label={service.name} questions={service.questions} />)}
        <p className="text-[12px] text-on-surface-variant">Con * las que necesita antes de pasarte el prospecto.</p>
      </Card>
      <Card title="Catálogo por servicio">
        {catalog.length ? catalog.map((group) => (
          <div key={group.key || group.name} className="space-y-1">
            <Kicker className="rounded-md bg-primary/5 px-2 py-1 text-primary">{`${group.name} · ${group.items.length}`}</Kicker>
            {group.items.map((item) => (
              <div key={item.name} className="flex items-baseline gap-3 border-b border-outline/10 py-1.5 last:border-b-0">
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.name}</span>{item.unit ? <span className="text-[12px] text-on-surface-variant">{`Unidad: ${item.unit}`}</span> : null}</span>
                {item.price !== undefined ? <span className="shrink-0 font-mono text-sm">{moneyOf(item.price)}</span> : null}
              </div>
            ))}
          </div>
        )) : <p className="text-sm text-on-surface-variant">Dali todavía no tiene catálogo.</p>}
        <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant"><Lock size={12} /> Los precios solo los ven los admins del espacio.</p>
      </Card>
      <Card title={`Preguntas frecuentes · ${knowledge.faqs.length}`}>
        {knowledge.faqs.length ? knowledge.faqs.map((faq) => (
          <details key={faq.id} className="rounded-lg border border-outline/15 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">{faq.question}</summary>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-on-surface-variant">{faq.answer}</p>
          </details>
        )) : <p className="text-sm text-on-surface-variant">Todavía no hay preguntas frecuentes.</p>}
      </Card>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <h3 className="text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <p className="flex gap-3 border-b border-outline/10 py-1.5 text-[13px] last:border-b-0"><span className="w-20 shrink-0 text-on-surface-variant">{label}</span><span className="min-w-0 flex-1 text-right font-semibold">{value}</span></p>;
}

function Chips({ label, questions }: { label: string; questions: DaliQuestion[] }) {
  return (
    <div className="space-y-1.5">
      <Kicker>{label}</Kicker>
      <div className="flex flex-wrap gap-1.5">
        {questions.map((question) => <span key={question.key ?? question.label} className={`rounded-lg border px-2.5 py-1 text-[13px] font-semibold ${question.required ? 'border-primary/40 text-primary' : 'border-outline/20 bg-surface-variant/40 text-on-surface-variant'}`}>{`${question.label}${question.required ? '*' : ''}`}</span>)}
      </div>
    </div>
  );
}
