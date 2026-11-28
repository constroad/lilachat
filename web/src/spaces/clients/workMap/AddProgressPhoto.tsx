import { useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { ADD_PHOTO_LABEL, afterPhotoAdd, ADDING_PHOTO, photosLabel, type ProgressPhotoResult } from '@lilachat/shared';
import type { PickerHandle } from '../../../chat/camera/cameraRequests';
import { DrivePhotoInput } from '../ServiceDriveWeb';

type Props = { id: string; photos: number; /** Undefined: the record shows its photos but takes no more. */ add?: (file: File) => Promise<ProgressPhotoResult | null> };

/** «Agregar foto» on a record already made (José 28/11): the same camera as «Tomar foto y registrar», then its count. */
export function AddProgressPhoto(props: Props) {
  const camera = useRef<PickerHandle>(null);
  const [photos, setPhotos] = useState(props.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = Math.max(photos, props.photos);
  const picked = async (file: File | undefined) => {
    if (!file || !props.add) return;
    setBusy(true);
    setError(null);
    const added = await props.add(file);
    const next = afterPhotoAdd(added, shown);
    setBusy(false);
    setError(next.error);
    setPhotos(next.photos);
  };
  if (!shown && !props.add) return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {shown ? <span data-testid={`avance-fotos-${props.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-on-surface"><Camera size={14} className="text-on-surface-variant" />{photosLabel(shown)}</span> : null}
        {props.add ? <button type="button" data-testid={`agregar-foto-${props.id}`} disabled={busy} onClick={() => camera.current?.click()} className="flex h-10 items-center gap-1.5 rounded-xl border border-outline/25 px-3 text-[13px] font-semibold text-on-surface hover:bg-background disabled:opacity-60"><ImagePlus size={15} />{busy ? ADDING_PHOTO : ADD_PHOTO_LABEL}</button> : null}
        {props.add ? <DrivePhotoInput ref={camera} testId={`agregar-foto-archivo-${props.id}`} onFile={(file) => void picked(file)} /> : null}
      </div>
      {error ? <p role="alert" data-testid={`agregar-foto-error-${props.id}`} className="text-[12px] font-semibold text-error">{error}</p> : null}
    </div>
  );
}
