import { useState, type ComponentProps } from 'react';
import { abrirConOtraApp, compartirFoto, guardarEnGaleria } from './guardarYCompartir';
import { VisorDeImagen } from './VisorDeImagen';
import { saveGifSticker } from './stickers/useStickers';
import { isPdf } from './pdf/pdfSource';

type Foto = NonNullable<ComponentProps<typeof VisorDeImagen>['foto']>;

/**
 * El visor de fotos del chat con lo que se hace desde él: guardar, compartir,
 * eliminar y abrir con otra app (salió de `ChatScreen`). El resultado se DICE
 * dentro del visor: una descarga que no avisa deja sin saber si reintentar.
 */
export function VisorDelChat(props: {
  fotos: Foto[];
  viendoSeq: number | null;
  onCambiar: (seq: number | null) => void;
  onEliminar: (seq: number) => Promise<{ ok: boolean; motivo?: string }>;
  onError: (texto: string) => void;
  /** Where a GIF can become my animated sticker (pending 37); absent in a secret chat. */
  gifSticker?: { jwt: string; chatId: string };
  /** A PDF opens in the app's viewer (pending 7); `false` = this build has none, so another app opens it. */
  onOpenPdf?: (seq: number) => boolean;
  /** A form's option seen in the viewer (design h-03). */
  action?: { label: string; onPress: () => void };
}) {
  const { gifSticker } = props;
  /** El resultado de descargar/compartir, que se pinta DENTRO del visor. */
  const [avisoVisor, setAvisoVisor] = useState('');
  return (
  <VisorDeImagen
    foto={props.fotos.find((foto) => foto.seq === props.viendoSeq) ?? null}
    otras={props.fotos}
    onCerrar={() => props.onCambiar(null)}
    onCambiar={(otra) => props.onCambiar(otra.seq)}
    aviso={avisoVisor}
    {...(props.action ? { action: props.action } : {})}
    onDescargar={async (f) => {
      // El resultado se DICE en los dos sentidos, y DENTRO del visor: una
      // descarga que no avisa nada deja sin saber si hay que reintentar.
      setAvisoVisor('Guardando…');
      const r = await guardarEnGaleria({ url: f.url, cuando: f.cuandoReal, mime: f.mime, seq: f.seq });
      setAvisoVisor(r.ok ? 'Guardada en tu galería' : r.motivo);
      setTimeout(() => setAvisoVisor(''), 3000);
    }}
    onCompartir={async (f) => {
      const r = await compartirFoto({ url: f.url, cuando: f.cuandoReal, mime: f.mime, seq: f.seq });
      if (!r.ok) {
        setAvisoVisor(r.motivo);
        setTimeout(() => setAvisoVisor(''), 3000);
      }
    }}
    onEliminar={async (f) => {
      props.onCambiar(null);
      const r = await props.onEliminar(f.seq);
      if (!r.ok) props.onError(r.motivo ?? 'No se pudo eliminar.');
    }}
    onMakeSticker={gifSticker ? async (f) => {
      setAvisoVisor('Convirtiendo en sticker…');
      setAvisoVisor(await saveGifSticker(gifSticker.jwt, { chatId: gifSticker.chatId, seq: f.seq }));
      setTimeout(() => setAvisoVisor(''), 3000);
    } : undefined}
    onAbrirArchivo={async (f) => {
      if (isPdf(f.mime) && props.onOpenPdf?.(f.seq)) return props.onCambiar(null);
      setAvisoVisor('Abriendo…');
      const r = await abrirConOtraApp({
        url: f.url,
        cuando: f.cuandoReal,
        mime: f.mime,
        seq: f.seq,
        nombre: f.nombre,
      });
      setAvisoVisor(r.ok ? '' : r.motivo);
      if (!r.ok) setTimeout(() => setAvisoVisor(''), 4000);
    }}
  />
  );
}
