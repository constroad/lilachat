import { useEffect, useMemo } from 'react';
import { FileText, Play, X } from 'lucide-react';

export type StagedFilesProps = {
  files: File[];
  onRemove: (index: number) => void;
  /** Opens the one preview (`SendFilesDialog`): caption, HD, remove. */
  onPreview: () => void;
};

/** José 13/11: what was picked waits inside the field as thumbnails; a click previews it. */
export function StagedFilesWeb(props: StagedFilesProps) {
  const urls = useMemo(() => props.files.map((file) => (/^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null)), [props.files]);
  useEffect(() => () => urls.forEach((url) => url && URL.revokeObjectURL(url)), [urls]);
  return (
    <div data-testid="adjuntos-en-espera" className="flex gap-2 overflow-x-auto px-2 pt-2">
      {props.files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="relative h-16 w-16 shrink-0">
          <button type="button" data-testid="adjunto-en-espera" title="Ver antes de enviar" onClick={props.onPreview} className="h-16 w-16 overflow-hidden rounded-lg border border-outline/20 bg-surface-variant">
            {urls[index] && file.type.startsWith('image/') ? <img src={urls[index]!} alt={file.name} className="h-full w-full object-cover" /> : null}
            {urls[index] && file.type.startsWith('video/') ? (
              <span className="relative block h-full w-full">
                <video src={urls[index]!} muted className="h-full w-full object-cover" />
                <Play size={18} className="absolute inset-0 m-auto text-on-primary" aria-hidden />
              </span>
            ) : null}
            {urls[index] ? null : <FileText size={22} className="m-auto text-on-surface-variant" aria-hidden />}
          </button>
          <button type="button" data-testid="quitar-adjunto" aria-label={`Quitar ${file.name}`} onClick={() => props.onRemove(index)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-on-surface text-surface">
            <X size={12} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
