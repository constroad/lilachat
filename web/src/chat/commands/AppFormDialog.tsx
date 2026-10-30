import { useMemo, useRef, type RefObject } from 'react';
import { evidenceLine, formFields, formRows, liveSelfieFieldOf, submitLabelOf, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint, type PreviewReply } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { ChoiceField, DateField, LocationField, NumberField, PhotoField, TextField } from './AppFormFields';
import { ListField } from './ListField';
import { isRichChoice, MultiField, RichChoiceField } from './RichChoiceFields';
import { PhotoListField } from './PhotoListField';
import { LiveSelfie, type LiveSelfieHandle } from './LiveSelfie';
import { useLiveSigning } from './useLiveSigning';
import { useFormLive } from './useFormLive';
import { useAppFormState } from './useAppFormState';
import { BotBlocksView } from '../botBlocks/BotBlocksView';

/** The two steps of a signing, as design e-32 writes them. */
const LIVE_CHOICE_KICKER = '1 · Qué marcas';
const LIVE_PHOTO_KICKER = '2 · Tu foto y tu ubicación';
const LIVE_FOOTER = 'Al tocar se toma la foto con la hora y el lugar, y se envía.';

type Upload = (file: File, stamp?: GeoPoint) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

type DialogProps = { answer: EphemeralAnswer; personName?: string; onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>; onUpload: Upload; onClose: () => void; /** `x-refresh`: the app sends the form again for the new draft. */ onRefresh?: (draft: FormValues) => Promise<void>; /** `x-preview`: the app's summary of the draft. */ onPreview?: (draft: FormValues) => Promise<PreviewReply> };

/** After a refusal the dialog goes to the first field with an error (E2E 28/10: «Diseño» was out of sight). */
function revealField(body: HTMLDivElement | null, name: string) {
  // A phone's keyboard keeps the focused input in view and pulls the dialog back to it.
  if (document.activeElement instanceof HTMLElement && body?.contains(document.activeElement)) document.activeElement.blur();
  body?.querySelector(`[data-field="${name}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

/**
 * An app's form (R160, design e-28): the fields its schema says, the moment
 * and who is registering when it carries a location or a photo, and the app's
 * button («Marcar ingreso»). Sending is the confirmation; what is missing is
 * said field by field before it leaves, and what the app refuses comes back
 * the same way.
 */
export function AppFormDialog(props: DialogProps) {
  const form = props.answer.response!.form!;
  const fields = useMemo(() => formFields(form), [form]);
  // A form with a location and a photo is a signing (pending 94): live selfie, place of now, one click.
  const selfieField = useMemo(() => liveSelfieFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live: selfieField, locationName, selfie, upload: props.onUpload });
  const body = useRef<HTMLDivElement>(null);
  const state = useAppFormState({ fields, refused: props.answer.errors, signing, onSubmit: props.onSubmit, reveal: (name) => revealField(body.current, name) });
  const live = useFormLive({ fields, values: state.values, preview: form.preview, onRefresh: props.onRefresh, onPreview: props.onPreview });
  // The summary's remarks («la lectura de fin va después del inicio») under their fields; the person's own errors win.
  const slot: SlotContext = { values: state.values, errors: { ...live.summary.errors, ...state.errors }, selfieField, locationName, selfie, upload: props.onUpload, set: state.set, setList: state.setList };
  // Sent and answered later (consensus 24/10): «Enviando…» until the answer closes it or the errors come back here.
  const waiting = props.answer.waiting === true;
  const evidence = evidenceLine(fields);
  const label = waiting ? 'Enviando…' : state.sending ? signing.phaseLabel : submitLabelOf(form, fields, state.values);
  const footer = <FormFooter summary={live.summary.blocks} message={state.message} busy={state.sending || waiting} label={label} note={evidence ? (selfieField ? LIVE_FOOTER : evidence) : ''} onSend={() => void state.send()} />;
  return (
    <Overlay title={form.title} onClose={props.onClose} footer={footer}>
      <div ref={body} data-testid={`formulario-${form.id}`} className="space-y-4">
        <FormIntro answer={props.answer} refreshing={live.refreshing} clock={Boolean(evidence) && !selfieField} personName={props.personName} />
        {/* Two short fields share a row (José, 28/10: a field per row made the forms a sheet). */}
        {formRows(visibleFields(fields, state.values)).map((row) =>
          row.length === 2 ? (
            <div key={row[0]!.name} data-row="2" className="grid grid-cols-2 items-start gap-3">
              {row.map((field) => <FieldSlot key={field.name} field={field} half context={slot} />)}
            </div>
          ) : (
            <FieldSlot key={row[0]!.name} field={row[0]!} context={slot} />
          )
        )}
      </div>
    </Overlay>
  );
}

/** Above the fields: the app's line, why the options are changing, and the clock of a registration. */
function FormIntro(props: { answer: EphemeralAnswer; refreshing: boolean; clock: boolean; personName?: string }) {
  const { answer } = props;
  const today = new Date();
  return (
    <>
      {props.refreshing ? <p data-testid="formulario-actualizando" className="text-[13px] text-on-surface-variant">Actualizando las opciones…</p> : null}
      {answer.response?.text ? <p data-testid="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[14px]">{answer.response.text}</p> : null}
      {answer.response?.form?.intro ? <p className="text-[14px] text-on-surface-variant">{answer.response.form.intro}</p> : null}
      <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
        {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={22} rounded="rounded-md" /> : <Avatar name={answer.appName} size={22} bot />}
        <span>{answer.appName} · hoy, {today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      {props.clock ? (
        <div className="rounded-2xl border border-outline/15 py-4 text-center">
          <p className="text-4xl font-bold tabular-nums tracking-tight">{today.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
          {props.personName ? <p className="mx-auto mt-2 w-fit rounded-lg border border-outline/15 px-3 py-1 text-[13px]">{props.personName}</p> : null}
        </div>
      ) : null}
    </>
  );
}

/** By the button, never at the end of the scroll: a refusal there looked like a dead button (E2E 24/10). */
function FormFooter(props: { summary: PreviewReply['blocks']; message: string; busy: boolean; label: string; note: string; onSend: () => void }) {
  return (
    <div>
      {props.summary.length ? (
        <section data-testid="formulario-resumen" className="mb-3 rounded-2xl border border-outline/15 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Resumen</p>
          <BotBlocksView blocks={props.summary} />
        </section>
      ) : null}
      {props.message ? <div data-testid="formulario-error" className="mb-2"><FieldError>{props.message}</FieldError></div> : null}
      <PrimaryButton testId="btn-enviar-formulario" disabled={props.busy} onClick={props.onSend}>{props.label}</PrimaryButton>
      {props.note ? <p className="mt-2 text-center text-[12px] text-on-surface-variant">{props.note}</p> : null}
    </div>
  );
}

/** What every field of the form draws from. */
type SlotContext = {
  values: FormValues;
  errors: Record<string, string>;
  selfieField: Pick<FormField, 'name'> | null;
  locationName?: string;
  selfie: RefObject<LiveSelfieHandle>;
  upload: Upload;
  set: (name: string) => (value: unknown) => void;
  setList: (name: string) => (items: FormValues[], changed: string) => void;
};

/** One field; `half` when it shares its row. */
function FieldSlot(props: { field: FormField; half?: boolean; context: SlotContext }) {
  const { field, half = false } = props;
  const { values, errors, selfieField, locationName, upload } = props.context;
  if (selfieField && field.name === selfieField.name) {
    return <LiveSelfie ref={props.context.selfie} testId={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />;
  }
  return (
    // In a signing the place shows inside the camera; its field keeps reading behind it.
    <div data-field={field.name} hidden={Boolean(selfieField) && field.kind === 'location'}>
      {selfieField && field.kind === 'choice' && field.segmented ? <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{LIVE_CHOICE_KICKER}</p> : null}
      {field.kind === 'list' ? (
        <ListField field={field} value={values[field.name]} errors={errors} onChange={props.context.setList(field.name)} renderField={(child, value, error, onChange, key, halfCell) => <Field key={key} field={child} value={value} error={error} onChange={onChange} upload={upload} half={halfCell} />} />
      ) : (
        <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={props.context.set(field.name)} upload={upload} half={half} />
      )}
    </div>
  );
}

function Field(props: { field: Exclude<FormField, { kind: 'list' }>; value: unknown; error?: string; onChange: (value: unknown) => void; upload: Upload; half?: boolean }) {
  const { field, upload, half, ...rest } = props;
  switch (field.kind) {
    case 'choice': return isRichChoice(field) ? <RichChoiceField field={field} {...rest} /> : <ChoiceField field={field} {...rest} compact={half} />;
    case 'multi': return <MultiField field={field} {...rest} />;
    case 'text': return <TextField field={field} {...rest} />;
    case 'number': return <NumberField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} />;
    case 'location': return <LocationField field={field} {...rest} />;
    case 'photo': return field.multiple ? <PhotoListField field={field} error={rest.error} onChange={rest.onChange} upload={upload} /> : <PhotoField field={field} {...rest} upload={upload} />;
  }
}
