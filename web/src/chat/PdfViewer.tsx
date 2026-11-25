import { useEffect, useState } from 'react';
import { FullscreenFileViewer, FULLSCREEN_FRAME_CLASS, FULLSCREEN_NOTE_CLASS } from '../media/FullscreenFileViewer';

/**
 * A chat's PDF inside the web (José, 21/10: there was no viewer, it opened
 * another tab). It comes through Lilachat (`GET /api/chats/:id/files/:seq`,
 * which checks membership) and is shown from memory, in the browser's own PDF
 * viewer, at full screen like WhatsApp (25/11). Escape or the X close it.
 */
export function PdfViewer(props: { jwt: string; chatId: string; seq: number; fileName: string; downloadUrl: string; subtitle?: string; onClose: () => void }) {
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
        console.warn('[pdf] could not open:', error instanceof Error ? error.message : error);
        if (alive) setFile('failed');
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.jwt, props.chatId, props.seq]);
  return (
    <FullscreenFileViewer title={props.fileName} subtitle={props.subtitle} downloadUrl={props.downloadUrl} downloadName={props.fileName} onClose={props.onClose}>
      {file === 'loading' ? <div data-testid="pdf-cargando" className="h-full w-full animate-pulse rounded-md bg-white/10" /> : null}
      {file === 'failed' ? <p role="alert" className={FULLSCREEN_NOTE_CLASS}>No se pudo abrir el PDF. Descárgalo para verlo.</p> : null}
      {typeof file === 'object' ? <iframe data-testid="pdf-visor" title={props.fileName} src={file.url} className={FULLSCREEN_FRAME_CLASS} /> : null}
    </FullscreenFileViewer>
  );
}
