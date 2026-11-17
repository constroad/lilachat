import { useState } from 'react';
import { CircleHelp, Info, Lock } from 'lucide-react';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Kicker, TextButton } from './daliParts';
import { teachDali } from './prospectsApi';

const QUESTION_MAX = 200;
const ANSWER_MAX = 1000;

type Props = {
  jwt: string;
  spaceId: string;
  /** A question Dali could not answer (the review): it comes fixed. Without one, the member writes it. */
  question?: string;
  asked?: number;
  onTaught: () => void;
  onClose: () => void;
};

/**
 * «Enseñarle a Dali» (dl-13): the only thing Lilachat writes in what Dali knows. It only ADDS an answer, of the
 * installation's company, with author, time and audit in agentes, once per form (`idempotency_key`); it is corrected
 * or deleted in Dali's panel. The tone tip and the «PENDIENTE» pill Stitch drew do not go.
 */
export function TeachDaliDialog(props: Props) {
  const [question, setQuestion] = useState(props.question ?? '');
  const [answer, setAnswer] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fixed = Boolean(props.question);

  const send = async () => {
    if (!question.trim() || !answer.trim()) return setError('Escribe la pregunta y lo que debe responder Dali.');
    setBusy(true);
    const result = await teachDali(props.jwt, props.spaceId, { question: question.trim(), answer: answer.trim(), idempotency_key: key });
    setBusy(false);
    if (!result.ok) return setError(result.status === 502 ? 'Dali no respondió. Inténtalo en un momento.' : result.message);
    props.onTaught();
  };

  return (
    <Overlay
      title="Enseñarle a Dali"
      onClose={props.onClose}
      header={<><Kicker className="text-primary">Enseñarle a Dali</Kicker><h2 className="text-lg font-extrabold tracking-tight">Nueva respuesta</h2></>}
      footer={<>
        <FieldError>{error}</FieldError>
        <PrimaryButton testId="ensenar-a-dali" disabled={busy} onClick={() => void send()}>Enseñarle a Dali</PrimaryButton>
        <div className="mt-1 flex justify-center"><TextButton tone="neutral" onClick={props.onClose}>Cancelar</TextButton></div>
      </>}
    >
      <div className="space-y-4">
        {fixed ? (
          <div className="flex gap-3 rounded-xl border border-outline/15 bg-surface-variant/30 px-3 py-3">
            <CircleHelp size={20} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px]">
              <span className="block font-bold">{`«${props.question}»`}</span>
              <span className="text-on-surface-variant">{`La preguntaron ${props.asked && props.asked > 1 ? `${props.asked} veces` : 'una vez'} esta semana · Dali dijo que lo consultaba con un asesor.`}</span>
            </p>
          </div>
        ) : null}
        <label className="block space-y-1.5">
          <Kicker>Pregunta</Kicker>
          <span className="relative block">
            <input data-testid="pregunta-dali" value={question} readOnly={fixed} maxLength={QUESTION_MAX} onChange={(event) => setQuestion(event.target.value)} placeholder="¿Trabajan los domingos?" className={`h-11 w-full rounded-xl border border-outline/30 px-3 pr-9 text-sm ${fixed ? 'bg-surface-variant/40' : 'bg-surface'}`} />
            {fixed ? <Lock size={16} className="absolute right-3 top-3.5 text-on-surface-variant" /> : null}
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="flex justify-between"><Kicker>Lo que debe responder Dali</Kicker><span className="font-mono text-[12px] text-on-surface-variant">{`${answer.length} / ${ANSWER_MAX}`}</span></span>
          <textarea data-testid="respuesta-dali" value={answer} maxLength={ANSWER_MAX} rows={4} onChange={(event) => setAnswer(event.target.value)} className="w-full resize-none rounded-xl border border-outline/30 bg-surface px-3 py-2 text-sm" />
        </label>
        {answer.trim() ? (
          <div className="space-y-1.5">
            <Kicker className="text-primary">Así lo dirá Dali</Kicker>
            <div className="flex gap-2 rounded-xl border border-outline/15 bg-surface-variant/30 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-on-primary">D</span>
              <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-xl border border-outline/15 bg-surface px-3 py-2 text-sm">{answer.trim()}</p>
            </div>
          </div>
        ) : null}
        <p className="flex gap-2 text-[12px] text-on-surface-variant"><Info size={14} className="mt-px shrink-0" /> Solo agrega esta respuesta. Se corrige o se borra en el panel de Dali.</p>
      </div>
    </Overlay>
  );
}
