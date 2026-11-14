import { useMemo, useRef, type RefObject } from 'react';
import { CheckCheck, Clock } from 'lucide-react';
import { CHECK_ALL_LABEL, checkAllValues, chipsFor, groupedBySection, splitFor, evidenceLine, formFields, formRows, isSplitForm, isWideForm, liveSelfieFieldOf, numberedStepsOf, signerFieldOf, signingStepOf, submitLabelOf, visibleFields, type EphemeralAnswer, type FormField, type FormSubmit, type FormSubmitOutcome, type FormValues, type FormPhotoStamp, type GeoPoint, type PreviewReply, type WorkMapStreet } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { CheckField, ChoiceField, DateField, FormStyleContext, LocationField, NumberField, PhotoField, TextField } from './AppFormFields';
import { FoldedSection } from './FoldedSection';
import { FormContextCard, FormHeader } from './FormHeader';
import { ListField } from './ListField';
import { FormSummary } from './FormSummary';
import { isRichChoice, MultiField, RichChoiceField } from './RichChoiceFields';
import { PhotoListField } from './PhotoListField';
import { LiveSelfie, type LiveSelfieHandle } from './LiveSelfie';
import { SignerCard, SignerPicker, SigningChips } from './SignerPicker';
import type { PlaceLookup } from './usePlaceName';
import { useLiveSigning } from './useLiveSigning';
import { useFormLive } from './useFormLive';
import { useConditionsAutofill, type ConditionsLookup } from './useConditionsAutofill';
import { useAppFormState } from './useAppFormState';
import { useFieldAutofill } from './useFieldAutofill';
import { GpsReadingField, WorkStreetField } from './WorkPlaceFields';

/** The two steps of a signing, as design e-32 writes them. */
const LIVE_CHOICE_KICKER = '1 · Qué marcas';
const LIVE_PHOTO_KICKER = '2 · Tu foto y tu ubicación';
const LIVE_FOOTER = 'Al tocar se toma la foto con la hora y el lugar, y se envía.';

type Upload = (file: File, stamp?: FormPhotoStamp) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

type DialogProps = { answer: EphemeralAnswer; personName?: string; /** «#flujo-caja»: the channel it was opened in. */ where?: string; onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>; onUpload: Upload; /** The address under a signing's camera. */ onPlace?: PlaceLookup; onClose: () => void; /** `x-refresh`: the app sends the form again for the new draft. */ onRefresh?: (draft: FormValues) => Promise<void>; /** `x-preview`: the app's summary of the draft. */ onPreview?: (draft: FormValues) => Promise<PreviewReply>; /** The service's work-map streets for a `work-street` field; `null` while they load. */ workStreets?: readonly WorkMapStreet[] | null; /** A report's shift, weather and street, filled on opening (José 12/11). */ onConditions?: ConditionsLookup };

/** After a refusal the dialog goes to the first field with an error (E2E 28/10: «Diseño» was out of sight). */
function revealField(body: HTMLDivElement | null, name: string) {
  // A phone's keyboard keeps the focused input in view and pulls the dialog back to it.
  if (document.activeElement instanceof HTMLElement && body?.contains(document.activeElement)) document.activeElement.blur();
  const scroll = () => body?.querySelector(`[data-field="${name}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  // A field inside a folded section only exists once the error has opened it: look again after the next paint.
  if (body?.querySelector(`[data-field="${name}"]`)) scroll();
  else requestAnimationFrame(() => requestAnimationFrame(scroll));
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
  const signer = useMemo(() => signerFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live: selfieField, locationName, selfie, upload: props.onUpload });
  const body = useRef<HTMLDivElement>(null);
  const state = useAppFormState({ fields, refused: props.answer.errors, signing, onSubmit: props.onSubmit, reveal: (name) => revealField(body.current, name) });
  const place = useFieldAutofill({ fields, values: state.values, fill: state.fill, streets: props.workStreets ?? null });
  useConditionsAutofill({ fields, values: state.values, fill: state.fill, ask: props.onConditions });
  const live = useFormLive({ fields, values: state.values, preview: form.preview, onRefresh: props.onRefresh, onPreview: props.onPreview });
  // Sent and answered later (consensus 24/10): «Enviando…» until the answer closes it or the errors come back here.
  const waiting = props.answer.waiting === true;
  const evidence = evidenceLine(fields);
  const label = waiting ? 'Enviando…' : state.sending ? signing.phaseLabel : submitLabelOf(form, fields, state.values);
  // José 06/11: the name first, like Portal; until then only the place keeps reading, and the camera stays off.
  const step = signingStepOf(fields, state.values);
  // The three `gps` numbers are one block, drawn where the latitude goes.
  const shown = visibleFields(fields, state.values).filter((field) => field.name !== signer?.name && (step === 'sign' || field.kind === 'location') && !(field.kind === 'number' && field.gps && field.gps !== 'lat'));
  // A form that splits an amount wears design gst-02 from its first step, even while its partidas are hidden.
  const designed = isSplitForm(fields);
  const steps = numberedStepsOf(fields, shown);
  // The summary's remarks («la lectura de fin va después del inicio») under their fields; the person's own errors win.
  const slot: SlotContext = { fields, values: state.values, errors: { ...live.summary.errors, ...state.errors }, selfieField, locationName, selfie, upload: props.onUpload, onPlace: props.onPlace, set: state.set, setList: state.setList, place, workStreets: props.workStreets ?? null, designed, steps };
  const footer = <FormFooter summary={live.summary.blocks} message={state.message} busy={state.sending || waiting} refreshing={live.refreshing} label={label} others={form.submits?.slice(1) ?? []} note={evidence ? (selfieField ? LIVE_FOOTER : evidence) : ''} onSend={(action) => void state.send(action ?? form.submits?.[0])} />;
  return (
    <Overlay title={form.title} onClose={props.onClose} footer={step === 'sign' ? footer : undefined} wide={isWideForm(fields) || designed} header={designed ? <FormHeader title={form.title} appName={props.answer.appName} avatarUrl={props.answer.avatarUrl} where={props.where} personName={props.personName} /> : undefined}>
      <div ref={body} data-testid={`formulario-${form.id}`} className="space-y-4">
        {designed && props.answer.context ? <FormContextCard context={props.answer.context} /> : null}
        <FormIntro answer={props.answer} clock={Boolean(evidence) && !selfieField} personName={props.personName} app={!designed} />
        {form.checkAll ? (
          <button type="button" data-testid="marcar-todo" onClick={() => state.fill(checkAllValues(fields, state.values))} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-[14px] font-semibold text-primary hover:bg-primary/15">
            <CheckCheck size={18} /> {CHECK_ALL_LABEL}
          </button>
        ) : null}
        {signer && step === 'who' ? <SignerPicker field={signer} onPick={state.set(signer.name)} /> : null}
        {signer && step === 'sign' ? <SignerCard field={signer} value={state.values[signer.name]} error={slot.errors[signer.name]} onChange={() => state.set(signer.name)('')} /> : null}
        {/* The fields under a header fold (agentes 13/11); the rest are drawn as they come. */}
        {groupedBySection(shown).map((block) =>
          block.kind === 'section' ? (
            <FoldedSection key={`${block.label}-${block.fields[0]!.name}`} label={block.label} collapsed={block.collapsed} fields={block.fields} values={state.values} errors={slot.errors} designed={designed}>
              <FieldRows fields={block.fields} context={slot} />
            </FoldedSection>
          ) : (
            <FieldRows key={block.fields[0]!.name} fields={block.fields} context={slot} />
          )
        )}
      </div>
    </Overlay>
  );
}

/** Two short fields share a row (José, 28/10: a field per row made the forms a sheet). */
function FieldRows(props: { fields: readonly FormField[]; context: SlotContext }) {
  return (
    <>
      {formRows(props.fields).map((row) =>
        row.length === 2 ? (
          <div key={row[0]!.name} data-row="2" className="grid grid-cols-2 items-start gap-3">
            {row.map((field) => <FieldSlot key={field.name} field={field} half context={props.context} />)}
          </div>
        ) : (
          <FieldSlot key={row[0]!.name} field={row[0]!} context={props.context} />
        )
      )}
    </>
  );
}

/** Above the fields: the app's line and the clock of a registration. */
function FormIntro(props: { answer: EphemeralAnswer; clock: boolean; personName?: string; /** The app's line, when the header does not say it already. */ app: boolean }) {
  const { answer } = props;
  const today = new Date();
  return (
    <>
      {answer.response?.text ? <p data-testid="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[14px]">{answer.response.text}</p> : null}
      {answer.response?.form?.intro ? <p className="text-[14px] text-on-surface-variant">{answer.response.form.intro}</p> : null}
      {props.app ? (
        <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={22} rounded="rounded-md" /> : <Avatar name={answer.appName} size={22} bot />}
          <span>{answer.appName} · hoy, {today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      ) : null}
      {props.clock ? (
        // Audit 12/11: a bare «17:41» in a box read as a field to fill; it is the hour this is registered at.
        <div data-testid="formulario-hora" className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2">
          <p className="flex items-center gap-2"><Clock size={18} className="text-primary" aria-hidden /><span className="text-[13px] text-on-surface-variant">Se registra a las</span><span className="text-xl font-bold tabular-nums tracking-tight">{today.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></p>
          {props.personName ? <p className="min-w-0 truncate text-[13px] text-on-surface-variant">{props.personName}</p> : null}
        </div>
      ) : null}
    </>
  );
}

/** By the button, never at the end of the scroll: a refusal there looked like a dead button (E2E 24/10). */
function FormFooter(props: { summary: PreviewReply['blocks']; message: string; busy: boolean; refreshing: boolean; label: string; /** The buttons after the first (agentes 13/11: «Guardar borrador»). */ others: readonly FormSubmit[]; note: string; onSend: (action?: FormSubmit) => void }) {
  return (
    <div>
      {/* By the button too (Andrea 12/11): at the top it was out of sight while picking the partida. */}
      {props.refreshing ? <p data-testid="formulario-actualizando" role="status" className="mb-2 animate-pulse text-center text-[13px] text-on-surface-variant">Actualizando las opciones…</p> : null}
      {props.summary.length ? <FormSummary blocks={props.summary} /> : null}
      {props.message ? <div data-testid="formulario-error" className="mb-2"><FieldError>{props.message}</FieldError></div> : null}
      <PrimaryButton testId="btn-enviar-formulario" disabled={props.busy} onClick={() => props.onSend()}>{props.label}</PrimaryButton>
      {props.others.map((other) => (
        <button key={other.id} type="button" data-testid={`btn-enviar-formulario-${other.id}`} disabled={props.busy} onClick={() => props.onSend(other)} className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">{other.label}</button>
      ))}
      {props.note ? <p className="mt-2 text-center text-[12px] text-on-surface-variant">{props.note}</p> : null}
    </div>
  );
}

/** What every field of the form draws from. */
type SlotContext = {
  fields: readonly FormField[];
  values: FormValues;
  errors: Record<string, string>;
  selfieField: Pick<FormField, 'name'> | null;
  locationName?: string;
  selfie: RefObject<LiveSelfieHandle>;
  upload: Upload;
  onPlace?: PlaceLookup;
  set: (name: string) => (value: unknown) => void;
  setList: (name: string) => (items: FormValues[], changed: string) => void;
  place: ReturnType<typeof useFieldAutofill>;
  workStreets: readonly WorkMapStreet[] | null;
  /** A form that splits an amount, and the step number of each of its steps (design gst-02). */
  designed: boolean;
  steps: Record<string, number>;
};

/** One field; `half` when it shares its row. */
function FieldSlot(props: { field: FormField; half?: boolean; context: SlotContext }) {
  const { field, half = false } = props;
  const { values, errors, selfieField, locationName, upload } = props.context;
  const chips = field.kind === 'choice' && chipsFor(props.context.fields, field);
  const place = placeSlot(field, props.context);
  if (place) return place;
  if (selfieField && field.name === selfieField.name) {
    return <LiveSelfie ref={props.context.selfie} testId={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} onPlace={props.context.onPlace} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />;
  }
  return (
    // In a signing the place shows inside the camera; its field keeps reading behind it.
    <FormStyleContext.Provider value={{ designed: props.context.designed, step: props.context.steps[field.name] }}>
    <div data-field={field.name} hidden={Boolean(selfieField) && field.kind === 'location'}>
      {chips ? <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{LIVE_CHOICE_KICKER}</p> : null}
      {chips ? (
        <SigningChips field={field} value={values[field.name]} error={errors[field.name]} onChange={props.context.set(field.name)} />
      ) : field.kind === 'list' ? (
        <ListField field={field} value={values[field.name]} errors={errors} onChange={props.context.setList(field.name)} split={splitFor(props.context.fields, values, field.name)} renderField={(child, value, error, onChange, key, halfCell) => <Field key={key} field={child} value={value} error={error} onChange={onChange} upload={upload} half={halfCell} />} />
      ) : (
        <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={props.context.set(field.name)} upload={upload} half={half} />
      )}
    </div>
    </FormStyleContext.Provider>
  );
}

/** The fields the reading fills (CON-CAP): the point's place and the work map's street. */
function placeSlot(field: FormField, context: SlotContext) {
  const { place, values, errors } = context;
  if (field.kind === 'number' && field.gps === 'lat') {
    const group = place.group;
    const error = group ? errors[group.lat] ?? errors[group.lng] ?? (group.precision ? errors[group.precision] : undefined) : undefined;
    return <div data-field={field.name}><GpsReadingField reading={place.reading} state={place.state} error={error} onTake={place.take} /></div>;
  }
  if (field.kind === 'text' && field.street) return <div data-field={field.name}><WorkStreetField field={field} value={values[field.name]} error={errors[field.name]} onChange={context.set(field.name)} streets={context.workStreets} reading={place.reading} /></div>;
  return null;
}

function Field(props: { field: Exclude<FormField, { kind: 'list' }>; value: unknown; error?: string; onChange: (value: unknown) => void; upload: Upload; half?: boolean }) {
  const { field, upload, half, ...rest } = props;
  switch (field.kind) {
    case 'choice': return isRichChoice(field) ? <RichChoiceField field={field} {...rest} /> : <ChoiceField field={field} {...rest} compact={half} />;
    case 'multi': return <MultiField field={field} {...rest} />;
    case 'text': return <TextField field={field} {...rest} />;
    case 'check': return <CheckField field={field} {...rest} />;
    case 'number': return <NumberField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} />;
    case 'location': return <LocationField field={field} {...rest} />;
    case 'photo': return field.multiple ? <PhotoListField field={field} error={rest.error} onChange={rest.onChange} upload={upload} /> : <PhotoField field={field} {...rest} upload={upload} />;
  }
}
