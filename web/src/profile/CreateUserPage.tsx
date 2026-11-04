import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Mail, Plus } from 'lucide-react';
import type { MyProfile } from '@lilachat/shared';
import { SpaceLogo } from '../spaces/SpaceLogo';
import { saveProfile, uploadProfilePhoto } from './profileApi';

/**
 * «Crea tu usuario» on the web (design `i-04-crea-tu-usuario`): an account born
 * from an email writes its name once, and the photo is optional. Without a space
 * chosen yet, it speaks of Lilachat.
 */
export function CreateUserPage(props: { jwt: string; email: string | null; space?: { name: string; logoUrl?: string }; onDone: (profile: MyProfile) => void }) {
  const { jwt, space } = props;
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = Boolean(name.trim()) && !busy;

  const addPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    const uploaded = await uploadProfilePhoto(jwt, file);
    setBusy(false);
    if (uploaded.ok) setPhotoUrl(uploaded.avatarUrl);
    else setError(uploaded.message);
  };

  const finish = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    const saved = await saveProfile(jwt, { name: name.trim() });
    setBusy(false);
    if (saved.ok) props.onDone(saved.data.profile);
    else setError(saved.message);
  };

  return (
    <main className="grid min-h-full place-items-center px-4" data-testid="pantalla-crea-tu-usuario">
      <div className="w-full max-w-sm py-8">
        {space ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-outline/20 bg-surface-variant/40 py-1.5 pl-2 pr-3 text-[13px] font-semibold tracking-wide"><SpaceLogo space={space} size={28} />{space.name}</span>
        ) : null}
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Crea tu usuario</h1>
        <p className="mt-1 text-on-surface-variant">Así te verán en {space?.name ?? 'Lilachat'}.</p>
        <button type="button" data-testid="btn-agregar-foto" disabled={busy} onClick={() => fileRef.current?.click()} className="mx-auto mt-7 block text-center">
          <span className="relative mx-auto block h-28 w-28">
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border border-dashed border-outline/40 bg-surface-variant/40">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={32} className="text-outline" />}
            </span>
            <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-on-primary"><Plus size={18} /></span>
          </span>
          <span className="mt-3 block text-[15px] font-semibold text-primary">Agregar foto</span>
          <span className="block text-[13px] text-on-surface-variant">Opcional</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void addPhoto(event)} />
        <label className="mt-7 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="nombre-completo">Nombre completo</label>
        <input id="nombre-completo" data-testid="input-nombre-completo" autoFocus autoComplete="name" placeholder="Nombre y apellido" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void finish()} className="mt-2 h-12 w-full rounded-xl border border-outline/25 bg-surface px-4 text-base outline-none placeholder:text-on-surface-variant focus:border-primary" />
        {props.email ? <p className="mt-3 flex items-center gap-2 text-[13px] text-on-surface-variant"><Mail size={16} /><span className="min-w-0 truncate">Entras con <b className="font-medium text-on-surface">{props.email}</b></span></p> : null}
        {error ? <p data-testid="error-crea-usuario" className="mt-3 text-sm text-error">{error}</p> : null}
        <button type="button" data-testid="btn-entrar-espacio" disabled={!ready} onClick={() => void finish()} className="mt-8 h-12 w-full rounded-lg bg-primary text-[15px] font-bold text-on-primary disabled:opacity-40">{space ? `Entrar a ${space.name}` : 'Entrar'}</button>
      </div>
    </main>
  );
}
