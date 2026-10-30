import { useEffect, useMemo, useRef, useState } from 'react';
import { firstErrorField, initialValues, keptAfterRefresh, validateFormValues, visibleFields, type FormField, type FormSubmitOutcome, type FormValues } from '@lilachat/shared';

type Errors = Record<string, string>;
/** The part of a signing the send needs: the stand-ins that pass validation, and the real photo and place. */
type Signing = { placeholders: (values: FormValues) => FormValues; prepare: (values: FormValues) => Promise<{ values: FormValues } | { errors: Errors }> };

type Params = {
  fields: readonly FormField[];
  /** What the app refused, back with the form (a late answer). */
  refused?: Errors;
  signing: Signing;
  onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>;
  /** Brings the first field with an error into sight. */
  reveal: (name: string) => void;
};

/**
 * What a form holds while it is filled: its values, the errors under each
 * field and the line by the button, and the send. The web's
 * `useAppFormState` is its twin.
 */
export function useAppFormState({ fields, refused, signing, onSubmit, reveal }: Params) {
  // What the app prefilled (agentes, 23/10: the verified phone) and today's date (José, 24/10); read once, so «now» is one instant.
  const prefilled = useMemo(() => initialValues(fields), [fields]);
  const [values, setValues] = useState<FormValues>(prefilled);
  // The app sent the form again (a new period, or its late answer): what is still offered stays picked.
  const shownFields = useRef(fields);
  useEffect(() => {
    if (shownFields.current === fields) return;
    shownFields.current = fields;
    setValues((before) => ({ ...prefilled, ...keptAfterRefresh(fields, before) }));
  }, [fields, prefilled]);
  const [errors, setErrors] = useState<Errors>(() => refused ?? {});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const showErrors = (next: Errors) => {
    setErrors(next);
    const name = firstErrorField(visibleFields(fields, values).map((field) => field.name), next);
    if (name) reveal(name);
  };
  useEffect(() => {
    if (!refused) return;
    showErrors(refused);
    setMessage(refused._ ?? '');
  }, [refused]);
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
    const outcome = await onSubmit(prepared.values);
    setSending(false);
    if (!outcome.done) {
      showErrors(outcome.errors);
      setMessage(outcome.errors._ ?? outcome.message ?? '');
    }
  };
  return { prefilled, values, errors, message, sending, set, setList, send };
}
