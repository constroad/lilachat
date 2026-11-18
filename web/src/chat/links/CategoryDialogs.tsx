import { useState } from 'react';
import { MAX_CATEGORY_NAME, type LinkCategory } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { mergeLinkCategory, renameLinkCategory } from './linkNotesApi';
import { loadLinkNotes } from './linkNotesStore';

/**
 * «Renombrar» and «Unir con…» of a category (design nl-01 desktop). Both
 * read the view again when the server says yes (the socket does it too).
 */
type Target = { jwt: string; chatId: string; category: LinkCategory; onClose: () => void };

export function RenameCategoryDialog({ jwt, chatId, category, onClose }: Target) {
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    const response = await renameLinkCategory(jwt, chatId, category.id, name.trim());
    setBusy(false);
    if (!response.ok) return setError(response.message);
    void loadLinkNotes(jwt, chatId);
    onClose();
  };
  const unchanged = !name.trim() || name.trim() === category.name;
  return (
    <Overlay title="Renombrar categoría" onClose={onClose} footer={<PrimaryButton testId="btn-guardar-nombre-categoria" disabled={busy || unchanged} onClick={() => void save()}>Guardar</PrimaryButton>}>
      <label className="block text-[13px] font-semibold text-on-surface-variant" htmlFor="nombre-categoria">Nombre</label>
      <input id="nombre-categoria" data-testid="campo-nombre-categoria" autoFocus value={name} maxLength={MAX_CATEGORY_NAME} onChange={(event) => setName(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-outline/30 bg-surface px-3 text-[15px] outline-none focus:border-primary" />
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}

const NO_CATEGORY = 'none';

export function MergeCategoryDialog({ jwt, chatId, category, categories, count, onClose, onMerged }: Target & { categories: LinkCategory[]; count: number; onMerged: (into: string) => void }) {
  const others = categories.filter((one) => one.id !== category.id);
  const [into, setInto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const merge = async () => {
    if (!into) return;
    setBusy(true);
    const response = await mergeLinkCategory(jwt, chatId, category.id, into === NO_CATEGORY ? null : into);
    setBusy(false);
    if (!response.ok) return setError(response.message);
    void loadLinkNotes(jwt, chatId);
    onMerged(into);
    onClose();
  };
  const choices = [...others, { id: NO_CATEGORY, name: 'Sin categoría' }];
  return (
    <Overlay title={`Unir ${category.name} con…`} onClose={onClose} footer={<PrimaryButton testId="btn-unir-categoria" disabled={busy || !into} onClick={() => void merge()}>Unir</PrimaryButton>}>
      <p className="text-[14px] leading-6 text-on-surface-variant">
        {count === 1 ? 'Su enlace pasa' : `Sus ${count} enlaces pasan`} a la categoría que elijas y «{category.name}» desaparece.
      </p>
      <div role="radiogroup" aria-label="Unir con" className="mt-3 space-y-2">
        {choices.map((choice) => (
          <button key={choice.id} type="button" role="radio" aria-checked={into === choice.id} data-testid={`unir-con-${choice.id}`} onClick={() => setInto(choice.id)} className={`flex min-h-[48px] w-full items-center rounded-xl border px-4 text-left text-[15px] ${into === choice.id ? 'border-primary bg-primary/5 font-bold text-primary' : 'border-outline/20 hover:bg-background'}`}>
            {choice.name}
          </button>
        ))}
      </div>
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}
