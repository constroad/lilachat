import { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, Check, ListChecks } from 'lucide-react';
import { interviewOf, type InterviewOption, type InterviewQuestion, type VisitDocument } from '@lilachat/shared';

type Props = { document: VisitDocument; busy: boolean; onAnswer: (values: Record<string, string>) => void; onClose: () => void };

/** «VISITA · PROSPECTO», «Entrevista» with the code, «n de m» and the bar under the header (lv03). */
function Header({ document, answered, total, onClose }: { document: VisitDocument; answered: number; total: number; onClose: () => void }) {
  const prospect = document.details?.prospect || document.title;
  return (
    <header className="border-b border-outline/10 bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" data-testid="entrevista-volver" onClick={onClose} aria-label="Volver" className="flex h-11 w-11 items-center justify-center text-on-surface"><ArrowLeft size={22} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-primary">{`Visita · ${prospect}`}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold text-on-surface">Entrevista</h2>
            <span className="rounded-md bg-surface-variant px-1.5 py-0.5 font-mono text-[12px] text-on-surface-variant">{document.code}</span>
          </div>
        </div>
        <span data-testid="entrevista-avance" className="flex shrink-0 items-center gap-1 rounded-[8px] border border-primary/30 bg-primary/10 px-2 py-1 text-[13px] font-bold text-primary"><ListChecks size={15} />{`${answered} de ${total}`}</span>
      </div>
      <div className="h-1 bg-outline/10"><div className="h-1 bg-primary transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div>
    </header>
  );
}

/** GPS and the contact under the header, as in lv03. */
function Context({ document }: { document: VisitDocument }) {
  const details = document.details;
  if (!details) return null;
  const gps = details.precisionM !== undefined ? `±${Math.round(details.precisionM)} m · ` : '';
  return (
    <div className="flex items-start gap-3 border-b border-outline/10 bg-surface px-4 py-2 text-[12px]">
      <p className="flex shrink-0 items-center gap-1.5 font-bold uppercase text-en-linea"><span className="h-2 w-2 rounded-full bg-en-linea" aria-hidden />GPS activo</p>
      <p className="min-w-0 flex-1 truncate font-mono text-on-surface-variant">{`${gps}${details.place}`}</p>
      {details.contact ? <p className="text-right font-semibold text-on-surface">{details.contact}{details.phone ? <span className="block font-mono font-normal text-on-surface-variant">{details.phone}</span> : null}</p> : null}
    </div>
  );
}

/** «Sí / No» as lv03: centered, the check beside the word; any other choice with its round mark on the right. */
function OptionChip({ question, option, busy, binary, onChoose }: { question: InterviewQuestion; option: InterviewOption; busy: boolean; binary: boolean; onChoose: (value: string) => void }) {
  const chosen = option.value === question.value;
  const tone = chosen ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-outline/15 bg-surface font-medium text-on-surface';
  const check = <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary"><Check size={13} /></span>;
  return (
    <button type="button" data-testid={`opcion-${question.key}-${option.value}`} aria-pressed={chosen} disabled={busy} onClick={() => onChoose(option.value)} className={`flex min-h-[56px] items-center gap-2 rounded-[8px] border-2 px-3 text-[14px] disabled:opacity-60 ${binary ? 'justify-center' : 'justify-between text-left'} ${tone}`}>
      <span>{option.label}</span>
      {chosen ? check : binary ? null : <span className="h-5 w-5 rounded-full border-2 border-outline/30" />}
    </button>
  );
}

const YES_NO = /^(s[ií]|no)$/i;

/** A question without options (Portal: «Área aproximada», m²): written, saved when the field is left or on Enter. */
function WrittenAnswer({ question, busy, onChoose }: { question: InterviewQuestion; busy: boolean; onChoose: (value: string) => void }) {
  const [text, setText] = useState(question.value ?? '');
  const save = () => {
    const value = text.trim();
    if (value && value !== (question.value ?? '')) onChoose(value);
  };
  return (
    <label className="mt-3 flex min-h-[56px] items-center gap-2 rounded-[8px] border-2 border-outline/15 bg-surface px-3 focus-within:border-primary">
      <input data-testid={`respuesta-${question.key}`} value={text} disabled={busy} maxLength={question.maxLength} inputMode={question.unit ? 'decimal' : 'text'} placeholder="Escribe la respuesta" onChange={(event) => setText(event.target.value)} onBlur={save} onKeyDown={(event) => event.key === 'Enter' && save()} className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-on-surface outline-none placeholder:font-normal placeholder:text-on-surface-variant" />
      {question.unit ? <span className="shrink-0 text-[14px] font-semibold text-on-surface-variant">{question.unit}</span> : null}
    </label>
  );
}

function QuestionCard({ question, busy, onChoose }: { question: InterviewQuestion; busy: boolean; onChoose: (value: string) => void }) {
  const binary = question.options.length === 2 && question.options.every((option) => YES_NO.test(option.label));
  return (
    <section id={`pregunta-${question.key}`} data-testid={`pregunta-${question.key}`} className="rounded-[10px] border border-outline/15 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{String(question.n).padStart(2, '0')}</p>
        {question.value !== undefined ? <span className="rounded-md border border-en-linea/30 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold uppercase text-en-linea">Respondida</span> : null}
      </div>
      <h3 className="mt-1 text-[16px] font-bold text-on-surface">{question.title}</h3>
      {question.options.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {question.options.map((option) => <OptionChip key={option.value} question={question} option={option} busy={busy} binary={binary} onChoose={onChoose} />)}
        </div>
      ) : <WrittenAnswer question={question} busy={busy} onChoose={onChoose} />}
    </section>
  );
}

/** The visit's interview (design lv03): every question as a card with big chips; one tap saves it. */
export function VisitInterviewWeb(props: Props) {
  const list = useRef<HTMLDivElement>(null);
  const interview = interviewOf(props.document);
  const left = interview ? interview.total - interview.answered : 0;
  const goNext = () => interview?.next && list.current?.querySelector(`#pregunta-${interview.next}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <div data-testid="visita-entrevista" className="fixed inset-0 z-40 flex flex-col bg-background">
      <Header document={props.document} answered={interview?.answered ?? 0} total={interview?.total ?? 0} onClose={props.onClose} />
      <Context document={props.document} />
      <div ref={list} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4 p-4">
          {interview ? interview.questions.map((question) => <QuestionCard key={question.key} question={question} busy={props.busy} onChoose={(value) => props.onAnswer({ [question.key]: value })} />) : <p className="py-10 text-center text-[14px] text-on-surface-variant">Esta empresa no tiene preguntas de entrevista.</p>}
        </div>
      </div>
      {left > 0 ? (
        <footer className="border-t border-outline/10 bg-surface">
          <div className="mx-auto w-full max-w-[720px] px-4 pb-4 pt-3">
          <button type="button" data-testid="entrevista-siguiente" onClick={goNext} className="flex min-h-[64px] w-full items-center gap-3 rounded-[10px] bg-primary px-5 text-[17px] font-bold text-on-primary">
            <ArrowDown size={20} /><span className="flex-1 text-left">{`Siguiente: ${left} sin responder`}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-on-primary/20 text-[14px]">{left}</span>
          </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
