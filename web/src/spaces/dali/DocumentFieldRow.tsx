import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { FIELD_VALUE_MAX, type ProspectField } from '@lilachat/shared';
import { Pill, TextButton } from './daliParts';
import { FieldGeoMap } from './FieldGeoMap';

/** «Confirmar» as it is, or «Corregir» with the right value: the seller settles what Dali read (fase 3). */
export type SettleField = (key: string, value?: string) => Promise<void>;

function CorrectForm({ field, onSave, onCancel }: { field: ProspectField; onSave: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(field.value);
  const clean = value.trim();
  return (
    <form className="mt-1.5 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (clean) onSave(clean); }}>
      <input data-testid={`corregir-valor-${field.key}`} aria-label={`${field.label} correcto`} value={value} maxLength={FIELD_VALUE_MAX} autoFocus onChange={(event) => setValue(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-outline/30 bg-surface px-2.5 text-[13px] outline-none focus:border-primary" />
      <button type="submit" data-testid={`guardar-correccion-${field.key}`} disabled={!clean} className="h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary disabled:opacity-40">Guardar</button>
      <TextButton tone="neutral" onClick={onCancel}>Cancelar</TextButton>
    </form>
  );
}

/** Below the value: who settled it, or the pill and its two actions while it waits. */
function Settlement({ field, onSettle }: { field: ProspectField; onSettle?: SettleField }) {
  const [correcting, setCorrecting] = useState(false);
  if (field.confirmedBy) return <p data-testid={`confirmado-${field.key}`} className="mt-1 text-[12px] text-on-surface-variant">{`Confirmado por ${field.confirmedBy.name}`}</p>;
  if (field.source !== 'document' || field.confirmed) return null;
  if (correcting && onSettle) return <CorrectForm field={field} onCancel={() => setCorrecting(false)} onSave={(value) => void onSettle(field.key, value).then(() => setCorrecting(false))} />;
  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
      <Pill tone="warn" testId={`por-confirmar-${field.key}`}>Leído del documento · por confirmar</Pill>
      {onSettle ? (
        <>
          <TextButton testId={`confirmar-${field.key}`} onClick={() => void onSettle(field.key)}><Check size={14} /> Confirmar</TextButton>
          <TextButton testId={`corregir-${field.key}`} tone="neutral" onClick={() => setCorrecting(true)}><Pencil size={14} /> Corregir</TextButton>
        </>
      ) : null}
    </div>
  );
}

export function DocumentFieldRow({ field, onSettle }: { field: ProspectField; onSettle?: SettleField }) {
  return (
    <div className="py-1.5 text-[13px]">
      <div className="flex gap-3">
        <dt className="w-28 shrink-0 text-on-surface-variant">{field.label}</dt>
        <dd className="min-w-0 flex-1 text-right font-semibold">{field.value}</dd>
      </div>
      <Settlement field={field} onSettle={onSettle} />
      {field.geo ? <FieldGeoMap geo={field.geo} testId={`mapa-dato-${field.key}`} /> : null}
    </div>
  );
}
