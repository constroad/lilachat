import { useMemo, useRef } from 'react';
import type { FotoAEnviar, FotoElegida } from '../envioDeFotos';
import { EnviarFotos } from '../EnviarFotos';
import { Camera, type TakenMedia } from './Camera';

type Props = { visible: boolean; nombreDelChat: string; onEnviar: (fotos: FotoAEnviar[], opciones: { hd: boolean }) => void; onGaleria: () => void; onCerrar: () => void };

/**
 * The APK's one camera (`Camera`) in a chat (José 20/10, design `f2-app-camara`; 12/11, cam-04/05):
 * photo and video with sound, the recent photos over the shutter, and «Enviar» opening on top of
 * the same screen (two modals do not stack well on Android). It mounts only while open: the GPS
 * and the clock of the stamp do not run behind a closed chat.
 */
export function ChatCamera(props: Props) {
  /** While the photo is being cropped, «back» closes the crop (01/11). */
  const sendScreenBack = useRef<(() => void) | null>(null);
  const takenBack = useRef<(() => boolean) | null>(() => (sendScreenBack.current ? (sendScreenBack.current(), true) : false));
  if (!props.visible) return null;
  return (
    <Camera
      testID="camara-del-chat"
      title={`Para: ${props.nombreDelChat}`}
      video={{}}
      soundChip
      recent
      onGallery={props.onGaleria}
      onClose={props.onCerrar}
      takenBack={takenBack}
      renderTaken={(taken, retake) => <SendTaken taken={taken} backRef={sendScreenBack} onCancel={retake} onSend={(fotos, opciones) => (props.onEnviar(fotos, opciones), props.onCerrar())} />}
    />
  );
}

function SendTaken(props: { taken: TakenMedia; backRef: { current: (() => void) | null }; onCancel: () => void; onSend: (fotos: FotoAEnviar[], opciones: { hd: boolean }) => void }) {
  // One list per shot: a new one each second (the live clock) wiped the caption in «Enviar» (José 13/11).
  const list = useMemo(() => [elegidaOf(props.taken)], [props.taken]);
  return <EnviarFotos embebido backRef={props.backRef} fotos={list} onCancelar={props.onCancel} onEnviar={props.onSend} />;
}

const elegidaOf = (taken: TakenMedia): FotoElegida => ({
  uri: taken.uri,
  fileName: taken.fileName,
  mimeType: taken.mime,
  ...(taken.width ? { width: taken.width } : {}),
  ...(taken.height ? { height: taken.height } : {}),
  ...(taken.stamp ? { stamp: taken.stamp } : {}),
  ...(taken.seen ? { seen: taken.seen } : {}),
});
