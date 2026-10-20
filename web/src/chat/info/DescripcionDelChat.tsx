import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MAX_DESCRIPCION_DE_GRUPO, partirEnEnlaces } from '@lilachat/shared';

/** Cuántas líneas se ven antes de «Leer más» (diseño `f1-web-info-fijados`). */
const LINEAS_CERRADA = 6;

/**
 * La descripción del grupo en el panel «Info.» (José, 20/10: «textos grandes
 * como Slack»): párrafos, links, «Leer más» y edición en el lugar para quien
 * puede. Sin descripción, quien puede ve «Agregar descripción»; quien no, nada.
 */
export function DescripcionDelChat(props: { descripcion?: string; editable: boolean; onGuardar: (descripcion: string) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [larga, setLarga] = useState(false);
  const [texto, setTexto] = useState(props.descripcion ?? '');
  const parrafo = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = parrafo.current;
    if (el && !abierta) setLarga(el.scrollHeight > el.clientHeight + 1);
  }, [props.descripcion, abierta]);
  if (!props.descripcion && !props.editable) return null;

  const guardar = async () => {
    if (await props.onGuardar(texto)) setEditando(false);
  };

  return (
    <section data-testid="tarjeta-descripcion" className="mt-2 bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Descripción</h3>
        {props.editable && !editando ? (
          <button
            type="button"
            data-testid="btn-editar-descripcion"
            aria-label="Editar la descripción"
            onClick={() => {
              setTexto(props.descripcion ?? '');
              setEditando(true);
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"
          >
            <Pencil size={15} />
          </button>
        ) : null}
      </div>
      {editando ? (
        <div className="mt-1">
          <textarea
            data-testid="input-descripcion"
            value={texto}
            autoFocus
            rows={7}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="De qué trata el grupo, reglas, horarios, enlaces…"
            className="w-full resize-y rounded-xl border border-outline/25 bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className={`flex-1 text-[11px] ${[...texto].length > MAX_DESCRIPCION_DE_GRUPO ? 'text-error' : 'text-on-surface-variant'}`}>
              {[...texto].length}/{MAX_DESCRIPCION_DE_GRUPO}
            </span>
            <button type="button" data-testid="btn-cancelar-descripcion" onClick={() => setEditando(false)} className="min-h-[36px] rounded-lg px-3 text-sm hover:bg-background">
              Cancelar
            </button>
            <button type="button" data-testid="btn-guardar-descripcion" onClick={() => void guardar()} className="min-h-[36px] rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
              Guardar
            </button>
          </div>
        </div>
      ) : props.descripcion ? (
        <>
          <p ref={parrafo} data-testid="texto-descripcion" className="mt-1 whitespace-pre-wrap text-sm leading-6" style={abierta ? undefined : { display: '-webkit-box', WebkitLineClamp: LINEAS_CERRADA, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {partirEnEnlaces(props.descripcion).map((parte, indice) =>
              parte.tipo === 'texto' ? (
                parte.texto
              ) : (
                <a key={indice} href={parte.destino} target={parte.tipo === 'url' ? '_blank' : undefined} rel="noreferrer" className="text-primary underline">
                  {parte.texto}
                </a>
              )
            )}
          </p>
          {larga || abierta ? (
            <button type="button" data-testid="btn-leer-mas" onClick={() => setAbierta((antes) => !antes)} className="mt-1 min-h-[32px] text-sm font-semibold text-primary">
              {abierta ? 'Leer menos' : 'Leer más'}
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" data-testid="btn-agregar-descripcion" onClick={() => setEditando(true)} className="mt-1 min-h-[36px] text-sm text-primary">
          Agregar descripción
        </button>
      )}
    </section>
  );
}
