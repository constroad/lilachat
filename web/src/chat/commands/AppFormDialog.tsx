import { useEffect, useMemo, useRef, useState } from 'react';
import { evidenceLine, firstErrorField, formFields, initialValues, liveSelfieFieldOf, submitLabelOf, validateFormValues, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { ChoiceField, DateField, LocationField, NumberField, PhotoField, TextField } from './AppFormFields';
import { ListField } from './ListField';
import { PhotoListField } from './PhotoListField';
import { LiveSelfie, type LiveSelfieHandle } from './LiveSelfie';
import { useLiveSigning } from './useLiveSigning';

/** The two steps of a signing, as design e-32 writes them. */
const LIVE_CHOICE_KICKER = '1 · Qué marcas';
const LIVE_PHOTO_KICKER = '2 · Tu foto y tu ubicación';
const LIVE_FOOTER = 'Al tocar se toma la foto con la hora y el lugar, y se envía.';

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
  // What the app prefilled (agentes, 23/10: the verified phone) and today's date (José, 24/10).
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>(() => props.answer.errors ?? {});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // A form with a location and a photo is a signing (pending 94): live selfie, place of now, one click.
  const live = useMemo(() => liveSelfieFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live, locationName, selfie, upload: props.onUpload });
  // Sent and answered later (consensus 24/10): «Enviando…» until the answer closes it or the errors come back here.
  const waiting = props.answer.waiting === true;
  // After a refusal the dialog goes to the first field with an error (E2E 28/10: «Diseño» was out of sight).
  const body = useRef<HTMLDivElement>(null);
  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    const name = firstErrorField(visibleFields(fields, values).map((field) => field.name), next);
    if (name) body.current?.querySelector(`[data-field="${name}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };
  useEffect(() => {
    if (!props.answer.errors) return;
    showErrors(props.answer.errors);
    setMessage(props.answer.errors._ ?? '');
  }, [props.answer.errors]);
  const evidence = evidenceLine(fields);
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  /** A list: the cell that changed loses its error, and so does the list's own («Agrega al menos uno»). */
  const setList = (name: string) => (items: FormValues[], changed: string) => {
    setValues((before) => ({ ...before, [name]: items }));
    setErrors(({ [name]: _list, [changed]: _cell, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, signing.placeholders(values));
    if (!checked.ok) return showErrors(checked.errors);
    setSending(true);
    setMessage('');
    const prepared = await signing.prepare(values);
    if ('errors' in prepared) {
      setSending(false);
      return showErrors(prepared.errors);
    }
    const outcome = await props.onSubmit(prepared.values);
    setSending(false);
    if (!outcome.done) {
      showErrors(outcome.errors);
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
          {/* Next to the button, never at the end of the scroll: a refusal there looked like a dead button (E2E 24/10). */}
          {message ? <div data-testid="formulario-error" className="mb-2"><FieldError>{message}</FieldError></div> : null}
          <PrimaryButton testId="btn-enviar-formulario" disabled={sending || waiting} onClick={() => void send()}>{waiting ? 'Enviando…' : sending ? signing.phaseLabel : submitLabelOf(form, fields, values)}</PrimaryButton>
          {evidence ? <p className="mt-2 text-center text-[12px] text-on-surface-variant">{live ? LIVE_FOOTER : evidence}</p> : null}
        </div>
      }
    >
      <div ref={body} data-testid={`formulario-${form.id}`} className="space-y-4">
        {props.answer.response?.text ? <p data-testid="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[14px]">{props.answer.response.text}</p> : null}
        {form.intro ? <p className="text-[14px] text-on-surface-variant">{form.intro}</p> : null}
        <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          {props.answer.avatarUrl ? <AppLogo avatarUrl={props.answer.avatarUrl} size={22} rounded="rounded-md" /> : <Avatar name={props.answer.appName} size={22} bot />}
          <span>{props.answer.appName} · hoy, {today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        {evidence && !live ? (
          <div className="rounded-2xl border border-outline/15 py-4 text-center">
            <p className="text-4xl font-bold tabular-nums tracking-tight">{today.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
            {props.personName ? <p className="mx-auto mt-2 w-fit rounded-lg border border-outline/15 px-3 py-1 text-[13px]">{props.personName}</p> : null}
          </div>
        ) : null}
        {visibleFields(fields, values).map((field) =>
          live && field.name === live.name ? (
            <LiveSelfie key={field.name} ref={selfie} testId={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />
          ) : (
            // In a signing the place shows inside the camera; its field keeps reading behind it.
            <div key={field.name} data-field={field.name} hidden={Boolean(live) && field.kind === 'location'}>
              {live && field.kind === 'choice' && field.segmented ? <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{LIVE_CHOICE_KICKER}</p> : null}
              {field.kind === 'list' ? (
                <ListField field={field} value={values[field.name]} errors={errors} onChange={setList(field.name)} renderField={(child, value, error, onChange, key) => <Field key={key} field={child} value={value} error={error} onChange={onChange} upload={props.onUpload} />} />
              ) : (
                <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} />
              )}
            </div>
          )
        )}
      </div>
    </Overlay>
  );
}

function Field(props: { field: Exclude<FormField, { kind: 'list' }>; value: unknown; error?: string; onChange: (value: unknown) => void; upload: Upload }) {
  const { field, upload, ...rest } = props;
  switch (field.kind) {
    case 'choice': return <ChoiceField field={field} {...rest} />;
    case 'text': return <TextField field={field} {...rest} />;
    case 'number': return <NumberField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} />;
    case 'location': return <LocationField field={field} {...rest} />;
    case 'photo': return field.multiple ? <PhotoListField field={field} error={rest.error} onChange={rest.onChange} upload={upload} /> : <PhotoField field={field} {...rest} upload={upload} />;
  }
}
