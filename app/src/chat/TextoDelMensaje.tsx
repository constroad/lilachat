import { Fragment, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { partirEnMenciones, type MencionEnMensaje } from '@lilachat/shared';
import { TextoConEnlaces } from './TextoConEnlaces';
import { textoDeMencion } from './textoDelComposer';
import { recorteDeMensaje } from './mensajeLargo';

/**
 * Los mensajes largos que se abrieron, por id: la lista recicla las celdas y un
 * estado local pasaría de un mensaje a otro. Al volver a verlo sigue abierto.
 */
const abiertos = new Set<string>();
import { useColores } from '../ui/tema';

/**
 * El texto de una burbuja con sus @menciones y sus links (18/10). Cada mención
 * se dibuja con el nombre que TÚ le tienes a esa persona —no con el que puso
 * quien escribió—, y si no se sabe, con el texto original. Tramos anidados:
 * la hora sigue cayendo al final de la última línea.
 */
export function TextoDelMensaje(props: {
  texto: string;
  menciones?: MencionEnMensaje[];
  nombres?: ReadonlyMap<string, string>;
  yo: string;
  enBurbujaPropia: boolean;
  /** Para recordar si un mensaje largo se abrió (ver `abiertos`). */
  id: string;
}) {
  const colores = useColores();
  const [, redibujar] = useState(0);
  const abierto = abiertos.has(props.id);
  const recorte = useMemo(() => recorteDeMensaje(props.texto), [props.texto]);
  // Colapsado (José, 19/10): hasta 700 caracteres o 15 líneas, con «Leer más».
  const visible = recorte.recortado && !abierto ? recorte.texto : props.texto;
  const tramos = useMemo(() => partirEnMenciones(visible, props.menciones), [visible, props.menciones]);
  const alternar = () => {
    if (abierto) abiertos.delete(props.id);
    else abiertos.add(props.id);
    redibujar((n) => n + 1);
  };
  const leerMas = recorte.recortado ? (
    <Text testID={`leer-mas-${props.id}`} onPress={alternar} suppressHighlighting style={{ color: props.enBurbujaPropia ? colores['on-burbuja-propia'] : colores.primary, fontWeight: '600' }}>
      {abierto ? ' Ver menos' : ' Leer más'}
    </Text>
  ) : null;
  if (tramos.length === 1 && tramos[0]?.tipo === 'texto') {
    return (
      <>
        <TextoConEnlaces texto={visible} enBurbujaPropia={props.enBurbujaPropia} />
        {leerMas}
      </>
    );
  }
  return (
    <>
      {tramos.map((tramo, indice) =>
        tramo.tipo === 'texto' ? (
          <Fragment key={indice}>
            <TextoConEnlaces texto={tramo.texto} enBurbujaPropia={props.enBurbujaPropia} />
          </Fragment>
        ) : (
          <Text
            key={indice}
            testID={`mencion-${tramo.userId}`}
            style={{ color: props.enBurbujaPropia ? colores['on-burbuja-propia'] : colores.primary, fontWeight: '600' }}
          >
            {textoDeMencion({ userId: tramo.userId, original: tramo.texto, nombres: props.nombres, yo: props.yo })}
          </Text>
        )
      )}
      {leerMas}
    </>
  );
}
