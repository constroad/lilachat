import { useState } from 'react';
import { Check, ChevronDown, Image as ImageIcon, Lock } from 'lucide-react';
import type { ChoiceOption, FormField } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { usePortalFileViewer } from '../../spaces/clients/PortalFileViewer';
import { Label } from './AppFormFields';

type FieldProps<K extends FormField['kind']> = { field: Extract<FormField, { kind: K }>; value: unknown; error?: string; onChange: (value: unknown) => void };

/** Whether a choice needs the rich list: a thumbnail to see, or an option that shows but cannot be picked. */
export const isRichChoice = (field: Extract<FormField, { kind: 'choice' }>): boolean => field.options.some((option) => option.thumb || option.disabled);

/** A locked option's look: dimmed, its label struck, its reason in the warning tone (design h-01). */
function OptionText(props: { option: ChoiceOption }) {
  const { option } = props;
  return (
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-[15px] ${option.disabled ? 'text-on-surface-variant line-through' : 'font-semibold'}`}>{option.label}</span>
      {option.sub ? <span className={`block truncate text-[13px] ${option.disabled ? 'text-warning' : 'text-on-surface-variant'}`}>{option.sub}</span> : null}
    </span>
  );
}

/**
 * Several options at once (agentes 2483da7, design h-01): a row per option
 * with its check; a locked one stays in the list with why, never picked.
 */
export function MultiField({ field, value, error, onChange }: FieldProps<'multi'>) {
  const picked = new Set(Array.isArray(value) ? value.map(String) : []);
  const toggle = (option: ChoiceOption) => {
    if (option.disabled) return;
    const next = new Set(picked);
    if (next.has(option.value)) next.delete(option.value);
    else next.add(option.value);
    onChange(field.options.filter((one) => next.has(one.value)).map((one) => one.value));
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label field={field} />
        {picked.size ? <span data-testid={`elegidos-${field.name}`} className="mb-1.5 rounded-full border border-primary/30 px-2.5 py-0.5 text-[12px] font-semibold text-primary">{`${picked.size} ${picked.size === 1 ? 'elegido' : 'elegidos'}`}</span> : null}
      </div>
      {field.options.length === 0 ? <p data-testid={`sin-opciones-${field.name}`} className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">No hay opciones para elegir</p> : null}
      <div role="group" aria-label={field.label} className="space-y-2">
        {field.options.map((option) => {
          const on = picked.has(option.value);
          return (
            <button key={option.value} type="button" role="checkbox" aria-checked={on} aria-disabled={option.disabled || undefined} data-testid={`opcion-${field.name}-${option.value}`} onClick={() => toggle(option)} className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${option.disabled ? 'cursor-not-allowed border-outline/15 bg-background' : on ? 'border-primary bg-primary/[0.06]' : 'border-outline/25 hover:bg-background'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${option.disabled ? 'border-outline/20 text-on-surface-variant' : on ? 'border-primary bg-primary text-on-primary' : 'border-outline/40'}`}>
                {option.disabled ? <Lock size={13} /> : on ? <Check size={15} strokeWidth={3} /> : null}
              </span>
              <OptionText option={option} />
            </button>
          );
        })}
      </div>
      {field.help ? <p className="mt-1 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** The option's square picture, with how many photos are behind it (design h-01, h-02). */
function Thumb(props: { option: ChoiceOption; size: number; onOpen?: () => void }) {
  const { option, size } = props;
  const count = option.photos?.length ?? 0;
  const body = (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-background text-on-surface-variant" style={{ width: size, height: size }}>
      {option.thumb ? <img src={option.thumb} alt="" loading="lazy" className={`h-full w-full object-cover ${option.disabled ? 'opacity-50' : ''}`} /> : <ImageIcon size={18} />}
      {count > 1 ? <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{count}</span> : null}
    </span>
  );
  if (!props.onOpen || !(option.photos?.length || option.thumb)) return body;
  return <button type="button" aria-label={`Ver las fotos de ${option.label}`} data-testid={`ver-fotos-${option.value}`} onClick={props.onOpen}>{body}</button>;
}

/**
 * One option out of a list that carries pictures or locked options (agentes
 * 2483da7, designs h-02/h-03): the picked one with its thumbnail; tapping
 * opens the list, tapping a thumbnail opens its photos in the viewer, and
 * «Elegir» confirms.
 */
export function RichChoiceField({ field, value, error, onChange }: FieldProps<'choice'>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const viewer = usePortalFileViewer();
  const current = field.options.find((option) => option.value === value);
  const showPhotos = (option: ChoiceOption) => {
    const urls = option.photos?.length ? option.photos : option.thumb ? [option.thumb] : [];
    const files = urls.map((url, index) => ({ url, name: `${option.label} · foto ${index + 1}`, mime: 'image/jpeg' }));
    const action = option.disabled ? undefined : { label: 'Elegir esta opción', onPress: () => choose(option.value) };
    if (files[0]) viewer.open(files[0], files, action);
  };
  const choose = (picked: string) => {
    onChange(picked);
    setOpen(false);
  };
  return (
    <div>
      <Label field={field} />
      <button type="button" data-testid={`campo-${field.name}`} onClick={() => { setDraft(current?.value ?? null); setOpen(true); }} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-outline/25 bg-background px-3 py-2 text-left hover:border-primary">
        {current ? <Thumb option={current} size={44} /> : null}
        {current ? <OptionText option={current} /> : <span className="flex-1 text-[15px] text-on-surface-variant">Elige…</span>}
        <ChevronDown size={18} className="shrink-0 text-on-surface-variant" />
      </button>
      {field.help ? <p className="mt-1 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <FieldError>{error}</FieldError>
      {open ? (
        <Overlay title={field.label} onClose={() => setOpen(false)} footer={<PrimaryButton testId={`elegir-${field.name}`} disabled={!draft} onClick={() => draft && choose(draft)}>Elegir</PrimaryButton>}>
          {field.options.some((option) => option.photos?.length) ? <p className="mb-2 text-[13px] text-on-surface-variant">Toca la miniatura para ver las fotos.</p> : null}
          <ul data-testid={`opciones-${field.name}`} className="divide-y divide-outline/10">
            {field.options.map((option) => (
              <li key={option.value} className={`flex min-h-[72px] items-center gap-3 py-2 ${draft === option.value ? 'bg-primary/[0.06]' : ''}`}>
                <Thumb option={option} size={56} onOpen={() => showPhotos(option)} />
                <button type="button" role="radio" aria-checked={draft === option.value} aria-disabled={option.disabled || undefined} data-testid={`opcion-${field.name}-${option.value}`} onClick={() => !option.disabled && setDraft(option.value)} className={`flex min-w-0 flex-1 items-center gap-2 text-left ${option.disabled ? 'cursor-not-allowed' : ''}`}>
                  <OptionText option={option} />
                  {draft === option.value ? <Check size={20} className="shrink-0 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </Overlay>
      ) : null}
      {viewer.viewer}
    </div>
  );
}
