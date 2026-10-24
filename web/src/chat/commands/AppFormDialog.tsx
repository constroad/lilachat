import { useMemo, useState } from 'react';
import { evidenceLine, formFields, initialValues, submitLabelOf, validateFormValues, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import { ChoiceField, DateField, LocationField, NumberField, PhotoField, TextField } from './AppFormFields';

type Upload = (file: File) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

/**
 * An app's form (R160, design e-28): the fields its schema says, the moment
 * and who is registering when it carries a location or a photo, and the app's
 * button («Marcar ingreso»). Sending is the confirmation; what is missing is
 * said field by field before it leaves, and what the app refuses comes back
 * the same way.
 */
export function AppFormDialog(props: { answer: EphemeralAnswer; personName?: string; onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>; onUpload: Upload; onClose: () => void }) {
  const form = props.answer.response!.form!;
  const fields = useMemo(() => formFields(form), [form]);
  // What the app prefilled (agentes, 23/10: the verified phone for «Conecta tu cuenta»).
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const evidence = evidenceLine(fields);
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, values);
    if (!checked.ok) return setErrors(checked.errors);
    setSending(true);
    setMessage('');
    const outcome = await props.onSubmit(values);
    setSending(false);
    if (!outcome.done) {
      setErrors(outcome.errors);
      setMessage(outcome.errors._ ?? outcome.message ?? '');
    }
  };
  const today = new Date();
  return (
    <Overlay
      title={form.title}
      onClose={props.onClose}
      footer={
        <div>
          <PrimaryButton testId="btn-enviar-formulario" disabled={sending} onClick={() => void send()}>{sending ? 'Enviando…' : submitLabelOf(form, fields, values)}</PrimaryButton>
          {evidence ? <p className="mt-2 text-center text-[12px] text-on-surface-variant">{evidence}</p> : null}
        </div>
      }
    >
      <div data-testid={`formulario-${form.id}`} className="space-y-4">
        {props.answer.response?.text ? <p data-testid="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[14px]">{props.answer.response.text}</p> : null}
        {form.intro ? <p className="text-[14px] text-on-surface-variant">{form.intro}</p> : null}
        <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Avatar name={props.answer.appName} size={22} bot />
          {props.answer.appName} · hoy, {today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {evidence ? (
          <div className="rounded-2xl border border-outline/15 py-4 text-center">
            <p className="text-4xl font-bold tabular-nums tracking-tight">{today.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
            {props.personName ? <p className="mx-auto mt-2 w-fit rounded-lg border border-outline/15 px-3 py-1 text-[13px]">{props.personName}</p> : null}
          </div>
        ) : null}
        {visibleFields(fields, values).map((field) => <Field key={field.name} field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} />)}
        {message ? <FieldError>{message}</FieldError> : null}
      </div>
    </Overlay>
  );
}

function Field(props: { field: FormField; value: unknown; error?: string; onChange: (value: unknown) => void; upload: Upload }) {
  const { field, upload, ...rest } = props;
  switch (field.kind) {
    case 'choice': return <ChoiceField field={field} {...rest} />;
    case 'text': return <TextField field={field} {...rest} />;
    case 'number': return <NumberField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} />;
    case 'location': return <LocationField field={field} {...rest} />;
    case 'photo': return <PhotoField field={field} {...rest} upload={upload} />;
  }
}
