import { useState } from 'react';
import { Camera } from 'lucide-react';
import type { ClientWorkspace } from '@lilachat/shared';
import { removeSpaceLogo, uploadSpaceLogo } from './spacesApi';

const PREVIEW = 52;

/**
 * «Logo de la cámara» (José 27/11: the round avatar in the app, the square logo on the photos). Optional: without it
 * the camera stamps the space's logo.
 */
export function CameraLogoRow(props: { space: ClientWorkspace; jwt: string; onSaved: (space: ClientWorkspace) => void; onError: (message: string) => void }) {
  const [url, setUrl] = useState(props.space.cameraLogoUrl);
  const [busy, setBusy] = useState(false);
  const change = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const sent = await uploadSpaceLogo(props.jwt, props.space.id, file, 'camera-logo');
    setBusy(false);
    if (!sent.ok) return props.onError(sent.message);
    setUrl(sent.workspace.cameraLogoUrl);
    props.onSaved(sent.workspace);
  };
  const reset = async () => {
    setBusy(true);
    const response = await removeSpaceLogo(props.jwt, props.space.id, 'camera-logo');
    setBusy(false);
    if (!response.ok) return props.onError(response.message);
    setUrl(undefined);
    props.onSaved(response.data.workspace);
  };
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-outline/20 bg-background text-on-surface-variant" style={{ width: PREVIEW, height: PREVIEW }}>
        {url ? <img src={url} alt="" data-testid="ajustes-logo-camara-vista" className="h-full w-full object-contain" /> : <Camera size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Logo de la cámara</p>
        <p className="text-[12px] text-on-surface-variant">Va en la marca de las fotos. Si no hay, va el del espacio.</p>
        <div className="mt-2 flex items-center gap-2">
          <label className={`flex h-9 cursor-pointer items-center rounded-lg border border-outline/25 px-3 text-sm font-semibold hover:bg-background ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            Cambiar
            {/* gates-allow: camara a brand logo picked as a file, shrunk like the space logo: it is what the camera stamps, not a photo taken */}
            <input data-testid="ajustes-logo-camara-archivo" type="file" accept="image/*" className="sr-only" onChange={(event) => void change(event.target.files?.[0])} />
          </label>
          {url ? <button type="button" data-testid="ajustes-quitar-logo-camara" disabled={busy} onClick={() => void reset()} className="h-9 px-2 text-sm font-semibold text-on-surface-variant disabled:opacity-50">Restablecer</button> : null}
        </div>
      </div>
    </div>
  );
}
