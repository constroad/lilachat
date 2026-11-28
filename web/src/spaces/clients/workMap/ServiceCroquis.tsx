import { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';
import { SERVICE_CROQUIS_LABEL, serviceCroquisVia, type MapEditSend } from '@lilachat/shared';
import { FRAMED_ORIGINS, PortalEmbedFrame, type LinkState } from '../reports/PortalEmbedWeb';

/**
 * Portal's croquis editor of the service (José 19/11), in the same frame as a visit's croquis. Its
 * link lives only here (12 h), never in a message. Closing reads the map again: new drawings show.
 */
export function ServiceCroquisFrame(props: { send: MapEditSend; title: string; onClose: () => void }) {
  const [state, setState] = useState<LinkState>({ kind: 'asking' });
  const [round, setRound] = useState(0);
  // The door is made again on every render of the map: only «Reintentar» asks for a new link.
  const send = useRef(props.send);
  send.current = props.send;
  useEffect(() => {
    let alive = true;
    setState({ kind: 'asking' });
    void serviceCroquisVia(send.current, FRAMED_ORIGINS).then((opened) => {
      if (alive) setState(opened.ok ? { kind: 'ready', link: opened.link } : { kind: 'failed', message: opened.message });
    });
    return () => { alive = false; };
  }, [round]);
  const again = useCallback(() => setRound((count) => count + 1), []);
  return <PortalEmbedFrame state={state} again={again} kicker={props.title} title="Croquis" onClose={props.onClose} />;
}

/** «Editar croquis» for every member of the channel: the button and, once pressed, the editor. */
export function ServiceCroquisButton(props: { send: MapEditSend; title: string; onDone: () => void; className: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const { onDone } = props;
  const close = useCallback(() => { setOpen(false); onDone(); }, [onDone]);
  return (
    <>
      <button type="button" data-testid="mapa-editar-croquis" onClick={() => setOpen(true)} className={props.className}><PenLine size={16} /> {props.label ?? SERVICE_CROQUIS_LABEL}</button>
      {open ? <ServiceCroquisFrame send={props.send} title={props.title} onClose={close} /> : null}
    </>
  );
}
