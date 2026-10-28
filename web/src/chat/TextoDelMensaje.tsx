import { useState } from 'react';
import { partirEnMenciones, recorteDeMensaje, textoDeMencion } from '@lilachat/shared';
import type { MencionEnMensaje } from '@lilachat/shared';
import { LinkedText } from './LinkedText';

/** Lo desplegado se recuerda por mensaje: la lista virtualizada desmonta las burbujas al scrollear. */
const desplegados = new Set<string>();

/**
 * El texto de una burbuja (W2): las @menciones con el nombre que ve ESTA
 * persona («@Tú» si soy yo) y, si es largo, cortado con «Leer más» como la app
 * (`recorteDeMensaje`, compartido).
 */
export function TextoDelMensaje(props: {
  clave: string;
  texto: string;
  menciones?: MencionEnMensaje[];
  nombres: ReadonlyMap<string, string>;
  yo: string;
  mio: boolean;
}) {
  const [abierto, setAbierto] = useState(() => desplegados.has(props.clave));
  const recorte = recorteDeMensaje(props.texto);
  const visible = abierto || !recorte.recortado ? props.texto : recorte.texto;
  const largoVisible = recorte.recortado && !abierto ? recorte.texto.length - 1 : props.texto.length;
  const menciones = (props.menciones ?? []).filter((uno) => uno.desde + uno.largo <= largoVisible);
  const alternar = () => {
    if (abierto) desplegados.delete(props.clave);
    else desplegados.add(props.clave);
    setAbierto(!abierto);
  };
  return (
    <p className="whitespace-pre-wrap break-words">
      {partirEnMenciones(visible, menciones).map((tramo, indice) =>
        tramo.tipo === 'mencion' ? (
          <span key={indice} className={`font-semibold ${props.mio ? '' : 'text-primary'}`}>
            {textoDeMencion({ userId: tramo.userId, original: tramo.texto, nombres: props.nombres, yo: props.yo })}
          </span>
        ) : (
          <LinkedText key={indice} text={tramo.texto} own={props.mio} />
        )
      )}
      {recorte.recortado ? (
        <button type="button" onClick={alternar} className={`ml-1 font-semibold underline-offset-2 hover:underline ${props.mio ? '' : 'text-primary'}`}>
          {abierto ? 'Ver menos' : 'Leer más'}
        </button>
      ) : null}
    </p>
  );
}

/** Links, correos y celulares tocables (motor compartido con la app). */
