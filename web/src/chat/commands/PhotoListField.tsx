import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import type { FormField } from '@lilachat/shared';

type PhotoList = Extract<FormField, { kind: 'photo' }>;
type Shot = { key: string; preview: string; fileId: string | null };
type Upload = (file: File) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

/**
 * Several photos (José, 24/10: the tank tape and the material receipt): add,
 * remove any and add again. Each goes up at once; the form carries the ids in
 * order. The APK's twin is `PhotoListField` there.
 */
export function PhotoListField({ field, error, onChange, upload }: { field: PhotoList; error?: string; onChange: (value: unknown) => void; upload: Upload }) {
  const input = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const publish = (next: Shot[]) => {
    const ids = next.map((shot) => shot.fileId).filter((id): id is string => id !== null);
    onChange(ids.length ? ids : undefined);
  };
  const add = async (files: FileList | null) => {
    const room = field.max - shots.length;
    const picked = Array.from(files ?? []).slice(0, room).map((file) => ({ file, shot: { key: `${Date.now()}-${file.name}`, preview: URL.createObjectURL(file), fileId: null } as Shot }));
    if (!picked.length) return;
    setMessage(undefined);
    let current = [...shots, ...picked.map((one) => one.shot)];
    setShots(current);
    for (const { file, shot } of picked) {
      const uploaded = await upload(file);
      current = uploaded.ok ? current.map((one) => (one.key === shot.key ? { ...one, fileId: uploaded.fileId } : one)) : current.filter((one) => one.key !== shot.key);
      if (!uploaded.ok) setMessage(uploaded.message);
      setShots(current);
      publish(current);
    }
  };
  const remove = (key: string) => {
    const next = shots.filter((shot) => shot.key !== key);
    setShots(next);
    publish(next);
  };
  const uploading = shots.some((shot) => shot.fileId === null);
  return (
    <div data-testid={`fotos-${field.name}`} className="rounded-2xl border border-outline/15 p-3">
      <p className="text-[14px] font-semibold">{field.label}</p>
      {field.help ? <p className="text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <p className="text-[12px] text-on-surface-variant">{`${shots.length} de ${field.max}${field.min > 1 ? ` · al menos ${field.min}` : ''}`}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {shots.map((shot, index) => (
          <div key={shot.key} className="relative h-20 w-20 overflow-hidden rounded-xl border border-outline/20">
            <img src={shot.preview} alt="" className="h-full w-full object-cover" />
            {shot.fileId === null ? <span className="absolute inset-0 grid place-items-center bg-on-surface/40"><Loader2 size={18} className="animate-spin text-surface" /></span> : null}
            <button type="button" data-testid={`quitar-foto-${field.name}-${index}`} aria-label={`Quitar la foto ${index + 1}`} onClick={() => remove(shot.key)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-on-surface/70 text-surface"><X size={13} /></button>
          </div>
        ))}
        {shots.length >= field.max ? null : (
          <button type="button" data-testid={`campo-${field.name}`} disabled={uploading} onClick={() => input.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-outline/30 text-primary disabled:opacity-50">
            <span className="flex flex-col items-center gap-0.5 text-[12px] font-semibold"><Camera size={20} />{shots.length ? 'Otra' : 'Agregar'}</span>
          </button>
        )}
      </div>
      <input ref={input} data-testid={`archivo-${field.name}`} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="hidden" onChange={(event) => { void add(event.target.files); event.target.value = ''; }} />
      {message ?? error ? <p role="alert" className="mt-1 text-[12px] text-error">{message ?? error}</p> : null}
    </div>
  );
}
