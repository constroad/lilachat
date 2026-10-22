import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Overlay } from '../ui/Overlay';

/**
 * A chat's PDF inside the web (José, 21/10: there was no viewer, it opened
 * another tab). It comes through Lilachat (`GET /api/chats/:id/files/:seq`,
 * which checks membership) and is shown from memory, in the browser's own PDF
 * viewer. Escape, the X or the backdrop close it.
 */
export function PdfViewer(props: { jwt: string; chatId: string; seq: number; fileName: string; downloadUrl: string; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string } | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void fetch(`/api/chats/${props.chatId}/files/${props.seq}`, { headers: { Authorization: `Bearer ${props.jwt}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        objectUrl = URL.createObjectURL(await response.blob());
        if (alive) setFile({ url: objectUrl });
      })
      .catch((error: unknown) => {
        console.warn('[pdf] no se pudo abrir:', error instanceof Error ? error.message : error);
        if (alive) setFile('failed');
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.jwt, props.chatId, props.seq]);
  return (
    <Overlay
      title={props.fileName}
      onClose={props.onClose}
      wide
      footer={
        <a href={props.downloadUrl} download={props.fileName} target="_blank" rel="noreferrer" data-testid="pdf-descargar" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-primary hover:bg-background">
          <Download size={16} /> Descargar
        </a>
      }
    >
      {file === 'loading' ? <div data-testid="pdf-cargando" className="h-[70vh] animate-pulse rounded-lg bg-background" /> : null}
      {file === 'failed' ? <p role="alert" className="rounded-lg bg-error/5 px-4 py-6 text-center text-sm text-error">No se pudo abrir el PDF. Descárgalo para verlo.</p> : null}
      {typeof file === 'object' ? <iframe data-testid="pdf-visor" title={props.fileName} src={file.url} className="h-[70vh] w-full rounded-lg border border-outline/15 bg-white" /> : null}
    </Overlay>
  );
}
