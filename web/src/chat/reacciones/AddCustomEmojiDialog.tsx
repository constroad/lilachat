import { Check, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CUSTOM_EMOJI_MAX_BYTES, customEmojiNameOf } from '@lilachat/shared';
import { useMySpaces } from '../../spaces/currentSpace';
import { addCustomEmoji, useSpaceEmojis } from '../../spaces/customEmojis';
import { Overlay } from '../../ui/Overlay';

const ACCEPTED = ['image/png', 'image/webp', 'image/gif'];

/** «Agregar emoji» (design c-07): the image, its `:name:` and save for the whole space. */
export function AddCustomEmojiDialog(props: { jwt: string; spaceId: string; onClose: () => void }) {
  const { reload } = useSpaceEmojis(props.jwt, props.spaceId);
  const spaceName = useMySpaces(props.jwt).spaces?.find((space) => space.id === props.spaceId)?.name ?? 'el espacio';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!file) return setPreview(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const shortName = customEmojiNameOf(name);

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    if (!ACCEPTED.includes(picked.type)) return setError('Elige un PNG, WebP o GIF.');
    if (picked.size > CUSTOM_EMOJI_MAX_BYTES) return setError('La imagen pasa de 256 KB. Elige una más liviana.');
    setError(null);
    setFile(picked);
  };
  const save = async () => {
    if (!file || !shortName || saving) return;
    setSaving(true);
    const added = await addCustomEmoji(props.jwt, props.spaceId, { name: shortName, file });
    setSaving(false);
    if (!added.ok) return setError(added.message);
    await reload();
    props.onClose();
  };

  return (
    <Overlay
      title="Agregar emoji"
      onClose={props.onClose}
      footer={
        <div className="flex w-full flex-col gap-1">
          <button type="button" data-testid="btn-guardar-emoji" disabled={!file || !shortName || saving} onClick={() => void save()} className="min-h-[44px] rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar emoji'}
          </button>
          <p className="text-center text-[12px] text-on-surface-variant">Lo verán todos en {spaceName}</p>
        </div>
      }
    >
      <div data-testid="agregar-emoji" className="flex flex-col gap-4 p-4">
        <section className="rounded-xl border border-outline/15 p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Paso 1 · Imagen del emoji</p>
          <label className="mx-auto grid h-32 w-32 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-primary/40 bg-background">
            {preview ? <img src={preview} alt="" className="h-20 w-20 object-contain" /> : <Upload className="text-primary" size={28} />}
            <input data-testid="archivo-emoji" type="file" accept={ACCEPTED.join(',')} className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
          </label>
          <p className="mt-2 text-center text-[12px] text-on-surface-variant">PNG, WebP o GIF animado · hasta 256 KB · se ve a 128×128</p>
        </section>
        <section className="rounded-xl border border-outline/15 p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Paso 2 · Nombre del código</p>
          <div className={`flex min-h-[44px] items-center rounded-lg border px-3 ${shortName ? 'border-primary' : 'border-outline/30'}`}>
            <input data-testid="nombre-emoji" value={name} onChange={(event) => setName(event.target.value)} placeholder=":casco-ok:" autoComplete="off" className="flex-1 bg-transparent font-mono outline-none" />
            {shortName ? <Check size={18} className="text-primary" /> : null}
          </div>
          <p className="mt-2 text-[12px] text-on-surface-variant">{shortName ? `Se escribe :${shortName}: en el chat.` : 'Se escribe con dos puntos en el chat. Solo letras, números y guiones.'}</p>
        </section>
        {error ? <p role="alert" data-testid="error-emoji" className="text-sm text-error">{error}</p> : null}
      </div>
    </Overlay>
  );
}
