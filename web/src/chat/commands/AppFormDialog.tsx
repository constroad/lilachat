import { useMemo, useRef, useState } from 'react';
import { evidenceLine, formFields, initialValues, liveSelfieFieldOf, submitLabelOf, validateFormValues, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import { ChoiceField, DateField, LocationField, NumberField, PhotoField, TextField } from './AppFormFields';
import { LiveSelfie, type LiveSelfieHandle } from './LiveSelfie';
import { useLiveSigning } from './useLiveSigning';

type Upload = (file: File, stamp?: GeoPoint) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

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
  const [errors, setErrors] = useState<Record<string, string>>(() => props.answer.errors ?? {});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // A form with a location and a photo is a signing (pending 94): live selfie, place of now, one click.
  const live = useMemo(() => liveSelfieFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live, locationName, selfie, upload: props.onUpload });
  const evidence = evidenceLine(fields);
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, signing.placeholders(values));
    if (!checked.ok) return setErrors(checked.errors);
    setSending(true);
    setMessage('');
    const prepared = await signing.prepare(values);
    if ('errors' in prepared) {
      setSending(false);
      return setErrors(prepared.errors);
    }
    const outcome = await props.onSubmit(prepared.values);
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
          <PrimaryButton testId="btn-enviar-formulario" disabled={sending} onClick={() => void send()}>{sending ? signing.phaseLabel : submitLabelOf(form, fields, values)}</PrimaryButton>
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
        {visibleFields(fields, values).map((field) =>
          live && field.name === live.name ? (
            <LiveSelfie key={field.name} ref={selfie} testId={`campo-${field.name}`} label={field.label} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />
          ) : (
            // In a signing the place shows inside the camera; its field keeps reading behind it.
            <div key={field.name} hidden={Boolean(live) && field.kind === 'location'}>
              <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} />
            </div>
          )
        )}
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
